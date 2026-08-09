import { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import toast from 'react-hot-toast'
import { uploadDataset, getDatasetInfo } from '../api/dataset'

function Upload() {
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState(null)

  useEffect(() => {
    loadInfo()
  }, [])

  async function loadInfo() {
    try {
      const data = await getDatasetInfo()
      setInfo(data)
    } catch (err) {
      setInfo(null)
    }
  }

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    setError('')
    setMessage('')
    try {
      const result = await uploadDataset(file)
      setMessage(`${result.rows_stored} rows stored successfully`)
      toast.success(`${result.rows_stored} rows uploaded`)
      setFile(null)
      loadInfo()
    } catch (err) {
      setError(err.message)
      toast.error(err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="min-h-screen bg-purple-50 flex gap-4 p-4">
      <Sidebar />

      <div className="flex-1 max-w-xl">
        <h1 className="text-2xl font-bold text-gray-800 mb-1">Upload dataset</h1>
        <p className="text-sm text-gray-400 mb-6">
          Upload the Telco customer CSV used for churn prediction.
        </p>

        <div className="bg-white rounded-2xl shadow-sm p-6 mb-4">
          {info?.stored ? (
            <div className="bg-green-100 text-green-700 text-sm rounded-xl px-3 py-2 mb-4">
              {info.total_records} customer records currently stored
            </div>
          ) : (
            <div className="bg-amber-100 text-amber-700 text-sm rounded-xl px-3 py-2 mb-4">
              No dataset currently stored
            </div>
          )}

          <input
            type="file"
            accept=".csv"
            onChange={(e) => setFile(e.target.files[0])}
            className="w-full text-sm mb-4"
          />

          {message && <div className="bg-green-100 text-green-700 text-sm rounded-xl px-3 py-2 mb-4">{message}</div>}
          {error && <div className="bg-rose-100 text-rose-700 text-sm rounded-xl px-3 py-2 mb-4">{error}</div>}

          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-medium py-2 rounded-xl transition-colors duration-100 ease-out"
          >
            {uploading ? 'Uploading...' : 'Upload and store'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default Upload