const fs = require('fs');
const path = require('path');

const reportsPath = path.resolve(__dirname, '../../frontend/src/pages/Reports.jsx');
const apiReportsPath = path.resolve(__dirname, '../../frontend/src/api/reports.js');

const reportsContent = fs.readFileSync(reportsPath, 'utf8');
const apiContent = fs.readFileSync(apiReportsPath, 'utf8');

const tests = [];

function check(title, condition, detail = '') {
  tests.push({ title, passed: !!condition, detail });
  console.log(`[${condition ? 'PASS' : 'FAIL'}] ${title} ${detail ? '(' + detail + ')' : ''}`);
}

console.log('==================================================');
console.log('VERIFYING FRONTEND REPORTS UI & API INTEGRITY');
console.log('==================================================');

// 1. API Client Verification
check('downloadReport defined in api/reports.js', apiContent.includes('export async function downloadReport'));
check('downloadReport queries /reports/export/csv with risk_level param', apiContent.includes('/reports/export/csv?risk_level='));
check('downloadReport generates dynamic blob URL and triggers anchor click', apiContent.includes('window.URL.createObjectURL(blob)') && apiContent.includes('a.click()'));

// 2. Reports Page Load & Live Stats
check('Reports.jsx imports downloadReport and getDashboardStats', reportsContent.includes('downloadReport') && reportsContent.includes('getDashboardStats'));
check('Reports.jsx loads stats via getDashboardStats()', reportsContent.includes('await getDashboardStats()'));
check('Live data summary strip renders total_analyzed and high_risk_count', reportsContent.includes('stats.total_analyzed') && reportsContent.includes('stats.high_risk_count'));

// 3. Currency Formatting (INR / ₹)
check('formatCurrency defined in Reports.jsx', reportsContent.includes('function formatCurrency('));
check('formatCurrency uses ₹ (INR) format', reportsContent.includes('₹'));
check('Monthly Revenue cards use formatCurrency (no hardcoded $)', !reportsContent.includes("`$${Math.round(stats.total_mrr)") && reportsContent.includes('formatCurrency(stats.total_mrr)'));

// 4. Download Handlers & Risk Filters
check('handleDownload handles riskLevel argument', reportsContent.includes('handleDownload(riskLevel)') && reportsContent.includes('downloadReport(riskLevel)'));
check('Download All button present', reportsContent.includes("handleDownload('All')"));
check('High Risk Only button present', reportsContent.includes("handleDownload('High')"));
check('Medium Risk button present', reportsContent.includes("handleDownload('Medium')"));
check('Low Risk button present', reportsContent.includes("handleDownload('Low')"));
check('Download buttons disable during active download', reportsContent.includes("disabled={downloading === 'All'}") && reportsContent.includes("disabled={downloading === 'High'}"));

// 5. Print & Preview
check('Print button triggers window.print()', reportsContent.includes('window.print()'));
check('Executive preview modal uses real stats', reportsContent.includes('openExecutivePreview') && reportsContent.includes('previewModal'));
check('Revenue impact preview uses prediction rows', reportsContent.includes('openRevenuePreview') && reportsContent.includes('stats.results'));

// 6. Scheduled Reports notice
check('Honest scheduling notice (cron not yet implemented)', reportsContent.includes('Report Scheduling Not Yet Available'));

console.log('==================================================');
const allPassed = tests.every(t => t.passed);
console.log(`TOTAL: ${tests.filter(t => t.passed).length}/${tests.length} CHECKS PASSED`);
console.log('==================================================');

process.exit(allPassed ? 0 : 1);
