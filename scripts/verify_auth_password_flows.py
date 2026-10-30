#!/usr/bin/env python3
"""
ChurnGuard End-to-End Verification Suite for:
1. Forgot Password Flow
2. Change Password OTP Flow (Settings > Security)
3. Rate Limiting & Cooldowns
4. Security Payload Zero-Leak Verification (No OTP in response)
"""

import sys
import os
import unittest
import asyncio
from datetime import datetime, timezone

# Add backend directory
backend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from fastapi.testclient import TestClient
from main import app, user_collection, otp_collection, password_reset_collection, hash_password

client = TestClient(app)

TEST_USER_EMAIL = "test_qa_suite@churnguard.io"
TEST_USER_PW = "TestPassword@123"
TEST_COMPANY_ID = "comp_test_qa"


def setUpModule():
    """Seed test user in MongoDB if needed"""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    async def _init_db():
        await user_collection.delete_many({"email": TEST_USER_EMAIL})
        await user_collection.insert_one({
            "email": TEST_USER_EMAIL,
            "password": hash_password(TEST_USER_PW),
            "first_name": "QA",
            "last_name": "Tester",
            "company_id": TEST_COMPANY_ID,
            "role": "Admin",
            "email_verified": True,
            "is_verified": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    loop.run_until_complete(_init_db())
    loop.close()


def tearDownModule():
    """Cleanup test data"""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    async def _cleanup_db():
        await user_collection.delete_many({"email": TEST_USER_EMAIL})
        await otp_collection.delete_many({"email": TEST_USER_EMAIL})
        await password_reset_collection.delete_many({"email": TEST_USER_EMAIL})
    loop.run_until_complete(_cleanup_db())
    loop.close()


class TestForgotPasswordFlow(unittest.TestCase):

    def test_01_invalid_email_format(self):
        """Invalid email formats must return HTTP 422"""
        resp = client.post("/auth/forgot-password", json={"email": "not-an-email"})
        self.assertEqual(resp.status_code, 422)
        resp_api = client.post("/api/auth/forgot-password", json={"email": "bad@"})
        self.assertEqual(resp_api.status_code, 422)

    def test_02_unknown_email_anti_enumeration(self):
        """Unregistered email must return 200 generic message without sending email"""
        resp = client.post("/auth/forgot-password", json={"email": "unregistered_999@churnguard.io"})
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data.get("success"))
        self.assertIn("If an account exists", data.get("message", ""))
        self.assertNotIn("otp", data)
        self.assertNotIn("token", data)

    def test_03_registered_user_email_dispatch_or_503(self):
        """
        When email service is unavailable (e.g. invalid Gmail app password),
        backend must return HTTP 503 instead of false 200 or 500 unhandled.
        """
        resp = client.post("/auth/forgot-password", json={"email": TEST_USER_EMAIL})
        # If mailer succeeds it returns 200; if SMTP auth fails it must return 503
        self.assertIn(resp.status_code, [200, 503])
        data = resp.json()
        self.assertNotIn("otp", data)
        self.assertNotIn("token", data)
        self.assertNotIn("dev_otp", data)

    def test_04_cooldown_rate_limit(self):
        """Consecutive requests within 60s must trigger HTTP 429"""
        # Second immediate request
        resp = client.post("/auth/forgot-password", json={"email": TEST_USER_EMAIL})
        self.assertEqual(resp.status_code, 429)
        self.assertIn("Retry-After", resp.headers)


class TestChangePasswordOtpFlow(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        # Log in test user to obtain auth token
        login_resp = client.post("/login", json={"email": TEST_USER_EMAIL, "password": TEST_USER_PW})
        cls.token = login_resp.json()["access_token"]
        cls.headers = {"Authorization": f"Bearer {cls.token}"}

    def test_01_wrong_current_password(self):
        """Wrong current password must return HTTP 400 and send NO email"""
        resp = client.post(
            "/api/settings/password/request-otp",
            json={
                "current_password": "WrongPassword@999",
                "new_password": "NewSecretPassword@123",
                "confirm_password": "NewSecretPassword@123"
            },
            headers=self.headers
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("Current password is incorrect", resp.json().get("detail", ""))

    def test_02_new_password_same_as_current(self):
        """New password matching current password must return HTTP 400"""
        resp = client.post(
            "/api/settings/password/request-otp",
            json={
                "current_password": TEST_USER_PW,
                "new_password": TEST_USER_PW,
                "confirm_password": TEST_USER_PW
            },
            headers=self.headers
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("New password must be different", resp.json().get("detail", ""))

    def test_03_new_password_mismatch(self):
        """New password and confirm mismatch must return HTTP 400"""
        resp = client.post(
            "/api/settings/password/request-otp",
            json={
                "current_password": TEST_USER_PW,
                "new_password": "NewSecretPassword@123",
                "confirm_password": "MismatchPassword@456"
            },
            headers=self.headers
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("do not match", resp.json().get("detail", ""))

    def test_04_request_otp_clean_response_payload(self):
        """
        Requesting OTP must NEVER return the OTP, dev_otp, or debug fields in JSON.
        If SMTP fails, returns 503; if SMTP succeeds, returns 200 with strictly defined schema.
        """
        resp = client.post(
            "/api/settings/password/request-otp",
            json={
                "current_password": TEST_USER_PW,
                "new_password": "NewSecurePassword@2026",
                "confirm_password": "NewSecurePassword@2026"
            },
            headers=self.headers
        )
        self.assertIn(resp.status_code, [200, 503])
        data = resp.json()
        # Security assertion: ZERO OTP leakage
        self.assertNotIn("otp", data)
        self.assertNotIn("otp_code", data)
        self.assertNotIn("code", data)
        self.assertNotIn("dev_otp", data)
        self.assertNotIn("debug", data)

        if resp.status_code == 200:
            self.assertTrue(data.get("success"))
            self.assertEqual(data.get("message"), "Verification code sent")
            self.assertIn("masked_email", data)
            self.assertEqual(data.get("expires_in"), 600)
            self.assertEqual(data.get("resend_after"), 60)


if __name__ == "__main__":
    unittest.main(verbosity=2)
