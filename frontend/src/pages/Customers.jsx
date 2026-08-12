import { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import toast from 'react-hot-toast'
import { getAllCustomers, createCustomer, deleteCustomer } from '../api/customers'
import { Search, Plus, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, X, Trash2 } from 'lucide-react'

const initialForm = {
  name: '', email: '', phone: '', age: 30, gender: 'Female', location: '',
  subscription_type: 'Standard', monthly_charges: 50, total_charges: 600,
  tenure: 12, contract_type: 'Month-to-month', payment_method: 'Electronic check',
  internet_service: 'DSL', tech_support: 'No', online_security: 'No', streaming_services: 'No',
}

function Customers() {
  const [customers,      setCustomers]      = useState([])
  const [loading,        setLoading]        = useState(true)
  const [showForm,       setShowForm]       = useState(false)
  const [form,           setForm]           = useState(initialForm)
  const [saving,         setSaving]         = useState(false)
  const [search,         setSearch]         = useState('')
  const [sortField,      setSortField]      = useState('name')
  const [sortDirection,  setSortDirection]  = useState('asc')
  const [currentPage,    setCurrentPage]    = useState(1)
  const pageSize = 8

  useEffect(() => { loadCustomers() }, [])

  async function loadCustomers() {
    setLoading(true)
    try { setCustomers(await getAllCustomers()) }
    catch (err) { toast.error(err.message) }
    finally { setLoading(false) }
  }

  function updateField(f, v) { setForm({ ...form, [f]: v }) }

  async function handleAdd(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await createCustomer({
        ...form,
        age: Number(form.age),
        monthly_charges: Number(form.monthly_charges),
        total_charges: Number(form.total_charges),
        tenure: Number(form.tenure),
      })
      toast.success('Customer added')
      setForm(initialForm)
      setShowForm(false)
      loadCustomers()
    } catch (err) { toast.error(err.message) }
    finally { setSaving(false) }
  }

  async function handleDelete(id, name) {
    if (!confirm(`Delete ${name}?`)) return
    try {
      await deleteCustomer(id)
      toast.success('Customer deleted')
      loadCustomers()
    } catch (err) { toast.error(err.message) }
  }

  function handleSort(field) {
    if (sortField === field) setSortDirection(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortField(field); setSortDirection('asc') }
    setCurrentPage(1)
  }

  const filtered = customers.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  )
  const sorted = [...filtered].sort((a, b) => {
    const va = a[sortField] ?? '', vb = b[sortField] ?? ''
    if (typeof va === 'number') return sortDirection === 'asc' ? va - vb : vb - va
    return sortDirection === 'asc'
      ? String(va).localeCompare(String(vb))
      : String(vb).localeCompare(String(va))
  })
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const paginated  = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <div className="page-layout">
      <Sidebar />
      <div className="page-content">

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Customers</h1>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              {loading ? 'Loading…' : `${filtered.length} of ${customers.length} customers`}
            </p>
          </div>
          <button
            id="add-customer-btn"
            onClick={() => setShowForm(!showForm)}
            className={showForm ? 'btn-secondary' : 'btn-primary'}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            {showForm ? <><X size={14} /> Cancel</> : <><Plus size={14} /> Add Customer</>}
          </button>
        </div>

        {/* ── Add form ── */}
        {showForm && (
          <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
            <p style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)', marginBottom: '18px' }}>New Customer</p>
            <form onSubmit={handleAdd}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '18px' }}>
                <FormField label="Name"><input className="input-base" value={form.name} onChange={e => updateField('name', e.target.value)} required placeholder="Full name" /></FormField>
                <FormField label="Email"><input className="input-base" type="email" value={form.email} onChange={e => updateField('email', e.target.value)} required placeholder="email@example.com" /></FormField>
                <FormField label="Phone"><input className="input-base" value={form.phone} onChange={e => updateField('phone', e.target.value)} required placeholder="+91 00000 00000" /></FormField>
                <FormField label="Age"><input className="input-base" type="number" value={form.age} onChange={e => updateField('age', e.target.value)} /></FormField>
                <FormField label="Gender">
                  <select className="input-base" value={form.gender} onChange={e => updateField('gender', e.target.value)}>
                    {['Male','Female'].map(o => <option key={o}>{o}</option>)}
                  </select>
                </FormField>
                <FormField label="Location"><input className="input-base" value={form.location} onChange={e => updateField('location', e.target.value)} required placeholder="City" /></FormField>
                <FormField label="Subscription Type"><input className="input-base" value={form.subscription_type} onChange={e => updateField('subscription_type', e.target.value)} /></FormField>
                <FormField label="Monthly Charges ($)"><input className="input-base" type="number" step="0.01" value={form.monthly_charges} onChange={e => updateField('monthly_charges', e.target.value)} /></FormField>
                <FormField label="Total Charges ($)"><input className="input-base" type="number" step="0.01" value={form.total_charges} onChange={e => updateField('total_charges', e.target.value)} /></FormField>
                <FormField label="Tenure (months)"><input className="input-base" type="number" value={form.tenure} onChange={e => updateField('tenure', e.target.value)} /></FormField>
                <FormField label="Contract">
                  <select className="input-base" value={form.contract_type} onChange={e => updateField('contract_type', e.target.value)}>
                    {['Month-to-month','One year','Two year'].map(o => <option key={o}>{o}</option>)}
                  </select>
                </FormField>
                <FormField label="Payment Method"><input className="input-base" value={form.payment_method} onChange={e => updateField('payment_method', e.target.value)} /></FormField>
                <FormField label="Internet Service">
                  <select className="input-base" value={form.internet_service} onChange={e => updateField('internet_service', e.target.value)}>
                    {['DSL','Fiber optic','No'].map(o => <option key={o}>{o}</option>)}
                  </select>
                </FormField>
                <FormField label="Tech Support">
                  <select className="input-base" value={form.tech_support} onChange={e => updateField('tech_support', e.target.value)}>
                    {['Yes','No'].map(o => <option key={o}>{o}</option>)}
                  </select>
                </FormField>
                <FormField label="Online Security">
                  <select className="input-base" value={form.online_security} onChange={e => updateField('online_security', e.target.value)}>
                    {['Yes','No'].map(o => <option key={o}>{o}</option>)}
                  </select>
                </FormField>
                <FormField label="Streaming Services">
                  <select className="input-base" value={form.streaming_services} onChange={e => updateField('streaming_services', e.target.value)}>
                    {['Yes','No'].map(o => <option key={o}>{o}</option>)}
                  </select>
                </FormField>
              </div>
              <button type="submit" disabled={saving} className="btn-primary">
                {saving ? 'Saving…' : 'Save Customer'}
              </button>
            </form>
          </div>
        )}

        {/* ── Search ── */}
        <div style={{ position: 'relative', marginBottom: '16px' }}>
          <Search size={16} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            id="customer-search"
            type="text"
            placeholder="Search by name or email…"
            value={search}
            onChange={e => { setSearch(e.target.value); setCurrentPage(1) }}
            className="input-base"
            style={{ paddingLeft: '40px' }}
          />
        </div>

        {/* ── Table ── */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#faf9ff' }}>
                  {[
                    { label: 'Name',         field: 'name' },
                    { label: 'Email',        field: 'email' },
                    { label: 'Subscription', field: 'subscription_type' },
                    { label: 'Contract',     field: 'contract_type' },
                    { label: 'Monthly',      field: 'monthly_charges' },
                  ].map(({ label, field }) => (
                    <SortHeader key={field} label={label} field={field} sortField={sortField} sortDir={sortDirection} onSort={handleSort} />
                  ))}
                  <th style={{ padding: '11px 18px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                  <th style={{ padding: '11px 18px', width: '56px' }} />
                </tr>
              </thead>
              <tbody>
                {paginated.map(c => (
                  <tr
                    key={c.id}
                    style={{ borderTop: '1px solid var(--border)', transition: 'background 150ms ease', cursor: 'default' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#faf9ff'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '13px 18px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</td>
                    <td style={{ padding: '13px 18px', fontSize: '13px', color: 'var(--text-secondary)' }}>{c.email}</td>
                    <td style={{ padding: '13px 18px', fontSize: '13px', color: 'var(--text-secondary)' }}>{c.subscription_type}</td>
                    <td style={{ padding: '13px 18px', fontSize: '13px', color: 'var(--text-secondary)' }}>{c.contract_type}</td>
                    <td style={{ padding: '13px 18px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>${c.monthly_charges}</td>
                    <td style={{ padding: '13px 18px' }}>
                      <span className={c.is_active ? 'badge badge-green' : 'badge'} style={!c.is_active ? { background: '#f3f4f6', color: '#9ca3af' } : {}}>
                        {c.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ padding: '13px 18px', textAlign: 'right' }}>
                      <button
                        onClick={() => handleDelete(c.id, c.name)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--text-muted)', padding: '4px', borderRadius: '6px',
                          transition: 'color 150ms ease, background 150ms ease',
                          display: 'flex', alignItems: 'center',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.color = '#e11d48'; e.currentTarget.style.background = '#fff1f2' }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'none' }}
                        title={`Delete ${c.name}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!loading && sorted.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)', fontSize: '14px' }}>
              No customers found.
            </div>
          )}

          {/* Pagination */}
          {sorted.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderTop: '1px solid var(--border)', background: '#faf9ff' }}>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Page {currentPage} of {totalPages} · {sorted.length} results
              </p>
              <div style={{ display: 'flex', gap: '6px' }}>
                <PageBtn disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} icon={<ChevronLeft size={14} />} />
                <PageBtn disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} icon={<ChevronRight size={14} />} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function FormField({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '5px' }}>{label}</label>
      {children}
    </div>
  )
}

function SortHeader({ label, field, sortField, sortDir, onSort }) {
  const active = sortField === field
  return (
    <th
      onClick={() => onSort(field)}
      style={{
        padding: '11px 18px', textAlign: 'left', fontSize: '11px',
        fontWeight: 600, color: active ? 'var(--purple-600)' : 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: '0.05em',
        cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
        transition: 'color 150ms ease',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
        {label}
        {active
          ? (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)
          : <ChevronDown size={12} style={{ opacity: 0.3 }} />}
      </span>
    </th>
  )
}

function PageBtn({ disabled, onClick, icon }) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: '1.5px solid var(--border)', borderRadius: '8px',
        background: 'var(--surface)', color: disabled ? 'var(--text-muted)' : 'var(--text-secondary)',
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
        transition: 'all 150ms ease',
      }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.borderColor = 'var(--purple-400)'; e.currentTarget.style.color = 'var(--purple-600)' } }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = disabled ? 'var(--text-muted)' : 'var(--text-secondary)' }}
    >
      {icon}
    </button>
  )
}

export default Customers