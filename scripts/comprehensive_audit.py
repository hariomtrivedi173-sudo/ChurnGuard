#!/usr/bin/env python3
"""
ChurnGuard Comprehensive QA, Security & Performance Audit Suite
Runs functional tests, security checks, boundary tests, and accessibility scans.
"""

import sys
import os
import time
import json
import httpx

API_BASE = "http://127.0.0.1:8000"
FRONTEND_BASE = "http://127.0.0.1:5173"

findings = []

def record_finding(bug_id, title, severity, category, url, steps, expected, actual, fix):
    findings.append({
        "bug_id": bug_id,
        "title": title,
        "severity": severity,
        "category": category,
        "url": url,
        "steps": steps,
        "expected": expected,
        "actual": actual,
        "fix": fix
    })

def run_audit():
    client = httpx.Client(timeout=10.0)

    print("=" * 70)
    print(" RUNNING CHURNGUARD COMPREHENSIVE QA AUDIT ")
    print("=" * 70)

    # ──────────────────────────────────────────────────────────────────────────
    # 1. SECURITY AUDIT: HTTP Headers & Server Leaks
    # ──────────────────────────────────────────────────────────────────────────
    print("\n[1/6] Auditing HTTP Security Headers...")
    res = client.get(f"{API_BASE}/health")
    headers = {k.lower(): v for k, v in res.headers.items()}

    sec_headers = [
        ("x-content-type-options", "nosniff", "Missing X-Content-Type-Options: nosniff header"),
        ("x-frame-options", "DENY", "Missing X-Frame-Options clickjacking protection header"),
        ("referrer-policy", "strict-origin-when-cross-origin", "Missing Referrer-Policy header"),
        ("content-security-policy", None, "Missing Content-Security-Policy (CSP) header"),
    ]

    missing_sec_headers = []
    for h, expected_val, desc in sec_headers:
        if h not in headers:
            missing_sec_headers.append(h)
    
    if missing_sec_headers:
        record_finding(
            bug_id="SEC-01",
            title="Missing HTTP Security Headers on API Responses",
            severity="Medium",
            category="SECURITY",
            url=f"{API_BASE}/*",
            steps="1. Send GET request to any API endpoint (e.g. /health)\n2. Inspect response headers.",
            expected="Security headers (X-Content-Type-Options, X-Frame-Options, CSP, Referrer-Policy) should be set on all responses.",
            actual=f"Missing security headers: {', '.join(missing_sec_headers)}",
            fix="Add a middleware in backend/main.py or use starlette/fastapi middleware to inject standard security headers on all outgoing responses."
        )

    # Check Server header leak
    if "server" in headers:
        server_val = headers["server"]
        if "uvicorn" in server_val.lower():
            record_finding(
                bug_id="SEC-02",
                title="Server Technology Fingerprint Leaked in Response Header",
                severity="Low",
                category="SECURITY",
                url=f"{API_BASE}/*",
                steps="1. Inspect 'Server' header on any API response.",
                expected="Generic or stripped 'Server' header to prevent server fingerprinting.",
                actual=f"'Server: {server_val}' explicitly discloses Python Uvicorn engine.",
                fix="Configure Uvicorn with '--no-server-header' or strip the 'server' header via middleware."
            )

    # ──────────────────────────────────────────────────────────────────────────
    # 2. SECURITY AUDIT: CORS Origin Reflection Check
    # ──────────────────────────────────────────────────────────────────────────
    print("[2/6] Auditing CORS Origin Validation...")
    evil_res = client.options(
        f"{API_BASE}/health",
        headers={
            "Origin": "https://malicious-attacker-site.com",
            "Access-Control-Request-Method": "GET"
        }
    )
    cors_allowed = evil_res.headers.get("access-control-allow-origin")
    if cors_allowed == "https://malicious-attacker-site.com" or cors_allowed == "*":
        record_finding(
            bug_id="SEC-03",
            title="Overly Permissive CORS Origin Reflection",
            severity="High",
            category="SECURITY",
            url=f"{API_BASE}/*",
            steps="1. Send preflight OPTIONS request with 'Origin: https://malicious-attacker-site.com'.\n2. Inspect Access-Control-Allow-Origin header.",
            expected="Untrusted origins outside whitelist should not be granted Access-Control-Allow-Origin.",
            actual=f"Origin reflected or wildcard returned: {cors_allowed}",
            fix="Restrict allow_origins in CORSMiddleware to explicitly configured trusted domains."
        )
    else:
        print("  -> CORS properly rejected untrusted origin.")

    # ──────────────────────────────────────────────────────────────────────────
    # 3. SECURITY AUDIT: Directory Traversal on /uploads
    # ──────────────────────────────────────────────────────────────────────────
    print("[3/6] Auditing Path Traversal on Static File Mount...")
    try:
        traversal_res = client.get(f"{API_BASE}/uploads/../../backend/.env")
        if traversal_res.status_code == 200 and "MONGO_URI" in traversal_res.text:
            record_finding(
                bug_id="SEC-04",
                title="CRITICAL: Directory Traversal Allows Reading .env File",
                severity="Critical",
                category="SECURITY",
                url=f"{API_BASE}/uploads/../../backend/.env",
                steps="1. GET /uploads/../../backend/.env",
                expected="HTTP 404 or HTTP 400 forbidden",
                actual="File contents returned with sensitive credentials!",
                fix="Ensure StaticFiles has strict root path resolution or mount only dedicated upload paths."
            )
        else:
            print(f"  -> Path traversal rejected safely (HTTP {traversal_res.status_code}).")
    except Exception as e:
        print(f"  -> Path traversal probe exception: {e}")

    # ──────────────────────────────────────────────────────────────────────────
    # 4. FUNCTIONAL AUDIT: Missing 404 Page on Frontend
    # ──────────────────────────────────────────────────────────────────────────
    print("[4/6] Auditing Frontend Routing & Error Handling...")
    with open("frontend/src/App.jsx", "r", encoding="utf-8") as f:
        app_jsx = f.read()

    if '<Route path="*" element={<Login />} />' in app_jsx:
        record_finding(
            bug_id="FUNC-01",
            title="Catch-all Route Redirects to Login Instead of a Proper 404 Page",
            severity="Medium",
            category="FUNCTIONAL",
            url=f"{FRONTEND_BASE}/non-existent-page",
            steps="1. Log into ChurnGuard as an authenticated user.\n2. Navigate to an invalid URL like http://127.0.0.1:5173/unknown-path.",
            expected="A dedicated 404 Not Found page with a 'Return to Dashboard' button.",
            actual="App renders the Login form for all unknown URLs, which is disorienting for logged-in users.",
            fix="Create a NotFound.jsx component and set '<Route path=\"*\" element={<NotFound />} />' with conditional redirect to /dashboard if logged in."
        )

    # ──────────────────────────────────────────────────────────────────────────
    # 5. UI/UX & FUNCTIONAL AUDIT: Avatar 404 Requests
    # ──────────────────────────────────────────────────────────────────────────
    print("[5/6] Auditing Avatar & Static Asset Integrity...")
    # Check if any user in db has orphaned avatar URLs
    import asyncio
    sys.path.insert(0, "backend")
    from database import user_collection

    async def check_avatars():
        orphans = 0
        async for u in user_collection.find({"photo_url": {"$regex": r"^/uploads/avatars/"}}):
            url = u["photo_url"]
            filename = os.path.basename(url)
            filepath = os.path.join("backend", "uploads", "avatars", filename)
            if not os.path.exists(filepath):
                orphans += 1
        return orphans

    orphans_count = asyncio.run(check_avatars())
    if orphans_count > 0:
        record_finding(
            bug_id="UI-01",
            title="Orphaned User Profile Avatar References Cause 404 Network Errors",
            severity="Low",
            category="UI/UX",
            url=f"{API_BASE}/uploads/avatars/*",
            steps="1. Open browser developer console (F12) > Network tab.\n2. Navigate to Dashboard or Settings.",
            expected="All user profile assets load with HTTP 200, or photo_url is null if no image exists on disk.",
            actual=f"{orphans_count} user record(s) contain photo_url pointing to avatar images deleted from local disk, causing browser 404 GET errors.",
            fix="Add a startup cleanup or database sanitization task to reset 'photo_url' to null if the physical file does not exist on disk."
        )

    # ──────────────────────────────────────────────────────────────────────────
    # 6. SEO & ACCESSIBILITY AUDIT
    # ──────────────────────────────────────────────────────────────────────────
    print("[6/6] Auditing SEO & Accessibility Attributes...")
    with open("frontend/index.html", "r", encoding="utf-8") as f:
        index_html = f.read()

    # Check robots.txt and sitemap
    robots_exist = os.path.exists("frontend/public/robots.txt")
    if not robots_exist:
        record_finding(
            bug_id="SEO-01",
            title="Missing robots.txt in Frontend Public Assets",
            severity="Low",
            category="SEO & ACCESSIBILITY",
            url=f"{FRONTEND_BASE}/robots.txt",
            steps="1. Request http://127.0.0.1:5173/robots.txt in browser.",
            expected="Valid robots.txt specifying crawl directives for search engine crawlers.",
            actual="robots.txt is missing, causing 404 on crawler requests.",
            fix="Add robots.txt to frontend/public/ with directives disallowing protected routes (/dashboard, /customers, /settings, etc.)."
        )

    # Check viewport meta tag & accessibility
    if "maximum-scale=1" in index_html or "user-scalable=no" in index_html:
        record_finding(
            bug_id="A11Y-01",
            title="Zoom Disabled by Viewport Meta Tag",
            severity="Medium",
            category="SEO & ACCESSIBILITY",
            url=f"{FRONTEND_BASE}/*",
            steps="1. Inspect viewport meta tag in index.html.",
            expected="Allow pinch-to-zoom for low-vision accessibility (WCAG 1.4.4).",
            actual="Viewport restricts user scalability.",
            fix="Remove user-scalable=no or maximum-scale=1 from viewport meta tag."
        )
    else:
        print("  -> Viewport accessibility allows user scaling (WCAG compliant).")

    # Audit Form accessibility on Login & Register
    with open("frontend/src/pages/Login.jsx", "r", encoding="utf-8") as f:
        login_jsx = f.read()
    
    if 'htmlFor="login-email"' not in login_jsx or 'id="login-email"' not in login_jsx:
        record_finding(
            bug_id="A11Y-02",
            title="Login Form Inputs Missing Explicit Label Associations",
            severity="Low",
            category="SEO & ACCESSIBILITY",
            url=f"{FRONTEND_BASE}/login",
            steps="1. Inspect Email and Password inputs on the Login page.",
            expected="Every input has an associated <label htmlFor=\"...\"> matching the input id for screen readers.",
            actual="Some inputs rely solely on placeholder text or wrapper labels without explicit htmlFor/id pairs.",
            fix="Ensure all form inputs have corresponding <label htmlFor=\"id\"> and matching id=\"id\"."
        )

    print("\n" + "=" * 70)
    print(f" AUDIT COMPLETE: {len(findings)} FINDINGS IDENTIFIED ")
    print("=" * 70)

    for idx, f in enumerate(findings, 1):
        print(f"\n[{idx}] {f['bug_id']} - {f['title']} ({f['severity']})")
        print(f"     Category : {f['category']}")
        print(f"     URL      : {f['url']}")
        print(f"     Actual   : {f['actual']}")
        print(f"     Fix      : {f['fix']}")

if __name__ == "__main__":
    run_audit()

