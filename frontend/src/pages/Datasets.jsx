import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Sidebar from '../components/Sidebar'
import Header from '../components/Header'
import toast from 'react-hot-toast'
import {
  getDatasetManagementOverview,
  getDatasetUploadRecords,
  deleteDatasetUpload,
  clearAllDatasetData,
} from '../api/dataset'
import { formatCurrency, getActiveCurrency } from '../utils/formatters'
import {
  Database,
  Users,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Trash2,
  Eye,
  RefreshCw,
  Search,
  UploadCloud,
  FileSpreadsheet,
  Clock,
  X,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  ShieldAlert,
  ArrowUpDown,
  Filter,
} from 'lucide-react'

function formatDate(isoStr) {
  if (!isoStr) return '—'
  try {
    const d = new Date(isoStr)
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return String(isoStr)
  }
}

function timeAgo(isoStr) {
  if (!isoStr) return ''
  try {
    const diff = (Date.now() - new Date(isoStr).getTime()) / 1000
    if (diff < 60) return 'Just now'
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
    return `${Math.floor(diff / 86400)}d ago`
  } catch {
    return ''
  }
}

function riskBadgeClass(level) {
  if (level === 'High') return 'badge badge-red'
  if (level === 'Medium') return 'badge badge-yellow'
  return 'badge badge-green'
}

