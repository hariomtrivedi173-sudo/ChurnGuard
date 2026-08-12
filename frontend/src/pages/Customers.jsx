import { useEffect, useState, useCallback } from 'react'
import Sidebar from '../components/Sidebar'
import Header from '../components/Header'
import toast from 'react-hot-toast'
import { getTelcoCustomers, deleteTelcoCustomer } from '../api/customers'
import { Search, ChevronLeft, ChevronRight, Trash2, Users, Database } from 'lucide-react'

const AVATAR_COLORS = ['#7c3aed', '#6b7280', '#16a34a', '#ea580c', '#8b5cf6', '#2563eb', '#d97706', '#059669']

// Format a telco record into a display row
function mapRecord(r, i) {
  const id       = r.customerID || r._id || `CUS-${i}`
  const monthly  = parseFloat(r.MonthlyCharges || 0)
  const total    = parseFloat(r.TotalCharges   || 0)
  const tenure   = parseInt(r.tenure || 0)

  // Determine risk from tenure + contract (heuristic when no ML prob available)
  const isHighRisk = tenure < 12 && r.Contract === 'Month-to-month'
  const status     = isHighRisk ? 'At Risk' : 'Active'

  const name     = id
  const initials = String(id).split('').filter(c => /[A-Z0-9]/i.test(c)).slice(0, 2).join('').toUpperCase() || 'CU'

  return {
    id,
    mongoId:  r._id,
    name,
    initials,
    color:    AVATAR_COLORS[i % AVATAR_COLORS.length],
    contract: r.Contract   || 'N/A',
    internet: r.InternetService || 'N/A',
    spend:    total > 0 ? `₹${Math.round(total).toLocaleString('en-IN')}` : (monthly > 0 ? `₹${Math.round(monthly).toLocaleString('en-IN')}/mo` : 'N/A'),
    tenure:   tenure > 0 ? `${tenure} mo` : 'N/A',
    status,
    churn:    r.Churn ?? null,
  }
}

const PAGE_SIZE = 50

function Customers() {
  const [records,     setRecords]     = useState([])
  const [total,       setTotal]       = useState(0)
  const [totalPages,  setTotalPages]  = useState(1)
  const [loading,     setLoading]     = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [search,      setSearch]      = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [deletingId,  setDeletingId]  = useState(null)

  const load = useCallback(async (page, searchTerm) => {
    setLoading(true)
    try {
      const data = await getTelcoCustomers(page, PAGE_SIZE, searchTerm)
      setRecords((data.records || []).map(mapRecord))
      setTotal(data.total || 0)
      setTotalPages(data.total_pages || 1)
    } catch (err) {
      console.error(err)
      toast.error('Failed to load customers')
      setRecords([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(currentPage, search)
  }, [currentPage, search, load])

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput)
      setCurrentPage(1)
    }, 400)
    return () => clearTimeout(t)
  }, [searchInput])

  async function handleDelete(customerId, displayName) {
    if (!window.confirm(`Delete customer "${displayName}"? This cannot be undone.`)) return
    setDeletingId(customerId)
    try {
      await deleteTelcoCustomer(customerId)
      toast.success(`Customer "${displayName}" deleted`)
      // Reload same page (total count will decrease)
      await load(currentPage, search)
    } catch (err) {
      toast.error(err.message || 'Delete failed')
    } finally {
      setDeletingId(null)
    }
  }

  // Visible page numbers
  const startPage = Math.max(1, Math.min(currentPage - 2, totalPages - 4))
  const visiblePages = Array.from({ length: Math.min(5, totalPages) }, (_, i) => startPage + i)

  const showingFrom = total === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1
  const showingTo   = Math.min(currentPage * PAGE_SIZE, total)

  return (
    <div className="page-layout">
      <Sidebar />
      <div className="page-content" style={{ padding: '24px 32px' }}>

        <Header title="Customers" subtitle="All customers from your uploaded dataset." />

        {/* Search + Stats Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1', maxWidth: '420px' }}>
            <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search by customer ID, contract type, or internet service…"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="input-base"
              style={{ paddingLeft: '40px' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            <Database size={14} />
            <span><strong style={{ color: 'var(--text-primary)' }}>{total.toLocaleString('en-IN')}</strong> total customers in dataset</span>
          </div>
        </div>

        {/* Table */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '700px' }}>
              <thead>
                <tr style={{ background: 'var(--table-header-bg)', borderBottom: '1px solid var(--border)' }}>
                  {['CUSTOMER ID', 'CONTRACT', 'INTERNET SERVICE', 'TOTAL SPEND', 'TENURE', 'CHURN', 'STATUS', ''].map(h => (
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
                        {search ? 'No customers match your search' : 'No dataset uploaded yet'}
                      </p>
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                        {search ? 'Try a different customer ID or contract type.' : 'Go to the Upload page and upload a CSV dataset.'}
                      </p>
                    </td>
                  </tr>
                ) : records.map((c, idx) => (
                  <tr
                    key={`${c.id}-${idx}`}
                    style={{ borderTop: '1px solid var(--border)', transition: 'background 150ms ease', cursor: 'default' }}
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

                    {/* Delete */}
                    <td style={{ padding: '12px 16px' }}>
                      <button
                        onClick={() => handleDelete(c.id, c.name)}
                        disabled={deletingId === c.id}
                        title="Delete customer"
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: deletingId === c.id ? 'var(--text-muted)' : '#e11d48',
                          padding: '5px', borderRadius: '6px',
                          opacity: deletingId === c.id ? 0.5 : 1, transition: 'opacity 150ms',
                          display: 'flex', alignItems: 'center',
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
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
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Showing <strong style={{ color: 'var(--text-primary)' }}>{showingFrom.toLocaleString('en-IN')}–{showingTo.toLocaleString('en-IN')}</strong> of{' '}
                <strong style={{ color: 'var(--text-primary)' }}>{total.toLocaleString('en-IN')}</strong> customers
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                  style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', padding: '5px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', opacity: currentPage === 1 ? 0.4 : 1 }}
                >
                  <ChevronLeft size={15} />
                </button>

                {visiblePages.map(p => (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    style={{
                      width: '32px', height: '32px', borderRadius: '8px', border: 'none',
                      background: currentPage === p ? 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)' : 'transparent',
                      color: currentPage === p ? '#fff' : 'var(--text-secondary)',
                      fontWeight: 600, fontSize: '13px', cursor: 'pointer',
                    }}
                  >
                    {p}
                  </button>
                ))}

                {totalPages > startPage + 5 && (
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '0 4px' }}>…{totalPages}</span>
                )}

                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                  style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', padding: '5px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', opacity: currentPage === totalPages ? 0.4 : 1 }}
                >
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

export default Customers