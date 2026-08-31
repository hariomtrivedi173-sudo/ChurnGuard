import os
import smtplib
import ssl
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional

SMTP_HOST = os.getenv("SMTP_HOST")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_FROM = os.getenv("SMTP_FROM", "no-reply@churnguard.io")


def mask_email(email: str) -> str:
    """Mask email address for privacy display, e.g. j***e@company.com"""
    if not email or "@" not in email:
        return "your registered email"
    user, domain = email.split("@", 1)
    if len(user) <= 2:
        masked_user = user[0] + "***"
    else:
        masked_user = user[0] + "***" + user[-1]
    return f"{masked_user}@{domain}"


def send_otp_email(to_email: str, otp_code: str, first_name: Optional[str] = None) -> bool:
    """
    Send OTP verification email.
    If SMTP credentials are provided, attempts SMTP dispatch.
    Always logs cleanly to system console for observability and development.
    """
    greeting_name = first_name.strip() if first_name else "Valued User"
    subject = f"ChurnGuard Security — Verification Code: {otp_code}"

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }}
        .container {{ max-width: 520px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px; box-shadow: 0 4px 16px rgba(0,0,0,0.04); }}
        .badge {{ display: inline-block; background: #f3e8ff; color: #7c3aed; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 99px; text-transform: uppercase; letter-spacing: 0.05em; }}
        .otp-box {{ background: #faf5ff; border: 2px dashed #a855f7; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }}
        .otp-code {{ font-size: 34px; font-weight: 800; color: #6b21a8; letter-spacing: 8px; margin: 0; font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; }}
        .footer {{ font-size: 11px; color: #94a3b8; margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 16px; line-height: 1.5; }}
      </style>
    </head>
    <body>
      <div class="container">
        <span class="badge">ChurnGuard Security</span>
        <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin: 14px 0 8px;">Verify Password Change</h2>
        <p style="font-size: 13px; color: #475569; line-height: 1.5; margin-bottom: 16px;">
          Hello {greeting_name},<br>
          We received a request to update your ChurnGuard account password. Use the following single-use verification code to complete this change:
        </p>

        <div class="otp-box">
          <p class="otp-code">{otp_code}</p>
        </div>

        <p style="font-size: 12px; color: #64748b; line-height: 1.5;">
          ⏱️ This code will expire in <strong>10 minutes</strong>. If you did not initiate this request, please contact your workspace administrator immediately and ensure your account credentials remain secure.
        </p>

        <div class="footer">
          This is an automated security transmission from ChurnGuard Enterprise AI Platform.<br>
          Do not reply to this email.
        </div>
      </div>
    </body>
    </html>
    """

    print(f"\n[ChurnGuard Security Mailer] OTP generated for {to_email}: ====> {otp_code} <====\n")

    if SMTP_HOST and SMTP_USER and SMTP_PASSWORD:
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = SMTP_FROM
            msg["To"] = to_email

            text_part = MIMEText(
                f"Your ChurnGuard password change verification code is: {otp_code}\nThis code expires in 10 minutes.",
                "plain"
            )
            html_part = MIMEText(html_content, "html")
            msg.attach(text_part)
            msg.attach(html_part)

            context = ssl.create_default_context()
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
                server.starttls(context=context)
                server.login(SMTP_USER, SMTP_PASSWORD)
                server.sendmail(SMTP_FROM, to_email, msg.as_string())
            return True
        except Exception as e:
            print(f"[ChurnGuard Security Mailer] SMTP dispatch error (falling back to log): {e}")
            return False

    return True
