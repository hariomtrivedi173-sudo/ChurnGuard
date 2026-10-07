import { useEffect, useState, useCallback, useRef } from 'react'
import Sidebar from '../components/Sidebar'
import Header from '../components/Header'
import toast from 'react-hot-toast'
import { getTelcoCustomers, deleteTelcoCustomer, addTelcoCustomer, updateTelcoCustomer } from '../api/customers'
import {
  Search, ChevronLeft, ChevronRight, Trash2, Users, Database,
  UserPlus, Edit3, X
} from 'lucide-react'

const AVATAR_COLORS = ['#4F46E5', '#3B82F6', '#0EA5E9', '#10B981', '#F59E0B', '#64748B', '#6366F1', '#14B8A6']

// Format a telco record into a display row
function mapRecord(r, i = 0) {
  const id      = r.customerID || r._id || `CUS-${i}`
  const monthly = parseFloat(r.MonthlyCharges || 0)
  const total   = parseFloat(r.TotalCharges   || 0)
  const tenure  = parseInt(r.tenure || 0)

  // Risk categorization
  let riskLevel = 'Low'
  if (r.risk_level) {
    riskLevel = r.risk_level
  } else if (r.churn_probability !== undefined && r.churn_probability !== null) {
    const prob = parseFloat(r.churn_probability)
    if (prob >= 65) riskLevel = 'High'
    else if (prob >= 35) riskLevel = 'Medium'
    else riskLevel = 'Low'
  } else {
    // Heuristic categorization when no prediction available
    if (tenure < 12 && r.Contract === 'Month-to-month') {
      riskLevel = 'High'
    } else if (tenure < 24 && r.Contract === 'Month-to-month') {
      riskLevel = 'Medium'
    } else {
      riskLevel = 'Low'
    }
  }

  const initials = String(id).split('').filter(c => /[A-Z0-9]/i.test(c)).slice(0, 2).join('').toUpperCase() || 'CU'

  return {
    id,
    mongoId:          r._id,
    name:             id,
    initials,
    color:            AVATAR_COLORS[(typeof i === 'number' ? i : 0) % AVATAR_COLORS.length],
    gender:           r.gender           || 'Male',
    SeniorCitizen:    r.SeniorCitizen    || 'No',
    Partner:          r.Partner          || 'No',
    Dependents:       r.Dependents       || 'No',
    contract:         r.Contract         || 'Month-to-month',
    internet:         r.InternetService  || 'DSL',
    techSupport:      r.TechSupport      || 'No',
    onlineSecurity:   r.OnlineSecurity   || 'No',
    paymentMethod:    r.PaymentMethod    || 'Electronic check',
    paperlessBilling: r.PaperlessBilling || 'Yes',
    monthlyCharges:   monthly,
    totalCharges:     total,
    spend:            total > 0 ? `₹${Math.round(total).toLocaleString('en-IN')}` : (monthly > 0 ? `₹${Math.round(monthly).toLocaleString('en-IN')}/mo` : 'N/A'),
    tenure:           tenure > 0 ? `${tenure} mo` : '0 mo',
    tenureNum:        tenure,
    riskLevel,
    churn:            r.Churn ?? null,
  }
}

const PAGE_SIZE = 50

const INITIAL_FORM = {
  customerID: '',
  gender: 'Male',
  SeniorCitizen: 'No',
  Partner: 'No',
  Dependents: 'No',
  tenure: 12,
  PhoneService: 'Yes',
  MultipleLines: 'No',
  InternetService: 'Fiber optic',
  OnlineSecurity: 'Yes',
  OnlineBackup: 'No',
  DeviceProtection: 'No',
  TechSupport: 'Yes',
  StreamingTV: 'No',
  StreamingMovies: 'No',
  Contract: 'Month-to-month',
  PaperlessBilling: 'Yes',
  PaymentMethod: 'Electronic check',
  MonthlyCharges: 65.0,
  TotalCharges: 780.0,
  Churn: 'No',
}

