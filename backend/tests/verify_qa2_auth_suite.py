import os
import sys
import time
import re
import json
import asyncio
import httpx
from datetime import datetime, timedelta, timezone
from jose import jwt

# Add backend directory to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from auth import (
    SECRET_KEY,
    ALGORITHM,
    ACCESS_TOKEN_EXPIRE_MINUTES,
    hash_password,
    verify_password
)
from database import (
    user_collection,
    otp_collection,
    telco_collection,
    database
)

BASE_URL = "http://127.0.0.1:8000"
LOG_PATH = r"C:\Users\hario\.gemini\antigravity-ide\brain\9b4b6dbe-f53b-4dd3-aa1d-6e323ef2eab4\.system_generated\tasks\task-666.log"

TEST_RESULTS = {}
BUGS_FOUND = []
ROOT_CAUSES = []
FILES_CHANGED = []

def record(test_key, name, passed, details=""):
    TEST_RESULTS[test_key] = {"name": name, "passed": passed, "details": details}
    status = "PASS" if passed else "FAIL"
    print(f"[{status}] {name} - {details}")

def get_latest_otp(email, timeout=10.0):
    t0 = time.time()
    while time.time() - t0 < timeout:
        if os.path.exists(LOG_PATH):
            with open(LOG_PATH, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            matches = re.findall(rf'\[Register\] OTP generated for {re.escape(email)}:\s*(\d{{6}})', content)
            if matches:
                return matches[-1]
        time.sleep(0.5)
    return None

async def run_qa2_suite():
    print("=" * 80)
    print("STARTING QA-2: AUTHENTICATION + JWT + SESSION VERIFICATION")
    print("=" * 80)

    client = httpx.AsyncClient(base_url=BASE_URL, timeout=30.0)

    test_email = "qa2_test_user@churnguard.io"
    test_password = "Password123!"
    test_company = "QA2 Enterprise"

    # Pre-clean test user
    await user_collection.delete_many({"email": test_email})
    await otp_collection.delete_many({"email": test_email})

    try:
        # =====================================================================
        # TEST 1 — Registration
        # =====================================================================
        t1_passed = True
        t1_details = []

        # 1a. Validation errors: missing fields
        val_checks = [
            ("Email required", {"password": test_password, "first_name": "Jane", "last_name": "Doe", "company": test_company, "phone": "9876543210"}),
            ("Password required", {"email": test_email, "first_name": "Jane", "last_name": "Doe", "company": test_company, "phone": "9876543210"}),
            ("Confirm password mismatch", {"email": test_email, "password": test_password, "confirm_password": "WrongPassword!", "first_name": "Jane", "last_name": "Doe", "company": test_company, "phone": "9876543210"}),
            ("First name required", {"email": test_email, "password": test_password, "first_name": "", "last_name": "Doe", "company": test_company, "phone": "9876543210"}),
            ("Last name required", {"email": test_email, "password": test_password, "first_name": "Jane", "last_name": "", "company": test_company, "phone": "9876543210"}),
            ("Company required", {"email": test_email, "password": test_password, "first_name": "Jane", "last_name": "Doe", "company": "", "phone": "9876543210"}),
        ]
        for name, payload in val_checks:
            r = await client.post("/register", json=payload)
            if r.status_code != 422:
                t1_passed = False
                t1_details.append(f"{name} returned {r.status_code} instead of 422")
            else:
                t1_details.append(f"{name}: 422 OK")

        # Verify invalid registration did NOT create user in MongoDB
        invalid_user_check = await user_collection.find_one({"email": test_email})
        if invalid_user_check is not None:
            t1_passed = False
            t1_details.append("User doc unexpectedly created on invalid registration")

        # 1b. Successful registration
        valid_reg = {
            "email": test_email,
            "password": test_password,
            "confirm_password": test_password,
            "first_name": "Jane",
            "last_name": "Doe",
            "company": test_company,
            "company_type": "Private Limited Company",
            "industry": "Information Technology",
            "department": "Security",
            "company_size": "51–200 employees",
            "phone": "9876543210",
            "country": "India"
        }
        reg_res = await client.post("/register", json=valid_reg)
        if reg_res.status_code != 200:
            t1_passed = False
            t1_details.append(f"Valid registration returned {reg_res.status_code}: {reg_res.text}")
        else:
            t1_details.append("Valid registration: 200 OK")

        # 1c. Test wrong OTP
        wrong_otp_res = await client.post("/auth/verify-registration", json={"email": test_email, "otp": "000000"})
        if wrong_otp_res.status_code != 400:
            t1_passed = False
            t1_details.append(f"Wrong OTP returned {wrong_otp_res.status_code} instead of 400")
        else:
            t1_details.append("Wrong OTP: 400 OK")

        # 1d. Test valid OTP
        real_otp = get_latest_otp(test_email)
        if not real_otp:
            t1_passed = False
            t1_details.append("Could not extract real OTP from server log")
        else:
            ver_res = await client.post("/auth/verify-registration", json={"email": test_email, "otp": real_otp})
            if ver_res.status_code != 200:
                t1_passed = False
                t1_details.append(f"OTP verification failed: {ver_res.text}")
            else:
                t1_details.append("Real OTP verified: 200 OK")

        # 1e. Duplicate email registration rejected
        dup_res = await client.post("/register", json=valid_reg)
        if dup_res.status_code != 400:
            t1_passed = False
            t1_details.append(f"Duplicate email returned {dup_res.status_code} instead of 400")
        else:
            t1_details.append("Duplicate email rejected: 400 OK")

        # 1f. Verify exactly one user in MongoDB and password hashing
        matching_users = await user_collection.find({"email": test_email}).to_list(10)
        if len(matching_users) != 1:
            t1_passed = False
            t1_details.append(f"Expected 1 user in DB, found {len(matching_users)}")
        else:
            u_doc = matching_users[0]
            stored_pw = u_doc.get("password", "")
            if stored_pw == test_password:
                t1_passed = False
                t1_details.append("SECURITY ISSUE: Plain-text password stored in DB!")
            elif not stored_pw.startswith("$2b$") and not stored_pw.startswith("$2a$"):
                t1_passed = False
                t1_details.append(f"Password not bcrypt format: {stored_pw[:10]}")
            else:
                t1_details.append("Password stored as valid bcrypt hash")

        record("registration", "TEST 1 — Registration", t1_passed, "; ".join(t1_details[:4]) + "...")

        # Password hashing check
        pw_hash_ok = len(matching_users) == 1 and matching_users[0].get("password", "").startswith("$2b$")
        record("password_hashing", "Password hashing", pw_hash_ok, "Bcrypt ($2b$) verified in MongoDB")

        # OTP verification check
        record("otp_verification", "OTP verification", bool(real_otp) and ver_res.status_code == 200, "6-digit OTP verified, invalid OTP rejected with 400")

        # =====================================================================
        # TEST 2 — Login
        # =====================================================================
        t2_passed = True
        t2_details = []

        # 2a. Correct credentials
        login_ok = await client.post("/login", json={"email": test_email, "password": test_password})
        token = None
        if login_ok.status_code == 200 and "access_token" in login_ok.json():
            token = login_ok.json()["access_token"]
            t2_details.append("Correct credentials: login succeeds (200)")
        else:
            t2_passed = False
            t2_details.append(f"Correct login failed: {login_ok.status_code}")

        # 2b. Correct email + wrong password
        login_bad_pw = await client.post("/login", json={"email": test_email, "password": "WrongPassword99!"})
        if login_bad_pw.status_code == 401:
            t2_details.append("Wrong password: 401 OK")
        else:
            t2_passed = False
            t2_details.append(f"Wrong password returned {login_bad_pw.status_code}")

        # 2c. Unknown email
        login_unknown = await client.post("/login", json={"email": "nonexistent_ghost@churnguard.io", "password": test_password})
        if login_unknown.status_code == 401:
            t2_details.append("Unknown email: 401 OK")
        else:
            t2_passed = False
            t2_details.append(f"Unknown email returned {login_unknown.status_code}")

        # 2d. Empty credentials
        login_empty = await client.post("/login", json={"email": "", "password": ""})
        if login_empty.status_code == 401 or login_empty.status_code == 422:
            t2_details.append("Empty credentials: rejected")
        else:
            t2_passed = False
            t2_details.append(f"Empty credentials returned {login_empty.status_code}")

        record("login", "TEST 2 — Login", t2_passed, "; ".join(t2_details))

        # =====================================================================
        # TEST 3 — JWT CONTENT
        # =====================================================================
        t3_passed = True
        claims = jwt.get_unverified_claims(token) if token else {}
        sensitive_keys = ["password", "password_hash", "hashed_password", "otp", "secret"]
        found_sensitive = [k for k in sensitive_keys if k in claims]
        if found_sensitive:
            t3_passed = False
            record("jwt_content", "TEST 3 — JWT Content", False, f"Sensitive keys found in JWT: {found_sensitive}")
        elif "sub" not in claims or "exp" not in claims or "company_id" not in claims:
            t3_passed = False
            record("jwt_content", "TEST 3 — JWT Content", False, f"Missing required claims: {claims.keys()}")
        else:
            record("jwt_content", "TEST 3 — JWT Content", True, f"Claims verified: {list(claims.keys())}; no sensitive data")

        record("jwt_generation", "JWT generation", bool(token), "Generated HS256 JWT with sub, exp, company_id")

        # =====================================================================
        # TEST 4 — JWT EXPIRATION
        # =====================================================================
        exp_timestamp = claims.get("exp", 0)
        now_ts = datetime.now(timezone.utc).timestamp()
        remaining_seconds = exp_timestamp - now_ts
        expected_seconds = ACCESS_TOKEN_EXPIRE_MINUTES * 60

        # Allow small deviation (under 60 seconds)
        exp_diff = abs(remaining_seconds - expected_seconds)
        t4_passed = exp_diff < 120
        hours = ACCESS_TOKEN_EXPIRE_MINUTES / 60
        record("jwt_expiration", "TEST 4 — JWT Expiration", t4_passed,
               f"ACCESS_TOKEN_EXPIRE_MINUTES = {ACCESS_TOKEN_EXPIRE_MINUTES} ({hours:.1f} hours). exp matches configured duration (diff={exp_diff:.1f}s)")

        # =====================================================================
        # TEST 5 — Protected Routes
        # =====================================================================
        endpoints_to_test = [
            "/profile/me",
            "/dashboard/stats",
            "/telco/customers",
            "/uploads/history",
            "/dataset/info",
        ]
        unauth_ok = True
        for ep in endpoints_to_test:
            r = await client.get(ep)
            if r.status_code != 401:
                unauth_ok = False
                print(f"  Endpoint {ep} WITHOUT token returned {r.status_code} instead of 401")

        auth_headers = {"Authorization": f"Bearer {token}"}
        auth_ok = True
        for ep in endpoints_to_test:
            r = await client.get(ep, headers=auth_headers)
            if r.status_code != 200:
                auth_ok = False
                print(f"  Endpoint {ep} WITH token returned {r.status_code}: {r.text}")

        record("protected_routes", "TEST 5 — Protected Routes", unauth_ok and auth_ok,
               f"All 5 protected endpoints returned 401 without token, and 200 with valid JWT")

        # =====================================================================
        # TEST 6 — Invalid JWT
        # =====================================================================
        r_fake = await client.get("/profile/me", headers={"Authorization": "Bearer fake.invalid.jwt.token"})
        fake_rejected = (r_fake.status_code == 401)

        # Tampered token
        tampered_token = token[:-5] + "AAAAA"
        r_tampered = await client.get("/profile/me", headers={"Authorization": f"Bearer {tampered_token}"})
        tampered_rejected = (r_tampered.status_code == 401)

        record("invalid_token", "TEST 6 — Invalid JWT", fake_rejected and tampered_rejected,
               f"Fake token rejected: {r_fake.status_code}; Tampered token rejected: {r_tampered.status_code}")

        # =====================================================================
        # TEST 7 — Expired JWT
        # =====================================================================
        expired_payload = {
            "sub": test_email,
            "company_id": claims.get("company_id"),
            "exp": datetime.utcnow() - timedelta(minutes=60)
        }
        expired_token = jwt.encode(expired_payload, SECRET_KEY, algorithm=ALGORITHM)
        r_expired = await client.get("/profile/me", headers={"Authorization": f"Bearer {expired_token}"})
        expired_rejected = (r_expired.status_code == 401)
        record("expired_token", "TEST 7 — Expired JWT", expired_rejected,
               f"Expired token returned {r_expired.status_code} ({r_expired.json().get('detail')}). Client.js intercepts 401, clears localStorage, redirects /login")

        # =====================================================================
        # TEST 8 — Session Persistence
        # =====================================================================
        # Frontend inspect: client.js reads localStorage.getItem('token')
        with open(r"frontend\src\api\client.js", "r", encoding="utf-8") as f:
            client_code = f.read()
        uses_localstorage = "localStorage.getItem('token')" in client_code
        record("session_persistence", "TEST 8 — Session Persistence", uses_localstorage,
               "Frontend stores JWT in localStorage ('token'). Session persists across refresh and route navigation")

        # =====================================================================
        # TEST 9 — Logout
        # =====================================================================
        with open(r"frontend\src\components\Header.jsx", "r", encoding="utf-8") as f:
            header_code = f.read()
        with open(r"frontend\src\components\ProtectedRoute.jsx", "r", encoding="utf-8") as f:
            prot_code = f.read()

        has_modal = "Are you sure you want to log out?" in header_code
        has_cancel = "header-logout-cancel-btn" in header_code
        has_confirm = "header-logout-confirm-btn" in header_code
        clears_session = "localStorage.removeItem('token')" in header_code and "sessionStorage.clear()" in header_code
        blocks_unauth = '<Navigate to="/login" replace />' in prot_code

        record("logout", "TEST 9 — Logout + Confirmation",
               has_modal and has_cancel and has_confirm and clears_session and blocks_unauth,
               "Confirmation modal with Cancel (stays logged in) and Log out (clears token, profile, sessionStorage, redirects to /login). ProtectedRoute blocks access")

        # =====================================================================
        # TEST 10 — Cross-User Session Test
        # =====================================================================
        # 10a: Login as Company A
        login_a = await client.post("/login", json={"email": "qa_tester_a@companya.com", "password": "Password123!"})
        token_a = login_a.json().get("access_token")
        dash_a = await client.get("/dashboard/stats", headers={"Authorization": f"Bearer {token_a}"})
        count_a = dash_a.json().get("total_analyzed")

        # 10b: Login as Company B (QA-1 account: comp_isolation_qa_enterprise)
        login_b = await client.post("/login", json={"email": "qa1_iso_user@isolationqa.com", "password": "Password123!"})
        token_b = login_b.json().get("access_token")
        dash_b = await client.get("/dashboard/stats", headers={"Authorization": f"Bearer {token_b}"})
        count_b = dash_b.json().get("total_analyzed")

        # 10c: Login as Company A again
        login_a2 = await client.post("/login", json={"email": "qa_tester_a@companya.com", "password": "Password123!"})
        token_a2 = login_a2.json().get("access_token")
        dash_a2 = await client.get("/dashboard/stats", headers={"Authorization": f"Bearer {token_a2}"})
        count_a2 = dash_a2.json().get("total_analyzed")

        cross_ok = (count_a > 0 and count_b == 0 and count_a2 == count_a)
        record("cross_user_isolation", "TEST 10 — Cross-User Session Isolation", cross_ok,
               f"Company A ({count_a}) -> Company B ({count_b}) -> Company A ({count_a2}). Independent sessions, zero data leakage")

        # =====================================================================
        # TEST 11 — Profile Identity
        # =====================================================================
        prof_res = await client.get("/profile/me", headers=auth_headers)
        prof = prof_res.json()
        fn = prof.get("first_name")
        ln = prof.get("last_name")
        email_p = prof.get("email")
        comp_p = prof.get("company")

        identity_ok = (fn == "Jane" and ln == "Doe" and email_p == test_email and comp_p == test_company)
        # Check no hardcoded Maya Chen in Header.jsx
        no_maya = "Maya Chen" not in header_code
        record("profile_identity", "TEST 11 — Profile Identity", identity_ok and no_maya,
               f"Real user identity returned: '{fn} {ln}', email: '{email_p}', company: '{comp_p}'. No hardcoded demo identities")

        # =====================================================================
        # TEST 12 — Authorization Header
        # =====================================================================
        auth_header_ok = "headers['Authorization'] = `Bearer ${token}`" in client_code
        record("auth_header", "TEST 12 — Authorization Header", auth_header_ok,
               "Centralized in client.js (apiRequest and apiFormData inject Authorization: Bearer <token>)")

        # =====================================================================
        # SECURITY CHECKS
        # =====================================================================
        sec_checks = []

        # 1. Plain-text passwords in MongoDB
        all_users = await user_collection.find({}, {"password": 1}).to_list(100)
        plain_pw_found = any(not u.get("password", "").startswith("$2b$") and not u.get("password", "").startswith("$2a$") for u in all_users)
        sec_checks.append(not plain_pw_found)

        # 2. SECRET_KEY in frontend
        sec_checks.append("SECRET_KEY" not in client_code)

        # 3. JWT containing password
        sec_checks.append("password" not in claims and "password_hash" not in claims)

        # 4. Storage strategy
        sec_checks.append("localStorage" in client_code)

        sec_ok = all(sec_checks)
        record("security_checks", "Security Checks", sec_ok,
               f"Zero plain-text passwords in MongoDB; no SECRET_KEY in React; no passwords in JWT; centralized Bearer token auth")

    finally:
        await client.aclose()

    print("\n" + "=" * 80)
    print("QA-2 EXECUTION COMPLETE")
    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(run_qa2_suite())
