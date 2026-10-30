import asyncio
import os
import sys
import io
import math
import secrets
import pandas as pd
from datetime import datetime, timezone
import httpx

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import database
from auth import hash_password, create_access_token

BASE_URL = "http://127.0.0.1:8000"

def create_synthetic_csv(count: int, prefix: str) -> bytes:
    records = []
    for i in range(1, count + 1):
        is_even = (i % 2 == 0)
        records.append({
            "customerID": f"{prefix}-{i:06d}",
            "gender": "Female" if is_even else "Male",
            "SeniorCitizen": 0 if is_even else 1,
            "Partner": "Yes" if is_even else "No",
            "Dependents": "No",
            "tenure": 12 if is_even else 36,
            "PhoneService": "Yes",
            "MultipleLines": "No",
            "InternetService": "DSL" if is_even else "Fiber optic",
            "OnlineSecurity": "Yes",
            "OnlineBackup": "No",
            "DeviceProtection": "No",
            "TechSupport": "Yes",
            "StreamingTV": "No",
            "StreamingMovies": "No",
            "Contract": "Month-to-month" if is_even else "Two year",
            "PaperlessBilling": "Yes",
            "PaymentMethod": "Electronic check",
            "MonthlyCharges": 65.50,
            "TotalCharges": 65.50 * (12 if is_even else 36)
        })
    df = pd.DataFrame(records)
    buf = io.BytesIO()
    df.to_csv(buf, index=False)
    return buf.getvalue()

