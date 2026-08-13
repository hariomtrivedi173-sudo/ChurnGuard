import pytest
import sys
import os
import httpx
import uuid

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from main import app
from auth import get_company_id_for_name

def test_company_id_generation():
    assert get_company_id_for_name("Company A", "usera@example.com") == "comp_company_a"
    assert get_company_id_for_name("   Company B  ", "userb@example.com") == "comp_company_b"
    assert get_company_id_for_name("", "test.user@example.com") == "comp_test_user"

@pytest.mark.anyio
async def test_register_and_login_company_isolation():
    run_id = uuid.uuid4().hex[:6]
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        email_a = f"usera_{run_id}@example.com"
        # Register User A
        reg_a = await client.post("/register", json={
            "email": email_a,
            "password": "password123",
            "first_name": "User",
            "last_name": "A",
            "company": "Company A",
            "role": "CEO",
            "country": "India"
        })
        assert reg_a.status_code == 200

        # Login User A
        login_resp_a = await client.post("/login", json={"email": email_a, "password": "password123"})
        assert login_resp_a.status_code == 200
        token_a = login_resp_a.json()["access_token"]
        assert login_resp_a.json()["company_id"] == "comp_company_a"

        # Profile User A
        profile_a = await client.get("/profile/me", headers={"Authorization": f"Bearer {token_a}"})
        assert profile_a.status_code == 200
        pdata_a = profile_a.json()
        assert pdata_a["company"] == "Company A"
        assert pdata_a["company_id"] == "comp_company_a"
        assert pdata_a["email"] == email_a

        # Register User B
        email_b = f"userb_{run_id}@example.com"
        reg_b = await client.post("/register", json={
            "email": email_b,
            "password": "password123",
            "first_name": "User",
            "last_name": "B",
            "company": "Company B",
            "role": "Analyst",
            "country": "United States"
        })
        assert reg_b.status_code == 200

        login_resp_b = await client.post("/login", json={"email": email_b, "password": "password123"})
        assert login_resp_b.status_code == 200
        token_b = login_resp_b.json()["access_token"]
        assert login_resp_b.json()["company_id"] == "comp_company_b"

        profile_b = await client.get("/profile/me", headers={"Authorization": f"Bearer {token_b}"})
        assert profile_b.status_code == 200
        pdata_b = profile_b.json()
        assert pdata_b["company"] == "Company B"
        assert pdata_b["company_id"] == "comp_company_b"