export default function Datasets() {
  const navigate = useNavigate()

  // ── Overview state ──
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [overview, setOverview] = useState({
    total_datasets: 0,
    total_customers: 0,
    legacy_records: 0,
    tracked_records: 0,
    datasets: [],
  })

  // ── Filter and Search State ──
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortField, setSortField] = useState('date') // 'date' | 'records' | 'name'
  const [sortOrder, setSortOrder] = useState('desc') // 'desc' | 'asc'

  // ── Single Dataset Deletion Modal State ──
  const [datasetToDelete, setDatasetToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  // ── Clear All Data Modal State (Danger Zone) ──
  const [showClearAllModal, setShowClearAllModal] = useState(false)
  const [clearConfirmText, setClearConfirmText] = useState('')
  const [clearingAll, setClearingAll] = useState(false)

  // ── View Records Modal State ──
  const [viewingDataset, setViewingDataset] = useState(null)
  const [viewRecords, setViewRecords] = useState([])
  const [viewTotal, setViewTotal] = useState(0)
  const [viewTotalPages, setViewTotalPages] = useState(1)
  const [viewPage, setViewPage] = useState(1)
  const [viewLimit, setViewLimit] = useState(25)
  const [viewSearch, setViewSearch] = useState('')
  const [viewLoading, setViewLoading] = useState(false)

  // ── Copy Tooltip helper ──
  const [copiedId, setCopiedId] = useState(null)
  const [, setCurrencyTick] = useState(getActiveCurrency)

  useEffect(() => {
    function handleRegionalChange() {
      setCurrencyTick(getActiveCurrency())
    }
    window.addEventListener('regionalSettingsChanged', handleRegionalChange)
    return () => window.removeEventListener('regionalSettingsChanged', handleRegionalChange)
  }, [])

  // ── Fetch Overview Data ──
  const loadOverview = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await getDatasetManagementOverview()
      setOverview(data || {
        total_datasets: 0,
        total_customers: 0,
        legacy_records: 0,
        tracked_records: 0,
        datasets: [],
      })
    } catch (err) {
      setError(`Failed to load dataset information: ${err.message}`)
      toast.error(`Error loading datasets: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadOverview()
  }, [loadOverview])

  // ── Filter & Sort Datasets ──
  const filteredDatasets = useMemo(() => {
    let list = [...(overview.datasets || [])]

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(
        d =>
          (d.filename && d.filename.toLowerCase().includes(q)) ||
          (d.upload_id && d.upload_id.toLowerCase().includes(q)) ||
          (d.uploaded_by && d.uploaded_by.toLowerCase().includes(q))
      )
    }

    if (statusFilter !== 'all') {
      if (statusFilter === 'legacy') {
        list = list.filter(d => d.is_legacy)
      } else if (statusFilter === 'active') {
        list = list.filter(d => d.active_records > 0)
      }
    }

    list.sort((a, b) => {
      if (sortField === 'date') {
        const da = new Date(a.uploaded_at || 0).getTime()
        const db = new Date(b.uploaded_at || 0).getTime()
        return sortOrder === 'desc' ? db - da : da - db
      }
      if (sortField === 'records') {
        const ra = a.active_records || a.total_rows || 0
        const rb = b.active_records || b.total_rows || 0
        return sortOrder === 'desc' ? rb - ra : ra - rb
      }
      if (sortField === 'name') {
        const na = (a.filename || '').toLowerCase()
        const nb = (b.filename || '').toLowerCase()
        return sortOrder === 'desc' ? nb.localeCompare(na) : na.localeCompare(nb)
      }
      return 0
    })

    return list
  }, [overview.datasets, search, statusFilter, sortField, sortOrder])

  // ── Copy Upload ID Helper ──
  function handleCopyId(id) {
    if (!id) return
    navigator.clipboard.writeText(id)
    setCopiedId(id)
    toast.success('Upload ID copied to clipboard')
    setTimeout(() => setCopiedId(null), 2000)
  }

  // ── Single Dataset Deletion ──
  async function handleConfirmDeleteDataset() {
    if (!datasetToDelete) return
    setDeleting(true)
    try {
      const res = await deleteDatasetUpload(datasetToDelete.upload_id, datasetToDelete.is_legacy)
      toast.success(res.message || `Dataset '${datasetToDelete.filename}' deleted successfully`)
      setDatasetToDelete(null)
      await loadOverview()
    } catch (err) {
      toast.error(`Deletion failed: ${err.message}`)
    } finally {
      setDeleting(false)
    }
  }

  // ── Clear All Data (Danger Zone) ──
  async function handleConfirmClearAll() {
    if (clearConfirmText.trim() !== 'DELETE ALL') {
      toast.error('Please type "DELETE ALL" to confirm permanent deletion.')
      return
    }

    setClearingAll(true)
    try {
      const res = await clearAllDatasetData('DELETE ALL')
      toast.success(res.message || 'All customer data and datasets cleared successfully.')
      setShowClearAllModal(false)
      setClearConfirmText('')
      await loadOverview()
    } catch (err) {
      toast.error(`Clear failed: ${err.message}`)
    } finally {
      setClearingAll(false)
    }
  }

  // ── View Records Modal Logic ──
  const fetchViewRecords = useCallback(async (ds, page, limit, query) => {
    if (!ds) return
    setViewLoading(true)
    try {
      const res = await getDatasetUploadRecords(ds.upload_id, page, limit, query)
      setViewRecords(res.records || [])
      setViewTotal(res.total || 0)
      setViewTotalPages(res.total_pages || 1)
      setViewPage(res.page || 1)
    } catch (err) {
      toast.error(`Failed to load records: ${err.message}`)
    } finally {
      setViewLoading(false)
    }
  }, [])

  function handleOpenViewModal(ds) {
    setViewingDataset(ds)
    setViewPage(1)
    setViewSearch('')
    fetchViewRecords(ds, 1, viewLimit, '')
  }

  function handleViewSearchSubmit(e) {
    e.preventDefault()
    setViewPage(1)
    fetchViewRecords(viewingDataset, 1, viewLimit, viewSearch)
  }

  function handleViewPageChange(newPage) {
    setViewPage(newPage)
    fetchViewRecords(viewingDataset, newPage, viewLimit, viewSearch)
  }

  return (
    <div className="page-layout">
      <Sidebar />
      <div className="page-content" style={{ padding: '24px 32px' }}>

        {/* ── Page Header ── */}
        <Header
          title="Dataset Management"
          subtitle="Inspect, manage, and safely delete uploaded customer datasets and bulk telemetry files."
          onRefresh={loadOverview}
          isRefreshing={loading}
          extraActions={
            <Link
              to="/upload"
              className="btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                padding: '8px 14px',
                borderRadius: '8px',
                textDecoration: 'none'
              }}
            >
              <UploadCloud size={14} /> Upload New Dataset
            </Link>
          }
        />

        {/* ── Error Banner ── */}
        {error && !loading && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            color: 'var(--danger)',
            fontSize: '13px',
            padding: '12px 16px',
            borderRadius: '10px',
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>{error}</span>
            <button
              onClick={loadOverview}
              style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontWeight: 600, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <RefreshCw size={13} /> Retry
            </button>
          </div>
        )}

        {/* ── KPI Metric Cards Row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>

          {/* Card 1: Total Datasets */}
          <div className="dashboard-card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: 'var(--brand-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Database size={22} color="var(--brand)" />
            </div>
            <div>
              <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
                Uploaded Datasets
              </p>
              <p style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', margin: '3px 0 0 0', lineHeight: 1.1 }}>
                {overview.total_datasets.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Card 2: Total Customers */}
          <div className="dashboard-card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: 'rgba(124, 58, 237, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Users size={22} color="var(--brand)" />
            </div>
            <div>
              <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
                Total Active Customers
              </p>
              <p style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', margin: '3px 0 0 0', lineHeight: 1.1 }}>
                {overview.total_customers.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Card 3: Tracked in Uploads */}
          <div className="dashboard-card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: 'rgba(34, 197, 94, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <CheckCircle2 size={22} color="var(--success)" />
            </div>
            <div>
              <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
                Tracked In Datasets
              </p>
              <p style={{ fontSize: '24px', fontWeight: 800, color: 'var(--success)', margin: '3px 0 0 0', lineHeight: 1.1 }}>
                {overview.tracked_records.toLocaleString()}
              </p>
            </div>
          </div>

          {/* Card 4: Legacy Unassigned Records */}
          <div className="dashboard-card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '46px', height: '46px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <AlertCircle size={22} color="var(--warning)" />
            </div>
            <div>
              <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
                Legacy Records
              </p>
              <p style={{ fontSize: '24px', fontWeight: 800, color: 'var(--warning)', margin: '3px 0 0 0', lineHeight: 1.1 }}>
                {overview.legacy_records.toLocaleString()}
              </p>
            </div>
          </div>

        </div>

        {/* ── Legacy Records Notice (if applicable) ── */}
        {overview.legacy_records > 0 && (
          <div style={{
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.25)',
            borderRadius: '10px',
            padding: '12px 18px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertCircle size={18} color="var(--warning)" style={{ flexShrink: 0 }} />
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                <strong style={{ color: 'var(--text-primary)' }}>{overview.legacy_records.toLocaleString()} legacy customer records</strong> imported prior to unique dataset tracking are currently active in your directory. They are fully functional across Predictions, Analytics, and Dashboard.
              </p>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
              To delete legacy records, use Clear All Data in the Danger Zone below.
            </span>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════
            MAIN CARD: DATASET DIRECTORY TABLE
           ══════════════════════════════════════════════════════ */}
        <div className="dashboard-card" style={{ padding: '24px', marginBottom: '28px' }}>

          {/* Search, Filter & Sort Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 260px', maxWidth: '420px' }}>
              <div style={{ position: 'relative', width: '100%' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search by dataset filename or upload ID…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="input-base"
                  style={{ paddingLeft: '32px', paddingRight: search ? '28px' : '10px', fontSize: '12px', height: '36px', width: '100%' }}
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input-base"
                style={{ fontSize: '12px', height: '36px', padding: '0 10px', borderRadius: '8px', fontWeight: 600 }}
              >
                <option value="all">All Datasets ({overview.datasets.length})</option>
                <option value="active">Active Tracked Only</option>
                <option value="legacy">Legacy Untracked Only</option>
              </select>

              {/* Sort Dropdown */}
              <select
                value={`${sortField}_${sortOrder}`}
                onChange={(e) => {
                  const [f, o] = e.target.value.split('_')
                  setSortField(f)
                  setSortOrder(o)
                }}
                className="input-base"
                style={{ fontSize: '12px', height: '36px', padding: '0 10px', borderRadius: '8px', fontWeight: 600 }}
              >
                <option value="date_desc">Newest First</option>
                <option value="date_asc">Oldest First</option>
                <option value="records_desc">Highest Records</option>
                <option value="records_asc">Lowest Records</option>
                <option value="name_asc">Filename (A–Z)</option>
                <option value="name_desc">Filename (Z–A)</option>
              </select>
            </div>
          </div>

          {/* ── Datasets Table ── */}
          <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', background: 'var(--surface)' }}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '48px 0', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                <div style={{ width: '18px', height: '18px', border: '2px solid var(--slate-300)', borderTopColor: 'var(--brand)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                Loading dataset catalog…
              </div>
            ) : filteredDatasets.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
                <FileSpreadsheet size={36} style={{ margin: '0 auto 12px', opacity: 0.3, display: 'block' }} />
                <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
                  {search || statusFilter !== 'all' ? 'No datasets match active search criteria' : 'No uploaded datasets found'}
                </p>
                <p style={{ fontSize: '12px', color: 'var(--slate-500)', margin: '0 0 16px 0' }}>
                  {search || statusFilter !== 'all' ? 'Try adjusting your search query or status filter.' : 'Upload your first CSV dataset to start training and predictions.'}
                </p>
                {!search && statusFilter === 'all' && (
                  <Link to="/upload" className="btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '7px 14px', textDecoration: 'none' }}>
                    <UploadCloud size={14} /> Upload Dataset
                  </Link>
                )}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      <th style={{ padding: '12px 14px' }}>Dataset Name & ID</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right' }}>Active Records</th>
                      <th style={{ padding: '12px 14px' }}>Upload Date</th>
                      <th style={{ padding: '12px 14px' }}>Status</th>
                      <th style={{ padding: '12px 14px' }}>Uploaded By</th>
                      <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDatasets.map((ds) => {
                      const isLegacy = ds.is_legacy
                      const activeRecs = ds.active_records || 0

                      return (
                        <tr
                          key={ds.upload_id || ds._id}
                          style={{
                            borderBottom: '1px solid var(--border)',
                            transition: 'background 120ms',
                          }}
                        >
                          {/* Dataset Name & ID */}
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--brand-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                <FileSpreadsheet size={16} color="var(--brand)" />
                              </div>
                              <div>
                                <strong style={{ color: 'var(--text-primary)', fontSize: '13px', display: 'block' }}>
                                  {ds.filename}
                                </strong>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '3px' }}>
                                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                                    ID: {ds.upload_id ? `${ds.upload_id.slice(0, 10)}…` : '—'}
                                  </span>
                                  {ds.upload_id && (
                                    <button
                                      type="button"
                                      onClick={() => handleCopyId(ds.upload_id)}
                                      title="Copy full upload ID"
                                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, display: 'inline-flex' }}
                                    >
                                      {copiedId === ds.upload_id ? <Check size={11} color="var(--success)" /> : <Copy size={11} />}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Records */}
                          <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                            <strong style={{ fontSize: '13px', color: activeRecs > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                              {activeRecs.toLocaleString()}
                            </strong>
                            {ds.total_rows > 0 && ds.total_rows !== activeRecs && (
                              <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-muted)' }}>
                                of {ds.total_rows.toLocaleString()} file rows
                              </span>
                            )}
                          </td>

                          {/* Upload Date */}
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{ color: 'var(--text-secondary)', display: 'block' }}>
                              {formatDate(ds.uploaded_at)}
                            </span>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                              {timeAgo(ds.uploaded_at)}
                            </span>
                          </td>

                          {/* Status */}
                          <td style={{ padding: '12px 14px' }}>
                            {activeRecs > 0 ? (
                              <span className="badge badge-green" style={{ fontSize: '10px' }}>
                                ● Completed
                              </span>
                            ) : isLegacy ? (
                              <span className="badge badge-yellow" style={{ fontSize: '10px' }} title="Imported before tracking enabled">
                                ● Legacy Untracked
                              </span>
                            ) : (
                              <span className="badge badge-champagne" style={{ fontSize: '10px' }}>
                                ● {ds.status || 'Processed'}
                              </span>
                            )}
                          </td>

                          {/* Uploaded By */}
                          <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>
                            {ds.uploaded_by || '—'}
                          </td>

                          {/* Actions */}
                          <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              {/* View Action */}
                              {activeRecs > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenViewModal(ds)}
                                  className="btn-secondary"
                                  title="View associated records"
                                  style={{
                                    padding: '5px 9px',
                                    borderRadius: '6px',
                                    fontSize: '11px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontWeight: 600
                                  }}
                                >
                                  <Eye size={12} /> View
                                </button>
                              )}

                              {/* Delete Action */}
                              <button
                                type="button"
                                onClick={() => setDatasetToDelete(ds)}
                                title="Delete this dataset and its records"
                                style={{
                                  background: 'rgba(239, 68, 68, 0.08)',
                                  border: '1px solid rgba(239, 68, 68, 0.25)',
                                  color: 'var(--danger)',
                                  padding: '5px 9px',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <Trash2 size={12} /> Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

        {/* ══════════════════════════════════════════════════════
            DANGER ZONE: CLEAR ALL UPLOADED DATA
           ══════════════════════════════════════════════════════ */}
        <div style={{
          background: 'rgba(239, 68, 68, 0.04)',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          borderRadius: '12px',
          padding: '22px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <ShieldAlert size={18} color="var(--danger)" />
              <h4 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--danger)', margin: 0 }}>
                Danger Zone: Clear All Customer Data
              </h4>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '0 0 6px 0', maxWidth: '650px', lineHeight: 1.5 }}>
              Permanently delete all customer records ({overview.total_customers.toLocaleString()} records) and dataset history belonging to your company. User accounts, login credentials, settings, and ML models will remain safe and untouched.
            </p>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>
              Strict tenant isolation: Only records belonging to your company account will be deleted.
            </span>
          </div>

          <button
            type="button"
            disabled={overview.total_customers === 0 && overview.total_datasets === 0}
            onClick={() => {
              setClearConfirmText('')
              setShowClearAllModal(true)
            }}
            style={{
              background: 'var(--danger)',
              border: 'none',
              color: '#ffffff',
              padding: '10px 18px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: 700,
              cursor: overview.total_customers === 0 ? 'not-allowed' : 'pointer',
              opacity: overview.total_customers === 0 ? 0.5 : 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 2px 8px rgba(239, 68, 68, 0.3)'
            }}
          >
            <Trash2 size={14} /> Clear All My Uploaded Data
          </button>
        </div>

      </div>

      {/* ══════════════════════════════════════════════════════
          MODAL 1: VIEW DATASET RECORDS (Server-side Paginated)
         ══════════════════════════════════════════════════════ */}
      {viewingDataset && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '850px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
          }}>
            {/* Modal Header */}
            <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileSpreadsheet size={18} color="var(--brand)" />
                  <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    {viewingDataset.filename}
                  </h3>
                </div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '4px 0 0 0', fontFamily: 'monospace' }}>
                  Upload ID: {viewingDataset.upload_id}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setViewingDataset(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Search Bar */}
            <div style={{ padding: '12px 24px', background: 'var(--surface-muted)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
              <form onSubmit={handleViewSearchSubmit} style={{ display: 'flex', flex: 1, position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search customer ID or contract within this dataset…"
                  value={viewSearch}
                  onChange={(e) => setViewSearch(e.target.value)}
                  className="input-base"
                  style={{ width: '100%', paddingLeft: '32px', fontSize: '12px', height: '34px' }}
                />
              </form>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {viewTotal.toLocaleString()} records linked
              </span>
            </div>

            {/* Modal Records Table */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px' }}>
              {viewLoading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  Loading customer records…
                </div>
              ) : viewRecords.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  No customer records found matching this upload.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>
                      <th style={{ padding: '10px 8px' }}>Customer ID</th>
                      <th style={{ padding: '10px 8px' }}>Contract</th>
                      <th style={{ padding: '10px 8px' }}>Tenure</th>
                      <th style={{ padding: '10px 8px' }}>Monthly</th>
                      <th style={{ padding: '10px 8px' }}>Calibrated Risk</th>
                      <th style={{ padding: '10px 8px', textAlign: 'right' }}>Probability</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewRecords.map((r) => (
                      <tr key={r.customerID || r._id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px', fontWeight: 700, color: 'var(--text-primary)' }}>{r.customerID}</td>
                        <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>{r.Contract || '—'}</td>
                        <td style={{ padding: '8px', color: 'var(--text-secondary)' }}>{r.tenure != null ? `${r.tenure} mos` : '—'}</td>
                        <td style={{ padding: '8px', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {r.MonthlyCharges != null ? formatCurrency(parseFloat(r.MonthlyCharges)) : '—'}
                        </td>
                        <td style={{ padding: '8px' }}>
                          <span className={riskBadgeClass(r.risk_level || 'Low')} style={{ fontSize: '10px', padding: '2px 6px' }}>
                            ● {r.risk_level || 'Low'}
                          </span>
                        </td>
                        <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, color: r.churn_probability >= 60 ? 'var(--danger)' : r.churn_probability >= 35 ? 'var(--warning)' : 'var(--success)' }}>
                          {r.churn_probability != null ? `${r.churn_probability}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Modal Pagination Footer */}
            <div style={{ padding: '12px 24px', borderTop: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Page {viewPage} of {viewTotalPages} ({viewTotal.toLocaleString()} total)
              </span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  disabled={viewPage <= 1}
                  onClick={() => handleViewPageChange(viewPage - 1)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: viewPage <= 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                    cursor: viewPage <= 1 ? 'not-allowed' : 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={viewPage >= viewTotalPages}
                  onClick={() => handleViewPageChange(viewPage + 1)}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: viewPage >= viewTotalPages ? 'var(--text-muted)' : 'var(--text-primary)',
                    cursor: viewPage >= viewTotalPages ? 'not-allowed' : 'pointer',
                    fontSize: '12px'
                  }}
                >
                  Next
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          MODAL 2: DELETE INDIVIDUAL DATASET CONFIRMATION
         ══════════════════════════════════════════════════════ */}
      {datasetToDelete && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '520px',
            padding: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Trash2 size={22} color="var(--danger)" />
              </div>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Delete Dataset: {datasetToDelete.filename}
                </h3>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0 0', fontFamily: 'monospace' }}>
                  Upload ID: {datasetToDelete.upload_id}
                </p>
              </div>
            </div>

            <div style={{
              background: 'var(--surface-muted)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              padding: '12px 14px',
              fontSize: '12px',
              marginBottom: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>File Name:</span>
                <strong style={{ color: 'var(--text-primary)' }}>{datasetToDelete.filename}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Customer Records to be Deleted:</span>
                <strong style={{ color: 'var(--danger)' }}>
                  {(datasetToDelete.active_records || 0).toLocaleString()} records
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Uploaded on:</span>
                <span style={{ color: 'var(--text-secondary)' }}>{formatDate(datasetToDelete.uploaded_at)}</span>
              </div>
            </div>

            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '20px' }}>
              {datasetToDelete.active_records > 0 ? (
                <>This action will permanently delete all <strong>{(datasetToDelete.active_records || 0).toLocaleString()} customer records</strong> associated with this specific upload from your database. Dashboard metrics, customer directories, and analytics will be automatically updated.</>
              ) : datasetToDelete.is_legacy ? (
                <>This file was uploaded before unique tracking tags were enabled. Deleting this entry will safely remove the historical audit entry without affecting other datasets.</>
              ) : (
                <>This action will remove this dataset entry from your upload history.</>
              )}
              {' '}This action <strong>cannot be undone</strong>.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDatasetToDelete(null)}
                className="btn-secondary"
                style={{ padding: '8px 16px', fontSize: '12px', borderRadius: '8px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDeleteDataset}
                style={{
                  background: 'var(--danger)',
                  border: 'none',
                  color: '#ffffff',
                  padding: '8px 18px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {deleting ? (
                  <><span className="btn-spinner" /> Deleting Dataset…</>
                ) : (
                  <><Trash2 size={13} /> Delete Dataset & Records</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          MODAL 3: CLEAR ALL CUSTOMER DATA CONFIRMATION (DANGER)
         ══════════════════════════════════════════════════════ */}
      {showClearAllModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--surface)',
            border: '2px solid var(--danger)',
            borderRadius: '14px',
            width: '100%',
            maxWidth: '540px',
            padding: '26px',
            boxShadow: '0 25px 50px rgba(0,0,0,0.6)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <ShieldAlert size={26} color="var(--danger)" />
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--danger)', margin: 0 }}>
                  Permanently Clear All Customer Data?
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
                  This will wipe all {overview.total_customers.toLocaleString()} customer records for your company.
                </p>
              </div>
            </div>

            <div style={{
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '8px',
              padding: '12px 14px',
              fontSize: '12px',
              color: 'var(--text-primary)',
              lineHeight: 1.5,
              marginBottom: '16px'
            }}>
              <p style={{ margin: '0 0 6px 0', fontWeight: 700, color: 'var(--danger)' }}>
                Warning: Irreversible Operation
              </p>
              <ul style={{ margin: 0, paddingLeft: '18px' }}>
                <li>All <strong>{overview.total_customers.toLocaleString()} customer records</strong> will be deleted.</li>
                <li>All <strong>{overview.total_datasets} dataset upload entries</strong> will be cleared.</li>
                <li>Dashboard telemetry, predictions, and customer directory will reset to 0.</li>
                <li>Your user account, login credentials, settings, and ML models are <strong>100% safe</strong>.</li>
              </ul>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                To confirm, type <span style={{ color: 'var(--danger)', userSelect: 'all' }}>DELETE ALL</span> below:
              </label>
              <input
                type="text"
                placeholder="DELETE ALL"
                value={clearConfirmText}
                onChange={(e) => setClearConfirmText(e.target.value)}
                className="input-base"
                style={{ width: '100%', fontSize: '13px', height: '38px', fontWeight: 700, letterSpacing: '0.05em' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                disabled={clearingAll}
                onClick={() => {
                  setShowClearAllModal(false)
                  setClearConfirmText('')
                }}
                className="btn-secondary"
                style={{ padding: '8px 16px', fontSize: '12px', borderRadius: '8px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={clearingAll || clearConfirmText.trim() !== 'DELETE ALL'}
                onClick={handleConfirmClearAll}
                style={{
                  background: 'var(--danger)',
                  border: 'none',
                  color: '#ffffff',
                  padding: '8px 18px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: clearConfirmText.trim() !== 'DELETE ALL' || clearingAll ? 'not-allowed' : 'pointer',
                  opacity: clearConfirmText.trim() !== 'DELETE ALL' ? 0.4 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {clearingAll ? (
                  <><span className="btn-spinner" /> Clearing All Customer Data…</>
                ) : (
                  <><Trash2 size={13} /> Permanently Wipe All Records</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

