#!/usr/bin/env python3
"""
ChurnGuard SMTP Verification & Diagnostic CLI
Tests DNS resolution, TCP connection, TLS handshake, SMTP AUTH, and sends a test email.
"""

import sys
import os
import socket
import time
import argparse
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime

# Add backend directory to sys.path
backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

env_path = os.path.join(backend_dir, ".env")
if os.path.exists(env_path):
    try:
        from dotenv import load_dotenv
        load_dotenv(dotenv_path=env_path, override=True)
    except ImportError:
        pass


def mask_str(s: str) -> str:
    if not s:
        return "(empty)"
    if "@" in s:
        parts = s.split("@", 1)
        u = parts[0]
        m = u[0] + "***" + (u[-1] if len(u) > 1 else "")
        return f"{m}@{parts[1]}"
    if len(s) <= 4:
        return "****"
    return s[:2] + "*" * (len(s) - 4) + s[-2:]


def main():
    parser = argparse.ArgumentParser(description="ChurnGuard SMTP Diagnostic & Verification")
    parser.add_argument("--to", dest="recipient", default=None, help="Recipient email address")
    parser.add_argument("--host", default=None, help="Override SMTP host")
    parser.add_argument("--port", type=int, default=None, help="Override SMTP port")
    args = parser.parse_args()

    # Load configuration
    host = (args.host or os.getenv("SMTP_HOST") or "smtp.gmail.com").strip().strip("'\"")
    port_env = args.port or os.getenv("SMTP_PORT") or 587
    try:
        port = int(port_env)
    except (ValueError, TypeError):
        port = 587

    user = (os.getenv("SMTP_USERNAME") or os.getenv("SMTP_USER") or "").strip().strip("'\"")
    raw_pw = os.getenv("SMTP_PASSWORD") or os.getenv("SMTP_PASS") or ""
    pw = raw_pw.strip().strip("'\"").replace(" ", "")
    from_addr = (os.getenv("SMTP_FROM_EMAIL") or os.getenv("SMTP_FROM") or user).strip().strip("'\"")
    recipient = (args.recipient or from_addr or user).strip().strip("'\"")

    print("=" * 60)
    print(" ChurnGuard SMTP Diagnostic & Verification Tool")
    print("=" * 60)
    print(f"Target Host    : {host}")
    print(f"Target Port    : {port}")
    print(f"Auth Username  : {mask_str(user)}")
    print(f"Password Set   : {'Yes (' + str(len(pw)) + ' chars)' if pw else 'No (EMPTY!)'}")
    print(f"Sender (From)  : {from_addr}")
    print(f"Recipient (To) : {recipient}")
    print("-" * 60)

    # Step 1: DNS Resolution
    print("[1/5] Testing DNS Resolution for SMTP host...", end=" ", flush=True)
    t0 = time.time()
    try:
        resolved_ips = socket.gethostbyname_ex(host)[2]
        dns_time_ms = (time.time() - t0) * 1000
        print(f"PASS ({dns_time_ms:.1f}ms -> {', '.join(resolved_ips[:2])})")
    except Exception as e:
        print(f"FAIL: {e}")
        return 1

    # Step 2: TCP Connection
    print(f"[2/5] Testing TCP connection to {host}:{port}...", end=" ", flush=True)
    t0 = time.time()
    try:
        sock = socket.create_connection((host, port), timeout=10)
        tcp_time_ms = (time.time() - t0) * 1000
        sock.close()
        print(f"PASS ({tcp_time_ms:.1f}ms latency)")
    except Exception as e:
        print(f"FAIL: {e}")
        if "timeout" in str(e).lower() or isinstance(e, TimeoutError):
            print("   -> Hint: Outbound port may be blocked by your ISP, firewall, or cloud host (Render blocks 25/465/587).")
        return 1

    # Step 3 & 4: TLS Handshake & SMTP Authentication
    print(f"[3/5] Testing TLS handshake and SMTP protocol...", end=" ", flush=True)
    server = None
    try:
        context = ssl.create_default_context()
        if port == 465:
            server = smtplib.SMTP_SSL(host, port, context=context, timeout=15)
        else:
            server = smtplib.SMTP(host, port, timeout=15)
            server.ehlo()
            server.starttls(context=context)
            server.ehlo()
        print("PASS (Secure channel established)")
    except Exception as e:
        print(f"FAIL: {e}")
        if server:
            try:
                server.close()
            except Exception:
                pass
        return 1

    print("[4/5] Testing SMTP Authentication...", end=" ", flush=True)
    if not user or not pw:
        print("SKIPPED (Missing username or password in environment)")
        if server:
            server.close()
        return 1

    try:
        # Use safe login from mailer module to avoid masked smtplib disconnect error
        from mailer import _safe_smtp_login
        _safe_smtp_login(server, user, pw)
        print("PASS (Authenticated successfully)")
    except smtplib.SMTPAuthenticationError as e:
        print(f"FAIL: {e}")
        print("   -> Diagnosis: Google SMTP returned 535 BadCredentials.")
        print("   -> Action needed: Check username or regenerate a new 16-character App Password at https://myaccount.google.com/apppasswords")
        if server:
            try:
                server.close()
            except Exception:
                pass
        return 1
    except Exception as e:
        print(f"FAIL: {e}")
        if server:
            try:
                server.close()
            except Exception:
                pass
        return 1

    # Step 5: Send Test Email
    now_str = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
    subject = f"ChurnGuard SMTP Verification {now_str}"
    print(f"[5/5] Sending verification email to {recipient}...", end=" ", flush=True)
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = from_addr
        msg["To"] = recipient

        body_text = (
            f"Hello,\n\n"
            f"This is an automated verification email from ChurnGuard.\n"
            f"SMTP configuration is valid and operational.\n"
            f"Timestamp: {now_str}\n"
            f"Host: {host}:{port}\n\n"
            f"— ChurnGuard Diagnostics"
        )
        body_html = f"""<!DOCTYPE html>
<html>
<body style="font-family:sans-serif; background:#f8fafc; padding:20px;">
  <div style="max-width:500px; background:#fff; padding:24px; border-radius:12px; border:1px solid #e2e8f0;">
    <h2 style="color:#4338ca; margin-top:0;">ChurnGuard SMTP Verification</h2>
    <p>SMTP configuration test succeeded.</p>
    <ul>
      <li><strong>Timestamp:</strong> {now_str}</li>
      <li><strong>Host:</strong> {host}:{port}</li>
      <li><strong>Sender:</strong> {from_addr}</li>
    </ul>
    <p style="color:#16a34a; font-weight:bold;">All checks passed successfully.</p>
  </div>
</body>
</html>"""
        msg.attach(MIMEText(body_text, "plain"))
        msg.attach(MIMEText(body_html, "html"))

        server.sendmail(from_addr, recipient, msg.as_string())
        server.quit()
        print("PASS (Email accepted for delivery)")
    except Exception as e:
        print(f"FAIL: {e}")
        if server:
            try:
                server.close()
            except Exception:
                pass
        return 1

    print("=" * 60)
    print(" ALL SMTP CHECKS PASSED SUCCESSFULLY! ")
    print("=" * 60)
    return 0


if __name__ == "__main__":
    sys.exit(main())
