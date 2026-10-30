#!/usr/bin/env python3
"""
scripts/test_smtp.py
────────────────────
Standalone SMTP diagnostic tool for ChurnGuard.

Usage:
    python scripts/test_smtp.py recipient@example.com

What it does:
  1. Loads SMTP settings from backend/.env (same path resolution as the app).
  2. Prints safe diagnostics (host, port, masked user). NEVER prints the password.
  3. Opens an SMTP connection, completes TLS handshake, logs in, and sends a
     test email to the address you supply as the first CLI argument.
  4. Prints LOGIN OK / LOGIN FAILED / connection error clearly.

Exit codes:
  0 = message accepted by SMTP server (not guaranteed to be delivered)
  1 = configuration missing, authentication failure, or connection error
"""

import os
import sys
import smtplib
import ssl
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# ── Locate backend/.env (same logic as mailer.py) ────────────────────────────
_script_dir   = os.path.dirname(os.path.abspath(__file__))
_backend_dir  = os.path.abspath(os.path.join(_script_dir, ".."))
_env_path     = os.path.join(_backend_dir, ".env")

try:
    from dotenv import load_dotenv
    if os.path.exists(_env_path):
        load_dotenv(dotenv_path=_env_path, override=True)
        print(f"[test_smtp] Loaded env from: {_env_path}")
    else:
        load_dotenv(override=True)
        print(f"[test_smtp] .env not found at {_env_path}, loading from CWD")
except ImportError:
    print("[test_smtp] python-dotenv not installed; reading OS environment only")

# ── Add backend to path so mailer helpers are importable ─────────────────────
sys.path.insert(0, _backend_dir)
from mailer import _get_smtp_config, _safe_smtp_login, mask_email  # noqa: E402

logging.basicConfig(level=logging.DEBUG, format="%(levelname)s %(message)s")
logger = logging.getLogger("test_smtp")

# ─────────────────────────────────────────────────────────────────────────────

def main() -> int:
    if len(sys.argv) < 2:
        print("Usage: python scripts/test_smtp.py <recipient@example.com>")
        print("  Sends a test email via the configured SMTP settings.")
        return 1

    to_email = sys.argv[1].strip()
    if "@" not in to_email:
        print(f"[test_smtp] ERROR: '{to_email}' does not look like an email address.")
        return 1

    cfg = _get_smtp_config()

    print()
    print("=" * 60)
    print("  ChurnGuard SMTP Diagnostic")
    print("=" * 60)
    print(f"  SMTP Host  : {cfg['host'] or '(not set)'}")
    print(f"  SMTP Port  : {cfg['port']}")
    print(f"  SMTP User  : {mask_email(cfg['user']) if cfg['user'] else '(not set)'}")
    print(f"  From addr  : {cfg['from_'] or '(not set)'}")
    print(f"  Password   : {'*' * len(cfg['password'])} (len={len(cfg['password'])}) — NEVER printed")
    print(f"  To (test)  : {to_email}")
    print("=" * 60)

    # ── Validate config ───────────────────────────────────────────────────────
    missing = [k for k in ("host", "user", "password") if not cfg.get(k)]
    if missing:
        print(f"\n[test_smtp] FAIL — missing SMTP config: {missing}")
        print("  Set SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD in backend/.env")
        return 1

    # ── Build test message ────────────────────────────────────────────────────
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "ChurnGuard SMTP Test"
    msg["From"]    = cfg["from_"]
    msg["To"]      = to_email
    text = (
        "This is a ChurnGuard SMTP diagnostic test email.\n"
        "If you received this, SMTP delivery is working correctly.\n\n"
        "— ChurnGuard SMTP Test Tool"
    )
    html = (
        "<html><body>"
        "<h2>ChurnGuard SMTP Test ✅</h2>"
        "<p>If you received this email, SMTP delivery is working correctly.</p>"
        "<p><em>— ChurnGuard SMTP Test Tool</em></p>"
        "</body></html>"
    )
    msg.attach(MIMEText(text, "plain"))
    msg.attach(MIMEText(html,  "html"))

    # ── Attempt connection ────────────────────────────────────────────────────
    context = ssl.create_default_context()
    port    = cfg["port"]
    host    = cfg["host"]

    print(f"\n[test_smtp] Connecting to {host}:{port} ...")
    try:
        if port == 465:
            print(f"[test_smtp] Using SMTP_SSL (port 465 / implicit TLS)")
            server = smtplib.SMTP_SSL(host, port, context=context, timeout=15)
        else:
            print(f"[test_smtp] Using SMTP + STARTTLS (port {port})")
            server = smtplib.SMTP(host, port, timeout=15)
            server.ehlo()
            server.starttls(context=context)
            server.ehlo()

        print(f"[test_smtp] SMTP connection opened  [OK]")

    except (smtplib.SMTPConnectError, TimeoutError, OSError) as conn_err:
        print(f"\n[test_smtp] FAIL — Connection error: {type(conn_err).__name__}: {conn_err}")
        _print_connection_hints(host, port)
        return 1

    # ── Authenticate ──────────────────────────────────────────────────────────
    try:
        _safe_smtp_login(server, cfg["user"], cfg["password"])
        print(f"[test_smtp] SMTP login OK            [OK]")
    except smtplib.SMTPAuthenticationError as auth_err:
        code     = getattr(auth_err, "smtp_code", "?")
        raw_msg  = str(getattr(auth_err, "smtp_error", auth_err))
        print(f"\n[test_smtp] FAIL - Authentication error (code {code}): {raw_msg}")
        print("  * The SMTP server rejected the credentials.")
        print("  * For Gmail: generate a NEW 16-char App Password at")
        print("    https://myaccount.google.com/apppasswords")
        print("    (2-Step Verification must be enabled on the account)")
        print("  * Paste the App Password without spaces into SMTP_PASSWORD in backend/.env")
        print("  * SMTP_USER and SMTP_FROM_EMAIL must match the Gmail account exactly")
        try:
            server.quit()
        except Exception:
            pass
        return 1

    # ── Send ──────────────────────────────────────────────────────────────────
    try:
        server.sendmail(cfg["from_"], to_email, msg.as_string())
        print(f"[test_smtp] Message accepted by SMTP server for {to_email}  [OK]")
        print()
        print("  NOTE: SMTP acceptance ≠ guaranteed inbox delivery.")
        print("  If the email does not arrive:")
        print("  1. Check the spam / junk folder.")
        print("  2. Verify SPF, DKIM, and DMARC DNS records for your domain.")
        print("  3. If using Render free tier, outbound SMTP port 587 may be blocked;")
        print("     switch to an HTTP-based provider (set EMAIL_PROVIDER=resend or brevo).")
        server.quit()
        return 0
    except smtplib.SMTPRecipientsRefused as exc:
        print(f"\n[test_smtp] FAIL — Recipient refused: {exc}")
        return 1
    except smtplib.SMTPException as exc:
        print(f"\n[test_smtp] FAIL — SMTP error during send: {exc}")
        return 1


def _print_connection_hints(host: str, port: int) -> None:
    print()
    print("  Connection troubleshooting hints:")
    print(f"  • Could not reach {host}:{port}.")
    print("  • If running on Render free tier, outbound SMTP ports (25/465/587)")
    print("    may be blocked. Switch to an HTTP-based provider:")
    print("    Set EMAIL_PROVIDER=resend in Render env vars and RESEND_API_KEY=re_xxx")
    print("    or EMAIL_PROVIDER=brevo and BREVO_API_KEY=xkeysib-xxx")
    print("  • If running locally with no network (sandbox), this is expected.")


if __name__ == "__main__":
    sys.exit(main())

