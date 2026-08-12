import { useEffect, useRef, useState } from 'react'
import Sidebar from '../components/Sidebar'
import Header from '../components/Header'
import toast from 'react-hot-toast'
import { uploadDataset, getDatasetInfo } from '../api/dataset'
import { UploadCloud, FileText, CheckCircle, AlertCircle, X, Table } from 'lucide-react'

const sampleDatasetRows = [
  { id: 'CUS-1001', name: 'Ava Carter', company: 'Northwind Labs', plan: 'Enterprise', tenure: 24, usage: 82, tickets: 1, nps: 9 },
  { id: 'CUS-1002', name: 'Liam Nguyen', company: 'Lumen Health', plan: 'Growth', tenure: 11, usage: 64, tickets: 3, nps: 6 },
  { id: 'CUS-1003', name: 'Noah Patel', company: 'Vertex Retail', plan: 'Scale', tenure: 18, usage: 71, tickets: 0, nps: 8 },
  { id: 'CUS-1004', name: 'Emma Garcia', company: 'Cobalt Bank', plan: 'Enterprise', tenure: 31, usage: 88, tickets: 2, nps: 10 },
  { id: 'CUS-1005', name: 'Olivia Kim', company: 'Skyline Media', plan: 'Starter', tenure: 4, usage: 42, tickets: 5, nps: 3 },
]

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
      <div className="page-content" style={{ padding: '24px 32px' }}>

        <Header title="Upload Dataset" subtitle="Upload customer data to retrain ML models and generate predictions." />

        {/* Current dataset status */}
        {info !== null && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            background: info?.stored ? 'rgba(34, 197, 94, 0.12)' : 'rgba(217, 119, 6, 0.12)',
            border: `1px solid ${info?.stored ? '#bbf7d0' : '#fde68a'}`,
            borderRadius: '12px', padding: '12px 16px', marginBottom: '20px',
          }}>
            {info?.stored
              ? <CheckCircle size={16} color="#16a34a" />
              : <AlertCircle size={16} color="#d97706" />}
            <p style={{ fontSize: '13px', fontWeight: 600, color: info?.stored ? '#16a34a' : '#d97706' }}>
              {info?.stored
                ? `${info.total_records.toLocaleString()} customer records currently stored`
                : 'No dataset currently stored'}
            </p>
          </div>
        )}

        {/* Drop zone */}
        <div
          className="card"
          style={{ padding: '48px 32px', marginBottom: '20px', cursor: 'pointer', textAlign: 'center',
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
            background: 'var(--purple-50)',
            borderRadius: '16px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <UploadCloud size={26} color="var(--purple-600)" />
          </div>
          <p style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)', marginBottom: '6px' }}>
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
                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--purple-600)' }}>{file.name}</p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {(file.size / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>
            <button
              onClick={() => setFile(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', borderRadius: '6px' }}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {message && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#15803d', fontSize: '13px', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px' }}>
            <CheckCircle size={15} /> {message}
          </div>
        )}

        {error && (
          <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', color: '#e11d48', fontSize: '13px', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        {file && (
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="btn-primary"
            style={{ width: '100%', padding: '12px', fontSize: '14px', justifyContent: 'center', marginBottom: '24px' }}
          >
            {uploading ? 'Uploading & Cleaning Dataset…' : 'Upload & Store Dataset'}
          </button>
        )}

        {/* ── Dataset Preview Table (Matching Image 2) ── */}
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Dataset Preview</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>First 5 rows of the uploaded dataset</p>
            </div>
            <span className="badge badge-purple" style={{ fontSize: '11px' }}>
              14 columns
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--table-header-bg)', borderBottom: '1px solid var(--border)' }}>
                  {['ID', 'NAME', 'COMPANY', 'PLAN', 'TENURE', 'USAGE', 'TICKETS', 'NPS'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sampleDatasetRows.map(row => (
                  <tr key={row.id} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px', fontSize: '12px', fontWeight: 700, color: 'var(--purple-600)' }}>{row.id}</td>
                    <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{row.name}</td>
                    <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>{row.company}</td>
                    <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>{row.plan}</td>
                    <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>{row.tenure}</td>
                    <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>{row.usage}</td>
                    <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>{row.tickets}</td>
                    <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>{row.nps}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}

export default Upload