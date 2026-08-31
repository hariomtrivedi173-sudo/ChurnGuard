import { useState, useEffect, useCallback } from 'react'
import Sidebar from '../components/Sidebar'
import Header from '../components/Header'
import { getDashboardStats, runBatchAnalysis } from '../api/dashboard'
import { getMLMetrics } from '../api/metrics'
import { getUploadHistory } from '../api/dataset'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer
} from 'recharts'
import {
  Users, UserCheck, AlertTriangle, TrendingUp,
  ShieldAlert, ShieldCheck, DollarSign, Target, Activity, Sparkles,
  ChevronRight, Zap, UploadCloud, Clock, RefreshCw, BarChart2
} from 'lucide-react'

const AVATAR_COLORS = ['#7c3aed', '#6b7280', '#16a34a', '#ea580c', '#8b5cf6', '#2563eb', '#d97706', '#059669']

function formatCurrency(val) {
  if (!val && val !== 0) return '—'
  if (val >= 10_000_000) return `₹${(val / 10_000_000).toFixed(1)}Cr`
  if (val >= 100_000)    return `₹${(val / 100_000).toFixed(1)}L`
  if (val >= 1_000)      return `₹${(val / 1_000).toFixed(1)}K`
  return `₹${Math.round(val).toLocaleString('en-IN')}`
}

