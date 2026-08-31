import pytest
import sys
import os
import uuid
import re
from datetime import datetime, timezone, timedelta
import httpx

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from main import app
from database import user_collection, otp_collection
from auth import verify_password, hash_password


@pytest.mark.anyio
async def test_request_otp_wrong_current_password():
    run_id = uuid.uuid4().hex[:6]
    email = f"otp_test_{run_id}@example.com"
    old_pw = "OriginalPass123"

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        # Register user
        reg_res = await client.post("/register", json={
            "email": email,
            "password": old_pw,
            "first_name": "Test",
            "last_name": "User",
            "company": f"Corp_{run_id}"
        })
        assert reg_res.status_code == 200

        # Login
        login_res = await client.post("/login", json={"email": email, "password": old_pw})
        assert login_res.status_code == 200
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Request OTP with wrong current password
        req_res = await client.post(
            "/api/settings/password/request-otp",
            json={
                "current_password": "WrongPassword123",
                "new_password": "ValidNewPass456"
            },
            headers=headers
        )
        assert req_res.status_code == 400
        assert "Current password is incorrect" in req_res.json()["detail"]

        # Ensure no OTP created in database
        user_doc = await user_collection.find_one({"email": email})
        otp_doc = await otp_collection.find_one({"user_id": user_doc["_id"]})
        assert otp_doc is None


@pytest.mark.anyio
async def test_request_otp_weak_new_password_and_mismatch():
    run_id = uuid.uuid4().hex[:6]
    email = f"otp_test_{run_id}@example.com"
    old_pw = "OriginalPass123"

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        await client.post("/register", json={
            "email": email,
            "password": old_pw,
            "first_name": "Test",
            "last_name": "User",
            "company": f"Corp_{run_id}"
        })
        login_res = await client.post("/login", json={"email": email, "password": old_pw})
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Weak password (no number / short)
        weak_res = await client.post(
            "/settings/password/request-otp",
            json={
                "currentPassword": old_pw,
                "newPassword": "short"
            },
            headers=headers
        )
        assert weak_res.status_code == 400
        assert "complexity" in weak_res.json()["detail"].lower()

        # Mismatched confirm password
        mismatch_res = await client.post(
            "/api/auth/password/request-otp",
            json={
                "current_password": old_pw,
                "new_password": "ValidNewPass123",
                "confirm_password": "DifferentPass456"
            },
            headers=headers
        )
        assert mismatch_res.status_code == 400
        assert "not match" in mismatch_res.json()["detail"].lower()


@pytest.mark.anyio
async def test_request_otp_success_and_rate_limiting():
    run_id = uuid.uuid4().hex[:6]
    email = f"otp_test_{run_id}@example.com"
    old_pw = "OriginalPass123"

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        await client.post("/register", json={
            "email": email,
            "password": old_pw,
            "first_name": "Dev",
            "last_name": "Tester",
            "company": f"Corp_{run_id}"
        })
        login_res = await client.post("/login", json={"email": email, "password": old_pw})
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # First request succeeds
        req_res = await client.post(
            "/api/settings/password/request-otp",
            json={
                "current_password": old_pw,
                "new_password": "BrandNewPass789",
                "confirm_password": "BrandNewPass789"
            },
            headers=headers
        )
        assert req_res.status_code == 200
        body = req_res.json()
        assert body["success"] is True
        assert "Verification code sent" in body["message"]
        assert "@example.com" in body["masked_email"]

        # Check DB record
        user_doc = await user_collection.find_one({"email": email})
        otp_doc = await otp_collection.find_one({"user_id": user_doc["_id"]})
        assert otp_doc is not None
        assert otp_doc["attempts"] == 0
        assert otp_doc["purpose"] == "password_change"

        # Rate limit enforcement (immediate second request)
        rate_res = await client.post(
            "/api/settings/password/request-otp",
            json={
                "current_password": old_pw,
                "new_password": "BrandNewPass789"
            },
            headers=headers
        )
        assert rate_res.status_code == 429
        assert "Please wait" in rate_res.json()["detail"]


@pytest.mark.anyio
async def test_verify_otp_invalid_code_decrements_attempts_and_locks():
    run_id = uuid.uuid4().hex[:6]
    email = f"otp_test_{run_id}@example.com"
    old_pw = "OriginalPass123"

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        await client.post("/register", json={
            "email": email,
            "password": old_pw,
            "company": f"Corp_{run_id}"
        })
        login_res = await client.post("/login", json={"email": email, "password": old_pw})
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Request OTP
        await client.post(
            "/api/settings/password/request-otp",
            json={"current_password": old_pw, "new_password": "BrandNewPass789"},
            headers=headers
        )

        user_doc = await user_collection.find_one({"email": email})

        # Attempt 1 wrong code
        res1 = await client.post(
            "/api/settings/password/verify-otp",
            json={"otp": "000000", "new_password": "BrandNewPass789"},
            headers=headers
        )
        assert res1.status_code == 400
        assert "4 attempt(s) remaining" in res1.json()["detail"]

        # Attempts 2, 3, 4 wrong code
        for expected_remaining in [3, 2, 1]:
            res = await client.post(
                "/api/settings/password/verify-otp",
                json={"otp": "000000", "new_password": "BrandNewPass789"},
                headers=headers
            )
            assert res.status_code == 400
            assert f"{expected_remaining} attempt(s) remaining" in res.json()["detail"]

        # Attempt 5 wrong code -> Max attempts reached and OTP purged
        res5 = await client.post(
            "/api/settings/password/verify-otp",
            json={"otp": "000000", "new_password": "BrandNewPass789"},
            headers=headers
        )
        assert res5.status_code == 400
        assert "Maximum attempts reached" in res5.json()["detail"]

        # OTP is now purged from DB
        otp_doc = await otp_collection.find_one({"user_id": user_doc["_id"]})
        assert otp_doc is None


