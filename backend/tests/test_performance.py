import pytest
import sys
import os
import time
import httpx
import pandas as pd
import io
import uuid

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from main import app
from ml.batch_predict import predict_batch

def generate_csv_bytes(num_records: int, start_id: int = 1):
    records = []
    for i in range(start_id, start_id + num_records):
        records.append({
            "customerID": f"PERF-{i:05d}",
            "gender": "Female" if i % 2 == 0 else "Male",
            "SeniorCitizen": 0,
            "Partner": "Yes",
            "Dependents": "No",
            "tenure": 18,
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
            "MonthlyCharges": 75.5,
            "TotalCharges": "1359.0",
            "Churn": "No"
        })
    df = pd.DataFrame(records)
    out = io.StringIO()
    df.to_csv(out, index=False)
    return out.getvalue().encode("utf-8")


@pytest.mark.anyio
async def test_performance_benchmarks():
    """
    Comprehensive performance test measuring response times and correctness
    across all major operations: Add, Update, Delete, Search, Pagination,
    Prediction, Batch Prediction, Dashboard, and CSV Upload.
    """
    run_id = uuid.uuid4().hex[:6]
    perf_metrics = {}

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        # Setup: Register & Login
        email = f"perf_user_{run_id}@churnguard.ai"
        comp = f"Performance Corp {run_id}"
        await client.post("/register", json={
            "email": email,
            "password": "password123",
            "company": comp,
        })
        login_res = await client.post("/login", json={"email": email, "password": "password123"})
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Benchmark CSV Upload (Bulk ingest of 200 records)
        csv_data = generate_csv_bytes(200, start_id=1)
        t0 = time.perf_counter()
        up_res = await client.post(
            "/dataset/store",
            headers=headers,
            files={"file": ("perf_data.csv", csv_data, "text/csv")}
        )
        t_upload = (time.perf_counter() - t0) * 1000
        perf_metrics["CSV Upload (200 rows)"] = t_upload
        assert up_res.status_code == 200
        assert up_res.json()["new_records"] == 200

        # 2. Benchmark Server-Side Pagination
        t0 = time.perf_counter()
        page_res = await client.get("/telco/customers?page=1&limit=50", headers=headers)
        t_pagination = (time.perf_counter() - t0) * 1000
        perf_metrics["Pagination (page=1, limit=50)"] = t_pagination
        assert page_res.status_code == 200
        page_data = page_res.json()
        assert page_data["total"] == 200
        assert len(page_data["records"]) == 50

        # 3. Benchmark Search Customers (Indexed regex)
        t0 = time.perf_counter()
        search_res = await client.get("/telco/customers?search=Fiber", headers=headers)
        t_search = (time.perf_counter() - t0) * 1000
        perf_metrics["Search Customers"] = t_search
        assert search_res.status_code == 200
        assert search_res.json()["total"] == 200

        # 4. Benchmark Fast Customer Add
        new_customer_id = f"PERF-ADD-{run_id}"
        add_payload = {
            "customerID": new_customer_id,
            "gender": "Female",
            "SeniorCitizen": "No",
            "Partner": "Yes",
            "Dependents": "No",
            "tenure": 24,
            "PhoneService": "Yes",
            "MultipleLines": "Yes",
            "InternetService": "Fiber optic",
            "OnlineSecurity": "Yes",
            "TechSupport": "Yes",
            "Contract": "Two year",
            "PaperlessBilling": "Yes",
            "PaymentMethod": "Credit card (automatic)",
            "MonthlyCharges": 95.0,
            "TotalCharges": 2280.0,
            "Churn": "No"
        }
        t0 = time.perf_counter()
        add_res = await client.post("/telco/customers", headers=headers, json=add_payload)
        t_add = (time.perf_counter() - t0) * 1000
        perf_metrics["Add Customer"] = t_add
        assert add_res.status_code == 200
        assert add_res.json()["customer"]["customerID"] == new_customer_id

        # 5. Benchmark Fast Customer Update
        update_payload = {
            "Contract": "One year",
            "MonthlyCharges": 85.0,
            "TotalCharges": 2040.0
        }
        t0 = time.perf_counter()
        update_res = await client.put(f"/telco/customers/{new_customer_id}", headers=headers, json=update_payload)
        t_update = (time.perf_counter() - t0) * 1000
        perf_metrics["Update Customer"] = t_update
        assert update_res.status_code == 200
        assert update_res.json()["customer"]["Contract"] == "One year"

        # 6. Benchmark Fast Customer Delete
        t0 = time.perf_counter()
        del_res = await client.delete(f"/telco/customers/{new_customer_id}", headers=headers)
        t_delete = (time.perf_counter() - t0) * 1000
        perf_metrics["Delete Customer"] = t_delete
        assert del_res.status_code == 200

        # 7. Benchmark Single Prediction (/predict/full)
        single_input = {
            "gender": "Male",
            "SeniorCitizen": "No",
            "Partner": "No",
            "Dependents": "No",
            "tenure": 3,
            "PhoneService": "Yes",
            "MultipleLines": "No",
            "InternetService": "Fiber optic",
            "OnlineSecurity": "No",
            "OnlineBackup": "No",
            "DeviceProtection": "No",
            "TechSupport": "No",
            "StreamingTV": "No",
            "StreamingMovies": "No",
            "Contract": "Month-to-month",
            "PaperlessBilling": "Yes",
            "PaymentMethod": "Electronic check",
            "MonthlyCharges": 70.0,
            "TotalCharges": 210.0
        }
        t0 = time.perf_counter()
        pred_res = await client.post("/predict/full", headers=headers, json=single_input)
        t_pred = (time.perf_counter() - t0) * 1000
        perf_metrics["Single Prediction"] = t_pred
        assert pred_res.status_code == 200
        assert "churn_probability" in pred_res.json()
        assert "risk_level" in pred_res.json()

        # 8. Benchmark Batch Prediction (/predict/batch-all)
        t0 = time.perf_counter()
        batch_res = await client.post("/predict/batch-all", headers=headers)
        t_batch = (time.perf_counter() - t0) * 1000
        perf_metrics["Batch Prediction (200 rows)"] = t_batch
        assert batch_res.status_code == 200
        assert batch_res.json()["total_analyzed"] == 200

        # 9. Benchmark Dashboard Stats (Cached)
        t0 = time.perf_counter()
        dash_res = await client.get("/dashboard/stats", headers=headers)
        t_dash_cached = (time.perf_counter() - t0) * 1000
        perf_metrics["Dashboard Stats (Cached)"] = t_dash_cached
        assert dash_res.status_code == 200
        assert dash_res.json()["total_analyzed"] == 200

    print("\n" + "=" * 60)
    print("CHURNGUARD PERFORMANCE BENCHMARK REPORT")
    print("=" * 60)
    for op, ms in perf_metrics.items():
        status = "PASS" if ms < 5000 else "SLOW"
        print(f"{op:<35} | {ms:>8.1f} ms | {status}")
    print("=" * 60)