export default function Customers() {
  const [records,        setRecords]        = useState([])
  const [total,          setTotal]          = useState(0)
  const [totalPages,     setTotalPages]     = useState(1)
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState('')
  const [currentPage,    setCurrentPage]    = useState(1)
  const [search,         setSearch]         = useState('')
  const [searchInput,    setSearchInput]    = useState('')
  const [riskFilter,     setRiskFilter]     = useState('all')
  const [deletingId,     setDeletingId]     = useState(null)

  // Modal states
  const [showAddModal,   setShowAddModal]   = useState(false)
  const [addForm,        setAddForm]        = useState(INITIAL_FORM)
  const [savingAdd,      setSavingAdd]      = useState(false)

  const [showEditModal,  setShowEditModal]  = useState(false)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [editForm,       setEditForm]       = useState(INITIAL_FORM)
  const [savingEdit,     setSavingEdit]     = useState(false)

  // AbortController ref — cancels stale requests when search/page changes
  const abortRef = useRef(null)

  const load = useCallback(async (page, searchTerm, { silent = false } = {}) => {
    if (abortRef.current) {
      abortRef.current.abort()
    }
    const controller = new AbortController()
    abortRef.current = controller

    if (!silent) setLoading(true)
    setError('')

    try {
      const data = await getTelcoCustomers(page, PAGE_SIZE, searchTerm, controller.signal)

      if (controller.signal.aborted) return

      const rawRecords = data.data || data.records || []
      setRecords(rawRecords.map((r, i) => mapRecord(r, i)))
      setTotal(typeof data.total === 'number' ? data.total : 0)
      setTotalPages(typeof data.total_pages === 'number' ? data.total_pages : (Math.ceil((data.total || 0) / PAGE_SIZE) || 1))
    } catch (err) {
      if (err.name === 'AbortError' || controller.signal.aborted) return
      setError(`Failed to load customers: ${err.message}`)
      toast.error('Failed to load customers')
      setRecords([])
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(currentPage, search)
    return () => { if (abortRef.current) abortRef.current.abort() }
  }, [currentPage, search, load])

  const handleClearSearch = useCallback(() => {
    setSearchInput('')
    setSearch('')
    setCurrentPage(1)
    load(1, '')
  }, [load])

  // Debounced search — 300ms
  useEffect(() => {
    const t = setTimeout(() => {
      const trimmed = searchInput.trim()
      setSearch(trimmed)
      setCurrentPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  // Client-side risk filter on current page records
  const displayedRecords = riskFilter === 'all'
    ? records
    : records.filter(r => r.riskLevel.toLowerCase() === riskFilter.toLowerCase())

  // Add Customer
  async function handleAddSubmit(e) {
    e.preventDefault()
    if (savingAdd) return

    setSavingAdd(true)
    try {
      const payload = {
        ...addForm,
        tenure: parseInt(addForm.tenure || 0),
        MonthlyCharges: parseFloat(addForm.MonthlyCharges || 0),
        TotalCharges: parseFloat(addForm.TotalCharges || 0),
      }

      const res = await addTelcoCustomer(payload)
      const created = res.customer || payload
      const mapped = mapRecord(created, records.length)

      setRecords(prev => [mapped, ...prev])
      setTotal(t => t + 1)
      setTotalPages(Math.max(1, Math.ceil((total + 1) / PAGE_SIZE)))

      toast.success(res.message || `Customer "${mapped.id}" added successfully`)
      setShowAddModal(false)
      setAddForm(INITIAL_FORM)
    } catch (err) {
      toast.error(err.message || 'Failed to add customer')
    } finally {
      setSavingAdd(false)
    }
  }

  // Edit Customer
  function openEditModal(c) {
    setEditingCustomer(c)
    setEditForm({
      customerID: c.id,
      gender: c.gender || 'Male',
      SeniorCitizen: c.SeniorCitizen || 'No',
      Partner: c.Partner || 'No',
      Dependents: c.Dependents || 'No',
      tenure: c.tenureNum || 12,
      PhoneService: 'Yes',
      MultipleLines: 'No',
      InternetService: c.internet || 'Fiber optic',
      OnlineSecurity: c.onlineSecurity || 'Yes',
      OnlineBackup: 'No',
      DeviceProtection: 'No',
      TechSupport: c.techSupport || 'Yes',
      StreamingTV: 'No',
      StreamingMovies: 'No',
      Contract: c.contract || 'Month-to-month',
      PaperlessBilling: c.paperlessBilling || 'Yes',
      PaymentMethod: c.paymentMethod || 'Electronic check',
      MonthlyCharges: c.monthlyCharges || 65.0,
      TotalCharges: c.totalCharges || 780.0,
      Churn: c.churn || 'No',
    })
    setShowEditModal(true)
  }

  async function handleEditSubmit(e) {
    e.preventDefault()
    if (!editingCustomer || savingEdit) return

    setSavingEdit(true)
    try {
      const payload = {
        gender: editForm.gender,
        SeniorCitizen: editForm.SeniorCitizen,
        Partner: editForm.Partner,
        Dependents: editForm.Dependents,
        tenure: parseInt(editForm.tenure || 0),
        InternetService: editForm.InternetService,
        OnlineSecurity: editForm.OnlineSecurity,
        TechSupport: editForm.TechSupport,
        Contract: editForm.Contract,
        PaperlessBilling: editForm.PaperlessBilling,
        PaymentMethod: editForm.PaymentMethod,
        MonthlyCharges: parseFloat(editForm.MonthlyCharges || 0),
        TotalCharges: parseFloat(editForm.TotalCharges || 0),
        Churn: editForm.Churn,
      }

      const res = await updateTelcoCustomer(editingCustomer.id, payload)
      const updated = res.customer || { ...editingCustomer, ...payload }
      const mapped = mapRecord(updated, 0)

      setRecords(prev => prev.map(r => r.id === editingCustomer.id ? { ...r, ...mapped } : r))

      toast.success(res.message || `Customer "${editingCustomer.id}" updated`)
      setShowEditModal(false)
      setEditingCustomer(null)
    } catch (err) {
      toast.error(err.message || 'Failed to update customer')
    } finally {
      setSavingEdit(false)
    }
  }

  // Delete Customer
  async function handleDelete(customerId, displayName) {
    if (typeof window !== 'undefined' && window.__SKIP_CONFIRM__ !== true) {
      if (!window.confirm(`Delete customer "${displayName}"? This cannot be undone.`)) return
    }

    setDeletingId(customerId)
    try {
      const res = await deleteTelcoCustomer(customerId)
      toast.success(`Customer "${displayName}" deleted`)

      if (res && typeof res.total === 'number') {
        setTotal(res.total)
        setTotalPages(Math.max(1, Math.ceil(res.total / PAGE_SIZE)))
      }

      if (records.length === 1 && currentPage > 1) {
        const prevPage = currentPage - 1
        setCurrentPage(prevPage)
        await load(prevPage, search, { silent: true })
      } else {
        await load(currentPage, search, { silent: true })
      }
    } catch (err) {
      toast.error(err.message || 'Delete failed')
    } finally {
      setDeletingId(null)
    }
  }

  // Smart page numbers array
  function getPageNumbers() {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }
    const pages = [1]
    if (currentPage > 4) {
      pages.push('...')
    }
    const start = Math.max(2, Math.min(currentPage - 1, totalPages - 4))
    const end   = Math.min(totalPages - 1, Math.max(currentPage + 1, 5))
    for (let p = start; p <= end; p++) {
      pages.push(p)
    }
    if (currentPage < totalPages - 3) {
      pages.push('...')
    }
    pages.push(totalPages)
    return pages
  }

  const showingFrom = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const showingTo   = Math.min(currentPage * PAGE_SIZE, total)

  return (
    <div className="page-layout">
      <Sidebar />
      <div className="page-content" style={{ padding: '24px 32px' }}>

        {/* ── Top Navbar ── */}
        <Header
          title="Customer Directory"
          subtitle="Inspect telemetry, behavioral contracts, and calibrated risk classifications."
          onRefresh={() => load(currentPage, search)}
          isRefreshing={loading}
          extraActions={
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '8px 14px', borderRadius: '10px' }}
            >
              <UserPlus size={15} />
              <span>Add Customer</span>
            </button>
          }
        />

        {/* ── Search & Filter Controls (Clean Slate Controls) ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', gap: '16px', flexWrap: 'wrap' }}>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
            {/* Search Input */}
            <div style={{ position: 'relative', width: '100%', maxWidth: '400px', display: 'flex', alignItems: 'center' }}>
              <Search size={15} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--slate-400)', pointerEvents: 'none' }} />
              <input
                id="search-customers-input"
                type="text"
                placeholder="Search by ID, contract, or service…"
                value={searchInput}
                onChange={e => {
                  setSearchInput(e.target.value)
                  if (e.target.value === '') {
                    setSearch('')
                    setCurrentPage(1)
                  }
                }}
                onKeyDown={e => {
                  if (e.key === 'Escape') {
                    handleClearSearch()
                  }
                }}
                style={{
                  width: '100%',
                  padding: '9px 76px 9px 38px',
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  borderRadius: '10px',
                  fontSize: '12px',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  transition: 'all var(--transition-fast)'
                }}
              />
              {searchInput && (
                <button
                  id="clear-search-btn"
                  type="button"
                  onClick={handleClearSearch}
                  title="Clear search"
                  aria-label="Clear search"
                  style={{
                    position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                    background: 'var(--surface-muted)', border: '1px solid var(--border)',
                    color: 'var(--text-secondary)', cursor: 'pointer', padding: '3px 8px', borderRadius: '6px',
                    display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600
                  }}
                >
                  <X size={12} />
                  <span>Clear</span>
                </button>
              )}
            </div>

            {/* Risk Filter Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface-muted)', padding: '3px', borderRadius: '10px', border: '1px solid var(--border)' }}>
              {[
                { key: 'all', label: 'All' },
                { key: 'high', label: 'High Risk' },
                { key: 'medium', label: 'Medium Risk' },
                { key: 'low', label: 'Low Risk' }
              ].map(f => {
                const isActive = riskFilter === f.key
                return (
                  <button
                    key={f.key}
                    type="button"
                    onClick={() => setRiskFilter(f.key)}
                    style={{
                      padding: '5px 12px',
                      fontSize: '11px',
                      fontWeight: 600,
                      borderRadius: '8px',
                      border: 'none',
                      cursor: 'pointer',
                      background: isActive ? 'var(--surface)' : 'transparent',
                      color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                      boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
                      transition: 'all var(--transition-fast)'
                    }}
                  >
                    {f.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Database Total Count */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            <Database size={14} color="var(--slate-400)" />
            <span><strong style={{ color: 'var(--text-primary)' }}>{total.toLocaleString('en-IN')}</strong> customer records</span>
          </div>
        </div>

        {/* Error banner */}
        {error && !loading && (
          <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', color: 'var(--danger)', fontSize: '13px', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{error}</span>
            <button onClick={() => load(currentPage, search)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}>Retry</button>
          </div>
        )}

        {/* ── Professional Analytics Table ── */}
        <div className="analytics-table-wrap">
          <div style={{ overflowX: 'auto' }}>
            <table className="analytics-table">
              <thead>
                <tr>
                  {['CUSTOMER ID', 'CONTRACT', 'INTERNET SERVICE', 'TOTAL SPEND', 'TENURE', 'CHURN STATUS', 'RISK LEVEL', 'ACTIONS'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '48px', textAlign: 'center', color: 'var(--slate-500)', fontSize: '13px' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '16px', height: '16px', border: '2px solid var(--slate-300)', borderTopColor: 'var(--brand)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                        Loading customer records…
                      </div>
                    </td>
                  </tr>
                ) : displayedRecords.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '56px', textAlign: 'center' }}>
                      <Users size={38} style={{ margin: '0 auto 12px', opacity: 0.25, display: 'block', color: 'var(--slate-400)' }} />
                      <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--slate-900)', marginBottom: '4px' }}>
                        {search || riskFilter !== 'all' ? 'No matching customer records' : 'No customer records yet'}
                      </p>
                      <p style={{ fontSize: '12px', color: 'var(--slate-500)', margin: 0 }}>
                        {search || riskFilter !== 'all' ? 'Try adjusting your search query or risk level filter.' : 'Upload a CSV dataset or add a customer to get started.'}
                      </p>
                    </td>
                  </tr>
                ) : displayedRecords.map((c, idx) => (
                  <tr
                    key={`${c.id}-${idx}`}
                    style={{
                      opacity: deletingId === c.id ? 0.4 : 1,
                    }}
                  >
                    {/* Customer ID */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '50%', background: c.color,
                          color: '#fff', fontWeight: 700, fontSize: '10px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                        }}>
                          {c.initials}
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.01em' }}>{c.name}</span>
                      </div>
                    </td>

                    {/* Contract */}
                    <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{c.contract}</td>

                    {/* Internet Service */}
                    <td>
                      <span style={{ background: 'var(--surface-muted)', color: 'var(--text-secondary)', padding: '3px 9px', borderRadius: '6px', fontSize: '11px', fontWeight: 600 }}>
                        {c.internet}
                      </span>
                    </td>

                    {/* Total Spend */}
                    <td style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{c.spend}</td>

                    {/* Tenure */}
                    <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{c.tenure}</td>

                    {/* Churn Status */}
                    <td>
                      {c.churn !== null ? (
                        <span className={c.churn === 'Yes' || c.churn === true ? 'badge badge-red' : 'badge badge-green'} style={{ fontSize: '10px' }}>
                          {c.churn === 'Yes' || c.churn === true ? '● Churned' : '● Retained'}
                        </span>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--slate-400)' }}>N/A</span>
                      )}
                    </td>

                    {/* Risk Level Badge */}
                    <td>
                      {c.riskLevel === 'High' && (
                        <span className="badge badge-red" style={{ fontSize: '10px' }}>
                          ● High Risk
                        </span>
                      )}
                      {c.riskLevel === 'Medium' && (
                        <span className="badge badge-yellow" style={{ fontSize: '10px' }}>
                          ● Medium Risk
                        </span>
                      )}
                      {c.riskLevel === 'Low' && (
                        <span className="badge badge-green" style={{ fontSize: '10px' }}>
                          ● Low Risk
                        </span>
                      )}
                    </td>

                    {/* Actions: Edit & Delete */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button
                          onClick={() => openEditModal(c)}
                          title="Edit customer"
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'var(--slate-600)', padding: '6px', borderRadius: '6px',
                            display: 'flex', alignItems: 'center', transition: 'all 150ms'
                          }}
                          onMouseEnter={e => e.currentTarget.style.color = 'var(--brand)'}
                          onMouseLeave={e => e.currentTarget.style.color = 'var(--slate-600)'}
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          id={`delete-btn-${c.id}`}
                          onClick={() => handleDelete(c.id, c.name)}
                          disabled={deletingId === c.id}
                          title={deletingId === c.id ? 'Deleting…' : `Delete customer ${c.id}`}
                          aria-label={`Delete customer ${c.id}`}
                          style={{
                            background: 'none', border: 'none', cursor: deletingId === c.id ? 'not-allowed' : 'pointer',
                            color: deletingId === c.id ? 'var(--slate-400)' : 'var(--danger)',
                            padding: '6px', borderRadius: '6px',
                            opacity: deletingId === c.id ? 0.5 : 1, transition: 'all 150ms',
                            display: 'flex', alignItems: 'center',
                          }}
                        >
                          {deletingId === c.id
                            ? <div style={{ width: '13px', height: '13px', border: '2px solid var(--slate-300)', borderTopColor: 'var(--danger)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                            : <Trash2 size={14} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ── */}
          {!loading && total > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 18px', borderTop: '1px solid var(--border)',
              background: 'var(--surface)', flexWrap: 'wrap', gap: '10px'
            }}>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                Showing <strong style={{ color: 'var(--text-primary)' }}>{showingFrom.toLocaleString('en-IN')}–{showingTo.toLocaleString('en-IN')}</strong> of{' '}
                <strong style={{ color: 'var(--text-primary)' }}>{total.toLocaleString('en-IN')}</strong> records
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <button
                  id="prev-page-btn"
                  aria-label="Previous page"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  style={{
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    color: currentPage === 1 ? 'var(--text-muted)' : 'var(--text-secondary)',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    padding: '5px 11px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '4px',
                    fontSize: '12px', fontWeight: 600,
                    opacity: currentPage === 1 ? 0.5 : 1, transition: 'all 150ms'
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
                        minWidth: '32px', height: '32px', padding: '0 6px', borderRadius: '8px',
                        border: currentPage === p ? '1px solid var(--brand)' : '1px solid var(--border)',
                        background: currentPage === p ? 'var(--brand)' : 'var(--surface)',
                        color: currentPage === p ? '#ffffff' : 'var(--text-secondary)',
                        fontWeight: 700, fontSize: '12px', cursor: 'pointer',
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
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  style={{
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    color: currentPage >= totalPages ? 'var(--text-muted)' : 'var(--text-secondary)',
                    cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                    padding: '5px 11px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '4px',
                    fontSize: '12px', fontWeight: 600,
                    opacity: currentPage >= totalPages ? 0.5 : 1, transition: 'all 150ms'
                  }}
                >
                  <span>Next</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── MODAL: ADD CUSTOMER ── */}
        {showAddModal && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: '20px'
          }}>
            <div style={{
              width: '100%', maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto',
              padding: '24px 28px', borderRadius: '16px', background: 'var(--surface)',
              border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--brand-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand)' }}>
                    <UserPlus size={16} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Add New Customer</h3>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>Insert a single customer record into the tenant directory</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowAddModal(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--slate-600)', marginBottom: '4px' }}>Customer ID (Optional)</label>
                    <input
                      type="text"
                      placeholder="Auto-generated if empty"
                      value={addForm.customerID}
                      onChange={e => setAddForm({ ...addForm, customerID: e.target.value })}
                      className="input-base"
                      style={{ fontSize: '12px', padding: '8px 12px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--slate-600)', marginBottom: '4px' }}>Contract Type</label>
                    <select
                      value={addForm.Contract}
                      onChange={e => setAddForm({ ...addForm, Contract: e.target.value })}
                      className="input-base"
                      style={{ fontSize: '12px', padding: '8px 12px' }}
                    >
                      <option value="Month-to-month">Month-to-month</option>
                      <option value="One year">One year</option>
                      <option value="Two year">Two year</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--slate-600)', marginBottom: '4px' }}>Internet Service</label>
                    <select
                      value={addForm.InternetService}
                      onChange={e => setAddForm({ ...addForm, InternetService: e.target.value })}
                      className="input-base"
                      style={{ fontSize: '12px', padding: '8px 12px' }}
                    >
                      <option value="Fiber optic">Fiber optic</option>
                      <option value="DSL">DSL</option>
                      <option value="No">No</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--slate-600)', marginBottom: '4px' }}>Tenure (Months)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={addForm.tenure}
                      onChange={e => setAddForm({ ...addForm, tenure: e.target.value })}
                      className="input-base"
                      style={{ fontSize: '12px', padding: '8px 12px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--slate-600)', marginBottom: '4px' }}>Gender</label>
                    <select
                      value={addForm.gender}
                      onChange={e => setAddForm({ ...addForm, gender: e.target.value })}
                      className="input-base"
                      style={{ fontSize: '12px', padding: '8px 12px' }}
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--slate-600)', marginBottom: '4px' }}>Monthly Charges (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={addForm.MonthlyCharges}
                      onChange={e => {
                        const m = parseFloat(e.target.value) || 0
                        const ten = parseInt(addForm.tenure) || 1
                        setAddForm({ ...addForm, MonthlyCharges: e.target.value, TotalCharges: (m * ten).toFixed(2) })
                      }}
                      className="input-base"
                      style={{ fontSize: '12px', padding: '8px 12px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--slate-600)', marginBottom: '4px' }}>Total Charges (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={addForm.TotalCharges}
                      onChange={e => setAddForm({ ...addForm, TotalCharges: e.target.value })}
                      className="input-base"
                      style={{ fontSize: '12px', padding: '8px 12px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--slate-600)', marginBottom: '4px' }}>Tech Support</label>
                    <select
                      value={addForm.TechSupport}
                      onChange={e => setAddForm({ ...addForm, TechSupport: e.target.value })}
                      className="input-base"
                      style={{ fontSize: '12px', padding: '8px 12px' }}
                    >
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--slate-600)', marginBottom: '4px' }}>Online Security</label>
                    <select
                      value={addForm.OnlineSecurity}
                      onChange={e => setAddForm({ ...addForm, OnlineSecurity: e.target.value })}
                      className="input-base"
                      style={{ fontSize: '12px', padding: '8px 12px' }}
                    >
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--slate-600)', marginBottom: '4px' }}>Paperless Billing</label>
                    <select
                      value={addForm.PaperlessBilling}
                      onChange={e => setAddForm({ ...addForm, PaperlessBilling: e.target.value })}
                      className="input-base"
                      style={{ fontSize: '12px', padding: '8px 12px' }}
                    >
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="btn-secondary"
                    style={{ fontSize: '12px', padding: '8px 14px' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingAdd}
                    className="btn-primary"
                    style={{ fontSize: '12px', padding: '8px 16px' }}
                  >
                    {savingAdd ? 'Saving…' : 'Add Customer'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── MODAL: EDIT CUSTOMER ── */}
        {showEditModal && editingCustomer && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: '20px'
          }}>
            <div style={{
              width: '100%', maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto',
              padding: '24px 28px', borderRadius: '16px', background: 'var(--surface)',
              border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--brand-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brand)' }}>
                    <Edit3 size={16} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Edit Customer</h3>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>Update account record: {editingCustomer.id}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowEditModal(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--slate-400)', cursor: 'pointer', padding: '4px' }}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--slate-600)', marginBottom: '4px' }}>Contract Type</label>
                    <select
                      value={editForm.Contract}
                      onChange={e => setEditForm({ ...editForm, Contract: e.target.value })}
                      className="input-base"
                      style={{ fontSize: '12px', padding: '8px 12px' }}
                    >
                      <option value="Month-to-month">Month-to-month</option>
                      <option value="One year">One year</option>
                      <option value="Two year">Two year</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--slate-600)', marginBottom: '4px' }}>Internet Service</label>
                    <select
                      value={editForm.InternetService}
                      onChange={e => setEditForm({ ...editForm, InternetService: e.target.value })}
                      className="input-base"
                      style={{ fontSize: '12px', padding: '8px 12px' }}
                    >
                      <option value="Fiber optic">Fiber optic</option>
                      <option value="DSL">DSL</option>
                      <option value="No">No</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--slate-600)', marginBottom: '4px' }}>Tenure (Months)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={editForm.tenure}
                      onChange={e => setEditForm({ ...editForm, tenure: e.target.value })}
                      className="input-base"
                      style={{ fontSize: '12px', padding: '8px 12px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--slate-600)', marginBottom: '4px' }}>Monthly Charges (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editForm.MonthlyCharges}
                      onChange={e => setEditForm({ ...editForm, MonthlyCharges: e.target.value })}
                      className="input-base"
                      style={{ fontSize: '12px', padding: '8px 12px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--slate-600)', marginBottom: '4px' }}>Total Charges (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={editForm.TotalCharges}
                      onChange={e => setEditForm({ ...editForm, TotalCharges: e.target.value })}
                      className="input-base"
                      style={{ fontSize: '12px', padding: '8px 12px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="btn-secondary"
                    style={{ fontSize: '12px', padding: '8px 14px' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="btn-primary"
                    style={{ fontSize: '12px', padding: '8px 16px' }}
                  >
                    {savingEdit ? 'Updating…' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
