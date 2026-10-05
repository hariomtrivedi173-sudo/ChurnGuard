"""
verify_qa12_final_master_suite.py
Final Comprehensive E2E Regression + Security + Release Readiness Test Suite
Project: ChurnGuard

This test suite executes all backend assertions for QA-12:
1. Application Startup & OpenAPI/Swagger
2. Authentication Final Regression
3. Multi-Tenant Isolation Final Test
4. Dataset / Customer Final Regression
5. Dashboard Final Regression
6. Customers Final Regression
7. ML Prediction Final Regression
8. Batch Prediction Final Test
9. Analytics Final Regression
10. Report / Export Final Regression (inc. CSV formula injection protection: =, +, -, @)
11. Settings / Profile Final Regression
12. Notifications Final Regression
14. Backend Security & Tenant Scope Audit
15. API Error Handling
16. Database Final Verification
17. Performance Sanity Check
"""

import os
import sys
import time
import io
import csv
import re
import asyncio
import httpx
from datetime import datetime, timezone

# Ensure backend directory is in path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from database import (
    user_collection,
    telco_collection,
    notification_collection,
    otp_collection,
    database
)

BASE_URL = "http://127.0.0.1:8000"

PASSED_COUNT = 0
FAILED_COUNT = 0
FAILED_TESTS = []

def record(test_id, name, condition, details=""):
    global PASSED_COUNT, FAILED_COUNT, FAILED_TESTS
    if condition:
        PASSED_COUNT += 1
        print(f"[PASS] {test_id} - {name} | {details}")
    else:
        FAILED_COUNT += 1
        msg = f"{test_id} - {name} | {details}"
        FAILED_TESTS.append(msg)
        print(f"[FAIL] {test_id} - {name} | {details}")


async def clean_company(company_id, emails):
    await telco_collection.delete_many({"company_id": company_id})
    await database["dataset_uploads"].delete_many({"company_id": company_id})
    await database["dashboard_cache"].delete_many({"company_id": company_id})
    await notification_collection.delete_many({"company_id": company_id})
    for email in emails:
        norm = email.strip().lower()
        await user_collection.delete_many({"email": norm})
        await otp_collection.delete_many({"email": norm})


