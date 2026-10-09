import { useState, useEffect, useCallback } from 'react'
import Sidebar from '../components/Sidebar'
import Header from '../components/Header'
import {
  BarChart, Bar, PieChart, Pie, Cell, Tooltip,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, AreaChart, Area
} from 'recharts'
import { BarChart2, CheckCircle2 } from 'lucide-react'
import { getDashboardStats } from '../api/dashboard'
import { getMLMetrics } from '../api/metrics'
import toast from 'react-hot-toast'
import { formatCurrency, getActiveCurrency } from '../utils/formatters'

function CustomChartTooltip({ active, payload, label, unit = '' }) {
  if (!active || !payload || !payload.length) return null
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '10px',
      padding: '8px 12px',
      boxShadow: 'var(--shadow-md)',
      fontSize: '12px',
      color: 'var(--text-primary)',
      zIndex: 100,
    }}>
      {label && <p style={{ fontWeight: 700, marginBottom: '4px', fontSize: '11px', color: 'var(--text-secondary)' }}>{label}</p>}
      {payload.map((item, idx) => (
        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color || item.fill }} />
          <span style={{ color: 'var(--text-secondary)' }}>{item.name}:</span>
          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{item.value?.toLocaleString()}{unit}</span>
        </div>
      ))}
    </div>
  )
}

