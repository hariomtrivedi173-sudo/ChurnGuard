import { useState, useEffect, useCallback } from 'react'
import Sidebar from '../components/Sidebar'
import Header from '../components/Header'
import {
  BarChart, Bar, PieChart, Pie, Cell, Tooltip,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid
} from 'recharts'
import { TrendingDown, TrendingUp, DollarSign, Users, BarChart2, AlertCircle } from 'lucide-react'
import { getDashboardStats } from '../api/dashboard'
import { getMLMetrics } from '../api/metrics'
import toast from 'react-hot-toast'

function formatCurrency(val) {
  if (!val && val !== 0) return '—'
  if (val >= 10_000_000) return `₹${(val / 10_000_000).toFixed(1)}Cr`
  if (val >= 100_000)    return `₹${(val / 100_000).toFixed(1)}L`
  if (val >= 1_000)      return `₹${(val / 1_000).toFixed(1)}K`
  return `₹${Math.round(val).toLocaleString('en-IN')}`
}

function Analytics() {
  const [activeTab, setActiveTab] = useState('Overview')
  const [stats,     setStats]     = useState(null)
  const [metrics,   setMetrics]   = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [statsRes, metricsRes] = await Promise.allSettled([
        getDashboardStats(),
        getMLMetrics(),
      ])
      if (statsRes.status === 'fulfilled' && statsRes.value?.available) setStats(statsRes.value)
      else setStats(null)
      if (metricsRes.status === 'fulfilled') setMetrics(metricsRes.value)
    } catch (err) {
      setError(err.message)
      toast.error(`Failed to load analytics: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const hasData    = !!stats && stats.total_analyzed > 0
  const hasMetrics = !!metrics && metrics.accuracy > 0

  // Derived real values
  const churnRate   = stats ? (hasData ? `${stats.avg_churn_rate}%` : '0%') : '—'
  const retainRate  = stats ? (hasData ? `${(100 - stats.avg_churn_rate).toFixed(1)}%` : '0%') : '—'
  const total       = stats?.total_analyzed ?? 0
  const high        = stats?.high_risk_count ?? 0
  const totalMrrRaw = stats?.total_mrr ?? 0
  const totalMrrStr = stats ? (hasData ? formatCurrency(totalMrrRaw) : '₹0') : '—'
  const atRiskMrrRaw = hasData ? (totalMrrRaw * (high / (total || 1))) : 0
  const atRiskMrrStr = stats ? (hasData ? formatCurrency(atRiskMrrRaw) : '₹0') : '—'
  const segCount    = stats ? (hasData ? stats.plan_distribution?.length ?? 0 : 0) : '—'

  // Plan distribution chart data (real from backend)
  const planData = stats?.plan_distribution ?? []

  // Risk breakdown bar data (real from backend)
  const riskBarData = hasData
    ? [
        { name: 'High',   count: stats.high_risk_count,   fill: '#EF4444' },
        { name: 'Medium', count: stats.medium_risk_count, fill: '#F59E0B' },
        { name: 'Low',    count: stats.low_risk_count,    fill: '#10B981' },
      ]
    : []

  // Feature importance from /ml/metrics
  const featureImportance = metrics?.feature_importance ?? []
  const topFeatures       = featureImportance.slice(0, 8)

  // ML metrics bars
  const metricBars = hasMetrics
    ? [
        { label: 'Accuracy',  val: metrics.accuracy  },
        { label: 'Precision', val: metrics.precision  },
        { label: 'Recall',    val: metrics.recall     },
        { label: 'F1 Score',  val: metrics.f1_score   },
        { label: 'AUC',       val: metrics.auc        },
      ]
    : []

  // ── Empty / Loading states ──
  function EmptyState({ message, sub }) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', color: 'var(--text-muted)', textAlign: 'center' }}>
        <BarChart2 size={36} style={{ opacity: 0.2, marginBottom: '12px' }} />
        <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>{message}</p>
        {sub && <p style={{ fontSize: '12px', lineHeight: 1.6, maxWidth: '360px' }}>{sub}</p>}
      </div>
    )
  }

  return (
    <div className="page-layout">
      <Sidebar />
      <div className="page-content" style={{ padding: '24px 32px' }}>

        {/* ── Top Navbar ── */}
        <Header
          title="Analytics"
          subtitle="Churn intelligence and segment analysis from your real data."
          onRefresh={loadAll}
          isRefreshing={loading}
        />

        {/* Error */}
        {error && !loading && (
          <div style={{ background: 'rgba(248, 113, 113, 0.12)', border: '1px solid rgba(248, 113, 113, 0.25)', color: 'var(--danger)', fontSize: '13px', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{error}</span>
            <button onClick={loadAll} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}>Retry</button>
          </div>
        )}

        {/* ── Top 5 Metric Cards ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>

          <div className="card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{loading ? '—' : churnRate}</p>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '6px' }}>Avg Churn Rate</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
              <div style={{ width: '36px', height: '36px', background: 'rgba(248, 113, 113, 0.12)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TrendingDown size={18} color="var(--danger)" />
              </div>
              <span className="badge badge-green" style={{ fontSize: '10px' }}>{hasData ? 'Live' : '0%'}</span>
            </div>
          </div>

          <div className="card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{loading ? '—' : retainRate}</p>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '6px' }}>Retention Rate</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
              <div style={{ width: '36px', height: '36px', background: 'rgba(52, 211, 153, 0.12)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TrendingUp size={18} color="var(--success)" />
              </div>
              <span className="badge badge-green" style={{ fontSize: '10px' }}>{hasData ? 'Live' : '0%'}</span>
            </div>
          </div>

          <div className="card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                {loading ? '—' : totalMrrStr}
              </p>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '6px' }}>Total MRR</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
              <div style={{ width: '36px', height: '36px', background: 'var(--purple-50)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DollarSign size={18} color="var(--purple-600)" />
              </div>
              <span className="badge badge-purple" style={{ fontSize: '10px' }}>{hasData ? 'Live' : '₹0'}</span>
            </div>
          </div>

          <div className="card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: '24px', fontWeight: 800, color: 'var(--danger)', lineHeight: 1 }}>
                {loading ? '—' : atRiskMrrStr}
              </p>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '6px' }}>At-Risk MRR</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
              <div style={{ width: '36px', height: '36px', background: 'rgba(217, 119, 6, 0.12)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DollarSign size={18} color="#d97706" />
              </div>
              <span className="badge badge-amber" style={{ fontSize: '10px' }}>{hasData ? 'Live' : '₹0'}</span>
            </div>
          </div>

          <div className="card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{loading ? '—' : segCount}</p>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '6px' }}>Contract Types</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
              <div style={{ width: '36px', height: '36px', background: 'var(--purple-50)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users size={18} color="var(--purple-600)" />
              </div>
              <span className="badge badge-green" style={{ fontSize: '10px' }}>{hasData ? 'Live' : '0'}</span>
            </div>
          </div>

        </div>


        {/* ── Tab Bar ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '8px', background: 'var(--surface)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border)' }}>
            {['Overview', 'Risk Breakdown', 'Model Performance', 'Trend Analysis'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`tab-pill ${activeTab === tab ? 'active' : ''}`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab 1: Overview — Plan distribution + Top risk customers ── */}
        {activeTab === 'Overview' && (
          <div className="analytics-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

            <div className="card" style={{ padding: '22px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Contract Distribution</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>Customers by contract type (real data)</p>
              {loading ? (
                <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: '20px', height: '20px', border: '2px solid var(--purple-200)', borderTopColor: 'var(--purple-600)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                </div>
              ) : planData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={planData} cx="50%" cy="50%" outerRadius={70} dataKey="value">
                        {planData.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Pie>
                      <Tooltip
                        formatter={(value, name, props) => [`${props.payload.pct}% (${value.toLocaleString()})`, name]}
                        contentStyle={{ borderRadius: '10px', background: 'var(--surface)', fontSize: '12px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                    {planData.map(p => (
                      <div key={p.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                          <span style={{ color: 'var(--text-secondary)' }}>{p.name}</span>
                        </div>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{p.value.toLocaleString()} ({p.pct}%)</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <EmptyState message="No contract data available" sub="Upload a dataset and run analysis to see contract distribution." />
              )}
            </div>

            <div className="card" style={{ padding: '22px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Risk Breakdown</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>Customer count by risk level</p>
              {loading ? (
                <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: '20px', height: '20px', border: '2px solid var(--purple-200)', borderTopColor: 'var(--purple-600)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                </div>
              ) : riskBarData.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={riskBarData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: '10px', background: 'var(--surface)', fontSize: '12px' }} />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {riskBarData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState message="No risk data available" sub="Run batch analysis from the Dashboard to compute risk scores." />
              )}
            </div>

          </div>
        )}

        {/* ── Tab 2: Risk Breakdown — Top risk results from dashboard ── */}
        {activeTab === 'Risk Breakdown' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
            <div className="card" style={{ padding: '22px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Top 10 Highest-Risk Customers</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>Ranked by ML churn probability — real data from last analysis</p>

              {loading ? (
                <div style={{ padding: '40px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  <div style={{ width: '18px', height: '18px', border: '2px solid var(--purple-200)', borderTopColor: 'var(--purple-600)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  Loading…
                </div>
              ) : (stats?.results ?? []).length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {(stats.results).map((r, i) => {
                    const prob = Math.round(r.churn_probability ?? 0)
                    return (
                      <div key={r.customerID || i} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 16px', borderRadius: '12px', background: 'var(--surface-hover)' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', width: '20px', flexShrink: 0 }}>#{i + 1}</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)', flex: 1, fontSize: '13px' }}>{r.customerID || `Customer #${i + 1}`}</span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{r.Contract ?? '—'}</span>
                        <div style={{ width: '120px', height: '6px', background: 'var(--border)', borderRadius: '99px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${prob}%`, background: 'var(--danger)', borderRadius: '99px' }} />
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--danger)', width: '42px', textAlign: 'right' }}>{prob}%</span>
                        <span className="badge badge-red" style={{ fontSize: '10px' }}>● {r.risk_level}</span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <EmptyState message="No prediction results yet" sub="Run batch analysis from the Dashboard to generate risk scores." />
              )}
            </div>
          </div>
        )}

        {/* ── Tab 3: Model Performance — real /ml/metrics data ── */}
        {activeTab === 'Model Performance' && (
          <div className="analytics-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

            <div className="card" style={{ padding: '22px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Model Metrics</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>From /ml/metrics — computed on your dataset</p>

              {loading ? (
                <div style={{ padding: '40px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: '18px', height: '18px', border: '2px solid var(--purple-200)', borderTopColor: 'var(--purple-600)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                </div>
              ) : hasMetrics ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {metricBars.map(({ label, val }) => (
                    <div key={label}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px' }}>
                        <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{label}</span>
                        <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{val != null ? `${(val * 100).toFixed(2)}%` : '—'}</span>
                      </div>
                      <div style={{ height: '8px', background: 'var(--border)', borderRadius: '99px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${val != null ? (val * 100).toFixed(0) : 0}%`, background: 'var(--purple-600)', borderRadius: '99px', transition: 'width 600ms ease' }} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState message="No model evaluation data available" sub="Upload a dataset with Churn labels and run analysis to compute model metrics." />
              )}
            </div>

            <div className="card" style={{ padding: '22px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Feature Importance</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>Top features driving predictions</p>

              {loading ? (
                <div style={{ padding: '40px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: '18px', height: '18px', border: '2px solid var(--purple-200)', borderTopColor: 'var(--purple-600)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                </div>
              ) : topFeatures.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={topFeatures.map(f => ({ name: f.feature, importance: parseFloat((f.importance * 100).toFixed(2)) }))}
                    layout="vertical"
                    margin={{ top: 0, right: 10, left: 10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={100} />
                    <Tooltip contentStyle={{ borderRadius: '10px', background: 'var(--surface)', fontSize: '12px' }} formatter={(v) => [`${v}%`, 'Importance']} />
                    <Bar dataKey="importance" fill="var(--purple-600)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState message="No feature importance data" sub="Feature importance is computed when model metrics are available." />
              )}
            </div>

          </div>
        )}

        {/* ── Tab 4: Trend Analysis — honest empty state ── */}
        {activeTab === 'Trend Analysis' && (
          <div className="card" style={{ padding: '40px 24px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '12px' }}>
              <div style={{ width: '64px', height: '64px', background: 'var(--surface-hover)', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BarChart2 size={30} color="var(--text-muted)" style={{ opacity: 0.4 }} />
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Historical Trend Data Not Available</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '440px', lineHeight: 1.7 }}>
                Churn trend charts require prediction history stored over time. Currently, this application stores
                the most recent batch analysis result. Run analyses regularly over multiple days/weeks to build
                historical trend data.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.2)', borderRadius: '10px', padding: '10px 16px', fontSize: '12px', color: '#d97706', marginTop: '8px' }}>
                <AlertCircle size={14} />
                No fake trend data will be shown. Data must originate from real prediction history.
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}


export default Analytics
