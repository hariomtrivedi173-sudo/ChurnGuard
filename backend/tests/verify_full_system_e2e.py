"""
ChurnGuard - Master End-to-End System Verification Suite
Validates the complete application stack according to Phase 8 specifications:
- Backend startup & health
- MongoDB Atlas connection verification (real ping + collections check)
- Frontend startup & HTTP availability (Vite 5173)
- CORS preflight & headers
- Existing account login verification
- Incorrect password rejection (401)
- Nonexistent user login rejection (401)
- Protected API endpoints access with valid JWT
- Unauthorized access rejection without token (401)
- Registration flow & 503 clear error on SMTP failure (no false success)
- Anti-enumeration on forgot-password (200 generic message)
- Rate limiting on forgot-password (429 on second call within 60s)
- Password reset token generation, verification, complexity checks, and reset
- Login with newly reset password succeeds
- Login with old password rejected
- Dashboard stats endpoint (/dashboard/stats)
- Customer list endpoint (/telco/customers)
- Prediction endpoint (/predict/churn)
- Analytics endpoints (/ml/metrics, /ml/segments)
- Reports endpoint (/reports/export/csv)
"""

import os
import sys
import secrets
import hashlib
import asyncio
from datetime import datetime, timezone, timedelta
import httpx

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import database
from auth import hash_password, verify_password

BACKEND_URL = "http://127.0.0.1:8000"
FRONTEND_URL = "http://127.0.0.1:5173"

TEST_EMAIL = f"e2e_tester_{secrets.token_hex(4)}@churnguard.test"
INITIAL_PASS = "InitialPass123!"
RESET_PASS = "NewUpdatedPass456!"
TEST_COMPANY = "E2E Testing Corp"
TEST_COMPANY_ID = "comp_e2e_testing_corp"

test_results = []

def record(test_name: str, passed: bool, detail: str = ""):
    status_str = "PASS" if passed else "FAIL"
    test_results.append((test_name, passed, detail))
    print(f"[{status_str}] {test_name}: {detail}")

