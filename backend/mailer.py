import os
import smtplib
import ssl
import logging
import urllib.request
import urllib.error
import json as _json
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
from dotenv import load_dotenv

# Load .env: first check backend directory, then fallback to current working directory
_backend_dir = os.path.dirname(os.path.abspath(__file__))
_env_path = os.path.join(_backend_dir, ".env")
if os.path.exists(_env_path):
    load_dotenv(dotenv_path=_env_path, override=True)
else:
    load_dotenv(override=True)

logger = logging.getLogger(__name__)

# ── Module-level SMTP config diagnostic ──────────────────────────────────────
# Printed at import time to verify environment variables are configured.
# Values are NEVER printed — only whether each variable is set (True/False).
def _print_smtp_diagnostic() -> None:
    host     = os.getenv("SMTP_HOST")
    port     = os.getenv("SMTP_PORT")
    username = os.getenv("SMTP_USERNAME") or os.getenv("SMTP_USER")
    password = os.getenv("SMTP_PASSWORD") or os.getenv("SMTP_PASS")
    from_    = os.getenv("SMTP_FROM_EMAIL") or os.getenv("SMTP_FROM")

    print("[Mailer] SMTP configuration check:", flush=True)
    print(f"SMTP_HOST configured: {bool(host)}", flush=True)
    print(f"SMTP_PORT configured: {bool(port)}", flush=True)
    print(f"SMTP_USERNAME configured: {bool(username)}", flush=True)
    print(f"SMTP_PASSWORD configured: {bool(password)}", flush=True)
    print(f"SMTP_FROM_EMAIL configured: {bool(from_)}", flush=True)

_print_smtp_diagnostic()


def mask_email(email: str) -> str:
    """Return masked email for privacy display — e.g. j***e@company.com"""
    if not email or "@" not in email:
        return "your registered email"
    user, domain = email.split("@", 1)
    if len(user) <= 2:
        masked_user = user[0] + "***"
    else:
        masked_user = user[0] + "***" + user[-1]
    return f"{masked_user}@{domain}"


def _get_smtp_config() -> dict:
    """
    Read SMTP credentials fresh from env at call time.
    This means changes to .env are picked up without a restart.
    Automatically sanitizes spaces from Gmail app passwords and strips quotes/whitespace.
    """
    if os.path.exists(_env_path):
        load_dotenv(dotenv_path=_env_path, override=True)
    else:
        load_dotenv(override=True)

    raw_pw = os.getenv("SMTP_PASSWORD") or os.getenv("SMTP_PASS") or ""
    # Strip spaces (Gmail App Passwords are 16 chars usually displayed with spaces: 'xxxx xxxx xxxx xxxx')
    cleaned_pw = raw_pw.strip().strip("'\"").replace(" ", "")

    raw_user = os.getenv("SMTP_USERNAME") or os.getenv("SMTP_USER") or ""
    cleaned_user = raw_user.strip().strip("'\"")

    raw_host = (os.getenv("SMTP_HOST") or "").strip().strip("'\"")
    raw_from = (os.getenv("SMTP_FROM_EMAIL") or os.getenv("SMTP_FROM") or cleaned_user or "no-reply@churnguard.io").strip().strip("'\"")

    try:
        port = int(os.getenv("SMTP_PORT", "587"))
    except (ValueError, TypeError):
        port = 587

    return {
        "host":     raw_host,
        "port":     port,
        "user":     cleaned_user,
        "password": cleaned_pw,
        "from_":    raw_from,
    }


def is_dev_mode() -> bool:
    """Return whether development mode is active via DEV_MODE env variable."""
    return os.getenv("DEV_MODE", "false").lower() in ("true", "1", "yes", "dev", "development")


