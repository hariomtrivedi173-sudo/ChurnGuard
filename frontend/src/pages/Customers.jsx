import { useEffect, useState, useCallback, useRef } from 'react'
import Sidebar from '../components/Sidebar'
import Header from '../components/Header'
import toast from 'react-hot-toast'
import { getTelcoCustomers, deleteTelcoCustomer, addTelcoCustomer, updateTelcoCustomer } from '../api/customers'
import {
  Search, ChevronLeft, ChevronRight, Trash2, Users, Database,
  UserPlus, Edit3, X, Check
} from 'lucide-react'

const AVATAR_COLORS = ['#7C3AED', '#3B82F6', '#6366F1', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899', '#14B8A6']

// Format a telco record into a display row
function mapRecord(r, i = 0) {
  const id      = r.customerID || r._id || `CUS-${i}`
  const monthly = parseFloat(r.MonthlyCharges || 0)
  const total   = parseFloat(r.TotalCharges   || 0)
  const tenure  = parseInt(r.tenure || 0)

  // Heuristic status (no ML prob available at list level)
  const isHighRisk = tenure < 12 && r.Contract === 'Month-to-month'
  const status     = isHighRisk ? 'At Risk' : 'Active'

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
    status,
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

function Customers() {
  const [records,        setRecords]        = useState([])
  const [total,          setTotal]          = useState(0)
  const [totalPages,     setTotalPages]     = useState(1)
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState('')
  const [currentPage,    setCurrentPage]    = useState(1)
  const [search,         setSearch]         = useState('')
  const [searchInput,    setSearchInput]    = useState('')
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
    // Cancel any in-flight request
    if (abortRef.current) {
      abortRef.current.abort()
    }
    const controller = new AbortController()
    abortRef.current = controller

    if (!silent) setLoading(true)
    setError('')

    try {
      const data = await getTelcoCustomers(page, PAGE_SIZE, searchTerm, controller.signal)

      // If this request was aborted by a newer one, ignore the result
      if (controller.signal.aborted) return

      const rawRecords = data.data || data.records || []
      setRecords(rawRecords.map((r, i) => mapRecord(r, i)))
      setTotal(typeof data.total === 'number' ? data.total : 0)
      setTotalPages(typeof data.total_pages === 'number' ? data.total_pages : (Math.ceil((data.total || 0) / PAGE_SIZE) || 1))
    } catch (err) {
      if (err.name === 'AbortError' || controller.signal.aborted) return
      console.error(err)
      setError(`Failed to load customers: ${err.message}`)
      toast.error('Failed to load customers')
      setRecords([])
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(currentPage, search)
    // Cleanup: abort on unmount
    return () => { if (abortRef.current) abortRef.current.abort() }
  }, [currentPage, search, load])

  const handleClearSearch = useCallback(() => {
    setSearchInput('')
    setSearch('')
    setCurrentPage(1)
    load(1, '')
  }, [load])

  // Debounced search — 300ms (cancel on rapid typing)
  useEffect(() => {
    const t = setTimeout(() => {
      const trimmed = searchInput.trim()
      setSearch(trimmed)
      setCurrentPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  // ── FAST ADD CUSTOMER ──────────────────────────────────────────────────────
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

      // Immediately prepend to local list and update count — ZERO page reload
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

  // ── FAST EDIT CUSTOMER ─────────────────────────────────────────────────────
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

      // Immediately update in local list — ZERO page reload
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

  // ── DELETE CUSTOMER ────────────────────────────────────────────────────────
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

      // If this was the last record on a non-first page, move back 1 page
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
          title="Customers"
          subtitle="Manage and inspect all customer records in your dataset."
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

        {/* Search + Stats Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1', maxWidth: '440px', display: 'flex', alignItems: 'center' }}>
            <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              id="search-customers-input"
              type="text"
              placeholder="Search by customer ID, contract type, or internet service…"
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
              className="input-base"
              style={{ paddingLeft: '40px', paddingRight: searchInput ? '80px' : '14px', width: '100%' }}
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
                  background: 'var(--surface-hover, #f3f4f6)', border: '1px solid var(--border)',
                  color: 'var(--text-muted)', cursor: 'pointer', padding: '3px 8px', borderRadius: '6px',
                  display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 600
                }}
              >
                <X size={12} />
                <span>Clear</span>
              </button>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            <Database size={14} />
            <span><strong style={{ color: 'var(--text-primary)' }}>{total.toLocaleString('en-IN')}</strong> total customers in dataset</span>
          </div>
        </div>

        {/* Error banner */}
        {error && !loading && (
          <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: '13px', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{error}</span>
            <button onClick={() => load(currentPage, search)} style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}>Retry</button>
          </div>
        )}

        {/* Table */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '760px' }}>
              <thead>
                <tr style={{ background: 'var(--table-header-bg)', borderBottom: '1px solid var(--border)' }}>
                  {['CUSTOMER ID', 'CONTRACT', 'INTERNET SERVICE', 'TOTAL SPEND', 'TENURE', 'CHURN', 'STATUS', 'ACTIONS'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '16px', height: '16px', border: '2px solid var(--purple-200)', borderTopColor: 'var(--purple-600)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                        Loading customer records…
                      </div>
                    </td>
                  </tr>
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '56px', textAlign: 'center' }}>
                      <Users size={40} style={{ margin: '0 auto 14px', opacity: 0.2, display: 'block' }} />
                      <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                        {search ? 'No customers match your search' : 'No customers yet'}
                      </p>
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        {search ? 'Try a different customer ID or contract type.' : 'Upload a CSV dataset or add a customer above.'}
                      </p>
                    </td>
                  </tr>
                ) : records.map((c, idx) => (
                  <tr
                    key={`${c.id}-${idx}`}
                    style={{
                      borderTop: '1px solid var(--border)',
                      transition: 'background 150ms ease, opacity 200ms ease',
                      cursor: 'default',
                      opacity: deletingId === c.id ? 0.4 : 1,
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* Customer ID */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '34px', height: '34px', borderRadius: '50%', background: c.color,
                          color: '#fff', fontWeight: 700, fontSize: '10px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                        }}>
                          {c.initials}
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.02em' }}>{c.name}</span>
                      </div>
                    </td>

                    {/* Contract */}
                    <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>{c.contract}</td>

                    {/* Internet Service */}
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ background: 'var(--purple-50)', color: 'var(--purple-600)', padding: '3px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: 600 }}>
                        {c.internet}
                      </span>
                    </td>

                    {/* Total Spend */}
                    <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{c.spend}</td>

                    {/* Tenure */}
                    <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>{c.tenure}</td>

                    {/* Churn flag from dataset */}
                    <td style={{ padding: '12px 16px' }}>
                      {c.churn !== null ? (
                        <span className={c.churn === 'Yes' || c.churn === true ? 'badge badge-red' : 'badge badge-green'} style={{ fontSize: '10px' }}>
                          {c.churn === 'Yes' || c.churn === true ? '● Churned' : '● Retained'}
                        </span>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>N/A</span>
                      )}
                    </td>

                    {/* Risk Status */}
                    <td style={{ padding: '12px 16px' }}>
                      <span className={c.status === 'At Risk' ? 'badge badge-red' : 'badge badge-green'} style={{ fontSize: '10px' }}>
                        ● {c.status}
                      </span>
                    </td>

                    {/* Actions: Edit & Delete */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          onClick={() => openEditModal(c)}
                          title="Edit customer"
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'var(--purple-600)', padding: '5px', borderRadius: '6px',
                            display: 'flex', alignItems: 'center', transition: 'background 150ms'
                          }}
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
                            color: deletingId === c.id ? 'var(--text-muted)' : '#DC2626',
                            padding: '5px', borderRadius: '6px',
                            opacity: deletingId === c.id ? 0.5 : 1, transition: 'opacity 150ms',
                            display: 'flex', alignItems: 'center',
                          }}
                        >
                          {deletingId === c.id
                            ? <div style={{ width: '14px', height: '14px', border: '2px solid var(--text-muted)', borderTopColor: '#DC2626', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                            : <Trash2 size={14} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && total > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 16px', borderTop: '1px solid var(--border)',
              background: 'var(--surface)', flexWrap: 'wrap', gap: '10px'
            }}>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Showing <strong style={{ color: 'var(--text-primary)' }}>{showingFrom.toLocaleString('en-IN')}–{showingTo.toLocaleString('en-IN')}</strong> of{' '}
                <strong style={{ color: 'var(--text-primary)' }}>{total.toLocaleString('en-IN')}</strong> customers
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  id="prev-page-btn"
                  aria-label="Previous page"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  style={{
                    background: 'none', border: '1px solid var(--border)',
                    color: currentPage === 1 ? 'var(--text-muted)' : 'var(--text-primary)',
                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                    padding: '6px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '5px',
                    fontSize: '13px', fontWeight: 600,
                    opacity: currentPage === 1 ? 0.4 : 1, transition: 'all 150ms'
                  }}
                >
                  <ChevronLeft size={15} />
                  <span>Previous</span>
                </button>

                {getPageNumbers().map((p, idx) => (
                  p === '...' ? (
                    <span key={`dots-${idx}`} style={{ fontSize: '13px', color: 'var(--text-muted)', padding: '0 4px' }}>…</span>
                  ) : (
                    <button
                      key={p}
                      id={`page-btn-${p}`}
                      onClick={() => setCurrentPage(p)}
                      style={{
                        minWidth: '34px', height: '34px', padding: '0 8px', borderRadius: '8px',
                        border: currentPage === p ? '1px solid var(--accent, #6366F1)' : '1px solid var(--border)',
                        background: currentPage === p ? 'var(--accent, #6366F1)' : 'transparent',
                        color: currentPage === p ? 'var(--bg, #fff)' : 'var(--text-secondary)',
                        fontWeight: 700, fontSize: '13px', cursor: 'pointer',
                        boxShadow: currentPage === p ? '0 2px 8px rgba(99, 102, 241, 0.25)' : 'none',
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
                    background: 'none', border: '1px solid var(--border)',
                    color: currentPage >= totalPages ? 'var(--text-muted)' : 'var(--text-primary)',
                    cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                    padding: '6px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '5px',
                    fontSize: '13px', fontWeight: 600,
                    opacity: currentPage >= totalPages ? 0.4 : 1, transition: 'all 150ms'
                  }}
                >
                  <span>Next</span>
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── MODAL: ADD CUSTOMER ── */}
        {showAddModal && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: '20px'
          }}>
            <div className="card" style={{
              width: '100%', maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto',
              padding: '24px 28px', borderRadius: '16px', background: 'var(--surface)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--purple-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--purple-600)' }}>
                    <UserPlus size={16} />
                  </div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Add New Customer</h3>
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
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Customer ID (Optional)</label>
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
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Contract Type</label>
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
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Internet Service</label>
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
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Tenure (Months)</label>
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
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Gender</label>
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
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Monthly Charges (₹)</label>
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
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Total Charges (₹)</label>
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
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Tech Support</label>
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
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Online Security</label>
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
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Payment Method</label>
                    <select
                      value={addForm.PaymentMethod}
                      onChange={e => setAddForm({ ...addForm, PaymentMethod: e.target.value })}
                      className="input-base"
                      style={{ fontSize: '12px', padding: '8px 12px' }}
                    >
                      <option value="Electronic check">Electronic check</option>
                      <option value="Mailed check">Mailed check</option>
                      <option value="Bank transfer (automatic)">Bank transfer (auto)</option>
                      <option value="Credit card (automatic)">Credit card (auto)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="btn-secondary"
                    style={{ fontSize: '13px', padding: '8px 16px' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingAdd}
                    className="btn-primary"
                    style={{ fontSize: '13px', padding: '8px 20px', display: 'flex', alignItems: 'center', gap: '6px', opacity: savingAdd ? 0.7 : 1 }}
                  >
                    {savingAdd ? (
                      <>
                        <div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                        Saving…
                      </>
                    ) : (
                      <>
                        <Check size={15} />
                        Add Customer
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── MODAL: EDIT CUSTOMER ── */}
        {showEditModal && editingCustomer && (
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: '20px'
          }}>
            <div className="card" style={{
              width: '100%', maxWidth: '580px', maxHeight: '90vh', overflowY: 'auto',
              padding: '24px 28px', borderRadius: '16px', background: 'var(--surface)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--purple-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--purple-600)' }}>
                    <Edit3 size={16} />
                  </div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Edit Customer: {editingCustomer.id}</h3>
                </div>
                <button
                  onClick={() => setShowEditModal(false)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Contract Type</label>
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
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Internet Service</label>
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
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Tenure (Months)</label>
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
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Monthly Spend (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.MonthlyCharges}
                      onChange={e => setEditForm({ ...editForm, MonthlyCharges: e.target.value })}
                      className="input-base"
                      style={{ fontSize: '12px', padding: '8px 12px' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Total Spend (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editForm.TotalCharges}
                      onChange={e => setEditForm({ ...editForm, TotalCharges: e.target.value })}
                      className="input-base"
                      style={{ fontSize: '12px', padding: '8px 12px' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Tech Support</label>
                    <select
                      value={editForm.TechSupport}
                      onChange={e => setEditForm({ ...editForm, TechSupport: e.target.value })}
                      className="input-base"
                      style={{ fontSize: '12px', padding: '8px 12px' }}
                    >
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Online Security</label>
                    <select
                      value={editForm.OnlineSecurity}
                      onChange={e => setEditForm({ ...editForm, OnlineSecurity: e.target.value })}
                      className="input-base"
                      style={{ fontSize: '12px', padding: '8px 12px' }}
                    >
                      <option value="Yes">Yes</option>
                      <option value="No">No</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>Churn Status</label>
                    <select
                      value={editForm.Churn}
                      onChange={e => setEditForm({ ...editForm, Churn: e.target.value })}
                      className="input-base"
                      style={{ fontSize: '12px', padding: '8px 12px' }}
                    >
                      <option value="No">No (Retained)</option>
                      <option value="Yes">Yes (Churned)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="btn-secondary"
                    style={{ fontSize: '13px', padding: '8px 16px' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingEdit}
                    className="btn-primary"
                    style={{ fontSize: '13px', padding: '8px 20px', display: 'flex', alignItems: 'center', gap: '6px', opacity: savingEdit ? 0.7 : 1 }}
                  >
                    {savingEdit ? (
                      <>
                        <div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                        Updating…
                      </>
                    ) : (
                      <>
                        <Check size={15} />
                        Save Changes
                      </>
                    )}
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

export default Customers