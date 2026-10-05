import { useEffect, useRef, useState } from 'react'
import Sidebar from '../components/Sidebar'
import Header from '../components/Header'
import toast from 'react-hot-toast'
import { uploadDataset, getDatasetInfo, getUploadHistory } from '../api/dataset'
import {
  UploadCloud, FileText, CheckCircle, AlertCircle, X, Clock,
  Database, TrendingUp, Copy, Users
} from 'lucide-react'

function timeAgo(isoString) {
  if (!isoString) return ''
  const diff = (Date.now() - new Date(isoString).getTime()) / 1000
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`
  return `${Math.floor(diff / 86400)} days ago`
}

const UPLOAD_STAGES = [
  { key: 'uploading',   label: 'Uploading CSV file to server…' },
  { key: 'validating',  label: 'Validating column schema & datatypes…' },
  { key: 'processing',  label: 'Deduplicating against existing customer IDs…' },
  { key: 'storing',     label: 'Bulk storing in MongoDB Atlas & indexing…' },
  { key: 'complete',    label: 'Upload complete! Synchronized cache.' },
]

function Upload() {
  const [file,          setFile]          = useState(null)
  const [uploading,     setUploading]     = useState(false)
  const [uploadStage,   setUploadStage]   = useState(0) // index in UPLOAD_STAGES
  const [uploadResult,  setResult]        = useState(null)
  const [error,         setError]         = useState('')
  const [info,          setInfo]          = useState(null)
  const [history,       setHistory]       = useState([])
  const [dragging,      setDragging]      = useState(false)
  const [preview,       setPreview]       = useState(null)
  const abortControllerRef = useRef(null)
  const isMountedRef       = useRef(true)
  const timerRefs          = useRef([])
  const inputRef           = useRef()

  function clearTimers() {
    timerRefs.current.forEach(t => clearTimeout(t))
    timerRefs.current = []
  }

  useEffect(() => {
    isMountedRef.current = true
    loadInfo()
    loadHistory()

    return () => {
      isMountedRef.current = false
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      clearTimers()
    }
  }, [])

  async function loadInfo() {
    try {
      const d = await getDatasetInfo()
      if (!isMountedRef.current) return
      setInfo(d)
      if (d?.sample_record) {
        const cols = Object.keys(d.sample_record).filter(k => k !== '_id')
        setPreview({ columns: cols, sample: d.sample_record })
      }
    } catch {
      if (isMountedRef.current) setInfo(null)
    }
  }

  async function loadHistory() {
    try {
      const h = await getUploadHistory(5)
      if (isMountedRef.current && Array.isArray(h)) setHistory(h)
    } catch { /* silent */ }
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped?.name.endsWith('.csv')) {
      setFile(dropped)
      setResult(null)
      setError('')
    } else {
      toast.error('Please drop a valid .csv file')
    }
  }

  function handleCancelUpload() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    clearTimers()
    setUploading(false)
    setUploadStage(0)
    toast('Upload cancelled', { icon: 'ℹ️' })
  }

  async function handleUpload() {
    if (!file || uploading) return

    setUploading(true)
    setError('')
    setResult(null)
    setUploadStage(0)
    clearTimers()

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    // Simulated progress stage progression while network request is active
    timerRefs.current.push(setTimeout(() => {
      if (isMountedRef.current && !abortController.signal.aborted) setUploadStage(1)
    }, 250))
    timerRefs.current.push(setTimeout(() => {
      if (isMountedRef.current && !abortController.signal.aborted) setUploadStage(2)
    }, 600))
    timerRefs.current.push(setTimeout(() => {
      if (isMountedRef.current && !abortController.signal.aborted) setUploadStage(3)
    }, 1100))

    try {
      const result = await uploadDataset(file, abortController.signal)
      clearTimers()

      // Critical guard: If aborted, unmounted, or cancelled, do not display stale success popup
      if (abortController.signal.aborted || !isMountedRef.current) {
        return
      }

      setUploadStage(4) // complete
      setResult(result)
      const newCount = result.new_records ?? result.inserted ?? result.rows_stored ?? 0
      const dupCount = result.duplicates_skipped ?? result.duplicate_rows ?? 0

      if (newCount === 0 && dupCount > 0) {
        toast(
          `No new records added — all ${dupCount.toLocaleString()} rows already exist in database.`,
          { icon: 'ℹ️', duration: 4000 }
        )
      } else if (newCount > 0 && dupCount > 0) {
        toast.success(
          `${newCount.toLocaleString()} new records added (${dupCount.toLocaleString()} duplicates skipped)!`
        )
      } else {
        toast.success(`${newCount.toLocaleString()} new records added successfully!`)
      }

      setFile(null)

      // Refresh in-memory state without full page reload
      await loadInfo()
      await loadHistory()
    } catch (err) {
      clearTimers()
      if (abortController.signal.aborted || err.name === 'AbortError' || !isMountedRef.current) {
        return
      }
      setError(err.message)
      toast.error(err.message)
    } finally {
      if (isMountedRef.current && !abortController.signal.aborted) {
        setUploading(false)
      }
    }
  }

  return (
    <div className="page-layout">
      <Sidebar />
      <div className="page-content" style={{ padding: '24px 32px' }}>

        <Header title="Upload Dataset" subtitle="Upload customer CSV data to run predictions, update stats, and power ML dashboards." />

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
                ? `${info.total_records.toLocaleString()} customer records currently stored in your tenant database`
                : 'No dataset currently stored — upload a CSV to get started'}
            </p>
          </div>
        )}

        {/* Drop zone */}
        <div
          className="card"
          style={{
            padding: '44px 32px', marginBottom: '20px', cursor: 'pointer', textAlign: 'center',
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
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
            or click to browse — only .csv files accepted
          </p>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            New records are <strong>appended</strong>. Existing customerIDs are automatically skipped.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            onChange={e => {
              if (e.target.files[0]) {
                setFile(e.target.files[0])
                setResult(null)
                setError('')
              }
            }}
          />
          <span className="btn-secondary" style={{ pointerEvents: 'none', display: 'inline-flex' }}>
            Browse Files
          </span>
        </div>

        {/* Selected file card */}
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
            {!uploading && (
              <button
                onClick={() => setFile(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', borderRadius: '6px' }}
              >
                <X size={16} />
              </button>
            )}
          </div>
        )}

        {/* Upload Progress Indicator */}
        {uploading && (
          <div className="card" style={{ padding: '20px 24px', marginBottom: '20px', background: 'var(--surface)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '16px', height: '16px', border: '2px solid var(--purple-200)', borderTopColor: 'var(--purple-600)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {UPLOAD_STAGES[uploadStage]?.label || 'Processing upload…'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--purple-600)' }}>
                  {Math.round(((uploadStage + 1) / UPLOAD_STAGES.length) * 100)}%
                </span>
                <button
                  onClick={handleCancelUpload}
                  type="button"
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: 'var(--danger)',
                    borderRadius: '6px',
                    padding: '3px 9px',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>

            {/* Progress bar track */}
            <div style={{ width: '100%', height: '6px', background: 'var(--border)', borderRadius: '99px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${Math.round(((uploadStage + 1) / UPLOAD_STAGES.length) * 100)}%`,
                background: 'linear-gradient(90deg, #7C3AED 0%, #3B82F6 100%)',
                borderRadius: '99px',
                transition: 'width 300ms ease'
              }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '11px', color: 'var(--text-muted)' }}>
              <span>Step {uploadStage + 1} of {UPLOAD_STAGES.length}</span>
              <span>Fast bulk ingest & caching</span>
            </div>
          </div>
        )}

        {/* Upload Result Summary */}
        {uploadResult && (
          <div style={{
            background: uploadResult.new_records === 0 ? 'rgba(59, 130, 246, 0.08)' : 'rgba(16, 185, 129, 0.08)',
            border: `1px solid ${uploadResult.new_records === 0 ? 'rgba(59, 130, 246, 0.25)' : 'rgba(16, 185, 129, 0.25)'}`,
            borderRadius: '14px',
            padding: '16px 20px', marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <CheckCircle size={16} color={uploadResult.new_records === 0 ? '#3b82f6' : 'var(--success)'} />
              <p style={{ fontSize: '13px', fontWeight: 700, color: uploadResult.new_records === 0 ? '#2563eb' : 'var(--success)' }}>
                {uploadResult.new_records === 0
                  ? `Upload processed: All ${uploadResult.total_rows?.toLocaleString()} records already exist (0 duplicates created)`
                  : 'Dataset uploaded & processed successfully'}
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px' }}>
              {[
                { label: 'Total Rows in File', value: uploadResult.total_rows?.toLocaleString() ?? '—', icon: Database, color: 'var(--text-primary)' },
                { label: 'New Records Added', value: (uploadResult.new_records ?? uploadResult.inserted)?.toLocaleString() ?? '—', icon: TrendingUp, color: 'var(--success)' },
                { label: 'Duplicates Skipped', value: (uploadResult.duplicates_skipped ?? uploadResult.duplicate_rows)?.toLocaleString() ?? '0', icon: Copy, color: 'var(--warning)' },
                { label: 'Total in Database', value: (uploadResult.total_in_db ?? uploadResult.final_customer_count)?.toLocaleString() ?? '—', icon: Users, color: 'var(--purple-primary)' },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} style={{ background: 'var(--surface)', borderRadius: '10px', padding: '12px 16px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <Icon size={14} color={color} />
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>{label}</p>
                  </div>
                  <p style={{ fontSize: '20px', fontWeight: 800, color }}>{value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div style={{ background: 'rgba(248, 113, 113, 0.12)', border: '1px solid rgba(248, 113, 113, 0.25)', color: 'var(--danger)', fontSize: '13px', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        {file && (
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="btn-primary"
            style={{ width: '100%', padding: '12px', fontSize: '14px', justifyContent: 'center', marginBottom: '24px', opacity: uploading ? 0.7 : 1 }}
          >
            {uploading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                Uploading & Storing Dataset…
              </div>
            ) : (
              'Upload & Store Dataset'
            )}
          </button>
        )}

        {/* Dataset Preview Table */}
        <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Dataset Preview</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {preview ? 'Sample record from the stored dataset' : 'No dataset currently stored'}
              </p>
            </div>
            {preview && (
              <span className="badge badge-purple" style={{ fontSize: '11px' }}>
                {preview.columns.length} columns
              </span>
            )}
          </div>

          {!preview ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
              <Database size={32} style={{ marginBottom: '10px', opacity: 0.3 }} />
              <p>Upload a CSV to see a dataset preview here</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--table-header-bg)', borderBottom: '1px solid var(--border)' }}>
                    {preview.columns.map(col => (
                      <th key={col} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                        {col.toUpperCase()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderTop: '1px solid var(--border)' }}>
                    {preview.columns.map(col => (
                      <td key={col} style={{ padding: '10px 14px', fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {String(preview.sample[col] ?? '—')}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Upload History */}
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Clock size={16} color="var(--text-muted)" />
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Upload History</h3>
          </div>

          {history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
              No uploads yet
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0', minWidth: '560px' }}>
                {history.map((h, i) => (
                  <div
                    key={h._id || i}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 100px 90px 90px 90px 120px',
                      alignItems: 'center',
                      padding: '12px 0',
                      borderBottom: i < history.length - 1 ? '1px solid var(--border)' : 'none',
                      gap: '16px',
                      fontSize: '12px',
                    }}
                  >
                    <div>
                      <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{h.filename}</p>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>by {h.uploaded_by}</p>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{h.total_rows?.toLocaleString()}</p>
                      <p style={{ fontSize: '10px', color: 'var(--text-muted)' }}>total rows</p>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontWeight: 700, color: '#16a34a' }}>{(h.new_records ?? h.inserted_rows ?? 0)?.toLocaleString()}</p>
                      <p style={{ fontSize: '10px', color: 'var(--text-muted)' }}>inserted</p>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontWeight: 700, color: '#d97706' }}>{(h.duplicates_skipped ?? h.duplicate_rows ?? 0)?.toLocaleString()}</p>
                      <p style={{ fontSize: '10px', color: 'var(--text-muted)' }}>duplicates</p>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{(h.total_in_db ?? h.final_total)?.toLocaleString() ?? '—'}</p>
                      <p style={{ fontSize: '10px', color: 'var(--text-muted)' }}>total in DB</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className={h.status === 'success' ? 'badge badge-green' : 'badge badge-yellow'} style={{ fontSize: '10px' }}>
                        ● {h.status}
                      </span>
                      <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '3px' }}>{timeAgo(h.uploaded_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  )
}

export default Upload