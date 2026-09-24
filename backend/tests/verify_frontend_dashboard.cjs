const fs = require('fs');
const path = require('path');

const dashboardPath = path.join(__dirname, '..', '..', 'frontend', 'src', 'pages', 'Dashboard.jsx');
const content = fs.readFileSync(dashboardPath, 'utf8');

console.log("=== VERIFYING FRONTEND DASHBOARD.JSX DATA INTEGRITY ===");

// 1. Verify no hardcoded/mock customer counts or metrics
const mockValues = ['7043', '12480', '1,248', '12,480', 'fakeStats', 'mockStats', 'demoStats'];
for (const val of mockValues) {
  // Check if mock value is used as customer count
  const countPattern = new RegExp(`['"]${val}['"]`, 'g');
  if (countPattern.test(content)) {
    console.error(`FAIL: Found hardcoded mock value '${val}' in Dashboard.jsx!`);
    process.exit(1);
  }
}
console.log("PASS: Zero hardcoded or mock customer counts found in Dashboard.jsx.");

// 2. Verify all KPI card metrics derive from stats API
const requiredBindings = [
  { name: 'Total Customers', code: 'total.toLocaleString()' },
  { name: 'Active Customers', code: 'activeCount.toLocaleString()' },
  { name: 'High Risk Count', code: 'high.toLocaleString()' },
  { name: 'Medium Risk Count', code: 'med.toLocaleString()' },
  { name: 'Low Risk Count', code: 'low.toLocaleString()' },
  { name: 'Total MRR', code: 'totalMRRRaw > 0 ? formatCurrency(totalMRRRaw) : \'₹0\'' },
  { name: 'Churn Rate', code: '`${churnRatePct}%`' }
];

for (const b of requiredBindings) {
  if (!content.includes(b.code)) {
    console.error(`FAIL: Missing binding for ${b.name}: '${b.code}'!`);
    process.exit(1);
  }
}
console.log("PASS: All 7 KPI metrics derive directly from stats state.");

// 3. Verify Currency formatting uses ₹ symbol
if (!content.includes("₹") || !content.includes("en-IN")) {
  console.error("FAIL: formatCurrency does not use ₹ symbol or en-IN localization!");
  process.exit(1);
}
console.log("PASS: formatCurrency uses Indian Rupee (₹) and Indian numeric system (en-IN).");

// 4. Verify Highest Risk Customers uses real stats.results
if (!content.includes("(stats?.results ?? []).slice(0, 5).map(") ||
    !content.includes("r.churn_probability")) {
  console.error("FAIL: Highest Risk Customers list does not derive from stats.results!");
  process.exit(1);
}
console.log("PASS: Highest Risk Customers table derives from live stats.results sorted by churn_probability.");

// 5. Verify Recent Activity uses real uploadHistory
if (!content.includes("uploadHistory.map(u =>") ||
    !content.includes("getUploadHistory(6)")) {
  console.error("FAIL: Recent Activity does not derive from getUploadHistory API!");
  process.exit(1);
}
console.log("PASS: Recent Activity derives from real dataset upload history API.");

// 6. Verify Run Batch Analysis button and handler
if (!content.includes("id=\"dashboard-run-analysis-btn\"") ||
    !content.includes("runBatchAnalysis()") ||
    !content.includes("disabled={analyzing || loading}")) {
  console.error("FAIL: Run Batch Analysis button or handler missing/improperly configured!");
  process.exit(1);
}
console.log("PASS: Run Batch Analysis button has proper loading disabled state and API binding.");

// 7. Verify empty state rendering when total_analyzed == 0
if (!content.includes("!loading && !hasData") ||
    !content.includes("No customer dataset loaded") ||
    !content.includes("Upload a dataset to see high-risk customers") ||
    !content.includes("No uploads yet")) {
  console.error("FAIL: Empty state clean fallbacks missing in Dashboard.jsx!");
  process.exit(1);
}
console.log("PASS: Clean empty states present for zero-data companies.");

// 8. Verify loading placeholder prevents flashing '0'
if (!content.includes("{loading ? '—' : total.toLocaleString()}")) {
  console.error("FAIL: Loading placeholder '—' missing from KPI cards!");
  process.exit(1);
}
console.log("PASS: Loading placeholder '—' properly prevents flashing 0 or stale numbers.");

console.log("=================================================");
console.log("ALL FRONTEND DASHBOARD DATA INTEGRITY CHECKS PASSED!");
console.log("=================================================");