def _safe_smtp_login(server: smtplib.SMTP, user: str, password: str) -> None:
    """
    Authenticate against SMTP server cleanly.
    Avoids Python smtplib bug where a 535 rejection on AUTH PLAIN causes the server
    to close the socket, which then causes smtplib's fallback AUTH LOGIN attempt to raise
    an unhandled SMTPServerDisconnected (masking the true BadCredentials error).
    """
    server.ehlo_or_helo_if_needed()
    if not server.has_extn("auth"):
        raise smtplib.SMTPException("SMTP AUTH extension not supported by server.")

    auth_mechanisms = server.esmtp_features.get("auth", "").upper().split()

    # Prioritize LOGIN, then PLAIN
    preferred = []
    if "LOGIN" in auth_mechanisms:
        preferred.append("LOGIN")
    if "PLAIN" in auth_mechanisms:
        preferred.append("PLAIN")
    for m in auth_mechanisms:
        if m not in preferred and m in ("CRAM-MD5",):
            preferred.append(m)

    last_auth_error = None
    server.user = user
    server.password = password

    for authmethod in preferred:
        method_name = "auth_" + authmethod.lower().replace("-", "_")
        auth_func = getattr(server, method_name, None)
        if not auth_func:
            continue
        try:
            code, resp = server.auth(authmethod, auth_func)
            if code in (235, 503):
                return
        except smtplib.SMTPAuthenticationError as auth_err:
            last_auth_error = auth_err
            # Provider (e.g. Gmail) explicitly rejected credentials.
            # Stop immediately to avoid sending subsequent commands over a dead/closed socket.
            break
        except smtplib.SMTPServerDisconnected as disc_err:
            if last_auth_error:
                raise last_auth_error from disc_err
            raise smtplib.SMTPAuthenticationError(
                535,
                "Authentication failed: SMTP server disconnected during authentication attempt. "
                "Verify username and 16-character App Password (without spaces)."
            ) from disc_err

    if last_auth_error:
        code = getattr(last_auth_error, "smtp_code", 535)
        err_msg = str(getattr(last_auth_error, "smtp_error", last_auth_error))
        raise smtplib.SMTPAuthenticationError(
            code,
            f"Authentication failed (code {code}): {err_msg}. "
            "Verify username and 16-character App Password (without spaces)."
        ) from last_auth_error

    try:
        server.login(user, password)
    except smtplib.SMTPServerDisconnected as disc_err:
        raise smtplib.SMTPAuthenticationError(
            535,
            "Authentication failed: SMTP server disconnected during login attempt. "
            "Verify username and 16-character App Password (without spaces)."
        ) from disc_err


def _send_with_connection(cfg: dict, to_email: str, msg_str: str) -> None:
    """
    Connect to SMTP server and transmit message.
    Tries the configured port first. If connection or timeout fails and the host is
    a standard mail provider (such as Gmail), attempts alternate port (587 <-> 465).
    Authentication errors are NOT retried across ports.
    """
    primary_port = cfg["port"]
    alternate_port = 465 if primary_port == 587 else 587
    ports_to_try = [primary_port]
    if cfg["host"] in ("smtp.gmail.com", "smtp-mail.outlook.com", "smtp.office365.com"):
        ports_to_try.append(alternate_port)

    last_conn_error = None
    for attempt_port in ports_to_try:
        try:
            context = ssl.create_default_context()
            if attempt_port == 465:
                with smtplib.SMTP_SSL(cfg["host"], attempt_port, context=context, timeout=15) as server:
                    _safe_smtp_login(server, cfg["user"], cfg["password"])
                    server.sendmail(cfg["from_"], to_email, msg_str)
                    return
            else:
                with smtplib.SMTP(cfg["host"], attempt_port, timeout=15) as server:
                    server.ehlo()
                    server.starttls(context=context)
                    server.ehlo()
                    _safe_smtp_login(server, cfg["user"], cfg["password"])
                    server.sendmail(cfg["from_"], to_email, msg_str)
                    return
        except smtplib.SMTPAuthenticationError:
            # Credentials rejected; port change will not resolve bad credentials
            raise
        except (smtplib.SMTPConnectError, smtplib.SMTPServerDisconnected, TimeoutError, OSError) as conn_err:
            last_conn_error = conn_err
            if attempt_port != ports_to_try[-1]:
                logger.warning(
                    "[Mailer] Connection to %s:%s failed (%s). Retrying fallback port %s...",
                    cfg["host"], attempt_port, conn_err, ports_to_try[-1]
                )
                print(
                    f"[Mailer] Connection to {cfg['host']}:{attempt_port} failed ({conn_err}). Retrying port {ports_to_try[-1]}...",
                    flush=True
                )
                continue
            raise conn_err

    if last_conn_error:
        raise last_conn_error


