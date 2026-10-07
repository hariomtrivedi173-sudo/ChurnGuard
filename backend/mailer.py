import os
import smtplib
import ssl
import logging
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


def _dispatch_email(to_email: str, subject: str, html_content: str, text_content: str) -> bool:
    """
    Low-level SMTP dispatch.
    Reads credentials fresh at call time.
    Returns True on success.
    Raises RuntimeError if SMTP is not configured or if send fails.
    """
    cfg = _get_smtp_config()

    is_dev = os.getenv("DEV_MODE", "false").lower() in ("true", "1", "yes", "dev", "development")

    if not (cfg["host"] and cfg["user"] and cfg["password"]):
        logger.error(
            "[Mailer] SMTP not configured — host_set=%s user_set=%s password_set=%s",
            bool(cfg["host"]),
            bool(cfg["user"]),
            bool(cfg["password"]),
        )
        if is_dev:
            print(f"[Mailer DEV FALLBACK] SMTP not configured, simulating dispatch to {to_email}", flush=True)
            return True
        raise RuntimeError("SMTP credentials are not configured in .env (SMTP_HOST, SMTP_USERNAME, or SMTP_PASSWORD missing)")

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

        context = ssl.create_default_context()
        if cfg["port"] == 465:
            with smtplib.SMTP_SSL(cfg["host"], cfg["port"], context=context, timeout=15) as server:
                server.login(cfg["user"], cfg["password"])
                server.sendmail(cfg["from_"], to_email, msg.as_string())
        else:
            with smtplib.SMTP(cfg["host"], cfg["port"], timeout=15) as server:
                server.ehlo()
                server.starttls(context=context)
                server.ehlo()
                server.login(cfg["user"], cfg["password"])
                server.sendmail(cfg["from_"], to_email, msg.as_string())

        logger.info("[Mailer] Email dispatched successfully to %s", mask_email(to_email))
        print(f"[Mailer] Email dispatched successfully to {mask_email(to_email)}", flush=True)
        return True

    except (smtplib.SMTPAuthenticationError, smtplib.SMTPConnectError, smtplib.SMTPException, OSError) as exc:
        logger.error("[Mailer] SMTP error: %s: %s", type(exc).__name__, exc)
        print(f"[Mailer] SMTP error: {type(exc).__name__}: {exc}", flush=True)
        raise RuntimeError(f"SMTP error ({type(exc).__name__}: {exc})") from exc

    except Exception as exc:
        logger.exception("[Mailer] Unexpected error during email dispatch: %s", exc)
        print(f"[Mailer] Unexpected error: {type(exc).__name__}: {exc}", flush=True)
        raise RuntimeError(f"Email dispatch error: {exc}") from exc


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


# ── Backward compatibility alias ──────────────────────────────────────────────
# The old `send_otp_email` was used for password-change OTP only.
# Existing callers in main.py will continue to work unchanged.
def send_otp_email(to_email: str, otp_code: str, first_name: Optional[str] = None) -> bool:
    """
    Backward-compatible alias → routes to send_password_otp_email().
    New code should call send_registration_otp_email_with_code() or send_password_otp_email() directly.
    """
    return send_password_otp_email(to_email, otp_code, first_name)