async def run_dataset_management_tests():
    print("=" * 80)
    print("  CHURNGUARD DATASET MANAGEMENT & BULK DELETION E2E VERIFICATION SUITE")
    print("=" * 80)

    # Setup isolated test companies
    cid_a = f"comp_alpha_{secrets.token_hex(4)}"
    email_a = f"alpha_user_{secrets.token_hex(4)}@churnguard.test"
    pass_a = "TestPass123!"

    cid_b = f"comp_beta_{secrets.token_hex(4)}"
    email_b = f"beta_user_{secrets.token_hex(4)}@churnguard.test"
    pass_b = "TestPass123!"

    now_iso = datetime.now(timezone.utc).isoformat()

    await database.user_collection.insert_many([
        {
            "email": email_a,
            "password": hash_password(pass_a),
            "first_name": "Alpha",
            "last_name": "Tester",
            "company": "Alpha Corp",
            "company_id": cid_a,
            "email_verified": True,
            "created_at": now_iso
        },
        {
            "email": email_b,
            "password": hash_password(pass_b),
            "first_name": "Beta",
            "last_name": "Tester",
            "company": "Beta Corp",
            "company_id": cid_b,
            "email_verified": True,
            "created_at": now_iso
        }
    ])

    token_a = create_access_token({"sub": email_a})
    token_b = create_access_token({"sub": email_b})

    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    async with httpx.AsyncClient(base_url=BASE_URL, timeout=120.0) as client:
        # ── Test 1: Upload Dataset A with 1,000 records ──
        print("\n[Step 1] Upload Dataset A with 1,000 records...")
        csv_a = create_synthetic_csv(1000, "CUST-A")
        up_a = await client.post(
            "/dataset/upload",
            files={"file": ("Dataset_Alpha_1000.csv", csv_a, "text/csv")},
            headers=headers_a
        )
        assert up_a.status_code == 200, f"Upload A failed: {up_a.text}"
        data_a = up_a.json()
        assert data_a["success"] is True
        assert data_a["new_records"] == 1000
        upload_id_a = data_a["upload_id"]
        print(f"  [PASS] Dataset A uploaded (upload_id: {upload_id_a}, inserted: 1,000)")

        # ── Test 2: Upload Dataset B with 2,000 records ──
        print("\n[Step 2] Upload Dataset B with 2,000 records...")
        csv_b = create_synthetic_csv(2000, "CUST-B")
        up_b = await client.post(
            "/dataset/upload",
            files={"file": ("Dataset_Beta_2000.csv", csv_b, "text/csv")},
            headers=headers_a
        )
        assert up_b.status_code == 200, f"Upload B failed: {up_b.text}"
        data_b = up_b.json()
        assert data_b["success"] is True
        assert data_b["new_records"] == 2000
        upload_id_b = data_b["upload_id"]
        print(f"  [PASS] Dataset B uploaded (upload_id: {upload_id_b}, inserted: 2,000)")

        # ── Test 3: Confirm both datasets appear separately in Overview ──
        print("\n[Step 3] Confirm both datasets appear in Dataset Management overview...")
        res_overview = await client.get("/dataset/management/overview", headers=headers_a)
        assert res_overview.status_code == 200, f"Overview failed: {res_overview.text}"
        ov = res_overview.json()
        assert ov["total_datasets"] == 2
        assert ov["total_customers"] == 3000
        filenames = [d["filename"] for d in ov["datasets"]]
        assert "Dataset_Alpha_1000.csv" in filenames
        assert "Dataset_Beta_2000.csv" in filenames
        print(f"  [PASS] Both datasets present in overview. Total customers: {ov['total_customers']}")

        # ── Test 4: Upload two files with identical filenames, verify different upload IDs ──
        print("\n[Step 4] Upload file with duplicate filename ('Dataset_Alpha_1000.csv')...")
        csv_dup = create_synthetic_csv(500, "CUST-DUP")
        up_dup = await client.post(
            "/dataset/upload",
            files={"file": ("Dataset_Alpha_1000.csv", csv_dup, "text/csv")},
            headers=headers_a
        )
        assert up_dup.status_code == 200
        data_dup = up_dup.json()
        upload_id_dup = data_dup["upload_id"]
        assert upload_id_dup != upload_id_a, "Upload IDs must differ even for identical filenames!"
        print(f"  [PASS] Identical filename has unique upload_id: {upload_id_dup} != {upload_id_a}")

        # ── Test 5: Delete Dataset A and verify Dataset B remains untouched ──
        print("\n[Step 5] Delete Dataset A (1,000 records)...")
        del_a = await client.delete(f"/dataset/upload/{upload_id_a}", headers=headers_a)
        assert del_a.status_code == 200, f"Delete A failed: {del_a.text}"
        del_a_res = del_a.json()
        assert del_a_res["deleted_records"] == 1000
        print(f"  [PASS] Dataset A deleted successfully: {del_a_res['deleted_records']} records deleted.")

        # Verify Dataset B records remain
        ov_after = (await client.get("/dataset/management/overview", headers=headers_a)).json()
        assert ov_after["total_customers"] == 2500, f"Expected 2500 remaining, got {ov_after['total_customers']}"
        # Check Dataset B still has 2000 active records
        ds_b_entry = next(d for d in ov_after["datasets"] if d["upload_id"] == upload_id_b)
        assert ds_b_entry["active_records"] == 2000
        print(f"  [PASS] Dataset B verified untouched: 2,000 active records remain.")

        # ── Test 6: Verify Dashboard and Customer counts match ──
        print("\n[Step 6] Verify customer endpoint count and dashboard totals...")
        custs_res = await client.get("/telco/customers?page=1&limit=10", headers=headers_a)
        assert custs_res.status_code == 200
        assert custs_res.json()["total"] == 2500
        dash_res = await client.get("/dashboard/stats", headers=headers_a)
        assert dash_res.status_code == 200
        assert dash_res.json()["total_analyzed"] == 2500
        print(f"  [PASS] Customer page API and Dashboard reflect exact count (2,500).")

        # ── Test 7: Upload 15,000 records and delete it ──
        print("\n[Step 7] Benchmark 15,000 record dataset upload and deletion...")
        csv_15k = create_synthetic_csv(15000, "CUST-15K")
        up_15k = await client.post(
            "/dataset/upload",
            files={"file": ("Dataset_Large_15000.csv", csv_15k, "text/csv")},
            headers=headers_a
        )
        assert up_15k.status_code == 200
        data_15k = up_15k.json()
        assert data_15k["new_records"] == 15000
        upload_id_15k = data_15k["upload_id"]
        print(f"  [PASS] 15,000 records uploaded successfully (upload_id: {upload_id_15k}). Total now: {data_15k['total_in_db']}")

        # Delete the 15,000 record dataset
        del_15k = await client.delete(f"/dataset/upload/{upload_id_15k}", headers=headers_a)
        assert del_15k.status_code == 200
        assert del_15k.json()["deleted_records"] == 15000
        print(f"  [PASS] 15,000 record dataset deleted in bulk cleanly.")

        # ── Test 8: Tenant isolation - Company B cannot delete Company A's dataset ──
        print("\n[Step 8] Test tenant isolation: Company B attempts to delete Company A's dataset...")
        del_cross = await client.delete(f"/dataset/upload/{upload_id_b}", headers=headers_b)
        assert del_cross.status_code == 404, f"Cross-tenant deletion must return 404, got {del_cross.status_code}"
        print(f"  [PASS] Cross-tenant deletion rejected with HTTP 404 Not Found.")

        # ── Test 9: Test View associated records with server-side pagination ──
        print("\n[Step 9] Test View dataset records endpoint with pagination...")
        view_res = await client.get(f"/dataset/uploads/{upload_id_b}/records?page=1&limit=50", headers=headers_a)
        assert view_res.status_code == 200
        v_data = view_res.json()
        assert v_data["total"] == 2000
        assert len(v_data["records"]) == 50
        assert v_data["total_pages"] == 40
        assert "risk_level" in v_data["records"][0]
        print(f"  [PASS] Paginated dataset records inspection verified (50 of 2,000 records, total pages: 40).")

        # ── Test 10: Test existing individual customer deletion ──
        print("\n[Step 10] Test existing individual customer deletion...")
        sample_cid = v_data["records"][0]["customerID"]
        del_single = await client.delete(f"/telco/customers/{sample_cid}", headers=headers_a)
        assert del_single.status_code == 200
        print(f"  [PASS] Individual customer '{sample_cid}' deleted cleanly.")

        # ── Test 11: Test Clear All My Uploaded Data (Danger Zone) ──
        print("\n[Step 11] Test Clear All My Uploaded Data (Company Alpha)...")
        # Company B uploads a record first to ensure Company B is NOT wiped
        csv_b_tenant = create_synthetic_csv(100, "BETA-PERSIST")
        await client.post(
            "/dataset/upload",
            files={"file": ("Beta_Persist.csv", csv_b_tenant, "text/csv")},
            headers=headers_b
        )

        clear_res = await client.post(
            "/dataset/clear-all",
            json={"confirm_phrase": "DELETE ALL"},
            headers=headers_a
        )
        assert clear_res.status_code == 200
        c_data = clear_res.json()
        assert c_data["success"] is True
        assert c_data["remaining_records"] == 0
        print(f"  [PASS] Company Alpha cleared all data: {c_data['records_deleted']} records removed. Remaining: 0")

        # Confirm Company B records are still 100% intact!
        b_count = await database.telco_collection.count_documents({"company_id": cid_b})
        assert b_count == 100, f"Expected Company B to retain 100 records, found {b_count}"
        print(f"  [PASS] Company B records strictly retained (100 records).")

        # Confirm User Accounts and Auth are intact
        user_alpha_check = await database.user_collection.find_one({"company_id": cid_a})
        assert user_alpha_check is not None
        print(f"  [PASS] User account and company profile remain intact.")

        # ── Test 12: Predict Churn, Analytics, Reports reflect 0 remaining customers for Alpha ──
        print("\n[Step 12] Verify Predict Churn & Analytics reflect cleared data...")
        custs_empty = await client.get("/telco/customers?page=1&limit=10", headers=headers_a)
        assert custs_empty.json()["total"] == 0
        dash_empty = await client.get("/dashboard/stats", headers=headers_a)
        assert dash_empty.json()["total_analyzed"] == 0
        print(f"  [PASS] All pages reflect 0 customers cleanly.")

    # Cleanup test companies
    await database.user_collection.delete_many({"company_id": {"$in": [cid_a, cid_b]}})
    await database.telco_collection.delete_many({"company_id": {"$in": [cid_a, cid_b]}})
    await database.database["dataset_uploads"].delete_many({"company_id": {"$in": [cid_a, cid_b]}})
    await database.database["dashboard_cache"].delete_many({"company_id": {"$in": [cid_a, cid_b]}})
    print("\n[Cleanup] Test companies and records cleaned up cleanly.")
    print("\n" + "=" * 80)
    print("  ALL 12 DATASET MANAGEMENT TEST SUITES PASSED (100% SUCCESS)")
    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(run_dataset_management_tests())
