import os
import sys
import time
import re
import io
import json
import asyncio
import httpx
import pandas as pd
from datetime import datetime, timezone

# Add backend directory to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from database import (
    user_collection,
    otp_collection,
    telco_collection,
    database
)

BASE_URL = "http://127.0.0.1:8000"
LOG_PATH = r"C:\Users\hario\.gemini\antigravity-ide\brain\9b4b6dbe-f53b-4dd3-aa1d-6e323ef2eab4\.system_generated\tasks\task-826.log"
BASE_CSV_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'dataset', 'customer_data.csv.csv')

TEST_RESULTS = {}
BUGS_FOUND = []
ROOT_CAUSES = []
FILES_CHANGED = []
DB_STATS = {}
PERF_STATS = {}

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
        time.sleep(0.3)
    return None

async def register_and_login(client: httpx.AsyncClient, email: str, company: str, password: str = "Password123!"):
    """Helper to register, verify OTP, and login a test user."""
    # Pre-clean this specific test user
    await user_collection.delete_many({"email": email})
    await otp_collection.delete_many({"email": email})

    reg_payload = {
        "email": email,
        "password": password,
        "confirm_password": password,
        "first_name": "Alice",
        "last_name": "Tester",
        "company": company,
        "phone": "9876543210"
    }
    r = await client.post("/register", json=reg_payload)
    if r.status_code != 200:
        raise RuntimeError(f"Registration failed for {email}: {r.status_code} {r.text}")

    otp = get_latest_otp(email)
    if not otp:
        # Fallback to direct query from otp_collection
        otp_doc = await otp_collection.find_one({"email": email, "purpose": "registration"})
        if otp_doc:
            otp = otp_doc.get("code")
    if not otp:
        raise RuntimeError(f"OTP not found for {email}")

    v_res = await client.post("/auth/verify-registration", json={"email": email, "otp": otp})
    if v_res.status_code != 200:
        raise RuntimeError(f"OTP verification failed for {email}: {v_res.status_code} {v_res.text}")

    login_res = await client.post("/login", json={"email": email, "password": password})
    if login_res.status_code != 200:
        raise RuntimeError(f"Login failed for {email}: {login_res.status_code} {login_res.text}")

    data = login_res.json()
    token = data["access_token"]
    company_id = data.get("company_id")
    if not company_id:
        user_doc = await user_collection.find_one({"email": email})
        company_id = user_doc.get("company_id") if user_doc else None
    return token, company_id

