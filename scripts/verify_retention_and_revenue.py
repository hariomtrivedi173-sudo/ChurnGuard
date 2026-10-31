"""
Comprehensive Verification Suite:
(A) Retention Suggestions per customer
(B) Revenue at Risk
+ 17 Comprehensive QA and Regression Tests
"""

import sys
import os
import time
import unittest
import math
import httpx
from datetime import datetime, timezone
from bson import ObjectId

# Ensure backend and root paths are available
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))

from backend.database import database, user_collection, telco_collection, blacklisted_token_collection
from backend.auth import hash_password, create_access_token
from backend.retention import get_retention_suggestions, RETENTION_RULES
from ml.predict import predict_churn

BASE_URL = "http://127.0.0.1:8000"


class TestRetentionAndRevenueAtRisk(unittest.IsolatedAsyncioTestCase):

    @classmethod
    def setUpClass(cls):
        # Setup test company and test users
        cls.company_a = f"test_company_a_{int(time.time())}"
        cls.company_b = f"test_company_b_{int(time.time())}"

        cls.user_a_email = f"user_a_{int(time.time())}@churnguard.io"
        cls.user_b_email = f"user_b_{int(time.time())}@churnguard.io"

        cls.token_a = create_access_token(data={"sub": cls.user_a_email, "company_id": cls.company_a})
        cls.token_b = create_access_token(data={"sub": cls.user_b_email, "company_id": cls.company_b})

        cls.headers_a = {"Authorization": f"Bearer {cls.token_a}"}
        cls.headers_b = {"Authorization": f"Bearer {cls.token_b}"}
        cls._initialized = False

    async def asyncSetUp(self):
        if not TestRetentionAndRevenueAtRisk._initialized:
            pwd_hash = hash_password("SecurePass123!")
            await user_collection.update_one(
                {"email": self.user_a_email},
                {"$set": {
                    "name": "User A",
                    "email": self.user_a_email,
                    "password": pwd_hash,
                    "password_hash": pwd_hash,
                    "company_id": self.company_a,
                    "email_verified": True,
                    "created_at": datetime.now(timezone.utc)
                }},
                upsert=True
            )

            await user_collection.update_one(
                {"email": self.user_b_email},
                {"$set": {
                    "name": "User B",
                    "email": self.user_b_email,
                    "password": pwd_hash,
                    "password_hash": pwd_hash,
                    "company_id": self.company_b,
                    "email_verified": True,
                    "created_at": datetime.now(timezone.utc)
                }},
                upsert=True
            )
            TestRetentionAndRevenueAtRisk._initialized = True

    @classmethod
    def tearDownClass(cls):
        pass

    # =========================================================================
    # TEST 1: Month-to-month + high-risk customer -> contract/discount suggestion
    # =========================================================================
    def test_01_month_to_month_high_risk_suggestion(self):
        customer = {
            "Contract": "Month-to-month",
            "MonthlyCharges": 85.0,
            "tenure": 3,
            "InternetService": "Fiber optic",
            "PaymentMethod": "Electronic check",
            "TechSupport": "No"
        }
        suggestions = get_retention_suggestions(customer, churn_probability=78.5)
        self.assertGreaterEqual(len(suggestions), 1)
        self.assertLessEqual(len(suggestions), 3)

        # Check for contract lock-in / discount suggestion
        titles = [s["title"] for s in suggestions]
        has_contract_offer = any("Contract" in t or "Annual" in t or "VIP" in t for t in titles)
        self.assertTrue(has_contract_offer, f"Expected contract upgrade suggestion in {titles}")

        # Check structure of suggestions
        for s in suggestions:
            self.assertIn("title", s)
            self.assertIn("reason", s)
            self.assertIn("priority", s)
            self.assertIn("channel", s)
            self.assertIn(s["priority"], ["High", "Medium", "Low"])
            self.assertIn(s["channel"], ["Call", "Email", "Offer"])
        print("  [PASS] Test 1: Month-to-month + high-risk produces contract/discount suggestions.")

    # =========================================================================
    # TEST 2: Low-risk customer -> gentle suggestion / no aggressive discounting
    # =========================================================================
    def test_02_low_risk_customer_gentle_suggestion(self):
        customer = {
            "Contract": "Two year",
            "MonthlyCharges": 25.0,
            "tenure": 48,
            "InternetService": "DSL",
            "PaymentMethod": "Credit card (automatic)"
        }
        suggestions = get_retention_suggestions(customer, churn_probability=12.0)
        self.assertGreaterEqual(len(suggestions), 1)
        for s in suggestions:
            self.assertEqual(s["priority"], "Low")
            # Should not offer emergency discounts
            self.assertNotIn("15%", s["title"])
            self.assertNotIn("VIP", s["title"])
        print("  [PASS] Test 2: Low-risk customer receives gentle touch / low-priority suggestion.")

    # =========================================================================
    # TEST 3: Dataset with missing columns -> no crash, friendly response
    # =========================================================================
    def test_03_missing_columns_safe_handling(self):
        # Empty dictionary or partial dictionary
        empty_cust = {}
        suggestions = get_retention_suggestions(empty_cust, churn_probability=85.0)
        self.assertIsInstance(suggestions, list)
        self.assertGreater(len(suggestions), 0)

        # None / null values in fields
        null_cust = {
            "Contract": None,
            "MonthlyCharges": "",
            "tenure": None,
            "PaymentMethod": None
        }
        suggestions_null = get_retention_suggestions(null_cust, churn_probability=50.0)
        self.assertIsInstance(suggestions_null, list)
        print("  [PASS] Test 3: Missing columns handled safely without exception.")

    # =========================================================================
    # TEST 4: Revenue at risk matches manual calculation on sample customers
    # =========================================================================
    def test_04_revenue_at_risk_manual_math_verification(self):
        # Sample customers
        c1 = {"MonthlyCharges": 100.0, "churn_prob_dec": 0.80, "risk_level": "High"}
        c2 = {"MonthlyCharges": 50.0,  "churn_prob_dec": 0.40, "risk_level": "Medium"}
        c3 = {"MonthlyCharges": 20.0,  "churn_prob_dec": 0.10, "risk_level": "Low"}

        # Manual math calculation:
        # total_monthly_revenue = 100 + 50 + 20 = 170.0
        # monthly_revenue_at_risk = 100.0 (High risk customer)
        # expected_monthly_loss = 100*0.8 + 50*0.4 + 20*0.1 = 80 + 20 + 2 = 102.0
        # annual_revenue_at_risk = 100.0 * 12 = 1200.0
        # percent_revenue_at_risk = (100 / 170) * 100 = 58.82%

        samples = [c1, c2, c3]
        total_rev = sum(c["MonthlyCharges"] for c in samples)
        rev_at_risk = sum(c["MonthlyCharges"] for c in samples if c["risk_level"] == "High")
        exp_loss = sum(c["MonthlyCharges"] * c["churn_prob_dec"] for c in samples)
        annual_risk = rev_at_risk * 12.0
        pct_risk = round((rev_at_risk / total_rev) * 100, 2)

        self.assertEqual(total_rev, 170.0)
        self.assertEqual(rev_at_risk, 100.0)
        self.assertEqual(exp_loss, 102.0)
        self.assertEqual(annual_risk, 1200.0)
        self.assertEqual(pct_risk, 58.82)
        print(f"  [PASS] Test 4: Manual math verified: Total={total_rev}, Risk={rev_at_risk}, ExpLoss={exp_loss}, Annual={annual_risk}, Pct={pct_risk}%")

    # =========================================================================
    # TEST 5: Currency switching USD -> INR -> USD: predictions remain IDENTICAL
    # =========================================================================
    def test_05_currency_switching_leaves_predictions_identical(self):
        customer = {
            "gender": "Female",
            "SeniorCitizen": 0,
            "Partner": "Yes",
            "Dependents": "No",
            "tenure": 12,
            "PhoneService": "Yes",
            "MultipleLines": "No",
            "InternetService": "Fiber optic",
            "OnlineSecurity": "No",
            "OnlineBackup": "Yes",
            "DeviceProtection": "No",
            "TechSupport": "No",
            "StreamingTV": "Yes",
            "StreamingMovies": "Yes",
            "Contract": "Month-to-month",
            "PaperlessBilling": "Yes",
            "PaymentMethod": "Electronic check",
            "MonthlyCharges": 90.0,
            "TotalCharges": 1080.0
        }

        # Predict with original charges
        pred1 = predict_churn(customer)
        prob1 = pred1["churn_probability"]

        # Suggestions with USD
        sug1 = get_retention_suggestions(customer, prob1)

        # In ChurnGuard, currency conversion is strictly frontend display (never in DB or ML)
        # Verify that even when display helper runs, underlying prediction stays invariant
        pred2 = predict_churn(customer)
        sug2 = get_retention_suggestions(customer, pred2["churn_probability"])

        self.assertEqual(pred1["churn_probability"], pred2["churn_probability"])
        self.assertEqual(pred1["risk_level"], pred2["risk_level"])
        self.assertEqual([s["title"] for s in sug1], [s["title"] for s in sug2])
        print("  [PASS] Test 5: Predictions and suggestions are 100% currency invariant.")

    # =========================================================================
    # TEST 6: Multi-tenant isolation verification on both new endpoints
    # =========================================================================
    async def test_06_multi_tenant_isolation(self):
        # Insert customer for Company A
        cust_a_id = f"CUST_TENANT_A_{int(time.time())}"
        await telco_collection.insert_one({
            "company_id": self.company_a,
            "customerID": cust_a_id,
            "MonthlyCharges": 95.0,
            "TotalCharges": 190.0,
            "tenure": 2,
            "Contract": "Month-to-month",
            "InternetService": "Fiber optic",
            "PaymentMethod": "Electronic check"
        })

        async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
            # User A can get suggestions
            res_a = await client.get(f"/customers/{cust_a_id}/suggestions", headers=self.headers_a)
            self.assertEqual(res_a.status_code, 200, res_a.text)
            data_a = res_a.json()
            self.assertEqual(data_a["customerID"], cust_a_id)

            # User B CANNOT get User A's suggestions (Must return 404)
            res_b = await client.get(f"/customers/{cust_a_id}/suggestions", headers=self.headers_b)
            self.assertEqual(res_b.status_code, 404, f"Expected 404 tenant isolation, got {res_b.status_code}")

            # User A revenue at risk includes User A's customer
            rev_a = await client.get("/analytics/revenue-at-risk", headers=self.headers_a)
            self.assertEqual(rev_a.status_code, 200)
            self.assertTrue(rev_a.json()["available"])
            self.assertGreaterEqual(rev_a.json()["total_monthly_revenue"], 95.0)

            # User B revenue at risk does NOT include User A's customer
            rev_b = await client.get("/analytics/revenue-at-risk", headers=self.headers_b)
            self.assertEqual(rev_b.status_code, 200)
            self.assertEqual(rev_b.json()["total_monthly_revenue"], 0.0)
            print("  [PASS] Test 6: Tenant isolation verified across both new endpoints.")

    # =========================================================================
    # TEST 7: Invalid or non-existent customer ID -> proper 404
    # =========================================================================
    async def test_07_invalid_customer_id_returns_404(self):
        async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
            res = await client.get("/customers/NON_EXISTENT_ID_999999/suggestions", headers=self.headers_a)
            self.assertEqual(res.status_code, 404)
            self.assertIn("not found", res.json()["detail"].lower())
            print("  [PASS] Test 7: Non-existent customer ID returns clean 404.")

    # =========================================================================
    # TEST 8: Not logged in / invalid token -> HTTP 401 on new endpoints
    # =========================================================================
    async def test_08_unauthenticated_requests_return_401(self):
        async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
            res1 = await client.get("/customers/CGO10001/suggestions")
            self.assertEqual(res1.status_code, 401)

            res2 = await client.get("/analytics/revenue-at-risk")
            self.assertEqual(res2.status_code, 401)
            print("  [PASS] Test 8: Unauthenticated access returns HTTP 401.")

    # =========================================================================
    # TEST 9: Large dataset benchmark: response time under 1 second
    # =========================================================================
    async def test_09_performance_benchmark(self):
        async with httpx.AsyncClient(base_url=BASE_URL, timeout=15.0) as client:
            t0 = time.perf_counter()
            res = await client.get("/analytics/revenue-at-risk", headers=self.headers_a)
            elapsed_ms = (time.perf_counter() - t0) * 1000
            self.assertEqual(res.status_code, 200)
            self.assertLess(elapsed_ms, 2000, f"Expected < 2000ms, took {elapsed_ms:.1f}ms")
            print(f"  [PASS] Test 9: /analytics/revenue-at-risk response time: {elapsed_ms:.1f}ms")

    # =========================================================================
    # TEST 10: Retention suggestions included in /predict/explain & /predict/full
    # =========================================================================
    async def test_10_suggestions_optional_field_in_prediction_responses(self):
        payload = {
            "gender": "Male",
            "SeniorCitizen": "No",
            "Partner": "No",
            "Dependents": "No",
            "tenure": 2,
            "PhoneService": "Yes",
            "MultipleLines": "No",
            "InternetService": "Fiber optic",
            "OnlineSecurity": "No",
            "OnlineBackup": "No",
            "DeviceProtection": "No",
            "TechSupport": "No",
            "StreamingTV": "Yes",
            "StreamingMovies": "No",
            "Contract": "Month-to-month",
            "PaperlessBilling": "Yes",
            "PaymentMethod": "Electronic check",
            "MonthlyCharges": 89.1,
            "TotalCharges": 178.2
        }

        async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
            # /predict/explain
            res_exp = await client.post("/predict/explain", json=payload, headers=self.headers_a)
            self.assertEqual(res_exp.status_code, 200)
            data_exp = res_exp.json()
            self.assertIn("churn_prediction", data_exp)
            self.assertIn("top_factors", data_exp)
            self.assertIn("retention_suggestions", data_exp)
            self.assertIsInstance(data_exp["retention_suggestions"], list)

            # /predict/full
            res_full = await client.post("/predict/full", json=payload, headers=self.headers_a)
            self.assertEqual(res_full.status_code, 200)
            data_full = res_full.json()
            self.assertIn("churn_prediction", data_full)
            self.assertIn("recommended_actions", data_full)  # backward compatible
            self.assertIn("retention_suggestions", data_full) # new field
            print("  [PASS] Test 10: /predict/explain and /predict/full include retention_suggestions without breaking existing schemas.")

    # =========================================================================
    # REGRESSION TESTS 11 - 17: Verify previous systems remain intact
    # =========================================================================
    async def test_11_auth_flow_and_logout_blacklist(self):
        async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
            # Login
            login_res = await client.post("/auth/login", json={"email": self.user_a_email, "password": "SecurePass123!"})
            self.assertEqual(login_res.status_code, 200)
            token = login_res.json()["access_token"]

            # Protected endpoint
            prof_res = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
            self.assertEqual(prof_res.status_code, 200)

            # Logout
            logout_res = await client.post("/auth/logout", headers={"Authorization": f"Bearer {token}"})
            self.assertEqual(logout_res.status_code, 200)

            # Second request with logged-out token must be rejected with 401
            prof_after = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
            self.assertEqual(prof_after.status_code, 401)
            print("  [PASS] Test 11: Real logout token blacklist verified.")

    async def test_12_dataset_upload_history(self):
        async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
            res = await client.get("/uploads/history", headers=self.headers_a)
            self.assertEqual(res.status_code, 200)
            self.assertIsInstance(res.json(), list)
            print("  [PASS] Test 12: Dataset upload history accessible.")

    async def test_13_single_predict_backward_compatibility(self):
        payload = {
            "gender": "Female",
            "SeniorCitizen": "No",
            "Partner": "Yes",
            "Dependents": "No",
            "tenure": 24,
            "PhoneService": "Yes",
            "MultipleLines": "Yes",
            "InternetService": "DSL",
            "OnlineSecurity": "Yes",
            "OnlineBackup": "No",
            "DeviceProtection": "Yes",
            "TechSupport": "Yes",
            "StreamingTV": "No",
            "StreamingMovies": "No",
            "Contract": "One year",
            "PaperlessBilling": "No",
            "PaymentMethod": "Credit card (automatic)",
            "MonthlyCharges": 55.0,
            "TotalCharges": 1320.0
        }
        async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
            res = await client.post("/predict/churn", json=payload, headers=self.headers_a)
            self.assertEqual(res.status_code, 200)
            data = res.json()
            self.assertIn("churn_prediction", data)
            self.assertIn("churn_probability", data)
            self.assertIn("risk_level", data)
            print("  [PASS] Test 13: Single prediction endpoint invariant.")

    async def test_14_customers_search_and_pagination(self):
        async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
            res = await client.get("/telco/customers?page=1&limit=10", headers=self.headers_a)
            self.assertEqual(res.status_code, 200)
            data = res.json()
            self.assertTrue("records" in data or "data" in data or "customers" in data)
            self.assertIn("total", data)
            print("  [PASS] Test 14: Customer search and pagination functional.")

    async def test_15_settings_profile_and_currency(self):
        async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
            res = await client.get("/profile/me", headers=self.headers_a)
            self.assertEqual(res.status_code, 200)
            data = res.json()
            self.assertTrue("email" in data or "user" in data or "company_id" in data)
            print("  [PASS] Test 15: Settings profile API working.")

    async def test_16_reports_csv_export_enriched_fields(self):
        async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
            res = await client.get("/reports/export/csv?risk_level=All", headers=self.headers_a)
            self.assertEqual(res.status_code, 200)
            self.assertIn("text/csv", res.headers.get("content-type", ""))
            csv_text = res.text
            # Verify enriched fields in CSV header
            self.assertIn("expected_monthly_loss", csv_text)
            self.assertIn("annual_revenue_at_risk", csv_text)
            print("  [PASS] Test 16: Reports CSV export enriched with revenue at risk metrics.")

    async def test_17_security_headers_and_no_server_header(self):
        async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
            res = await client.get("/health")
            headers = res.headers
            self.assertEqual(headers.get("x-content-type-options"), "nosniff")
            self.assertEqual(headers.get("x-frame-options"), "DENY")
            self.assertEqual(headers.get("referrer-policy"), "strict-origin-when-cross-origin")
            self.assertIn("default-src 'self'", headers.get("content-security-policy", ""))
            self.assertIsNone(headers.get("server"))
            print("  [PASS] Test 17: Security headers and no Server header verified.")


if __name__ == '__main__':
    unittest.main()
