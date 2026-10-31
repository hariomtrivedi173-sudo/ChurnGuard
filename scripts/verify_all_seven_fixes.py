#!/usr/bin/env python3
"""
Verification Script for the 7 ChurnGuard Fixes:
BUG-02: Security headers middleware (nosniff, DENY, CSP, docs compatibility)
BUG-03: CustomerPredictionInput validation (tenure 0-120, positive charges, 422 on invalid)
BUG-04: NotFound.jsx 404 route handling
BUG-05: Real logout with MongoDB blacklist & 401 on revoked token
BUG-06: Avatar file existence validation on disk before returning photo_url
BUG-07: robots.txt presence and crawl directives
BUG-08: Server header suppression (--no-server-header)
"""

import sys
import os
import httpx
import unittest
from datetime import datetime, timezone

API_BASE = "http://127.0.0.1:8000"
FRONTEND_BASE = "http://127.0.0.1:5173"

class TestSevenFixes(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        cls.client = httpx.Client(timeout=10.0)
        # Seed test user into MongoDB
        import asyncio
        sys.path.insert(0, "backend")
        from database import user_collection, blacklisted_token_collection
        from auth import hash_password

        async def _seed():
            await user_collection.delete_many({"email": "test_qa_suite@churnguard.io"})
            await user_collection.insert_one({
                "email": "test_qa_suite@churnguard.io",
                "password": hash_password("TestPassword@123"),
                "first_name": "QA",
                "last_name": "Suite",
                "company_id": "comp_indus",
                "role": "Admin",
                "email_verified": True,
                "is_verified": True,
                "photo_url": "/uploads/avatars/non_existent_avatar_file_9999.jpg"
            })
        asyncio.run(_seed())

        # Login test user
        login_res = cls.client.post(
            f"{API_BASE}/login",
            json={"email": "test_qa_suite@churnguard.io", "password": "TestPassword@123"}
        )
        if login_res.status_code == 200:
            cls.token = login_res.json()["access_token"]
            cls.headers = {"Authorization": f"Bearer {cls.token}"}
        else:
            cls.token = None
            cls.headers = {}

    @classmethod
    def tearDownClass(cls):
        import asyncio
        sys.path.insert(0, "backend")
        from database import user_collection, blacklisted_token_collection

        async def _cleanup():
            await user_collection.delete_many({"email": "test_qa_suite@churnguard.io"})
            await blacklisted_token_collection.delete_many({"email": "test_qa_suite@churnguard.io"})
        asyncio.run(_cleanup())

    def test_01_bug02_security_headers(self):
        """BUG-02: Defensive security headers must be present on API responses and /docs must remain intact."""
        res = self.client.get(f"{API_BASE}/health")
        self.assertEqual(res.status_code, 200)
        h = {k.lower(): v for k, v in res.headers.items()}
        self.assertEqual(h.get("x-content-type-options"), "nosniff")
        self.assertEqual(h.get("x-frame-options"), "DENY")
        self.assertEqual(h.get("referrer-policy"), "strict-origin-when-cross-origin")
        self.assertIn("content-security-policy", h)

        # Check /docs works cleanly
        docs_res = self.client.get(f"{API_BASE}/docs")
        self.assertEqual(docs_res.status_code, 200)
        docs_h = {k.lower(): v for k, v in docs_res.headers.items()}
        self.assertIn("cdn.jsdelivr.net", docs_h.get("content-security-policy", ""))
        print("\n[PASS] BUG-02: Security headers injected cleanly without breaking /docs.")

    def test_02_bug03_prediction_validation(self):
        """BUG-03: Invalid tenure (< 0 or > 120) or negative charges must return HTTP 422."""
        if not self.headers:
            self.skipTest("No auth token available for prediction endpoint")

        base_payload = {
            "gender": "Male",
            "SeniorCitizen": "No",
            "Partner": "No",
            "Dependents": "No",
            "PhoneService": "Yes",
            "MultipleLines": "No",
            "InternetService": "Fiber optic",
            "OnlineSecurity": "No",
            "OnlineBackup": "No",
            "DeviceProtection": "No",
            "TechSupport": "No",
            "StreamingTV": "No",
            "StreamingMovies": "No",
            "Contract": "Month-to-month",
            "PaperlessBilling": "Yes",
            "PaymentMethod": "Electronic check",
            "MonthlyCharges": 70.0,
            "TotalCharges": 140.0
        }

        # 1. Negative tenure -> 422
        payload = base_payload.copy()
        payload["tenure"] = -5
        res = self.client.post(f"{API_BASE}/predict/churn", json=payload, headers=self.headers)
        self.assertEqual(res.status_code, 422)

        # 2. Excessive tenure (> 120) -> 422
        payload = base_payload.copy()
        payload["tenure"] = 150
        res = self.client.post(f"{API_BASE}/predict/churn", json=payload, headers=self.headers)
        self.assertEqual(res.status_code, 422)

        # 3. Negative MonthlyCharges -> 422
        payload = base_payload.copy()
        payload["tenure"] = 12
        payload["MonthlyCharges"] = -25.5
        res = self.client.post(f"{API_BASE}/predict/churn", json=payload, headers=self.headers)
        self.assertEqual(res.status_code, 422)

        # 4. Valid payload -> 200
        payload["MonthlyCharges"] = 75.0
        res = self.client.post(f"{API_BASE}/predict/churn", json=payload, headers=self.headers)
        self.assertEqual(res.status_code, 200)
        print("\n[PASS] BUG-03: Input bounds validated; out-of-range payloads rejected with HTTP 422.")

    def test_03_bug04_not_found_route(self):
        """BUG-04: Catch-all route renders NotFound component."""
        # Check NotFound.jsx exists and has both logged-in and logged-out action targets
        with open("frontend/src/pages/NotFound.jsx", "r", encoding="utf-8") as f:
            not_found_code = f.read()
        self.assertIn("Back to Dashboard", not_found_code)
        self.assertIn("Go to Login", not_found_code)
        self.assertIn("404", not_found_code)

        with open("frontend/src/App.jsx", "r", encoding="utf-8") as f:
            app_code = f.read()
        self.assertIn('<Route path="*" element={<NotFound />} />', app_code)
        self.assertNotIn('<Route path="*" element={<Login />} />', app_code)
        print("\n[PASS] BUG-04: NotFound.jsx created and configured as the SPA catch-all route.")

    def test_04_bug05_real_logout_blacklisting(self):
        """BUG-05: Real logout blacklists token in MongoDB; subsequent requests return 401."""
        # 1. Login to get a dedicated token for logout testing
        login_res = self.client.post(
            f"{API_BASE}/login",
            json={"email": "test_qa_suite@churnguard.io", "password": "TestPassword@123"}
        )
        self.assertEqual(login_res.status_code, 200)
        token_to_revoke = login_res.json()["access_token"]
        session_headers = {"Authorization": f"Bearer {token_to_revoke}"}

        # 2. Verify token works
        profile_res = self.client.get(f"{API_BASE}/profile/me", headers=session_headers)
        self.assertEqual(profile_res.status_code, 200)

        # 3. Call logout endpoint
        logout_res = self.client.post(f"{API_BASE}/auth/logout", headers=session_headers)
        self.assertEqual(logout_res.status_code, 200)
        self.assertTrue(logout_res.json().get("success"))

        # 4. Attempt to reuse revoked token -> must return 401
        revoked_res = self.client.get(f"{API_BASE}/profile/me", headers=session_headers)
        self.assertEqual(revoked_res.status_code, 401)
        self.assertIn("revoked", revoked_res.json().get("detail", "").lower())
        print("\n[PASS] BUG-05: Real logout verified. Token blacklisted and rejected with HTTP 401.")

    def test_05_bug06_avatar_disk_existence_check(self):
        """BUG-06: If user's avatar is missing from disk, photo_url returns null instead of a 404 URL."""
        if not self.headers:
            self.skipTest("No auth token available")

        res = self.client.get(f"{API_BASE}/profile/me", headers=self.headers)
        self.assertEqual(res.status_code, 200)
        photo_url = res.json().get("photo_url")
        if photo_url:
            filename = os.path.basename(photo_url)
            disk_path = os.path.join("backend", "uploads", "avatars", filename)
            self.assertTrue(os.path.exists(disk_path), f"Avatar URL points to missing disk file: {disk_path}")
        else:
            self.assertIsNone(photo_url)
        print("\n[PASS] BUG-06: Avatar disk check verified. Non-existent files return photo_url=null.")

    def test_06_bug07_robots_txt(self):
        """BUG-07: robots.txt is present and disallows private workspace routes."""
        self.assertTrue(os.path.exists("frontend/public/robots.txt"))
        with open("frontend/public/robots.txt", "r", encoding="utf-8") as f:
            content = f.read()
        self.assertIn("Disallow: /dashboard", content)
        self.assertIn("Disallow: /customers", content)
        self.assertIn("Disallow: /settings", content)
        self.assertIn("Allow: /login", content)

        # Test web server serves it
        res = self.client.get(f"{FRONTEND_BASE}/robots.txt")
        self.assertEqual(res.status_code, 200)
        self.assertIn("Disallow: /dashboard", res.text)
        print("\n[PASS] BUG-07: robots.txt exists, served with HTTP 200, and protects private routes.")

    def test_07_bug08_server_header_suppression(self):
        """BUG-08: Server technology header is suppressed from responses."""
        res = self.client.get(f"{API_BASE}/health")
        h = {k.lower(): v for k, v in res.headers.items()}
        self.assertNotIn("server", h)
        print("\n[PASS] BUG-08: Server header suppressed (no 'uvicorn' fingerprint).")


if __name__ == "__main__":
    unittest.main(verbosity=2)
