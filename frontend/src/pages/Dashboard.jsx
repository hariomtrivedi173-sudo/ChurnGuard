import { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import StatCard from '../components/StatCard'
import { getDashboardStats, runBatchAnalysis } from '../api/dashboard'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  AreaChart, Area,
} from 'recharts'
import { Users, AlertTriangle, TrendingDown, CheckCircle, Play, RefreshCw } from 'lucide-react'

const RISK_COLORS = { High: '#e11d48', Medium: '#d97706', Low: '#16a34a' }

function Dashboard() {
  const [stats,     setStats]     = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [error,     setError]     = useState('')

  useEffect(() => { loadStats() }, [])

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

  const riskBadgeStyle = {
    High:   { background: '#fff1f2', color: '#e11d48' },
    Medium: { background: '#fffbeb', color: '#d97706' },
    Low:    { background: '#f0fdf4', color: '#16a34a' },
  }

  return (
    <div className="page-layout">
      <Sidebar />
      <div className="page-content">

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
              Customer Overview
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              {stats
                ? `${stats.total_analyzed.toLocaleString()} customers analyzed · last run`
                : 'No analysis run yet — click Run Analysis to score all customers'}
            </p>
          </div>
          <button
            id="run-analysis-btn"
            onClick={handleRunAnalysis}
            disabled={analyzing}
            className="btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '7px' }}
          >
            {analyzing
              ? <><RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> Analyzing…</>
              : <><Play size={14} /> Run Analysis</>}
          </button>
        </div>

        {error && (
          <div style={{
            background: '#fff1f2', border: '1px solid #fecdd3', color: '#e11d48',
            fontSize: '13px', padding: '10px 14px', borderRadius: '10px', marginBottom: '20px',
          }}>{error}</div>
        )}

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)', fontSize: '14px', padding: '40px 0' }}>
            <div style={{
              width: '18px', height: '18px',
              border: '2px solid #c4b5fd', borderTopColor: 'transparent',
              borderRadius: '50%', animation: 'spin 0.8s linear infinite',
            }} />
            Loading dashboard…
          </div>
        )}

        {!loading && !stats && (
          <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
            <Play size={36} color="#c4b5fd" style={{ margin: '0 auto 16px' }} />
            <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>No analysis data yet</p>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Click <strong>Run Analysis</strong> above to score all 7,043 customers.
            </p>
          </div>
        )}

        {stats && (
          <>
            {/* ── Stat Cards ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
              <StatCard label="Total Customers"  value={stats.total_analyzed.toLocaleString()} icon={Users}          color="purple" />
              <StatCard label="High Risk"        value={stats.high_risk_count.toLocaleString()} icon={AlertTriangle}  color="rose"   />
              <StatCard label="Medium Risk"      value={stats.medium_risk_count.toLocaleString()} icon={TrendingDown} color="amber"  />
              <StatCard label="Low Risk"         value={stats.low_risk_count.toLocaleString()} icon={CheckCircle}    color="green"  />
            </div>

            {/* ── Charts Row ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>

              {/* Pie chart */}
              <div className="card" style={{ padding: '22px' }}>
                <p style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', marginBottom: '2px' }}>Risk Distribution</p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>Proportion of churn risk levels</p>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'High',   value: stats.high_risk_count,   color: '#e11d48' },
                        { name: 'Medium', value: stats.medium_risk_count, color: '#d97706' },
                        { name: 'Low',    value: stats.low_risk_count,    color: '#16a34a' },
                      ]}
                      dataKey="value" nameKey="name"
                      cx="50%" cy="50%"
                      innerRadius={58} outerRadius={88}
                      paddingAngle={3}
                    >
                      {[{ color: '#e11d48' }, { color: '#d97706' }, { color: '#16a34a' }].map((e, i) => (
                        <Cell key={i} fill={e.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid #e8e4f8', fontSize: '13px' }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Bar chart */}
              <div className="card" style={{ padding: '22px' }}>
                <p style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', marginBottom: '2px' }}>Risk by Contract Type</p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>Stacked risk breakdown per contract</p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={stats.risk_by_contract} barSize={36}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0edfb" vertical={false} />
                    <XAxis dataKey="contract" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid #e8e4f8', fontSize: '13px' }} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
                    <Bar dataKey="High"   stackId="a" fill="#e11d48" />
                    <Bar dataKey="Medium" stackId="a" fill="#f59e0b" />
                    <Bar dataKey="Low"    stackId="a" fill="#22c55e" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Area chart */}
            <div className="card" style={{ padding: '22px', marginBottom: '24px' }}>
              <p style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)', marginBottom: '2px' }}>Risk by Tenure</p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>Customer risk distribution across tenure buckets</p>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={stats.risk_by_tenure}>
                  <defs>
                    <linearGradient id="highGrad"   x1="0" y1="0" x2="0" y2="1"><stop offset="5%"  stopColor="#e11d48" stopOpacity={0.25}/><stop offset="95%" stopColor="#e11d48" stopOpacity={0.02}/></linearGradient>
                    <linearGradient id="medGrad"    x1="0" y1="0" x2="0" y2="1"><stop offset="5%"  stopColor="#d97706" stopOpacity={0.25}/><stop offset="95%" stopColor="#d97706" stopOpacity={0.02}/></linearGradient>
                    <linearGradient id="lowGrad"    x1="0" y1="0" x2="0" y2="1"><stop offset="5%"  stopColor="#16a34a" stopOpacity={0.25}/><stop offset="95%" stopColor="#16a34a" stopOpacity={0.02}/></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0edfb" vertical={false} />
                  <XAxis dataKey="bucket" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid #e8e4f8', fontSize: '13px' }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px' }} />
                  <Area type="monotone" dataKey="High"   stackId="1" stroke="#e11d48" fill="url(#highGrad)" strokeWidth={2} />
                  <Area type="monotone" dataKey="Medium" stackId="1" stroke="#d97706" fill="url(#medGrad)"  strokeWidth={2} />
                  <Area type="monotone" dataKey="Low"    stackId="1" stroke="#16a34a" fill="url(#lowGrad)"  strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* ── Top customers table ── */}
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)' }}>
                <p style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>Highest-Priority Customers</p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Top 10 by churn probability</p>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#faf9ff' }}>
                    {['Customer ID', 'Risk Level', 'Churn Probability'].map(h => (
                      <th key={h} style={{ padding: '10px 22px', textAlign: 'left', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.results.map((r) => (
                    <tr key={r.customerID} style={{ borderTop: '1px solid var(--border)', transition: 'background 150ms ease' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#faf9ff'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <td style={{ padding: '12px 22px', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'monospace' }}>{r.customerID}</td>
                      <td style={{ padding: '12px 22px' }}>
                        <span style={{ ...riskBadgeStyle[r.risk_level], padding: '3px 10px', borderRadius: '99px', fontSize: '12px', fontWeight: 600 }}>
                          {r.risk_level}
                        </span>
                      </td>
                      <td style={{ padding: '12px 22px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ flex: 1, height: '6px', background: '#f0edfb', borderRadius: '99px', maxWidth: '100px' }}>
                            <div style={{ height: '100%', width: `${r.churn_probability}%`, background: RISK_COLORS[r.risk_level], borderRadius: '99px' }} />
                          </div>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: RISK_COLORS[r.risk_level], minWidth: '42px' }}>{r.churn_probability}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Spin keyframe */}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )
}

export default Dashboard