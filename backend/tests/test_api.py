import pytest
import sys
import os
import httpx

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from main import app
from auth import hash_password, verify_password, create_access_token, decode_access_token
from database import user_collection, notification_collection

def test_password_hashing():
    pwd = "secretpassword123"
    hashed = hash_password(pwd)
    assert verify_password(pwd, hashed) is True
    assert verify_password("wrongpassword", hashed) is False

def test_jwt_token():
    payload = {"sub": "testuser@example.com"}
    token = create_access_token(payload)
    decoded = decode_access_token(token)
    assert decoded["sub"] == "testuser@example.com"

@pytest.mark.anyio
async def test_health_check_docs():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/docs")
        assert response.status_code == 200

@pytest.mark.anyio
async def test_protected_route_requires_auth():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/customers/all")
        assert response.status_code == 401

@pytest.mark.anyio
async def test_profile_update_and_password_change_lifecycle():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        test_email = "settings_test_user@churnguard.io"
        await user_collection.delete_many({"email": test_email})

        # Register
        reg_res = await client.post("/register", json={
            "email": test_email,
            "password": "Password123",
            "first_name": "Settings",
            "last_name": "Tester",
            "company": "Secure Tenant Co",
            "phone": "9876543210",
            "role": "Analyst"
        })
        assert reg_res.status_code == 200

        # Login
        login_res = await client.post("/login", json={
            "email": test_email,
            "password": "Password123"
        })
        assert login_res.status_code == 200
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # GET /profile/me
        get_res = await client.get("/profile/me", headers=headers)
        assert get_res.status_code == 200
        profile_data = get_res.json()
        assert profile_data["first_name"] == "Settings"
        assert profile_data["email"] == test_email
        assert "password" not in profile_data

        # PUT /profile/me (valid)
        update_res = await client.put("/profile/me", headers=headers, json={
            "first_name": "Jane",
            "last_name": "Doe",
            "phone": "9123456780",
            "role": "Data Scientist",
            "language": "gu"
        })
        assert update_res.status_code == 200
        updated = update_res.json()["profile"]
        assert updated["first_name"] == "Jane"
        assert updated["phone"] == "9123456780"
        assert updated["language"] == "gu"
        assert "password" not in updated

        # PUT /profile/me (invalid phone format)
        invalid_phone_res = await client.put("/profile/me", headers=headers, json={
            "phone": "12345"
        })
        assert invalid_phone_res.status_code == 400

        # PUT /profile/password (invalid current password)
        wrong_pw_res = await client.put("/profile/password", headers=headers, json={
            "current_password": "WrongPassword",
            "new_password": "NewPassword456"
        })
        assert wrong_pw_res.status_code == 400

        # PUT /profile/password (valid change)
        change_pw_res = await client.put("/profile/password", headers=headers, json={
            "current_password": "Password123",
            "new_password": "NewPassword456"
        })
        assert change_pw_res.status_code == 200

        # Verify login with new password
        new_login_res = await client.post("/login", json={
            "email": test_email,
            "password": "NewPassword456"
        })
        assert new_login_res.status_code == 200

@pytest.mark.anyio
async def test_avatar_photo_lifecycle_and_security():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        test_email = "avatar_tester@churnguard.io"
        await user_collection.delete_many({"email": test_email})

        # Register & Login
        await client.post("/register", json={
            "email": test_email,
            "password": "Password123",
            "first_name": "Avatar",
            "last_name": "Tester",
            "company": "Avatar Corp"
        })
        login_res = await client.post("/login", json={"email": test_email, "password": "Password123"})
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 1. Reject invalid MIME type (e.g. PDF)
        invalid_file = ("document.pdf", b"%PDF-1.4 dummy content", "application/pdf")
        rej_res = await client.post("/profile/photo", headers=headers, files={"file": invalid_file})
        assert rej_res.status_code == 400
        assert "Please upload a JPG, PNG, or WEBP image under 5 MB" in rej_res.json()["detail"]

        # 2. Upload valid PNG image
        valid_file = ("avatar.png", b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR dummy valid png image data", "image/png")
        upload_res = await client.post("/profile/photo", headers=headers, files={"file": valid_file})
        assert upload_res.status_code == 200
        photo_url = upload_res.json()["photo_url"]
        assert photo_url.startswith("/uploads/avatars/")

        # 3. Verify GET /profile/me reflects photo_url
        get_res = await client.get("/profile/me", headers=headers)
        assert get_res.status_code == 200
        assert get_res.json()["photo_url"] == photo_url

        # 4. DELETE /profile/photo
        del_res = await client.delete("/profile/photo", headers=headers)
        assert del_res.status_code == 200

        # 5. Verify GET /profile/me photo_url is None
        get_res2 = await client.get("/profile/me", headers=headers)
        assert get_res2.status_code == 200
        assert get_res2.json()["photo_url"] is None

@pytest.mark.anyio
async def test_notifications_lifecycle_and_tenant_isolation():
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        # Create User 1 in Company Alpha
        u1_email = "user1_alpha@churnguard.io"
        await user_collection.delete_many({"email": u1_email})
        await client.post("/register", json={"email": u1_email, "password": "Password123", "company": "Alpha Corp"})
        l1 = await client.post("/login", json={"email": u1_email, "password": "Password123"})
        h1 = {"Authorization": f"Bearer {l1.json()['access_token']}"}

        # Create User 2 in Company Beta
        u2_email = "user2_beta@churnguard.io"
        await user_collection.delete_many({"email": u2_email})
        await client.post("/register", json={"email": u2_email, "password": "Password123", "company": "Beta Inc"})
        l2 = await client.post("/login", json={"email": u2_email, "password": "Password123"})
        h2 = {"Authorization": f"Bearer {l2.json()['access_token']}"}

        # 1. Fetch notifications for User 1 (should auto-seed defaults)
        n1_res = await client.get("/notifications", headers=h1)
        assert n1_res.status_code == 200
        n1_data = n1_res.json()
        assert len(n1_data["notifications"]) > 0
        assert n1_data["unread_count"] > 0
        u1_first_notif_id = n1_data["notifications"][0]["id"]

        # 2. Multi-tenant isolation: User 2 cannot mark User 1's notification as read
        u2_hijack = await client.patch(f"/notifications/{u1_first_notif_id}/read", headers=h2)
        assert u2_hijack.status_code == 404

        # 3. User 1 marks single notification as read
        mark_single_res = await client.patch(f"/notifications/{u1_first_notif_id}/read", headers=h1)
        assert mark_single_res.status_code == 200

        # 4. User 1 marks all as read
        mark_all_res = await client.patch("/notifications/mark-read", headers=h1)
        assert mark_all_res.status_code == 200
        n1_res_after_read = await client.get("/notifications", headers=h1)
        assert n1_res_after_read.json()["unread_count"] == 0
        assert len(n1_res_after_read.json()["notifications"]) > 0

        # 5. User 1 clears all notifications
        clear_res = await client.delete("/notifications", headers=h1)
        assert clear_res.status_code == 200
        # User 2 notifications still exist!
        n2_res = await client.get("/notifications", headers=h2)
        assert len(n2_res.json()["notifications"]) > 0
