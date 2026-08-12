export async function downloadReport(riskLevel = "All") {
  const token = localStorage.getItem('token')
  const API_URL = "http://127.0.0.1:8000"

  const response = await fetch(`${API_URL}/reports/export/csv?risk_level=${riskLevel}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  })

  if (!response.ok) {
    let errorMessage = "Failed to download report"
    try {
      const errorData = await response.json()
      errorMessage = errorData.detail || errorMessage
    } catch (e) {
      // Not JSON
    }
    throw new Error(errorMessage)
  }

  // Create a Blob from the response
  const blob = await response.blob()
  
  // Create a hidden anchor element to trigger the download
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `churndata_${riskLevel.toLowerCase()}.csv`
  document.body.appendChild(a)
  a.click()
  
  // Cleanup
  a.remove()
  window.URL.revokeObjectURL(url)
}
