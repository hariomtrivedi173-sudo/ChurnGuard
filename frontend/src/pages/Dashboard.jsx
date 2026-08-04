import { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import StatCard from '../components/StatCard'
import { getDashboardStats, runBatchAnalysis } from '../api/dashboard'

function Dashboard() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    setLoading(true)
    try {
      const data = await getDashboardStats()
      setStats(data.available ? data : null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleRunAnalysis() {
    setAnalyzing(true)
    setError('')
    try {
      const data = await runBatchAnalysis()
      setStats(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setAnalyzing(false)
    }
  }

  const riskBadge = {
    High: 'bg-rose-100 text-rose-700',
    Medium: 'bg-amber-100 text-amber-700',
    Low: 'bg-green-100 text-green-700',
  }

  return (
    <div className="min-h-screen bg-purple-50 flex gap-4 p-4">
      <Sidebar />

      <div className="flex-1">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 mb-1">Customer overview</h1>
            <p className="text-sm text-gray-400">
              {stats ? `${stats.total_analyzed} customers analyzed` : 'No analysis run yet'}
            </p>
          </div>
          <button
            onClick={handleRunAnalysis}
            disabled={analyzing}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-200 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors duration-100 ease-out"
          >
            {analyzing ? 'Analyzing all customers...' : 'Run analysis'}
          </button>
        </div>

        {error && <div className="bg-rose-100 text-rose-700 text-sm rounded-xl px-3 py-2 mb-4">{error}</div>}

        {loading && <p className="text-sm text-gray-400">Loading...</p>}

        {!loading && !stats && (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
            <p className="text-gray-500 text-sm">
              No churn analysis has been run yet. Click "Run analysis" to score all customers.
            </p>
          </div>
        )}

        {stats && (
          <>
            <div className="grid grid-cols-4 gap-4 mb-6">
              <StatCard label="Total customers" value={stats.total_analyzed} color="purple" />
              <StatCard label="High risk" value={stats.high_risk_count} color="rose" />
              <StatCard label="Medium risk" value={stats.medium_risk_count} color="amber" />
              <StatCard label="Low risk" value={stats.low_risk_count} color="green" />
            </div>

            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-gray-800">Highest-priority customers</h2>
            </div>

            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 border-b border-gray-100">
                    <th className="font-normal py-3 px-4">Customer ID</th>
                    <th className="font-normal py-3 px-4">Risk</th>
                    <th className="font-normal py-3 px-4">Probability</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.results.map((r) => (
                    <tr key={r.customerID} className="border-b border-gray-50 last:border-0">
                      <td className="py-3 px-4 text-gray-800">{r.customerID}</td>
                      <td className="py-3 px-4">
                        <span className={`text-xs font-medium px-3 py-1 rounded-full ${riskBadge[r.risk_level]}`}>
                          {r.risk_level}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600">{r.churn_probability}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default Dashboard