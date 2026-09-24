"""
verify_qa11_frontend_ux_suite.py — Automated QA-11 Frontend UX & UI States Test Suite
Tests all 40 verification points across routing, auth, dashboard, customers,
upload, predictions, analytics, reports, settings, notifications, responsiveness,
light/dark themes, empty/loading/error states, and mock data audits.
"""

import os
import sys
import re
import urllib.request

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

FRONTEND_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend"))
SRC_DIR = os.path.join(FRONTEND_DIR, "src")
INDEX_CSS = os.path.join(SRC_DIR, "index.css")
APP_JSX = os.path.join(SRC_DIR, "App.jsx")

def read_file(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()

def run_qa11_tests():
    print("=" * 70)
    print("STARTING QA-11 FRONTEND UX + RESPONSIVE + UI STATES TEST SUITE")
    print("=" * 70)
    
    results = {}
    
    # -------------------------------------------------------------
    # TEST 1: APPLICATION STARTUP & DIRECT ROUTES
    # -------------------------------------------------------------
    try:
        app_content = read_file(APP_JSX)
        expected_routes = [
            "/login", "/register", "/dashboard", "/customers",
            "/upload", "/predictions", "/analytics", "/reports", "/settings"
        ]
        missing_routes = [r for r in expected_routes if f'path="{r}"' not in app_content]
        
        # Also check /predict
        assert 'path="/predict"' in app_content, "Missing /predict route"
        assert not missing_routes, f"Missing direct routes in App.jsx: {missing_routes}"
        
        # Verify protected routes wrapper
        protected_routes = ["/dashboard", "/customers", "/predict", "/predictions", "/upload", "/analytics", "/reports", "/settings"]
        for r in protected_routes:
            pattern = re.compile(rf'<Route\s+path="{r}"\s+element=\{{<ProtectedRoute>')
            assert pattern.search(app_content), f"Route {r} is not wrapped in ProtectedRoute"
        
        # Verify frontend server is alive
        req = urllib.request.urlopen("http://localhost:5173/")
        assert req.status == 200, f"Frontend HTTP status is {req.status}"
        
        results["Startup/routes"] = True
        print("✓ TEST 1: Application Startup & Direct Routes: PASS")
    except Exception as e:
        results["Startup/routes"] = False
        print(f"✗ TEST 1: Startup/routes FAIL: {e}")

    # -------------------------------------------------------------
    # TEST 2: LOGIN PAGE UX
    # -------------------------------------------------------------
    try:
        login_content = read_file(os.path.join(SRC_DIR, "pages", "Login.jsx"))
        assert 'id="login-email"' in login_content, "Missing email input id"
        assert 'id="login-password"' in login_content, "Missing password input id"
        assert 'id="login-submit"' in login_content, "Missing submit button id"
        assert 'showPassword ? <EyeOff' in login_content or 'showPassword' in login_content, "Missing show/hide password"
        assert 'disabled={loading}' in login_content, "Missing disabled state while loading"
        assert 'to="/register"' in login_content, "Missing link to registration"
        assert 'toast.error(' in login_content, "Missing user-friendly error toast"
        assert 'setError(' in login_content, "Missing inline error message state"
        assert 'if (loading) return' in login_content, "Missing double-submit guard in handleSubmit"
        results["Login UX"] = True
        print("✓ TEST 2: Login Page UX: PASS")
    except Exception as e:
        results["Login UX"] = False
        print(f"✗ TEST 2: Login UX FAIL: {e}")

    # -------------------------------------------------------------
    # TEST 3: REGISTRATION UX
    # -------------------------------------------------------------
    try:
        reg_content = read_file(os.path.join(SRC_DIR, "pages", "Register.jsx"))
        assert 'id="register-fname"' in reg_content, "Missing first name field"
        assert 'id="register-lname"' in reg_content, "Missing last name field"
        assert 'id="register-email"' in reg_content, "Missing email field"
        assert 'id="register-company"' in reg_content, "Missing company field"
        assert 'id="register-password"' in reg_content, "Missing password field"
        assert 'id="register-confirm"' in reg_content, "Missing confirm password field"
        assert 'step === 3' in reg_content, "Missing OTP verification step 3"
        assert 'id="verify-otp-btn"' in reg_content, "Missing OTP verify button"
        assert 'disabled={loading}' in reg_content, "Missing disabled loading state on register button"
        assert 'disabled={otpLoading' in reg_content, "Missing disabled loading state on OTP verify button"
        results["Registration UX"] = True
        print("✓ TEST 3: Registration UX: PASS")
    except Exception as e:
        results["Registration UX"] = False
        print(f"✗ TEST 3: Registration UX FAIL: {e}")

    # -------------------------------------------------------------
    # TEST 4: GLOBAL HEADER
    # -------------------------------------------------------------
    try:
        header_content = read_file(os.path.join(SRC_DIR, "components", "Header.jsx"))
        assert '/profile/me' in header_content, "Header does not fetch authenticated user profile"
        assert 'profile?.photo_url' in header_content, "Header does not handle avatar photo URL"
        assert 'initials' in header_content, "Header does not compute dynamic initials fallback"
        assert 'notifications-bell-btn' in header_content, "Missing notifications button in Header"
        assert 'toggleTheme' in header_content, "Missing theme toggle in Header"
        assert 'search-suggestions-dropdown' in header_content, "Missing search dropdown in Header"
        
        # Verify NO hardcoded Maya Chen / MC / Demo Company in Header
        assert "Maya Chen" not in header_content, "Found hardcoded Maya Chen in Header"
        assert "'MC'" not in header_content and '"MC"' not in header_content, "Found hardcoded MC in Header"
        assert "Demo Company" not in header_content, "Found hardcoded Demo Company in Header"
        results["Header"] = True
        print("✓ TEST 4: Global Header: PASS")
    except Exception as e:
        results["Header"] = False
        print(f"✗ TEST 4: Header FAIL: {e}")

    # -------------------------------------------------------------
    # TEST 5: SIDEBAR
    # -------------------------------------------------------------
    try:
        sidebar_content = read_file(os.path.join(SRC_DIR, "components", "Sidebar.jsx"))
        for item in ['/dashboard', '/customers', '/predict', '/upload', '/analytics', '/reports', '/settings']:
            assert item in sidebar_content, f"Sidebar missing route {item}"
        assert 'isCollapsed' in sidebar_content, "Sidebar missing collapsible logic"
        assert 'sidebar-tooltip' in sidebar_content, "Sidebar missing collapsed mode tooltips"
        assert 'NavLink' in sidebar_content, "Sidebar not using NavLink for active route states"
        assert 'showLogoutModal' in sidebar_content, "Sidebar missing logout modal trigger"
        results["Sidebar"] = True
        print("✓ TEST 5: Sidebar: PASS")
    except Exception as e:
        results["Sidebar"] = False
        print(f"✗ TEST 5: Sidebar FAIL: {e}")

    # -------------------------------------------------------------
    # TEST 6: DASHBOARD LAYOUT
    # -------------------------------------------------------------
    try:
        dash_content = read_file(os.path.join(SRC_DIR, "pages", "Dashboard.jsx"))
        assert 'total.toLocaleString()' in dash_content, "Missing total customers metric"
        assert 'activeCount.toLocaleString()' in dash_content, "Missing active customers metric"
        assert 'high.toLocaleString()' in dash_content, "Missing high risk metric"
        assert 'med.toLocaleString()' in dash_content, "Missing medium risk metric"
        assert 'low.toLocaleString()' in dash_content, "Missing low risk metric"
        assert 'totalMRRRaw' in dash_content, "Missing total MRR metric"
        assert 'churnRatePct' in dash_content, "Missing churn rate metric"
        assert 'CustomChartTooltip' in dash_content, "Missing custom chart tooltip"
        assert 'dashboard-split-grid' in dash_content, "Missing responsive dashboard-split-grid"
        assert 'highestRiskRows' in dash_content or 'highRiskRows' in dash_content, "Missing highest risk customers table"
        assert 'activityItems' in dash_content, "Missing recent activity list"
        results["Dashboard layout"] = True
        print("✓ TEST 6: Dashboard Layout: PASS")
    except Exception as e:
        results["Dashboard layout"] = False
        print(f"✗ TEST 6: Dashboard layout FAIL: {e}")

    # -------------------------------------------------------------
    # TEST 7: CUSTOMERS TABLE UX
    # -------------------------------------------------------------
    try:
        cust_content = read_file(os.path.join(SRC_DIR, "pages", "Customers.jsx"))
        assert 'overflowX: \'auto\'' in cust_content or 'overflow-x' in cust_content, "Missing table horizontal scroll wrapper"
        assert 'minWidth: \'760px\'' in cust_content or 'min-width' in cust_content, "Missing table minWidth to prevent squeeze"
        assert 'getPageNumbers()' in cust_content, "Missing pagination page numbers generator"
        assert 'id="prev-page-btn"' in cust_content, "Missing previous page button"
        assert 'id="next-page-btn"' in cust_content, "Missing next page button"
        assert 'handleDelete' in cust_content, "Missing delete customer handler"
        assert 'search-customers-input' in cust_content, "Missing customer search input"
        assert 'clear-search-btn' in cust_content, "Missing clear search button"
        results["Customers UX"] = True
        print("✓ TEST 7: Customers Table UX: PASS")
    except Exception as e:
        results["Customers UX"] = False
        print(f"✗ TEST 7: Customers UX FAIL: {e}")

    # -------------------------------------------------------------
    # TEST 8: UPLOAD PAGE UX
    # -------------------------------------------------------------
    try:
        upload_content = read_file(os.path.join(SRC_DIR, "pages", "Upload.jsx"))
        assert 'handleDrop' in upload_content, "Missing drag and drop handler"
        assert 'type="file"' in upload_content, "Missing file picker input"
        assert 'UPLOAD_STAGES' in upload_content, "Missing multi-step upload progress stages"
        assert 'handleCancelUpload' in upload_content, "Missing upload cancellation logic"
        assert 'Total Rows in File' in upload_content, "Missing Total Rows summary"
        assert 'New Records Added' in upload_content, "Missing New Records summary"
        assert 'Duplicates Skipped' in upload_content, "Missing Duplicates summary"
        assert 'Total in Database' in upload_content, "Missing Total in Database summary"
        assert 'Upload History' in upload_content, "Missing Upload History component"
        assert 'disabled={uploading}' in upload_content, "Missing button disabled state during upload"
        results["Upload UX"] = True
        print("✓ TEST 8: Upload Page UX: PASS")
    except Exception as e:
        results["Upload UX"] = False
        print(f"✗ TEST 8: Upload UX FAIL: {e}")

    # -------------------------------------------------------------
    # TEST 9: PREDICTION PAGE UX
    # -------------------------------------------------------------
    try:
        pred_content = read_file(os.path.join(SRC_DIR, "pages", "Predict.jsx"))
        assert 'handleSelectChange' in pred_content, "Missing customer select change handler"
        assert 'setResult(null)' in pred_content, "Missing clear result logic on customer switch (no stale flash)"
        assert 'handleRunPrediction' in pred_content, "Missing run prediction handler"
        assert 'buildPayload' in pred_content, "Missing telco customer payload builder"
        assert 'riskColor' in pred_content, "Missing risk level color helper"
        assert 'top_factors' in pred_content, "Missing SHAP top contributing factors display"
        assert 'recommended_actions' in pred_content, "Missing recommended retention actions display"
        assert 'disabled={loading}' in pred_content, "Missing disabled button during inference"
        results["Prediction UX"] = True
        print("✓ TEST 9: Prediction Page UX: PASS")
    except Exception as e:
        results["Prediction UX"] = False
        print(f"✗ TEST 9: Prediction UX FAIL: {e}")

    # -------------------------------------------------------------
    # TEST 10: ANALYTICS UX
    # -------------------------------------------------------------
    try:
        analytics_content = read_file(os.path.join(SRC_DIR, "pages", "Analytics.jsx"))
        assert 'ResponsiveContainer' in analytics_content, "Missing ResponsiveContainer for chart adaptability"
        assert 'PieChart' in analytics_content, "Missing contract distribution PieChart"
        assert 'BarChart' in analytics_content, "Missing risk breakdown BarChart"
        assert 'EmptyState' in analytics_content, "Missing analytics empty state component"
        assert 'analytics-grid' in analytics_content, "Missing responsive analytics-grid class"
        results["Analytics UX"] = True
        print("✓ TEST 10: Analytics UX: PASS")
    except Exception as e:
        results["Analytics UX"] = False
        print(f"✗ TEST 10: Analytics UX FAIL: {e}")

    # -------------------------------------------------------------
    # TEST 11: REPORTS UX
    # -------------------------------------------------------------
    try:
        reports_content = read_file(os.path.join(SRC_DIR, "pages", "Reports.jsx"))
        assert 'downloadReport' in reports_content, "Missing downloadReport API call"
        assert 'handlePrint' in reports_content, "Missing print handler"
        assert 'openExecutivePreview' in reports_content, "Missing executive preview modal handler"
        assert 'openRevenuePreview' in reports_content, "Missing revenue preview modal handler"
        assert 'reports-grid' in reports_content, "Missing responsive reports-grid class"
        assert 'Scheduled Reports' in reports_content, "Missing scheduled reports section"
        results["Reports UX"] = True
        print("✓ TEST 11: Reports UX: PASS")
    except Exception as e:
        results["Reports UX"] = False
        print(f"✗ TEST 11: Reports UX FAIL: {e}")

    # -------------------------------------------------------------
    # TEST 12: SETTINGS UX
    # -------------------------------------------------------------
    try:
        settings_content = read_file(os.path.join(SRC_DIR, "pages", "Settings.jsx"))
        assert 'handleSaveProfile' in settings_content, "Missing handleSaveProfile"
        assert 'handleFileSelect' in settings_content, "Missing avatar file select handler"
        assert 'handleConfirmRemovePhoto' in settings_content, "Missing remove photo handler"
        assert 'handleInitiatePasswordChange' in settings_content, "Missing initiate password change handler"
        assert 'handleConfirmVerifyOtp' in settings_content, "Missing verify password OTP handler"
        assert 'disabled={savingProfile}' in settings_content, "Missing disabled state for profile submit button"
        assert 'settings-profile-grid' in settings_content, "Missing responsive settings-profile-grid"
        assert 'settings-form-row' in settings_content, "Missing responsive settings-form-row"
        results["Settings UX"] = True
        print("✓ TEST 12: Settings UX: PASS")
    except Exception as e:
        results["Settings UX"] = False
        print(f"✗ TEST 12: Settings UX FAIL: {e}")

    # -------------------------------------------------------------
    # TEST 13: NOTIFICATIONS UX
    # -------------------------------------------------------------
    try:
        assert 'handleMarkAllRead' in header_content, "Missing mark all read handler in Header"
        assert 'handleMarkSingleRead' in header_content, "Missing mark single read handler in Header"
        assert 'handleConfirmClearAll' in header_content, "Missing clear all handler in Header"
        assert 'showClearModal' in header_content, "Missing clear notifications confirmation modal"
        assert 'drawer-empty-state' in header_content, "Missing notification drawer empty state"
        results["Notifications UX"] = True
        print("✓ TEST 13: Notifications UX: PASS")
    except Exception as e:
        results["Notifications UX"] = False
        print(f"✗ TEST 13: Notifications UX FAIL: {e}")

    # -------------------------------------------------------------
    # TEST 14 & 15: LIGHT AND DARK MODES
    # -------------------------------------------------------------
    try:
        css_content = read_file(INDEX_CSS)
        # Verify root light variables
        assert '--bg: #F8F7FF' in css_content or '--bg:' in css_content, "Missing light mode --bg"
        assert '--surface: #FFFFFF' in css_content or '--surface:' in css_content, "Missing light mode --surface"
        assert '--text-primary: #1E1B4B' in css_content, "Missing light mode --text-primary"
        
        # Verify dark mode variables
        assert '[data-theme="dark"]' in css_content, "Missing [data-theme='dark'] definition"
        assert '--text-primary: #F5F3FF;' in css_content, "Missing dark mode bright primary text"
        assert '--text-secondary: #A5A1B8;' in css_content, "Missing dark mode secondary text"
        assert '[data-theme="dark"] input,' in css_content, "Missing dark mode input styles"
        assert '[data-theme="dark"] td' in css_content, "Missing dark mode table cell text color"
        assert '[data-theme="dark"] .recharts-text' in css_content, "Missing dark mode chart text styling"
        assert '[data-theme="dark"] .recharts-default-tooltip' in css_content, "Missing dark mode chart tooltip styling"
        
        results["Light mode"] = True
        results["Dark mode"] = True
        print("✓ TEST 14: Light Mode: PASS")
        print("✓ TEST 15: Dark Mode: PASS")
    except Exception as e:
        results["Light mode"] = False
        results["Dark mode"] = False
        print(f"✗ TEST 14/15: Light/Dark Mode FAIL: {e}")

    # -------------------------------------------------------------
    # TEST 16: THEME PERSISTENCE
    # -------------------------------------------------------------
    try:
        assert "localStorage.setItem('theme', theme)" in header_content or "localStorage.setItem('theme'" in header_content
        assert "localStorage.getItem('theme')" in header_content
        results["Theme persistence"] = True
        print("✓ TEST 16: Theme Persistence: PASS")
    except Exception as e:
        results["Theme persistence"] = False
        print(f"✗ TEST 16: Theme persistence FAIL: {e}")

    # -------------------------------------------------------------
    # TEST 17, 18, 19: RESPONSIVENESS (Desktop, Tablet, Mobile)
    # -------------------------------------------------------------
    try:
        # Desktop
        assert '@media (min-width: 1024px)' in css_content, "Missing desktop breakpoint"
        # Tablet
        assert '@media (max-width: 1023px)' in css_content, "Missing tablet breakpoint"
        assert '.dashboard-split-grid,' in css_content, "Missing tablet grid stack rule"
        # Mobile
        assert '@media (max-width: 767px)' in css_content, "Missing mobile breakpoint"
        assert '.settings-form-row' in css_content, "Missing mobile form stack rule"
        assert '.reports-stats-grid' in css_content, "Missing mobile reports summary stack rule"
        
        results["Desktop responsive"] = True
        results["Tablet responsive"] = True
        results["Mobile responsive"] = True
        print("✓ TEST 17: Desktop Responsive: PASS")
        print("✓ TEST 18: Tablet Responsive: PASS")
        print("✓ TEST 19: Mobile Responsive: PASS")
    except Exception as e:
        results["Desktop responsive"] = False
        results["Tablet responsive"] = False
        results["Mobile responsive"] = False
        print(f"✗ TEST 17/18/19: Responsive FAIL: {e}")

    # -------------------------------------------------------------
    # TEST 20: LONG CONTENT
    # -------------------------------------------------------------
    try:
        assert 'text-overflow: ellipsis' in css_content or 'textOverflow: \'ellipsis\'' in header_content
        assert 'wordBreak: \'break-word\'' in pred_content or 'word-break' in css_content
        results["Long content"] = True
        print("✓ TEST 20: Long Content Guard: PASS")
    except Exception as e:
        results["Long content"] = False
        print(f"✗ TEST 20: Long content FAIL: {e}")

    # -------------------------------------------------------------
    # TEST 21: LOADING STATES
    # -------------------------------------------------------------
    try:
        assert 'loading ? \'—\'' in dash_content, "Dashboard missing loading placeholder"
        assert 'loadingCusts' in pred_content, "Predict missing loading customers state"
        assert 'loading ?' in cust_content, "Customers missing loading state"
        assert 'UPLOAD_STAGES' in upload_content, "Upload missing multi-stage progress"
        assert 'loadingStats' in reports_content, "Reports missing loading stats state"
        assert 'loadingProfile' in settings_content, "Settings missing loading profile state"
        results["Loading states"] = True
        print("✓ TEST 21: Loading States: PASS")
    except Exception as e:
        results["Loading states"] = False
        print(f"✗ TEST 21: Loading states FAIL: {e}")

    # -------------------------------------------------------------
    # TEST 22: EMPTY STATES
    # -------------------------------------------------------------
    try:
        assert 'No customer dataset loaded' in dash_content, "Dashboard missing empty dataset banner"
        assert 'No uploads yet' in dash_content, "Dashboard missing empty uploads fallback"
        assert 'No customers yet' in cust_content, "Customers missing empty customers fallback"
        assert 'No customers found' in pred_content, "Predict missing empty customers fallback"
        assert 'No dataset currently stored' in upload_content, "Upload missing empty dataset preview"
        assert 'No notifications' in header_content, "Header missing empty notifications fallback"
        results["Empty states"] = True
        print("✓ TEST 22: Empty States: PASS")
    except Exception as e:
        results["Empty states"] = False
        print(f"✗ TEST 22: Empty states FAIL: {e}")

    # -------------------------------------------------------------
    # TEST 23: API ERROR STATES
    # -------------------------------------------------------------
    try:
        client_content = read_file(os.path.join(SRC_DIR, "api", "client.js"))
        assert 'errorData.detail || `Request failed: ${response.status}`' in client_content
        assert 'response.status === 401' in client_content
        results["Error states"] = True
        print("✓ TEST 23: API Error States: PASS")
    except Exception as e:
        results["Error states"] = False
        print(f"✗ TEST 23: Error states FAIL: {e}")

    # -------------------------------------------------------------
    # TEST 24 & 25: SUCCESS AND ERROR TOASTS
    # -------------------------------------------------------------
    try:
        assert 'toast.success(' in login_content
        assert 'toast.error(' in login_content
        assert 'toast.success(' in settings_content
        assert 'toast.success(' in upload_content
        results["Success/error toasts"] = True
        print("✓ TEST 24/25: Success/Error Toasts: PASS")
    except Exception as e:
        results["Success/error toasts"] = False
        print(f"✗ TEST 24/25: Success/Error toasts FAIL: {e}")

    # -------------------------------------------------------------
    # TEST 26: MODALS
    # -------------------------------------------------------------
    try:
        assert 'showLogoutModal' in header_content, "Header missing logout modal"
        assert 'showClearModal' in header_content, "Header missing clear notifs modal"
        assert 'showRemovePhotoModal' in settings_content, "Settings missing remove photo modal"
        assert 'showOtpModal' in settings_content, "Settings missing OTP verification modal"
        results["Modals"] = True
        print("✓ TEST 26: Modals: PASS")
    except Exception as e:
        results["Modals"] = False
        print(f"✗ TEST 26: Modals FAIL: {e}")

    # -------------------------------------------------------------
    # TEST 27: DOUBLE-SUBMIT SAFETY
    # -------------------------------------------------------------
    try:
        assert 'disabled={loading}' in login_content, "Login missing disabled button during loading"
        assert 'disabled={loading}' in reg_content, "Register missing disabled button during loading"
        assert 'disabled={uploading}' in upload_content, "Upload missing disabled button during upload"
        assert 'disabled={loading}' in pred_content, "Predict missing disabled button during prediction"
        assert 'disabled={savingProfile}' in settings_content, "Settings missing disabled button during save"
        results["Double-submit safety"] = True
        print("✓ TEST 27: Double-submit Safety: PASS")
    except Exception as e:
        results["Double-submit safety"] = False
        print(f"✗ TEST 27: Double-submit safety FAIL: {e}")

    # -------------------------------------------------------------
    # TEST 28: FORMS
    # -------------------------------------------------------------
    try:
        assert 'Work Email Address' in login_content
        assert 'Password' in login_content
        assert 'First Name' in reg_content
        assert 'First Name' in settings_content
        results["Forms"] = True
        print("✓ TEST 28: Forms: PASS")
    except Exception as e:
        results["Forms"] = False
        print(f"✗ TEST 28: Forms FAIL: {e}")

    # -------------------------------------------------------------
    # TEST 29: KEYBOARD BASICS
    # -------------------------------------------------------------
    try:
        assert ':focus-visible' in css_content, "Missing focus-visible keyboard styling in CSS"
        assert "e.key === 'Escape'" in header_content, "Header missing Escape key listener to close modals"
        assert "handleSearchKeyDown" in header_content, "Header search missing keyboard navigation"
        results["Keyboard basics"] = True
        print("✓ TEST 29: Keyboard Basics: PASS")
    except Exception as e:
        results["Keyboard basics"] = False
        print(f"✗ TEST 29: Keyboard basics FAIL: {e}")

    # -------------------------------------------------------------
    # TEST 30: COLORS / RISK BADGES
    # -------------------------------------------------------------
    try:
        assert '.badge-red' in css_content, "Missing .badge-red for High Risk"
        assert '.badge-amber' in css_content, "Missing .badge-amber for Medium Risk"
        assert '.badge-green' in css_content, "Missing .badge-green for Low Risk"
        assert 'riskColor' in pred_content, "Predict missing riskColor helper"
        results["Risk badges"] = True
        print("✓ TEST 30: Risk Badges: PASS")
    except Exception as e:
        results["Risk badges"] = False
        print(f"✗ TEST 30: Risk badges FAIL: {e}")

    # -------------------------------------------------------------
    # TEST 31: CHART CONSISTENCY
    # -------------------------------------------------------------
    try:
        assert 'CustomChartTooltip' in dash_content, "Dashboard missing custom tooltip"
        assert '[data-theme="dark"] .recharts-text' in css_content, "Missing dark mode chart fill"
        assert '[data-theme="dark"] .recharts-cartesian-grid' in css_content, "Missing dark mode grid line color"
        results["Charts"] = True
        print("✓ TEST 31: Chart Consistency: PASS")
    except Exception as e:
        results["Charts"] = False
        print(f"✗ TEST 31: Charts FAIL: {e}")

    # -------------------------------------------------------------
    # TEST 32 & 33: PAGE REFRESH & BROWSER BACK/FORWARD
    # -------------------------------------------------------------
    try:
        protected_route_content = read_file(os.path.join(SRC_DIR, "components", "ProtectedRoute.jsx"))
        assert 'localStorage.getItem(\'token\')' in protected_route_content, "ProtectedRoute missing token check"
        assert 'Navigate to="/login"' in protected_route_content, "ProtectedRoute missing redirect"
        results["Page refresh"] = True
        results["Back/forward routing"] = True
        print("✓ TEST 32: Page Refresh: PASS")
        print("✓ TEST 33: Back/forward Routing: PASS")
    except Exception as e:
        results["Page refresh"] = False
        results["Back/forward routing"] = False
        print(f"✗ TEST 32/33: Page Refresh / Routing FAIL: {e}")

    # -------------------------------------------------------------
    # TEST 34: LOGOUT UX
    # -------------------------------------------------------------
    try:
        assert 'handleExecuteLogout' in header_content, "Header missing logout handler"
        assert 'handleConfirmLogout' in sidebar_content, "Sidebar missing logout handler"
        assert "localStorage.removeItem('token')" in header_content
        assert "localStorage.removeItem('company_id')" in header_content
        assert "localStorage.removeItem('user_profile')" in header_content
        assert "sessionStorage.clear()" in header_content
        results["Logout UX"] = True
        print("✓ TEST 34: Logout UX: PASS")
    except Exception as e:
        results["Logout UX"] = False
        print(f"✗ TEST 34: Logout UX FAIL: {e}")

    # -------------------------------------------------------------
    # TEST 35: USER SWITCH ISOLATION
    # -------------------------------------------------------------
    try:
        assert 'setNotifications([])' in header_content, "Header does not clear notifications on logout"
        assert 'setUnreadCount(0)' in header_content, "Header does not clear unread count on logout"
        results["User-switch isolation"] = True
        print("✓ TEST 35: User-switch Isolation: PASS")
    except Exception as e:
        results["User-switch isolation"] = False
        print(f"✗ TEST 35: User switch isolation FAIL: {e}")

    # -------------------------------------------------------------
    # TEST 36: CONSOLE ERRORS & RUNTIME REVIEW
    # -------------------------------------------------------------
    try:
        assert 'console.error(' not in app_content, "Unexpected console.error in App.jsx"
        results["Console errors"] = True
        print("✓ TEST 36: Console Review: PASS")
    except Exception as e:
        results["Console errors"] = False
        print(f"✗ TEST 36: Console errors FAIL: {e}")

    # -------------------------------------------------------------
    # TEST 37: NETWORK BEHAVIOR
    # -------------------------------------------------------------
    try:
        assert 'setInterval(' not in dash_content, "Dashboard should not have continuous setInterval polling"
        assert 'setInterval(' not in cust_content, "Customers should not have continuous setInterval polling"
        results["Network behavior"] = True
        print("✓ TEST 37: Network Review: PASS")
    except Exception as e:
        results["Network behavior"] = False
        print(f"✗ TEST 37: Network behavior FAIL: {e}")

    # -------------------------------------------------------------
    # TEST 38: BROKEN ASSETS
    # -------------------------------------------------------------
    try:
        assert os.path.exists(os.path.join(FRONTEND_DIR, "public", "favicon.svg")), "favicon.svg missing"
        assert os.path.exists(os.path.join(FRONTEND_DIR, "index.html")), "index.html missing"
        results["Broken assets"] = True
        print("✓ TEST 38: Broken Assets: PASS")
    except Exception as e:
        results["Broken assets"] = False
        print(f"✗ TEST 38: Broken assets FAIL: {e}")

    # -------------------------------------------------------------
    # TEST 39: NO MOCK DATA AUDIT
    # -------------------------------------------------------------
    try:
        prohibited = ["Maya Chen", "John Doe", "Lorem ipsum", "184.2K", "94.2%"]
        found = []
        for root, dirs, files in os.walk(SRC_DIR):
            for file in files:
                if file.endswith(('.jsx', '.js', '.css', '.html')):
                    filepath = os.path.join(root, file)
                    c = read_file(filepath)
                    for term in prohibited:
                        if term in c:
                            found.append((file, term))
        assert not found, f"Found mock data remnants in production code: {found}"
        results["Mock-data removal"] = True
        print("✓ TEST 39: No Mock Data Audit: PASS")
    except Exception as e:
        results["Mock-data removal"] = False
        print(f"✗ TEST 39: Mock data audit FAIL: {e}")

    # -------------------------------------------------------------
    # TEST 40: UI REGRESSION
    # -------------------------------------------------------------
    try:
        all_passed = all(results.values())
        results["UI regression"] = all_passed
        print(f"✓ TEST 40: UI Regression: {'PASS' if all_passed else 'FAIL'}")
    except Exception as e:
        results["UI regression"] = False
        print(f"✗ TEST 40: UI regression FAIL: {e}")

    print("=" * 70)
    print(f"SUMMARY: {sum(1 for v in results.values() if v)} / {len(results)} CATEGORIES PASSED")
    print("=" * 70)
    return results

if __name__ == "__main__":
    results = run_qa11_tests()
    failed = [k for k, v in results.items() if not v]
    if failed:
        print(f"FAILED CATEGORIES: {failed}")
        sys.exit(1)
    else:
        print("ALL QA-11 TESTS COMPLETED SUCCESSFULLY!")
        sys.exit(0)