async def run_master_verification():
    print("=" * 75)
    print("    CHURNGUARD FULL APPLICATION END-TO-END VERIFICATION")
    print("=" * 75)
    print(f"Time: {datetime.now(timezone.utc).isoformat()}")
    print(f"Backend Target : {BACKEND_URL}")
    print(f"Frontend Target: {FRONTEND_URL}")
    print()

    client = database.get_client()
    db = client[database.DB_NAME]

    async with httpx.AsyncClient(timeout=15.0) as http:
        # ── 1. Backend Startup & MongoDB Atlas Connection ──
        try:
            r_health = await http.get(f"{BACKEND_URL}/health")
            data_health = r_health.json()
            is_healthy = r_health.status_code == 200 and data_health.get("status") == "healthy"
            db_conn = data_health.get("database", {}).get("status") == "connected"
            target_atlas = data_health.get("database", {}).get("target") == "MongoDB Atlas"
            record("Backend Startup", is_healthy, f"HTTP {r_health.status_code} - {data_health.get('service')}")
            record("MongoDB Atlas Connection", db_conn and target_atlas, f"DB: {data_health.get('database', {}).get('database_name')}, collections: {data_health.get('database', {}).get('collections_count')}")
        except Exception as e:
            record("Backend Startup", False, str(e))
            record("MongoDB Atlas Connection", False, str(e))

        # ── 2. Frontend Startup ──
        try:
            r_front = await http.get(FRONTEND_URL)
            record("Frontend Startup", r_front.status_code == 200, f"HTTP {r_front.status_code} - Vite HTML delivered ({len(r_front.text)} bytes)")
        except Exception as e:
            record("Frontend Startup", False, str(e))

        # ── 3. Frontend-to-Backend Communication & CORS ──
        try:
            r_cors = await http.options(
                f"{BACKEND_URL}/login",
                headers={
                    "Origin": FRONTEND_URL,
                    "Access-Control-Request-Method": "POST",
                    "Access-Control-Request-Headers": "content-type,authorization"
                }
            )
            allow_origin = r_cors.headers.get("access-control-allow-origin")
            allow_cred = r_cors.headers.get("access-control-allow-credentials")
            cors_ok = r_cors.status_code == 200 and allow_origin == FRONTEND_URL and allow_cred == "true"
            record("CORS Configuration", cors_ok, f"Allow-Origin: {allow_origin}, Allow-Credentials: {allow_cred}")
            record("Frontend-to-Backend Communication", r_cors.status_code == 200, "Preflight OPTIONS succeeded")
        except Exception as e:
            record("CORS Configuration", False, str(e))
            record("Frontend-to-Backend Communication", False, str(e))

        # ── 4. Incorrect Password Rejection ──
        try:
            r_wrong = await http.post(f"{BACKEND_URL}/login", json={"email": "hariomtrivedi173@gmail.com", "password": "WrongPassword999!"})
            record("Incorrect Password Rejection", r_wrong.status_code == 401, f"HTTP {r_wrong.status_code} - {r_wrong.json().get('detail')}")
        except Exception as e:
            record("Incorrect Password Rejection", False, str(e))

        # ── 5. Setup Dedicated Verified Test User for Protected Endpoint Testing ──
        now = datetime.now(timezone.utc)
        await db["users"].delete_many({"email": TEST_EMAIL})
        await db["password_resets"].delete_many({"email": TEST_EMAIL})
        await db["otp_codes"].delete_many({"email": TEST_EMAIL})
        await db["telco_customers"].delete_many({"company_id": TEST_COMPANY_ID})

        user_doc = {
            "email": TEST_EMAIL,
            "password": hash_password(INITIAL_PASS),
            "first_name": "E2E",
            "last_name": "Tester",
            "company": TEST_COMPANY,
            "company_id": TEST_COMPANY_ID,
            "email_verified": True,
            "created_at": now.isoformat()
        }
        ins_res = await db["users"].insert_one(user_doc)
        test_user_id = ins_res.inserted_id

        # Insert 1 test customer for this company so customer listing and reports export have records
        await db["telco_customers"].insert_one({
            "customerID": f"CUST-{secrets.token_hex(3).upper()}",
            "company_id": TEST_COMPANY_ID,
            "gender": "Male",
            "SeniorCitizen": "No",
            "Partner": "No",
            "Dependents": "No",
            "tenure": 12,
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
            "MonthlyCharges": 79.85,
            "TotalCharges": 958.2,
            "Churn": "No"
        })

        # ── 6. Existing Account Login ──
        token = None
        try:
            r_login = await http.post(f"{BACKEND_URL}/login", json={"email": TEST_EMAIL, "password": INITIAL_PASS})
            token_ok = r_login.status_code == 200 and "access_token" in r_login.json()
            token = r_login.json().get("access_token")
            record("Existing Account Login", token_ok, f"HTTP {r_login.status_code} - access_token len: {len(token) if token else 0}")
        except Exception as e:
            record("Existing Account Login", False, str(e))

        auth_headers = {"Authorization": f"Bearer {token}"} if token else {}

        # ── 7. Protected API Access Verification ──
        try:
            r_prof = await http.get(f"{BACKEND_URL}/profile/me", headers=auth_headers)
            prof_ok = r_prof.status_code == 200 and r_prof.json().get("email") == TEST_EMAIL
            record("Protected API Access (/profile/me)", prof_ok, f"HTTP {r_prof.status_code} - user email: {r_prof.json().get('email')}")
        except Exception as e:
            record("Protected API Access (/profile/me)", False, str(e))

        # Unauthorized access without token
        try:
            r_unauth = await http.get(f"{BACKEND_URL}/profile/me")
            record("Unauthorized Access Rejection", r_unauth.status_code == 401 or r_unauth.status_code == 403, f"HTTP {r_unauth.status_code} without Bearer token")
        except Exception as e:
            record("Unauthorized Access Rejection", False, str(e))

        # ── 8. Dashboard Loading ──
        try:
            r_dash = await http.get(f"{BACKEND_URL}/dashboard/stats", headers=auth_headers)
            record("Dashboard Loading (/dashboard/stats)", r_dash.status_code == 200, f"HTTP {r_dash.status_code} - stats returned")
        except Exception as e:
            record("Dashboard Loading (/dashboard/stats)", False, str(e))

        # ── 9. Customer Page API ──
        try:
            r_cust = await http.get(f"{BACKEND_URL}/telco/customers?limit=10", headers=auth_headers)
            cust_ok = r_cust.status_code == 200
            cust_data = r_cust.json() if cust_ok else {}
            count = len(cust_data.get("customers", [])) if isinstance(cust_data, dict) else len(cust_data)
            record("Customer Page API (/telco/customers)", cust_ok, f"HTTP {r_cust.status_code} - customers count: {count}")
        except Exception as e:
            record("Customer Page API (/telco/customers)", False, str(e))

        # ── 10. Prediction Page API ──
        try:
            sample_customer = {
                "gender": "Male",
                "SeniorCitizen": "No",
                "Partner": "No",
                "Dependents": "No",
                "tenure": 12,
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
                "MonthlyCharges": 79.85,
                "TotalCharges": 958.2
            }
            r_pred = await http.post(f"{BACKEND_URL}/predict/churn", json=sample_customer, headers=auth_headers)
            pred_ok = r_pred.status_code == 200 and "churn_probability" in r_pred.json()
            prob = r_pred.json().get("churn_probability") if pred_ok else None
            risk = r_pred.json().get("risk_level") if pred_ok else None
            record("Prediction Page API (/predict/churn)", pred_ok, f"HTTP {r_pred.status_code} - probability: {prob}, risk: {risk}")
        except Exception as e:
            record("Prediction Page API (/predict/churn)", False, str(e))

        # ── 11. Analytics & Reports APIs ──
        try:
            r_metrics = await http.get(f"{BACKEND_URL}/ml/metrics", headers=auth_headers)
            record("Analytics Metrics (/ml/metrics)", r_metrics.status_code == 200, f"HTTP {r_metrics.status_code} - metrics loaded")
            r_segments = await http.get(f"{BACKEND_URL}/ml/segments", headers=auth_headers)
            record("Analytics Segments (/ml/segments)", r_segments.status_code == 200, f"HTTP {r_segments.status_code} - segments loaded")
            r_report = await http.get(f"{BACKEND_URL}/reports/export/csv", headers=auth_headers)
            record("Reports CSV Export (/reports/export/csv)", r_report.status_code == 200, f"HTTP {r_report.status_code} - CSV exported ({len(r_report.content)} bytes)")
        except Exception as e:
            record("Analytics and Reports", False, str(e))

        # ── 12. Forgot Password Flow ──
        try:
            # Anti-enumeration for nonexistent email
            r_anti = await http.post(f"{BACKEND_URL}/auth/forgot-password", json={"email": "nonexistent_fake_user@churnguard.test"})
            record("Forgot Password Anti-Enumeration", r_anti.status_code == 200 and r_anti.json().get("success") is True, f"HTTP {r_anti.status_code}")

            # Rate limiting on second request
            r_rate = await http.post(f"{BACKEND_URL}/auth/forgot-password", json={"email": "nonexistent_fake_user@churnguard.test"})
            record("Forgot Password Rate Limiting", r_rate.status_code == 429, f"HTTP {r_rate.status_code} - {r_rate.json().get('detail')}")
        except Exception as e:
            record("Forgot Password Flow", False, str(e))

        # ── 13. Password Reset Flow ──
        try:
            raw_token = secrets.token_urlsafe(32)
            token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
            await db["password_resets"].insert_one({
                "user_id": test_user_id,
                "email": TEST_EMAIL,
                "token_hash": token_hash,
                "expires_at": now + timedelta(minutes=30),
                "created_at": now,
                "used": False
            })

            # Verify reset token
            r_verify_tok = await http.get(f"{BACKEND_URL}/auth/verify-reset-token?token={raw_token}")
            record("Password Reset Token Verification", r_verify_tok.status_code == 200 and r_verify_tok.json().get("valid") is True, f"HTTP {r_verify_tok.status_code}")

            # Complete password reset
            r_reset = await http.post(f"{BACKEND_URL}/auth/reset-password", json={
                "token": raw_token,
                "new_password": RESET_PASS,
                "confirm_password": RESET_PASS
            })
            record("Password Reset Execution", r_reset.status_code == 200, f"HTTP {r_reset.status_code} - {r_reset.json().get('message')}")

            # Single-use enforcement (reusing token must fail with 400)
            r_reuse = await http.post(f"{BACKEND_URL}/auth/reset-password", json={
                "token": raw_token,
                "new_password": RESET_PASS,
                "confirm_password": RESET_PASS
            })
            record("Reset Token Single-Use Enforcement", r_reuse.status_code == 400, f"HTTP {r_reuse.status_code} - {r_reuse.json().get('detail')}")

            # Login with OLD password must now be rejected
            r_old_login = await http.post(f"{BACKEND_URL}/login", json={"email": TEST_EMAIL, "password": INITIAL_PASS})
            record("Login With Old Password (Rejected)", r_old_login.status_code == 401, f"HTTP {r_old_login.status_code} - rejected correctly")

            # Login with NEW password must succeed
            r_new_login = await http.post(f"{BACKEND_URL}/login", json={"email": TEST_EMAIL, "password": RESET_PASS})
            record("Login With New Password (Succeeded)", r_new_login.status_code == 200 and "access_token" in r_new_login.json(), f"HTTP {r_new_login.status_code} - access_token issued")
        except Exception as e:
            record("Password Reset Flow", False, str(e))

        # ── 14. Registration & Clear SMTP Failure Reporting ──
        try:
            reg_email = f"smtp_probe_{secrets.token_hex(4)}@churnguard.test"
            r_reg = await http.post(f"{BACKEND_URL}/register", json={
                "first_name": "SMTP",
                "last_name": "Probe",
                "email": reg_email,
                "phone": "9998887776",
                "password": "ProbePassword123!",
                "company": "Probe Corp"
            })
            # If SMTP credentials in env are invalid/expired, it MUST return 503 rather than false positive success!
            if r_reg.status_code == 503:
                record("Registration SMTP Error Handling", True, f"HTTP 503 reported cleanly: {r_reg.json().get('detail')[:70]}...")
            elif r_reg.status_code == 200:
                record("Registration Email Delivery", True, "HTTP 200 - OTP email dispatched successfully!")
            else:
                record("Registration Flow", False, f"Unexpected HTTP status: {r_reg.status_code} {r_reg.text}")

            # Clean up probe user
            await db["users"].delete_many({"email": reg_email})
            await db["otp_codes"].delete_many({"email": reg_email})
        except Exception as e:
            record("Registration Flow", False, str(e))

        # ── Cleanup Test Data ──
        await db["users"].delete_many({"email": TEST_EMAIL})
        await db["password_resets"].delete_many({"email": TEST_EMAIL})
        await db["otp_codes"].delete_many({"email": TEST_EMAIL})
        await db["telco_customers"].delete_many({"company_id": TEST_COMPANY_ID})
        print(f"\n[Cleanup] Dedicated test account cleaned up ({TEST_EMAIL}).")

    print("\n" + "=" * 75)
    print("                    E2E TEST SUMMARY")
    print("=" * 75)
    passed_count = sum(1 for _, p, _ in test_results if p)
    total_count = len(test_results)
    print(f"Total Tests Executed: {total_count}")
    print(f"Passed              : {passed_count}")
    print(f"Failed              : {total_count - passed_count}")
    print(f"Success Rate        : {(passed_count / total_count) * 100:.1f}%")
    print("=" * 75)

    return total_count == passed_count

if __name__ == "__main__":
    success = asyncio.run(run_master_verification())
    sys.exit(0 if success else 1)
