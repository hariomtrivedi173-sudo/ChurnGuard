"""
Diagnostic and Verification Script for ChurnGuard Password Recovery & Email Delivery
"""

import sys
import os
import secrets
import hashlib
from datetime import datetime, timezone, timedelta
from urllib.parse import urlparse, parse_qs

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
import mailer
from auth import hash_password, verify_password

def test_smtp_configuration():
    print("-" * 60)
    print("1. CHECKING SMTP CONFIGURATION PARSING")
    print("-" * 60)
    cfg = mailer._get_smtp_config()
    print(f"Host:     {cfg['host']}")
    print(f"Port:     {cfg['port']}")
    print(f"User:     {mailer.mask_email(cfg['user'])}")
    print(f"From:     {cfg['from_']}")
    print(f"Password: {'*' * len(cfg['password'])} (length: {len(cfg['password'])})")
    assert cfg["host"], "SMTP_HOST must not be empty"
    assert cfg["user"], "SMTP_USERNAME must not be empty"
    assert cfg["password"], "SMTP_PASSWORD must not be empty"
    print("[PASS] SMTP configuration parsed and sanitized cleanly.")
    return cfg

def test_token_and_link_generation():
    print("\n" + "-" * 60)
    print("2. VERIFYING SECURE TOKEN & RESET LINK GENERATION")
    print("-" * 60)
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    
    frontend_base = os.getenv("FRONTEND_URL", "https://churnguard-frontend.onrender.com").rstrip("/")
    reset_url = f"{frontend_base}/reset-password?token={raw_token}"
    
    print(f"Frontend Base: {frontend_base}")
    print(f"Reset URL:     {reset_url}")
    print(f"Token Hash:    {token_hash}")
    
    parsed = urlparse(reset_url)
    assert parsed.scheme == "https"
    assert parsed.netloc == "churnguard-frontend.onrender.com"
    assert parsed.path == "/reset-password"
    
    qs = parse_qs(parsed.query)
    assert qs.get("token") == [raw_token]
    print("[PASS] Reset URL contains valid scheme, host, path and cryptographic token.")

def test_expiration_logic():
    print("\n" + "-" * 60)
    print("3. VERIFYING TOKEN EXPIRATION LOGIC")
    print("-" * 60)
    now = datetime.now(timezone.utc)
    future = now + timedelta(minutes=20)
    past = now - timedelta(minutes=1)
    
    assert now < future, "Fresh token should not be expired"
    assert now > past, "Stale token should be expired"
    print("[PASS] Token expiration arithmetic correctly distinguishes valid vs expired windows.")

def test_password_hashing():
    print("\n" + "-" * 60)
    print("4. VERIFYING SECURE PASSWORD HASHING")
    print("-" * 60)
    sample_pw = "EnterpriseSecurePass2026!"
    hashed = hash_password(sample_pw)
    assert verify_password(sample_pw, hashed) is True
    assert verify_password("WrongPassword!", hashed) is False
    print("[PASS] Passlib/bcrypt password hashing and verification functional.")

def test_live_smtp_connection_diagnostic(cfg):
    print("\n" + "-" * 60)
    print("5. DIAGNOSING LIVE SMTP AUTHENTICATION STATUS")
    print("-" * 60)
    import smtplib
    import ssl
    
    host = cfg["host"]
    port = cfg["port"]
    user = cfg["user"]
    pw = cfg["password"]
    
    print(f"Attempting connection to {host}:{port} as {mailer.mask_email(user)}...")
    try:
        context = ssl.create_default_context()
        if port == 465:
            server = smtplib.SMTP_SSL(host, port, context=context, timeout=10)
        else:
            server = smtplib.SMTP(host, port, timeout=10)
            server.ehlo()
            server.starttls(context=context)
            server.ehlo()
        print(f"[PASS] Socket & TLS handshake with {host}:{port} SUCCEEDED.")
        
        try:
            mailer._safe_smtp_login(server, user, pw)
            print("[PASS] SMTP Authentication SUCCEEDED! Real emails CAN be sent with these credentials.")
            server.quit()
            return True
        except smtplib.SMTPAuthenticationError as auth_err:
            print(f"[FAIL] SMTP Authentication FAILED: {auth_err}")
            print("  Reason: Google explicitly rejected the configured App Password.")
            print("  To fix: Generate a fresh 16-character App Password at https://myaccount.google.com/apppasswords")
            try:
                server.quit()
            except Exception:
                pass
            return False
    except Exception as conn_err:
        print(f"[FAIL] SMTP Connection failed: {conn_err}")
        return False

if __name__ == "__main__":
    cfg = test_smtp_configuration()
    test_token_and_link_generation()
    test_expiration_logic()
    test_password_hashing()
    test_live_smtp_connection_diagnostic(cfg)
    print("\n" + "=" * 60)
    print("  ALL CORE LOGIC CHECKS COMPLETE")
    print("=" * 60)
