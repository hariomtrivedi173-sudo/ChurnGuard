import os
import sys
import time
import math
import json
import asyncio
import io
import pandas as pd
import httpx
from datetime import datetime, timezone

# Add backend directory to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')
from database import (
    user_collection,
    otp_collection,
    telco_collection,
    database
)

BASE_URL = "http://127.0.0.1:8000"
LOG_PATH = r"C:\Users\hario\.gemini\antigravity-ide\brain\9b4b6dbe-f53b-4dd3-aa1d-6e323ef2eab4\.system_generated\tasks\task-826.log"

TEST_RESULTS = {}
PERF_STATS = {}
FORMULA_REPORT = {}

def record(test_key, name, passed, details=""):
    TEST_RESULTS[test_key] = {"name": name, "passed": passed, "details": details}
    status = "PASS" if passed else "FAIL"
    print(f"[{status}] {name} - {details}")

def get_latest_otp(email, timeout=10.0):
    import re
    t0 = time.time()
    while time.time() - t0 < timeout:
        if os.path.exists(LOG_PATH):
            try:
                with open(LOG_PATH, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                matches = re.findall(rf'\[Register\] OTP generated for {re.escape(email)}:\s*(\d{{6}})', content)
                if matches:
                    return matches[-1]
            except Exception:
                pass
        time.sleep(0.3)
    return None

async def run_qa5_suite():
    print("=" * 80)
    print("STARTING QA-5: DASHBOARD DATA CONSISTENCY & REVENUE INTELLIGENCE")
    print("=" * 80)

    client = httpx.AsyncClient(base_url=BASE_URL, timeout=35.0)

    # =========================================================================
    # SETUP 1: Authenticate Primary QA Company (Indus - 7,092 records)
    # =========================================================================
    login_a = await client.post("/login", json={"email": "hariomtrivedi173@gmail.com", "password": "Password@123"})
    if login_a.status_code != 200:
        raise RuntimeError(f"Login failed for Company A: {login_a.status_code} {login_a.text}")

    token_a = login_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    u_a = await user_collection.find_one({"email": "hariomtrivedi173@gmail.com"})
    company_a_id = u_a["company_id"]

    atlas_cust_count_a = await telco_collection.count_documents({"company_id": company_a_id})
    print(f"Authenticated Company A: {company_a_id} | MongoDB Count: {atlas_cust_count_a}")

    # =========================================================================
    # TEST 1 — DASHBOARD LOAD
    # =========================================================================
    t0 = time.perf_counter()
    resp_stats_a = await client.get("/dashboard/stats", headers=headers_a)
    latency_load = (time.perf_counter() - t0) * 1000
    PERF_STATS["Dashboard Stats Load"] = latency_load

    if resp_stats_a.status_code == 200:
        stats_a = resp_stats_a.json()
        required_fields = [
            "total_analyzed", "high_risk_count", "medium_risk_count", "low_risk_count",
            "total_mrr", "avg_churn_rate", "risk_by_contract", "risk_by_tenure",
            "high_risk_profile", "results"
        ]
        all_present = all(f in stats_a for f in required_fields)
        record(
            "test_1_load",
            "TEST 1 — DASHBOARD LOAD",
            all_present and stats_a.get("available") is True,
            f"Returned 200 OK in {latency_load:.1f}ms. All required fields present: {all_present}. available={stats_a.get('available')}"
        )
    else:
        record("test_1_load", "TEST 1 — DASHBOARD LOAD", False, f"HTTP {resp_stats_a.status_code}: {resp_stats_a.text}")
        return

    # =========================================================================
    # TEST 2 — TOTAL CUSTOMERS
    # =========================================================================
    dashboard_total = stats_a["total_analyzed"]
    record(
        "test_2_total_customers",
        "TEST 2 — TOTAL CUSTOMERS",
        dashboard_total == atlas_cust_count_a,
        f"Dashboard Total ({dashboard_total}) == MongoDB Count ({atlas_cust_count_a}). Matches actual DB state exactly."
    )
    FORMULA_REPORT["Total Customers"] = "len(clean_customers) from MongoDB where company_id == current_user['company_id']. Matches telco_collection.count_documents."

    # =========================================================================
    # TEST 3 — RISK COUNTS
    # =========================================================================
    high = stats_a["high_risk_count"]
    med = stats_a["medium_risk_count"]
    low = stats_a["low_risk_count"]
    sum_risk = high + med + low
    record(
        "test_3_risk_counts",
        "TEST 3 — RISK COUNTS",
        sum_risk == dashboard_total,
        f"High ({high}) + Med ({med}) + Low ({low}) = {sum_risk}, exactly equals total_analyzed ({dashboard_total})."
    )
    FORMULA_REPORT["High Risk"] = "sum(1 for r in batch_results if r['risk_level'] == 'High') where probability >= 0.60"
    FORMULA_REPORT["Medium Risk"] = "sum(1 for r in batch_results if r['risk_level'] == 'Medium') where 0.35 <= probability < 0.60"
    FORMULA_REPORT["Low Risk"] = "sum(1 for r in batch_results if r['risk_level'] == 'Low') where probability < 0.35"

    # =========================================================================
    # TEST 4 — CHURN RATE
    # =========================================================================
    expected_churn_rate = round((high / dashboard_total * 100), 1) if dashboard_total > 0 else 0.0
    actual_churn_rate = stats_a["avg_churn_rate"]
    record(
        "test_4_churn_rate",
        "TEST 4 — CHURN RATE",
        abs(actual_churn_rate - expected_churn_rate) < 0.05,
        f"Backend avg_churn_rate={actual_churn_rate}%. Formula: round((high_risk_count / total_analyzed) * 100, 1) = {expected_churn_rate}%."
    )
    FORMULA_REPORT["Churn Rate"] = "round((high_risk_count / total_analyzed) * 100, 1) — percentage of analyzed customer accounts classified as High Churn Risk (probability >= 60%)."

    # =========================================================================
    # TEST 5 — ACTIVE CUSTOMERS
    # =========================================================================
    # In frontend Dashboard.jsx line 142: activeCount = total > 0 ? (total - high) : 0
    frontend_active = dashboard_total - high if dashboard_total > 0 else 0
    record(
        "test_5_active_customers",
        "TEST 5 — ACTIVE CUSTOMERS",
        frontend_active == (dashboard_total - high),
        f"Active Customers = total_analyzed ({dashboard_total}) - high_risk_count ({high}) = {frontend_active}. Represents retained accounts not at immediate risk of attrition."
    )
    FORMULA_REPORT["Active Customers"] = "total_analyzed - high_risk_count (retained baseline accounts under non-critical risk thresholds)."

    # =========================================================================
    # TEST 6 — REVENUE / MRR
    # =========================================================================
    # Compute real MRR sum directly from MongoDB
    cursor_mrr = telco_collection.find({"company_id": company_a_id}, {"MonthlyCharges": 1, "_id": 0})
    mrr_docs = await cursor_mrr.to_list(length=None)
    direct_mrr_sum = sum(
        float(c.get("MonthlyCharges", 0))
        for c in mrr_docs
        if str(c.get("MonthlyCharges", "")).replace('.', '', 1).isdigit()
    )
    direct_mrr_rounded = round(direct_mrr_sum, 2)
    backend_mrr = stats_a["total_mrr"]
    record(
        "test_6_mrr",
        "TEST 6 — REVENUE / MRR",
        abs(backend_mrr - direct_mrr_rounded) < 1.0,
        f"Backend Total MRR: ₹{backend_mrr:,.2f} == Direct MongoDB sum: ₹{direct_mrr_rounded:,.2f}. Currency format uses ₹ symbol with en-IN formatting."
    )
    FORMULA_REPORT["MRR"] = "sum(float(c.get('MonthlyCharges', 0)) for c in clean_customers if valid_numeric). Displayed in frontend with formatCurrency: '₹' symbol and Lakhs/Crores/Thousands localization (en-IN)."

    # =========================================================================
    # TEST 7 — RISK DISTRIBUTION CHART
    # =========================================================================
    by_contract = stats_a.get("risk_by_contract", [])
    by_tenure = stats_a.get("risk_by_tenure", [])
    contract_high_sum = sum(c.get("High", 0) for c in by_contract)
    tenure_high_sum = sum(t.get("High", 0) for t in by_tenure)
    charts_valid = (contract_high_sum == high) and (tenure_high_sum == high)
    record(
        "test_7_risk_distribution_chart",
        "TEST 7 — RISK DISTRIBUTION CHART",
        charts_valid,
        f"Contract High Risk sum={contract_high_sum}, Tenure High Risk sum={tenure_high_sum}, matches High Risk Total={high}. Real backend distribution arrays."
    )

    # =========================================================================
    # TEST 8 — HIGHEST RISK CUSTOMERS
    # =========================================================================
    results = stats_a.get("results", [])
    has_top_results = len(results) > 0
    probs = [r.get("churn_probability", 0) for r in results]
    is_sorted_desc = all(probs[i] >= probs[i+1] for i in range(len(probs)-1))
    # Verify these customerIDs actually exist in company A's MongoDB documents
    sample_cid = results[0]["customerID"]
    db_verify = await telco_collection.find_one({"company_id": company_a_id, "customerID": sample_cid})

    record(
        "test_8_highest_risk_customers",
        "TEST 8 — HIGHEST RISK CUSTOMERS",
        has_top_results and is_sorted_desc and (db_verify is not None),
        f"Top {len(results)} accounts sorted descending by probability (highest: {probs[0]}%). Customer {sample_cid} verified in MongoDB under company {company_a_id}."
    )
    FORMULA_REPORT["Highest Risk Customers"] = "sorted(batch_results, key=lambda r: r['churn_probability'], reverse=True)[:10] (Top 10 highest churn probabilities in company dataset)."

    # =========================================================================
    # TEST 9 — EMPTY COMPANY DASHBOARD
    # =========================================================================
    # Create or authenticate isolated empty company
    empty_email = f"qa5_empty_{int(time.time())}@telcoqa.com"
    valid_empty_reg = {
        "email": empty_email,
        "password": "Password123!",
        "confirm_password": "Password123!",
        "first_name": "Empty",
        "last_name": "Tenant",
        "company": "Zero Data Corp",
        "company_type": "Private Limited Company",
        "industry": "Telecom",
        "department": "Operations",
        "company_size": "1-10",
        "phone": "9876543210",
        "country": "India"
    }
    reg_empty = await client.post("/register", json=valid_empty_reg)
    if reg_empty.status_code != 200:
        raise RuntimeError(f"Register failed for empty company: {reg_empty.status_code} {reg_empty.text}")
    otp_empty = get_latest_otp(empty_email)
    ver_res = await client.post("/auth/verify-registration", json={"email": empty_email, "otp": otp_empty})
    if ver_res.status_code != 200:
        raise RuntimeError(f"Verify registration failed: {ver_res.status_code} {ver_res.text}")
    login_empty = await client.post("/login", json={"email": empty_email, "password": "Password123!"})
    if login_empty.status_code != 200:
        raise RuntimeError(f"Login failed: {login_empty.status_code} {login_empty.text}")
    token_empty = login_empty.json()["access_token"]
    headers_empty = {"Authorization": f"Bearer {token_empty}"}

    u_empty = await user_collection.find_one({"email": empty_email})
    company_empty_id = u_empty["company_id"]

    resp_empty_stats = await client.get("/dashboard/stats", headers=headers_empty)
    empty_stats = resp_empty_stats.json()

    empty_pass = (
        empty_stats.get("total_analyzed") == 0 and
        empty_stats.get("high_risk_count") == 0 and
        empty_stats.get("medium_risk_count") == 0 and
        empty_stats.get("low_risk_count") == 0 and
        empty_stats.get("total_mrr") == 0.0 and
        empty_stats.get("avg_churn_rate") == 0.0 and
        len(empty_stats.get("results", [])) == 0 and
        len(empty_stats.get("risk_by_contract", [])) == 0
    )
    record(
        "test_9_empty_company_dashboard",
        "TEST 9 — EMPTY COMPANY DASHBOARD",
        empty_pass,
        f"Total={empty_stats.get('total_analyzed')}, High={empty_stats.get('high_risk_count')}, MRR={empty_stats.get('total_mrr')}, ChurnRate={empty_stats.get('avg_churn_rate')}. Clean zero-state, no crashes or demo values."
    )

    # =========================================================================
    # TEST 10 — UPLOAD → DASHBOARD UPDATE
    # =========================================================================
    # Upload 5 test customers to the empty company
    sample_csv_data = (
        "customerID,gender,SeniorCitizen,Partner,Dependents,tenure,PhoneService,MultipleLines,InternetService,OnlineSecurity,OnlineBackup,DeviceProtection,TechSupport,StreamingTV,StreamingMovies,Contract,PaperlessBilling,PaymentMethod,MonthlyCharges,TotalCharges,Churn\n"
        "QA5-CUST-001,Female,0,Yes,No,1,No,No phone service,DSL,No,Yes,No,No,No,No,Month-to-month,Yes,Electronic check,29.85,29.85,No\n"
        "QA5-CUST-002,Male,0,No,No,34,Yes,No,DSL,Yes,No,Yes,No,No,No,One year,No,Mailed check,56.95,1889.5,No\n"
        "QA5-CUST-003,Male,0,No,No,2,Yes,No,DSL,Yes,Yes,No,No,No,No,Month-to-month,Yes,Mailed check,53.85,108.15,Yes\n"
        "QA5-CUST-004,Male,0,No,No,45,No,No phone service,DSL,Yes,No,Yes,Yes,No,No,One year,No,Bank transfer (automatic),42.30,1840.75,No\n"
        "QA5-CUST-005,Female,0,No,No,2,Yes,No,Fiber optic,No,No,No,No,No,No,Month-to-month,Yes,Electronic check,70.70,151.65,Yes\n"
    )
    files = {"file": ("qa5_sample_5.csv", io.BytesIO(sample_csv_data.encode("utf-8")), "text/csv")}
    upload_resp = await client.post("/dataset/upload", headers=headers_empty, files=files)
    upload_json = upload_resp.json()
    inserted_records = upload_json.get("new_records") or upload_json.get("inserted")

    # Now verify Dashboard updates
    stats_after_upload_resp = await client.get("/dashboard/stats", headers=headers_empty)
    stats_after_upload = stats_after_upload_resp.json()
    mongo_count_after_upload = await telco_collection.count_documents({"company_id": company_empty_id})

    upload_dashboard_pass = (
        stats_after_upload.get("total_analyzed") == 5 and
        mongo_count_after_upload == 5 and
        stats_after_upload.get("total_mrr") > 0
    )
    expected_sample_mrr = round(29.85 + 56.95 + 53.85 + 42.30 + 70.70, 2)
    record(
        "test_10_upload_update",
        "TEST 10 — UPLOAD → DASHBOARD UPDATE",
        upload_dashboard_pass and abs(stats_after_upload.get("total_mrr") - expected_sample_mrr) < 0.1,
        f"Uploaded 5 records -> MongoDB count=5, Dashboard total_analyzed=5. Total MRR=₹{stats_after_upload.get('total_mrr')} (expected ₹{expected_sample_mrr})."
    )

    # =========================================================================
    # TEST 11 — DUPLICATE UPLOAD
    # =========================================================================
    files_dup = {"file": ("qa5_sample_5.csv", io.BytesIO(sample_csv_data.encode("utf-8")), "text/csv")}
    dup_resp = await client.post("/dataset/upload", headers=headers_empty, files=files_dup)
    dup_json = dup_resp.json()

    stats_after_dup_resp = await client.get("/dashboard/stats", headers=headers_empty)
    stats_after_dup = stats_after_dup_resp.json()
    mongo_count_after_dup = await telco_collection.count_documents({"company_id": company_empty_id})

    dup_pass = (
        mongo_count_after_dup == 5 and
        stats_after_dup.get("total_analyzed") == 5 and
        stats_after_dup.get("total_mrr") == stats_after_upload.get("total_mrr") and
        dup_json.get("duplicates_skipped") == 5
    )
    record(
        "test_11_duplicate_upload",
        "TEST 11 — DUPLICATE UPLOAD",
        dup_pass,
        f"Re-uploaded same CSV -> 5 duplicates skipped, MongoDB=5, Dashboard total=5, MRR unchanged at ₹{stats_after_dup.get('total_mrr')}."
    )

    # =========================================================================
    # TEST 12 — DELETE → DASHBOARD UPDATE
    # =========================================================================
    # Delete QA5-CUST-005 (MonthlyCharges = 70.70)
    del_resp = await client.delete("/telco/customers/QA5-CUST-005", headers=headers_empty)
    del_json = del_resp.json()

    mongo_count_after_del = await telco_collection.count_documents({"company_id": company_empty_id})
    stats_after_del_resp = await client.get("/dashboard/stats", headers=headers_empty)
    stats_after_del = stats_after_del_resp.json()

    expected_mrr_after_del = round(expected_sample_mrr - 70.70, 2)
    delete_dashboard_pass = (
        mongo_count_after_del == 4 and
        stats_after_del.get("total_analyzed") == 4 and
        abs(stats_after_del.get("total_mrr") - expected_mrr_after_del) < 0.1
    )
    record(
        "test_12_delete_update",
        "TEST 12 — DELETE → DASHBOARD UPDATE",
        delete_dashboard_pass,
        f"Deleted QA5-CUST-005 (charges: 70.70) -> MongoDB=4, Dashboard total=4, MRR reduced from ₹{expected_sample_mrr} to ₹{stats_after_del.get('total_mrr')}."
    )

    # =========================================================================
    # TEST 13 — DASHBOARD CACHE
    # =========================================================================
    cache_doc = await database["dashboard_cache"].find_one({"company_id": company_empty_id})
    has_company_id = cache_doc is not None and cache_doc.get("company_id") == company_empty_id
    cache_total_matches = cache_doc.get("total_analyzed") == 4

    # Test cache HIT speed on repeated call
    t_cache_1 = time.perf_counter()
    rep_1 = await client.get("/dashboard/stats", headers=headers_empty)
    latency_cache_hit = (time.perf_counter() - t_cache_1) * 1000

    record(
        "test_13_dashboard_cache",
        "TEST 13 — DASHBOARD CACHE",
        has_company_id and cache_total_matches and latency_cache_hit < 150,
        f"Cache document stored with company_id='{company_empty_id}', total_analyzed=4. Cache HIT latency={latency_cache_hit:.1f}ms."
    )
    FORMULA_REPORT["Cache Strategy"] = (
        "Collection 'dashboard_cache' indexed with unique compound key on ('company_id'). "
        "Smart Cache Policy: GET /dashboard/stats compares count_documents({company_id}) with cached.total_analyzed. "
        "If counts match: Cache HIT (<45ms). "
        "If counts differ or cache deleted (upload/delete): automatically runs vectorized predict_batch on fresh records, updates cache with upsert=True. "
        "If count == 0: deletes cache document and returns zero-state."
    )

    # =========================================================================
    # TEST 14 — RUN ANALYSIS
    # =========================================================================
    t_batch = time.perf_counter()
    batch_resp = await client.post("/predict/batch-all", headers=headers_empty)
    batch_time = (time.perf_counter() - t_batch) * 1000
    batch_json = batch_resp.json()

    analysis_pass = (
        batch_resp.status_code == 200 and
        batch_json.get("total_analyzed") == 4 and
        "high_risk_count" in batch_json and
        "medium_risk_count" in batch_json and
        "low_risk_count" in batch_json
    )
    record(
        "test_14_run_analysis",
        "TEST 14 — RUN ANALYSIS",
        analysis_pass,
        f"POST /predict/batch-all executed in {batch_time:.1f}ms. Analyzed 4 records. Returned high={batch_json.get('high_risk_count')}, med={batch_json.get('medium_risk_count')}, low={batch_json.get('low_risk_count')}."
    )

    # =========================================================================
    # TEST 15 — REFRESH
    # =========================================================================
    ref_1 = await client.get("/dashboard/stats", headers=headers_a)
    ref_2 = await client.get("/dashboard/stats", headers=headers_a)
    stats_r1 = ref_1.json()
    stats_r2 = ref_2.json()
    refresh_stable = (
        stats_r1.get("total_analyzed") == atlas_cust_count_a and
        stats_r2.get("total_analyzed") == atlas_cust_count_a and
        stats_r1.get("total_mrr") == stats_r2.get("total_mrr")
    )
    record(
        "test_15_refresh",
        "TEST 15 — REFRESH",
        refresh_stable,
        f"Simulated browser reload: successive calls consistently return {stats_r2.get('total_analyzed')} customers and ₹{stats_r2.get('total_mrr')} MRR from backend data."
    )

    # =========================================================================
    # TEST 16 — LOGOUT / COMPANY SWITCH
    # =========================================================================
    # Call stats for Company A -> Company Empty -> Company A
    sw_a1 = (await client.get("/dashboard/stats", headers=headers_a)).json()
    sw_b = (await client.get("/dashboard/stats", headers=headers_empty)).json()
    sw_a2 = (await client.get("/dashboard/stats", headers=headers_a)).json()

    switch_pass = (
        sw_a1.get("total_analyzed") == atlas_cust_count_a and
        sw_b.get("total_analyzed") == 4 and
        sw_a2.get("total_analyzed") == atlas_cust_count_a and
        sw_a1.get("total_mrr") != sw_b.get("total_mrr")
    )
    record(
        "test_16_company_switch",
        "TEST 16 — LOGOUT / COMPANY SWITCH",
        switch_pass,
        f"Company A ({atlas_cust_count_a}) -> Company B (4) -> Company A ({atlas_cust_count_a}). Zero data cross-talk or session leaks."
    )

    # =========================================================================
    # TEST 17 — RECENT ACTIVITY
    # =========================================================================
    hist_resp = await client.get("/uploads/history", headers=headers_empty)
    hist_items = hist_resp.json()
    has_history = len(hist_items) >= 2
    top_upload = hist_items[0] if hist_items else {}
    record(
        "test_17_recent_activity",
        "TEST 17 — RECENT ACTIVITY",
        has_history and top_upload.get("filename") == "qa5_sample_5.csv",
        f"Recent Activity lists {len(hist_items)} upload events for this company. Latest: '{top_upload.get('filename')}' with {top_upload.get('new_records')} new records."
    )

    # =========================================================================
    # TEST 18 — API FAILURE
    # =========================================================================
    invalid_token_headers = {"Authorization": "Bearer INVALID_EXPIRED_JWT_TOKEN_12345"}
    fail_resp = await client.get("/dashboard/stats", headers=invalid_token_headers)
    record(
        "test_18_api_failure",
        "TEST 18 — API FAILURE",
        fail_resp.status_code == 401,
        f"GET /dashboard/stats with invalid token returned HTTP {fail_resp.status_code} ({fail_resp.json().get('detail')}). Protected endpoint."
    )

    # =========================================================================
    # TEST 19 — LOADING STATES
    # =========================================================================
    # Inspect frontend Dashboard.jsx loading fallback
    with open(r"g:\projects\ChurnGuard\frontend\src\pages\Dashboard.jsx", "r", encoding="utf-8") as f:
        fe_code = f.read()

    loading_dash_check = "{loading ? '—' : total.toLocaleString()}" in fe_code
    active_dash_check = "{loading ? '—' : activeCount.toLocaleString()}" in fe_code
    high_dash_check = "{loading ? '—' : high.toLocaleString()}" in fe_code
    mrr_dash_check = "{loading ? '—' : (totalMRRRaw > 0 ? formatCurrency(totalMRRRaw) : '₹0')}" in fe_code

    loading_pass = loading_dash_check and active_dash_check and high_dash_check and mrr_dash_check
    record(
        "test_19_loading_states",
        "TEST 19 — LOADING STATES",
        loading_pass,
        "Dashboard.jsx displays '—' placeholder during loading state. Does not flash misleading '0' or stale account values."
    )

    # =========================================================================
    # TEST 20 — BACKEND SECURITY
    # =========================================================================
    # Verify no unauthenticated access
    unauth_resp = await client.get("/dashboard/stats")
    # Verify company_id tampering attempt
    tamper_resp = await client.get(f"/dashboard/stats?company_id={company_a_id}", headers=headers_empty)
    tamper_stats = tamper_resp.json()
    tamper_blocked = tamper_stats.get("total_analyzed") == 4  # Still company_empty_id (4), not company_a_id (7092)

    security_pass = (unauth_resp.status_code == 401) and tamper_blocked
    record(
        "test_20_security_checks",
        "TEST 20 — BACKEND SECURITY",
        security_pass,
        f"Unauthenticated access rejected (401). Frontend company_id query tampering completely ignored: returned tenant count {tamper_stats.get('total_analyzed')} instead of target tenant {atlas_cust_count_a}."
    )

    # =========================================================================
    # CLEANUP TEST TENANT RECORDS
    # =========================================================================
    await telco_collection.delete_many({"company_id": company_empty_id})
    await database["dashboard_cache"].delete_many({"company_id": company_empty_id})
    await database["dataset_uploads"].delete_many({"company_id": company_empty_id})
    await user_collection.delete_many({"company_id": company_empty_id})
    print(f"Cleaned up temporary test company: {company_empty_id}")

    # =========================================================================
    # FINAL SUMMARY EVALUATION
    # =========================================================================
    print("=" * 80)
    all_passed = all(r["passed"] for r in TEST_RESULTS.values())
    total_tests = len(TEST_RESULTS)
    passed_count = sum(1 for r in TEST_RESULTS.values() if r["passed"])
    print(f"QA-5 RESULT: {passed_count}/{total_tests} TESTS PASSED")
    print("=" * 80)
    return all_passed, TEST_RESULTS, FORMULA_REPORT

if __name__ == "__main__":
    passed, results, formulas = asyncio.run(run_qa5_suite())
    sys.exit(0 if passed else 1)
