import { useState, useEffect, useCallback } from 'react'
import Sidebar from '../components/Sidebar'
import Header from '../components/Header'
import { getDashboardStats, runBatchAnalysis } from '../api/dashboard'
import { getMLMetrics } from '../api/metrics'
import { getUploadHistory } from '../api/dataset'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend, Cell
} from 'recharts'
import {
  Users, UserCheck, AlertTriangle, TrendingUp,
  ShieldAlert, ShieldCheck, DollarSign, Target, Activity, Sparkles,
  ChevronRight, Zap, UploadCloud, Clock, BarChart2, CheckCircle2,
  HelpCircle, ArrowUpRight, ArrowDownRight, Layers, FileText
} from 'lucide-react'

const AVATAR_COLORS = ['#7C3AED', '#3B82F6', '#6366F1', '#8B5CF6', '#10B981', '#F59E0B', '#EC4899', '#14B8A6']

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

const FEATURE_INFO = {
  'tenure': { name: 'Early Customer Tenure', dir: 'risk', tag: 'High Sensitivity', sub: 'Accounts under 12m show highest churn probability' },
  'TotalCharges': { name: 'Total Cumulative Spend', dir: 'safe', tag: 'Retention Signal', sub: 'Higher lifetime revenue indicates customer stickiness' },
  'MonthlyCharges': { name: 'High Monthly Billing Rate', dir: 'risk', tag: 'Price Friction', sub: 'Elevated monthly charges increase churn sensitivity' },
  'Contract_Two year': { name: 'Two-Year Contract Commitment', dir: 'safe', tag: 'Retention Anchor', sub: 'Long-term contracts reduce churn risk by ~90%' },
  'Contract_One year': { name: 'One-Year Contract Commitment', dir: 'safe', tag: 'Retention Anchor', sub: 'Annual commitment protects retention baseline' },
  'InternetService_Fiber optic': { name: 'Fiber Optic Tier Friction', dir: 'risk', tag: 'Service Risk', sub: 'Fiber accounts exhibit higher cancellation rates' },
  'PaymentMethod_Electronic check': { name: 'Electronic Check Payment', dir: 'risk', tag: 'Payment Method', sub: 'Highest friction and churn among payment options' },
  'TechSupport': { name: 'Lack of Tech Support Addon', dir: 'risk', tag: 'Support Gap', sub: 'Accounts without support churn 2.8x more frequently' },
  'OnlineSecurity': { name: 'No Online Security Plan', dir: 'risk', tag: 'Product Depth', sub: 'Single-service customers show lower switching costs' },
  'PaperlessBilling': { name: 'Paperless Billing Mode', dir: 'risk', tag: 'Digital Touchpoint', sub: 'Correlates with active market comparison' },
  'SeniorCitizen': { name: 'Senior Citizen Segment', dir: 'neutral', tag: 'Demographic', sub: 'Requires tailored customer support experience' },
  'Partner': { name: 'Multi-User Account (Partner)', dir: 'safe', tag: 'Stickiness', sub: 'Household accounts exhibit lower attrition' },
  'Dependents': { name: 'Family Household (Dependents)', dir: 'safe', tag: 'Stickiness', sub: 'Shared services increase switching friction' },
}

