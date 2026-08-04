import { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import { apiRequest } from '../api/client'

function Customers() {
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadCustomers() {
      try {
        const data = await apiRequest('/customers/all')
        setCustomers(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    loadCustomers()
  }, [])

  return (
    <div className="min-h-screen bg-purple-50 flex gap-4 p-4">
      <Sidebar />

      <div className="flex-1">
        <h1 className="text-2xl font-bold text-gray-800 mb-1">Customers</h1>
        <p className="text-sm text-gray-400 mb-6">
          {loading ? 'Loading...' : `${customers.length} total`}
        </p>

        {error && (
          <div className="bg-rose-100 text-rose-700 text-sm rounded-xl px-3 py-2 mb-4">
            {error}
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-100">
                <th className="font-normal py-3 px-4">Name</th>
                <th className="font-normal py-3 px-4">Plan</th>
                <th className="font-normal py-3 px-4">Monthly charges</th>
                <th className="font-normal py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-b border-gray-50 last:border-0">
                  <td className="py-3 px-4 text-gray-800">{c.name}</td>
                  <td className="py-3 px-4 text-gray-500">{c.plan}</td>
                  <td className="py-3 px-4 text-gray-500">${c.monthly_charges}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`text-xs font-medium px-3 py-1 rounded-full ${
                        c.is_active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {c.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!loading && customers.length === 0 && (
            <p className="text-center text-gray-400 py-8 text-sm">
              No customers yet.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default Customers