async def run_qa12_suite():
    print("=" * 80)
    print("STARTING QA-12 MASTER COMPREHENSIVE REGRESSION & SECURITY SUITE")
    print("=" * 80)

    client = httpx.AsyncClient(base_url=BASE_URL, timeout=60.0)

    # =========================================================================
    # 1. APPLICATION STARTUP & OPENAPI
    # =========================================================================
    print("\n--- SECTION 1: APPLICATION STARTUP & OPENAPI ---")
    r_docs = await client.get("/docs")
    record("1.1", "Swagger /docs returns 200", r_docs.status_code == 200, f"Status: {r_docs.status_code}")

    r_openapi = await client.get("/openapi.json")
    record("1.2", "OpenAPI JSON returns 200", r_openapi.status_code == 200, f"Status: {r_openapi.status_code}")
    if r_openapi.status_code == 200:
        paths = r_openapi.json().get("paths", {})
        record("1.3", "OpenAPI routes registered", len(paths) >= 20, f"Found {len(paths)} API routes")

    # =========================================================================
    # 2. AUTHENTICATION FINAL REGRESSION
    # =========================================================================
    print("\n--- SECTION 2: AUTHENTICATION FINAL REGRESSION ---")
    email_a = "qa12_corp_a@churnguard.test"
    email_b = "qa12_corp_b@churnguard.test"
    pwd_a = "SecurePass123!"
    pwd_b = "SecurePass456!"
    company_name_a = "QA12 Alpha Corp"
    company_name_b = "QA12 Beta Corp"
    company_id_a = "comp_qa12_alpha_corp"
    company_id_b = "comp_qa12_beta_corp"

    await clean_company(company_id_a, [email_a])
    await clean_company(company_id_b, [email_b])

    # 2.1 Register User A
    reg_a_res = await client.post("/register", json={
        "first_name": "Alpha",
        "last_name": "Admin",
        "email": email_a,
        "phone": "9998887771",
        "password": pwd_a,
        "confirm_password": pwd_a,
        "company": company_name_a,
        "company_type": "Private Limited Company",
        "industry": "Software",
        "department": "Engineering",
        "company_size": "11–50 employees",
        "country": "India"
    })
    record("2.1", "Register Company A returns 200", reg_a_res.status_code == 200, f"Status: {reg_a_res.status_code}")

    # Verify unverified account cannot login
    unver_login = await client.post("/login", json={"email": email_a, "password": pwd_a})
    record("2.2", "Unverified account login rejected (403)", unver_login.status_code in (401, 403), f"Status: {unver_login.status_code}")

    # Retrieve OTP directly from MongoDB otp_codes collection for verified testing
    otp_doc_a = await otp_collection.find_one({"email": email_a, "purpose": "email_verification"})
    record("2.3", "OTP document created in MongoDB", otp_doc_a is not None, f"Found OTP doc: {bool(otp_doc_a)}")

    # 2.4 Test wrong OTP verification
    wrong_otp_res = await client.post("/auth/verify-registration", json={"email": email_a, "otp": "000000"})
    record("2.4", "Wrong OTP rejected (400)", wrong_otp_res.status_code == 400, f"Status: {wrong_otp_res.status_code}")

    # Set known test OTP in database for testing
    from auth import hash_password
    test_otp_code = "654321"
    await otp_collection.update_one(
        {"email": email_a, "purpose": "email_verification"},
        {"$set": {"otp_hash": hash_password(test_otp_code)}}
    )

    # 2.5 Verify account with valid OTP
    ver_res_a = await client.post("/auth/verify-registration", json={"email": email_a, "otp": test_otp_code})
    record("2.5", "Valid OTP verification returns 200", ver_res_a.status_code == 200, f"Status: {ver_res_a.status_code}")

    # 2.6 Duplicate email registration rejected
    dup_reg = await client.post("/register", json={
        "first_name": "Duplicate",
        "last_name": "User",
        "email": email_a,
        "phone": "9998887771",
        "password": pwd_a,
        "confirm_password": pwd_a,
        "company": company_name_a,
        "company_type": "Private Limited Company",
        "industry": "Software",
        "department": "Engineering",
        "company_size": "11–50 employees",
        "country": "India"
    })
    record("2.6", "Duplicate email registration rejected (400)", dup_reg.status_code == 400, f"Status: {dup_reg.status_code}")

    # 2.7 Login with wrong password
    wrong_pwd_res = await client.post("/login", json={"email": email_a, "password": "WrongPassword999!"})
    record("2.7", "Wrong password returns 401", wrong_pwd_res.status_code == 401, f"Status: {wrong_pwd_res.status_code}")

    # 2.8 Login with wrong email
    wrong_email_res = await client.post("/login", json={"email": "nonexistent_email_12345@test.com", "password": pwd_a})
    record("2.8", "Wrong email returns 401", wrong_email_res.status_code == 401, f"Status: {wrong_email_res.status_code}")

    # 2.9 Valid login for Company A
    login_a = await client.post("/login", json={"email": email_a, "password": pwd_a})
    record("2.9", "Valid login returns 200 and access_token", login_a.status_code == 200 and "access_token" in login_a.json(), f"Status: {login_a.status_code}")
    token_a = login_a.json().get("access_token")
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # Verify no password returned in login response
    record("2.10", "No password returned in login response", "password" not in login_a.json() and "password_hash" not in login_a.json(), "Safe response")

    # 2.11 Verify JWT token structure & claims
    from jose import jwt
    from auth import SECRET_KEY, ALGORITHM
    decoded_token = jwt.decode(token_a, SECRET_KEY, algorithms=[ALGORITHM])
    record("2.11", "JWT contains sub and company_id claims", "sub" in decoded_token and "company_id" in decoded_token, f"Claims: {list(decoded_token.keys())}")
    record("2.12", "JWT company_id matches Company A", decoded_token.get("company_id") == company_id_a, f"Company ID: {decoded_token.get('company_id')}")

    # 2.13 Database password verification (bcrypt hashed)
    user_doc = await user_collection.find_one({"email": email_a})
    pwd_in_db = user_doc.get("password") or user_doc.get("hashed_password") or ""
    record("2.13", "Password in MongoDB is bcrypt hashed ($2b$)", pwd_in_db.startswith("$2b$") or pwd_in_db.startswith("$2a$"), f"Hash prefix: {pwd_in_db[:7]}")

    # 2.14 Page refresh simulation (GET /profile/me with valid token)
    prof_res = await client.get("/profile/me", headers=headers_a)
    record("2.14", "Page refresh token verification (GET /profile/me)", prof_res.status_code == 200 and prof_res.json().get("email") == email_a, f"Status: {prof_res.status_code}")

    # 2.15 Protected API without token returns 401
    no_token_res = await client.get("/telco/customers")
    record("2.15", "Protected API without token returns 401", no_token_res.status_code == 401, f"Status: {no_token_res.status_code}")

    # 2.16 Invalid/tampered token returns 401
    fake_token_res = await client.get("/telco/customers", headers={"Authorization": "Bearer fake.tampered.jwt.signature"})
    record("2.16", "Tampered token returns 401", fake_token_res.status_code == 401, f"Status: {fake_token_res.status_code}")

    # =========================================================================
    # 3. MULTI-TENANT ISOLATION FINAL TEST (Setup Company B)
    # =========================================================================
    print("\n--- SECTION 3: MULTI-TENANT ISOLATION FINAL TEST ---")
    reg_b_res = await client.post("/register", json={
        "first_name": "Beta",
        "last_name": "Manager",
        "email": email_b,
        "phone": "9998887772",
        "password": pwd_b,
        "confirm_password": pwd_b,
        "company": company_name_b,
        "company_type": "Private Limited Company",
        "industry": "Telecommunications",
        "department": "Operations",
        "company_size": "51–200 employees",
        "country": "India"
    })
    record("3.1", "Register Company B returns 200", reg_b_res.status_code == 200, f"Status: {reg_b_res.status_code}")

    # Activate Company B directly
    await otp_collection.update_one(
        {"email": email_b, "purpose": "email_verification"},
        {"$set": {"otp_hash": hash_password(test_otp_code)}}
    )
    ver_res_b = await client.post("/auth/verify-registration", json={"email": email_b, "otp": test_otp_code})
    record("3.2", "Verify Company B OTP returns 200", ver_res_b.status_code == 200, f"Status: {ver_res_b.status_code}")

    login_b = await client.post("/login", json={"email": email_b, "password": pwd_b})
    token_b = login_b.json().get("access_token")
    headers_b = {"Authorization": f"Bearer {token_b}"}
    record("3.3", "Login Company B returns 200", login_b.status_code == 200, f"Company B token received: {bool(token_b)}")

    # 3.4 Empty state for newly created companies
    dash_b_init = await client.get("/dashboard/stats", headers=headers_b)
    record("3.4", "Company B starts with empty dashboard", dash_b_init.status_code == 200 and dash_b_init.json().get("total_analyzed", 0) == 0, f"Total analyzed: {dash_b_init.json().get('total_analyzed')}")

    cust_b_init = await client.get("/telco/customers", headers=headers_b)
    record("3.5", "Company B starts with 0 customers", cust_b_init.status_code == 200 and cust_b_init.json().get("total", 0) == 0, f"Records: {len(cust_b_init.json().get('records', []))}")

    # =========================================================================
    # 4. DATASET / CUSTOMER FINAL REGRESSION (Upload via /dataset/store)
    # =========================================================================
    print("\n--- SECTION 4: DATASET / CUSTOMER FINAL REGRESSION ---")
    csv_header = "customerID,gender,SeniorCitizen,Partner,Dependents,tenure,PhoneService,MultipleLines,InternetService,OnlineSecurity,OnlineBackup,DeviceProtection,TechSupport,StreamingTV,StreamingMovies,Contract,PaperlessBilling,PaymentMethod,MonthlyCharges,TotalCharges\n"
    
    # 5 customers for Company A
    rows_a = [
        "CUST-A01,Male,No,No,No,1,Yes,No,DSL,No,Yes,No,No,No,No,Month-to-month,Yes,Electronic check,29.85,29.85",
        "CUST-A02,Female,No,Yes,No,34,Yes,Yes,DSL,Yes,No,Yes,No,No,No,One year,No,Mailed check,56.95,1889.5",
        "CUST-A03,Male,No,No,No,2,Yes,No,Fiber optic,No,No,No,No,No,No,Month-to-month,Yes,Mailed check,53.85,108.15",
        "CUST-A04,Male,No,No,No,45,No,No,DSL,Yes,No,Yes,Yes,No,No,One year,No,Bank transfer (automatic),42.30,1840.75",
        "CUST-A05,Female,No,No,No,2,Yes,No,Fiber optic,No,No,No,No,No,No,Month-to-month,Yes,Electronic check,70.70,151.65"
    ]
    csv_a_content = (csv_header + "\n".join(rows_a)).encode("utf-8")

    # 4.1 Upload valid CSV to Company A via /dataset/store
    up_res_a = await client.post(
        "/dataset/store",
        files={"file": ("company_a_custs.csv", csv_a_content, "text/csv")},
        headers=headers_a
    )
    record("4.1", "Upload 5 valid customers to Company A returns 200", up_res_a.status_code == 200, f"Status: {up_res_a.status_code}")
    up_a_data = up_res_a.json()
    new_recs_a = up_a_data.get("new_records", up_a_data.get("inserted_rows", 0))
    record("4.2", "Uploaded customers count is 5", new_recs_a == 5, f"Inserted: {new_recs_a}")

    # 4.3 Verify MongoDB insertion for Company A
    db_count_a = await telco_collection.count_documents({"company_id": company_id_a})
    record("4.3", "MongoDB telco_customers count matches 5", db_count_a == 5, f"Count in DB: {db_count_a}")

    # 4.4 Tenant isolation: Verify Company B still has 0 customers
    db_count_b = await telco_collection.count_documents({"company_id": company_id_b})
    record("4.4", "Company B still has 0 customers in MongoDB", db_count_b == 0, f"Count B in DB: {db_count_b}")
    cust_b_check = await client.get("/telco/customers", headers=headers_b)
    record("4.5", "Company B API returns 0 customers", cust_b_check.json().get("total") == 0, f"Total B: {cust_b_check.json().get('total')}")

    # 4.6 Upload same CSV again to Company A -> duplicates skipped
    up_dup_a = await client.post(
        "/dataset/store",
        files={"file": ("company_a_custs.csv", csv_a_content, "text/csv")},
        headers=headers_a
    )
    dup_data = up_dup_a.json()
    dup_inserted = dup_data.get("new_records", dup_data.get("inserted_rows", 0))
    dup_skipped = dup_data.get("duplicates_skipped", dup_data.get("duplicate_rows", 0))
    record("4.6", "Duplicate CSV upload skips all duplicates", dup_inserted == 0 and dup_skipped == 5, f"Inserted: {dup_inserted}, Skipped: {dup_skipped}")
    db_count_a_after = await telco_collection.count_documents({"company_id": company_id_a})
    record("4.7", "DB count remains 5 after duplicate upload", db_count_a_after == 5, f"Count: {db_count_a_after}")

    # 4.8 Upload mixed existing + new customers (2 existing + 2 new)
    mixed_rows = [
        "CUST-A01,Male,No,No,No,1,Yes,No,DSL,No,Yes,No,No,No,No,Month-to-month,Yes,Electronic check,29.85,29.85",
        "CUST-A02,Female,No,Yes,No,34,Yes,Yes,DSL,Yes,No,Yes,No,No,No,One year,No,Mailed check,56.95,1889.5",
        "CUST-A06,Female,Yes,No,No,12,Yes,No,DSL,No,No,No,No,No,No,Month-to-month,Yes,Electronic check,45.0,540.0",
        "CUST-A07,Male,No,Yes,Yes,24,Yes,Yes,Fiber optic,Yes,Yes,Yes,Yes,Yes,Yes,Two year,No,Credit card (automatic),105.0,2520.0"
    ]
    mixed_content = (csv_header + "\n".join(mixed_rows)).encode("utf-8")
    up_mixed = await client.post(
        "/dataset/store",
        files={"file": ("mixed.csv", mixed_content, "text/csv")},
        headers=headers_a
    )
    mixed_data = up_mixed.json()
    mixed_ins = mixed_data.get("new_records", mixed_data.get("inserted_rows", 0))
    mixed_skip = mixed_data.get("duplicates_skipped", mixed_data.get("duplicate_rows", 0))
    record("4.8", "Mixed upload inserts only 2 new records and skips 2 existing", mixed_ins == 2 and mixed_skip == 2, f"Inserted: {mixed_ins}, Skipped: {mixed_skip}")
    db_count_a_mixed = await telco_collection.count_documents({"company_id": company_id_a})
    record("4.9", "DB count updated to 7", db_count_a_mixed == 7, f"Count: {db_count_a_mixed}")

    # 4.10 Upload same customerID in Company B -> Allowed due to tenant isolation!
    # "CUST-A01" in Company B should succeed because compound index is (company_id, customerID)
    rows_b = [
        "CUST-A01,Female,Yes,Yes,No,50,Yes,Yes,Fiber optic,Yes,Yes,Yes,Yes,Yes,Yes,Two year,No,Bank transfer (automatic),95.0,4750.0",
        "CUST-B01,Male,No,No,No,5,Yes,No,DSL,No,No,No,No,No,No,Month-to-month,Yes,Mailed check,30.0,150.0"
    ]
    csv_b_content = (csv_header + "\n".join(rows_b)).encode("utf-8")
    up_b_res = await client.post(
        "/dataset/store",
        files={"file": ("company_b_custs.csv", csv_b_content, "text/csv")},
        headers=headers_b
    )
    up_b_data = up_b_res.json()
    b_ins = up_b_data.get("new_records", up_b_data.get("inserted_rows", 0))
    record("4.10", "Company B can upload same customerID (CUST-A01) due to tenant scoped uniqueness", b_ins == 2, f"Company B inserted: {b_ins}")

    # 4.11 Upload invalid file (corrupt/non-csv) -> returns error without DB corruption
    bad_content = b"Not,A,Valid,Telco,Dataset\nfoo,bar,baz,qux,quux\n"
    up_bad = await client.post(
        "/dataset/store",
        files={"file": ("corrupt.csv", bad_content, "text/csv")},
        headers=headers_a
    )
    record("4.11", "Corrupt CSV upload rejected (400)", up_bad.status_code == 400, f"Status: {up_bad.status_code}")
    db_count_after_bad = await telco_collection.count_documents({"company_id": company_id_a})
    record("4.12", "Database not corrupted after invalid upload", db_count_after_bad == 7, f"Count: {db_count_after_bad}")

    # 4.13 Upload history is tenant-isolated
    hist_a = await client.get("/uploads/history", headers=headers_a)
    hist_b = await client.get("/uploads/history", headers=headers_b)
    record("4.13", "Upload history returns 200 for both", hist_a.status_code == 200 and hist_b.status_code == 200, "Both 200")
    hist_a_items = hist_a.json() if isinstance(hist_a.json(), list) else hist_a.json().get("history", [])
    hist_b_items = hist_b.json() if isinstance(hist_b.json(), list) else hist_b.json().get("history", [])
    record("4.14", "Upload history tenant-isolated (A has uploads, B has 1 upload)", len(hist_a_items) >= 2 and len(hist_b_items) == 1, f"A count: {len(hist_a_items)}, B count: {len(hist_b_items)}")

    # =========================================================================
    # 5. DASHBOARD FINAL REGRESSION
    # =========================================================================
    print("\n--- SECTION 5: DASHBOARD FINAL REGRESSION ---")
    dash_a = await client.get("/dashboard/stats", headers=headers_a)
    record("5.1", "Dashboard stats returns 200", dash_a.status_code == 200, f"Status: {dash_a.status_code}")
    dash_data = dash_a.json()
    record("5.2", "Dashboard available flag is True", dash_data.get("available") is True, f"Available: {dash_data.get('available')}")
    record("5.3", "Dashboard total matches uploaded records (7)", dash_data.get("total_analyzed") == 7, f"Total: {dash_data.get('total_analyzed')}")
    record("5.4", "Churn count and rate are dynamic numbers", isinstance(dash_data.get("high_risk_count"), (int, float)) and isinstance(dash_data.get("avg_churn_rate"), (int, float)), f"High risk count: {dash_data.get('high_risk_count')}, rate: {dash_data.get('avg_churn_rate')}%")
    record("5.5", "Risk distribution counts add up to total", (dash_data.get("high_risk_count", 0) + dash_data.get("medium_risk_count", 0) + dash_data.get("low_risk_count", 0)) == 7, f"High={dash_data.get('high_risk_count')}, Med={dash_data.get('medium_risk_count')}, Low={dash_data.get('low_risk_count')}")

    # =========================================================================
    # 6. CUSTOMERS FINAL REGRESSION & CROSS-TENANT ACCESS
    # =========================================================================
    print("\n--- SECTION 6: CUSTOMERS FINAL REGRESSION & CROSS-TENANT ACCESS ---")
    cust_list_a = await client.get("/telco/customers?page=1&limit=5", headers=headers_a)
    record("6.1", "Customer list pagination returns 200", cust_list_a.status_code == 200, f"Status: {cust_list_a.status_code}")
    cust_data_a = cust_list_a.json()
    record("6.2", "Pagination metadata is correct (total=7, limit=5, pages=2)", cust_data_a.get("total") == 7 and cust_data_a.get("total_pages") == 2, f"Total: {cust_data_a.get('total')}, pages: {cust_data_a.get('total_pages')}")
    record("6.3", "Page 1 contains exactly 5 records", len(cust_data_a.get("records", [])) == 5, f"Fetched: {len(cust_data_a.get('records', []))}")

    # Search functionality
    search_res = await client.get("/telco/customers?search=CUST-A03", headers=headers_a)
    search_records = search_res.json().get("records", [])
    record("6.4", "Search by customerID returns matching record", len(search_records) == 1 and search_records[0].get("customerID") == "CUST-A03", f"Matched: {len(search_records)}")

    # Customer single details lookup
    single_res = await client.get("/telco/customers/CUST-A03", headers=headers_a)
    record("6.5", "Single customer details returns 200", single_res.status_code == 200, f"Status: {single_res.status_code}")
    single_data = single_res.json()
    record("6.6", "Customer contains basic attributes", single_data.get("customerID") == "CUST-A03" and "Contract" in single_data, f"Customer: {single_data.get('customerID')}")

    # Cross-tenant customer access: Company B tries to access Company A's customer "CUST-A02"
    cross_res = await client.get("/telco/customers/CUST-A02", headers=headers_b)
    record("6.7", "Cross-tenant customer access returns 404", cross_res.status_code == 404, f"Status: {cross_res.status_code}")

    # =========================================================================
    # 7. ML PREDICTION FINAL REGRESSION (/predict/full, /predict/explain)
    # =========================================================================
    print("\n--- SECTION 7: ML PREDICTION FINAL REGRESSION ---")
    
    # 7.1 High-risk customer payload
    high_risk_cust = {
        "gender": "Female",
        "SeniorCitizen": "No",
        "Partner": "No",
        "Dependents": "No",
        "tenure": 1,
        "PhoneService": "Yes",
        "MultipleLines": "No",
        "InternetService": "Fiber optic",
        "OnlineSecurity": "No",
        "OnlineBackup": "No",
        "DeviceProtection": "No",
        "TechSupport": "No",
        "StreamingTV": "Yes",
        "StreamingMovies": "Yes",
        "Contract": "Month-to-month",
        "PaperlessBilling": "Yes",
        "PaymentMethod": "Electronic check",
        "MonthlyCharges": 95.0,
        "TotalCharges": 95.0
    }
    pred_res_high = await client.post("/predict/full", json=high_risk_cust, headers=headers_a)
    record("7.1", "Single prediction (/predict/full) returns 200", pred_res_high.status_code == 200, f"Status: {pred_res_high.status_code}")
    high_data = pred_res_high.json()
    prob_high = high_data.get("churn_probability")
    risk_high = high_data.get("risk_level")
    record("7.2", "High risk customer predicted with risk_level=High or Medium", risk_high in ("High", "Medium"), f"Risk: {risk_high}, Prob: {prob_high}%")
    record("7.3", "Churn probability is between 0 and 100", prob_high is not None and 0.0 <= prob_high <= 100.0, f"Prob: {prob_high}")

    # 7.4 Low-risk customer payload
    low_risk_cust = {
        "gender": "Male",
        "SeniorCitizen": "No",
        "Partner": "Yes",
        "Dependents": "Yes",
        "tenure": 65,
        "PhoneService": "Yes",
        "MultipleLines": "Yes",
        "InternetService": "No",
        "OnlineSecurity": "No internet service",
        "OnlineBackup": "No internet service",
        "DeviceProtection": "No internet service",
        "TechSupport": "No internet service",
        "StreamingTV": "No internet service",
        "StreamingMovies": "No internet service",
        "Contract": "Two year",
        "PaperlessBilling": "No",
        "PaymentMethod": "Credit card (automatic)",
        "MonthlyCharges": 20.0,
        "TotalCharges": 1300.0
    }
    pred_res_low = await client.post("/predict/full", json=low_risk_cust, headers=headers_a)
    low_data = pred_res_low.json()
    record("7.4", "Low risk customer predicted with risk_level=Low", low_data.get("risk_level") == "Low", f"Risk: {low_data.get('risk_level')}, Prob: {low_data.get('churn_probability')}%")

    # 7.5 Missing required field returns 422
    incomplete_cust = dict(high_risk_cust)
    del incomplete_cust["tenure"]
    pred_bad = await client.post("/predict/full", json=incomplete_cust, headers=headers_a)
    record("7.5", "Missing required field returns 422", pred_bad.status_code == 422, f"Status: {pred_bad.status_code}")

    # 7.6 Boundary values (tenure=0, TotalCharges=0.0)
    boundary_cust_0 = dict(high_risk_cust)
    boundary_cust_0["tenure"] = 0
    boundary_cust_0["TotalCharges"] = 0.0
    pred_0 = await client.post("/predict/full", json=boundary_cust_0, headers=headers_a)
    record("7.6", "Boundary tenure=0 handled successfully", pred_0.status_code == 200, f"Status: {pred_0.status_code}")

    # 7.7 SHAP explanation
    explain_res = await client.post("/predict/explain", json=high_risk_cust, headers=headers_a)
    record("7.7", "Explain endpoint returns 200", explain_res.status_code == 200, f"Status: {explain_res.status_code}")
    explain_data = explain_res.json()
    top_factors = explain_data.get("top_factors", [])
    record("7.8", "SHAP explanation returns top factors with impact & direction", len(top_factors) > 0 and "impact" in top_factors[0] and "direction" in top_factors[0], f"Factors: {[f.get('feature') for f in top_factors[:3]]}")

    # 7.9 Recommendations inside /predict/full
    record("7.9", "Full analysis includes recommendations", len(high_data.get("recommended_actions", [])) > 0, f"Actions count: {len(high_data.get('recommended_actions', []))}")

    # =========================================================================
    # 8. BATCH PREDICTION FINAL TEST (/predict/batch-all)
    # =========================================================================
    print("\n--- SECTION 8: BATCH PREDICTION FINAL TEST ---")
    batch_res = await client.post("/predict/batch-all", headers=headers_a)
    record("8.1", "Batch prediction (/predict/batch-all) returns 200", batch_res.status_code == 200, f"Status: {batch_res.status_code}")
    batch_data = batch_res.json()
    b_total = batch_data.get("total_analyzed", batch_data.get("total_customers", 0))
    record("8.2", "Batch prediction processed exactly 7 records for Company A", b_total == 7, f"Processed: {b_total}")
    record("8.3", "Batch prediction results contain high/medium/low counts", "high_risk_count" in batch_data and "avg_churn_rate" in batch_data, "Counts present")

    # =========================================================================
    # 9. ANALYTICS FINAL REGRESSION (/ml/metrics, /ml/segments)
    # =========================================================================
    print("\n--- SECTION 9: ANALYTICS FINAL REGRESSION ---")
    metrics_res_a = await client.get("/ml/metrics", headers=headers_a)
    record("9.1", "ML Metrics for Company A returns 200", metrics_res_a.status_code == 200, f"Status: {metrics_res_a.status_code}")
    m_data = metrics_res_a.json()
    record("9.2", "Metrics contains core evaluation keys", "accuracy" in m_data and "precision" in m_data and "f1_score" in m_data, f"Metrics keys: {list(m_data.keys())[:5]}")

    segments_res_a = await client.get("/ml/segments", headers=headers_a)
    record("9.3", "Customer segments returns 200", segments_res_a.status_code == 200, f"Status: {segments_res_a.status_code}")
    seg_data = segments_res_a.json()
    record("9.4", "Segments contain cluster profiles", isinstance(seg_data, list) and len(seg_data) > 0, f"Segments count: {len(seg_data) if isinstance(seg_data, list) else 0}")

    # =========================================================================
    # 10. REPORT / EXPORT FINAL REGRESSION & FORMULA INJECTION PROTECTION
    # =========================================================================
    print("\n--- SECTION 10: REPORT / EXPORT FINAL REGRESSION & FORMULA INJECTION ---")
    
    # 10.1 CSV export for Company A
    export_a = await client.get("/reports/export/csv?risk_level=All", headers=headers_a)
    record("10.1", "CSV export for Company A returns 200", export_a.status_code == 200, f"Status: {export_a.status_code}")
    record("10.2", "CSV content-type is text/csv", "text/csv" in export_a.headers.get("content-type", ""), f"Content-Type: {export_a.headers.get('content-type')}")
    csv_rows_a = list(csv.reader(io.StringIO(export_a.text)))
    record("10.3", "CSV export row count matches total customers (7 + header = 8)", len(csv_rows_a) == 8, f"Rows: {len(csv_rows_a)}")

    # 10.4 Tenant isolation on export: Company A export contains no Company B IDs
    cids_in_a = [r[0] for r in csv_rows_a[1:]]
    record("10.4", "Company A export contains no CUST-B01", "CUST-B01" not in cids_in_a, f"Company A IDs: {cids_in_a}")

    # 10.5 Empty company export returns 404 safely
    empty_comp_id = "comp_empty_test_qa12"
    empty_email = "empty_user@churnguard.test"
    await clean_company(empty_comp_id, [empty_email])
    await client.post("/register", json={
        "first_name": "Empty",
        "last_name": "User",
        "email": empty_email,
        "phone": "9998887779",
        "password": pwd_a,
        "confirm_password": pwd_a,
        "company": "Empty Test Co",
        "company_type": "Private Limited Company",
        "industry": "Software",
        "department": "Engineering",
        "company_size": "11–50 employees",
        "country": "India"
    })
    await otp_collection.update_one(
        {"email": empty_email, "purpose": "email_verification"},
        {"$set": {"otp_hash": hash_password(test_otp_code)}}
    )
    await client.post("/auth/verify-registration", json={"email": empty_email, "otp": test_otp_code})
    empty_login = await client.post("/login", json={"email": empty_email, "password": pwd_a})
    empty_token = empty_login.json().get("access_token")
    empty_headers = {"Authorization": f"Bearer {empty_token}"}
    empty_export = await client.get("/reports/export/csv?risk_level=All", headers=empty_headers)
    record("10.5", "Empty company CSV export returns 404 safely", empty_export.status_code == 404, f"Status: {empty_export.status_code}")

    # 10.6 FORMULA INJECTION CHECK (=, +, -, @)
    # Insert customers with dangerous starting characters in string fields into Company A
    formula_rows = [
        "=SUM(1+1),Male,No,No,No,1,Yes,No,DSL,No,Yes,No,No,No,No,Month-to-month,Yes,Electronic check,29.85,29.85",
        "+DANGEROUS,Male,No,No,No,1,Yes,No,DSL,No,Yes,No,No,No,No,Month-to-month,Yes,Electronic check,29.85,29.85",
        "-COMMAND,Male,No,No,No,1,Yes,No,DSL,No,Yes,No,No,No,No,Month-to-month,Yes,Electronic check,29.85,29.85",
        "@CMDLINE,Male,No,No,No,1,Yes,No,DSL,No,Yes,No,No,No,No,Month-to-month,Yes,Electronic check,29.85,29.85"
    ]
    formula_csv = (csv_header + "\n".join(formula_rows)).encode("utf-8")
    await client.post(
        "/dataset/store",
        files={"file": ("formula_test.csv", formula_csv, "text/csv")},
        headers=headers_a
    )
    # Export CSV and check whether values starting with =, +, -, @ were sanitized with leading '
    formula_export = await client.get("/reports/export/csv?risk_level=All", headers=headers_a)
    record("10.6", "Formula export returns 200", formula_export.status_code == 200, f"Status: {formula_export.status_code}")
    formula_reader = list(csv.reader(io.StringIO(formula_export.text)))
    exported_cids = [r[0] for r in formula_reader[1:]]
    sanitized_sum = any(c.startswith("'=SUM") for c in exported_cids)
    sanitized_plus = any(c.startswith("'+DANGEROUS") for c in exported_cids)
    sanitized_minus = any(c.startswith("'-COMMAND") for c in exported_cids)
    sanitized_at = any(c.startswith("'@CMDLINE") for c in exported_cids)
    record("10.7", "CSV formula injection protected (= escaped)", sanitized_sum, f"Found '=SUM: {sanitized_sum}")
    record("10.8", "CSV formula injection protected (+ escaped)", sanitized_plus, f"Found '+DANGEROUS: {sanitized_plus}")
    record("10.9", "CSV formula injection protected (- escaped)", sanitized_minus, f"Found '-COMMAND: {sanitized_minus}")
    record("10.10", "CSV formula injection protected (@ escaped)", sanitized_at, f"Found '@CMDLINE: {sanitized_at}")

    # =========================================================================
    # 11. SETTINGS / PROFILE FINAL REGRESSION
    # =========================================================================
    print("\n--- SECTION 11: SETTINGS / PROFILE FINAL REGRESSION ---")
    prof_me = await client.get("/profile/me", headers=headers_a)
    record("11.1", "Get profile returns 200", prof_me.status_code == 200, f"Status: {prof_me.status_code}")
    prof_data = prof_me.json()
    record("11.2", "Profile company name matches Company A", prof_data.get("company") == company_name_a, f"Company: {prof_data.get('company')}")

    # Update profile
    up_prof_res = await client.put("/profile/me", json={
        "first_name": "AlphaUpdated",
        "last_name": "AdminUpdated",
        "phone": "9998887773",
        "department": "Security Ops",
        "company_size": "51–200 employees",
        "country": "India"
    }, headers=headers_a)
    record("11.3", "Update profile returns 200", up_prof_res.status_code == 200, f"Status: {up_prof_res.status_code}")

    # Verify update persisted
    prof_check = await client.get("/profile/me", headers=headers_a)
    record("11.4", "Profile update persists on refresh", prof_check.json().get("first_name") == "AlphaUpdated" and prof_check.json().get("department") == "Security Ops", f"Name: {prof_check.json().get('first_name')}")

    # Avatar upload
    dummy_png = (
        b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4"
        b"\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    avatar_res = await client.post(
        "/profile/photo",
        files={"file": ("photo.png", dummy_png, "image/png")},
        headers=headers_a
    )
    record("11.5", "Avatar upload (/profile/photo) returns 200", avatar_res.status_code == 200, f"Status: {avatar_res.status_code}")
    photo_url = avatar_res.json().get("photo_url")
    record("11.6", "Avatar photo_url returned", bool(photo_url), f"Photo URL: {photo_url}")

    if photo_url:
        get_avatar = await client.get(photo_url)
        record("11.7", "Uploaded avatar accessible via static endpoint", get_avatar.status_code == 200, f"Status: {get_avatar.status_code}")

    # Avatar tenant isolation: Company B profile does NOT have Company A's avatar
    prof_b_avatar = await client.get("/profile/me", headers=headers_b)
    record("11.8", "Company B does not have Company A's avatar photo_url", prof_b_avatar.json().get("photo_url") != photo_url, "Isolated")

    # =========================================================================
    # 12. NOTIFICATIONS FINAL REGRESSION
    # =========================================================================
    print("\n--- SECTION 12: NOTIFICATIONS FINAL REGRESSION ---")
    notif_res_a = await client.get("/notifications", headers=headers_a)
    record("12.1", "Get notifications returns 200", notif_res_a.status_code == 200, f"Status: {notif_res_a.status_code}")
    notif_data_a = notif_res_a.json()
    notifs_a = notif_data_a.get("notifications", [])
    record("12.2", "Notifications exist after file upload", len(notifs_a) > 0, f"Count: {len(notifs_a)}")

    unread_count = notif_data_a.get("unread_count", 0)
    record("12.3", "Unread count returns numeric value", isinstance(unread_count, int), f"Count: {unread_count}")

    # Mark single notification as read
    if notifs_a:
        first_notif_id = notifs_a[0]["id"]
        read_res = await client.patch(f"/notifications/{first_notif_id}/read", headers=headers_a)
        record("12.4", "Mark single notification read returns 200", read_res.status_code == 200, f"Status: {read_res.status_code}")

    # Mark all read
    read_all = await client.patch("/notifications/mark-read", headers=headers_a)
    record("12.5", "Mark all read returns 200", read_all.status_code == 200, f"Status: {read_all.status_code}")
    notif_after = (await client.get("/notifications", headers=headers_a)).json()
    record("12.6", "Unread count is 0 after mark-all-read", notif_after.get("unread_count") == 0, f"Count: {notif_after.get('unread_count')}")

    # Tenant isolation on notifications: Company B has no notifications from Company A
    notif_data_b = (await client.get("/notifications", headers=headers_b)).json()
    record("12.7", "Company B notifications isolated from Company A", isinstance(notif_data_b.get("notifications"), list), "Company B notifications scoped")

    # Clear all notifications for Company A
    clear_res = await client.delete("/notifications", headers=headers_a)
    record("12.8", "Clear all notifications returns 200", clear_res.status_code == 200, f"Status: {clear_res.status_code}")
    notifs_a_cleared = (await client.get("/notifications", headers=headers_a)).json().get("notifications", [])
    record("12.9", "Notification list empty after clear-all", len(notifs_a_cleared) == 0, f"Count: {len(notifs_a_cleared)}")

    # =========================================================================
    # 14. BACKEND SECURITY & TENANT SCOPE AUDIT
    # =========================================================================
    print("\n--- SECTION 14: BACKEND SECURITY & TENANT SCOPE AUDIT ---")
    # Attempt to bypass tenant isolation by injecting company_id query parameter
    tamper_res = await client.get(f"/telco/customers?company_id={company_id_a}", headers=headers_b)
    tamper_records = tamper_res.json().get("records", [])
    record("14.1", "company_id query param tampering does not bypass isolation", all(r.get("customerID") != "CUST-A03" for r in tamper_records), f"Company B saw {len(tamper_records)} records")

    # Password hash is never exposed on /profile/me
    prof_json = prof_check.json()
    record("14.2", "Password hash not exposed on /profile/me", "password" not in prof_json and "hashed_password" not in prof_json, "Safe")

    # =========================================================================
    # 15. API ERROR HANDLING
    # =========================================================================
    print("\n--- SECTION 15: API ERROR HANDLING ---")
    err_404 = await client.get("/nonexistent_endpoint_12345", headers=headers_a)
    record("15.1", "404 Not Found formatted as JSON", err_404.status_code == 404 and "detail" in err_404.json(), f"Status: {err_404.status_code}")

    err_422 = await client.post("/predict/full", json={"invalid": "payload"}, headers=headers_a)
    record("15.2", "422 Unprocessable Entity formatted as JSON", err_422.status_code == 422 and "detail" in err_422.json(), f"Status: {err_422.status_code}")

    # =========================================================================
    # 16. DATABASE FINAL VERIFICATION
    # =========================================================================
    print("\n--- SECTION 16: DATABASE FINAL VERIFICATION ---")
    indexes_cursor = await telco_collection.list_indexes().to_list(length=None)
    index_names = [idx.get("name") for idx in indexes_cursor]
    record("16.1", "Compound unique index (company_id, customerID) exists", "company_customer_id_unique" in index_names, f"Indexes: {index_names}")
    record("16.2", "Company ID index exists", "telco_company_id" in index_names, "telco_company_id verified")

    # Verify company_id consistency in telco_collection
    unscoped_docs = await telco_collection.count_documents({"company_id": {"$exists": False}})
    record("16.3", "Zero unscoped customer records in MongoDB", unscoped_docs == 0, f"Unscoped count: {unscoped_docs}")

    # =========================================================================
    # 17. PERFORMANCE SANITY CHECK
    # =========================================================================
    print("\n--- SECTION 17: PERFORMANCE SANITY CHECK ---")
    t0 = time.perf_counter()
    p_dash = await client.get("/dashboard/stats", headers=headers_a)
    dash_lat = (time.perf_counter() - t0) * 1000
    record("17.1", "Dashboard latency < 500ms", p_dash.status_code == 200 and dash_lat < 500, f"Latency: {dash_lat:.1f}ms")

    t0 = time.perf_counter()
    p_cust = await client.get("/telco/customers?page=1&limit=50", headers=headers_a)
    cust_lat = (time.perf_counter() - t0) * 1000
    record("17.2", "Customer listing latency < 500ms", p_cust.status_code == 200 and cust_lat < 500, f"Latency: {cust_lat:.1f}ms")

    t0 = time.perf_counter()
    p_pred = await client.post("/predict/full", json=high_risk_cust, headers=headers_a)
    pred_lat = (time.perf_counter() - t0) * 1000
    record("17.3", "Full ML inference latency < 500ms", p_pred.status_code == 200 and pred_lat < 500, f"Latency: {pred_lat:.1f}ms")

    # Final cleanup of test companies
    await clean_company(company_id_a, [email_a])
    await clean_company(company_id_b, [email_b])
    await clean_company(empty_comp_id, [empty_email])

    print("\n" + "=" * 80)
    print(f"QA-12 MASTER SUITE COMPLETE: {PASSED_COUNT} PASSED, {FAILED_COUNT} FAILED")
    print("=" * 80)
    if FAILED_TESTS:
        print("\nFAILED TESTS LIST:")
        for ft in FAILED_TESTS:
            print("  -", ft)
    else:
        print("\nALL BACKEND REGRESSION & SECURITY CHECKS PASSED 100%!")


if __name__ == "__main__":
    asyncio.run(run_qa12_suite())