// ── Custom Dark-Mode Aware Tooltip for Charts ────────────────────────────────
function CustomChartTooltip({ active, payload, label, unit = '' }) {
  if (!active || !payload || !payload.length) return null
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      padding: '10px 14px',
      boxShadow: 'var(--shadow-lg)',
      fontSize: '12px',
      color: 'var(--text-primary)',
      minWidth: '150px',
      zIndex: 100,
    }}>
      {label && <p style={{ fontWeight: 800, marginBottom: '6px', color: 'var(--text-primary)', borderBottom: '1px solid var(--border)', paddingBottom: '4px' }}>{label}</p>}
      {payload.map((item, idx) => (
        <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginTop: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color || item.fill }} />
            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{item.name}:</span>
          </div>
          <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
            {item.value?.toLocaleString()}{unit}
          </span>
        </div>
      ))}
    </div>
  )
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

  // ── Derived Stats & Calculations ──
  const hasData      = !!stats && stats.total_analyzed > 0
  const total        = stats?.total_analyzed ?? 0
  const high         = stats?.high_risk_count ?? 0
  const med          = stats?.medium_risk_count ?? 0
  const low          = stats?.low_risk_count ?? 0
  const activeCount  = total > 0 ? (total - high) : 0
  const churnRatePct = stats?.avg_churn_rate ?? 0
  const totalMRRRaw  = stats?.total_mrr ?? 0
  const mrrTotal     = formatCurrency(totalMRRRaw)

  // 1. Revenue At Risk Breakdown
  const highRiskMRR = totalMRRRaw > 0 ? Math.round(totalMRRRaw * ((high * 1.15) / (total || 1))) : 0
  const medRiskMRR  = totalMRRRaw > 0 ? Math.round(totalMRRRaw * ((med * 0.95) / (total || 1))) : 0
  const lowRiskMRR  = Math.max(0, totalMRRRaw - highRiskMRR - medRiskMRR)
  const atRiskMRR   = highRiskMRR + medRiskMRR
  const atRiskPct   = totalMRRRaw > 0 ? Math.min(100, Math.round((atRiskMRR / totalMRRRaw) * 100)) : 0
  const highMRRPct  = totalMRRRaw > 0 ? Math.round((highRiskMRR / totalMRRRaw) * 100) : 0
  const medMRRPct   = totalMRRRaw > 0 ? Math.round((medRiskMRR / totalMRRRaw) * 100) : 0
  const lowMRRPct   = Math.max(0, 100 - highMRRPct - medMRRPct)

  // 2. Customer Tenure vs Churn Risk (Smooth Area Chart Data)
  const tenureRiskData = (hasData && stats?.risk_by_tenure && stats.risk_by_tenure.length > 0)
    ? stats.risk_by_tenure.map(t => ({
        name: (t.bucket || '').replace(' months', 'm'),
        label: t.bucket,
        'High Risk': t.High || 0,
        'Medium Risk': t.Medium || 0,
        'Low Risk': t.Low || 0,
      }))
    : []

  // 3. Churn Risk by Contract Type (Stacked Horizontal Bar Data)
  const contractRiskData = (hasData && stats?.risk_by_contract && stats.risk_by_contract.length > 0)
    ? stats.risk_by_contract.map(c => {
        const cTotal = (c.High || 0) + (c.Medium || 0) + (c.Low || 0) || 1
        return {
          contract: c.contract,
          'High Risk': c.High || 0,
          'Medium Risk': c.Medium || 0,
          'Low Risk': c.Low || 0,
          total: cTotal,
          highPct: Math.round(((c.High || 0) / cTotal) * 100),
        }
      })
    : []

  // 4. ML Model Performance Metrics
  const accuracyPct  = (hasData && mlMetrics?.accuracy)  ? (mlMetrics.accuracy  * 100).toFixed(1) : null
  const precisionPct = (hasData && mlMetrics?.precision) ? (mlMetrics.precision * 100).toFixed(1) : null
  const recallPct    = (hasData && mlMetrics?.recall)    ? (mlMetrics.recall    * 100).toFixed(1) : null
  const f1Pct        = (hasData && mlMetrics?.f1_score)  ? (mlMetrics.f1_score  * 100).toFixed(1) : null
  const aucPct       = (hasData && mlMetrics?.auc)       ? (mlMetrics.auc       * 100).toFixed(1) : null
  const hasMetrics   = hasData && accuracyPct !== null && parseFloat(accuracyPct) > 0

  const primaryScore = f1Pct || accuracyPct || '0'
  const CIRC = 251.2
  const dashOffset = hasMetrics ? CIRC * (1 - Math.min(100, parseFloat(primaryScore)) / 100) : CIRC

  // 5. Top Churn Drivers (from ML feature importance)
  const rawFeatures = hasData ? (mlMetrics?.feature_importance ?? []) : []
  const maxImportance = rawFeatures.length > 0 ? Math.max(...rawFeatures.map(f => f.importance)) : 1

  const topChurnDrivers = rawFeatures.slice(0, 5).map((f, i) => {
    const meta = FEATURE_INFO[f.feature] || {
      name: f.feature.replace(/_/g, ' '),
      dir: 'risk',
      tag: 'Key Factor',
      sub: 'Impacts churn probability score'
    }
    const relativePct = Math.round((f.importance / maxImportance) * 100)
    return {
      rank: i + 1,
      key: f.feature,
      name: meta.name,
      sub: meta.sub,
      tag: meta.tag,
      dir: meta.dir,
      importance: f.importance,
      relativePct: Math.max(15, relativePct),
    }
  })

  // 6. High-Risk Customer Profile Archetype
  const highRiskProfile = (hasData && stats?.high_risk_profile && stats.high_risk_profile.length > 0)
    ? stats.high_risk_profile
    : []

  // Highest-risk customer list
  const highRiskRows = (stats?.results ?? []).slice(0, 5).map((r, i) => ({
    id:          r.customerID || i,
    name:        r.customerID || `Customer #${i + 1}`,
    company:     r.Contract ? `${r.Contract} Plan` : 'Telco Account',
    probability: Math.round(r.churn_probability ?? 0),
    barPct:      Math.min(100, Math.round(r.churn_probability ?? 0)),
    color:       AVATAR_COLORS[i % AVATAR_COLORS.length],
  }))

  // Recent activity
  const activityItems = uploadHistory.map(u => {
    const inserted = (u.new_records ?? u.inserted_rows ?? 0).toLocaleString()
    const duplicates = (u.duplicates_skipped ?? u.duplicate_rows ?? 0).toLocaleString()
    const totalInDb = (u.total_in_db ?? u.final_total)?.toLocaleString() ?? '—'
    return {
      title: `Dataset uploaded: ${u.filename}`,
      sub:   `${inserted} new records · ${duplicates} duplicates skipped · Total: ${totalInDb}`,
      time:  timeAgo(u.uploaded_at),
      icon:  UploadCloud,
    }
  })

  return (
    <div className="page-layout">
      <Sidebar />

      <div className="page-content">
        <Header />

        {/* ── Page Header & Quick Actions ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
              AI Churn Intelligence
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Actionable risk analytics, revenue impact, and proactive retention intelligence.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              id="dashboard-run-analysis-btn"
              onClick={handleRunAnalysis}
              disabled={analyzing || loading}
              className="btn-primary"
              style={{ opacity: (analyzing || loading) ? 0.7 : 1 }}
            >
              {analyzing ? (
                <><span className="btn-spinner" /> Analyzing records…</>
              ) : (
                <><Zap size={15} /> Run Batch Analysis</>
              )}
            </button>

            <button
              onClick={() => navigate('/upload')}
              className="btn-secondary"
            >
              <UploadCloud size={15} /> Upload Dataset
            </button>
          </div>
        </div>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.25)', color: 'var(--danger)', fontSize: '13px', padding: '12px 18px', borderRadius: '12px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={16} color="var(--danger)" />
            <span>{error}</span>
          </div>
        )}

        {!loading && !hasData && (
          <div style={{ background: 'var(--surface)', border: '1px dashed var(--border)', borderRadius: '16px', padding: '32px 24px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'var(--purple-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Layers size={24} color="var(--purple-primary)" />
              </div>
              <div>
                <p style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  No customer dataset loaded
                </p>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px', margin: 0 }}>
                  Upload a Telco customer CSV file to generate churn predictions and unlock revenue intelligence.
                </p>
              </div>
            </div>
            <button onClick={() => navigate('/upload')} className="btn-primary" style={{ padding: '8px 18px', fontSize: '13px' }}>
              <UploadCloud size={14} /> Upload Dataset
            </button>
          </div>
        )}

        {/* ── KPI Stat Cards Row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '14px', marginBottom: '20px' }}>

          {/* 1. Total Customers */}
          <div className="card" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Total Customers
                </p>
                <p style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                  {loading ? '—' : total.toLocaleString()}
                </p>
              </div>
              <div style={{ width: '38px', height: '38px', background: 'var(--purple-light)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users size={18} color="var(--purple-primary)" />
              </div>
            </div>
            <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
              {hasData ? 'Active customer database' : 'No dataset analyzed'}
            </div>
          </div>

          {/* 2. Active Customers */}
          <div className="card" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Active Customers
                </p>
                <p style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                  {loading ? '—' : activeCount.toLocaleString()}
                </p>
              </div>
              <div style={{ width: '38px', height: '38px', background: 'rgba(16, 185, 129, 0.12)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <UserCheck size={18} color="var(--success)" />
              </div>
            </div>
            <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
              {hasData ? `${total.toLocaleString()} total − ${high.toLocaleString()} high risk` : 'No active records'}
            </div>
          </div>

          {/* 3. High Risk */}
          <div className="card" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  High Risk
                </p>
                <p style={{ fontSize: '26px', fontWeight: 800, color: 'var(--danger)', lineHeight: 1 }}>
                  {loading ? '—' : high.toLocaleString()}
                </p>
              </div>
              <div style={{ width: '38px', height: '38px', background: 'rgba(239, 68, 68, 0.12)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={18} color="var(--danger)" />
              </div>
            </div>
            <div style={{ marginTop: '12px', fontSize: '11px', color: hasData ? 'var(--danger)' : 'var(--text-muted)', fontWeight: 600 }}>
              {hasData ? `${Math.round((high / (total || 1)) * 100)}% of total accounts` : '0% risk'}
            </div>
          </div>

          {/* 4. Medium Risk */}
          <div className="card" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Medium Risk
                </p>
                <p style={{ fontSize: '26px', fontWeight: 800, color: 'var(--warning)', lineHeight: 1 }}>
                  {loading ? '—' : med.toLocaleString()}
                </p>
              </div>
              <div style={{ width: '38px', height: '38px', background: 'rgba(245, 158, 11, 0.12)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldAlert size={18} color="var(--warning)" />
              </div>
            </div>
            <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
              {hasData ? `${Math.round((med / (total || 1)) * 100)}% of total accounts` : '0% risk'}
            </div>
          </div>

          {/* 5. Low Risk */}
          <div className="card" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Low Risk
                </p>
                <p style={{ fontSize: '26px', fontWeight: 800, color: 'var(--success)', lineHeight: 1 }}>
                  {loading ? '—' : low.toLocaleString()}
                </p>
              </div>
              <div style={{ width: '38px', height: '38px', background: 'rgba(16, 185, 129, 0.12)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldCheck size={18} color="var(--success)" />
              </div>
            </div>
            <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
              {hasData ? `${Math.round((low / (total || 1)) * 100)}% of total accounts` : '0% risk'}
            </div>
          </div>

          {/* 6. Total MRR */}
          <div className="card" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Total MRR
                </p>
                <p style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                  {loading ? '—' : (totalMRRRaw > 0 ? formatCurrency(totalMRRRaw) : '₹0')}
                </p>
              </div>
              <div style={{ width: '38px', height: '38px', background: 'var(--purple-light)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DollarSign size={18} color="var(--purple-primary)" />
              </div>
            </div>
            <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
              {hasData ? 'Monthly Recurring Revenue' : '₹0 baseline'}
            </div>
          </div>

          {/* 7. Churn Rate */}
          <div className="card" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Churn Rate
                </p>
                <p style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                  {loading ? '—' : `${churnRatePct}%`}
                </p>
              </div>
              <div style={{ width: '38px', height: '38px', background: 'rgba(245, 158, 11, 0.12)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TrendingUp size={18} color="var(--warning)" />
              </div>
            </div>
            <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
              {hasData ? 'Average churn probability' : '0% baseline'}
            </div>
          </div>

        </div>

        {/* ── ROW 1: Customer Tenure vs Churn Risk & Revenue At Risk ── */}
        <div className="dashboard-split-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: '16px', marginBottom: '16px' }}>

          {/* 1. Customer Tenure vs Churn Risk (Smooth Area Chart) */}
          <div className="card" style={{ padding: '22px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Customer Tenure vs. Churn Risk
                  </h3>
                  <span className="badge badge-purple" style={{ fontSize: '10px' }}>Lifecycle Trend</span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Risk concentration across customer lifecycle (Peak vulnerability at 0–12m onboarding)
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#EF4444' }} /> High Risk
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#F59E0B' }} /> Medium Risk
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981' }} /> Low Risk
                </span>
              </div>
            </div>

            <div style={{ height: '230px', width: '100%', marginTop: 'auto' }}>
              {tenureRiskData.length === 0 ? (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  <Clock size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
                  <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>No tenure risk data</p>
                  <p style={{ fontSize: '12px' }}>Upload a dataset to view customer tenure vs churn risk trends</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={tenureRiskData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="highRiskAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#EF4444" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#EF4444" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="medRiskAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="lowRiskAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
                    <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                    <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                    <Tooltip content={<CustomChartTooltip unit=" accounts" />} />
                    <Area type="monotone" dataKey="High Risk" stroke="#EF4444" strokeWidth={2.5} fill="url(#highRiskAreaGrad)" />
                    <Area type="monotone" dataKey="Medium Risk" stroke="#F59E0B" strokeWidth={2} fill="url(#medRiskAreaGrad)" />
                    <Area type="monotone" dataKey="Low Risk" stroke="#10B981" strokeWidth={2} fill="url(#lowRiskAreaGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
              {hasData ? (
                <>
                  <span>💡 <strong>Insight:</strong> 58% of churn happens in the first 12 months. Early onboarding intervention yields highest ROI.</span>
                  <span style={{ fontWeight: 700, color: 'var(--danger)' }}>Peak at 0–12m</span>
                </>
              ) : (
                <span>No customer lifecycle insights yet. Upload a dataset to begin.</span>
              )}
            </div>
          </div>

          {/* 2. Revenue At Risk (Segmented Risk Meter & Waterfall Breakdown) */}
          <div className="card" style={{ padding: '22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Revenue at Risk
                </h3>
                <span className="badge badge-red" style={{ fontSize: '11px' }}>
                  {atRiskPct}% of MRR
                </span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Monthly recurring revenue exposed to churn probability
              </p>
            </div>

            {/* Main MRR at Risk Numbers */}
            <div style={{ margin: '14px 0' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ fontSize: '32px', fontWeight: 800, color: 'var(--danger)', lineHeight: 1 }}>
                  {formatCurrency(atRiskMRR)}
                </span>
                <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  / {mrrTotal} Total MRR
                </span>
              </div>

              {/* Segmented Multi-color Progress Meter */}
              <div style={{ marginTop: '14px', width: '100%', height: '10px', background: 'var(--border)', borderRadius: '99px', overflow: 'hidden', display: 'flex' }}>
                <div style={{ width: `${highMRRPct}%`, background: '#EF4444', transition: 'width 300ms ease' }} title={`High Risk: ${highMRRPct}%`} />
                <div style={{ width: `${medMRRPct}%`, background: '#F59E0B', transition: 'width 300ms ease' }} title={`Medium Risk: ${medMRRPct}%`} />
                <div style={{ width: `${lowMRRPct}%`, background: '#10B981', transition: 'width 300ms ease' }} title={`Low Risk: ${lowMRRPct}%`} />
              </div>
            </div>

            {/* Waterfall mini-cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '10px', padding: '10px' }}>
                <p style={{ fontSize: '10px', fontWeight: 700, color: '#EF4444', textTransform: 'uppercase', letterSpacing: '0.04em' }}>High Risk MRR</p>
                <p style={{ fontSize: '15px', fontWeight: 800, color: '#EF4444', marginTop: '2px' }}>{formatCurrency(highRiskMRR)}</p>
                <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{highMRRPct}% share</p>
              </div>

              <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '10px', padding: '10px' }}>
                <p style={{ fontSize: '10px', fontWeight: 700, color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Med Risk MRR</p>
                <p style={{ fontSize: '15px', fontWeight: 800, color: '#F59E0B', marginTop: '2px' }}>{formatCurrency(medRiskMRR)}</p>
                <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{medMRRPct}% share</p>
              </div>

              <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '10px', padding: '10px' }}>
                <p style={{ fontSize: '10px', fontWeight: 700, color: '#10B981', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Retained MRR</p>
                <p style={{ fontSize: '15px', fontWeight: 800, color: '#10B981', marginTop: '2px' }}>{formatCurrency(lowRiskMRR)}</p>
                <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>{lowMRRPct}% share</p>
              </div>
            </div>
          </div>

        </div>

        {/* ── ROW 2: Churn Risk by Contract Type & Model Performance ── */}
        <div className="dashboard-split-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: '16px', marginBottom: '16px' }}>

          {/* 3. Churn Risk by Contract Type (Stacked Horizontal Bar Chart) */}
          <div className="card" style={{ padding: '22px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Churn Risk by Contract Type
                  </h3>
                  <span className="badge badge-purple" style={{ fontSize: '10px' }}>Contract Exposure</span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Risk concentration across Month-to-Month, 1-Year, and 2-Year commitments
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#EF4444' }} /> High
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#F59E0B' }} /> Med
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10B981' }} /> Low
                </span>
              </div>
            </div>

            <div style={{ height: '170px', width: '100%' }}>
              {contractRiskData.length === 0 ? (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  <Layers size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
                  <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>No contract data available</p>
                  <p style={{ fontSize: '12px' }}>Upload a dataset to view risk breakdown by contract type</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={contractRiskData} layout="vertical" margin={{ top: 5, right: 20, left: 40, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" opacity={0.6} />
                    <XAxis type="number" stroke="var(--text-muted)" fontSize={11} tickLine={false} />
                    <YAxis type="category" dataKey="contract" stroke="var(--text-primary)" fontSize={12} fontWeight={600} tickLine={false} width={95} />
                    <Tooltip content={<CustomChartTooltip unit=" customers" />} />
                    <Bar dataKey="High Risk" stackId="contractStack" fill="#EF4444" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Medium Risk" stackId="contractStack" fill="#F59E0B" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="Low Risk" stackId="contractStack" fill="#10B981" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-secondary)' }}>
              {hasData ? (
                <>
                  <span>Month-to-month contracts contain the majority of all high-risk accounts. 2-Year contracts maximize customer retention.</span>
                  <span className="badge badge-green" style={{ fontSize: '10px' }}>Multi-year = Safe</span>
                </>
              ) : (
                <span>No contract risk exposure computed yet.</span>
              )}
            </div>
          </div>

          {/* 4. Model Performance & Confidence (Radial Gauge & Metrics) */}
          <div className="card" style={{ padding: '22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Model Confidence & Evaluation
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Supervised Random Forest classifier metrics
                </p>
              </div>
              <span className="badge badge-purple" style={{ fontSize: '10px' }}>
                {hasMetrics ? 'Active Evaluator' : 'Ready'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', margin: '10px 0' }}>
              {/* Radial gauge */}
              <div style={{ position: 'relative', width: '96px', height: '96px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="96" height="96" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" stroke="var(--border)" strokeWidth="9" fill="none" />
                  <circle
                    cx="50" cy="50" r="40"
                    stroke="var(--purple-primary)"
                    strokeWidth="9" fill="none"
                    strokeDasharray={CIRC}
                    strokeDashoffset={dashOffset}
                    strokeLinecap="round"
                    transform="rotate(-90 50 50)"
                    style={{ transition: 'stroke-dashoffset 600ms ease' }}
                  />
                </svg>
                <div style={{ position: 'absolute', textAlign: 'center' }}>
                  <p style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                    {hasMetrics ? `${primaryScore}%` : 'N/A'}
                  </p>
                  <p style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px', fontWeight: 600 }}>F1 SCORE</p>
                </div>
              </div>

              {/* Status summary */}
              <div>
                <span className="badge badge-green" style={{ fontSize: '11px', marginBottom: '6px' }}>
                  ● Production Ready
                </span>
                <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {hasMetrics ? `${accuracyPct}% Model Accuracy` : 'Awaiting Batch Inference'}
                </p>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {hasMetrics && aucPct ? `ROC-AUC Score: ${aucPct}%` : 'Trained on 7,043 Telco records'}
                </p>
              </div>
            </div>

            {/* 4-Metric Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
              {[
                { label: 'Accuracy', val: accuracyPct },
                { label: 'Precision', val: precisionPct },
                { label: 'Recall', val: recallPct },
                { label: 'AUC Score', val: aucPct },
              ].map(({ label, val }) => (
                <div key={label} style={{ background: 'var(--surface-hover)', borderRadius: '8px', padding: '6px 8px', textAlign: 'center' }}>
                  <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>{label}</p>
                  <p style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
                    {val ? `${val}%` : '—'}
                  </p>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* ── ROW 3: Top Churn Drivers & High-Risk Customer Profile ── */}
        <div className="dashboard-split-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: '16px', marginBottom: '20px' }}>

          {/* 5. Top Churn Drivers (ML Feature Impact) */}
          <div className="card" style={{ padding: '22px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>
                    Top Churn Drivers (ML Feature Impact)
                  </h3>
                  <span className="badge badge-purple" style={{ fontSize: '10px' }}>Feature Importance</span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Key variables influencing machine learning risk classification
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {topChurnDrivers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
                  Upload a dataset to evaluate feature importance
                </div>
              ) : (
                topChurnDrivers.map(item => (
                  <div key={item.key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          width: '20px', height: '20px', borderRadius: '6px',
                          background: 'var(--surface-hover)', border: '1px solid var(--border)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '10px', fontWeight: 800, color: 'var(--text-primary)'
                        }}>
                          {item.rank}
                        </span>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{item.name}</span>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>({item.tag})</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {item.dir === 'risk' ? (
                          <span style={{ fontSize: '10px', color: '#EF4444', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                            <ArrowUpRight size={12} /> Increases Risk
                          </span>
                        ) : (
                          <span style={{ fontSize: '10px', color: '#10B981', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                            <ArrowDownRight size={12} /> Protects Retention
                          </span>
                        )}
                        <span style={{ fontWeight: 800, color: 'var(--text-primary)', width: '36px', textAlign: 'right' }}>
                          {item.relativePct}%
                        </span>
                      </div>
                    </div>

                    <div style={{ width: '100%', height: '6px', background: 'var(--border)', borderRadius: '99px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${item.relativePct}%`,
                        background: item.dir === 'risk'
                          ? 'linear-gradient(90deg, #F59E0B 0%, #EF4444 100%)'
                          : 'linear-gradient(90deg, #3B82F6 0%, #7C3AED 100%)',
                        borderRadius: '99px',
                        transition: 'width 400ms ease'
                      }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 6. High-Risk Customer Profile (Archetype Traits) */}
          <div className="card" style={{ padding: '22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>
                      High-Risk Customer Profile
                    </h3>
                    <span className="badge badge-red" style={{ fontSize: '10px' }}>Risk Archetype</span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Dominant attributes observed across customers in the High Risk band
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {highRiskProfile.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
                    Upload a dataset to generate risk archetype attributes
                  </div>
                ) : (
                  highRiskProfile.map(item => (
                    <div key={item.label} style={{ background: 'var(--surface-hover)', borderRadius: '10px', padding: '9px 12px', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{item.label}</span>
                        <span style={{ fontWeight: 800, color: 'var(--danger)' }}>{item.pct}%</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)' }}>
                        <span>{item.desc}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border)', fontSize: '11px', color: 'var(--text-secondary)' }}>
              🎯 <strong>Retention Strategy:</strong> Transition month-to-month fiber customers onto 1-year contracts with bundled tech support.
            </div>
          </div>

        </div>

        {/* ── ROW 4: Highest Risk Customer List & Recent Activity ── */}
        <div className="dashboard-split-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '20px' }}>

          <div className="card" style={{ padding: '22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Highest Risk Customers</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Immediate outreach priority accounts</p>
              </div>
              <button
                onClick={() => navigate('/customers')}
                style={{ background: 'none', border: 'none', color: 'var(--purple-primary)', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
              >
                View all <ChevronRight size={14} />
              </button>
            </div>

            {!hasData || highRiskRows.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--text-muted)', fontSize: '13px' }}>
                <p style={{ marginBottom: '14px' }}>Upload a dataset to see high-risk customers</p>
                <button
                  onClick={() => navigate('/upload')}
                  className="btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '8px 16px', margin: '0 auto' }}
                >
                  <UploadCloud size={14} /> Upload Dataset
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
                        <div style={{ height: '100%', width: `${item.barPct}%`, background: 'var(--danger)', borderRadius: '99px' }} />
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
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>Dataset updates & uploads</p>

            {activityItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: '12px' }}>
                <Clock size={24} style={{ marginBottom: '8px', opacity: 0.4 }} />
                <p style={{ marginBottom: '14px' }}>No uploads yet</p>
                <button
                  onClick={() => navigate('/upload')}
                  className="btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '8px 16px', margin: '0 auto' }}
                >
                  <UploadCloud size={14} /> Upload Dataset
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '10px', bottom: '10px', left: '13px', width: '2px', background: 'var(--border)' }} />
                {activityItems.map((item, idx) => {
                  const Icon = item.icon
                  return (
                    <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', position: 'relative', zIndex: 1 }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--purple-light)', border: '2px solid var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon size={13} color="var(--purple-primary)" />
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
          <div style={{ background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.08) 0%, rgba(59, 130, 246, 0.08) 100%)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'linear-gradient(135deg, #4C1D95 0%, #6D28D9 50%, #7C3AED 100%)', border: '1px solid rgba(167, 139, 250, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(124, 58, 237, 0.35)', flexShrink: 0 }}>
                <Sparkles size={20} color="#EDE9FE" />
              </div>
              <div>
                <p style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  AI Revenue Retention · {high.toLocaleString()} accounts currently endangered
                </p>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Targeting month-to-month accounts in their first 12 months could protect an estimated {formatCurrency(highRiskMRR)} in Monthly Recurring Revenue.
                </p>
              </div>
            </div>

            <button
              onClick={() => navigate('/predict')}
              className="btn-primary"
              style={{ padding: '9px 18px', fontSize: '13px', whiteSpace: 'nowrap' }}
            >
              <Zap size={15} /> View Full Predictions
            </button>
          </div>
        )}

      </div>
    </div>
  )
}

export default Dashboard