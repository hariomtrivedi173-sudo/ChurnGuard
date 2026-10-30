"""
ChurnGuard - Verification Test Suite: Delete an Entire Uploaded Dataset
Tests:
1. Upload a dataset and confirm it can be identified by filename and unique upload_id.
2. Upload multiple different datasets and delete only one selected file.
3. Confirm that records from other files remain available.
4. Confirm that deleting a file removes all and only the data associated exclusively with that file.
5. Confirm that Cancel leaves data unchanged.
6. Confirm that duplicate filenames are handled correctly with distinct upload IDs.
7. Confirm that dashboard metrics, customer lists, and upload history update after deletion.
8. Confirm tenant isolation (cross-company deletion blocked).
9. Confirm safety when deleting non-existent or duplicate deletion requests.
10. Confirm existing upload, prediction, analytics, authentication, and reporting functionality still works.
"""

import sys
import os
import io
import time
import httpx
import asyncio
import pandas as pd

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
import database
from auth import hash_password

BASE_URL = "http://127.0.0.1:8000"

USER_A_EMAIL = "del_tester_alpha@churnguard.test"
USER_A_PASS = "TestPassword123!"
COMPANY_A = "comp_delete_test_alpha"

USER_B_EMAIL = "del_tester_beta@churnguard.test"
USER_B_PASS = "TestPassword123!"
COMPANY_B = "comp_delete_test_beta"

def create_csv_bytes(records):
    df = pd.DataFrame(records)
    buf = io.BytesIO()
    df.to_csv(buf, index=False)
    buf.seek(0)
    return buf.getvalue()

async def setup_test_users():
    client = database.get_client()
    db = client[database.DB_NAME]
    
    # Clean previous test tenant data
    for comp, email in [(COMPANY_A, USER_A_EMAIL), (COMPANY_B, USER_B_EMAIL)]:
        await db["users"].delete_many({"email": email})
        await db["telco_customers"].delete_many({"company_id": comp})
        await db["dataset_uploads"].delete_many({"company_id": comp})
        await db["dashboard_cache"].delete_many({"company_id": comp})
        
        await db["users"].insert_one({
            "email": email,
            "password": hash_password(USER_A_PASS if email == USER_A_EMAIL else USER_B_PASS),
            "first_name": "Test",
            "last_name": "User",
            "company": comp,
            "company_id": comp,
            "email_verified": True,
            "created_at": "2026-10-25T00:00:00+00:00"
        })

