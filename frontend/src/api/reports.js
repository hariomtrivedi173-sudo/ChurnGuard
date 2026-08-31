import { apiBlob } from './client'

// Download a CSV export of prediction results filtered by risk level.
// riskLevel: "All" | "High" | "Medium" | "Low"
export async function downloadReport(riskLevel = 'All') {
  const blob = await apiBlob(`/reports/export/csv?risk_level=${encodeURIComponent(riskLevel)}`)

  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `churndata_${riskLevel.toLowerCase()}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
}
