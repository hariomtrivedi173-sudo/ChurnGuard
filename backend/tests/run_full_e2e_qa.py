import os
import sys
import time
import re
import asyncio
import httpx
from bson import ObjectId

# Add backend directory to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
from database import (
    user_collection,
    telco_collection,
    notification_collection,
    otp_collection,
    database
)

BASE_URL = "http://127.0.0.1:8000"
LOG_PATH = r"C:\Users\hario\.gemini\antigravity-ide\brain\9b4b6dbe-f53b-4dd3-aa1d-6e323ef2eab4\.system_generated\tasks\task-318.log"
DATASET_7043 = os.path.abspath(r"dataset\customer_data.csv.csv")
DATASET_50 = os.path.abspath(r"backend\qa_50_new_customers.csv")

RESULTS = {}
BUGS = []

def record(step_num, name, passed, details=""):
    RESULTS[step_num] = {
        "name": name,
        "passed": passed,
        "details": details
    }
    status = "PASS" if passed else "FAIL"
    print(f"[{status}] Step {step_num}: {name} - {details}")

def get_latest_otp(email, timeout=10.0):
    t0 = time.time()
    while time.time() - t0 < timeout:
        if os.path.exists(LOG_PATH):
            with open(LOG_PATH, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
            matches = re.findall(rf'\[Register\] OTP generated for {re.escape(email)}:\s*(\d{{6}})', content)
            if matches:
                return matches[-1]
        time.sleep(0.5)
    return None

async def clean_tenant(company_id, emails):
    print(f"Cleaning tenant data for {company_id} and emails: {emails}...")
    await telco_collection.delete_many({"company_id": company_id})
    await database["dataset_uploads"].delete_many({"company_id": company_id})
    await database["dashboard_cache"].delete_many({"company_id": company_id})
    await notification_collection.delete_many({"company_id": company_id})
    for email in emails:
        norm = email.strip().lower()
        await user_collection.delete_many({"email": norm})
        await otp_collection.delete_many({"email": norm})
    print(f"Cleaned tenant {company_id}.")

async def run_qa_suite():
    email_a = "qa_tester_a@companya.com"
    email_b = "qa_tester_b@companyb.com"
    password = "Password123!"

    client = httpx.AsyncClient(base_url=BASE_URL, timeout=120.0)

    # Initial tenant cleanup to guarantee fresh testing state
    await clean_tenant("comp_company_a", [email_a])
    await clean_tenant("comp_company_b", [email_b])

    token_a = None
    token_b = None
    first_customer_id = None

    try:
        # =====================================================================
        # 1. Register Company A
        # =====================================================================
        reg_payload_a = {
            "first_name": "Alice",
            "last_name": "QA",
            "email": email_a,
            "phone": "9876543210",
            "password": password,
            "company": "Company A",
            "company_type": "Private Limited Company",
            "industry": "Information Technology",
            "department": "Analytics",
            "company_size": "11–50 employees",
            "country": "India"
        }
        res = await client.post("/register", json=reg_payload_a)
        if res.status_code != 200:
            record(1, "Register Company A", False, f"HTTP {res.status_code}: {res.text}")
        else:
            otp_a = get_latest_otp(email_a)
            if not otp_a:
                record(1, "Register Company A", False, "Could not extract OTP from server log")
            else:
                verify_res = await client.post("/auth/verify-registration", json={"email": email_a, "otp": otp_a})
                if verify_res.status_code == 200:
                    record(1, "Register Company A", True, f"Registered and OTP verified ({otp_a})")
                else:
                    record(1, "Register Company A", False, f"OTP verification failed: {verify_res.text}")

        # =====================================================================
        # 2. Login
        # =====================================================================
        login_res = await client.post("/login", json={"email": email_a, "password": password})
        if login_res.status_code == 200 and "access_token" in login_res.json():
            token_a = login_res.json()["access_token"]
            comp_id = login_res.json().get("company_id")
            record(2, "Login", True, f"JWT received for company {comp_id}")
        else:
            record(2, "Login", False, f"HTTP {login_res.status_code}: {login_res.text}")

        headers_a = {"Authorization": f"Bearer {token_a}"} if token_a else {}

        # =====================================================================
        # 3. Dashboard = 0
        # =====================================================================
        dash_res = await client.get("/dashboard/stats", headers=headers_a)
        if dash_res.status_code == 200:
            dash_data = dash_res.json()
            total_analyzed = dash_data.get("total_analyzed", -1)
            if total_analyzed == 0:
                record(3, "Dashboard = 0", True, f"total_analyzed is {total_analyzed}")
            else:
                record(3, "Dashboard = 0", False, f"total_analyzed is {total_analyzed}, expected 0")
        else:
            record(3, "Dashboard = 0", False, f"HTTP {dash_res.status_code}: {dash_res.text}")

        # =====================================================================
        # 4. Upload 7043
        # =====================================================================
        t_up0 = time.time()
        with open(DATASET_7043, "rb") as f:
            upload_res = await client.post(
                "/dataset/upload",
                files={"file": (os.path.basename(DATASET_7043), f, "text/csv")},
                headers=headers_a
            )
        up_duration = time.time() - t_up0
        if upload_res.status_code == 200:
            up_data = upload_res.json()
            new_recs = up_data.get("new_records", up_data.get("inserted"))
            total_rows = up_data.get("total_rows")
            if new_recs == 7043 and total_rows == 7043:
                record(4, "Upload 7043", True, f"Uploaded {new_recs} records in {up_duration:.2f}s")
            else:
                record(4, "Upload 7043", False, f"Expected 7043, got new_records={new_recs}, total_rows={total_rows}")
        else:
            record(4, "Upload 7043", False, f"HTTP {upload_res.status_code}: {upload_res.text}")

        # =====================================================================
        # 5. Atlas = 7043
        # =====================================================================
        atlas_count = await telco_collection.count_documents({"company_id": "comp_company_a"})
        if atlas_count == 7043:
            record(5, "Atlas = 7043", True, f"Direct MongoDB count is {atlas_count}")
        else:
            record(5, "Atlas = 7043", False, f"Atlas count is {atlas_count}, expected 7043")

        # =====================================================================
        # 6. Dashboard = 7043
        # =====================================================================
        dash_res = await client.get("/dashboard/stats", headers=headers_a)
        if dash_res.status_code == 200:
            dash_data = dash_res.json()
            total_analyzed = dash_data.get("total_analyzed", -1)
            if total_analyzed == 7043:
                record(6, "Dashboard = 7043", True, f"total_analyzed is {total_analyzed}")
            else:
                record(6, "Dashboard = 7043", False, f"total_analyzed is {total_analyzed}, expected 7043")
        else:
            record(6, "Dashboard = 7043", False, f"HTTP {dash_res.status_code}: {dash_res.text}")

        # =====================================================================
        # 7. Duplicate upload -> 0 new
        # =====================================================================
        with open(DATASET_7043, "rb") as f:
            dup_res = await client.post(
                "/dataset/upload",
                files={"file": (os.path.basename(DATASET_7043), f, "text/csv")},
                headers=headers_a
            )
        if dup_res.status_code == 200:
            dup_data = dup_res.json()
            new_recs = dup_data.get("new_records", dup_data.get("inserted"))
            dups_skipped = dup_data.get("duplicates_skipped", dup_data.get("duplicate_rows"))
            if new_recs == 0 and dups_skipped == 7043:
                record(7, "Duplicate upload -> 0 new", True, f"new_records={new_recs}, duplicates_skipped={dups_skipped}")
            else:
                record(7, "Duplicate upload -> 0 new", False, f"Expected new=0, skipped=7043; got new={new_recs}, skipped={dups_skipped}")
        else:
            record(7, "Duplicate upload -> 0 new", False, f"HTTP {dup_res.status_code}: {dup_res.text}")

        # =====================================================================
        # 8. Upload 50 new -> 7093
        # =====================================================================
        with open(DATASET_50, "rb") as f:
            up50_res = await client.post(
                "/dataset/upload",
                files={"file": (os.path.basename(DATASET_50), f, "text/csv")},
                headers=headers_a
            )
        atlas_count_after_50 = await telco_collection.count_documents({"company_id": "comp_company_a"})
        dash_res = await client.get("/dashboard/stats", headers=headers_a)
        dash_total = dash_res.json().get("total_analyzed") if dash_res.status_code == 200 else None
        
        if up50_res.status_code == 200 and atlas_count_after_50 == 7093 and dash_total == 7093:
            up50_data = up50_res.json()
            record(8, "Upload 50 new -> 7093", True, f"new_records={up50_data.get('new_records')}, atlas={atlas_count_after_50}, dash={dash_total}")
        else:
            record(8, "Upload 50 new -> 7093", False, f"HTTP {up50_res.status_code}, atlas={atlas_count_after_50}, dash={dash_total}")

        # =====================================================================
        # 9. Customers pagination
        # =====================================================================
        p1_res = await client.get("/telco/customers?page=1&limit=50", headers=headers_a)
        p2_res = await client.get("/telco/customers?page=2&limit=50", headers=headers_a)
        if p1_res.status_code == 200 and p2_res.status_code == 200:
            p1_data = p1_res.json()
            p2_data = p2_res.json()
            recs1 = p1_data.get("records", p1_data.get("data", []))
            recs2 = p2_data.get("records", p2_data.get("data", []))
            ids1 = {r["customerID"] for r in recs1}
            ids2 = {r["customerID"] for r in recs2}
            
            p1_ok = len(recs1) == 50 and p1_data.get("total") == 7093 and p1_data.get("page") == 1
            p2_ok = len(recs2) == 50 and p2_data.get("page") == 2
            distinct_ok = len(ids1.intersection(ids2)) == 0
            
            if p1_ok and p2_ok and distinct_ok:
                first_customer_id = recs1[0]["customerID"]
                record(9, "Customers pagination", True, f"Page 1 & 2 returned 50 distinct items each, total={p1_data.get('total')}, total_pages={p1_data.get('total_pages')}")
            else:
                record(9, "Customers pagination", False, f"p1_len={len(recs1)}, p2_len={len(recs2)}, total={p1_data.get('total')}, overlap={len(ids1.intersection(ids2))}")
        else:
            record(9, "Customers pagination", False, f"p1: {p1_res.status_code}, p2: {p2_res.status_code}")

        # =====================================================================
        # 10. Search
        # =====================================================================
        search_term = first_customer_id if first_customer_id else "7590-VHVEG"
        search_res = await client.get(f"/telco/customers?search={search_term}", headers=headers_a)
        search_contract_res = await client.get("/telco/customers?search=Month-to-month&limit=10", headers=headers_a)
        if search_res.status_code == 200 and search_contract_res.status_code == 200:
            s_data = search_res.json()
            s_recs = s_data.get("records", s_data.get("data", []))
            c_data = search_contract_res.json()
            c_recs = c_data.get("records", c_data.get("data", []))
            
            s_match = any(r.get("customerID") == search_term for r in s_recs)
            c_match = all(r.get("Contract") == "Month-to-month" for r in c_recs) if c_recs else False
            
            if s_match and c_match:
                record(10, "Search", True, f"Found exact customerID {search_term} and verified Contract filter")
            else:
                record(10, "Search", False, f"s_match={s_match}, c_match={c_match}, recs_count={len(s_recs)}")
        else:
            record(10, "Search", False, f"HTTP {search_res.status_code} / {search_contract_res.status_code}")

        # =====================================================================
        # 11. Delete 1 -> 7092
        # =====================================================================
        if not first_customer_id:
            first_customer_id = "7590-VHVEG"
        del_res = await client.delete(f"/telco/customers/{first_customer_id}", headers=headers_a)
        atlas_after_del = await telco_collection.count_documents({"company_id": "comp_company_a"})
        dash_res = await client.get("/dashboard/stats", headers=headers_a)
        dash_after_del = dash_res.json().get("total_analyzed") if dash_res.status_code == 200 else None
        
        if del_res.status_code == 200 and atlas_after_del == 7092 and dash_after_del == 7092:
            record(11, "Delete 1 -> 7092", True, f"Deleted {first_customer_id}. Atlas={atlas_after_del}, Dashboard={dash_after_del}")
        else:
            record(11, "Delete 1 -> 7092", False, f"HTTP {del_res.status_code}, Atlas={atlas_after_del}, Dashboard={dash_after_del}")

        # =====================================================================
        # 12. Analytics updates
        # =====================================================================
        metrics_res = await client.get("/ml/metrics", headers=headers_a)
        if metrics_res.status_code == 200:
            m_data = metrics_res.json()
            acc = m_data.get("accuracy", 0.0)
            cm = m_data.get("confusion_matrix", {})
            feat = m_data.get("feature_importance", [])
            if acc > 0 and len(feat) > 0 and isinstance(cm, dict):
                record(12, "Analytics updates", True, f"Metrics calculated: accuracy={acc}, features={len(feat)}, cm={cm}")
            else:
                record(12, "Analytics updates", False, f"Metrics incomplete: acc={acc}, feat_len={len(feat)}")
        else:
            record(12, "Analytics updates", False, f"HTTP {metrics_res.status_code}: {metrics_res.text}")

        # =====================================================================
        # 13. Settings persist
        # =====================================================================
        update_payload = {
            "first_name": "Alicia",
            "last_name": "QA",
            "role": "Senior Lead Analyst",
            "country": "India",
            "language": "hi"
        }
        put_res = await client.put("/profile/me", json=update_payload, headers=headers_a)
        get_prof_res = await client.get("/profile/me", headers=headers_a)
        if put_res.status_code == 200 and get_prof_res.status_code == 200:
            prof = get_prof_res.json()
            fn_ok = prof.get("first_name") == "Alicia"
            role_ok = prof.get("role") == "Senior Lead Analyst"
            lang_ok = prof.get("language") == "hi"
            if fn_ok and role_ok and lang_ok:
                record(13, "Settings persist", True, f"Profile updated and verified: first_name={prof.get('first_name')}, role={prof.get('role')}, language={prof.get('language')}")
            else:
                record(13, "Settings persist", False, f"Prof values: fn={prof.get('first_name')}, role={prof.get('role')}, lang={prof.get('language')}")
        else:
            record(13, "Settings persist", False, f"PUT {put_res.status_code}, GET {get_prof_res.status_code}")

        # =====================================================================
        # 14. Photo persists
        # =====================================================================
        # 1x1 transparent PNG bytes
        png_bytes = (
            b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4'
            b'\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'
        )
        photo_res = await client.post(
            "/profile/photo",
            files={"file": ("avatar.png", png_bytes, "image/png")},
            headers=headers_a
        )
        get_prof_res = await client.get("/profile/me", headers=headers_a)
        if photo_res.status_code == 200 and get_prof_res.status_code == 200:
            photo_url = get_prof_res.json().get("photo_url")
            if photo_url and photo_url.startswith("/uploads/avatars/"):
                # Verify file accessibility
                file_check = await client.get(photo_url)
                if file_check.status_code == 200:
                    record(14, "Photo persists", True, f"Photo uploaded, saved to profile ({photo_url}), and statically accessible")
                else:
                    record(14, "Photo persists", False, f"Static asset returned {file_check.status_code}")
            else:
                record(14, "Photo persists", False, f"Invalid photo_url: {photo_url}")
        else:
            record(14, "Photo persists", False, f"POST {photo_res.status_code}, GET {get_prof_res.status_code}")

        # =====================================================================
        # 15. Notifications work
        # =====================================================================
        notifs_get = await client.get("/notifications", headers=headers_a)
        if notifs_get.status_code == 200:
            notifs_data = notifs_get.json()
            initial_notifs = notifs_data.get("notifications", [])
            unread_initial = notifs_data.get("unread_count", 0)
            
            n_step_ok = True
            details = []
            
            # 15a: Mark single as read
            unread_notif = next((n for n in initial_notifs if not n.get("read")), None)
            if unread_notif and unread_initial > 0:
                first_nid = unread_notif["id"]
                mark_one = await client.patch(f"/notifications/{first_nid}/read", headers=headers_a)
                after_one = (await client.get("/notifications", headers=headers_a)).json()
                if mark_one.status_code == 200 and after_one.get("unread_count") == unread_initial - 1:
                    details.append("Single mark read OK")
                else:
                    n_step_ok = False
                    details.append(f"Single mark read failed: {mark_one.status_code}")
            
            # 15b: Mark all read
            mark_all = await client.patch("/notifications/mark-read", headers=headers_a)
            after_all = (await client.get("/notifications", headers=headers_a)).json()
            if mark_all.status_code == 200 and after_all.get("unread_count") == 0:
                details.append("Mark all read OK")
            else:
                n_step_ok = False
                details.append(f"Mark all read failed: unread={after_all.get('unread_count')}")
                
            # 15c: Clear all notifications
            del_notifs = await client.delete("/notifications", headers=headers_a)
            after_clear = (await client.get("/notifications", headers=headers_a)).json()
            if del_notifs.status_code == 200 and len(after_clear.get("notifications", [])) == 0:
                details.append("Clear all OK")
            else:
                n_step_ok = False
                details.append("Clear all failed")
                
            record(15, "Notifications work", n_step_ok, "; ".join(details))
        else:
            record(15, "Notifications work", False, f"GET {notifs_get.status_code}: {notifs_get.text}")

        # =====================================================================
        # 16. Logout confirmation works
        # =====================================================================
        # Verify frontend code contract for logout confirmation modal and protected route
        fe_header_path = r"frontend\src\components\Header.jsx"
        fe_sidebar_path = r"frontend\src\components\Sidebar.jsx"
        fe_prot_path = r"frontend\src\components\ProtectedRoute.jsx"
        fe_app_path = r"frontend\src\App.jsx"
        
        with open(fe_header_path, 'r', encoding='utf-8') as f:
            header_txt = f.read()
        with open(fe_sidebar_path, 'r', encoding='utf-8') as f:
            sidebar_txt = f.read()
        with open(fe_prot_path, 'r', encoding='utf-8') as f:
            prot_txt = f.read()
        with open(fe_app_path, 'r', encoding='utf-8') as f:
            app_txt = f.read()
            
        modal_prompt_ok = "Are you sure you want to log out?" in header_txt and "Are you sure you want to log out?" in sidebar_txt
        cancel_btn_ok = "header-logout-cancel-btn" in header_txt and "sidebar-logout-cancel-btn" in sidebar_txt
        confirm_btn_ok = "header-logout-confirm-btn" in header_txt and "sidebar-logout-confirm-btn" in sidebar_txt
        clear_token_ok = "localStorage.removeItem('token')" in header_txt and "localStorage.removeItem('token')" in sidebar_txt
        redirect_login_ok = "<Navigate to=\"/login\" replace />" in prot_txt and "/login" in app_txt
        
        logout_contract_passed = (modal_prompt_ok and cancel_btn_ok and confirm_btn_ok and clear_token_ok and redirect_login_ok)
        if logout_contract_passed:
            record(16, "Logout confirmation works", True, "Modal prompt, Cancel/Logout buttons, token clearing, and ProtectedRoute redirect verified")
        else:
            record(16, "Logout confirmation works", False, f"prompt={modal_prompt_ok}, cancel={cancel_btn_ok}, confirm={confirm_btn_ok}, clear={clear_token_ok}, redirect={redirect_login_ok}")

        # =====================================================================
        # 17. Register Company B
        # =====================================================================
        reg_payload_b = {
            "first_name": "Bob",
            "last_name": "Beta",
            "email": email_b,
            "phone": "9876543211",
            "password": password,
            "company": "Company B",
            "company_type": "Private Limited Company",
            "industry": "Telecommunications",
            "department": "Operations",
            "company_size": "51–200 employees",
            "country": "India"
        }
        res_b = await client.post("/register", json=reg_payload_b)
        if res_b.status_code != 200:
            record(17, "Register Company B", False, f"HTTP {res_b.status_code}: {res_b.text}")
        else:
            otp_b = get_latest_otp(email_b)
            if not otp_b:
                record(17, "Register Company B", False, "Could not extract OTP for Company B")
            else:
                verify_b = await client.post("/auth/verify-registration", json={"email": email_b, "otp": otp_b})
                login_b = await client.post("/login", json={"email": email_b, "password": password})
                if verify_b.status_code == 200 and login_b.status_code == 200:
                    token_b = login_b.json().get("access_token")
                    comp_b_id = login_b.json().get("company_id")
                    record(17, "Register Company B", True, f"Company B registered, verified, and logged in ({comp_b_id})")
                else:
                    record(17, "Register Company B", False, f"Verify {verify_b.status_code}, Login {login_b.status_code}")

        headers_b = {"Authorization": f"Bearer {token_b}"} if token_b else {}

        # =====================================================================
        # 18. Dashboard = 0 (Company B)
        # =====================================================================
        dash_b_res = await client.get("/dashboard/stats", headers=headers_b)
        if dash_b_res.status_code == 200:
            dash_b = dash_b_res.json()
            total_b = dash_b.get("total_analyzed", -1)
            if total_b == 0:
                record(18, "Dashboard = 0 (Company B)", True, f"Company B total_analyzed={total_b}")
            else:
                record(18, "Dashboard = 0 (Company B)", False, f"Company B total_analyzed={total_b}, expected 0")
        else:
            record(18, "Dashboard = 0 (Company B)", False, f"HTTP {dash_b_res.status_code}: {dash_b_res.text}")

        # =====================================================================
        # 19. Customers = 0 (Company B)
        # =====================================================================
        cust_b_res = await client.get("/telco/customers", headers=headers_b)
        if cust_b_res.status_code == 200:
            cust_b = cust_b_res.json()
            total_custs = cust_b.get("total", -1)
            recs_b = cust_b.get("records", cust_b.get("data", []))
            if total_custs == 0 and len(recs_b) == 0:
                record(19, "Customers = 0 (Company B)", True, f"Company B customers total={total_custs}, records={len(recs_b)}")
            else:
                record(19, "Customers = 0 (Company B)", False, f"total={total_custs}, recs_len={len(recs_b)}")
        else:
            record(19, "Customers = 0 (Company B)", False, f"HTTP {cust_b_res.status_code}: {cust_b_res.text}")

        # =====================================================================
        # 20. Upload history = empty (Company B)
        # =====================================================================
        hist_b_res = await client.get("/uploads/history", headers=headers_b)
        if hist_b_res.status_code == 200:
            hist_b = hist_b_res.json()
            if isinstance(hist_b, list) and len(hist_b) == 0:
                record(20, "Upload history = empty (Company B)", True, "History is empty []")
            else:
                record(20, "Upload history = empty (Company B)", False, f"History length is {len(hist_b)}")
        else:
            record(20, "Upload history = empty (Company B)", False, f"HTTP {hist_b_res.status_code}: {hist_b_res.text}")

        # =====================================================================
        # 21. Upload Company B data
        # =====================================================================
        with open(DATASET_50, "rb") as f:
            up_b_res = await client.post(
                "/dataset/upload",
                files={"file": ("company_b_data.csv", f, "text/csv")},
                headers=headers_b
            )
        atlas_b_count = await telco_collection.count_documents({"company_id": "comp_company_b"})
        dash_b_after = (await client.get("/dashboard/stats", headers=headers_b)).json().get("total_analyzed")
        if up_b_res.status_code == 200 and atlas_b_count == 50 and dash_b_after == 50:
            record(21, "Upload Company B data", True, f"Company B data uploaded: Atlas={atlas_b_count}, Dashboard={dash_b_after}")
        else:
            record(21, "Upload Company B data", False, f"HTTP {up_b_res.status_code}, Atlas={atlas_b_count}, Dash={dash_b_after}")

        # =====================================================================
        # 22. Login Company A again
        # =====================================================================
        login_a2 = await client.post("/login", json={"email": email_a, "password": password})
        if login_a2.status_code == 200 and "access_token" in login_a2.json():
            token_a2 = login_a2.json()["access_token"]
            comp_id_a2 = login_a2.json().get("company_id")
            record(22, "Login Company A again", True, f"Successfully re-authenticated as Company A ({comp_id_a2})")
            headers_a2 = {"Authorization": f"Bearer {token_a2}"}
        else:
            record(22, "Login Company A again", False, f"HTTP {login_a2.status_code}: {login_a2.text}")
            headers_a2 = headers_a

        # =====================================================================
        # 23. Company A still = 7092
        # =====================================================================
        atlas_a_final = await telco_collection.count_documents({"company_id": "comp_company_a"})
        dash_a_final_res = await client.get("/dashboard/stats", headers=headers_a2)
        dash_a_final = dash_a_final_res.json().get("total_analyzed") if dash_a_final_res.status_code == 200 else None
        cust_a_final_res = await client.get("/telco/customers", headers=headers_a2)
        cust_a_final = cust_a_final_res.json().get("total") if cust_a_final_res.status_code == 200 else None
        
        if atlas_a_final == 7092 and dash_a_final == 7092 and cust_a_final == 7092:
            record(23, "Company A still = 7092", True, f"Tenant isolation confirmed: Atlas={atlas_a_final}, Dashboard={dash_a_final}, Customers={cust_a_final}")
        else:
            record(23, "Company A still = 7092", False, f"Atlas={atlas_a_final}, Dashboard={dash_a_final}, Customers={cust_a_final}, expected 7092")

    finally:
        await client.aclose()

    print("\n" + "="*80)
    print("FINAL QA RESULTS SUMMARY")
    print("="*80)
    passed_count = sum(1 for v in RESULTS.values() if v["passed"])
    failed_count = sum(1 for v in RESULTS.values() if not v["passed"])
    print(f"Total Tests: {len(RESULTS)} | Passed: {passed_count} | Failed: {failed_count}\n")
    for step_num in sorted(RESULTS.keys()):
        item = RESULTS[step_num]
        status = "PASSED" if item["passed"] else "FAILED"
        print(f"{step_num:2d}. {item['name']:<35} : {status} ({item['details']})")

if __name__ == "__main__":
    asyncio.run(run_qa_suite())
