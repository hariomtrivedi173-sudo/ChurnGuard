import { useState, useEffect, useCallback, useMemo } from 'react'
import Sidebar from '../components/Sidebar'
import Header from '../components/Header'
import { apiRequest } from '../api/client'
import { predictChurn, predictSelectedCustomers } from '../api/predict'
import { getTelcoCustomers } from '../api/customers'
import { getUploadHistory } from '../api/dataset'
import { formatCurrency, getActiveCurrency } from '../utils/formatters'
import RecommendedActions from '../components/RecommendedActions'
import toast from 'react-hot-toast'
import {
  Sparkles,
  Zap,
  AlertCircle,
  RefreshCw,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Lightbulb,
  Search,
  Filter,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight,
  Database,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  X,
  FileSpreadsheet,
} from 'lucide-react'

// Default values for ML features when records from OTT streaming, banking, or custom datasets lack specific telecommunication columns
const FEATURE_DEFAULTS = {
  gender: 'Male',
  SeniorCitizen: 'No',
  Partner: 'No',
  Dependents: 'No',
  tenure: 1,
  PhoneService: 'Yes',
  MultipleLines: 'No',
  InternetService: 'Fiber optic',
  OnlineSecurity: 'No',
  OnlineBackup: 'No',
  DeviceProtection: 'No',
  TechSupport: 'No',
  StreamingTV: 'No',
  StreamingMovies: 'No',
  Contract: 'Month-to-month',
  PaperlessBilling: 'Yes',
  PaymentMethod: 'Electronic check',
  MonthlyCharges: 50.0,
  TotalCharges: 50.0,
}

function buildPayload(record) {
  if (!record) return { payload: {}, missing: ['customer'] }

  const payload = {}

  // Populate from record or intelligent default
  for (const [key, defaultVal] of Object.entries(FEATURE_DEFAULTS)) {
    const val = record[key]
    if (val !== undefined && val !== null && val !== '') {
      payload[key] = val
    } else {
      payload[key] = defaultVal
    }
  }

  // Normalize SeniorCitizen ('0' / 0 -> 'No', '1' / 1 -> 'Yes')
  if (payload.SeniorCitizen === 1 || payload.SeniorCitizen === '1' || payload.SeniorCitizen === true) {
    payload.SeniorCitizen = 'Yes'
  } else if (payload.SeniorCitizen === 0 || payload.SeniorCitizen === '0' || payload.SeniorCitizen === false) {
    payload.SeniorCitizen = 'No'
  }

  // Normalize gender (1 / '1' -> 'Male', 0 / '0' -> 'Female')
  if (payload.gender === 1 || payload.gender === '1') {
    payload.gender = 'Male'
  } else if (payload.gender === 0 || payload.gender === '0') {
    payload.gender = 'Female'
  }

  // Coerce numeric fields cleanly
  payload.tenure = Math.max(0, parseInt(payload.tenure, 10) || 0)
  payload.MonthlyCharges = Math.max(0, parseFloat(payload.MonthlyCharges) || 0.0)
  payload.TotalCharges = Math.max(0, parseFloat(payload.TotalCharges) || (payload.MonthlyCharges * Math.max(1, payload.tenure)))

  // Preserve customerID for downstream identification
  if (record.customerID) {
    payload.customerID = record.customerID
  }

  return { payload, missing: [] }
}

function riskColor(level) {
  if (level === 'High') return 'var(--danger)'
  if (level === 'Medium') return 'var(--warning)'
  return 'var(--success)'
}

function riskBadgeClass(level) {
  if (level === 'High') return 'badge badge-red'
  if (level === 'Medium') return 'badge badge-yellow'
  return 'badge badge-green'
}

