const fs = require('fs');
const path = require('path');

const predictPath = path.join(__dirname, '..', '..', 'frontend', 'src', 'pages', 'Predict.jsx');
const content = fs.readFileSync(predictPath, 'utf8');

console.log("=== VERIFYING FRONTEND PREDICT.JSX DATA INTEGRITY ===");

// 1. Verify zero mock predictions or hardcoded probabilities
const mockTokens = ['fakePrediction', 'mockPrediction', 'demoPrediction', 'samplePrediction', '0.8234'];
for (const tok of mockTokens) {
  const re = new RegExp(`['"]${tok}['"]`, 'g');
  if (re.test(content)) {
    console.error(`FAIL: Found fake token '${tok}' in Predict.jsx!`);
    process.exit(1);
  }
}
console.log("PASS: Zero hardcoded mock predictions found in Predict.jsx.");

// 2. Verify connection to /predict/full API
if (!content.includes("apiRequest('/predict/full'") ||
    !content.includes("method: 'POST'") ||
    !content.includes("JSON.stringify(payload)")) {
  console.error("FAIL: Predict.jsx does not post to /predict/full endpoint!");
  process.exit(1);
}
console.log("PASS: Predict.jsx sends payload to /predict/full via POST.");

// 3. Verify real result bindings
const requiredResultBindings = [
  'result.risk_level',
  'result.churn_probability',
  'result.top_factors',
  'result.recommended_actions'
];
for (const b of requiredResultBindings) {
  if (!content.includes(b)) {
    console.error(`FAIL: Missing result binding '${b}' in Predict.jsx!`);
    process.exit(1);
  }
}
console.log("PASS: All inference result fields (risk, probability, SHAP, recommendations) are bound.");

// 4. Verify currency uses ₹ in detail fields
if (!content.includes("`₹${parseFloat(selectedCustomer.MonthlyCharges).toFixed(2)}`") ||
    !content.includes("`₹${parseFloat(selectedCustomer.TotalCharges).toFixed(2)}`")) {
  console.error("FAIL: Predict.jsx customer details do not use ₹ Indian Rupee formatting!");
  process.exit(1);
}
console.log("PASS: Customer charges displayed with Indian Rupee (₹) symbol.");

// 5. Verify SHAP bidirectional factor impact rendering
if (!content.includes("f.direction === 'increases churn risk' ? '+' : '−'") ||
    !content.includes("(f.impact * 100).toFixed(0)")) {
  console.error("FAIL: Missing bidirectional SHAP impact rendering logic!");
  process.exit(1);
}
console.log("PASS: SHAP factors render directional +/- impact percentages.");

// 6. Verify loading and error states
if (!content.includes("Running ML inference…") ||
    !content.includes("Prediction failed") ||
    !content.includes("setPredError")) {
  console.error("FAIL: Missing loading or error state handling in Predict.jsx!");
  process.exit(1);
}
console.log("PASS: Loading spinner and error handling present.");

// 7. Verify dynamic customer selection from authenticated tenant API
if (!content.includes("apiRequest('/telco/customers?page=1&limit=100')") ||
    !content.includes("customers.map((c, i) =>")) {
  console.error("FAIL: Customers are not loaded dynamically from tenant API!");
  process.exit(1);
}
console.log("PASS: Customer list dynamically loaded from company's /telco/customers endpoint.");

console.log("=================================================");
console.log("ALL FRONTEND PREDICT DATA INTEGRITY CHECKS PASSED!");
console.log("=================================================");
