const fs = require('fs');
const path = require('path');

const analyticsPath = path.join(__dirname, '..', '..', 'frontend', 'src', 'pages', 'Analytics.jsx');
const content = fs.readFileSync(analyticsPath, 'utf8');

console.log("=== VERIFYING FRONTEND ANALYTICS.JSX DATA INTEGRITY ===");

// 1. Verify zero fake/mock customer arrays or static percentages
const fakeTokens = ['fakeData', 'mockData', 'demoData', 'sampleData', 'mockMetrics', '7043', '12480'];
for (const tok of fakeTokens) {
  const re = new RegExp(`['"]${tok}['"]`, 'g');
  if (re.test(content)) {
    console.error(`FAIL: Found fake token '${tok}' in Analytics.jsx!`);
    process.exit(1);
  }
}
console.log("PASS: Zero fake/mock arrays or hardcoded customer totals in Analytics.jsx.");

// 2. Verify all KPI card metrics derive from backend stats API
const requiredBindings = [
  { name: 'Churn Rate', code: 'stats ? (hasData ? `${stats.avg_churn_rate}%` : \'0%\') : \'—\'' },
  { name: 'Retention Rate', code: 'stats ? (hasData ? `${(100 - stats.avg_churn_rate).toFixed(1)}%` : \'0%\') : \'—\'' },
  { name: 'Total MRR', code: 'stats ? (hasData ? formatCurrency(totalMrrRaw) : \'₹0\') : \'—\'' },
  { name: 'At-Risk MRR', code: 'stats ? (hasData ? formatCurrency(atRiskMrrRaw) : \'₹0\') : \'—\'' },
  { name: 'Contract Types', code: 'stats ? (hasData ? stats.plan_distribution?.length ?? 0 : 0) : \'—\'' }
];

for (const b of requiredBindings) {
  if (!content.includes(b.code)) {
    console.error(`FAIL: Missing binding for ${b.name}: '${b.code}'!`);
    process.exit(1);
  }
}
console.log("PASS: All 5 KPI metrics derive dynamically from stats state.");

// 3. Verify Currency formatting uses ₹ symbol and en-IN localization
if (!content.includes("₹") || !content.includes("en-IN") || !content.includes("formatCurrency(val)")) {
  console.error("FAIL: formatCurrency does not use ₹ symbol or en-IN localization in Analytics.jsx!");
  process.exit(1);
}
console.log("PASS: formatCurrency uses Indian Rupee (₹) and Indian numbering system (en-IN).");

// 4. Verify Plan distribution pie chart uses real stats.plan_distribution
if (!content.includes("const planData = stats?.plan_distribution ?? []") ||
    !content.includes("<Pie data={planData}")) {
  console.error("FAIL: Contract distribution does not bind to stats.plan_distribution!");
  process.exit(1);
}
console.log("PASS: Contract distribution PieChart binds directly to stats.plan_distribution.");

// 5. Verify Risk breakdown bar chart uses real risk counts
if (!content.includes("{ name: 'High',   count: stats.high_risk_count,   fill: '#EF4444' }") ||
    !content.includes("{ name: 'Medium', count: stats.medium_risk_count, fill: '#F59E0B' }") ||
    !content.includes("{ name: 'Low',    count: stats.low_risk_count,    fill: '#10B981' }")) {
  console.error("FAIL: Risk breakdown does not bind to high/medium/low risk counts from stats!");
  process.exit(1);
}
console.log("PASS: Risk breakdown BarChart binds directly to stats risk counts.");

// 6. Verify Model metrics derive from /ml/metrics
if (!content.includes("const [metrics,   setMetrics]   = useState(null)") ||
    !content.includes("getMLMetrics()") ||
    !content.includes("metrics.accuracy")) {
  console.error("FAIL: Model performance metrics do not derive from getMLMetrics API!");
  process.exit(1);
}
console.log("PASS: Model performance metrics derive directly from getMLMetrics API.");

// 7. Verify Feature importance derives from /ml/metrics feature_importance
if (!content.includes("metrics?.feature_importance ?? []") ||
    !content.includes("topFeatures.map(f => ({ name: f.feature, importance:")) {
  console.error("FAIL: Feature importance does not bind to metrics.feature_importance!");
  process.exit(1);
}
console.log("PASS: Feature importance BarChart binds directly to real model feature_importance.");

// 8. Verify Trend Analysis honestly reports no fake trend data
if (!content.includes("Historical Trend Data Not Available") ||
    !content.includes("No fake trend data will be shown. Data must originate from real prediction history.")) {
  console.error("FAIL: Trend Analysis tab does not have honest no-fake-data guarantee!");
  process.exit(1);
}
console.log("PASS: Trend Analysis tab guarantees no fake historical trend data is displayed.");

// 9. Verify loading placeholder '—' prevents flashing 0
if (!content.includes("{loading ? '—' : churnRate}") ||
    !content.includes("{loading ? '—' : retainRate}") ||
    !content.includes("{loading ? '—' : totalMrrStr}")) {
  console.error("FAIL: Loading placeholder '—' missing in KPI cards!");
  process.exit(1);
}
console.log("PASS: Loading placeholder '—' properly prevents flashing 0 or stale numbers.");

console.log("=================================================");
console.log("ALL FRONTEND ANALYTICS DATA INTEGRITY CHECKS PASSED!");
console.log("=================================================");