def _get_email_provider() -> str:
    """
    Return the active email provider: 'smtp' | 'resend' | 'brevo'.
    Reads EMAIL_PROVIDER env var; defaults to 'smtp'.
    """
    return (os.getenv("EMAIL_PROVIDER") or "smtp").strip().lower()


def _dispatch_via_resend(to_email: str, subject: str, html_content: str, text_content: str) -> bool:
    """
    Send email through Resend HTTP API (https://resend.com).
    Requires RESEND_API_KEY in environment.
    Returns True on success, raises RuntimeError on failure.
    Never prints the API key.
    """
    api_key = (os.getenv("RESEND_API_KEY") or "").strip()
    from_addr = (os.getenv("SMTP_FROM_EMAIL") or os.getenv("EMAIL_FROM") or "").strip()

    if not api_key:
        raise RuntimeError(
            "EMAIL_PROVIDER=resend but RESEND_API_KEY is not set in environment. "
            "Add it to backend/.env and to the Render dashboard."
        )
    if not from_addr:
        raise RuntimeError(
            "EMAIL_PROVIDER=resend but SMTP_FROM_EMAIL (or EMAIL_FROM) is not set. "
            "This must be a verified sender in your Resend account."
        )

    logger.info("[Mailer/Resend] Sending to %s via Resend API", mask_email(to_email))

    payload = _json.dumps({
        "from":    from_addr,
        "to":      [to_email],
        "subject": subject,
        "html":    html_content,
        "text":    text_content,
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://api.resend.com/emails",
        data=payload,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type":  "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            body = resp.read().decode("utf-8")
            logger.info(
                "[Mailer/Resend] Message accepted for delivery to %s (id: %s)",
                mask_email(to_email),
                _json.loads(body).get("id", "unknown"),
            )
            print(
                f"[Mailer/Resend] Message accepted for delivery to {mask_email(to_email)}",
                flush=True,
            )
            return True
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        err_msg = f"Resend API HTTP error {exc.code}: {body}"
        logger.error("[Mailer/Resend] %s", err_msg)
        raise RuntimeError(err_msg) from exc
    except Exception as exc:
        err_msg = f"Resend API call failed: {type(exc).__name__}: {exc}"
        logger.error("[Mailer/Resend] %s", err_msg)
        raise RuntimeError(err_msg) from exc


def _dispatch_via_brevo(to_email: str, subject: str, html_content: str, text_content: str) -> bool:
    """
    Send email through Brevo (formerly Sendinblue) Transactional Email API.
    Requires BREVO_API_KEY in environment.
    Returns True on success, raises RuntimeError on failure.
    Never prints the API key.
    """
    api_key  = (os.getenv("BREVO_API_KEY") or "").strip()
    from_addr = (os.getenv("SMTP_FROM_EMAIL") or os.getenv("EMAIL_FROM") or "").strip()
    from_name = (os.getenv("EMAIL_FROM_NAME") or "ChurnGuard").strip()

    if not api_key:
        raise RuntimeError(
            "EMAIL_PROVIDER=brevo but BREVO_API_KEY is not set in environment. "
            "Add it to backend/.env and to the Render dashboard."
        )
    if not from_addr:
        raise RuntimeError(
            "EMAIL_PROVIDER=brevo but SMTP_FROM_EMAIL (or EMAIL_FROM) is not set."
        )

    logger.info("[Mailer/Brevo] Sending to %s via Brevo API", mask_email(to_email))

    payload = _json.dumps({
        "sender":      {"name": from_name, "email": from_addr},
        "to":          [{"email": to_email}],
        "subject":     subject,
        "htmlContent": html_content,
        "textContent": text_content,
    }).encode("utf-8")

    req = urllib.request.Request(
        "https://api.brevo.com/v3/smtp/email",
        data=payload,
        headers={
            "api-key":      api_key,
            "Content-Type": "application/json",
            "Accept":       "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            body = resp.read().decode("utf-8")
            logger.info(
                "[Mailer/Brevo] Message accepted for delivery to %s (messageId: %s)",
                mask_email(to_email),
                _json.loads(body).get("messageId", "unknown"),
            )
            print(
                f"[Mailer/Brevo] Message accepted for delivery to {mask_email(to_email)}",
                flush=True,
            )
            return True
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        err_msg = f"Brevo API HTTP error {exc.code}: {body}"
        logger.error("[Mailer/Brevo] %s", err_msg)
        raise RuntimeError(err_msg) from exc
    except Exception as exc:
        err_msg = f"Brevo API call failed: {type(exc).__name__}: {exc}"
        logger.error("[Mailer/Brevo] %s", err_msg)
        raise RuntimeError(err_msg) from exc


def _dispatch_email(to_email: str, subject: str, html_content: str, text_content: str) -> bool:
    """
    Dispatch email via the configured provider: 'smtp' (default), 'resend', or 'brevo'.

    Provider selection:
      EMAIL_PROVIDER=smtp    → uses existing SMTP path (SMTP_HOST/USERNAME/PASSWORD)
      EMAIL_PROVIDER=resend  → uses Resend HTTP API   (RESEND_API_KEY)
      EMAIL_PROVIDER=brevo   → uses Brevo HTTP API    (BREVO_API_KEY)

    Returns True on success.
    Raises RuntimeError with a safe message if transmission fails.
    Never returns True on failure. Never logs credentials.

    NOTE: Acceptance by the mail server/API does NOT guarantee inbox delivery.
    If the email is accepted but not received: check the spam folder, and verify
    SPF, DKIM, and DMARC DNS records for your sending domain.
    """
    provider = _get_email_provider()

    if provider == "resend":
        logger.info("[Mailer] Using EMAIL_PROVIDER=resend")
        return _dispatch_via_resend(to_email, subject, html_content, text_content)

    if provider == "brevo":
        logger.info("[Mailer] Using EMAIL_PROVIDER=brevo")
        return _dispatch_via_brevo(to_email, subject, html_content, text_content)

    # ── Default: SMTP ─────────────────────────────────────────────────────────
    cfg = _get_smtp_config()

    if not (cfg["host"] and cfg["user"] and cfg["password"]):
        missing = []
        if not cfg["host"]:     missing.append("SMTP_HOST")
        if not cfg["user"]:     missing.append("SMTP_USERNAME")
        if not cfg["password"]: missing.append("SMTP_PASSWORD")
        err_msg = (
            f"SMTP credentials are not configured (missing: {', '.join(missing)}). "
            "Set them in backend/.env or on the Render dashboard. "
            "Alternatively set EMAIL_PROVIDER=resend (RESEND_API_KEY) or "
            "EMAIL_PROVIDER=brevo (BREVO_API_KEY) to use an HTTP-based provider."
        )
        logger.error("[Mailer] %s", err_msg)
        print(f"[Mailer] Error: {err_msg}", flush=True)
        raise RuntimeError(err_msg)

    logger.info(
        "[Mailer] Attempting SMTP connection to %s:%s as %s",
        cfg["host"], cfg["port"],
        mask_email(cfg["user"]) if cfg["user"] else "(none)",
    )

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = cfg["from_"]
        msg["To"]      = to_email

        msg.attach(MIMEText(text_content, "plain"))
        msg.attach(MIMEText(html_content, "html"))

        _send_with_connection(cfg, to_email, msg.as_string())

        logger.info(
            "[Mailer] SMTP accepted message for delivery to %s (subject: '%s')",
            mask_email(to_email), subject
        )
        print(
            f"[Mailer] SMTP accepted message for delivery to {mask_email(to_email)} (subject: '{subject}')",
            flush=True
        )
        return True

    except smtplib.SMTPAuthenticationError as exc:
        code = getattr(exc, "smtp_code", 535)
        raw_msg = str(getattr(exc, "smtp_error", exc))
        is_bad_creds = "badcredentials" in raw_msg.lower() or "not accepted" in raw_msg.lower()
        hint = (
            " (BadCredentials: check your 16-character Gmail App Password without spaces in "
            "backend/.env — or regenerate it at myaccount.google.com/apppasswords)"
        ) if is_bad_creds else ""
        err_msg = f"SMTP authentication failed (code {code}){hint}"
        logger.error("[Mailer] %s: %s", err_msg, exc)
        print(f"[Mailer] {err_msg}: {exc}", flush=True)
        raise RuntimeError(err_msg) from exc

    except TimeoutError as exc:
        err_msg = (
            f"SMTP connection timed out connecting to {cfg['host']}:{cfg['port']}. "
            "If running on Render, outbound SMTP may be blocked — "
            "set EMAIL_PROVIDER=resend or EMAIL_PROVIDER=brevo."
        )
        logger.error("[Mailer] %s (%s)", err_msg, exc)
        print(f"[Mailer] {err_msg}", flush=True)
        raise RuntimeError(err_msg) from exc

    except (smtplib.SMTPConnectError, OSError) as exc:
        err_msg = (
            f"SMTP connection error ({type(exc).__name__}: {exc}). "
            "Check SMTP_HOST / SMTP_PORT, or switch to EMAIL_PROVIDER=resend / brevo "
            "if outbound SMTP is blocked by your hosting provider."
        )
        logger.error("[Mailer] %s", err_msg)
        print(f"[Mailer] {err_msg}", flush=True)
        raise RuntimeError(err_msg) from exc

    except smtplib.SMTPRecipientsRefused as exc:
        err_msg = f"SMTP rejected the recipient address: {exc}"
        logger.error("[Mailer] %s", err_msg)
        raise RuntimeError(err_msg) from exc

    except smtplib.SMTPException as exc:
        err_msg = f"SMTP error ({type(exc).__name__}: {exc})"
        logger.error("[Mailer] %s", err_msg)
        print(f"[Mailer] {err_msg}", flush=True)
        raise RuntimeError(err_msg) from exc

    except Exception as exc:
        err_msg = f"Email dispatch failed unexpectedly: {type(exc).__name__}: {exc}"
        logger.exception("[Mailer] %s", err_msg)
        print(f"[Mailer] {err_msg}", flush=True)
        raise RuntimeError(err_msg) from exc


def send_registration_otp_email(to_email: str, first_name: Optional[str] = None) -> bool:
    """
    Send the registration / email-verification OTP email.

    IMPORTANT: The OTP code is NOT passed into this function intentionally.
    The OTP is already stored in MongoDB. The email simply instructs the user
    to check their inbox — the OTP comes from the DB, not from the email subject.

    Returns True on success, False on failure.
    Raises RuntimeError if SMTP is not configured.
    """
    greeting_name = first_name.strip().title() if first_name else "there"

    subject = "Verify your ChurnGuard account"

    text_content = (
        f"Hello {greeting_name},\n\n"
        "Welcome to ChurnGuard! To complete your registration, please enter "
        "the 6-digit verification code shown in this email.\n\n"
        "This code expires in 10 minutes.\n\n"
        "If you did not create a ChurnGuard account, you can ignore this email.\n\n"
        "— The ChurnGuard Team"
    )

    # NOTE: The OTP is injected by the caller via the `otp_display` parameter below.
    # This function signature is intentionally separate so the OTP is only
    # ever rendered in the email body — never in logs or subjects.
    raise RuntimeError(
        "Use send_registration_otp_email_with_code() — this stub should not be called directly."
    )


def send_registration_otp_email_with_code(
    to_email: str,
    otp_code: str,
    first_name: Optional[str] = None
) -> bool:
    """
    Send registration verification email containing the OTP code in the body.

    - OTP is rendered in the HTML body only.
    - OTP is NOT logged to console.
    - OTP is NOT placed in the email subject line.
    - Returns True on success, False on failure.
    - Raises RuntimeError if SMTP is not configured.
    """
    greeting_name = first_name.strip().title() if first_name else "there"

    subject = "Verify your ChurnGuard account"

    text_content = (
        f"Hello {greeting_name},\n\n"
        f"Your ChurnGuard email verification code is: {otp_code}\n\n"
        "This code expires in 10 minutes. Do not share it with anyone.\n\n"
        "If you did not sign up for ChurnGuard, please ignore this email.\n\n"
        "— The ChurnGuard Team"
    )

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      margin: 0;
      padding: 20px;
      color: #1e293b;
    }}
    .container {{
      max-width: 520px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 36px 32px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.05);
    }}
    .badge {{
      display: inline-block;
      background: #f3e8ff;
      color: #7c3aed;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 99px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 20px;
    }}
    h2 {{
      font-size: 20px;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 8px;
    }}
    p {{
      font-size: 14px;
      color: #475569;
      line-height: 1.6;
      margin: 0 0 16px;
    }}
    .otp-box {{
      background: #faf5ff;
      border: 2px dashed #a855f7;
      border-radius: 12px;
      padding: 24px;
      text-align: center;
      margin: 24px 0;
    }}
    .otp-label {{
      font-size: 12px;
      font-weight: 600;
      color: #7c3aed;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 8px;
    }}
    .otp-code {{
      font-size: 38px;
      font-weight: 900;
      color: #6b21a8;
      letter-spacing: 10px;
      margin: 0;
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
    }}
    .warning {{
      font-size: 12px;
      color: #64748b;
      line-height: 1.6;
      background: #f8fafc;
      border-left: 3px solid #e2e8f0;
      padding: 10px 14px;
      border-radius: 0 8px 8px 0;
      margin: 16px 0;
    }}
    .footer {{
      font-size: 11px;
      color: #94a3b8;
      margin-top: 28px;
      border-top: 1px solid #f1f5f9;
      padding-top: 16px;
      line-height: 1.5;
    }}
  </style>
</head>
<body>
  <div class="container">
    <span class="badge">ChurnGuard · Account Verification</span>

    <h2>Verify your email address</h2>
    <p>
      Hello {greeting_name},<br>
      Thank you for signing up for ChurnGuard. Use the verification code below
      to complete your registration. The code expires in <strong>10 minutes</strong>.
    </p>

    <div class="otp-box">
      <div class="otp-label">Your verification code</div>
      <p class="otp-code">{otp_code}</p>
    </div>

    <div class="warning">
      🔒 <strong>Never share this code.</strong> ChurnGuard will never ask for your
      verification code by phone or chat. If you did not sign up, please ignore this email.
    </div>

    <div class="footer">
      This is an automated message from ChurnGuard Enterprise AI Platform.<br>
      Do not reply to this email.
    </div>
  </div>
</body>
</html>"""

    print(f"[Mailer] Dispatching registration verification email to {mask_email(to_email)}")
    return _dispatch_email(to_email, subject, html_content, text_content)


def send_password_otp_email(
    to_email: str,
    otp_code: str,
    first_name: Optional[str] = None
) -> bool:
    """
    Send password-change OTP email.

    - OTP is rendered in the HTML body only.
    - OTP is NOT logged to console.
    - OTP is NOT placed in the email subject line.
    - Returns True on success, False on failure.
    - Raises RuntimeError if SMTP is not configured.
    """
    greeting_name = first_name.strip().title() if first_name else "there"

    subject = "ChurnGuard – Password Change Verification"

    text_content = (
        f"Hello {greeting_name},\n\n"
        f"Your ChurnGuard password change verification code is: {otp_code}\n\n"
        "This code expires in 10 minutes. If you did not request this, "
        "contact your workspace administrator immediately.\n\n"
        "— The ChurnGuard Security Team"
    )

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      margin: 0;
      padding: 20px;
      color: #1e293b;
    }}
    .container {{
      max-width: 520px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 36px 32px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.05);
    }}
    .badge {{
      display: inline-block;
      background: #fff7ed;
      color: #c2410c;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 99px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 20px;
    }}
    h2 {{ font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 8px; }}
    p {{ font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 16px; }}
    .otp-box {{
      background: #fff7ed;
      border: 2px dashed #f97316;
      border-radius: 12px;
      padding: 24px;
      text-align: center;
      margin: 24px 0;
    }}
    .otp-label {{
      font-size: 12px;
      font-weight: 600;
      color: #c2410c;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 8px;
    }}
    .otp-code {{
      font-size: 38px;
      font-weight: 900;
      color: #9a3412;
      letter-spacing: 10px;
      margin: 0;
      font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
    }}
    .warning {{
      font-size: 12px;
      color: #64748b;
      line-height: 1.6;
      background: #f8fafc;
      border-left: 3px solid #e2e8f0;
      padding: 10px 14px;
      border-radius: 0 8px 8px 0;
      margin: 16px 0;
    }}
    .footer {{
      font-size: 11px;
      color: #94a3b8;
      margin-top: 28px;
      border-top: 1px solid #f1f5f9;
      padding-top: 16px;
      line-height: 1.5;
    }}
  </style>
</head>
<body>
  <div class="container">
    <span class="badge">ChurnGuard · Security</span>

    <h2>Verify password change</h2>
    <p>
      Hello {greeting_name},<br>
      We received a request to change your ChurnGuard account password.
      Use the verification code below to complete this change.
    </p>

    <div class="otp-box">
      <div class="otp-label">Password change code</div>
      <p class="otp-code">{otp_code}</p>
    </div>

    <div class="warning">
      ⚠️ <strong>This code expires in 10 minutes.</strong> If you did not request
      a password change, contact your workspace administrator immediately.
    </div>

    <div class="footer">
      This is an automated security message from ChurnGuard Enterprise AI Platform.<br>
      Do not reply to this email.
    </div>
  </div>
</body>
</html>"""

    print(f"[Mailer] Dispatching password-change verification email to {mask_email(to_email)}")
    return _dispatch_email(to_email, subject, html_content, text_content)


def send_password_reset_link_email(
    to_email: str,
    reset_url: str,
    first_name: Optional[str] = None
) -> bool:
    """
    Send password-reset email with a single-use secure reset link.

    - reset_url contains the secure token.
    - Link expires in 30 minutes.
    - Never logs tokens or sensitive data.
    - Returns True on success, raises RuntimeError if sending fails.
    """
    greeting_name = first_name.strip().title() if first_name else "there"

    subject = "Reset your ChurnGuard password"

    text_content = (
        f"Hello {greeting_name},\n\n"
        "We received a request to reset your ChurnGuard account password.\n\n"
        f"Click the link below to set a new password:\n{reset_url}\n\n"
        "⏱️ This link is valid for 30 minutes and can only be used once.\n\n"
        "If you did not request a password reset, you can safely ignore this email. "
        "Your account remains secure.\n\n"
        "— The ChurnGuard Security Team"
    )

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      margin: 0;
      padding: 20px;
      color: #1e293b;
    }}
    .container {{
      max-width: 520px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 36px 32px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.05);
    }}
    .badge {{
      display: inline-block;
      background: #eff6ff;
      color: #2563eb;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 99px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 20px;
    }}
    h1 {{
      font-size: 22px;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 12px;
    }}
    p {{
      font-size: 14px;
      color: #475569;
      line-height: 1.6;
      margin: 0 0 20px;
    }}
    .btn-container {{
      text-align: center;
      margin: 28px 0;
    }}
    .btn {{
      display: inline-block;
      background-color: #4338ca;
      color: #ffffff !important;
      font-size: 14px;
      font-weight: 600;
      padding: 12px 28px;
      border-radius: 10px;
      text-decoration: none;
      letter-spacing: 0.02em;
    }}
    .alt-link {{
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px;
      word-break: break-all;
      font-size: 12px;
      color: #64748b;
      margin: 20px 0;
    }}
    .warning {{
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 8px;
      padding: 12px 14px;
      font-size: 12px;
      color: #92400e;
      line-height: 1.5;
      margin: 20px 0 0;
    }}
    .footer {{
      font-size: 11px;
      color: #94a3b8;
      margin-top: 28px;
      border-top: 1px solid #f1f5f9;
      padding-top: 16px;
      line-height: 1.5;
    }}
  </style>