export default function Predict() {
  // ── Pagination & Filter State ──
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [riskFilter, setRiskFilter] = useState('all')
  const [uploadFilter, setUploadFilter] = useState('all')
  const [datasets, setDatasets] = useState([])
  const [gotoPage, setGotoPage] = useState('')

  // ── Records & Selected Items ──
  const [records, setRecords] = useState([])
  const [inspectedCust, setInspectedCust] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [selectAllAll, setSelectAllAll] = useState(false)
  const [deselectedIds, setDeselectedIds] = useState(new Set())

  // ── Results & Inference State ──
  const [activeMode, setActiveMode] = useState('single') // 'single' | 'batch'
  const [singleResult, setSingleResult] = useState(null)
  const [batchResult, setBatchResult] = useState(null)
  const [activeBatchCust, setActiveBatchCust] = useState(null)
  const [activeBatchShap, setActiveBatchShap] = useState(null)
  const [shapLoading, setShapLoading] = useState(false)
  const [shapCache, setShapCache] = useState({})

  // ── Loaders & Errors ──
  const [loadingCusts, setLoadingCusts] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [singleLoading, setSingleLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [predError, setPredError] = useState('')
  const [, setCurrencyTick] = useState(getActiveCurrency)

  useEffect(() => {
    function handleRegionalChange() {
      setCurrencyTick(getActiveCurrency())
    }
    window.addEventListener('regionalSettingsChanged', handleRegionalChange)
    return () => window.removeEventListener('regionalSettingsChanged', handleRegionalChange)
  }, [])

  // ── Load Upload Datasets History ──
  useEffect(() => {
    let mounted = true
    async function loadUploads() {
      try {
        const hist = await getUploadHistory(20)
        if (mounted && Array.isArray(hist)) {
          setDatasets(hist)
        }
      } catch {
        // non-fatal
      }
    }
    loadUploads()
    return () => { mounted = false }
  }, [])

  // ── Fetch Customers from Server ──
  const fetchCustomers = useCallback(async (page, limit, query, risk, upload) => {
    setLoadingCusts(true)
    setLoadError('')
    try {
      const data = await getTelcoCustomers(page, limit, query, risk, upload)
      const list = data?.records || data?.data || []
      setRecords(list)
      setTotal(data?.total ?? list.length)
      setTotalPages(data?.total_pages ?? Math.max(1, Math.ceil((data?.total ?? list.length) / limit)))

      // Keep inspected customer if still in page, otherwise select first record
      if (list.length > 0) {
        setInspectedCust(prev => {
          if (!prev) return list[0]
          const found = list.find(r => r.customerID === prev.customerID)
          return found || list[0]
        })
      } else {
        setInspectedCust(null)
      }
    } catch (err) {
      setLoadError(`Failed to load customer directory: ${err.message}`)
      toast.error(`Failed to load customers: ${err.message}`)
    } finally {
      setLoadingCusts(false)
    }
  }, [])

  // ── Load when page, pageSize, search, riskFilter, uploadFilter change ──
  useEffect(() => {
    fetchCustomers(currentPage, pageSize, search, riskFilter, uploadFilter)
  }, [fetchCustomers, currentPage, pageSize, search, riskFilter, uploadFilter])

  // ── Search Handler ──
  function handleSearchSubmit(e) {
    if (e) e.preventDefault()
    setSearch(searchInput.trim())
    setCurrentPage(1)
  }

  function handleClearSearch() {
    setSearchInput('')
    setSearch('')
    setCurrentPage(1)
  }

  function handleClearAllFilters() {
    setSearchInput('')
    setSearch('')
    setRiskFilter('all')
    setUploadFilter('all')
    setCurrentPage(1)
  }

  // ── Rows Per Page Handler ──
  function handlePageSizeChange(e) {
    const newSize = Number(e.target.value)
    setPageSize(newSize)
    setCurrentPage(1)
  }

  // ── Go to Page Handler ──
  function handleGotoPageSubmit(e) {
    e.preventDefault()
    const p = parseInt(gotoPage, 10)
    if (isNaN(p) || p < 1 || p > totalPages) {
      toast.error(`Please enter a page number between 1 and ${totalPages}`)
      return
    }
    setCurrentPage(p)
    setGotoPage('')
  }

  // ── Selection Logic ──
  // Check if a customer is selected
  const isSelected = useCallback((cid) => {
    if (!cid) return false
    if (selectAllAll) {
      return !deselectedIds.has(cid)
    }
    return selectedIds.has(cid)
  }, [selectAllAll, deselectedIds, selectedIds])

  // Count of currently selected customers
  const effectiveSelectedCount = useMemo(() => {
    if (selectAllAll) {
      return Math.max(0, total - deselectedIds.size)
    }
    return selectedIds.size
  }, [selectAllAll, total, deselectedIds.size, selectedIds.size])

  // Check if all visible records on current page are selected
  const isPageAllSelected = useMemo(() => {
    if (records.length === 0) return false
    return records.every(r => isSelected(r.customerID))
  }, [records, isSelected])

  // Toggle individual customer checkbox
  function toggleCustomerSelection(cid) {
    if (selectAllAll) {
      setDeselectedIds(prev => {
        const next = new Set(prev)
        if (next.has(cid)) {
          next.delete(cid)
        } else {
          next.add(cid)
        }
        return next
      })
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev)
        if (next.has(cid)) {
          next.delete(cid)
        } else {
          next.add(cid)
        }
        return next
      })
    }
  }

  // "Select All on Current Page" toggle
  function handleSelectCurrentPageToggle() {
    if (isPageAllSelected) {
      // Unselect all on current page
      if (selectAllAll) {
        setDeselectedIds(prev => {
          const next = new Set(prev)
          records.forEach(r => next.add(r.customerID))
          return next
        })
      } else {
        setSelectedIds(prev => {
          const next = new Set(prev)
          records.forEach(r => next.delete(r.customerID))
          return next
        })
      }
    } else {
      // Select all on current page
      if (selectAllAll) {
        setDeselectedIds(prev => {
          const next = new Set(prev)
          records.forEach(r => next.delete(r.customerID))
          return next
        })
      } else {
        setSelectedIds(prev => {
          const next = new Set(prev)
          records.forEach(r => next.add(r.customerID))
          return next
        })
      }
    }
  }

  // "Select All Matching Customers" across all pages
  function handleSelectAllMatching() {
    setSelectAllAll(true)
    setDeselectedIds(new Set())
    setSelectedIds(new Set())
    toast.success(`Selected all ${total.toLocaleString()} matching customer accounts`)
  }

  // Clear entire selection
  function handleClearSelection() {
    setSelectAllAll(false)
    setDeselectedIds(new Set())
    setSelectedIds(new Set())
  }

  // ── Single Prediction Inference ──
  async function handleRunSinglePrediction(e) {
    if (e) e.preventDefault()
    if (!inspectedCust) return

    setSingleLoading(true)
    setPredError('')

    const { payload, missing } = buildPayload(inspectedCust)
    if (missing.length > 0) {
      const msg = `Missing required fields: ${missing.join(', ')}`
      setPredError(msg)
      toast.error(msg)
      setSingleLoading(false)
      return
    }

    try {
      const data = await predictChurn(payload)
      setSingleResult(data)
      setActiveMode('single')
      toast.success(`Inference Complete: ${data.risk_level} Risk (${data.churn_probability}%)`)
    } catch (err) {
      setPredError(`Prediction failed: ${err.message}`)
      toast.error(`Prediction failed: ${err.message}`)
    } finally {
      setSingleLoading(false)
    }
  }

  // ── Batch Selected Customers Prediction ──
  async function handleAnalyzeSelectedCustomers() {
    if (effectiveSelectedCount === 0) {
      toast.error('Please select at least one customer to analyze')
      return
    }

    setAnalyzing(true)
    setPredError('')

    const payload = selectAllAll
      ? {
        select_all_matching: true,
        deselected_ids: Array.from(deselectedIds),
        search,
        risk_level: riskFilter,
        upload_id: uploadFilter,
      }
      : {
        customer_ids: Array.from(selectedIds),
      }

    try {
      const data = await predictSelectedCustomers(payload)
      setBatchResult(data)
      setActiveMode('batch')

      // Set first analyzed customer as active batch detail
      if (data.results && data.results.length > 0) {
        const primary = data.results.find(r => r.customerID === data.primary_customer_id) || data.results[0]
        setActiveBatchCust(primary)

        if (data.primary_explanation) {
          const combined = {
            ...primary,
            top_factors: data.primary_explanation.top_factors,
            recommended_actions: data.primary_recommendation?.recommended_actions,
            priority: data.primary_recommendation?.priority,
          }
          setActiveBatchShap(combined)
          setShapCache(prev => ({ ...prev, [primary.customerID]: combined }))
        }
      }

      toast.success(`Analysis Complete: ${data.total_analyzed.toLocaleString()} customers evaluated!`)
    } catch (err) {
      setPredError(`Batch analysis failed: ${err.message}`)
      toast.error(`Batch analysis failed: ${err.message}`)
    } finally {
      setAnalyzing(false)
    }
  }

  // ── Load SHAP on Demand for a Specific Batch Customer ──
  async function handleSelectBatchCustomerForDetail(cust) {
    setActiveBatchCust(cust)
    if (shapCache[cust.customerID]) {
      setActiveBatchShap(shapCache[cust.customerID])
      return
    }

    // Lookup full customer record from current page records or fetch
    const fullRec = records.find(r => r.customerID === cust.customerID)
    if (fullRec) {
      const { payload, missing } = buildPayload(fullRec)
      if (missing.length === 0) {
        setShapLoading(true)
        try {
          const detail = await predictChurn(payload)
          const merged = { ...cust, ...detail }
          setActiveBatchShap(merged)
          setShapCache(prev => ({ ...prev, [cust.customerID]: merged }))
        } catch {
          // fallback without SHAP
        } finally {
          setShapLoading(false)
        }
      }
    }
  }

  // ── Smart Page Numbers for Pagination Bar ──
  function getPageNumbers() {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }
    const pages = [1]
    if (currentPage > 4) {
      pages.push('...')
    }
    const start = Math.max(2, Math.min(currentPage - 1, totalPages - 4))
    const end = Math.min(totalPages - 1, Math.max(currentPage + 1, 5))
    for (let p = start; p <= end; p++) {
      pages.push(p)
    }
    if (currentPage < totalPages - 3) {
      pages.push('...')
    }
    pages.push(totalPages)
    return pages
  }

  const showingFrom = total === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const showingTo = Math.min(currentPage * pageSize, total)

  // Customer detail fields to display for inspected account
  const detailFields = inspectedCust
    ? [
      { label: 'Tenure (Mo)', value: `${inspectedCust.tenure ?? 0} mos` },
      { label: 'Contract', value: inspectedCust.Contract ?? '—' },
      { label: 'Internet Service', value: inspectedCust.InternetService ?? '—' },
      { label: 'Monthly Charges', value: inspectedCust.MonthlyCharges != null ? formatCurrency(parseFloat(inspectedCust.MonthlyCharges)) : '—' },
      { label: 'Total Charges', value: inspectedCust.TotalCharges != null ? formatCurrency(parseFloat(inspectedCust.TotalCharges)) : '—' },
      { label: 'Payment Method', value: inspectedCust.PaymentMethod ?? '—' },
    ]
    : []

  const hasActiveFilters = search || riskFilter !== 'all' || uploadFilter !== 'all'

  return (
    <div className="page-layout">
      <Sidebar />
      <div className="page-content" style={{ padding: '24px 32px' }}>

        <Header
          title="Predict Churn"
          subtitle="Run real-time inference on customer telemetry with explainable factor attributions."
          onRefresh={() => fetchCustomers(currentPage, pageSize, search, riskFilter, uploadFilter)}
          isRefreshing={loadingCusts}
        />

        {/* Load error banner */}
        {loadError && !loadingCusts && (
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
            <span>{loadError}</span>
            <button
              onClick={() => fetchCustomers(currentPage, pageSize, search, riskFilter, uploadFilter)}
              style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontWeight: 600, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <RefreshCw size={13} /> Retry
            </button>
          </div>
        )}

        <div className="predict-main-grid">

          {/* ══════════════════════════════════════════════════════
              LEFT CARD: Advanced Customer Selection & Telemetry
             ══════════════════════════════════════════════════════ */}
          <div className="dashboard-card" style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Header & Record Counts */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Customer Directory & Selection
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--slate-500)', marginTop: '2px', margin: '2px 0 0 0' }}>
                  Filter, select accounts across pages, and batch-evaluate churn risk.
                </p>
              </div>

              {/* Rows Per Page Dropdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>Rows:</span>
                <select
                  value={pageSize}
                  onChange={handlePageSizeChange}
                  className="input-base"
                  style={{ padding: '4px 8px', fontSize: '12px', fontWeight: 700, borderRadius: '8px', cursor: 'pointer' }}
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                  <option value={500}>500</option>
                </select>
              </div>
            </div>

            {/* ── Search and Filters Bar ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>

                {/* Search Bar */}
                <form onSubmit={handleSearchSubmit} style={{ flex: '1 1 200px', display: 'flex', position: 'relative' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)', pointerEvents: 'none' }} />
                  <input
                    type="text"
                    placeholder="Search by Customer ID, contract..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="input-base"
                    style={{ paddingLeft: '32px', paddingRight: searchInput ? '28px' : '10px', fontSize: '12px', height: '36px', width: '100%' }}
                  />
                  {searchInput && (
                    <button
                      type="button"
                      onClick={handleClearSearch}
                      style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--slate-400)', cursor: 'pointer', padding: 0 }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </form>

                {/* Risk Filter */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <select
                    value={riskFilter}
                    onChange={(e) => { setRiskFilter(e.target.value); setCurrentPage(1) }}
                    className="input-base"
                    style={{ fontSize: '12px', height: '36px', padding: '0 8px', borderRadius: '8px', fontWeight: 600 }}
                  >
                    <option value="all">All Churn Risks</option>
                    <option value="high">High Risk Only</option>
                    <option value="medium">Medium Risk Only</option>
                    <option value="low">Low Risk Only</option>
                  </select>
                </div>

                {/* Dataset Filter */}
                {datasets.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <select
                      value={uploadFilter}
                      onChange={(e) => { setUploadFilter(e.target.value); setCurrentPage(1) }}
                      className="input-base"
                      style={{ fontSize: '12px', height: '36px', padding: '0 8px', borderRadius: '8px', fontWeight: 600, maxWidth: '170px' }}
                    >
                      <option value="all">All Uploaded Files</option>
                      {datasets.map(d => (
                        <option key={d.upload_id || d._id} value={d.upload_id || d._id}>
                          {d.filename || `Dataset (${d.total_rows || d.new_records} rows)`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Clear Filters Button */}
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={handleClearAllFilters}
                    style={{
                      background: 'var(--surface-muted)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-secondary)',
                      padding: '0 10px',
                      height: '36px',
                      borderRadius: '8px',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <X size={12} /> Clear Filters
                  </button>
                )}
              </div>
            </div>

            {/* ── Selection Action Toolbar ── */}
            <div style={{
              background: 'var(--surface-muted)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {/* Select All on Current Page */}
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={isPageAllSelected}
                    onChange={handleSelectCurrentPageToggle}
                    style={{ cursor: 'pointer', width: '15px', height: '15px', accentColor: 'var(--brand)' }}
                  />
                  <span>Select Page ({records.length})</span>
                </label>

                {/* Selection Counter Badge */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="badge badge-purple" style={{ fontSize: '11px', padding: '3px 8px' }}>
                    {effectiveSelectedCount.toLocaleString()} Selected
                  </span>
                  {effectiveSelectedCount > 0 && (
                    <button
                      type="button"
                      onClick={handleClearSelection}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Action Button: Analyze Selected Customers */}
              <button
                type="button"
                disabled={analyzing || effectiveSelectedCount === 0}
                onClick={handleAnalyzeSelectedCustomers}
                className="btn-primary"
                style={{
                  fontSize: '12px',
                  padding: '7px 14px',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  opacity: effectiveSelectedCount === 0 ? 0.5 : 1,
                  cursor: effectiveSelectedCount === 0 ? 'not-allowed' : 'pointer'
                }}
              >
                {analyzing ? (
                  <><span className="btn-spinner" /> Evaluating {effectiveSelectedCount.toLocaleString()} Accounts…</>
                ) : (
                  <><Zap size={14} /> Analyze Selected ({effectiveSelectedCount.toLocaleString()})</>
                )}
              </button>
            </div>

            {/* Select All Matching Banner */}
            {total > records.length && (
              <div style={{
                background: selectAllAll ? 'rgba(124, 58, 237, 0.12)' : 'var(--surface-muted)',
                border: selectAllAll ? '1px solid var(--brand)' : '1px dashed var(--border)',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {selectAllAll ? (
                    <strong style={{ color: 'var(--brand)' }}>
                      All {total.toLocaleString()} matching customer records across all {totalPages.toLocaleString()} pages are selected.
                    </strong>
                  ) : (
                    <>Want to evaluate the entire dataset? You have selected {effectiveSelectedCount} accounts.</>
                  )}
                </span>
                {selectAllAll ? (
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    style={{ background: 'none', border: 'none', color: 'var(--brand)', cursor: 'pointer', fontWeight: 700, fontSize: '12px', textDecoration: 'underline' }}
                  >
                    Clear All
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSelectAllMatching}
                    style={{ background: 'none', border: 'none', color: 'var(--brand)', cursor: 'pointer', fontWeight: 700, fontSize: '12px', textDecoration: 'underline' }}
                  >
                    Select All {total.toLocaleString()} Matching Customers
                  </button>
                )}
              </div>
            )}

            {/* ── Customer List Table / Rows ── */}
            <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', background: 'var(--surface)' }}>

              {loadingCusts ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '40px 0', justifyContent: 'center', color: 'var(--slate-500)', fontSize: '13px' }}>
                  <div style={{ width: '16px', height: '16px', border: '2px solid var(--slate-300)', borderTopColor: 'var(--brand)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  Loading customer telemetry…
                </div>
              ) : records.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--slate-500)' }}>
                  <Users size={32} style={{ margin: '0 auto 10px', opacity: 0.3, display: 'block' }} />
                  <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 4px 0' }}>
                    {hasActiveFilters ? 'No customers match the active filters' : 'No customer records available'}
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--slate-500)', margin: 0 }}>
                    {hasActiveFilters ? 'Try adjusting your search query, risk filter, or uploaded dataset.' : 'Upload a CSV dataset to get started.'}
                  </p>
                </div>
              ) : (
                <div className="responsive-table-scroll" style={{ maxHeight: '380px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        <th style={{ padding: '10px 12px', width: '36px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={isPageAllSelected}
                            onChange={handleSelectCurrentPageToggle}
                            style={{ cursor: 'pointer', accentColor: 'var(--brand)' }}
                          />
                        </th>
                        <th style={{ padding: '10px 12px' }}>Customer ID</th>
                        <th style={{ padding: '10px 12px' }}>Contract</th>
                        <th style={{ padding: '10px 12px' }}>Tenure</th>
                        <th style={{ padding: '10px 12px' }}>Monthly</th>
                        <th style={{ padding: '10px 12px' }}>Risk</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right' }}>Inspect</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((c) => {
                        const selected = isSelected(c.customerID)
                        const isInspected = inspectedCust?.customerID === c.customerID
                        const risk = c.risk_level || (Number(c.churn_probability) >= 60 ? 'High' : Number(c.churn_probability) >= 35 ? 'Medium' : 'Low')

                        return (
                          <tr
                            key={c.customerID || c._id}
                            style={{
                              borderBottom: '1px solid var(--border)',
                              background: isInspected ? 'rgba(124, 58, 237, 0.08)' : selected ? 'var(--surface-muted)' : 'transparent',
                              transition: 'background 120ms'
                            }}
                          >
                            <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => toggleCustomerSelection(c.customerID)}
                                style={{ cursor: 'pointer', accentColor: 'var(--brand)' }}
                              />
                            </td>

                            <td style={{ padding: '8px 12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                              <button
                                type="button"
                                onClick={() => setInspectedCust(c)}
                                style={{ background: 'none', border: 'none', padding: 0, fontWeight: 700, color: isInspected ? 'var(--brand)' : 'var(--text-primary)', cursor: 'pointer', textAlign: 'left', fontSize: '12px' }}
                              >
                                {c.customerID}
                              </button>
                            </td>

                            <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>
                              {c.Contract || '—'}
                            </td>

                            <td style={{ padding: '8px 12px', color: 'var(--text-secondary)' }}>
                              {c.tenure != null ? `${c.tenure} mos` : '—'}
                            </td>

                            <td style={{ padding: '8px 12px', color: 'var(--text-primary)', fontWeight: 600 }}>
                              {c.MonthlyCharges != null ? formatCurrency(parseFloat(c.MonthlyCharges)) : '—'}
                            </td>

                            <td style={{ padding: '8px 12px' }}>
                              <span className={riskBadgeClass(risk)} style={{ fontSize: '10px', padding: '2px 7px' }}>
                                ● {risk}
                              </span>
                            </td>

                            <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                              <button
                                type="button"
                                onClick={() => setInspectedCust(c)}
                                style={{
                                  background: isInspected ? 'var(--brand)' : 'var(--surface-muted)',
                                  border: '1px solid var(--border)',
                                  color: isInspected ? '#fff' : 'var(--text-secondary)',
                                  padding: '3px 8px',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  cursor: 'pointer'
                                }}
                              >
                                {isInspected ? 'Loaded' : 'Inspect'}
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── Pagination Controls Bar (matches screenshot) ── */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 16px',
                borderTop: '1px solid var(--border)',
                background: 'var(--surface)',
                flexWrap: 'wrap',
                gap: '10px'
              }}>
                {/* Count summary */}
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                  Showing <strong style={{ color: 'var(--text-primary)' }}>{showingFrom.toLocaleString('en-IN')}–{showingTo.toLocaleString('en-IN')}</strong> of{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>{total.toLocaleString('en-IN')}</strong> records
                </p>

                {/* Page Navigation Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                  <button
                    id="prev-page-btn"
                    aria-label="Previous page"
                    disabled={currentPage === 1 || loadingCusts}
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      color: currentPage === 1 ? 'var(--text-muted)' : 'var(--text-secondary)',
                      cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                      padding: '5px 11px',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '12px',
                      fontWeight: 600,
                      opacity: currentPage === 1 ? 0.5 : 1,
                      transition: 'all 150ms'
                    }}
                  >
                    <ChevronLeft size={14} />
                    <span>Previous</span>
                  </button>

                  {getPageNumbers().map((p, idx) => (
                    p === '...' ? (
                      <span key={`dots-${idx}`} style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '0 4px' }}>…</span>
                    ) : (
                      <button
                        key={p}
                        id={`page-btn-${p}`}
                        onClick={() => setCurrentPage(p)}
                        style={{
                          minWidth: '32px',
                          height: '32px',
                          padding: '0 6px',
                          borderRadius: '8px',
                          border: currentPage === p ? '1px solid var(--brand)' : '1px solid var(--border)',
                          background: currentPage === p ? 'var(--brand)' : 'var(--surface)',
                          color: currentPage === p ? '#ffffff' : 'var(--text-secondary)',
                          fontWeight: 700,
                          fontSize: '12px',
                          cursor: 'pointer',
                          boxShadow: currentPage === p ? '0 2px 6px var(--brand-glow)' : 'none',
                          transition: 'all 150ms'
                        }}
                      >
                        {p}
                      </button>
                    )
                  ))}

                  <button
                    id="next-page-btn"
                    aria-label="Next page"
                    disabled={currentPage >= totalPages || loadingCusts}
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      color: currentPage >= totalPages ? 'var(--text-muted)' : 'var(--text-secondary)',
                      cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                      padding: '5px 11px',
                      borderRadius: '8px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '12px',
                      fontWeight: 600,
                      opacity: currentPage >= totalPages ? 0.5 : 1,
                      transition: 'all 150ms'
                    }}
                  >
                    <span>Next</span>
                    <ChevronRight size={14} />
                  </button>
                </div>

                {/* Go To Page Input */}
                <form onSubmit={handleGotoPageSubmit} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Go to:</span>
                  <input
                    type="number"
                    min={1}
                    max={totalPages}
                    placeholder={`${currentPage}`}
                    value={gotoPage}
                    onChange={(e) => setGotoPage(e.target.value)}
                    style={{
                      width: '54px',
                      padding: '4px 6px',
                      fontSize: '11px',
                      fontWeight: 700,
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                      color: 'var(--text-primary)',
                      textAlign: 'center'
                    }}
                  />
                  <button
                    type="submit"
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      fontWeight: 700,
                      borderRadius: '6px',
                      border: '1px solid var(--border)',
                      background: 'var(--surface-muted)',
                      color: 'var(--text-primary)',
                      cursor: 'pointer'
                    }}
                  >
                    Go
                  </button>
                </form>

              </div>
            </div>

            {/* ── Inspected Customer Telemetry Grid & Single Prediction ── */}
            {inspectedCust && (
              <div style={{
                background: 'var(--surface-muted)',
                borderRadius: '12px',
                padding: '16px',
                border: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Inspected Account:
                    </span>
                    <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{inspectedCust.customerID}</strong>
                  </div>
                  <span className={riskBadgeClass(inspectedCust.risk_level || 'Low')} style={{ fontSize: '10px' }}>
                    ● {inspectedCust.risk_level || 'Low'} Risk
                  </span>
                </div>

                <div className="predict-details-grid">
                  {detailFields.map(({ label, value }) => (
                    <div key={label} style={{ background: 'var(--surface)', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                      <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', margin: 0 }}>{label}</p>
                      <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', margin: '2px 0 0 0', wordBreak: 'break-word' }}>{String(value)}</p>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  disabled={singleLoading}
                  onClick={handleRunSinglePrediction}
                  className="btn-primary"
                  style={{ width: '100%', padding: '9px', fontSize: '12px', justifyContent: 'center' }}
                >
                  {singleLoading ? (
                    <><span className="btn-spinner" /> Evaluating Risk Models…</>
                  ) : (
                    <><Zap size={14} /> Run Single Prediction on {inspectedCust.customerID}</>
                  )}
                </button>
              </div>
            )}

          </div>

          {/* ══════════════════════════════════════════════════════
              RIGHT CARD: Inference Results, SHAP & Batch Summary
             ══════════════════════════════════════════════════════ */}
          <div className="dashboard-card" style={{ padding: '22px', minHeight: '440px', display: 'flex', flexDirection: 'column' }}>

            {/* Header with Switcher if batch is loaded */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  {activeMode === 'batch' && batchResult ? 'Batch Analysis Summary' : 'Prediction Result'}
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', margin: '2px 0 0 0' }}>
                  {activeMode === 'batch' && batchResult
                    ? `Calibrated insights for ${batchResult.total_analyzed.toLocaleString()} customer accounts`
                    : 'Explainable AI risk scoring & mitigation playbooks'}
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {batchResult && singleResult && (
                  <div style={{ display: 'flex', background: 'var(--surface-muted)', borderRadius: '8px', padding: '2px', border: '1px solid var(--border)' }}>
                    <button
                      type="button"
                      onClick={() => setActiveMode('single')}
                      style={{
                        padding: '3px 8px',
                        fontSize: '11px',
                        fontWeight: 700,
                        borderRadius: '6px',
                        border: 'none',
                        background: activeMode === 'single' ? 'var(--brand)' : 'transparent',
                        color: activeMode === 'single' ? '#fff' : 'var(--text-secondary)',
                        cursor: 'pointer'
                      }}
                    >
                      Single
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveMode('batch')}
                      style={{
                        padding: '3px 8px',
                        fontSize: '11px',
                        fontWeight: 700,
                        borderRadius: '6px',
                        border: 'none',
                        background: activeMode === 'batch' ? 'var(--brand)' : 'transparent',
                        color: activeMode === 'batch' ? '#fff' : 'var(--text-secondary)',
                        cursor: 'pointer'
                      }}
                    >
                      Batch ({batchResult.total_analyzed})
                    </button>
                  </div>
                )}
                <span className="badge badge-purple" style={{ fontSize: '10px' }}>ChurnGuard ML</span>
              </div>
            </div>

            {/* ── Idle State (No inference yet) ── */}
            {!singleResult && !batchResult && !analyzing && !singleLoading && !predError && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px 20px' }}>
                <div style={{ width: '52px', height: '52px', background: 'var(--brand-subtle)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
                  <Sparkles size={24} color="var(--brand)" />
                </div>
                <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Awaiting Inference</h4>
                <p style={{ fontSize: '12px', color: 'var(--slate-500)', maxWidth: '300px', lineHeight: 1.5, margin: 0 }}>
                  Select customer accounts from the directory and click <strong>Analyze Selected Customers</strong>, or click <strong>Run Single Prediction</strong> to compute calibrated churn probabilities and explainable feature attributions.
                </p>
              </div>
            )}

            {/* ── Global Loading State ── */}
            {(analyzing || singleLoading) && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '40px' }}>
                <div style={{ width: '28px', height: '28px', border: '3px solid var(--slate-300)', borderTopColor: 'var(--brand)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <p style={{ fontSize: '13px', color: 'var(--slate-600)', fontWeight: 600, margin: 0 }}>
                  {analyzing ? `Evaluating Vectorized ML Pipeline on Selected Customers…` : `Running Supervised Inference…`}
                </p>
              </div>
            )}

            {/* ── Error State ── */}
            {predError && !analyzing && !singleLoading && (
              <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', color: 'var(--danger)', fontSize: '12px', padding: '12px 14px', borderRadius: '10px', marginBottom: '16px', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{predError}</span>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════
                MODE A: BATCH ANALYSIS SUMMARY VIEW
               ══════════════════════════════════════════════════════ */}
            {activeMode === 'batch' && batchResult && !analyzing && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                {/* 4 Metric Summary Cards */}
                <div className="predict-batch-metrics-grid">
                  <div style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 12px', textAlign: 'center' }}>
                    <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', margin: 0 }}>Total Analyzed</p>
                    <p style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', margin: '4px 0 0 0' }}>{batchResult.total_analyzed.toLocaleString()}</p>
                  </div>

                  <div style={{ background: 'rgba(239, 68, 68, 0.06)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '10px', padding: '10px 12px', textAlign: 'center' }}>
                    <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--danger)', textTransform: 'uppercase', margin: 0 }}>High Risk</p>
                    <p style={{ fontSize: '20px', fontWeight: 800, color: 'var(--danger)', margin: '4px 0 0 0' }}>
                      {batchResult.high_risk_count.toLocaleString()}
                      <span style={{ fontSize: '10px', fontWeight: 600, opacity: 0.8, marginLeft: '3px' }}>
                        ({batchResult.total_analyzed ? Math.round(batchResult.high_risk_count / batchResult.total_analyzed * 100) : 0}%)
                      </span>
                    </p>
                  </div>

                  <div style={{ background: 'rgba(245, 158, 11, 0.06)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '10px', padding: '10px 12px', textAlign: 'center' }}>
                    <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--warning)', textTransform: 'uppercase', margin: 0 }}>Medium Risk</p>
                    <p style={{ fontSize: '20px', fontWeight: 800, color: 'var(--warning)', margin: '4px 0 0 0' }}>
                      {batchResult.medium_risk_count.toLocaleString()}
                      <span style={{ fontSize: '10px', fontWeight: 600, opacity: 0.8, marginLeft: '3px' }}>
                        ({batchResult.total_analyzed ? Math.round(batchResult.medium_risk_count / batchResult.total_analyzed * 100) : 0}%)
                      </span>
                    </p>
                  </div>

                  <div style={{ background: 'rgba(34, 197, 94, 0.06)', border: '1px solid rgba(34, 197, 94, 0.2)', borderRadius: '10px', padding: '10px 12px', textAlign: 'center' }}>
                    <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--success)', textTransform: 'uppercase', margin: 0 }}>Low Risk</p>
                    <p style={{ fontSize: '20px', fontWeight: 800, color: 'var(--success)', margin: '4px 0 0 0' }}>
                      {batchResult.low_risk_count.toLocaleString()}
                      <span style={{ fontSize: '10px', fontWeight: 600, opacity: 0.8, marginLeft: '3px' }}>
                        ({batchResult.total_analyzed ? Math.round(batchResult.low_risk_count / batchResult.total_analyzed * 100) : 0}%)
                      </span>
                    </p>
                  </div>
                </div>

                {/* Stacked Risk Distribution Bar */}
                {batchResult.total_analyzed > 0 && (
                  <div style={{ display: 'flex', height: '8px', borderRadius: '99px', overflow: 'hidden', background: 'var(--border)' }}>
                    <div style={{ width: `${(batchResult.high_risk_count / batchResult.total_analyzed) * 100}%`, background: 'var(--danger)', transition: 'width 400ms' }} />
                    <div style={{ width: `${(batchResult.medium_risk_count / batchResult.total_analyzed) * 100}%`, background: 'var(--warning)', transition: 'width 400ms' }} />
                    <div style={{ width: `${(batchResult.low_risk_count / batchResult.total_analyzed) * 100}%`, background: 'var(--success)', transition: 'width 400ms' }} />
                  </div>
                )}

                {/* Batch Evaluated Accounts List */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      Evaluated Accounts (Click to inspect XAI factors)
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                      Showing {Math.min(batchResult.results.length, 100)} of {batchResult.results.length}
                    </span>
                  </div>

                  <div className="responsive-table-scroll" style={{ maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: 'var(--surface-muted)', borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '6px 10px' }}>Customer ID</th>
                          <th style={{ padding: '6px 10px' }}>Risk</th>
                          <th style={{ padding: '6px 10px' }}>Probability</th>
                          <th style={{ padding: '6px 10px' }}>Contract</th>
                          <th style={{ padding: '6px 10px', textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {batchResult.results.slice(0, 100).map((r) => {
                          const isActive = activeBatchCust?.customerID === r.customerID
                          return (
                            <tr
                              key={r.customerID}
                              onClick={() => handleSelectBatchCustomerForDetail(r)}
                              style={{
                                borderBottom: '1px solid var(--border)',
                                background: isActive ? 'rgba(124, 58, 237, 0.08)' : 'transparent',
                                cursor: 'pointer'
                              }}
                            >
                              <td style={{ padding: '6px 10px', fontWeight: 700, color: isActive ? 'var(--brand)' : 'var(--text-primary)' }}>
                                {r.customerID}
                              </td>
                              <td style={{ padding: '6px 10px' }}>
                                <span className={riskBadgeClass(r.risk_level)} style={{ fontSize: '9px', padding: '1px 6px' }}>
                                  ● {r.risk_level}
                                </span>
                              </td>
                              <td style={{ padding: '6px 10px', fontWeight: 700, color: riskColor(r.risk_level) }}>
                                {r.churn_probability}%
                              </td>
                              <td style={{ padding: '6px 10px', color: 'var(--text-secondary)' }}>
                                {r.Contract || '—'}
                              </td>
                              <td style={{ padding: '6px 10px', textAlign: 'right' }}>
                                <span style={{ fontSize: '10px', color: isActive ? 'var(--brand)' : 'var(--text-muted)', fontWeight: 600 }}>
                                  {isActive ? 'Active' : 'View'}
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* ── Active Selected Batch Customer Detail (SHAP & Mitigation) ── */}
                {activeBatchCust && (
                  <div style={{
                    background: 'var(--surface-muted)',
                    border: '1px solid var(--border)',
                    borderLeft: `4px solid ${riskColor(activeBatchCust.risk_level)}`,
                    borderRadius: '12px',
                    padding: '16px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
                      <div>
                        <span className={riskBadgeClass(activeBatchCust.risk_level)} style={{ fontSize: '11px', marginBottom: '6px' }}>
                          ● {activeBatchCust.risk_level} Risk — {activeBatchCust.customerID}
                        </span>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                          Calibrated Churn Probability
                        </p>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '34px', fontWeight: 800, color: riskColor(activeBatchCust.risk_level), lineHeight: 1 }}>
                          {activeBatchCust.churn_probability}%
                        </span>
                      </div>
                    </div>

                    {/* Probability Bar */}
                    <div style={{ height: '6px', background: 'var(--border)', borderRadius: '99px', overflow: 'hidden', marginTop: '6px' }}>
                      <div style={{ height: '100%', width: `${activeBatchCust.churn_probability}%`, background: riskColor(activeBatchCust.risk_level), borderRadius: '99px', transition: 'width 600ms ease' }} />
                    </div>

                    {/* SHAP Attributions */}
                    {shapLoading ? (
                      <div style={{ padding: '16px 0', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
                        Computing SHAP feature attributions…
                      </div>
                    ) : activeBatchShap?.top_factors && activeBatchShap.top_factors.length > 0 ? (
                      <div style={{ marginTop: '14px' }}>
                        <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 8px 0', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          Explainable Factor Attributions (SHAP)
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {activeBatchShap.top_factors.map((f, i) => {
                            const isRisk = f.direction === 'increases churn risk'
                            return (
                              <div
                                key={i}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  fontSize: '11px',
                                  background: 'var(--surface)',
                                  border: '1px solid var(--border)',
                                  padding: '6px 10px',
                                  borderRadius: '6px'
                                }}
                              >
                                <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{f.feature}</span>
                                <span style={{
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  color: isRisk ? 'var(--danger)' : 'var(--success)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '2px'
                                }}>
                                  {isRisk ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}
                                  {isRisk ? '+' : '−'}{(f.impact * 100).toFixed(0)}%
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ) : null}

                    {/* Mitigation Actions */}
                    {activeBatchShap?.recommended_actions && activeBatchShap.recommended_actions.length > 0 && (
                      <div style={{ marginTop: '14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '8px' }}>
                          <Lightbulb size={13} color="var(--brand)" />
                          <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            Mitigation Playbook
                          </p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {activeBatchShap.recommended_actions.map((a, i) => (
                            <div
                              key={i}
                              style={{
                                fontSize: '11px',
                                background: 'var(--surface)',
                                padding: '8px 10px',
                                borderRadius: '6px',
                                borderLeft: '3px solid var(--brand)',
                                border: '1px solid var(--border)'
                              }}
                            >
                              <p style={{ fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{a.action}</p>
                              {a.reason && <p style={{ color: 'var(--text-muted)', marginTop: '2px', fontSize: '10px', margin: '2px 0 0 0' }}>{a.reason}</p>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

              </div>
            )}

            {/* ══════════════════════════════════════════════════════
                MODE B: SINGLE CUSTOMER PREDICTION VIEW
               ══════════════════════════════════════════════════════ */}
            {activeMode === 'single' && singleResult && !singleLoading && (
              <div className="predict-result-reveal" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                {/* Risk score & Large Probability */}
                <div style={{
                  background: 'var(--surface-muted)',
                  border: `1px solid var(--border)`,
                  borderLeft: `4px solid ${riskColor(singleResult.risk_level)}`,
                  borderRadius: '12px',
                  padding: '16px 18px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
                    <div>
                      <span className={riskBadgeClass(singleResult.risk_level)} style={{ fontSize: '11px', marginBottom: '6px' }}>
                        ● {singleResult.risk_level} Risk Level
                      </span>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                        Calibrated Churn Probability
                      </p>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '38px', fontWeight: 800, color: riskColor(singleResult.risk_level), lineHeight: 1 }}>
                        {singleResult.churn_probability}%
                      </span>
                    </div>
                  </div>

                  {/* Probability Bar */}
                  <div style={{ height: '6px', background: 'var(--border)', borderRadius: '99px', overflow: 'hidden', marginTop: '10px' }}>
                    <div style={{ height: '100%', width: `${singleResult.churn_probability}%`, background: riskColor(singleResult.risk_level), borderRadius: '99px', transition: 'width 600ms ease' }} />
                  </div>

                  {singleResult.priority && (
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '8px', fontWeight: 600, margin: '8px 0 0 0' }}>
                      Outreach Priority: {singleResult.priority}
                    </p>
                  )}
                </div>

                {/* AI Explanation: Top Contributing Factors */}
                {singleResult.top_factors && singleResult.top_factors.length > 0 && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                      <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                        Explainable Factors (Feature Attributions)
                      </p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {singleResult.top_factors.map((f, i) => {
                        const isRisk = f.direction === 'increases churn risk'
                        return (
                          <div
                            key={i}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              fontSize: '12px',
                              background: 'var(--surface)',
                              border: '1px solid var(--border)',
                              padding: '8px 12px',
                              borderRadius: '8px'
                            }}
                          >
                            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{f.feature}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                color: isRisk ? 'var(--danger)' : 'var(--success)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '2px'
                              }}>
                                {isRisk ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                                {isRisk ? '+' : '−'}{(f.impact * 100).toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Recommended Actions */}
                {(singleResult.retention_suggestions || singleResult.recommended_actions) && (
                  <RecommendedActions
                    suggestions={
                      singleResult.retention_suggestions ||
                      singleResult.recommended_actions.map(a => ({
                        title: a.action,
                        reason: a.reason,
                        priority: singleResult.risk_level === 'High' ? 'High' : singleResult.risk_level === 'Medium' ? 'Medium' : 'Low',
                        channel: 'Offer'
                      }))
                    }
                  />
                )}

              </div>
            )}

          </div>

        </div>

      </div>
    </div>
  )
}