function timeAgo(isoString) {
  if (!isoString) return ''
  const diff = (Date.now() - new Date(isoString).getTime()) / 1000
  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`
  return `${Math.floor(diff / 86400)} days ago`
}

function Dashboard() {
  const [stats,         setStats]         = useState(null)
  const [mlMetrics,     setMlMetrics]     = useState(null)
  const [uploadHistory, setHistory]       = useState([])
  const [loading,       setLoading]       = useState(true)
  const [analyzing,     setAnalyzing]     = useState(false)
  const [error,         setError]         = useState('')
  const navigate = useNavigate()

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [data, metrics, hist] = await Promise.allSettled([
        getDashboardStats(),
        getMLMetrics(),
        getUploadHistory(6),
      ])
      if (data.status === 'fulfilled' && data.value?.available) setStats(data.value)
      if (metrics.status === 'fulfilled') setMlMetrics(metrics.value)
      if (hist.status === 'fulfilled' && Array.isArray(hist.value)) setHistory(hist.value)

      if (data.status === 'rejected') {
        setError(`Failed to load dashboard: ${data.reason?.message || 'Unknown error'}`)
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  async function handleRunAnalysis() {
    setAnalyzing(true)
    try {
      toast.loading('Running batch analysis…', { id: 'batch' })
      await runBatchAnalysis()
      toast.success('Analysis complete! Dashboard updated.', { id: 'batch' })
      await loadAll()
    } catch (err) {
      toast.error(`Analysis failed: ${err.message}`, { id: 'batch' })
    } finally {
      setAnalyzing(false)
    }
  }

  // ── Derived stats ──
  const hasData      = !!stats && stats.total_analyzed > 0
  const total        = stats?.total_analyzed ?? 0
  const high         = stats?.high_risk_count ?? 0
  const med          = stats?.medium_risk_count ?? 0
  const low          = stats?.low_risk_count ?? 0
  const activeCount  = total > 0 ? (total - high) : 0
  const churnRatePct = stats?.avg_churn_rate ?? 0
  const mrrTotal     = formatCurrency(stats?.total_mrr ?? 0)

  // Risk donut — computed from live counts
  const lowPct  = total > 0 ? Math.round((low  / total) * 100) : 0
  const medPct  = total > 0 ? Math.round((med  / total) * 100) : 0
  const highPct = total > 0 ? (100 - lowPct - medPct)         : 0

  const riskDonutData = [
    { name: 'Low Risk',    value: lowPct,  color: '#22c55e' },
    { name: 'Medium Risk', value: medPct,  color: '#d97706' },
    { name: 'High Risk',   value: highPct, color: '#e11d48' },
  ]

  // Plan distribution — real backend data
  const planTierData = stats?.plan_distribution ?? []

  // Highest-risk customers — real ML results
  const highRiskRows = (stats?.results ?? []).slice(0, 5).map((r, i) => ({
    id:          r.customerID || i,
    name:        r.customerID || `Customer #${i + 1}`,
    company:     r.Contract ? `${r.Contract} Plan` : 'Telco Account',
    probability: Math.round(r.churn_probability ?? 0),
    barPct:      Math.min(100, Math.round(r.churn_probability ?? 0)),
    color:       AVATAR_COLORS[i % AVATAR_COLORS.length],
  }))

  // ML metrics — from real /ml/metrics API
  const accuracyPct   = mlMetrics?.accuracy ? (mlMetrics.accuracy * 100).toFixed(1)   : null
  const aucPct        = mlMetrics?.auc       ? (mlMetrics.auc       * 100).toFixed(1)  : null
  const hasMetrics    = accuracyPct !== null && parseFloat(accuracyPct) > 0

  // SVG ring for accuracy (dashoffset = circumference * (1 - pct/100))
  const CIRC       = 251.2
  const dashOffset = hasMetrics ? CIRC * (1 - parseFloat(accuracyPct) / 100) : CIRC

  // Recent activity from upload history
  const activityItems = uploadHistory.map(u => ({
    title: `Dataset uploaded: ${u.filename}`,
    sub:   `${u.inserted_rows?.toLocaleString() ?? 0} new records · ${u.duplicate_rows ?? 0} duplicates skipped · Total: ${u.final_total?.toLocaleString() ?? '—'}`,
    time:  timeAgo(u.uploaded_at),
    icon:  UploadCloud,
  }))

  return (
    <div className="page-layout">
      <Sidebar />
      <div className="page-content" style={{ padding: '24px 32px' }}>

        {/* ── Header row ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <Header title="Dashboard" subtitle="Live churn intelligence overview." />
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <button
              onClick={loadAll}
              disabled={loading}
              title="Refresh data"
              style={{ background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: loading ? 'not-allowed' : 'pointer', borderRadius: '10px', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', opacity: loading ? 0.5 : 1 }}
            >
              <RefreshCw size={14} style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }} />
              Refresh
            </button>
            <button
              onClick={handleRunAnalysis}
              disabled={analyzing || !hasData}
              className="btn-primary"
              style={{ padding: '9px 18px', fontSize: '13px', whiteSpace: 'nowrap', opacity: (!hasData) ? 0.5 : 1 }}
              title={!hasData ? 'Upload a dataset first' : 'Run ML predictions on all customers'}
            >
              {analyzing
                ? <><div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Analyzing…</>
                : <><Zap size={15} /> Run Analysis</>}
            </button>
          </div>
        </div>

        {/* ── Error banner ── */}
        {error && !loading && (
          <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', color: '#e11d48', fontSize: '13px', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{error}</span>
            <button onClick={loadAll} style={{ background: 'none', border: 'none', color: '#e11d48', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}>Retry</button>
          </div>
        )}

        {/* ── Loading indicator ── */}
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', color: 'var(--text-muted)', fontSize: '13px' }}>
            <div style={{ width: '16px', height: '16px', border: '2px solid var(--purple-200)', borderTopColor: 'var(--purple-600)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            Loading live data…
          </div>
        )}

        {/* ── No dataset notice ── */}
        {!loading && !hasData && !error && (
          <div style={{ background: 'rgba(124, 58, 237, 0.06)', border: '1px solid var(--border)', borderRadius: '14px', padding: '20px 24px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <BarChart2 size={24} color="var(--purple-600)" />
            <div>
              <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>No analysis data yet</p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Upload a customer CSV dataset first, then click <strong>Run Analysis</strong> to generate churn predictions.
              </p>
            </div>
            <button onClick={() => navigate('/upload')} className="btn-primary" style={{ padding: '8px 16px', fontSize: '13px', marginLeft: 'auto', flexShrink: 0 }}>
              <UploadCloud size={14} /> Upload Dataset
            </button>
          </div>
        )}

        {/* ── Stat Cards Row 1 ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '16px' }}>

          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>Total Customers</p>
                <p style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                  {loading ? '—' : total.toLocaleString()}
                </p>
              </div>
              <div style={{ width: '40px', height: '40px', background: 'var(--purple-50)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users size={20} color="var(--purple-600)" />
              </div>
            </div>
            <div style={{ marginTop: '14px', fontSize: '11px', color: 'var(--text-muted)' }}>
              {hasData ? 'From uploaded dataset' : 'No dataset uploaded'}
            </div>
          </div>

          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>Active Customers</p>
                <p style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                  {loading ? '—' : activeCount.toLocaleString()}
                </p>
              </div>
              <div style={{ width: '40px', height: '40px', background: 'rgba(34, 197, 94, 0.12)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <UserCheck size={20} color="#16a34a" />
              </div>
            </div>
            <div style={{ marginTop: '14px', fontSize: '11px', color: 'var(--text-muted)' }}>
              {hasData ? `${total.toLocaleString()} total − ${high.toLocaleString()} high risk` : 'No active customers'}
            </div>
          </div>

          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>High Risk</p>
                <p style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                  {loading ? '—' : high.toLocaleString()}
                </p>
              </div>
              <div style={{ width: '40px', height: '40px', background: 'rgba(225, 29, 72, 0.12)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={20} color="#e11d48" />
              </div>
            </div>
            <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: hasData ? '#e11d48' : 'var(--text-muted)', fontWeight: 600 }}>
              {hasData ? <span>{highPct}% of all customers</span> : <span>0% of all customers</span>}
            </div>
          </div>

          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>Churn Rate</p>
                <p style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                  {loading ? '—' : `${churnRatePct}%`}
                </p>
              </div>
              <div style={{ width: '40px', height: '40px', background: 'rgba(217, 119, 6, 0.12)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TrendingUp size={20} color="#d97706" />
              </div>
            </div>
            <div style={{ marginTop: '14px', fontSize: '11px', color: 'var(--text-muted)' }}>
              {hasData ? 'Predicted churn probability avg' : '0% churn rate'}
            </div>
          </div>

        </div>

        {/* ── Stat Cards Row 2 ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>

          <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '38px', height: '38px', background: 'rgba(217, 119, 6, 0.12)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldAlert size={18} color="#d97706" />
            </div>
            <div>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Medium Risk</p>
              <p style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
                {loading ? '—' : med.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '38px', height: '38px', background: 'rgba(34, 197, 94, 0.12)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={18} color="#16a34a" />
            </div>
            <div>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Low Risk</p>
              <p style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
                {loading ? '—' : low.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '38px', height: '38px', background: 'var(--purple-50)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DollarSign size={18} color="var(--purple-600)" />
            </div>
            <div>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Revenue (MRR)</p>
              <p style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
                {loading ? '—' : mrrTotal}
              </p>
            </div>
          </div>

          {/* Prediction Accuracy — from real /ml/metrics API */}
          <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '38px', height: '38px', background: 'var(--purple-50)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Target size={18} color="var(--purple-600)" />
            </div>
            <div>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Model Accuracy</p>
              <p style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
                {loading ? '—' : hasMetrics ? `${accuracyPct}%` : 'N/A'}
              </p>
            </div>
          </div>

        </div>

        {/* ── Charts Row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>

          {/* Risk Distribution Donut */}
          <div className="card" style={{ padding: '22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Risk Distribution</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Customers by risk band</p>
            </div>

            {!hasData ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center' }}>
                <Activity size={32} style={{ opacity: 0.25, marginBottom: '10px' }} />
                <p>Run analysis to see risk distribution</p>
              </div>
            ) : (
              <>
                <div style={{ position: 'relative', height: '160px', margin: '8px 0' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={riskDonutData} cx="50%" cy="50%" innerRadius={48} outerRadius={68} paddingAngle={3} dataKey="value">
                        {riskDonutData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', fontSize: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {riskDonutData.map(item => (
                    <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color }} />
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{item.name}</span>
                      </div>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{`${item.value}%`}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Plan Distribution */}
          <div className="card" style={{ padding: '22px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Plan Distribution</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px' }}>Customers by contract type</p>

            {planTierData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie data={planTierData} cx="50%" cy="50%" outerRadius={52} dataKey="value">
                      {planTierData.map((e, i) => (
                        <Cell key={i} fill={e.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name, props) => [`${props.payload.pct}% (${value.toLocaleString()})`, name]}
                      contentStyle={{ borderRadius: '10px', background: 'var(--surface)', color: 'var(--text-primary)', fontSize: '11px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px' }}>
                  {planTierData.map(p => (
                    <div key={p.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                        <span style={{ color: 'var(--text-secondary)' }}>{p.name}</span>
                      </div>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{p.pct}%</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div style={{ height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '12px', flexDirection: 'column', gap: '8px' }}>
                <BarChart2 size={28} style={{ opacity: 0.25 }} />
                <p>No plan data — run analysis first</p>
              </div>
            )}
          </div>

        </div>

        {/* ── Model Accuracy + MRR Cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>

          {/* MRR stat card */}
          <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', alignSelf: 'flex-start' }}>Monthly Revenue (MRR)</h3>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', alignSelf: 'flex-start', marginBottom: '20px' }}>Total charges from dataset</p>
            <p style={{ fontSize: '36px', fontWeight: 800, color: '#16a34a', lineHeight: 1 }}>{hasData ? mrrTotal : '—'}</p>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
              {hasData ? `From ${total.toLocaleString()} customers` : 'No data'}
            </p>
          </div>

          {/* Prediction Accuracy — real /ml/metrics, SVG ring */}
          <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', alignSelf: 'flex-start' }}>Model Accuracy</h3>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', alignSelf: 'flex-start', marginBottom: '10px' }}>
              {hasMetrics ? 'From /ml/metrics API' : 'Run analysis to compute'}
            </p>

            <div style={{ position: 'relative', width: '110px', height: '110px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="110" height="110" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" stroke="var(--border)" strokeWidth="10" fill="none" />
                <circle
                  cx="50" cy="50" r="40"
                  stroke={hasMetrics ? 'var(--purple-600)' : 'var(--border)'}
                  strokeWidth="10" fill="none"
                  strokeDasharray={CIRC}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="round"
                  transform="rotate(-90 50 50)"
                />
              </svg>
              <div style={{ position: 'absolute', textAlign: 'center' }}>
                <p style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                  {loading ? '…' : hasMetrics ? `${accuracyPct}%` : 'N/A'}
                </p>
                <p style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px' }}>Accuracy</p>
              </div>
            </div>

            {hasMetrics && aucPct && (
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>AUC: {aucPct}%</p>
            )}
          </div>

          {/* F1 / Precision / Recall quick stats */}
          <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>Model Metrics</h3>
            {hasMetrics ? (
              <>
                {[
                  { label: 'Precision', val: mlMetrics?.precision },
                  { label: 'Recall',    val: mlMetrics?.recall    },
                  { label: 'F1 Score',  val: mlMetrics?.f1_score  },
                ].map(({ label, val }) => (
                  <div key={label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                        {val != null ? `${(val * 100).toFixed(1)}%` : '—'}
                      </span>
                    </div>
                    <div style={{ height: '4px', background: 'var(--border)', borderRadius: '99px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${val != null ? (val * 100).toFixed(0) : 0}%`, background: 'var(--purple-600)', borderRadius: '99px' }} />
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', padding: '16px 0' }}>
                <p>No model evaluation data available.</p>
                <p style={{ marginTop: '4px' }}>Run analysis to compute metrics.</p>
              </div>
            )}
          </div>

        </div>

        {/* ── Bottom Section: High Risk Customers & Recent Activity ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '20px' }}>

          <div className="card" style={{ padding: '22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Highest Risk Customers</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Sorted by ML churn probability</p>
              </div>
              <button
                onClick={() => navigate('/customers')}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
              >
                View all <ChevronRight size={14} />
              </button>
            </div>

            {!hasData || highRiskRows.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
                {hasData
                  ? 'No prediction results yet — click Run Analysis to generate risk scores'
                  : 'Upload a dataset to see high-risk customers'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {highRiskRows.map(item => (
                  <div
                    key={item.id}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: '12px', background: 'var(--surface-hover)', transition: 'background 150ms ease' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: item.color, color: '#fff', fontWeight: 700, fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {String(item?.name || 'CU').split('').slice(0, 2).join('').toUpperCase()}
                      </div>
                      <div>
                        <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{item.name}</p>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.company}</p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '180px' }}>
                      <div style={{ flex: 1, height: '6px', background: 'var(--border)', borderRadius: '99px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${item.barPct}%`, background: '#e11d48', borderRadius: '99px' }} />
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', width: '38px', textAlign: 'right' }}>
                        {item.probability}%
                      </span>
                    </div>

                    <div style={{ marginLeft: '16px' }}>
                      <span className="badge badge-red" style={{ fontSize: '11px' }}>● High Risk</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card" style={{ padding: '22px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>Recent Activity</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>Latest dataset uploads</p>

            {activityItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: '12px' }}>
                <Clock size={24} style={{ marginBottom: '8px', opacity: 0.4 }} />
                <p>No uploads yet</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '10px', bottom: '10px', left: '13px', width: '2px', background: 'var(--border)' }} />
                {activityItems.map((item, idx) => {
                  const Icon = item.icon
                  return (
                    <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', position: 'relative', zIndex: 1 }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--purple-50)', border: '2px solid var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon size={13} color="var(--purple-600)" />
                      </div>
                      <div>
                        <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>{item.title}</p>
                        <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: 1.3 }}>{item.sub}</p>
                        <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>{item.time}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </div>

        {/* ── AI Insight Banner ── */}
        {hasData && (
          <div style={{ background: 'var(--purple-50)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(124, 58, 237, 0.25)', flexShrink: 0 }}>
                <Sparkles size={20} color="#fff" />
              </div>
              <div>
                <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  AI Insight · {high.toLocaleString()} high-risk customers need attention
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Proactive outreach on these accounts could recover an estimated {mrrTotal} MRR. Open the Predictions page to see recommendations.
                </p>
              </div>
            </div>

            <button
              onClick={() => navigate('/predict')}
              className="btn-primary"
              style={{ padding: '9px 18px', fontSize: '13px', whiteSpace: 'nowrap' }}
            >
              <Zap size={15} /> View Predictions
            </button>
          </div>
        )}

      </div>
    </div>
  )
}

export default Dashboard