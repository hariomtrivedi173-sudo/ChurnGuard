import asyncio
import io
import httpx
from PIL import Image

BASE_URL = "http://127.0.0.1:8000"

async def test_profile_lifecycle():
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=15.0) as client:
        print("1. Logging in...")
        login_res = await client.post("/login", json={
            "email": "hariomtrivedi173@gmail.com",
            "password": "Password@123"
        })
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("   Login successful! Token acquired.")

        print("2. Fetching GET /profile/me...")
        get_res = await client.get("/profile/me", headers=headers)
        assert get_res.status_code == 200, f"GET /profile/me failed: {get_res.text}"
        init_prof = get_res.json()
        print("   Current profile loaded:", init_prof)
        assert "email" in init_prof
        assert "first_name" in init_prof
        assert "company" in init_prof

        print("3. Updating profile fields with PUT /profile/me...")
        update_payload = {
            "first_name": "Hariom",
            "last_name": "Trivedi",
            "company": "Indus Net Tech",
            "role": "Data Scientist",
            "phone": "9876543210",
            "country": "India",
            "language": "en"
        }
        put_res = await client.put("/profile/me", json=update_payload, headers=headers)
        assert put_res.status_code == 200, f"PUT /profile/me failed: {put_res.text}"
        updated_prof = put_res.json()["profile"]
        print("   PUT /profile/me returned:", updated_prof)
        for k, v in update_payload.items():
            assert updated_prof[k] == v, f"Mismatch for {k}: expected {v}, got {updated_prof.get(k)}"

        print("4. Verifying persistence via fresh GET /profile/me...")
        verify_res = await client.get("/profile/me", headers=headers)
        assert verify_res.status_code == 200
        v_prof = verify_res.json()
        for k, v in update_payload.items():
            assert v_prof[k] == v, f"Persistence failure for {k}: {v_prof.get(k)} != {v}"
        print("   Persistence verified in MongoDB!")

        print("5. Uploading profile photo via POST /profile/photo...")
        # Generate in-memory PNG image
        img = Image.new("RGB", (128, 128), color=(124, 58, 237))
        img_byte_arr = io.BytesIO()
        img.save(img_byte_arr, format="PNG")
        img_bytes = img_byte_arr.getvalue()

        files = {"file": ("test_avatar.png", img_bytes, "image/png")}
        upload_res = await client.post("/profile/photo", files=files, headers=headers)
        assert upload_res.status_code == 200, f"Upload photo failed: {upload_res.text}"
        photo_url = upload_res.json()["photo_url"]
        print(f"   Photo uploaded successfully! URL: {photo_url}")
        assert photo_url.startswith("/uploads/avatars/"), f"Unexpected photo_url format: {photo_url}"

        print("6. Fetching photo file directly from static mount...")
        img_get_res = await client.get(photo_url)
        assert img_get_res.status_code == 200, f"Static photo file fetch failed: {img_get_res.status_code}"
        assert len(img_get_res.content) > 0
        print(f"   Static file served successfully! Content-Type: {img_get_res.headers.get('content-type')}, Size: {len(img_get_res.content)} bytes")

        print("7. Verifying GET /profile/me reflects photo_url...")
        verify_photo_res = await client.get("/profile/me", headers=headers)
        assert verify_photo_res.status_code == 200
        assert verify_photo_res.json()["photo_url"] == photo_url, "photo_url mismatch in /profile/me"
        print("   photo_url persisted in MongoDB Atlas user profile!")

        print("8. Deleting profile photo via DELETE /profile/photo...")
        del_res = await client.delete("/profile/photo", headers=headers)
        assert del_res.status_code == 200, f"Delete photo failed: {del_res.text}"
        print("   Photo delete endpoint returned 200 OK.")

        print("9. Verifying GET /profile/me has photo_url == None (fallback to initials)...")
        get_after_del = await client.get("/profile/me", headers=headers)
        assert get_after_del.status_code == 200
        assert get_after_del.json()["photo_url"] is None, "photo_url should be None after delete"
        print("   photo_url is None! Initials fallback verified.")

        print("10. Testing fresh login to verify persistence across sessions...")
        login_res2 = await client.post("/login", json={
            "email": "hariomtrivedi173@gmail.com",
            "password": "Password@123"
        })
        assert login_res2.status_code == 200
        token2 = login_res2.json()["access_token"]
        headers2 = {"Authorization": f"Bearer {token2}"}
        verify_session2 = await client.get("/profile/me", headers=headers2)
        assert verify_session2.status_code == 200
        s2_prof = verify_session2.json()
        for k, v in update_payload.items():
            assert s2_prof[k] == v, f"Session 2 persistence failure for {k}"
        print("   All profile values persisted across login/logout session!")

        print("\nALL 10 PROFILE QA CHECKS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    asyncio.run(test_profile_lifecycle())
