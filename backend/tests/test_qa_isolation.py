import pytest
import sys
import os
import httpx
import uuid

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from main import app
from database import user_collection, otp_collection, telco_collection, database

@pytest.mark.anyio
async def test_multi_tenant_company_isolation_qa():
    """
    Exact QA Verification according to task specification:
    1. Register Company A
    2. Login Company A
    3. Confirm its data
    4. Logout
    5. Register Company B
    6. Login Company B
    7. Confirm:
       customers = 0
       uploads = 0
       dashboard stats = 0
    8. Login Company A again
    9. Confirm Company A data is unchanged
    """
    run_id = uuid.uuid4().hex[:6]
    email_a = f"usera_{run_id}@companya.com"
    email_b = f"userb_{run_id}@companyb.com"
    pw = "SecurePass123"

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        # ── Step 1: Register Company A ──
        print("\n--- STEP 1: Register Company A ---")
        reg_a = await client.post("/register", json={
            "email": email_a,
            "password": pw,
            "first_name": "Alice",
            "last_name": "Admin",
            "phone": "9876543210",
            "company": "Company A",
            "role": "CEO",
            "country": "India"
        })
        assert reg_a.status_code == 200, f"Register A failed: {reg_a.text}"

        # Verify registration OTP for User A
        otp_doc_a = await otp_collection.find_one({"email": email_a, "purpose": "email_verification"})
        assert otp_doc_a is not None, "OTP record not created for User A"
        # Activate account directly or via verify-registration
        await user_collection.update_one({"email": email_a}, {"$set": {"email_verified": True}})

        # ── Step 2: Login Company A ──
        print("--- STEP 2: Login Company A ---")
        login_a = await client.post("/login", json={"email": email_a, "password": pw})
        assert login_a.status_code == 200, f"Login A failed: {login_a.text}"
        data_a = login_a.json()
        token_a = data_a["access_token"]
        assert data_a["company_id"] == "comp_company_a"
        headers_a = {"Authorization": f"Bearer {token_a}"}

        # ── Step 3: Confirm its data ──
        print("--- STEP 3: Confirm Company A data ---")
        dash_a = await client.get("/dashboard/stats", headers=headers_a)
        assert dash_a.status_code == 200
        stats_a = dash_a.json()
        print(f"Company A Dashboard total_analyzed: {stats_a.get('total_analyzed')}")
        assert stats_a.get("total_analyzed", 0) > 0, "Company A must have data"
        assert len(stats_a.get("results", [])) > 0

        cust_a = await client.get("/telco/customers?page=1&limit=50", headers=headers_a)
        assert cust_a.status_code == 200
        telco_data_a = cust_a.json()
        print(f"Company A Telco customers count: {telco_data_a.get('total')}")
        assert telco_data_a.get("total", 0) > 0, "Company A customers should not be 0"

        up_a = await client.get("/uploads/history", headers=headers_a)
        assert up_a.status_code == 200
        history_a = up_a.json()
        print(f"Company A Upload history count: {len(history_a)}")
        assert len(history_a) > 0, "Company A upload history should not be empty"

        initial_cust_count_a = telco_data_a["total"]
        initial_analyzed_a = stats_a["total_analyzed"]
        initial_uploads_a = len(history_a)

        # ── Step 4: Logout ──
        print("--- STEP 4: Logout User A ---")
        # In JWT stateless auth, logout on client clears the token
        headers_a_logged_out = {}

        # ── Step 5: Register Company B ──
        print("--- STEP 5: Register Company B ---")
        reg_b = await client.post("/register", json={
            "email": email_b,
            "password": pw,
            "first_name": "Bob",
            "last_name": "Builder",
            "phone": "9876543211",
            "company": "Company B",
            "role": "Analyst",
            "country": "India"
        })
        assert reg_b.status_code == 200, f"Register B failed: {reg_b.text}"
        await user_collection.update_one({"email": email_b}, {"$set": {"email_verified": True}})

        # ── Step 6: Login Company B ──
        print("--- STEP 6: Login Company B ---")
        login_b = await client.post("/login", json={"email": email_b, "password": pw})
        assert login_b.status_code == 200, f"Login B failed: {login_b.text}"
        data_b = login_b.json()
        token_b = data_b["access_token"]
        assert data_b["company_id"] == "comp_company_b"
        headers_b = {"Authorization": f"Bearer {token_b}"}

        # ── Step 7: Confirm Company B starts completely empty ──
        print("--- STEP 7: Confirm Company B is completely empty ---")
        # 7a. customers = 0
        cust_b = await client.get("/telco/customers?page=1&limit=50", headers=headers_b)
        assert cust_b.status_code == 200
        assert cust_b.json()["total"] == 0, f"Expected 0 customers for Company B, got {cust_b.json()['total']}"
        assert cust_b.json()["records"] == []

        cust_all_b = await client.get("/customers/all", headers=headers_b)
        assert cust_all_b.status_code == 200
        assert cust_all_b.json() == []

        # 7b. uploads = 0
        up_b = await client.get("/uploads/history", headers=headers_b)
        assert up_b.status_code == 200
        assert len(up_b.json()) == 0, f"Expected 0 upload history for Company B, got {len(up_b.json())}"

        # 7c. dashboard stats = 0
        dash_b = await client.get("/dashboard/stats", headers=headers_b)
        assert dash_b.status_code == 200
        assert dash_b.json()["total_analyzed"] == 0, f"Expected total_analyzed=0, got {dash_b.json()['total_analyzed']}"
        assert dash_b.json()["results"] == []

        # 7d. Analytics / ML empty
        ml_b = await client.get("/ml/metrics", headers=headers_b)
        assert ml_b.status_code == 200
        assert ml_b.json()["accuracy"] == 0.0

        seg_b = await client.get("/ml/segments", headers=headers_b)
        assert seg_b.status_code == 200
        assert seg_b.json() == []

        # ── Step 8: Login Company A again ──
        print("--- STEP 8: Login Company A again ---")
        login_a2 = await client.post("/login", json={"email": email_a, "password": pw})
        assert login_a2.status_code == 200
        token_a2 = login_a2.json()["access_token"]
        headers_a2 = {"Authorization": f"Bearer {token_a2}"}

        # ── Step 9: Confirm Company A data is unchanged ──
        print("--- STEP 9: Confirm Company A data is unchanged ---")
        dash_a2 = await client.get("/dashboard/stats", headers=headers_a2)
        assert dash_a2.status_code == 200
        assert dash_a2.json()["total_analyzed"] == initial_analyzed_a, "Company A dashboard stats modified!"

        cust_a2 = await client.get("/telco/customers?page=1&limit=50", headers=headers_a2)
        assert cust_a2.status_code == 200
        assert cust_a2.json()["total"] == initial_cust_count_a, "Company A customers count modified!"

        up_a2 = await client.get("/uploads/history", headers=headers_a2)
        assert up_a2.status_code == 200
        assert len(up_a2.json()) == initial_uploads_a, "Company A upload history modified!"

        print("=== ALL 9 QA STEPS PASSED PERFECTLY ===")

        # Clean up test users
        await user_collection.delete_many({"email": {"$in": [email_a, email_b]}})

if __name__ == "__main__":
    import asyncio
    asyncio.run(test_multi_tenant_company_isolation_qa())
