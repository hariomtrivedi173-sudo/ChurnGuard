import asyncio
import os
import sys
import secrets
from datetime import datetime, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import database
from auth import hash_password, create_access_token
import httpx

BACKEND_URL = "http://127.0.0.1:8000"

async def test_pagination_and_selection():
    # Setup test company & user
    company_id = f"comp_test_pag_{secrets.token_hex(4)}"
    test_email = f"pag_tester_{secrets.token_hex(4)}@churnguard.test"
    now = datetime.now(timezone.utc)
    
    await database.user_collection.insert_one({
        "email": test_email,
        "password": hash_password("TestPass123!"),
        "first_name": "Pag",
        "last_name": "Tester",
        "company": "Pagination Test Corp",
        "company_id": company_id,
        "email_verified": True,
        "created_at": now.isoformat()
    })
    
    # Insert 60 customers with varying attributes
    customers = []
    for i in range(60):
        # Even: Month-to-month tenure < 12 (High risk)
        # Odd: Two year tenure > 24 (Low risk)
        is_high = (i % 2 == 0)
        c = {
            "customerID": f"CUST-{i:03d}",
            "company_id": company_id,
            "gender": "Male" if i % 2 == 0 else "Female",
            "SeniorCitizen": "No",
            "Partner": "Yes" if i % 3 == 0 else "No",
            "Dependents": "No",
            "tenure": 4 if is_high else 36,
            "PhoneService": "Yes",
            "MultipleLines": "No",
            "InternetService": "Fiber optic" if is_high else "DSL",
            "OnlineSecurity": "No",
            "OnlineBackup": "No",
            "DeviceProtection": "No",
            "TechSupport": "No",
            "StreamingTV": "No",
            "StreamingMovies": "No",
            "Contract": "Month-to-month" if is_high else "Two year",
            "PaperlessBilling": "Yes",
            "PaymentMethod": "Electronic check" if is_high else "Credit card (automatic)",
            "MonthlyCharges": 85.50 if is_high else 45.00,
            "TotalCharges": (85.50 * 4) if is_high else (45.00 * 36),
            "upload_id": "upload_batch_1" if i < 30 else "upload_batch_2"
        }
        customers.append(c)
    
    await database.telco_collection.insert_many(customers)
    
    token = create_access_token({"sub": test_email})
    headers = {"Authorization": f"Bearer {token}"}
    
    async with httpx.AsyncClient(base_url=BACKEND_URL) as client:
        # 1. Test pagination default
        r = await client.get("/telco/customers?page=1&limit=25", headers=headers)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
        data = r.json()
        assert data["total"] == 60, f"Expected total 60, got {data['total']}"
        assert data["total_pages"] == 3, f"Expected 3 pages, got {data['total_pages']}"
        assert len(data["records"]) == 25, f"Expected 25 records, got {len(data['records'])}"
        assert "risk_level" in data["records"][0], "Expected risk_level in page records"
        assert "churn_probability" in data["records"][0], "Expected churn_probability in page records"
        print("[OK] Pagination limit 25 verified (page 1 of 3, 25 records with ML predictions)")

        # 2. Test limit 500
        r500 = await client.get("/telco/customers?page=1&limit=500", headers=headers)
        assert r500.status_code == 200
        assert len(r500.json()["records"]) == 60
        print("[OK] Pagination limit 500 verified (all 60 returned)")

        # 3. Test search filter
        r_search = await client.get("/telco/customers?page=1&limit=25&search=CUST-005", headers=headers)
        assert r_search.status_code == 200
        assert r_search.json()["total"] == 1
        assert r_search.json()["records"][0]["customerID"] == "CUST-005"
        print("[OK] Search filter verified (found CUST-005)")

        # 4. Test upload_id filter
        r_up = await client.get("/telco/customers?page=1&limit=50&upload_id=upload_batch_1", headers=headers)
        assert r_up.status_code == 200
        assert r_up.json()["total"] == 30
        print("[OK] Upload ID filter verified (found 30 records for upload_batch_1)")

        # 5. Test risk level filter
        r_high = await client.get("/telco/customers?page=1&limit=50&risk_level=high", headers=headers)
        assert r_high.status_code == 200
        assert r_high.json()["total"] == 30
        print("[OK] Risk level filter (high) verified (found 30 records)")

        # 6. Test predict selected by IDs
        selected_ids = ["CUST-000", "CUST-001", "CUST-002", "CUST-003"]
        r_sel = await client.post("/predict/selected", json={"customer_ids": selected_ids}, headers=headers)
        assert r_sel.status_code == 200, f"Error: {r_sel.text}"
        sel_data = r_sel.json()
        assert sel_data["total_analyzed"] == 4, f"Expected 4, got {sel_data['total_analyzed']}"
        assert sel_data["high_risk_count"] == 2
        assert sel_data["low_risk_count"] == 2
        assert sel_data["primary_customer_id"] is not None
        assert "primary_explanation" in sel_data
        assert "primary_recommendation" in sel_data
        print("[OK] POST /predict/selected by IDs verified (4 analyzed, high=2, low=2, SHAP & recommendations present)")

        # 7. Test predict select all matching
        r_all = await client.post("/predict/selected", json={"select_all_matching": True, "upload_id": "upload_batch_1"}, headers=headers)
        assert r_all.status_code == 200, f"Error: {r_all.text}"
        all_data = r_all.json()
        assert all_data["total_analyzed"] == 30, f"Expected 30, got {all_data['total_analyzed']}"
        assert all_data["high_risk_count"] == 15
        assert all_data["low_risk_count"] == 15
        print("[OK] POST /predict/selected select_all_matching verified (30 analyzed, high=15, low=15)")

    # Cleanup test data
    await database.user_collection.delete_many({"company_id": company_id})
    await database.telco_collection.delete_many({"company_id": company_id})
    print("[OK] Test company and records cleaned up cleanly.")
    print("ALL PAGINATION AND SELECTION BACKEND TESTS PASSED!")

if __name__ == "__main__":
    asyncio.run(test_pagination_and_selection())
