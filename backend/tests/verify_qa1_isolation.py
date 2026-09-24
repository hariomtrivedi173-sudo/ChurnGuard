import os
import sys
import time
import re
import asyncio
import httpx

# Add backend directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from database import (
    user_collection,
    telco_collection,
    database,
    otp_collection
)

BASE_URL = "http://127.0.0.1:8000"
LOG_PATH = r"C:\Users\hario\.gemini\antigravity-ide\brain\9b4b6dbe-f53b-4dd3-aa1d-6e323ef2eab4\.system_generated\tasks\task-568.log"

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

async def run_qa1_isolation_test():
    print("=" * 80)
    print("STARTING QA-1: NEW USER / COMPANY DATA ISOLATION VERIFICATION")
    print("=" * 80)

    client = httpx.AsyncClient(base_url=BASE_URL, timeout=30.0)

    # 1. Verify Existing Company A state before starting
    email_a = "qa_tester_a@companya.com"
    comp_a_id = "comp_company_a"
    atlas_count_a_before = await telco_collection.count_documents({"company_id": comp_a_id})
    print(f"[CHECK 1] Existing Company A ({comp_a_id}) customers in Atlas: {atlas_count_a_before}")
    assert atlas_count_a_before > 0, "Precondition failed: Company A should have existing customer data!"

    # 2. Register completely NEW account
    email_new = "qa1_iso_user@isolationqa.com"
    pwd_new = "Password123!"
    comp_name_new = "Isolation QA Enterprise"
    expected_new_comp_id = "comp_isolation_qa_enterprise"

    # Ensure this specific test user does not already exist
    await user_collection.delete_many({"email": email_new})
    await otp_collection.delete_many({"email": email_new})
    await telco_collection.delete_many({"company_id": expected_new_comp_id})
    await database["dataset_uploads"].delete_many({"company_id": expected_new_comp_id})
    await database["dashboard_cache"].delete_many({"company_id": expected_new_comp_id})

    reg_payload = {
        "first_name": "Samantha",
        "last_name": "Vance",
        "email": email_new,
        "phone": "9876543299",
        "password": pwd_new,
        "company": comp_name_new,
        "company_type": "Private Limited Company",
        "industry": "Software as a Service",
        "department": "Security & Compliance",
        "company_size": "51–200 employees",
        "country": "India"
    }

    reg_res = await client.post("/register", json=reg_payload)
    print(f"[STEP 2] Registration response: {reg_res.status_code}")
    assert reg_res.status_code == 200, f"Registration failed: {reg_res.text}"

    otp = get_latest_otp(email_new)
    print(f"[STEP 2] OTP extracted from server log: {otp}")
    assert otp is not None, "Could not extract OTP from server log"

    verify_res = await client.post("/auth/verify-registration", json={"email": email_new, "otp": otp})
    print(f"[STEP 2] Verify OTP response: {verify_res.status_code}")
    assert verify_res.status_code == 200, f"OTP verification failed: {verify_res.text}"

    # 3. Login with newly created account
    login_res = await client.post("/login", json={"email": email_new, "password": pwd_new})
    print(f"[STEP 3] Login response: {login_res.status_code}")
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"

    login_data = login_res.json()
    token_new = login_data["access_token"]
    actual_comp_id = login_data["company_id"]
    print(f"[STEP 3] Logged in. Assigned company_id: {actual_comp_id}")
    assert actual_comp_id == expected_new_comp_id, f"Expected {expected_new_comp_id}, got {actual_comp_id}"

    headers_new = {"Authorization": f"Bearer {token_new}"}

    # 4. Verify Dashboard for the new user
    dash_res = await client.get("/dashboard/stats", headers=headers_new)
    print(f"[STEP 4] Dashboard stats status: {dash_res.status_code}")
    assert dash_res.status_code == 200, f"Dashboard request failed: {dash_res.text}"
    d = dash_res.json()

    print(f"  total_analyzed   : {d.get('total_analyzed')}")
    print(f"  high_risk_count  : {d.get('high_risk_count')}")
    print(f"  medium_risk_count: {d.get('medium_risk_count')}")
    print(f"  low_risk_count   : {d.get('low_risk_count')}")
    print(f"  total_mrr        : {d.get('total_mrr')}")
    print(f"  avg_churn_rate   : {d.get('avg_churn_rate')}")
    print(f"  plan_distribution: {d.get('plan_distribution')}")
    print(f"  risk_by_contract : {d.get('risk_by_contract')}")
    print(f"  risk_by_tenure   : {d.get('risk_by_tenure')}")
    print(f"  high_risk_profile: {d.get('high_risk_profile')}")
    print(f"  results count    : {len(d.get('results', []))}")

    assert d.get("total_analyzed") == 0, f"Expected total_analyzed == 0, got {d.get('total_analyzed')}"
    assert d.get("high_risk_count") == 0, "Expected high_risk_count == 0"
    assert d.get("medium_risk_count") == 0, "Expected medium_risk_count == 0"
    assert d.get("low_risk_count") == 0, "Expected low_risk_count == 0"
    assert d.get("total_mrr") == 0.0, "Expected total_mrr == 0.0"
    assert d.get("avg_churn_rate") == 0.0, "Expected avg_churn_rate == 0.0"
    assert d.get("results") == [], "Expected results == []"
    assert d.get("plan_distribution") == [], "Expected plan_distribution == []"
    assert d.get("risk_by_contract") == [], "Expected risk_by_contract == []"
    assert d.get("risk_by_tenure") == [], "Expected risk_by_tenure == []"
    assert d.get("high_risk_profile") == [], "Expected high_risk_profile == []"

    # 5. Open Customers page
    cust_res = await client.get("/telco/customers", headers=headers_new)
    print(f"[STEP 5] Customers status: {cust_res.status_code}")
    assert cust_res.status_code == 200, f"Customers request failed: {cust_res.text}"
    c = cust_res.json()
    recs = c.get("records", c.get("data", []))
    print(f"  total customers  : {c.get('total')}")
    print(f"  records returned : {len(recs)}")
    assert c.get("total") == 0, f"Expected total == 0, got {c.get('total')}"
    assert len(recs) == 0, f"Expected 0 records, got {len(recs)}"

    # 6. Open Upload Dataset (history & info)
    hist_res = await client.get("/uploads/history", headers=headers_new)
    print(f"[STEP 6] Upload history status: {hist_res.status_code}")
    assert hist_res.status_code == 200, f"Upload history request failed: {hist_res.text}"
    hist = hist_res.json()
    print(f"  history items    : {len(hist)}")
    assert isinstance(hist, list) and len(hist) == 0, f"Expected empty history [], got {hist}"

    info_res = await client.get("/dataset/info", headers=headers_new)
    print(f"[STEP 6] Dataset info status: {info_res.status_code}")
    assert info_res.status_code == 200, f"Dataset info request failed: {info_res.text}"
    info = info_res.json()
    print(f"  dataset stored   : {info.get('stored')}")
    assert info.get("stored") is False, "Expected stored == False for empty company"

    # 7. Open Analytics (/ml/metrics, /ml/segments)
    metrics_res = await client.get("/ml/metrics", headers=headers_new)
    print(f"[STEP 7] ML metrics status: {metrics_res.status_code}")
    assert metrics_res.status_code == 200, f"ML metrics failed: {metrics_res.text}"
    m = metrics_res.json()
    print(f"  accuracy         : {m.get('accuracy')}")
    print(f"  precision        : {m.get('precision')}")
    print(f"  recall           : {m.get('recall')}")
    print(f"  f1_score         : {m.get('f1_score')}")
    print(f"  auc              : {m.get('auc')}")
    print(f"  features         : {m.get('feature_importance')}")
    assert m.get("accuracy") == 0.0, "Expected accuracy == 0.0"
    assert m.get("feature_importance") == [], "Expected feature_importance == []"
    assert m.get("confusion_matrix") == {
        "true_negative": 0, "false_positive": 0,
        "false_negative": 0, "true_positive": 0
    }, "Expected confusion matrix with 0s"

    seg_res = await client.get("/ml/segments", headers=headers_new)
    print(f"[STEP 7] ML segments status: {seg_res.status_code}")
    assert seg_res.status_code == 200
    assert seg_res.json() == [], f"Expected empty segments [], got {seg_res.json()}"

    # 8. Check Predictions & Reports endpoints
    batch_res = await client.post("/predict/batch-all", headers=headers_new)
    print(f"[STEP 8] Batch predict status: {batch_res.status_code}")
    assert batch_res.status_code == 200
    assert batch_res.json().get("total_analyzed") == 0
    assert batch_res.json().get("results") == []

    export_res = await client.get("/reports/export/csv", headers=headers_new)
    print(f"[STEP 8] CSV Export on empty tenant status: {export_res.status_code} (Expected 404)")
    assert export_res.status_code == 404, f"Expected 404 for empty tenant export, got {export_res.status_code}"

    # 9. Backend MongoDB Direct Scrutiny
    atlas_count_new = await telco_collection.count_documents({"company_id": expected_new_comp_id})
    uploads_count_new = await database["dataset_uploads"].count_documents({"company_id": expected_new_comp_id})
    cache_count_new = await database["dashboard_cache"].count_documents({"company_id": expected_new_comp_id})

    print(f"[STEP 9] Atlas direct count for new company: {atlas_count_new}")
    print(f"[STEP 9] Dataset uploads count for new company: {uploads_count_new}")
    print(f"[STEP 9] Dashboard cache count for new company: {cache_count_new}")
    assert atlas_count_new == 0, "Direct Atlas count must be 0"
    assert uploads_count_new == 0, "Direct Uploads count must be 0"
    assert cache_count_new == 0, "Direct Dashboard Cache count must be 0"

    # 10. Verify Existing Company A Data Preserved (Simultaneous Coexistence)
    atlas_count_a_after = await telco_collection.count_documents({"company_id": comp_a_id})
    print(f"[STEP 10] Existing Company A count after new company creation: {atlas_count_a_after}")
    assert atlas_count_a_after == atlas_count_a_before, f"Company A data was modified! Before: {atlas_count_a_before}, After: {atlas_count_a_after}"

    login_a = await client.post("/login", json={"email": email_a, "password": "Password123!"})
    token_a = login_a.json()["access_token"]
    dash_a = await client.get("/dashboard/stats", headers={"Authorization": f"Bearer {token_a}"})
    assert dash_a.status_code == 200
    assert dash_a.json().get("total_analyzed") == atlas_count_a_before, f"Company A dashboard total should be {atlas_count_a_before}"

    cust_a = await client.get("/telco/customers", headers={"Authorization": f"Bearer {token_a}"})
    assert cust_a.status_code == 200
    assert cust_a.json().get("total") == atlas_count_a_before, f"Company A customers total should be {atlas_count_a_before}"

    await client.aclose()
    print("=" * 80)
    print("ALL QA-1 NEW USER / COMPANY DATA ISOLATION CHECKS PASSED!")
    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(run_qa1_isolation_test())
