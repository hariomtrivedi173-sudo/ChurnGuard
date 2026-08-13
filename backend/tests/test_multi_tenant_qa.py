import pytest
import sys
import os
import httpx
import pandas as pd
import io
import uuid

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from main import app

def generate_csv_bytes(num_records: int, start_id: int = 1):
    records = []
    for i in range(start_id, start_id + num_records):
        records.append({
            "customerID": f"TEST-{i:05d}",
            "gender": "Female" if i % 2 == 0 else "Male",
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
            "StreamingMovies": "No",
            "Contract": "Month-to-month",
            "PaperlessBilling": "Yes",
            "PaymentMethod": "Electronic check",
            "MonthlyCharges": 70.0,
            "TotalCharges": "840.0",
            "Churn": "No"
        })
    df = pd.DataFrame(records)
    out = io.StringIO()
    df.to_csv(out, index=False)
    return out.getvalue().encode("utf-8")

@pytest.mark.anyio
async def test_full_multi_tenant_isolation_and_upload_lifecycle():
    run_id = uuid.uuid4().hex[:6]
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        # Step 1: Register & Login Company A
        email_a = f"qa_user_a_{run_id}@churnguard.ai"
        comp_a = f"Company Alpha {run_id}"
        reg_a = await client.post("/register", json={
            "email": email_a,
            "password": "password123",
            "first_name": "Alice",
            "last_name": "Admin",
            "company": comp_a,
            "role": "CEO",
            "country": "India"
        })
        assert reg_a.status_code == 200

        login_a = await client.post("/login", json={"email": email_a, "password": "password123"})
        assert login_a.status_code == 200
        token_a = login_a.json()["access_token"]
        headers_a = {"Authorization": f"Bearer {token_a}"}

        # Step 2: Verify Dashboard Company A starts at 0
        dash_a_start = await client.get("/dashboard/stats", headers=headers_a)
        assert dash_a_start.status_code == 200
        assert dash_a_start.json()["total_analyzed"] == 0

        # Step 3: Upload 100 customers to Company A
        csv_100 = generate_csv_bytes(100, start_id=1)
        up_a1 = await client.post(
            "/dataset/store",
            headers=headers_a,
            files={"file": ("dataset_100.csv", csv_100, "text/csv")}
        )
        assert up_a1.status_code == 200
        res_a1 = up_a1.json()
        assert res_a1["new_records"] == 100
        assert res_a1["duplicates_skipped"] == 0
        assert res_a1["total_in_db"] == 100

        # Step 4: Re-upload same CSV to Company A (Duplicate Test)
        up_a2 = await client.post(
            "/dataset/store",
            headers=headers_a,
            files={"file": ("dataset_100.csv", csv_100, "text/csv")}
        )
        assert up_a2.status_code == 200
        res_a2 = up_a2.json()
        assert res_a2["new_records"] == 0
        assert res_a2["duplicates_skipped"] == 100
        assert res_a2["total_in_db"] == 100

        # Step 5: Upload 50 completely new customer IDs to Company A
        csv_50_new = generate_csv_bytes(50, start_id=101)
        up_a3 = await client.post(
            "/dataset/store",
            headers=headers_a,
            files={"file": ("dataset_50.csv", csv_50_new, "text/csv")}
        )
        assert up_a3.status_code == 200
        res_a3 = up_a3.json()
        assert res_a3["new_records"] == 50
        assert res_a3["duplicates_skipped"] == 0
        assert res_a3["total_in_db"] == 150

        # Step 6: Verify Company A customers list and pagination
        cust_a_p1 = await client.get("/telco/customers?page=1&limit=50", headers=headers_a)
        assert cust_a_p1.status_code == 200
        assert cust_a_p1.json()["total"] == 150
        assert len(cust_a_p1.json()["records"]) == 50

        # Step 7: Register & Login Company B
        email_b = f"qa_user_b_{run_id}@churnguard.ai"
        comp_b = f"Company Beta {run_id}"
        reg_b = await client.post("/register", json={
            "email": email_b,
            "password": "password123",
            "first_name": "Bob",
            "last_name": "Builder",
            "company": comp_b,
            "role": "Analyst",
            "country": "United States"
        })
        assert reg_b.status_code == 200

        login_b = await client.post("/login", json={"email": email_b, "password": "password123"})
        assert login_b.status_code == 200
        token_b = login_b.json()["access_token"]
        headers_b = {"Authorization": f"Bearer {token_b}"}

        # Step 8: Verify Company B Dashboard starts at FRESH 0 state (User isolation)
        dash_b_start = await client.get("/dashboard/stats", headers=headers_b)
        assert dash_b_start.status_code == 200
        assert dash_b_start.json()["total_analyzed"] == 0

        cust_b_start = await client.get("/telco/customers?page=1&limit=50", headers=headers_b)
        assert cust_b_start.status_code == 200
        assert cust_b_start.json()["total"] == 0
        assert cust_b_start.json()["records"] == []

        # Step 9: Upload 25 customers to Company B
        csv_25 = generate_csv_bytes(25, start_id=1)
        up_b1 = await client.post(
            "/dataset/store",
            headers=headers_b,
            files={"file": ("dataset_25.csv", csv_25, "text/csv")}
        )
        assert up_b1.status_code == 200
        res_b1 = up_b1.json()
        assert res_b1["new_records"] == 25
        assert res_b1["total_in_db"] == 25

        # Step 10: Verify Company A remains isolated at 150 customers
        cust_a_verify = await client.get("/telco/customers?page=1&limit=50", headers=headers_a)
        assert cust_a_verify.json()["total"] == 150

        # Step 11: Delete 1 customer from Company A
        del_res = await client.delete("/telco/customers/TEST-00001", headers=headers_a)
        assert del_res.status_code == 200

        # Verify Company A is now 149 and Company B is still 25
        cust_a_after_del = await client.get("/telco/customers?page=1&limit=50", headers=headers_a)
        assert cust_a_after_del.json()["total"] == 149

        cust_b_after_del = await client.get("/telco/customers?page=1&limit=50", headers=headers_b)
        assert cust_b_after_del.json()["total"] == 25