@pytest.mark.anyio
async def test_verify_otp_expired():
    run_id = uuid.uuid4().hex[:6]
    email = f"otp_test_{run_id}@example.com"
    old_pw = "OriginalPass123"

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        await client.post("/register", json={
            "email": email,
            "password": old_pw,
            "company": f"Corp_{run_id}"
        })
        login_res = await client.post("/login", json={"email": email, "password": old_pw})
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Request OTP
        await client.post(
            "/api/settings/password/request-otp",
            json={"current_password": old_pw, "new_password": "BrandNewPass789"},
            headers=headers
        )

        user_doc = await user_collection.find_one({"email": email})
        # Simulate expiration
        past_time = datetime.now(timezone.utc) - timedelta(minutes=15)
        await otp_collection.update_one(
            {"user_id": user_doc["_id"]},
            {"$set": {"expires_at": past_time}}
        )

        # Attempt verify
        verify_res = await client.post(
            "/api/settings/password/verify-otp",
            json={"otp": "123456", "new_password": "BrandNewPass789"},
            headers=headers
        )
        assert verify_res.status_code == 400
        assert "expired" in verify_res.json()["detail"].lower()


@pytest.mark.anyio
async def test_verify_otp_success_full_flow():
    run_id = uuid.uuid4().hex[:6]
    email = f"otp_test_{run_id}@example.com"
    old_pw = "OriginalPass123"
    new_pw = "SuperSecureNewPass2026"

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        await client.post("/register", json={
            "email": email,
            "password": old_pw,
            "company": f"Corp_{run_id}"
        })
        login_res = await client.post("/login", json={"email": email, "password": old_pw})
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Request OTP
        req_res = await client.post(
            "/api/settings/password/request-otp",
            json={"current_password": old_pw, "new_password": new_pw},
            headers=headers
        )
        assert req_res.status_code == 200

        user_doc = await user_collection.find_one({"email": email})
        otp_doc = await otp_collection.find_one({"user_id": user_doc["_id"]})
        assert otp_doc is not None

        # Override hash with known OTP for deterministic test
        known_otp = "654321"
        await otp_collection.update_one(
            {"_id": otp_doc["_id"]},
            {"$set": {"otp_hash": hash_password(known_otp)}}
        )

        # Verify OTP
        verify_res = await client.post(
            "/api/settings/password/verify-otp",
            json={
                "otp": known_otp,
                "new_password": new_pw,
                "current_password": old_pw
            },
            headers=headers
        )
        assert verify_res.status_code == 200
        assert verify_res.json()["success"] is True

        # Ensure OTP record is purged
        assert await otp_collection.find_one({"user_id": user_doc["_id"]}) is None

        # Old password should no longer work
        old_login = await client.post("/login", json={"email": email, "password": old_pw})
        assert old_login.status_code == 401

        # New password should succeed
        new_login = await client.post("/login", json={"email": email, "password": new_pw})
        assert new_login.status_code == 200
        assert "access_token" in new_login.json()


@pytest.mark.anyio
async def test_multi_tenant_isolation():
    run_id = uuid.uuid4().hex[:6]
    email_a = f"usera_{run_id}@companyA.com"
    email_b = f"userb_{run_id}@companyB.com"
    pw_a_old = "PasswordA123"
    pw_b = "PasswordB123"
    pw_a_new = "NewPasswordA456"

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        # Register User A in Company A
        await client.post("/register", json={"email": email_a, "password": pw_a_old, "company": "Company A"})
        login_a = await client.post("/login", json={"email": email_a, "password": pw_a_old})
        token_a = login_a.json()["access_token"]

        # Register User B in Company B
        await client.post("/register", json={"email": email_b, "password": pw_b, "company": "Company B"})
        login_b = await client.post("/login", json={"email": email_b, "password": pw_b})
        token_b = login_b.json()["access_token"]

        # User A requests OTP
        await client.post(
            "/api/settings/password/request-otp",
            json={"current_password": pw_a_old, "new_password": pw_a_new},
            headers={"Authorization": f"Bearer {token_a}"}
        )

        user_a_doc = await user_collection.find_one({"email": email_a.lower()})
        otp_a = await otp_collection.find_one({"user_id": user_a_doc["_id"]})
        assert otp_a["company_id"] == "comp_company_a"

        # User B trying to verify without their own OTP should get 400
        verify_b = await client.post(
            "/api/settings/password/verify-otp",
            json={"otp": "123456", "new_password": "HackedPassword123"},
            headers={"Authorization": f"Bearer {token_b}"}
        )
        assert verify_b.status_code == 400
        assert "No pending verification code" in verify_b.json()["detail"]

        # Set known OTP for User A and verify
        known_otp = "998877"
        await otp_collection.update_one(
            {"_id": otp_a["_id"]},
            {"$set": {"otp_hash": hash_password(known_otp)}}
        )

        verify_a = await client.post(
            "/api/settings/password/verify-otp",
            json={"otp": known_otp, "new_password": pw_a_new},
            headers={"Authorization": f"Bearer {token_a}"}
        )
        assert verify_a.status_code == 200

        # Verify User B's password and login are unchanged
        login_b_check = await client.post("/login", json={"email": email_b, "password": pw_b})
        assert login_b_check.status_code == 200
