import { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import toast from 'react-hot-toast'
import { getAllCustomers, createCustomer, deleteCustomer } from '../api/customers'

const initialForm = {
  name: '',
  email: '',
  phone: '',
  age: 30,
  gender: 'Female',
  location: '',
  subscription_type: 'Standard',
  monthly_charges: 50,
  total_charges: 600,
  tenure: 12,
  contract_type: 'Month-to-month',
  payment_method: 'Electronic check',
  internet_service: 'DSL',
  tech_support: 'No',
  online_security: 'No',
  streaming_services: 'No',
}

function Customers() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(initialForm)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [sortField, setSortField] = useState('name')
  const [sortDirection, setSortDirection] = useState('asc')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 8

  useEffect(() => {
    loadCustomers()
  }, [])

  async function loadCustomers() {
    setLoading(true)
    try {
      const data = await getAllCustomers()
      setCustomers(data)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  function updateField(field, value) {
    setForm({ ...form, [field]: value })
  }

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
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id, name) {
    if (!confirm(`Delete ${name}?`)) return
    try {
      await deleteCustomer(id)
      toast.success('Customer deleted')
      loadCustomers()
    } catch (err) {
      toast.error(err.message)
    }
  }

  function handleSort(field) {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
    setCurrentPage(1)
  }

  const filtered = customers.filter((c) =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  )

  const sorted = [...filtered].sort((a, b) => {
    const valA = a[sortField] ?? ''
    const valB = b[sortField] ?? ''
    if (typeof valA === 'number') {
      return sortDirection === 'asc' ? valA - valB : valB - valA
    }
    return sortDirection === 'asc'
      ? String(valA).localeCompare(String(valB))
      : String(valB).localeCompare(String(valA))
  })

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const paginated = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  return (
    <div className="min-h-screen bg-purple-50 flex gap-4 p-4">
      <Sidebar />

      <div className="flex-1">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 mb-1">Customers</h1>
            <p className="text-sm text-gray-400">
              {loading ? 'Loading...' : `${filtered.length} of ${customers.length} shown`}
            </p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors duration-100 ease-out"
          >
            {showForm ? 'Cancel' : '+ Add customer'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleAdd} className="bg-white rounded-2xl shadow-sm p-6 mb-6">
            <div className="grid grid-cols-3 gap-3 mb-4">
              <TextField label="Name" value={form.name} onChange={(v) => updateField('name', v)} required />
              <TextField label="Email" type="email" value={form.email} onChange={(v) => updateField('email', v)} required />
              <TextField label="Phone" value={form.phone} onChange={(v) => updateField('phone', v)} required />
              <TextField label="Age" type="number" value={form.age} onChange={(v) => updateField('age', v)} />
              <SelectField label="Gender" value={form.gender} onChange={(v) => updateField('gender', v)} options={['Male', 'Female']} />
              <TextField label="Location" value={form.location} onChange={(v) => updateField('location', v)} required />
              <TextField label="Subscription type" value={form.subscription_type} onChange={(v) => updateField('subscription_type', v)} />
              <TextField label="Monthly charges ($)" type="number" step="0.01" value={form.monthly_charges} onChange={(v) => updateField('monthly_charges', v)} />
              <TextField label="Total charges ($)" type="number" step="0.01" value={form.total_charges} onChange={(v) => updateField('total_charges', v)} />
              <TextField label="Tenure (months)" type="number" value={form.tenure} onChange={(v) => updateField('tenure', v)} />
              <SelectField label="Contract" value={form.contract_type} onChange={(v) => updateField('contract_type', v)} options={['Month-to-month', 'One year', 'Two year']} />
              <TextField label="Payment method" value={form.payment_method} onChange={(v) => updateField('payment_method', v)} />
              <SelectField label="Internet service" value={form.internet_service} onChange={(v) => updateField('internet_service', v)} options={['DSL', 'Fiber optic', 'No']} />
              <SelectField label="Tech support" value={form.tech_support} onChange={(v) => updateField('tech_support', v)} options={['Yes', 'No']} />
              <SelectField label="Online security" value={form.online_security} onChange={(v) => updateField('online_security', v)} options={['Yes', 'No']} />
              <SelectField label="Streaming services" value={form.streaming_services} onChange={(v) => updateField('streaming_services', v)} options={['Yes', 'No']} />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors duration-100 ease-out"
            >
              {saving ? 'Saving...' : 'Save customer'}
            </button>
          </form>
        )}

        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setCurrentPage(1)
          }}
          className="w-full mb-4 px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
        />

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-100">
                <SortableHeader label="Name" field="name" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                <SortableHeader label="Email" field="email" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                <SortableHeader label="Subscription" field="subscription_type" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                <SortableHeader label="Contract" field="contract_type" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                <SortableHeader label="Monthly" field="monthly_charges" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                <th className="font-normal py-3 px-4">Status</th>
                <th className="font-normal py-3 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((c) => (
                <tr key={c.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors duration-100">
                  <td className="py-3 px-4 text-gray-800">{c.name}</td>
                  <td className="py-3 px-4 text-gray-500">{c.email}</td>
                  <td className="py-3 px-4 text-gray-500">{c.subscription_type}</td>
                  <td className="py-3 px-4 text-gray-500">{c.contract_type}</td>
                  <td className="py-3 px-4 text-gray-500">${c.monthly_charges}</td>
                  <td className="py-3 px-4">
                    <span className={`text-xs font-medium px-3 py-1 rounded-full ${
                      c.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {c.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <button
                      onClick={() => handleDelete(c.id, c.name)}
                      className="text-rose-500 hover:text-rose-700 text-xs transition-colors duration-100"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!loading && sorted.length === 0 && (
            <p className="text-center text-gray-400 py-8 text-sm">No customers found.</p>
          )}

          {sorted.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <p className="text-xs text-gray-400">
                Page {currentPage} of {totalPages}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="text-xs px-3 py-1 rounded-lg bg-gray-50 text-gray-600 disabled:opacity-40 hover:bg-gray-100 transition-colors duration-100"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="text-xs px-3 py-1 rounded-lg bg-gray-50 text-gray-600 disabled:opacity-40 hover:bg-gray-100 transition-colors duration-100"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TextField({ label, ...props }) {
  return (
    <div>
      <label className="text-xs text-gray-500">{label}</label>
      <input {...props} onChange={(e) => props.onChange(e.target.value)}
        className="w-full mt-1 px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-sm" />
    </div>
  )
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div>
      <label className="text-xs text-gray-500">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full mt-1 px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-sm">
        {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </div>
  )
}

function SortableHeader({ label, field, sortField, sortDirection, onSort }) {
  const active = sortField === field
  return (
    <th
      onClick={() => onSort(field)}
      className="font-normal py-3 px-4 cursor-pointer select-none hover:text-gray-600 transition-colors duration-100"
    >
      {label} {active && (sortDirection === 'asc' ? '↑' : '↓')}
    </th>
  )
}

export default Customers