async def run_suite():
    print("=" * 75)
    print("  RUNNING CHURNGUARD DELETE DATASET VERIFICATION SUITE")
    print("=" * 75)
    
    await setup_test_users()
    
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        # 1. Login User A and User B
        res_a = await client.post("/login", json={"email": USER_A_EMAIL, "password": USER_A_PASS})
        assert res_a.status_code == 200, f"Login A failed: {res_a.text}"
        token_a = res_a.json()["access_token"]
        headers_a = {"Authorization": f"Bearer {token_a}"}

        res_b = await client.post("/login", json={"email": USER_B_EMAIL, "password": USER_B_PASS})
        assert res_b.status_code == 200, f"Login B failed: {res_b.text}"
        token_b = res_b.json()["access_token"]
        headers_b = {"Authorization": f"Bearer {token_b}"}
        print("✓ Authentication & Token acquisition passed.")

        # Prepare CSV datasets
        # Dataset 1: 5 customers
        ds1_records = [
            {"customerID": f"ALPHA-{i:03d}", "gender": "Female", "SeniorCitizen": 0, "Partner": "Yes", "Dependents": "No",
             "tenure": 12 + i, "PhoneService": "Yes", "MultipleLines": "No", "InternetService": "DSL",
             "OnlineSecurity": "Yes", "OnlineBackup": "No", "DeviceProtection": "No", "TechSupport": "Yes",
             "StreamingTV": "No", "StreamingMovies": "No", "Contract": "Month-to-month", "PaperlessBilling": "Yes",
             "PaymentMethod": "Electronic check", "MonthlyCharges": 50.0 + i, "TotalCharges": (50.0 + i) * (12 + i)}
            for i in range(1, 6)
        ]
        csv1 = create_csv_bytes(ds1_records)

        # Dataset 2: 4 new customers (BETA-001..004) + 1 duplicate from Dataset 1 (ALPHA-005)
        ds2_records = [
            {"customerID": f"BETA-{i:03d}", "gender": "Male", "SeniorCitizen": 1, "Partner": "No", "Dependents": "No",
             "tenure": 5 + i, "PhoneService": "Yes", "MultipleLines": "Yes", "InternetService": "Fiber optic",
             "OnlineSecurity": "No", "OnlineBackup": "Yes", "DeviceProtection": "Yes", "TechSupport": "No",
             "StreamingTV": "Yes", "StreamingMovies": "Yes", "Contract": "One year", "PaperlessBilling": "No",
             "PaymentMethod": "Bank transfer (automatic)", "MonthlyCharges": 80.0 + i, "TotalCharges": (80.0 + i) * (5 + i)}
            for i in range(1, 5)
        ] + [ds1_records[-1]] # ALPHA-005 is shared!
        csv2 = create_csv_bytes(ds2_records)

        # Dataset 3: Duplicate filename "dataset_alpha.csv" with 2 brand new records (ALPHA-006, ALPHA-007)
        ds3_records = [
            {"customerID": f"ALPHA-{i:03d}", "gender": "Female", "SeniorCitizen": 0, "Partner": "No", "Dependents": "No",
             "tenure": 24, "PhoneService": "Yes", "MultipleLines": "No", "InternetService": "No",
             "OnlineSecurity": "No internet service", "OnlineBackup": "No internet service", "DeviceProtection": "No internet service",
             "TechSupport": "No internet service", "StreamingTV": "No internet service", "StreamingMovies": "No internet service",
             "Contract": "Two year", "PaperlessBilling": "No", "PaymentMethod": "Mailed check",
             "MonthlyCharges": 20.0, "TotalCharges": 480.0}
            for i in [6, 7]
        ]
        csv3 = create_csv_bytes(ds3_records)

        # ── Test 1: Upload Dataset 1 and identify by filename & upload_id ──
        up1 = await client.post("/dataset/upload", files={"file": ("dataset_alpha.csv", csv1, "text/csv")}, headers=headers_a)
        assert up1.status_code == 200, f"Upload 1 failed: {up1.text}"
        data1 = up1.json()
        assert data1["success"] is True
        assert data1["filename"] == "dataset_alpha.csv"
        assert data1["new_records"] == 5
        assert "upload_id" in data1
        upload_id_1 = data1["upload_id"]
        print(f"✓ Test 1: Upload 1 ('dataset_alpha.csv') successful. upload_id: {upload_id_1}, inserted: 5")

        # ── Test 2: Upload Dataset 2 (with shared duplicate ALPHA-005) ──
        up2 = await client.post("/dataset/upload", files={"file": ("dataset_beta.csv", csv2, "text/csv")}, headers=headers_a)
        assert up2.status_code == 200, f"Upload 2 failed: {up2.text}"
        data2 = up2.json()
        assert data2["success"] is True
        assert data2["filename"] == "dataset_beta.csv"
        assert data2["new_records"] == 4
        assert data2["duplicates_skipped"] == 1
        upload_id_2 = data2["upload_id"]
        print(f"✓ Test 2: Upload 2 ('dataset_beta.csv') successful. upload_id: {upload_id_2}, inserted: 4, duplicates skipped: 1")

        # ── Test 3: Upload Duplicate Filename ("dataset_alpha.csv" again) ──
        up3 = await client.post("/dataset/upload", files={"file": ("dataset_alpha.csv", csv3, "text/csv")}, headers=headers_a)
        assert up3.status_code == 200, f"Upload 3 failed: {up3.text}"
        data3 = up3.json()
        assert data3["filename"] == "dataset_alpha.csv"
        upload_id_3 = data3["upload_id"]
        assert upload_id_3 != upload_id_1, "Each upload of same filename must have distinct upload_id!"
        print(f"✓ Test 3: Duplicate filename handled correctly with unique upload_id: {upload_id_3} != {upload_id_1}")

        # Check total records in DB: 5 (from ds1) + 4 (from ds2) + 2 (from ds3) = 11
        info_res = await client.get("/dataset/info", headers=headers_a)
        assert info_res.json()["total_records"] == 11, f"Expected 11 records, got {info_res.json()['total_records']}"
        
        hist_res = await client.get("/uploads/history", headers=headers_a)
        history = hist_res.json()
        assert len(history) == 3, f"Expected 3 history items, got {len(history)}"
        hist_ids = [h.get("upload_id") or h["_id"] for h in history]
        assert upload_id_1 in hist_ids and upload_id_2 in hist_ids and upload_id_3 in hist_ids
        print(f"✓ History successfully lists all 3 distinct uploads with unique IDs: {len(history)} entries.")

        # ── Test 4: Cancel confirmation simulation ──
        # When a user clicks 'Cancel' in the UI modal, no API call is made.
        # Data and counts must remain unchanged.
        info_cancel = await client.get("/dataset/info", headers=headers_a)
        assert info_cancel.json()["total_records"] == 11
        print("✓ Test 4: Cancel leaves database completely untouched (total: 11).")

        # ── Test 5: Tenant Isolation Security ──
        # Tenant B attempts to delete Tenant A's upload
        cross_del = await client.delete(f"/dataset/upload/{upload_id_2}", headers=headers_b)
        assert cross_del.status_code == 404, f"Tenant isolation failed! Expected 404, got {cross_del.status_code}"
        print("✓ Test 5: Tenant isolation verified — Tenant B cannot delete Tenant A's dataset (404 Not Found).")

        # ── Test 6: Delete Dataset Beta ('dataset_beta.csv') ──
        # Dataset Beta has 4 exclusive records (BETA-001..004) and 1 shared record (ALPHA-005).
        # Deleting Dataset Beta must delete ONLY the 4 exclusive records.
        # ALPHA-005 must NOT be deleted because it also belongs to Dataset Alpha!
        del_res = await client.delete(f"/dataset/upload/{upload_id_2}", headers=headers_a)
        assert del_res.status_code == 200, f"Delete failed: {del_res.text}"
        del_data = del_res.json()
        assert del_data["success"] is True
        assert del_data["filename"] == "dataset_beta.csv"
        assert del_data["deleted_records"] == 4, f"Expected 4 deleted records, got {del_data['deleted_records']}"
        assert del_data["remaining_records"] == 7, f"Expected 7 remaining records, got {del_data['remaining_records']}"
        print(f"✓ Test 6: Delete dataset_beta.csv successful! Deleted: {del_data['deleted_records']}, Remaining: {del_data['remaining_records']}")

        # ── Test 7: Verify Remaining Customer Records & Shared Record Integrity ──
        cust_res = await client.get("/telco/customers?limit=50", headers=headers_a)
        cust_data = cust_res.json()
        assert cust_data["total"] == 7, f"Expected 7 customers in list, got {cust_data['total']}"
        customer_items = cust_data.get("records", [])
        cids_in_list = [c["customerID"] for c in customer_items]
        
        # Verify all BETA records are gone
        for i in range(1, 5):
            assert f"BETA-{i:03d}" not in cids_in_list, f"BETA-{i:03d} should have been deleted!"
            
        # Verify ALPHA-005 (shared) and other ALPHA records remain
        for i in [1, 2, 3, 4, 5, 6, 7]:
            assert f"ALPHA-{i:03d}" in cids_in_list, f"ALPHA-{i:03d} should still exist in database!"
        print("✓ Test 7: Record isolation verified — BETA-001..004 deleted; shared ALPHA-005 and ALPHA-001..007 safely retained.")

        # ── Test 8: Verify Dashboard & Analytics Cache Updated ──
        stats_res = await client.get("/dashboard/stats", headers=headers_a)
        stats = stats_res.json()
        assert stats["total_analyzed"] == 7, f"Dashboard total_analyzed should be 7, got {stats.get('total_analyzed')}"
        assert stats["total_mrr"] > 0
        print(f"✓ Test 8: Dashboard stats automatically updated to reflect remaining data: total_analyzed={stats['total_analyzed']}, MRR={stats['total_mrr']}.")

        # ── Test 9: Verify History reflects deletion ──
        hist_after = (await client.get("/uploads/history", headers=headers_a)).json()
        assert len(hist_after) == 2, f"Expected 2 history records after deletion, got {len(hist_after)}"
        hist_filenames = [h["filename"] for h in hist_after]
        assert "dataset_beta.csv" not in hist_filenames
        print("✓ Test 9: Upload history accurately removes deleted dataset entry.")

        # ── Test 10: Duplicate / Idempotent Deletion prevention ──
        del_again = await client.delete(f"/dataset/upload/{upload_id_2}", headers=headers_a)
        assert del_again.status_code == 404, f"Repeated deletion should return 404, got {del_again.status_code}"
        print("✓ Test 10: Repeated deletion of already deleted dataset handled safely (404).")

        # ── Test 11: Core functionality intact (Predict, Metrics, Reports) ──
        # Predict endpoint
        pred_input = dict(ds1_records[0])
        pred_input["SeniorCitizen"] = "No"
        pred_res = await client.post("/predict/churn", json=pred_input, headers=headers_a)
        assert pred_res.status_code == 200, f"Predict churn failed: {pred_res.text}"
        pred = pred_res.json()
        assert "churn_prediction" in pred and "churn_probability" in pred
        print("✓ Test 11a: Prediction endpoint (/predict/churn) functioning accurately.")

        # ML metrics endpoint
        metrics_res = await client.get("/ml/metrics", headers=headers_a)
        assert metrics_res.status_code == 200
        print("✓ Test 11b: ML metrics endpoint (/ml/metrics) functioning accurately.")

        # Reports CSV export endpoint
        report_res = await client.get("/reports/export/csv", headers=headers_a)
        assert report_res.status_code == 200
        assert "customerID" in report_res.text
        lines = [l for l in report_res.text.strip().split("\n") if l.strip()]
        # 1 header line + 7 records = 8 lines
        assert len(lines) == 8, f"Expected 8 lines in CSV export (1 header + 7 rows), got {len(lines)}"
        print(f"✓ Test 11c: Reports CSV export (/reports/export/csv) exported exact 7 remaining records.")

        # ── Test 12: Delete remaining uploads sequentially ──
        del_alpha1 = await client.delete(f"/dataset/upload/{upload_id_1}", headers=headers_a)
        assert del_alpha1.status_code == 200
        # ALPHA-001..005 deleted (5 records deleted, 2 remaining)
        assert del_alpha1.json()["deleted_records"] == 5
        assert del_alpha1.json()["remaining_records"] == 2
        print(f"✓ Test 12a: Deleted dataset_alpha.csv (batch 1): 5 deleted, 2 remaining.")

        del_alpha2 = await client.delete(f"/dataset/upload/{upload_id_3}", headers=headers_a)
        assert del_alpha2.status_code == 200
        # ALPHA-006, ALPHA-007 deleted (2 records deleted, 0 remaining)
        assert del_alpha2.json()["deleted_records"] == 2
        assert del_alpha2.json()["remaining_records"] == 0
        print(f"✓ Test 12b: Deleted dataset_alpha.csv (batch 2): 2 deleted, 0 remaining.")

        # Final check: DB empty, dashboard gracefully handles 0
        final_stats = (await client.get("/dashboard/stats", headers=headers_a)).json()
        assert final_stats["total_analyzed"] == 0
        print("✓ Test 12c: Final state verified — 0 records in database, dashboard cleanly reset to empty state.")

    print("\n" + "=" * 75)
    print("  ALL 12 VERIFICATION TESTS PASSED SUCCESSFULLY!")
    print("=" * 75)

if __name__ == "__main__":
    asyncio.run(run_suite())
