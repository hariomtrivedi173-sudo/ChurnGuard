import { useEffect, useRef, useState } from 'react'
import Sidebar from '../components/Sidebar'
import Header from '../components/Header'
import toast from 'react-hot-toast'
import { uploadDataset, getDatasetInfo, getUploadHistory } from '../api/dataset'
import {
  UploadCloud, FileText, CheckCircle2, AlertCircle, X, Clock,
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
  { key: 'storing',     label: 'Bulk storing in database & indexing…' },
  { key: 'complete',    label: 'Upload complete! Synchronized telemetry cache.' },
]

export default function Upload() {
  const [file,          setFile]          = useState(null)
  const [uploading,     setUploading]     = useState(false)
  const [uploadStage,   setUploadStage]   = useState(0)
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

    // Simulated progress stage progression
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

      if (abortController.signal.aborted || !isMountedRef.current) {
        return
      }

      setUploadStage(4) // complete
      setResult(result)
      const newCount = result.new_records ?? result.inserted ?? result.rows_stored ?? 0
      const dupCount = result.duplicates_skipped ?? result.duplicate_rows ?? 0

      if (newCount === 0 && dupCount > 0) {
        toast(
          `All ${dupCount.toLocaleString()} rows already exist in the database (0 duplicates created).`,
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

        <Header
          title="Upload Dataset"
          subtitle="Ingest customer telemetry CSV records to power churn analytics, risk scores, and retention pipelines."
        />

        {/* Current dataset status badge */}
        {info !== null && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            background: info?.stored ? 'rgba(16, 185, 129, 0.08)' : 'rgba(245, 158, 11, 0.08)',
            border: `1px solid ${info?.stored ? 'rgba(16, 185, 129, 0.25)' : 'rgba(245, 158, 11, 0.25)'}`,
            borderRadius: '12px', padding: '12px 18px', marginBottom: '20px',
          }}>
            {info?.stored
              ? <CheckCircle2 size={16} color="var(--success)" />
              : <AlertCircle size={16} color="var(--warning)" />}
            <p style={{ fontSize: '13px', fontWeight: 600, color: info?.stored ? 'var(--success)' : 'var(--warning)', margin: 0 }}>
              {info?.stored
                ? `${info.total_records.toLocaleString()} customer records currently synchronized in tenant database`
                : 'No dataset currently loaded — upload a CSV file below to begin'}
            </p>
          </div>
        )}

        {/* ── Premium Upload Area ── */}
        <div
          className={`upload-dropzone ${dragging ? 'dragging' : ''}`}
          onClick={() => inputRef.current.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          style={{ marginBottom: '20px' }}
        >
          <div style={{
            width: '54px', height: '54px',
            background: 'var(--brand-subtle)',
            borderRadius: '14px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px',
          }}>
            <UploadCloud size={26} color="var(--brand)" />
          </div>

          <p style={{ fontWeight: 800, fontSize: '16px', color: 'var(--text-primary)', marginBottom: '4px' }}>
            {dragging ? 'Drop customer CSV here' : 'Drag & drop customer CSV dataset'}
          </p>

          <p style={{ fontSize: '13px', color: 'var(--slate-500)', marginBottom: '6px' }}>
            or click to browse files from your computer
          </p>

          <p style={{ fontSize: '11px', color: 'var(--slate-500)', marginBottom: '18px' }}>
            Accepts Telco formatted <strong>.csv</strong> files. Existing customer IDs are automatically deduplicated.
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

          <span className="btn-secondary" style={{ pointerEvents: 'none', display: 'inline-flex', fontSize: '12px', padding: '8px 18px' }}>
            Browse Files
          </span>
        </div>

        {/* Selected file card */}
        {file && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--surface-muted)', border: '1px solid var(--border)',
            borderRadius: '12px', padding: '12px 18px', marginBottom: '16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'var(--brand-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileText size={18} color="var(--brand)" />
              </div>
              <div>
                <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{file.name}</p>
                <p style={{ fontSize: '11px', color: 'var(--slate-500)', margin: '2px 0 0 0' }}>
                  {(file.size / 1024).toFixed(1)} KB · Ready to ingest
                </p>
              </div>
            </div>
            {!uploading && (
              <button
                onClick={() => setFile(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--slate-400)', padding: '6px', borderRadius: '6px' }}
                title="Remove file"
              >
                <X size={16} />
              </button>
            )}
          </div>
        )}

        {/* ── Upload Progress Indicator ── */}
        {uploading && (
          <div className="dashboard-card" style={{ padding: '20px 24px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '16px', height: '16px', border: '2px solid var(--slate-300)', borderTopColor: 'var(--brand)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {UPLOAD_STAGES[uploadStage]?.label || 'Processing upload…'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--brand)' }}>
                  {Math.round(((uploadStage + 1) / UPLOAD_STAGES.length) * 100)}%
                </span>
                <button
                  onClick={handleCancelUpload}
                  type="button"
                  style={{
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
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

            {/* Subtle animated progress bar */}
            <div style={{ width: '100%', height: '6px', background: 'var(--border)', borderRadius: '99px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${Math.round(((uploadStage + 1) / UPLOAD_STAGES.length) * 100)}%`,
                background: 'var(--brand)',
                borderRadius: '99px',
                transition: 'width 300ms ease'
              }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', fontSize: '11px', color: 'var(--slate-500)' }}>
              <span>Stage {uploadStage + 1} of {UPLOAD_STAGES.length}</span>
              <span>Fast bulk ingestion pipeline</span>
            </div>
          </div>
        )}

        {/* ── Success Card (Green Theme) ── */}
        {uploadResult && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: '14px',
            padding: '18px 20px', marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <CheckCircle2 size={18} color="var(--success)" />
              <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--success)', margin: 0 }}>
                {uploadResult.new_records === 0
                  ? `Upload processed: All ${uploadResult.total_rows?.toLocaleString()} records verified (0 duplicate records created)`
                  : 'Dataset uploaded & ingested successfully'}
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
              {[
                { label: 'Total Rows in File', value: uploadResult.total_rows?.toLocaleString() ?? '—', icon: Database, color: 'var(--text-primary)' },
                { label: 'New Records Added', value: (uploadResult.new_records ?? uploadResult.inserted)?.toLocaleString() ?? '—', icon: TrendingUp, color: 'var(--success)' },
                { label: 'Duplicates Skipped', value: (uploadResult.duplicates_skipped ?? uploadResult.duplicate_rows)?.toLocaleString() ?? '0', icon: Copy, color: 'var(--warning)' },
                { label: 'Total in Database', value: (uploadResult.total_in_db ?? uploadResult.final_customer_count)?.toLocaleString() ?? '—', icon: Users, color: 'var(--brand)' },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} style={{ background: 'var(--surface)', borderRadius: '10px', padding: '12px 14px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                    <Icon size={13} color={color} />
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600, margin: 0 }}>{label}</p>
                  </div>
                  <p style={{ fontSize: '18px', fontWeight: 800, color, margin: 0 }}>{value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Error Card (Red Theme) ── */}
        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', color: 'var(--danger)', fontSize: '13px', padding: '14px 18px', borderRadius: '12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={16} color="var(--danger)" style={{ flexShrink: 0 }} />
            <span>{error}</span>
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
                <span className="btn-spinner" />
                Ingesting Customer Dataset…
              </div>
            ) : (
              'Upload & Ingest Dataset'
            )}
          </button>
        )}

        {/* ── Dataset Preview Table (Slate Styling) ── */}
        <div className="dashboard-card" style={{ padding: '24px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Dataset Schema Preview</h3>
              <p style={{ fontSize: '12px', color: 'var(--slate-500)', marginTop: '2px' }}>
                {preview ? 'Sample customer record parsed from the active dataset' : 'No dataset currently loaded in tenant storage'}
              </p>
            </div>
            {preview && (
              <span className="badge badge-purple" style={{ fontSize: '10px' }}>
                {preview.columns.length} Schema Attributes
              </span>
            )}
          </div>

          {!preview ? (
            <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--slate-500)', fontSize: '13px' }}>
              <Database size={32} style={{ marginBottom: '8px', opacity: 0.3 }} />
              <p style={{ margin: 0 }}>Upload a CSV to view schema attribute mapping</p>
            </div>
          ) : (
            <div className="analytics-table-wrap">
              <div style={{ overflowX: 'auto' }}>
                <table className="analytics-table">
                  <thead>
                    <tr>
                      {preview.columns.map(col => (
                        <th key={col}>{col.toUpperCase()}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      {preview.columns.map(col => (
                        <td key={col} style={{ whiteSpace: 'nowrap' }}>
                          {String(preview.sample[col] ?? '—')}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* ── Upload History Audit Trail ── */}
        <div className="dashboard-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <Clock size={16} color="var(--slate-500)" />
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Upload History</h3>
          </div>

          {history.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--slate-500)', fontSize: '13px' }}>
              No previous dataset uploads found
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: '560px' }}>
                {history.map((h, i) => (
                  <div
                    key={h._id || i}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.2fr 100px 90px 90px 90px 120px',
                      alignItems: 'center',
                      padding: '12px 6px',
                      borderBottom: i < history.length - 1 ? '1px solid var(--border)' : 'none',
                      gap: '14px',
                      fontSize: '12px',
                    }}
                  >
                    <div>
                      <p style={{ fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{h.filename}</p>
                      <p style={{ fontSize: '11px', color: 'var(--slate-500)', marginTop: '2px', margin: 0 }}>by {h.uploaded_by}</p>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{h.total_rows?.toLocaleString()}</p>
                      <p style={{ fontSize: '10px', color: 'var(--slate-500)', margin: '2px 0 0 0' }}>total rows</p>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontWeight: 700, color: 'var(--success)', margin: 0 }}>{(h.new_records ?? h.inserted_rows ?? 0)?.toLocaleString()}</p>
                      <p style={{ fontSize: '10px', color: 'var(--slate-500)', margin: '2px 0 0 0' }}>inserted</p>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontWeight: 700, color: 'var(--warning)', margin: 0 }}>{(h.duplicates_skipped ?? h.duplicate_rows ?? 0)?.toLocaleString()}</p>
                      <p style={{ fontSize: '10px', color: 'var(--slate-500)', margin: '2px 0 0 0' }}>duplicates</p>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <p style={{ fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{(h.total_in_db ?? h.final_total)?.toLocaleString() ?? '—'}</p>
                      <p style={{ fontSize: '10px', color: 'var(--slate-500)', margin: '2px 0 0 0' }}>total in DB</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className={h.status === 'success' ? 'badge badge-green' : 'badge badge-yellow'} style={{ fontSize: '10px' }}>
                        ● {h.status}
                      </span>
                      <p style={{ fontSize: '10px', color: 'var(--slate-400)', marginTop: '3px', margin: '3px 0 0 0' }}>{timeAgo(h.uploaded_at)}</p>
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