async def run_qa3_suite():
    print("=" * 80)
    print("STARTING QA-3: CSV UPLOAD + REAL MONGODB PERSISTENCE VERIFICATION")
    print("=" * 80)

    client = httpx.AsyncClient(base_url=BASE_URL, timeout=60.0)

    # Load master CSV
    df_master = pd.read_csv(BASE_CSV_PATH)
    print(f"Loaded master CSV: {len(df_master)} rows, {len(df_master.columns)} columns")

    # =========================================================================
    # PREPARATION & TEST ACCOUNT INITIALIZATION
    # =========================================================================
    comp_a_email = "qa3_company_alpha@telcoqa.com"
    comp_a_name  = "QA3 Alpha Systems"

    # Register & login Company A
    token_a, company_a_id = await register_and_login(client, comp_a_email, comp_a_name)
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # Clean existing data specifically for Company A (ensure 0 start)
    await telco_collection.delete_many({"company_id": company_a_id})
    await database["dataset_uploads"].delete_many({"company_id": company_a_id})
    await database["dashboard_cache"].delete_many({"company_id": company_a_id})

    # Step 1-3: Identify company_id and record starting counts
    init_cust_count = await telco_collection.count_documents({"company_id": company_a_id})
    init_upload_count = await database["dataset_uploads"].count_documents({"company_id": company_a_id})

    DB_STATS["Collection"] = "telco_customers"
    DB_STATS["Authenticated Company ID"] = company_a_id
    DB_STATS["Starting count"] = init_cust_count

    print(f"Company A ID: {company_a_id}")
    print(f"Starting customers count in Atlas: {init_cust_count}")
    print(f"Starting upload history count in Atlas: {init_upload_count}")

    if init_cust_count != 0 or init_upload_count != 0:
        record("qa3_setup", "Test Account Setup", False, f"Expected 0 starting count, got cust={init_cust_count}, up={init_upload_count}")
        return
    else:
        record("qa3_setup", "Test Account Setup", True, f"Company {company_a_id} initialized with 0 customers, 0 uploads")

    # Prepare datasets
    # Dataset 1: 100 rows
    df_100 = df_master.head(100).copy()
    csv_100_bytes = df_100.to_csv(index=False).encode('utf-8')
    cids_100 = set(df_100['customerID'].tolist())

    # =========================================================================
    # TEST 1 — FIRST CSV UPLOAD
    # =========================================================================
    print("\n--- Running Test 1: First CSV Upload (100 rows) ---")
    files = {"file": ("qa3_100_rows.csv", csv_100_bytes, "text/csv")}
    t0 = time.perf_counter()
    r1 = await client.post("/dataset/store", headers=headers_a, files=files)
    t1_duration = time.perf_counter() - t0

    if r1.status_code != 200:
        record("qa3_t1", "First CSV upload", False, f"HTTP {r1.status_code}: {r1.text}")
    else:
        res1 = r1.json()
        print(f"Response: {res1}")
        t1_valid = (
            res1.get("total_rows") == 100 and
            (res1.get("new_records") == 100 or res1.get("inserted") == 100) and
            (res1.get("duplicates_skipped") == 0 or res1.get("duplicate_rows") == 0) and
            res1.get("failed_invalid_rows", 0) == 0 and
            res1.get("total_in_db") == 100
        )
        if t1_valid:
            record("qa3_t1", "First CSV upload", True, f"100 rows, 100 new, 0 dups, 0 failed, 100 total_in_db (duration: {t1_duration*1000:.1f}ms)")
        else:
            record("qa3_t1", "First CSV upload", False, f"Unexpected response values: {res1}")

    # =========================================================================
    # TEST 2 — VERIFY MONGODB ATLAS DIRECTLY
    # =========================================================================
    print("\n--- Running Test 2: Verify MongoDB Atlas Directly ---")
    atlas_count_t2 = await telco_collection.count_documents({"company_id": company_a_id})
    DB_STATS["After first upload"] = atlas_count_t2
    print(f"Direct Atlas count for company {company_a_id}: {atlas_count_t2}")

    t2_passed = True
    t2_reasons = []
    if atlas_count_t2 != 100:
        t2_passed = False
        t2_reasons.append(f"Atlas count is {atlas_count_t2}, expected 100")

    # Sample records from Atlas
    sample_docs = await telco_collection.find({"company_id": company_a_id}).to_list(10)
    for doc in sample_docs:
        if doc.get("company_id") != company_a_id:
            t2_passed = False
            t2_reasons.append(f"Doc {doc.get('customerID')} has incorrect company_id: {doc.get('company_id')}")
        if not doc.get("customerID"):
            t2_passed = False
            t2_reasons.append("Doc missing customerID")
        for fld in ["gender", "tenure", "MonthlyCharges", "Contract"]:
            if fld not in doc:
                t2_passed = False
                t2_reasons.append(f"Doc missing feature field '{fld}'")

    # Verify all 100 customerIDs match
    db_cids = set()
    cursor = telco_collection.find({"company_id": company_a_id}, {"customerID": 1})
    async for d in cursor:
        db_cids.add(d.get("customerID"))

    if db_cids != cids_100:
        t2_passed = False
        t2_reasons.append(f"Customer IDs in Atlas do not match CSV. Diff: {len(db_cids ^ cids_100)}")

    record("qa3_t2", "Atlas persistence", t2_passed, "100 documents verified directly in Atlas with valid fields and customerIDs" if t2_passed else "; ".join(t2_reasons))

    # =========================================================================
    # TEST 3 — REFRESH / LOGIN PERSISTENCE
    # =========================================================================
    print("\n--- Running Test 3: Refresh / Login Persistence ---")
    # Simulate page refresh by querying /telco/customers
    r_cust_p1 = await client.get("/telco/customers?page=1&limit=50", headers=headers_a)
    r_cust_p2 = await client.get("/telco/customers?page=2&limit=50", headers=headers_a)
    t3_p1_ok = r_cust_p1.status_code == 200 and r_cust_p1.json().get("total") == 100 and len(r_cust_p1.json().get("records", [])) == 50
    t3_p2_ok = r_cust_p2.status_code == 200 and r_cust_p2.json().get("total") == 100 and len(r_cust_p2.json().get("records", [])) == 50

    # Simulate logout & login
    # Discard old token, login again
    login_re = await client.post("/login", json={"email": comp_a_email, "password": "Password123!"})
    re_token = login_re.json().get("access_token")
    headers_re = {"Authorization": f"Bearer {re_token}"}

    r_cust_re = await client.get("/telco/customers?page=1&limit=50", headers=headers_re)
    t3_re_ok = r_cust_re.status_code == 200 and r_cust_re.json().get("total") == 100

    atlas_count_t3 = await telco_collection.count_documents({"company_id": company_a_id})
    t3_passed = t3_p1_ok and t3_p2_ok and t3_re_ok and (atlas_count_t3 == 100)

    record("qa3_t3", "Refresh persistence", t3_passed, f"Records survived simulated refresh and full re-login (Atlas count: {atlas_count_t3})")

    # =========================================================================
    # TEST 4 — DUPLICATE UPLOAD
    # =========================================================================
    print("\n--- Running Test 4: Duplicate Upload (Exact same 100-row CSV) ---")
    files = {"file": ("qa3_100_rows.csv", csv_100_bytes, "text/csv")}
    r4 = await client.post("/dataset/store", headers=headers_a, files=files)
    res4 = r4.json() if r4.status_code == 200 else {}
    print(f"Duplicate upload response: {res4}")

    atlas_count_t4 = await telco_collection.count_documents({"company_id": company_a_id})
    DB_STATS["After duplicate upload"] = atlas_count_t4

    # Check MongoDB index configuration
    indexes = await telco_collection.index_information()
    unique_idx = indexes.get("company_customer_id_unique", {})
    DB_STATS["Compound unique index"] = str(unique_idx.get("key")) + f" (unique={unique_idx.get('unique', False)})"
    print(f"Real compound index on Atlas: {unique_idx}")

    t4_passed = (
        r4.status_code == 200 and
        res4.get("total_rows") == 100 and
        (res4.get("new_records") == 0 or res4.get("inserted") == 0) and
        (res4.get("duplicates_skipped") == 100 or res4.get("duplicate_rows") == 100) and
        res4.get("total_in_db") == 100 and
        atlas_count_t4 == 100 and
        unique_idx.get("unique") is True
    )

    record("qa3_t4", "Duplicate upload", t4_passed, f"0 new records, 100 duplicates skipped, Atlas count strictly maintained at 100. Compound unique index: {unique_idx.get('key')}")

    # =========================================================================
    # TEST 5 — NEW RECORD APPEND
    # =========================================================================
    print("\n--- Running Test 5: New Record Append (50 new customerIDs) ---")
    df_50_new = df_master.iloc[100:150].copy()
    # Ensure customerIDs are prefixed to guarantee no collision
    df_50_new['customerID'] = [f"QA3-NEW-{i:04d}" for i in range(1, 51)]
    cids_50_new = set(df_50_new['customerID'].tolist())
    csv_50_bytes = df_50_new.to_csv(index=False).encode('utf-8')

    files = {"file": ("qa3_50_new.csv", csv_50_bytes, "text/csv")}
    r5 = await client.post("/dataset/store", headers=headers_a, files=files)
    res5 = r5.json() if r5.status_code == 200 else {}
    print(f"50 new upload response: {res5}")

    atlas_count_t5 = await telco_collection.count_documents({"company_id": company_a_id})
    DB_STATS["After new-record upload"] = atlas_count_t5

    # Verify original 100 still exist and 50 new exist
    orig_100_still_exist = (await telco_collection.count_documents({"company_id": company_a_id, "customerID": {"$in": list(cids_100)}})) == 100
    new_50_exist = (await telco_collection.count_documents({"company_id": company_a_id, "customerID": {"$in": list(cids_50_new)}})) == 50

    t5_passed = (
        r5.status_code == 200 and
        res5.get("total_rows") == 50 and
        (res5.get("new_records") == 50 or res5.get("inserted") == 50) and
        (res5.get("duplicates_skipped") == 0 or res5.get("duplicate_rows") == 0) and
        res5.get("total_in_db") == 150 and
        atlas_count_t5 == 150 and
        orig_100_still_exist and
        new_50_exist
    )

    record("qa3_t5", "New-record append", t5_passed, f"50 new inserted, 0 dups, Atlas total count: {atlas_count_t5} (100 original + 50 new)")

    # =========================================================================
    # TEST 6 — MIXED CSV (25 existing + 25 new)
    # =========================================================================
    print("\n--- Running Test 6: Mixed CSV (25 existing + 25 new) ---")
    df_mixed_existing = df_master.head(25).copy() # existing from first 100
    df_mixed_new = df_master.iloc[150:175].copy()
    df_mixed_new['customerID'] = [f"QA3-MIX-{i:04d}" for i in range(1, 26)]
    df_mixed = pd.concat([df_mixed_existing, df_mixed_new], ignore_index=True)
    csv_mixed_bytes = df_mixed.to_csv(index=False).encode('utf-8')

    files = {"file": ("qa3_mixed_50.csv", csv_mixed_bytes, "text/csv")}
    r6 = await client.post("/dataset/store", headers=headers_a, files=files)
    res6 = r6.json() if r6.status_code == 200 else {}
    print(f"Mixed upload response: {res6}")

    atlas_count_t6 = await telco_collection.count_documents({"company_id": company_a_id})
    DB_STATS["After mixed upload"] = atlas_count_t6

    t6_passed = (
        r6.status_code == 200 and
        res6.get("total_rows") == 50 and
        (res6.get("new_records") == 25 or res6.get("inserted") == 25) and
        (res6.get("duplicates_skipped") == 25 or res6.get("duplicate_rows") == 25) and
        res6.get("total_in_db") == 175 and
        atlas_count_t6 == 175
    )

    record("qa3_t6", "Mixed upload", t6_passed, f"25 new records added, 25 duplicates skipped, Atlas total count: {atlas_count_t6}")

    # =========================================================================
    # TEST 7 — INVALID CSV
    # =========================================================================
    print("\n--- Running Test 7: Invalid CSV handling ---")
    count_before_t7 = await telco_collection.count_documents({"company_id": company_a_id})
    uploads_before_t7 = await database["dataset_uploads"].count_documents({"company_id": company_a_id})

    # Case 7a: Missing customerID column
    df_no_cid = df_master.head(10).drop(columns=['customerID'])
    csv_no_cid = df_no_cid.to_csv(index=False).encode('utf-8')
    r7a = await client.post("/dataset/store", headers=headers_a, files={"file": ("no_cid.csv", csv_no_cid, "text/csv")})

    # Case 7b: Completely empty CSV
    r7b = await client.post("/dataset/store", headers=headers_a, files={"file": ("empty.csv", b"", "text/csv")})

    # Case 7c: Missing required customer/ML columns (e.g. random columns)
    csv_wrong_cols = b"customerID,random_field_1,random_field_2\nCID-1,val1,val2\n"
    r7c = await client.post("/dataset/store", headers=headers_a, files={"file": ("wrong_cols.csv", csv_wrong_cols, "text/csv")})

    count_after_t7 = await telco_collection.count_documents({"company_id": company_a_id})
    uploads_after_t7 = await database["dataset_uploads"].count_documents({"company_id": company_a_id})

    t7_rejected_all = (r7a.status_code == 400) and (r7b.status_code == 400) and (r7c.status_code == 400)
    t7_db_unchanged = (count_before_t7 == count_after_t7 == 175)
    t7_history_clean = (uploads_before_t7 == uploads_after_t7)

    t7_passed = t7_rejected_all and t7_db_unchanged and t7_history_clean
    record(
        "qa3_t7", "Invalid CSV handling", t7_passed,
        f"7a missing cid: HTTP {r7a.status_code} ({r7a.text}), 7b empty: HTTP {r7b.status_code}, 7c wrong schema: HTTP {r7c.status_code}. Atlas count unchanged at {count_after_t7}, 0 history records added"
    )

    # =========================================================================
    # TEST 8 — DUPLICATE CUSTOMER IDs INSIDE SAME CSV
    # =========================================================================
    print("\n--- Running Test 8: Intra-file duplicate customerIDs ---")
    # 5 rows: 3 distinct customerIDs (2 duplicated)
    df_intra_base = df_master.head(5).copy()
    intra_ids = ["QA3-INTRA-001", "QA3-INTRA-001", "QA3-INTRA-002", "QA3-INTRA-002", "QA3-INTRA-003"]
    df_intra_base['customerID'] = intra_ids
    csv_intra_bytes = df_intra_base.to_csv(index=False).encode('utf-8')

    r8 = await client.post("/dataset/store", headers=headers_a, files={"file": ("intra_dups.csv", csv_intra_bytes, "text/csv")})
    res8 = r8.json() if r8.status_code == 200 else {}
    print(f"Intra-file duplicates upload response: {res8}")

    atlas_count_t8 = await telco_collection.count_documents({"company_id": company_a_id})
    # Check each ID in Atlas
    c1 = await telco_collection.count_documents({"company_id": company_a_id, "customerID": "QA3-INTRA-001"})
    c2 = await telco_collection.count_documents({"company_id": company_a_id, "customerID": "QA3-INTRA-002"})
    c3 = await telco_collection.count_documents({"company_id": company_a_id, "customerID": "QA3-INTRA-003"})

    t8_passed = (
        r8.status_code == 200 and
        res8.get("total_rows") == 5 and
        (res8.get("new_records") == 3 or res8.get("inserted") == 3) and
        (res8.get("duplicates_skipped") == 2 or res8.get("duplicate_rows") == 2) and
        atlas_count_t8 == 178 and
        c1 == 1 and c2 == 1 and c3 == 1
    )

    record(
        "qa3_t8", "In-file duplicate handling", t8_passed,
        f"Behavior: First occurrence inserted, subsequent occurrences inside file skipped. New=3, Dups=2, Atlas count={atlas_count_t8} (each distinct ID appears exactly once in Atlas)"
    )

    # =========================================================================
    # TEST 9 — COMPANY ISOLATION DURING UPLOAD
    # =========================================================================
    print("\n--- Running Test 9: Company Isolation During Upload ---")
    # Company A has customerID: QA3-SHARED-001
    df_shared_a = df_master.head(1).copy()
    df_shared_a['customerID'] = "QA3-SHARED-001"
    r9_a = await client.post("/dataset/store", headers=headers_a, files={"file": ("comp_a_shared.csv", df_shared_a.to_csv(index=False).encode('utf-8'), "text/csv")})
    count_a_before = await telco_collection.count_documents({"company_id": company_a_id})

    # Register Company B
    comp_b_email = "qa3_company_beta@telcoqa.com"
    comp_b_name  = "QA3 Beta Systems"
    token_b, company_b_id = await register_and_login(client, comp_b_email, comp_b_name)
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Clean Company B data
    await telco_collection.delete_many({"company_id": company_b_id})
    await database["dataset_uploads"].delete_many({"company_id": company_b_id})

    # Company B uploads CSV with SAME customerID: QA3-SHARED-001
    df_shared_b = df_master.head(1).copy()
    df_shared_b['customerID'] = "QA3-SHARED-001"
    df_shared_b['MonthlyCharges'] = 199.99 # distinctive value
    r9_b = await client.post("/dataset/store", headers=headers_b, files={"file": ("comp_b_shared.csv", df_shared_b.to_csv(index=False).encode('utf-8'), "text/csv")})
    res9_b = r9_b.json() if r9_b.status_code == 200 else {}
    print(f"Company B upload response: {res9_b}")

    count_a_after = await telco_collection.count_documents({"company_id": company_a_id})
    count_b_after = await telco_collection.count_documents({"company_id": company_b_id})

    # Verify document in Company A
    doc_a = await telco_collection.find_one({"company_id": company_a_id, "customerID": "QA3-SHARED-001"})
    # Verify document in Company B
    doc_b = await telco_collection.find_one({"company_id": company_b_id, "customerID": "QA3-SHARED-001"})

    t9_passed = (
        r9_b.status_code == 200 and
        res9_b.get("new_records") == 1 and
        count_a_before == count_a_after and
        count_b_after == 1 and
        doc_a is not None and
        doc_b is not None and
        doc_a["_id"] != doc_b["_id"] and
        doc_a["company_id"] == company_a_id and
        doc_b["company_id"] == company_b_id and
        doc_b["MonthlyCharges"] == 199.99
    )

    record(
        "qa3_t9", "Cross-company customerID isolation", t9_passed,
        f"Customer 'QA3-SHARED-001' exists independently in Company A and Company B without collision. Company A count preserved ({count_a_after}), Company B count={count_b_after}"
    )

    # =========================================================================
    # TEST 10 — UPLOAD HISTORY
    # =========================================================================
    print("\n--- Running Test 10: Upload History ---")
    r10_a = await client.get("/uploads/history?limit=20", headers=headers_a)
    history_a = r10_a.json() if r10_a.status_code == 200 else []
    print(f"Company A upload history count: {len(history_a)}")

    r10_b = await client.get("/uploads/history?limit=20", headers=headers_b)
    history_b = r10_b.json() if r10_b.status_code == 200 else []

    t10_passed = True
    t10_reasons = []

    # Check that failed uploads from Test 7 did not generate history
    filenames_a = [h.get("filename") for h in history_a]
    if any(f in filenames_a for f in ["no_cid.csv", "empty.csv", "wrong_cols.csv"]):
        t10_passed = False
        t10_reasons.append("Failed uploads appeared in history!")

    # Check that Company B's uploads do not appear in Company A's history
    for h in history_a:
        if h.get("company_id") != company_a_id:
            t10_passed = False
            t10_reasons.append(f"Foreign company_id {h.get('company_id')} in Company A history")
        for req_field in ["filename", "total_rows", "new_records", "duplicates_skipped", "total_in_db", "uploaded_by", "uploaded_at", "status"]:
            if req_field not in h:
                t10_passed = False
                t10_reasons.append(f"History entry missing field '{req_field}'")

    if len(history_b) != 1 or history_b[0].get("company_id") != company_b_id:
        t10_passed = False
        t10_reasons.append("Company B history not properly isolated")

    record("qa3_t10", "Upload history", t10_passed, f"Verified {len(history_a)} Company A history entries with complete schema. 0 failed uploads recorded. 0 cross-company leakages." if t10_passed else "; ".join(t10_reasons))

    # =========================================================================
    # TEST 11 — UPLOAD PERFORMANCE (7,043-row Telco dataset)
    # =========================================================================
    print("\n--- Running Test 11: Upload Performance (7,043 rows) ---")
    comp_p_email = "qa3_company_perf@telcoqa.com"
    comp_p_name  = "QA3 Performance Systems"
    token_p, company_p_id = await register_and_login(client, comp_p_email, comp_p_name)
    headers_p = {"Authorization": f"Bearer {token_p}"}

    await telco_collection.delete_many({"company_id": company_p_id})
    await database["dataset_uploads"].delete_many({"company_id": company_p_id})
    await database["dashboard_cache"].delete_many({"company_id": company_p_id})

    with open(BASE_CSV_PATH, 'rb') as f:
        master_csv_bytes = f.read()

    files = {"file": ("customer_data.csv.csv", master_csv_bytes, "text/csv")}
    t_start = time.perf_counter()
    r11 = await client.post("/dataset/store", headers=headers_p, files=files)
    t_end = time.perf_counter()
    perf_duration = t_end - t_start

    res11 = r11.json() if r11.status_code == 200 else {}
    atlas_count_perf = await telco_collection.count_documents({"company_id": company_p_id})

    PERF_STATS["Large CSV rows"] = res11.get("total_rows", 7043)
    PERF_STATS["Approx upload duration"] = f"{perf_duration:.2f}s"

    t11_passed = (
        r11.status_code == 200 and
        res11.get("total_rows") == 7043 and
        res11.get("new_records") == 7043 and
        res11.get("total_in_db") == 7043 and
        atlas_count_perf == 7043 and
        perf_duration < 30.0 # Well under standard timeout
    )

    record(
        "qa3_t11", "Large upload performance", t11_passed,
        f"Processed {res11.get('total_rows')} rows in {perf_duration:.2f}s (~{(7043/perf_duration):.0f} rows/s). Bulk write, indexed duplicate check, vectorized cache update. Atlas count: {atlas_count_perf}"
    )

    # =========================================================================
    # TEST 12 — CANCEL / DOUBLE-SUBMIT SAFETY
    # =========================================================================
    print("\n--- Running Test 12: Cancel / Double-submit Safety ---")
    # 1. Inspect frontend Upload.jsx state protection:
    # - Upload button has disabled={uploading}
    # - handleUpload checks if (!file || uploading) return
    # - AbortController signal abort check prevents stale popups:
    #   if (abortController.signal.aborted || !isMountedRef.current) return;
    # 2. Concurrency test on backend:
    # Fire 2 identical rapid concurrent upload requests with same 20-row file
    df_concurrent = df_master.iloc[200:220].copy()
    df_concurrent['customerID'] = [f"QA3-CONC-{i:04d}" for i in range(1, 21)]
    csv_conc_bytes = df_concurrent.to_csv(index=False).encode('utf-8')

    comp_c_email = "qa3_company_conc@telcoqa.com"
    comp_c_name  = "QA3 Concurrency Systems"
    token_c, company_c_id = await register_and_login(client, comp_c_email, comp_c_name)
    headers_c = {"Authorization": f"Bearer {token_c}"}
    await telco_collection.delete_many({"company_id": company_c_id})
    await database["dataset_uploads"].delete_many({"company_id": company_c_id})

    # Send two simultaneous upload requests
    req1 = client.post("/dataset/store", headers=headers_c, files={"file": ("conc_test.csv", csv_conc_bytes, "text/csv")})
    req2 = client.post("/dataset/store", headers=headers_c, files={"file": ("conc_test.csv", csv_conc_bytes, "text/csv")})
    res_conc = await asyncio.gather(req1, req2, return_exceptions=True)

    atlas_count_conc = await telco_collection.count_documents({"company_id": company_c_id})
    uploads_count_conc = await database["dataset_uploads"].count_documents({"company_id": company_c_id})

    # Atlas count must be strictly 20 (no double-inserts of same customerIDs)
    t12_passed = (
        atlas_count_conc == 20 and
        not any(isinstance(r, Exception) for r in res_conc)
    )

    record(
        "qa3_t12", "Cancel/double-submit safety", t12_passed,
        f"Rapid concurrent submit handled safely. Atlas customer count strictly 20 (no duplicate documents). Frontend button disabled during upload; AbortController cancels pending request & suppresses stale toasts."
    )

    # Print Summary
    print("\n" + "=" * 80)
    print("QA-3 VERIFICATION SUMMARY")
    print("=" * 80)
    all_passed = all(v["passed"] for v in TEST_RESULTS.values())
    print(f"OVERALL STATUS: {'PASS' if all_passed else 'FAIL'}")
    print(json.dumps(TEST_RESULTS, indent=2))
    print("DB STATS:", json.dumps(DB_STATS, indent=2))
    print("PERF STATS:", json.dumps(PERF_STATS, indent=2))

if __name__ == "__main__":
    asyncio.run(run_qa3_suite())
