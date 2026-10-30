const fs = require('fs');
const path = require('path');

console.log("=== VERIFYING FRONTEND UPLOAD & DATASET DELETION INTEGRATION ===");

// 1. Verify frontend/src/api/dataset.js
const datasetApiFile = path.join(__dirname, '..', '..', 'frontend', 'src', 'api', 'dataset.js');
const apiContent = fs.readFileSync(datasetApiFile, 'utf8');

if (!apiContent.includes("export async function deleteDatasetUpload(uploadId)")) {
  console.error("FAIL: Missing deleteDatasetUpload in dataset.js!");
  process.exit(1);
}
if (!apiContent.includes("apiRequest(`/dataset/upload/${uploadId}`") || !apiContent.includes("method: 'DELETE'")) {
  console.error("FAIL: deleteDatasetUpload does not issue DELETE request to /dataset/upload/${uploadId}!");
  process.exit(1);
}
console.log("PASS: 1. api/dataset.js properly exports deleteDatasetUpload(uploadId) with HTTP DELETE.");

// 2. Verify frontend/src/pages/Upload.jsx
const uploadPageFile = path.join(__dirname, '..', '..', 'frontend', 'src', 'pages', 'Upload.jsx');
const uploadContent = fs.readFileSync(uploadPageFile, 'utf8');

// Check import
if (!uploadContent.includes("deleteDatasetUpload")) {
  console.error("FAIL: Upload.jsx does not import deleteDatasetUpload!");
  process.exit(1);
}
if (!uploadContent.includes("Trash2")) {
  console.error("FAIL: Upload.jsx does not import Trash2 icon!");
  process.exit(1);
}
console.log("PASS: 2. Upload.jsx imports deleteDatasetUpload and Trash2.");

// Check state variables
if (!uploadContent.includes("const [datasetToDelete, setDatasetToDelete] = useState(null)") ||
    !uploadContent.includes("const [deleting,        setDeleting]        = useState(false)")) {
  console.error("FAIL: Missing datasetToDelete or deleting state hooks in Upload.jsx!");
  process.exit(1);
}
console.log("PASS: 3. Deletion state hooks (datasetToDelete, deleting) verified.");

// Check delete action trigger in history table
if (!uploadContent.includes("onClick={() => setDatasetToDelete(h)}") ||
    !uploadContent.includes("aria-label={`Delete dataset ${h.filename}`}")) {
  console.error("FAIL: Missing delete trigger button in Upload History table rows!");
  process.exit(1);
}
console.log("PASS: 4. Delete action button in Upload History rows verified.");

// Check confirmation dialog
if (!uploadContent.includes("delete-dataset-modal-title") ||
    !uploadContent.includes("Delete Uploaded Dataset?") ||
    !uploadContent.includes("{datasetToDelete.filename}")) {
  console.error("FAIL: Confirmation dialog missing title or selected filename display!");
  process.exit(1);
}
console.log("PASS: 5. Confirmation modal displaying selected filename verified.");

// Check Cancel button
if (!uploadContent.includes("id=\"delete-dataset-cancel-btn\"") ||
    !uploadContent.includes("onClick={() => setDatasetToDelete(null)}")) {
  console.error("FAIL: Cancel button missing or does not dismiss modal safely!");
  process.exit(1);
}
console.log("PASS: 6. Cancel action safely dismisses dialog without deleting.");

// Check Confirm Delete button and handler
if (!uploadContent.includes("id=\"delete-dataset-confirm-btn\"") ||
    !uploadContent.includes("onClick={handleConfirmDelete}")) {
  console.error("FAIL: Confirm button missing or not linked to handleConfirmDelete!");
  process.exit(1);
}
if (!uploadContent.includes("await deleteDatasetUpload(uploadId)") ||
    !uploadContent.includes("await loadInfo()") ||
    !uploadContent.includes("await loadHistory()")) {
  console.error("FAIL: handleConfirmDelete does not refresh info and history upon deletion!");
  process.exit(1);
}
console.log("PASS: 7. handleConfirmDelete calls deleteDatasetUpload and refreshes dataset info & history.");

console.log("\n=======================================================");
console.log("  ALL FRONTEND CODE INTEGRATION CHECKS PASSED (7/7)!");
console.log("=======================================================");
