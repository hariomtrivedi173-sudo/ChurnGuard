import sys
import os
import json
import httpx
import asyncio

# Load backend modules
sys.path.append(os.path.join(os.path.dirname(__file__), "..", "backend"))
from database import database
from auth import hash_password

BASE_URL = "http://127.0.0.1:8000"
TEST_EMAIL = "qa.user1@example.com"
TEST_PASS = "Password123!"

async def setup_verified_user():
    users = database["users"]
    await users.update_one(
        {"email": TEST_EMAIL},
        {"$set": {
            "email": TEST_EMAIL,
            "password": hash_password(TEST_PASS),
            "first_name": "QA",
            "last_name": "Tester",
            "company": "QACorp",
            "company_id": "qacorp",
            "phone": "9876543210",
            "email_verified": True
        }},
        upsert=True
    )
    # Also clean up previous test records for qacorp
    await database["customers"].delete_many({"company_id": "qacorp"})
    await database["dashboard_cache"].delete_many({"company_id": "qacorp"})

def main():
    asyncio.run(setup_verified_user())
    print("Test QA user verified in DB.")

    with httpx.Client(base_url=BASE_URL, timeout=30.0) as client:
        print("--- 1. Authenticate QA User ---")
        login_res = client.post("/login", json={"email": TEST_EMAIL, "password": TEST_PASS})
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("Logged in successfully. Token acquired.")

        print("\n--- 2. Test /dataset/validate with 5-row CSV (has missing TotalCharges) ---")
        with open("qa/test_customers_5rows.csv", "rb") as f:
            val_res = client.post("/dataset/validate", files={"file": ("test_customers_5rows.csv", f, "text/csv")}, headers=headers)
        print("Validate status:", val_res.status_code)
        print("Validate response:", val_res.json())
        assert val_res.status_code == 200

        print("\n--- 3. Test /dataset/clean with 5-row CSV ---")
        with open("qa/test_customers_5rows.csv", "rb") as f:
            clean_res = client.post("/dataset/clean", files={"file": ("test_customers_5rows.csv", f, "text/csv")}, headers=headers)
        print("Clean status:", clean_res.status_code)
        print("Clean response:", clean_res.json())
        assert clean_res.status_code == 200
        clean_data = clean_res.json()
        assert clean_data["blank_total_charges_found_and_fixed"] >= 1, "Should have detected blank TotalCharges"

        print("\n--- 4. Test /dataset/store with 5-row CSV ---")
        with open("qa/test_customers_5rows.csv", "rb") as f:
            store_res = client.post("/dataset/store", files={"file": ("test_customers_5rows.csv", f, "text/csv")}, headers=headers)
        print("Store status:", store_res.status_code)
        print("Store response:", store_res.json())
        assert store_res.status_code == 200

        print("\n--- 5. Test /dashboard/stats ---")
        dash_res = client.get("/dashboard/stats", headers=headers)
        print("Dashboard status:", dash_res.status_code)
        dash_data = dash_res.json()
        print("Dashboard available:", dash_data.get("available"))
        print("Total analyzed:", dash_data.get("total_analyzed"))
        print("Avg churn rate:", dash_data.get("avg_churn_rate"))
        print("High risk count:", dash_data.get("high_risk_count"))
        print("Medium risk count:", dash_data.get("medium_risk_count"))
        print("Low risk count:", dash_data.get("low_risk_count"))
        assert dash_res.status_code == 200
        assert dash_data.get("available") is True
        assert dash_data.get("total_analyzed") == 5
        dash_json_str = json.dumps(dash_data)
        assert "NaN" not in dash_json_str and "Infinity" not in dash_json_str

        print("\n--- 6. Test /customers endpoint ---")
        cust_res = client.get("/customers?limit=10", headers=headers)
        print("Customers status:", cust_res.status_code)
        cust_data = cust_res.json()
        print("Total customers in DB:", cust_data.get("total"))
        records = cust_data.get("records", [])
        print("Records returned:", len(records))
        for c in records:
            print(f"Customer {c.get('customerID')}: tenure={c.get('tenure')}, TotalCharges={c.get('TotalCharges')}")
        assert cust_res.status_code == 200
        assert len(records) == 5

        print("\n--- 7. Test /ml/metrics endpoint ---")
        metrics_res = client.get("/ml/metrics", headers=headers)
        print("Metrics status:", metrics_res.status_code)
        metrics_data = metrics_res.json()
        print("Metrics accuracy:", metrics_data.get("accuracy"), "status:", metrics_data.get("status"))
        assert metrics_res.status_code == 200

        print("\n--- 8. Test /dataset/store with single-row CSV ---")
        with open("qa/test_customers_1row.csv", "rb") as f:
            store1_res = client.post("/dataset/store", files={"file": ("test_customers_1row.csv", f, "text/csv")}, headers=headers)
        print("Store 1-row status:", store1_res.status_code)
        print("Store 1-row response:", store1_res.json())
        assert store1_res.status_code == 200

        dash_res2 = client.get("/dashboard/stats", headers=headers)
        dash_data2 = dash_res2.json()
        print("Total analyzed after 1-row insert:", dash_data2.get("total_analyzed"))
        assert dash_data2.get("total_analyzed") == 6

        print("\n--- 9. Test /reports/export/csv endpoint ---")
        export_res = client.get("/reports/export/csv?risk_level=All", headers=headers)
        print("Export CSV status:", export_res.status_code)
        assert export_res.status_code == 200
        assert "customerID" in export_res.text
        lines = export_res.text.strip().split("\n")
        print("Export CSV line count:", len(lines))
        # 1 header + 6 data rows = 7 lines
        assert len(lines) == 7

        print("\nALL SMALL DATASET TESTS PASSED PERFECTLY!")

if __name__ == "__main__":
    main()
