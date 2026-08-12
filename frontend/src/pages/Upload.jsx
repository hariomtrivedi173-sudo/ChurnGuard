import { useEffect, useRef, useState } from 'react'
import Sidebar from '../components/Sidebar'
import toast from 'react-hot-toast'
import { uploadDataset, getDatasetInfo } from '../api/dataset'
import { UploadCloud, FileText, CheckCircle, AlertCircle, X } from 'lucide-react'

function Upload() {
  const [file,      setFile]      = useState(null)
  const [uploading, setUploading] = useState(false)
  const [message,   setMessage]   = useState('')
  const [error,     setError]     = useState('')
  const [info,      setInfo]      = useState(null)
  const [dragging,  setDragging]  = useState(false)
  const inputRef = useRef()

  useEffect(() => { loadInfo() }, [])

  async function loadInfo() {
    try { setInfo(await getDatasetInfo()) }
    catch { setInfo(null) }
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped?.name.endsWith('.csv')) setFile(dropped)
    else toast.error('Please drop a .csv file')
  }

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    setError('')
    setMessage('')
    try {
      const result = await uploadDataset(file)
      setMessage(`${result.rows_stored.toLocaleString()} rows stored successfully`)
      toast.success(`${result.rows_stored.toLocaleString()} rows uploaded`)
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
    <div className="page-layout">
      <Sidebar />
      <div className="page-content" style={{ maxWidth: '680px' }}>

        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Upload Dataset</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Upload the Telco customer CSV to power churn predictions
          </p>
        </div>

        {/* Current dataset status */}
        {info !== null && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            background: info?.stored ? '#f0fdf4' : '#fffbeb',
            border: `1px solid ${info?.stored ? '#bbf7d0' : '#fde68a'}`,
            borderRadius: '12px', padding: '12px 16px', marginBottom: '20px',
          }}>
            {info?.stored
              ? <CheckCircle size={16} color="#16a34a" />
              : <AlertCircle size={16} color="#d97706" />}
            <p style={{ fontSize: '13px', fontWeight: 500, color: info?.stored ? '#15803d' : '#b45309' }}>
              {info?.stored
                ? `${info.total_records.toLocaleString()} customer records currently stored`
                : 'No dataset currently stored'}
            </p>
          </div>
        )}

        {/* Drop zone */}
        <div
          className="card"
          style={{ padding: '48px 32px', marginBottom: '16px', cursor: 'pointer', textAlign: 'center',
            border: dragging ? '2px dashed var(--purple-400)' : '2px dashed var(--border)',
            background: dragging ? 'var(--purple-50)' : 'var(--surface)',
            transition: 'all 200ms ease',
          }}
          onClick={() => inputRef.current.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <div style={{
            width: '56px', height: '56px',
            background: dragging ? 'var(--purple-100)' : '#f5f3ff',
            borderRadius: '16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
            transition: 'background 200ms ease',
          }}>
            <UploadCloud size={26} color={dragging ? 'var(--purple-600)' : '#a78bfa'} />
          </div>
          <p style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)', marginBottom: '6px' }}>
            {dragging ? 'Drop your CSV here' : 'Drag & drop your CSV file'}
          </p>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>
            or click to browse — only .csv files accepted
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={e => setFile(e.target.files[0])}
          />
          <span className="btn-secondary" style={{ pointerEvents: 'none', display: 'inline-flex' }}>
            Browse Files
          </span>
        </div>

        {/* Selected file */}
        {file && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--purple-50)', border: '1px solid var(--purple-200)',
            borderRadius: '12px', padding: '12px 16px', marginBottom: '16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FileText size={18} color="var(--purple-600)" />
              <div>
                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--purple-700)' }}>{file.name}</p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>
            <button
              onClick={() => setFile(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', borderRadius: '6px' }}
              onMouseEnter={e => e.currentTarget.style.color = '#e11d48'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {message && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', fontSize: '13px', padding: '12px 16px', borderRadius: '10px', marginBottom: '12px' }}>
            <CheckCircle size={15} /> {message}
          </div>
        )}
        {error && (
          <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', color: '#e11d48', fontSize: '13px', padding: '12px 16px', borderRadius: '10px', marginBottom: '12px' }}>
            {error}
          </div>
        )}

        <button
          id="upload-btn"
          onClick={handleUpload}
          disabled={!file || uploading}
          className="btn-primary"
          style={{ width: '100%', padding: '12px', fontSize: '14px' }}
        >
          {uploading
            ? <span style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}><Spinner /> Uploading…</span>
            : <span style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}><UploadCloud size={16} /> Upload & Store Dataset</span>
          }
        </button>
      </div>
    </div>
  )
}

function Spinner() {
  return <div style={{ width: '15px', height: '15px', border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
}

export default Upload