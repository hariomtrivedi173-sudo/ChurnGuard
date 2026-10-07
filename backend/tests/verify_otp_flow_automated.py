import sys
import os
import asyncio
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import secrets
from datetime import datetime, timezone, timedelta
import httpx
from database import user_collection, otp_collection
from auth import hash_password, verify_password

BASE_URL = "http://127.0.0.1:8000"

async def test_complete_otp_flow():
    print("=" * 70)
    print("RUNNING CHURNGUARD OTP FLOW INTEGRATION TEST")
    print("=" * 70)

    client = httpx.AsyncClient(base_url=BASE_URL, timeout=15.0)
    test_email = f"qa_otp_verify_{secrets.token_hex(4)}@churnguard.io"
    test_password = "Password123!"

    # ── Test 1: Wrong OTP rejection ──
    print("\n[Step 1] Preparing pending user with test OTP in database...")
    now = datetime.now(timezone.utc)
    raw_otp = f"{secrets.randbelow(900000) + 100000}"
    hashed_otp = hash_password(raw_otp)

    # Insert pending unverified user
    user_res = await user_collection.insert_one({
        "email": test_email,
        "password": hash_password(test_password),
        "first_name": "Test",
        "last_name": "User",
        "company": "QA Corp",
        "company_id": "comp_qacorp",
        "phone": "9876543210",
        "email_verified": False,
        "created_at": now
    })
    user_id = user_res.inserted_id

    # Insert pending OTP record
    await otp_collection.insert_one({
        "user_id": user_id,
        "email": test_email,
        "otp_hash": hashed_otp,
        "purpose": "email_verification",
        "expires_at": now + timedelta(minutes=10),
        "created_at": now,
        "attempts": 0,
        "max_attempts": 5
    })

    # Verify unverified user cannot log in
    print("\n[Step 2] Testing login before verification (should be 403)...")
    login_before = await client.post("/login", json={"email": test_email, "password": test_password})
    print(f"Login before verification: HTTP {login_before.status_code} - {login_before.json().get('detail')}")
    assert login_before.status_code == 403, "Unverified user must not be allowed to log in"

    # Test wrong OTP
    print("\n[Step 3] Testing wrong OTP submission (should be 400)...")
    wrong_res = await client.post("/auth/verify-registration", json={"email": test_email, "otp": "000000"})
    print(f"Wrong OTP response: HTTP {wrong_res.status_code} - {wrong_res.json().get('detail')}")
    assert wrong_res.status_code == 400, "Wrong OTP must be rejected with 400"

    otp_doc_after_wrong = await otp_collection.find_one({"email": test_email, "purpose": "email_verification"})
    assert otp_doc_after_wrong["attempts"] == 1, "Wrong OTP attempt counter must increment"
    print("Wrong OTP: PASS (attempts incremented to 1)")

    # Test correct OTP
    print("\n[Step 4] Testing correct OTP submission (should be 200)...")
    correct_res = await client.post("/auth/verify-registration", json={"email": test_email, "otp": raw_otp})
    print(f"Correct OTP response: HTTP {correct_res.status_code} - {correct_res.json().get('message')}")
    assert correct_res.status_code == 200, "Correct OTP must succeed with 200"

    # Verify user is now verified in MongoDB
    user_doc = await user_collection.find_one({"email": test_email})
    assert user_doc["email_verified"] is True, "User account must be email_verified = True"
    print("User email_verified is now True in MongoDB")

    # Verify OTP was deleted after use
    otp_after_success = await otp_collection.find_one({"email": test_email, "purpose": "email_verification"})
    assert otp_after_success is None, "Used OTP must be deleted from MongoDB"
    print("Used OTP deleted from database: PASS")

    # Test login after verification
    print("\n[Step 5] Testing login after verification (should be 200)...")
    login_after = await client.post("/login", json={"email": test_email, "password": test_password})
    print(f"Login after verification: HTTP {login_after.status_code}")
    assert login_after.status_code == 200, "Verified user must be able to log in"
    token = login_after.json().get("access_token")
    assert bool(token), "Login must return JWT access_token"
    print("Login after verification: PASS (received JWT token)")

    # Test accessing authenticated dashboard profile endpoint
    print("\n[Step 6] Testing dashboard access with token...")
    prof_res = await client.get("/profile/me", headers={"Authorization": f"Bearer {token}"})
    print(f"Profile / Dashboard API: HTTP {prof_res.status_code} - email: {prof_res.json().get('email')}")
    assert prof_res.status_code == 200, "Authenticated user must be able to access dashboard data"
    print("Dashboard access: PASS")

    # Clean up test user
    await user_collection.delete_one({"_id": user_id})
    print("\n[Cleanup] Test user cleaned up.")

    # ── Test 7: Resend OTP Rate Limiting ──
    print("\n[Step 7] Testing resend OTP rate limiting...")
    test_resend_email = f"qa_resend_{secrets.token_hex(4)}@churnguard.io"
    resend_user = await user_collection.insert_one({
        "email": test_resend_email,
        "password": hash_password(test_password),
        "email_verified": False,
        "created_at": now
    })
    await otp_collection.insert_one({
        "user_id": resend_user.inserted_id,
        "email": test_resend_email,
        "otp_hash": hashed_otp,
        "purpose": "email_verification",
        "expires_at": now + timedelta(minutes=10),
        "created_at": now,
        "attempts": 0,
        "max_attempts": 5
    })
    resend_resp = await client.post("/auth/resend-registration-otp", json={"email": test_resend_email})
    print(f"Resend immediate response: HTTP {resend_resp.status_code} - {resend_resp.json().get('detail')}")
    assert resend_resp.status_code == 429, "Immediate resend must be rate limited with 429"
    print("Resend rate limit (60s cooldown): PASS")

    # Cleanup resend user
    await user_collection.delete_one({"_id": resend_user.inserted_id})
    await otp_collection.delete_many({"email": test_resend_email})

    print("\nALL OTP FLOW TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(test_complete_otp_flow())