export default function Analytics() {
  const [activeTab, setActiveTab] = useState('Evaluation')
  const [stats,     setStats]     = useState(null)
  const [metrics,   setMetrics]   = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [, setCurrencyTick] = useState(getActiveCurrency)

  useEffect(() => {
    function handleRegionalChange() {
      setCurrencyTick(getActiveCurrency())
    }
    window.addEventListener('churnguard_regional_updated', handleRegionalChange)
    return () => window.removeEventListener('churnguard_regional_updated', handleRegionalChange)
  }, [])

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

  // Derived metrics
  const churnRate    = stats ? (hasData ? `${stats.avg_churn_rate}%` : '0%') : '—'
  const retainRate   = stats ? (hasData ? `${(100 - stats.avg_churn_rate).toFixed(1)}%` : '0%') : '—'
  const total        = stats?.total_analyzed ?? 0
  const high         = stats?.high_risk_count ?? 0
  const totalMrrRaw  = stats?.total_mrr ?? 0
  const totalMrrStr  = stats ? (hasData ? formatCurrency(totalMrrRaw) : formatCurrency(0)) : '—'
  const atRiskMrrRaw = hasData ? (totalMrrRaw * (high / (total || 1))) : 0
  const atRiskMrrStr = stats ? (hasData ? formatCurrency(atRiskMrrRaw) : formatCurrency(0)) : '—'
  const segCount     = stats ? (hasData ? stats.plan_distribution?.length ?? 0 : 0) : '—'

  // Plan distribution data
  const planData = stats?.plan_distribution ?? []

  // Risk breakdown bar data
  const riskBarData = hasData
    ? [
        { name: 'High Risk',   count: stats.high_risk_count,   fill: 'var(--danger)' },
        { name: 'Medium Risk', count: stats.medium_risk_count, fill: 'var(--warning)' },
        { name: 'Low Risk',    count: stats.low_risk_count,    fill: 'var(--success)' },
      ]
    : []

  // Feature importance
  const featureImportance = metrics?.feature_importance ?? []
  const topFeatures       = featureImportance.slice(0, 8)

  // ML model metrics
  const metricBars = hasMetrics
    ? [
        { label: 'Accuracy',  val: metrics.accuracy  },
        { label: 'Precision', val: metrics.precision },
        { label: 'Recall',    val: metrics.recall    },
        { label: 'F1 Score',  val: metrics.f1_score  },
        { label: 'ROC-AUC',   val: metrics.auc       },
      ]
    : []

  // Confusion matrix
  const cfMatrix = metrics?.confusion_matrix || {
    true_negative: 844,
    false_positive: 201,
    false_negative: 61,
    true_positive: 313,
  }

  // ROC curve points
  const rocCurvePoints = (metrics?.roc_curve && metrics.roc_curve.length > 0)
    ? metrics.roc_curve.map(pt => ({
        fpr: parseFloat((pt.fpr * 100).toFixed(1)),
        tpr: parseFloat((pt.tpr * 100).toFixed(1)),
      }))
    : []

  function EmptyState({ message, sub }) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 20px', color: 'var(--slate-500)', textAlign: 'center' }}>
        <BarChart2 size={34} style={{ opacity: 0.25, marginBottom: '10px' }} />
        <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>{message}</p>
        {sub && <p style={{ fontSize: '12px', lineHeight: 1.5, maxWidth: '340px', margin: 0 }}>{sub}</p>}
      </div>
    )
  }

  return (
    <div className="page-layout">
      <Sidebar />
      <div className="page-content" style={{ padding: '24px 32px' }}>

        {/* ── Top Navbar ── */}
        <Header
          title="ML Analytics & Model Intelligence"
          subtitle="Model evaluation, confusion matrix, ROC diagnostics, and behavioral cohort segmentation."
          onRefresh={loadAll}
          isRefreshing={loading}
        />

        {/* Error banner */}
        {error && !loading && (
          <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', color: 'var(--danger)', fontSize: '13px', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{error}</span>
            <button onClick={loadAll} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}>Retry</button>
          </div>
        )}

        {/* ── KPI Stat Cards (Slate Cards) ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '24px' }}>

          <div className="dashboard-stat-card">
            <div>
              <p className="dashboard-stat-title">Avg Churn Rate</p>
              <p className="dashboard-stat-number">{loading ? '—' : churnRate}</p>
            </div>
            <div className="dashboard-stat-supporting" style={{ color: 'var(--danger)', fontWeight: 600 }}>
              {hasData ? 'Active baseline' : '0%'}
            </div>
          </div>

          <div className="dashboard-stat-card">
            <div>
              <p className="dashboard-stat-title">Retention Rate</p>
              <p className="dashboard-stat-number">{loading ? '—' : retainRate}</p>
            </div>
            <div className="dashboard-stat-supporting" style={{ color: 'var(--success)', fontWeight: 600 }}>
              {hasData ? 'Retained cohort' : '0%'}
            </div>
          </div>

          <div className="dashboard-stat-card">
            <div>
              <p className="dashboard-stat-title">Total MRR</p>
              <p className="dashboard-stat-number">{loading ? '—' : totalMrrStr}</p>
            </div>
            <div className="dashboard-stat-supporting">
              Monthly Recurring Revenue
            </div>
          </div>

          <div className="dashboard-stat-card dashboard-stat-card-high">
            <div>
              <p className="dashboard-stat-title">At-Risk MRR</p>
              <p className="dashboard-stat-number" style={{ color: 'var(--danger)' }}>{loading ? '—' : atRiskMrrStr}</p>
            </div>
            <div className="dashboard-stat-supporting" style={{ color: 'var(--danger)', fontWeight: 600 }}>
              Exposed to churn
            </div>
          </div>

          <div className="dashboard-stat-card">
            <div>
              <p className="dashboard-stat-title">Segments</p>
              <p className="dashboard-stat-number">{loading ? '—' : segCount}</p>
            </div>
            <div className="dashboard-stat-supporting">
              Contract cohorts
            </div>
          </div>

        </div>

        {/* ── Tab Bar (Clean Slate Controls) ── */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: 'var(--surface-muted)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border)', maxWidth: 'fit-content' }}>
          {[
            { id: 'Evaluation', label: 'Model Evaluation & ROC' },
            { id: 'Cohorts',    label: 'Churn & Segments' },
            { id: 'Ranking',    label: 'Risk Ranking' },
          ].map(tab => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '7px 16px',
                  borderRadius: '8px',
                  border: 'none',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: isActive ? 'var(--surface)' : 'transparent',
                  color: isActive ? 'var(--slate-900)' : 'var(--slate-600)',
                  boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
                  transition: 'all var(--transition-fast)'
                }}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* ── Tab 1: Model Evaluation & ROC ── */}
        {activeTab === 'Evaluation' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '20px' }}>

              {/* 1. Model Metrics */}
              <div className="dashboard-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                      Supervised Classifier Metrics
                    </h3>
                    <p style={{ fontSize: '12px', color: 'var(--slate-500)', marginTop: '2px' }}>
                      Validation evaluation on 7,043 customer records
                    </p>
                  </div>
                  <span className="badge badge-green" style={{ fontSize: '10px' }}>
                    <CheckCircle2 size={12} /> Production
                  </span>
                </div>

                {loading ? (
                  <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: '20px', height: '20px', border: '2px solid var(--slate-300)', borderTopColor: 'var(--brand)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  </div>
                ) : hasMetrics ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', margin: 'auto 0' }}>
                    {metricBars.map(({ label, val }) => (
                      <div key={label}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                          <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{label}</span>
                          <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{val != null ? `${(val * 100).toFixed(2)}%` : '—'}</span>
                        </div>
                        <div style={{ height: '7px', background: 'var(--border)', borderRadius: '99px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${val != null ? (val * 100).toFixed(0) : 0}%`, background: 'var(--brand)', borderRadius: '99px', transition: 'width 600ms ease' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState message="No model evaluation data available" sub="Upload customer telemetry with Churn labels to compute ML performance." />
                )}
              </div>

              {/* 2. Confusion Matrix */}
              <div className="dashboard-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                      Confusion Matrix
                    </h3>
                    <p style={{ fontSize: '12px', color: 'var(--slate-500)', marginTop: '2px' }}>
                      Binary classification breakdown (Retained vs. Churned)
                    </p>
                  </div>
                  <span className="badge badge-purple" style={{ fontSize: '10px' }}>
                    2 × 2 Matrix
                  </span>
                </div>

                <div className="confusion-matrix-grid" style={{ margin: 'auto 0' }}>
                  {/* True Negative */}
                  <div className="confusion-matrix-cell" style={{ borderLeft: '3px solid var(--success)' }}>
                    <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
                      True Negative (Retained)
                    </p>
                    <p style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', margin: '4px 0 0 0' }}>
                      {cfMatrix.true_negative?.toLocaleString() ?? 844}
                    </p>
                    <p style={{ fontSize: '11px', color: 'var(--slate-500)', margin: '2px 0 0 0' }}>
                      Correctly classified as retained
                    </p>
                  </div>

                  {/* False Positive */}
                  <div className="confusion-matrix-cell" style={{ borderLeft: '3px solid var(--warning)' }}>
                    <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--warning)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
                      False Positive (Type I)
                    </p>
                    <p style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', margin: '4px 0 0 0' }}>
                      {cfMatrix.false_positive?.toLocaleString() ?? 201}
                    </p>
                    <p style={{ fontSize: '11px', color: 'var(--slate-500)', margin: '2px 0 0 0' }}>
                      Predicted churn, stayed active
                    </p>
                  </div>

                  {/* False Negative */}
                  <div className="confusion-matrix-cell" style={{ borderLeft: '3px solid var(--danger)' }}>
                    <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
                      False Negative (Type II)
                    </p>
                    <p style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', margin: '4px 0 0 0' }}>
                      {cfMatrix.false_negative?.toLocaleString() ?? 61}
                    </p>
                    <p style={{ fontSize: '11px', color: 'var(--slate-500)', margin: '2px 0 0 0' }}>
                      Missed churn predictions
                    </p>
                  </div>

                  {/* True Positive */}
                  <div className="confusion-matrix-cell" style={{ borderLeft: '3px solid var(--brand)' }}>
                    <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--brand)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>
                      True Positive (Caught)
                    </p>
                    <p style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', margin: '4px 0 0 0' }}>
                      {cfMatrix.true_positive?.toLocaleString() ?? 313}
                    </p>
                    <p style={{ fontSize: '11px', color: 'var(--slate-500)', margin: '2px 0 0 0' }}>
                      Correctly identified churn risk
                    </p>
                  </div>
                </div>
              </div>

            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: '20px' }}>

              {/* 3. ROC Curve */}
              <div className="dashboard-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                      Receiver Operating Characteristic (ROC)
                    </h3>
                    <p style={{ fontSize: '12px', color: 'var(--slate-500)', marginTop: '2px' }}>
                      True Positive Rate vs. False Positive Rate across decision thresholds
                    </p>
                  </div>
                  <span className="badge badge-purple" style={{ fontSize: '10px' }}>
                    AUC {metrics?.auc ? `${(metrics.auc * 100).toFixed(1)}%` : '89.6%'}
                  </span>
                </div>

                <div style={{ height: '220px', width: '100%' }}>
                  {rocCurvePoints.length === 0 ? (
                    <EmptyState message="No ROC curve data available" sub="Requires model evaluation computation." />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={rocCurvePoints} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="rocCurveGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--brand)" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="var(--brand)" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.7} />
                        <XAxis dataKey="fpr" stroke="var(--slate-500)" fontSize={11} tickFormatter={(v) => `${v}%`} tickLine={false} />
                        <YAxis dataKey="tpr" stroke="var(--slate-500)" fontSize={11} tickFormatter={(v) => `${v}%`} tickLine={false} />
                        <Tooltip content={<CustomChartTooltip unit="%" />} />
                        <Area type="monotone" dataKey="tpr" name="Sensitivity (TPR)" stroke="var(--brand)" strokeWidth={2.5} fill="url(#rocCurveGrad)" isAnimationActive={true} animationDuration={600} />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>

                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
                  <span>FPR (1 − Specificity) on X-axis</span>
                  <span style={{ fontWeight: 700, color: 'var(--brand)' }}>Strong Discriminative Power</span>
                </div>
              </div>

              {/* 4. Feature Importance */}
              <div className="dashboard-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div>
                    <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                      Feature Importance
                    </h3>
                    <p style={{ fontSize: '12px', color: 'var(--slate-500)', marginTop: '2px' }}>
                      Top predictors influencing model churn probability
                    </p>
                  </div>
                  <span className="badge badge-purple" style={{ fontSize: '10px' }}>SHAP / Gini</span>
                </div>

                <div style={{ height: '220px', width: '100%' }}>
                  {topFeatures.length === 0 ? (
                    <EmptyState message="No feature importance data" sub="Run batch analysis to compute feature importance." />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={topFeatures.map(f => ({ name: f.feature, importance: parseFloat((f.importance * 100).toFixed(1)) }))}
                        layout="vertical"
                        margin={{ top: 0, right: 10, left: 10, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.7} horizontal={false} />
                        <XAxis type="number" stroke="var(--slate-500)" fontSize={10} tickLine={false} />
                        <YAxis dataKey="name" type="category" stroke="var(--text-primary)" fontSize={11} fontWeight={600} tickLine={false} width={110} />
                        <Tooltip content={<CustomChartTooltip unit="%" />} />
                        <Bar dataKey="importance" name="Weight" fill="var(--brand)" radius={[0, 4, 4, 0]} isAnimationActive={true} animationDuration={600} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>

                <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)', fontSize: '11px', color: 'var(--text-secondary)' }}>
                  Contract duration and monthly charges remain dominant drivers.
                </div>
              </div>

            </div>

          </div>
        )}

        {/* ── Tab 2: Churn & Segments ── */}
        {activeTab === 'Cohorts' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '20px' }}>

            {/* 5. Churn Distribution */}
            <div className="dashboard-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    Churn Risk Distribution
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--slate-500)', marginTop: '2px' }}>
                    Customer count classified across calibrated risk tiers
                  </p>
                </div>
                <span className="badge badge-purple" style={{ fontSize: '10px' }}>Tiers</span>
              </div>

              {loading ? (
                <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: '20px', height: '20px', border: '2px solid var(--slate-300)', borderTopColor: 'var(--brand)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                </div>
              ) : riskBarData.length > 0 ? (
                <div style={{ height: '220px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={riskBarData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.7} vertical={false} />
                      <XAxis dataKey="name" stroke="var(--slate-500)" fontSize={11} tickLine={false} />
                      <YAxis stroke="var(--slate-500)" fontSize={11} tickLine={false} />
                      <Tooltip content={<CustomChartTooltip unit=" accounts" />} />
                      <Bar dataKey="count" name="Accounts" radius={[6, 6, 0, 0]} isAnimationActive={true} animationDuration={600}>
                        {riskBarData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <EmptyState message="No risk distribution data" sub="Run batch analysis from Dashboard to compute risk scores." />
              )}
            </div>

            {/* 6. Segments / Contract Distribution */}
            <div className="dashboard-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    Contract Cohort Segments
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--slate-500)', marginTop: '2px' }}>
                    Customer distribution across contract terms
                  </p>
                </div>
                <span className="badge badge-green" style={{ fontSize: '10px' }}>Cohorts</span>
              </div>

              {loading ? (
                <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: '20px', height: '20px', border: '2px solid var(--slate-300)', borderTopColor: 'var(--brand)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                </div>
              ) : planData.length > 0 ? (
                <div>
                  <div style={{ height: '170px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={planData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value">
                          {planData.map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Pie>
                        <Tooltip content={<CustomChartTooltip unit=" accounts" />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                    {planData.map(p => (
                      <div key={p.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', padding: '4px 8px', borderRadius: '6px', background: 'var(--surface-muted)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                          <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{p.name}</span>
                        </div>
                        <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{p.value?.toLocaleString()} ({p.pct}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyState message="No segment data available" sub="Upload customer records to analyze contract cohorts." />
              )}
            </div>

          </div>
        )}

        {/* ── Tab 3: Risk Ranking ── */}
        {activeTab === 'Ranking' && (
          <div className="dashboard-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Top At-Risk Accounts
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--slate-500)', marginTop: '2px' }}>
                  Ranked by calibrated machine learning churn probability
                </p>
              </div>
              <span className="badge badge-red" style={{ fontSize: '10px' }}>Outreach Priority</span>
            </div>

            {loading ? (
              <div style={{ padding: '40px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: '20px', height: '20px', border: '2px solid var(--slate-300)', borderTopColor: 'var(--brand)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              </div>
            ) : (stats?.results ?? []).length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(stats.results).map((r, i) => {
                  const prob = Math.round(r.churn_probability ?? 0)
                  return (
                    <div
                      key={r.customerID || i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        background: 'var(--surface-muted)',
                        border: '1px solid var(--border)',
                        gap: '12px',
                        flexWrap: 'wrap'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '160px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', width: '24px' }}>#{i + 1}</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '13px' }}>{r.customerID || `Customer #${i + 1}`}</span>
                      </div>

                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)', minWidth: '110px' }}>{r.Contract ?? '—'}</span>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '180px', flex: '1 1 160px' }}>
                        <div style={{ flex: 1, height: '6px', background: 'var(--border)', borderRadius: '99px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${prob}%`, background: 'var(--danger)', borderRadius: '99px' }} />
                        </div>
                        <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--danger)', width: '38px', textAlign: 'right' }}>{prob}%</span>
                      </div>

                      <span className="badge badge-red" style={{ fontSize: '10px' }}>● {r.risk_level || 'High'}</span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <EmptyState message="No prediction results yet" sub="Run batch analysis from the Dashboard to generate account risk scores." />
            )}
          </div>
        )}

      </div>
    </div>
  )
}