</head>
<body>
  <div class="container">
    <span class="badge">ChurnGuard Security</span>
    <h1>Reset Your Password</h1>
    <p>Hello {greeting_name},</p>
    <p>We received a request to reset your ChurnGuard account password. Click the button below to choose a new password.</p>

    <div class="btn-container">
      <a href="{reset_url}" target="_blank" class="btn">Reset Password</a>
    </div>

    <div class="alt-link">
      <strong>Or copy this link:</strong><br>
      <a href="{reset_url}" style="color: #4338ca; text-decoration: underline;">{reset_url}</a>
    </div>

    <div class="warning">
      ⏱️ <strong>This link expires in 30 minutes</strong> and can only be used once. If you did not request this, please ignore this email.
    </div>

    <div class="footer">
      This is an automated transmission from ChurnGuard Enterprise AI Platform.<br>
      Do not reply to this email.
    </div>
  </div>
</body>
</html>"""

    print(f"[Mailer] Dispatching password reset link email to {mask_email(to_email)}")
    return _dispatch_email(to_email, subject, html_content, text_content)


def send_password_changed_notification_email(
    to_email: str,
    first_name: Optional[str] = None
) -> bool:
    """
    Send security alert informing user that their account password has been changed.
    """
    greeting_name = first_name.strip().title() if first_name else "there"
    subject = "Security Alert: Your ChurnGuard password was changed"

    text_content = (
        f"Hello {greeting_name},\n\n"
        "This is confirmation that the password for your ChurnGuard account was successfully changed.\n\n"
        "If you made this change, no further action is required.\n\n"
        "If you did NOT make this change, please reset your password immediately or contact your administrator.\n\n"
        "— The ChurnGuard Security Team"
    )

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      margin: 0;
      padding: 20px;
      color: #1e293b;
    }}
    .container {{
      max-width: 520px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      padding: 36px 32px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.05);
    }}
    .badge {{
      display: inline-block;
      background: #f0fdf4;
      color: #16a34a;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 99px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 20px;
    }}
    h1 {{ font-size: 20px; font-weight: 800; color: #0f172a; margin: 0 0 12px; }}
    p {{ font-size: 14px; color: #475569; line-height: 1.6; margin: 0 0 16px; }}
    .alert-box {{
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 10px;
      padding: 16px;
      color: #991b1b;
      font-size: 13px;
      line-height: 1.5;
      margin: 20px 0;
    }}
    .footer {{
      font-size: 11px;
      color: #94a3b8;
      margin-top: 28px;
      border-top: 1px solid #f1f5f9;
      padding-top: 16px;
      line-height: 1.5;
    }}
  </style>
</head>
<body>
  <div class="container">
    <span class="badge">ChurnGuard · Security Notice</span>
    <h1>Password Changed Successfully</h1>
    <p>Hello {greeting_name},</p>
    <p>This is confirmation that the password for your ChurnGuard account (<strong>{mask_email(to_email)}</strong>) was updated recently.</p>
    <div class="alert-box">
      <strong>Didn't make this change?</strong><br>
      If you did not initiate this change, your credentials may be compromised. Please reset your password immediately or contact your administrator.
    </div>
    <div class="footer">
      This is an automated security transmission from ChurnGuard Enterprise AI Platform.<br>
      Do not reply to this email.
    </div>
  </div>
</body>
</html>"""

    print(f"[Mailer] Dispatching password changed alert to {mask_email(to_email)}")
    return _dispatch_email(to_email, subject, html_content, text_content)


# ── Backward compatibility alias ──────────────────────────────────────────────
# The old `send_otp_email` was used for password-change OTP only.
# Existing callers in main.py will continue to work unchanged.
def send_otp_email(to_email: str, otp_code: str, first_name: Optional[str] = None) -> bool:
    """
    Backward-compatible alias → routes to send_password_otp_email().
    New code should call send_registration_otp_email_with_code() or send_password_otp_email() directly.
    """
    return send_password_otp_email(to_email, otp_code, first_name)
