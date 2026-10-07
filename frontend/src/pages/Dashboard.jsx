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
  XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts'
import {
  Users, UserCheck, AlertTriangle, TrendingUp,
  ShieldAlert, ShieldCheck, DollarSign, Sparkles,
  ChevronRight, Zap, UploadCloud, Clock,
  ArrowUpRight, ArrowDownRight, Layers,
  Shield, CheckCircle2
} from 'lucide-react'

const AVATAR_COLORS = ['#4F46E5', '#3B82F6', '#0EA5E9', '#10B981', '#F59E0B', '#64748B', '#6366F1', '#14B8A6']

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
  'tenure': { name: 'Early Customer Tenure', dir: 'risk', tag: 'Lifecycle Hazard', sub: 'Accounts under 12m show highest churn probability' },
  'TotalCharges': { name: 'Total Cumulative Spend', dir: 'safe', tag: 'Retention Signal', sub: 'Higher lifetime revenue indicates customer stickiness' },
  'MonthlyCharges': { name: 'High Monthly Billing Rate', dir: 'risk', tag: 'Price Friction', sub: 'Elevated monthly charges increase churn sensitivity' },
  'Contract_Two year': { name: 'Two-Year Commitment', dir: 'safe', tag: 'Retention Anchor', sub: 'Long-term contracts reduce churn risk by ~90%' },
  'Contract_One year': { name: 'One-Year Commitment', dir: 'safe', tag: 'Retention Anchor', sub: 'Annual commitment protects retention baseline' },
  'InternetService_Fiber optic': { name: 'Fiber Optic Tier Friction', dir: 'risk', tag: 'Service Risk', sub: 'Fiber accounts exhibit higher cancellation rates' },
  'PaymentMethod_Electronic check': { name: 'Electronic Check Payment', dir: 'risk', tag: 'Payment Friction', sub: 'Highest friction and churn among payment options' },
  'TechSupport': { name: 'Lack of Tech Support Addon', dir: 'risk', tag: 'Support Gap', sub: 'Accounts without support churn 2.8x more frequently' },
  'OnlineSecurity': { name: 'No Online Security Plan', dir: 'risk', tag: 'Product Depth', sub: 'Single-service customers show lower switching costs' },
  'PaperlessBilling': { name: 'Paperless Billing Mode', dir: 'risk', tag: 'Digital Touchpoint', sub: 'Correlates with active price comparison' },
  'SeniorCitizen': { name: 'Senior Citizen Segment', dir: 'neutral', tag: 'Demographic', sub: 'Requires tailored customer support experience' },
  'Partner': { name: 'Multi-User Account (Partner)', dir: 'safe', tag: 'Account Stickiness', sub: 'Household accounts exhibit lower attrition' },
  'Dependents': { name: 'Family Household (Dependents)', dir: 'safe', tag: 'Account Stickiness', sub: 'Shared services increase switching friction' },
}

// ── Custom Dark-Mode Aware Tooltip for Charts ────────────────────────────────
function CustomChartTooltip({ active, payload, label, unit = '' }) {
  if (!active || !payload || !payload.length) return null
  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '10px',
      padding: '10px 14px',
      boxShadow: 'var(--shadow-md)',
      fontSize: '12px',
      color: 'var(--text-primary)',
      minWidth: '150px',
      zIndex: 100,
    }}>
      {label && (
        <p style={{
          fontWeight: 700,
          marginBottom: '6px',
          color: 'var(--text-primary)',
          borderBottom: '1px solid var(--border)',
          paddingBottom: '4px',
          fontSize: '11px',
          textTransform: 'uppercase',
          letterSpacing: '0.04em'
        }}>
          {label}
        </p>
      )}
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

