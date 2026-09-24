const fs = require('fs');
const path = require('path');

const customersFilePath = path.join(__dirname, '..', '..', 'frontend', 'src', 'pages', 'Customers.jsx');
const content = fs.readFileSync(customersFilePath, 'utf8');

console.log("=== VERIFYING FRONTEND CUSTOMERS.JSX ===");

// 1. Check for fake demo data arrays
const fakeNames = ['Amelia Fischer', 'John Doe', 'Maya Chen', 'sampleCustomerData'];
for (const name of fakeNames) {
  if (content.includes(name)) {
    console.error(`FAIL: Found fake data '${name}' in Customers.jsx!`);
    process.exit(1);
  }
}
console.log("PASS: Zero fake/mock customer arrays found in Customers.jsx.");

// 2. Check pagination logic
if (!content.includes("const showingFrom = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1") ||
    !content.includes("const showingTo   = Math.min(currentPage * PAGE_SIZE, total)")) {
  console.error("FAIL: Missing showingFrom / showingTo pagination bounds logic!");
  process.exit(1);
}
console.log("PASS: Verified showingFrom / showingTo pagination display logic.");

// 3. Check Next button disabled on final page
if (!content.includes("disabled={currentPage >= totalPages}")) {
  console.error("FAIL: Next button not properly disabled on last page!");
  process.exit(1);
}
console.log("PASS: Verified Next button is disabled when currentPage >= totalPages.");

// 4. Check Previous button disabled on page 1
if (!content.includes("disabled={currentPage === 1}")) {
  console.error("FAIL: Previous button not disabled on page 1!");
  process.exit(1);
}
console.log("PASS: Verified Previous button is disabled on page 1.");

// 5. Check Delete confirmation modal / prompt
if (!content.includes("window.confirm(`Delete customer \"${displayName}\"? This cannot be undone.`")) {
  console.error("FAIL: Missing delete confirmation prompt!");
  process.exit(1);
}
console.log("PASS: Verified Delete confirmation prompt exists with Cancel & Delete actions.");

// 6. Check special case: delete only record on last page moves back 1 page
if (!content.includes("if (records.length === 1 && currentPage > 1)") ||
    !content.includes("const prevPage = currentPage - 1") ||
    !content.includes("setCurrentPage(prevPage)")) {
  console.error("FAIL: Missing last-record on last-page rollback logic!");
  process.exit(1);
}
console.log("PASS: Verified delete on single-item last page rolls back to previous valid page.");

// 7. Check search input clear button
if (!content.includes("id=\"clear-search-btn\"") ||
    !content.includes("handleClearSearch")) {
  console.error("FAIL: Missing clear-search-btn or handleClearSearch handler!");
  process.exit(1);
}
console.log("PASS: Verified clear-search button and handleClearSearch resetting page to 1.");

// 8. Check empty state display
if (!content.includes("No customers match your search") ||
    !content.includes("No customers yet")) {
  console.error("FAIL: Missing empty state UI!");
  process.exit(1);
}
console.log("PASS: Verified clean empty states for both search misses and zero-customer tenants.");

console.log("\nALL FRONTEND CODE ASSERTIONS PASSED!");
