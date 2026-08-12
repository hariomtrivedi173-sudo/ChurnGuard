import { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import Header from '../components/Header'
import toast from 'react-hot-toast'
import { getAllCustomers } from '../api/customers'
import { Search, ChevronLeft, ChevronRight } from 'lucide-react'

const fallbackCustomers = [
  { id: '1', name: 'Amelia Fischer', email: 'amelia.fischer@forgerobotics.com', company: 'Forge Robotics', plan: 'Starter', prob: 140, barPct: 100, spend: '$840', tenure: '40 mo', status: 'At Risk', initials: 'AF', color: '#9333ea' },
  { id: '2', name: 'Mason Brooks', email: 'mason.brooks@pulsefitness.com', company: 'Pulse Fitness', plan: 'Growth', prob: 131, barPct: 95, spend: '$470', tenure: '19 mo', status: 'At Risk', initials: 'MB', color: '#16a34a' },
  { id: '3', name: 'Layla Hassan', email: 'layla.hassan@driftmobility.com', company: 'Drift Mobility', plan: 'Enterprise', prob: 130, barPct: 92, spend: '$1.2K', tenure: '21 mo', status: 'At Risk', initials: 'LH', color: '#2563eb' },
  { id: '4', name: 'Logan Kim', email: 'logan.kim@lumenhealth.com', company: 'Lumen Health', plan: 'Growth', prob: 130, barPct: 92, spend: '$2.4K', tenure: '7 mo', status: 'At Risk', initials: 'LK', color: '#9333ea' },
  { id: '5', name: 'Owen Nguyen', email: 'owen.nguyen@northwindlabs.com', company: 'Northwind Labs', plan: 'Starter', prob: 129, barPct: 90, spend: '$1.3K', tenure: '24 mo', status: 'At Risk', initials: 'ON', color: '#2563eb' },
  { id: '6', name: 'Mia Yamada', email: 'mia.yamada@latticebio.com', company: 'Lattice Bio', plan: 'Scale', prob: 119, barPct: 85, spend: '$2.2K', tenure: '38 mo', status: 'At Risk', initials: 'MY', color: '#8b5cf6' },
]

function Customers() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 8

  useEffect(() => {
    loadCustomers()
  }, [])

  async function loadCustomers() {
    setLoading(true)
    try {
      const data = await getAllCustomers()
      if (Array.isArray(data) && data.length > 0) {
        setCustomers(data)
      } else {
        setCustomers([])
      }
    } catch (err) {
      console.log(err)
    } finally {
      setLoading(false)
    }
  }

  const listToDisplay = customers.length > 0
    ? customers.map((c, i) => {
        const idVal = c.customerID || c._id || `CUS-${1000 + i}`
        const nameVal = c.name || `Customer ${idVal}`
        const emailVal = c.email || `${idVal.toLowerCase()}@telco.com`
        const monthly = parseFloat(c.MonthlyCharges || c.monthly_charges || 70)
        const totalChg = parseFloat(c.TotalCharges || c.total_charges || monthly * 12)
        const tenureVal = parseInt(c.tenure || 12)

        return {
          id: idVal,
          name: nameVal,
          email: emailVal,
          company: c.Contract || c.location || 'Telco Account',
          plan: c.InternetService || c.subscription_type || 'Fiber optic',
          prob: Math.min(100, Math.round(monthly * 1.1)),
          barPct: Math.min(100, Math.round(monthly * 1.1)),
          spend: `$${Math.round(totalChg).toLocaleString()}`,
          tenure: `${tenureVal} mo`,
          status: tenureVal < 12 ? 'At Risk' : 'Active',
          initials: nameVal.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase(),
          color: fallbackCustomers[i % fallbackCustomers.length].color
        }
      })
    : fallbackCustomers

  const filtered = listToDisplay.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    c.company.toLowerCase().includes(search.toLowerCase())
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const paginated  = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <div className="page-layout">
      <Sidebar />
      <div className="page-content" style={{ padding: '24px 32px' }}>

        <Header title="Customers" subtitle="Welcome back, Maya — here's your customer list." />

        {/* ── Search Bar ── */}
        <div style={{ position: 'relative', marginBottom: '16px', maxWidth: '400px' }}>
          <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Filter customers by name or email…"
            value={search}
            onChange={e => { setSearch(e.target.value); setCurrentPage(1) }}
            className="input-base"
            style={{ paddingLeft: '40px' }}
          />
        </div>

        {/* ── Customers Table (Matching Image 4) ── */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--table-header-bg)', borderBottom: '1px solid var(--border)' }}>
                  {['CUSTOMER', 'COMPANY / CONTRACT', 'PLAN', 'CHURN RISK', 'TOTAL SPEND', 'TENURE', 'STATUS'].map(h => (
                    <th key={h} style={{ padding: '12px 20px', textAlign: 'left', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map(c => (
                  <tr
                    key={c.id}
                    style={{ borderTop: '1px solid var(--border)', transition: 'background 150ms ease' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--surface-hover)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '36px', height: '36px', borderRadius: '50%',
                          background: c.color, color: '#fff', fontWeight: 700, fontSize: '11px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                        }}>
                          {c.initials}
                        </div>
                        <div>
                          <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>{c.name}</p>
                          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{c.email}</p>
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: '14px 20px', fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                      {c.company}
                    </td>

                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ background: 'var(--purple-50)', color: 'var(--purple-600)', padding: '4px 10px', borderRadius: '99px', fontSize: '11px', fontWeight: 600 }}>
                        {c.plan}
                      </span>
                    </td>

                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '160px' }}>
                        <div style={{ flex: 1, height: '6px', background: 'var(--border)', borderRadius: '99px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${c.barPct}%`, background: c.status === 'At Risk' ? '#e11d48' : '#16a34a', borderRadius: '99px' }} />
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', minWidth: '38px' }}>
                          {c.prob}%
                        </span>
                      </div>
                    </td>

                    <td style={{ padding: '14px 20px', fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {c.spend}
                    </td>

                    <td style={{ padding: '14px 20px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {c.tenure}
                    </td>

                    <td style={{ padding: '14px 20px' }}>
                      <span className={c.status === 'At Risk' ? 'badge badge-red' : 'badge badge-green'} style={{ fontSize: '11px' }}>
                        ● {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer Pagination */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Showing {filtered.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}-{Math.min(pageSize * currentPage, filtered.length)} of {filtered.length.toLocaleString()}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <ChevronLeft size={16} />
              </button>
              
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => setCurrentPage(p)}
                  style={{
                    width: '28px', height: '28px', borderRadius: '50%',
                    border: 'none',
                    background: currentPage === p ? 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)' : 'transparent',
                    color: currentPage === p ? '#fff' : 'var(--text-secondary)',
                    fontWeight: 600, fontSize: '12px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}
                >
                  {p}
                </button>
              ))}

              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}

export default Customers