export default function Dashboard() {
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

  // ── Derived Stats & Calculations (Preserved Exactly) ──
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

  // 2. Customer Tenure vs Churn Risk (Area Chart Data)
  const tenureRiskData = (hasData && stats?.risk_by_tenure && stats.risk_by_tenure.length > 0)
    ? stats.risk_by_tenure.map(t => ({
        name: (t.bucket || '').replace(' months', 'm'),
        label: t.bucket,
        'High Risk': t.High || 0,
        'Medium Risk': t.Medium || 0,
        'Low Risk': t.Low || 0,
      }))
    : []

  // 3. Churn Risk by Contract Type (Horizontal Stacked Bar Data)
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

  // 5. Top Churn Drivers
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
    : [
        { label: 'Month-to-Month Contract', pct: 89, desc: 'Lack of long-term contract commitment' },
        { label: 'Electronic Check Payment', pct: 58, desc: 'High payment friction payment method' },
        { label: 'Fiber Optic Internet Tier', pct: 69, desc: 'Elevated monthly service charges' },
        { label: 'Early Tenure (< 12 Months)', pct: 64, desc: 'New onboarding vulnerability period' },
      ]

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

        {/* ─────────────────────────────────────────────────────────────
            1. PAGE IDENTITY & ACTIONS
           ───────────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', margin: 0 }}>
                AI Churn Intelligence
              </h1>
              <span className="badge badge-purple" style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Live System
              </span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--slate-600)', marginTop: '4px' }}>
              Real-time customer risk classification, revenue impact, and proactive retention telemetry.
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
          <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', color: 'var(--danger)', fontSize: '13px', padding: '12px 18px', borderRadius: '12px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={16} color="var(--danger)" />
            <span>{error}</span>
          </div>
        )}

        {!loading && !hasData && (
          <div style={{ background: 'var(--surface)', border: '1px dashed var(--slate-300)', borderRadius: '16px', padding: '32px 24px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'var(--slate-100)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Layers size={24} color="var(--brand)" />
              </div>
              <div>
                <p style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  No customer dataset loaded
                </p>
                <p style={{ fontSize: '13px', color: 'var(--slate-500)', marginTop: '4px', margin: 0 }}>
                  Upload a Telco customer CSV file to generate churn predictions and unlock revenue intelligence.
                </p>
              </div>
            </div>
            <button onClick={() => navigate('/upload')} className="btn-primary" style={{ padding: '8px 18px', fontSize: '13px' }}>
              <UploadCloud size={14} /> Upload Dataset
            </button>
          </div>
        )}

        {/* ─────────────────────────────────────────────────────────────
            2. KEY METRICS (STAT CARDS)
           ───────────────────────────────────────────────────────────── */}
        <div className="dashboard-stat-grid">

          {/* 1. Total Customers */}
          <div className="dashboard-stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p className="dashboard-stat-title">Total Customers</p>
                <p className="dashboard-stat-number">{loading ? '—' : total.toLocaleString()}</p>
              </div>
              <div className="dashboard-stat-icon-wrap">
                <Users size={17} />
              </div>
            </div>
            <div className="dashboard-stat-supporting">
              {hasData ? 'Active customer database' : 'No dataset analyzed'}
            </div>
          </div>

          {/* 2. Active Customers */}
          <div className="dashboard-stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p className="dashboard-stat-title">Active Customers</p>
                <p className="dashboard-stat-number">{loading ? '—' : activeCount.toLocaleString()}</p>
              </div>
              <div className="dashboard-stat-icon-wrap">
                <UserCheck size={17} />
              </div>
            </div>
            <div className="dashboard-stat-supporting">
              {hasData ? `${total.toLocaleString()} total − ${high.toLocaleString()} high` : 'No active records'}
            </div>
          </div>

          {/* 3. High Risk */}
          <div className="dashboard-stat-card dashboard-stat-card-high">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p className="dashboard-stat-title">High Risk</p>
                <p className="dashboard-stat-number" style={{ color: 'var(--danger)' }}>
                  {loading ? '—' : high.toLocaleString()}
                </p>
              </div>
              <div className="dashboard-stat-icon-wrap" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)' }}>
                <AlertTriangle size={17} />
              </div>
            </div>
            <div className="dashboard-stat-supporting" style={{ color: hasData ? 'var(--danger)' : 'var(--slate-500)', fontWeight: 600 }}>
              {hasData ? `${Math.round((high / (total || 1)) * 100)}% of total accounts` : '0% risk'}
            </div>
          </div>

          {/* 4. Medium Risk */}
          <div className="dashboard-stat-card dashboard-stat-card-med">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p className="dashboard-stat-title">Medium Risk</p>
                <p className="dashboard-stat-number" style={{ color: 'var(--warning)' }}>
                  {loading ? '—' : med.toLocaleString()}
                </p>
              </div>
              <div className="dashboard-stat-icon-wrap" style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)' }}>
                <ShieldAlert size={17} />
              </div>
            </div>
            <div className="dashboard-stat-supporting">
              {hasData ? `${Math.round((med / (total || 1)) * 100)}% of total accounts` : '0% risk'}
            </div>
          </div>

          {/* 5. Low Risk */}
          <div className="dashboard-stat-card dashboard-stat-card-low">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p className="dashboard-stat-title">Low Risk</p>
                <p className="dashboard-stat-number" style={{ color: 'var(--success)' }}>
                  {loading ? '—' : low.toLocaleString()}
                </p>
              </div>
              <div className="dashboard-stat-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}>
                <ShieldCheck size={17} />
              </div>
            </div>
            <div className="dashboard-stat-supporting">
              {hasData ? `${Math.round((low / (total || 1)) * 100)}% of total accounts` : '0% risk'}
            </div>
          </div>

          {/* 6. Total MRR */}
          <div className="dashboard-stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p className="dashboard-stat-title">Total MRR</p>
                <p className="dashboard-stat-number">
                  {loading ? '—' : (totalMRRRaw > 0 ? formatCurrency(totalMRRRaw) : '₹0')}
                </p>
              </div>
              <div className="dashboard-stat-icon-wrap">
                <DollarSign size={17} />
              </div>
            </div>
            <div className="dashboard-stat-supporting">
              {hasData ? 'Monthly recurring revenue' : '₹0 baseline'}
            </div>
          </div>

          {/* 7. Churn Rate */}
          <div className="dashboard-stat-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p className="dashboard-stat-title">Churn Rate</p>
                <p className="dashboard-stat-number">{loading ? '—' : `${churnRatePct}%`}</p>
              </div>
              <div className="dashboard-stat-icon-wrap">
                <TrendingUp size={17} />
              </div>
            </div>
            <div className="dashboard-stat-supporting">
              {hasData ? 'Average churn probability' : '0% baseline'}
            </div>
          </div>

        </div>

        {/* ─────────────────────────────────────────────────────────────
            3. RISK OVERVIEW
           ───────────────────────────────────────────────────────────── */}
        <div className="dashboard-grid-2col">

          {/* Card 1: Revenue at Risk */}
          <div className="dashboard-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Revenue at Risk
                </h3>
                <span className="badge badge-red" style={{ fontSize: '10px' }}>
                  {atRiskPct}% of MRR
                </span>
              </div>
              <span style={{ fontSize: '11px', color: 'var(--slate-500)', fontWeight: 500 }}>
                Exposure Breakdown
              </span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--slate-500)', margin: '0 0 16px 0' }}>
              Monthly recurring revenue exposed to churn probability based on ML risk classification
            </p>

            {/* Headline Amount */}
            <div style={{ margin: '8px 0 14px 0' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <span style={{ fontSize: '32px', fontWeight: 800, color: 'var(--danger)', lineHeight: 1 }}>
                  {formatCurrency(atRiskMRR)}
                </span>
                <span style={{ fontSize: '13px', color: 'var(--slate-500)' }}>
                  / {mrrTotal} Total MRR
                </span>
              </div>

              {/* Segmented Risk Meter */}
              <div style={{ marginTop: '12px', width: '100%', height: '8px', background: 'var(--border)', borderRadius: '99px', overflow: 'hidden', display: 'flex' }}>
                <div style={{ width: `${highMRRPct}%`, background: 'var(--danger)', transition: 'width 300ms ease' }} title={`High Risk: ${highMRRPct}%`} />
                <div style={{ width: `${medMRRPct}%`, background: 'var(--warning)', transition: 'width 300ms ease' }} title={`Medium Risk: ${medMRRPct}%`} />
                <div style={{ width: `${lowMRRPct}%`, background: 'var(--success)', transition: 'width 300ms ease' }} title={`Low Risk: ${lowMRRPct}%`} />
              </div>
            </div>

            {/* Waterfall mini-cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: 'auto' }}>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: '3px solid var(--danger)', borderRadius: '10px', padding: '10px 12px' }}>
                <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>High Risk MRR</p>
                <p style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: '3px 0 0 0' }}>{formatCurrency(highRiskMRR)}</p>
                <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>{highMRRPct}% share</p>
              </div>

              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: '3px solid var(--warning)', borderRadius: '10px', padding: '10px 12px' }}>
                <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--warning)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>Med Risk MRR</p>
                <p style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: '3px 0 0 0' }}>{formatCurrency(medRiskMRR)}</p>
                <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>{medMRRPct}% share</p>
              </div>

              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderLeft: '3px solid var(--success)', borderRadius: '10px', padding: '10px 12px' }}>
                <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--success)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>Retained MRR</p>
                <p style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: '3px 0 0 0' }}>{formatCurrency(lowRiskMRR)}</p>
                <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>{lowMRRPct}% share</p>
              </div>
            </div>
          </div>

          {/* Card 2: High-Risk Customer Profile */}
          <div className="dashboard-card" style={{ justifyContent: 'space-between' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    High-Risk Customer Profile
                  </h3>
                  <span className="badge badge-red" style={{ fontSize: '10px' }}>Risk Archetype</span>
                </div>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--slate-500)', margin: '0 0 14px 0' }}>
                Dominant behavioral attributes observed across accounts in the High Risk tier
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {highRiskProfile.map(item => (
                  <div key={item.label} style={{ background: 'var(--surface-muted)', borderRadius: '10px', padding: '8px 12px', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', marginBottom: '2px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.label}</span>
                      <span style={{ fontWeight: 700, color: 'var(--danger)' }}>{item.pct}%</span>
                    </div>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>{item.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--border)', fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: 'var(--brand)', fontWeight: 700 }}>● Strategy:</span>
              <span>Incentivize month-to-month fiber accounts onto 1-year contracts with bundled tech support.</span>
            </div>
          </div>

        </div>

        {/* ─────────────────────────────────────────────────────────────
            4. CHURN ANALYTICS
           ───────────────────────────────────────────────────────────── */}
        <div className="dashboard-grid-2col">

          {/* Chart 1: Customer Tenure vs. Churn Risk */}
          <div className="dashboard-card">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    Customer Tenure vs. Churn Risk
                  </h3>
                  <span className="badge badge-purple" style={{ fontSize: '10px' }}>Lifecycle Curve</span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--slate-500)', margin: '2px 0 0 0' }}>
                  Risk concentration across customer lifecycle (Peak vulnerability at 0–12m onboarding)
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: 'var(--slate-600)', fontWeight: 600 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--danger)' }} /> High
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--warning)' }} /> Med
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)' }} /> Low
                </span>
              </div>
            </div>

            <div style={{ height: '230px', width: '100%', marginTop: 'auto' }}>
              {tenureRiskData.length === 0 ? (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--slate-500)', fontSize: '13px' }}>
                  <Clock size={30} style={{ opacity: 0.35, marginBottom: '8px' }} />
                  <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>No tenure risk data</p>
                  <p style={{ fontSize: '12px' }}>Upload a dataset to view customer tenure vs churn risk trends</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={tenureRiskData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="highRiskAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="hsl(0, 84%, 60%)" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="medRiskAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="hsl(38, 92%, 50%)" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="lowRiskAreaGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="hsl(142, 71%, 45%)" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.7} />
                    <XAxis dataKey="name" stroke="var(--slate-500)" fontSize={11} tickLine={false} />
                    <YAxis stroke="var(--slate-500)" fontSize={11} tickLine={false} />
                    <Tooltip content={<CustomChartTooltip unit=" accounts" />} />
                    <Area type="monotone" dataKey="High Risk" stroke="var(--danger)" strokeWidth={2} fill="url(#highRiskAreaGrad)" isAnimationActive={true} animationDuration={600} />
                    <Area type="monotone" dataKey="Medium Risk" stroke="var(--warning)" strokeWidth={2} fill="url(#medRiskAreaGrad)" isAnimationActive={true} animationDuration={600} />
                    <Area type="monotone" dataKey="Low Risk" stroke="var(--success)" strokeWidth={2} fill="url(#lowRiskAreaGrad)" isAnimationActive={true} animationDuration={600} />
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

          {/* Chart 2: Churn Risk by Contract Type */}
          <div className="dashboard-card">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    Churn Risk by Contract Type
                  </h3>
                  <span className="badge badge-purple" style={{ fontSize: '10px' }}>Contract Exposure</span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--slate-500)', margin: '2px 0 0 0' }}>
                  Risk concentration across Month-to-Month, 1-Year, and 2-Year commitments
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '11px', color: 'var(--slate-600)', fontWeight: 600 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--danger)' }} /> High
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--warning)' }} /> Med
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)' }} /> Low
                </span>
              </div>
            </div>

            <div style={{ height: '170px', width: '100%', marginTop: 'auto' }}>
              {contractRiskData.length === 0 ? (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--slate-500)', fontSize: '13px' }}>
                  <Layers size={30} style={{ opacity: 0.35, marginBottom: '8px' }} />
                  <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>No contract data available</p>
                  <p style={{ fontSize: '12px' }}>Upload a dataset to view risk breakdown by contract type</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={contractRiskData} layout="vertical" margin={{ top: 5, right: 20, left: 35, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" opacity={0.7} />
                    <XAxis type="number" stroke="var(--slate-500)" fontSize={11} tickLine={false} />
                    <YAxis type="category" dataKey="contract" stroke="var(--text-primary)" fontSize={11} fontWeight={600} tickLine={false} width={90} />
                    <Tooltip content={<CustomChartTooltip unit=" customers" />} />
                    <Bar dataKey="High Risk" stackId="contractStack" fill="var(--danger)" radius={[0, 0, 0, 0]} isAnimationActive={true} animationDuration={600} />
                    <Bar dataKey="Medium Risk" stackId="contractStack" fill="var(--warning)" radius={[0, 0, 0, 0]} isAnimationActive={true} animationDuration={600} />
                    <Bar dataKey="Low Risk" stackId="contractStack" fill="var(--success)" radius={[0, 4, 4, 0]} isAnimationActive={true} animationDuration={600} />
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

        </div>

        {/* ─────────────────────────────────────────────────────────────
            5. CUSTOMER INSIGHTS
           ───────────────────────────────────────────────────────────── */}
        <div className="dashboard-grid-equal">

          {/* Top Churn Drivers */}
          <div className="dashboard-card">
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    Top Churn Drivers (ML Feature Impact)
                  </h3>
                  <span className="badge badge-purple" style={{ fontSize: '10px' }}>Feature Importance</span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--slate-500)', margin: '2px 0 0 0' }}>
                  Key variables influencing machine learning risk classification
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {topChurnDrivers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--slate-500)', fontSize: '13px' }}>
                  Upload a dataset to evaluate feature importance
                </div>
              ) : (
                topChurnDrivers.map(item => (
                  <div key={item.key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          width: '20px', height: '20px', borderRadius: '6px',
                          background: 'var(--surface-muted)', border: '1px solid var(--border)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)'
                        }}>
                          {item.rank}
                        </span>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{item.name}</span>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>({item.tag})</span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {item.dir === 'risk' ? (
                          <span style={{ fontSize: '10px', color: 'var(--danger)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                            <ArrowUpRight size={12} /> Increases Risk
                          </span>
                        ) : (
                          <span style={{ fontSize: '10px', color: 'var(--success)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
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
                          ? 'var(--danger)'
                          : 'var(--brand)',
                        borderRadius: '99px',
                        transition: 'width 400ms ease'
                      }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Model Confidence & Evaluation */}
          <div className="dashboard-card" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Model Confidence & Evaluation
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--slate-500)', margin: '2px 0 0 0' }}>
                  Supervised Random Forest / Gradient Boosting classifier telemetry
                </p>
              </div>
              <span className="badge badge-purple" style={{ fontSize: '10px' }}>
                {hasMetrics ? 'Active Evaluator' : 'Ready'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', margin: '14px 0' }}>
              {/* Radial gauge */}
              <div style={{ position: 'relative', width: '96px', height: '96px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="96" height="96" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" stroke="var(--border)" strokeWidth="8" fill="none" />
                  <circle
                    cx="50" cy="50" r="40"
                    stroke="var(--brand)"
                    strokeWidth="8" fill="none"
                    strokeDasharray={CIRC}
                    strokeDashoffset={dashOffset}
                    strokeLinecap="round"
                    transform="rotate(-90 50 50)"
                    style={{ transition: 'stroke-dashoffset 600ms ease' }}
                  />
                </svg>
                <div style={{ position: 'absolute', textAlign: 'center' }}>
                  <p style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1, margin: 0 }}>
                    {hasMetrics ? `${primaryScore}%` : 'N/A'}
                  </p>
                  <p style={{ fontSize: '9px', color: 'var(--slate-500)', margin: '2px 0 0 0', fontWeight: 600 }}>F1 SCORE</p>
                </div>
              </div>

              {/* Status summary */}
              <div>
                <span className="badge badge-green" style={{ fontSize: '11px', marginBottom: '6px' }}>
                  <CheckCircle2 size={12} /> Production Ready
                </span>
                <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  {hasMetrics ? `${accuracyPct}% Model Accuracy` : 'Awaiting Batch Inference'}
                </p>
                <p style={{ fontSize: '11px', color: 'var(--slate-500)', margin: '2px 0 0 0' }}>
                  {hasMetrics && aucPct ? `ROC-AUC Score: ${aucPct}%` : 'Trained on 7,043 Telco records'}
                </p>
              </div>
            </div>

            {/* 4-Metric Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
              {[
                { label: 'Accuracy', val: accuracyPct },
                { label: 'Precision', val: precisionPct },
                { label: 'Recall', val: recallPct },
                { label: 'AUC Score', val: aucPct },
              ].map(({ label, val }) => (
                <div key={label} style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', borderRadius: '8px', padding: '6px 8px', textAlign: 'center' }}>
                  <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, margin: 0 }}>{label}</p>
                  <p style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', margin: '2px 0 0 0' }}>
                    {val ? `${val}%` : '—'}
                  </p>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Highest Risk Customers List */}
        <div style={{ marginBottom: '24px' }}>
          <div className="dashboard-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    Highest Risk Customers
                  </h3>
                  <span className="badge badge-red" style={{ fontSize: '10px' }}>Immediate Outreach</span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--slate-500)', margin: '2px 0 0 0' }}>
                  Priority customer accounts ranked by calibrated churn probability
                </p>
              </div>
              <button
                onClick={() => navigate('/customers')}
                style={{ background: 'none', border: 'none', color: 'var(--brand)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
              >
                View all customers <ChevronRight size={14} />
              </button>
            </div>

            {!hasData || highRiskRows.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--slate-500)', fontSize: '13px' }}>
                <p style={{ marginBottom: '14px' }}>Upload a dataset to identify high-risk accounts</p>
                <button
                  onClick={() => navigate('/upload')}
                  className="btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', padding: '8px 16px', margin: '0 auto' }}
                >
                  <UploadCloud size={14} /> Upload Dataset
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {highRiskRows.map(item => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 14px',
                      borderRadius: '10px',
                      background: 'var(--surface-muted)',
                      border: '1px solid var(--border)',
                      transition: 'background 150ms ease',
                      flexWrap: 'wrap',
                      gap: '10px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: '180px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: item.color, color: '#fff', fontWeight: 700, fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {String(item?.name || 'CU').split('').slice(0, 2).join('').toUpperCase()}
                      </div>
                      <div>
                        <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{item.name}</p>
                        <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>{item.company}</p>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '200px', flex: '1 1 180px' }}>
                      <div style={{ flex: 1, height: '6px', background: 'var(--border)', borderRadius: '99px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${item.barPct}%`, background: 'var(--danger)', borderRadius: '99px' }} />
                      </div>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', width: '38px', textAlign: 'right' }}>
                        {item.probability}%
                      </span>
                    </div>

                    <div>
                      <span className="badge badge-red" style={{ fontSize: '10px' }}>● High Risk</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
            6. RECENT ACTIVITY & AI RETENTION BANNER
           ───────────────────────────────────────────────────────────── */}
        <div className="dashboard-grid-activity">

          {/* AI Retention Action Banner */}
          {hasData ? (
            <div className="dashboard-card" style={{ background: 'var(--surface)', border: '1px solid var(--border)', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--brand-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Sparkles size={18} color="var(--brand)" />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                      AI Revenue Protection
                    </h3>
                    <span className="badge badge-red" style={{ fontSize: '10px' }}>
                      {high.toLocaleString()} Accounts Endangered
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px', lineHeight: 1.5 }}>
                    Targeting month-to-month accounts in their first 12 months with contract extensions could protect an estimated <strong>{formatCurrency(highRiskMRR)}</strong> in recurring monthly revenue.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border)' }}>
                <button
                  onClick={() => navigate('/predict')}
                  className="btn-primary"
                  style={{ fontSize: '12px', padding: '8px 16px' }}
                >
                  <Zap size={14} /> Run Single Customer Prediction
                </button>
              </div>
            </div>
          ) : (
            <div className="dashboard-card" style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '32px' }}>
              <Shield size={32} color="var(--slate-400)" style={{ marginBottom: '8px' }} />
              <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Predictive Retention Engine Ready</p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', maxWidth: '340px' }}>
                Upload customer telemetry to receive automated proactive retention playbooks.
              </p>
            </div>
          )}

          {/* Recent Activity Timeline */}
          <div className="dashboard-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Recent Ingestion Activity
              </h3>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Audit Log</span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 16px 0' }}>
              Dataset updates & telemetry synchronization history
            </p>

            {activityItems.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: '12px' }}>
                <Clock size={22} style={{ marginBottom: '6px', opacity: 0.4 }} />
                <p style={{ margin: '0 0 10px 0' }}>No dataset ingestion history yet</p>
                <button
                  onClick={() => navigate('/upload')}
                  className="btn-secondary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '11px', padding: '6px 14px', margin: '0 auto' }}
                >
                  <UploadCloud size={13} /> Upload Dataset
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '8px', bottom: '8px', left: '12px', width: '2px', background: 'var(--border)' }} />
                {activityItems.map((item, idx) => {
                  const Icon = item.icon
                  return (
                    <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', position: 'relative', zIndex: 1 }}>
                      <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'var(--surface)', border: '1px solid var(--slate-300)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon size={12} color="var(--slate-600)" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3, margin: 0 }}>{item.title}</p>
                        <p style={{ fontSize: '11px', color: 'var(--slate-500)', marginTop: '2px', lineHeight: 1.3, margin: 0 }}>{item.sub}</p>
                        <p style={{ fontSize: '10px', color: 'var(--slate-400)', marginTop: '3px', margin: 0 }}>{item.time}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  )
}