import { useState, useEffect, useCallback } from 'react'
import Sidebar from '../components/Sidebar'
import Header from '../components/Header'
import toast from 'react-hot-toast'
import { downloadReport } from '../api/reports'
import { getDashboardStats } from '../api/dashboard'
import { Download, Printer, Eye, FileText, Clock, X, AlertCircle, Users, BarChart2, DollarSign, CheckCircle2 } from 'lucide-react'

function formatCurrency(val) {
  if (!val && val !== 0) return '—'
  if (val >= 10_000_000) return `₹${(val / 10_000_000).toFixed(1)}Cr`
  if (val >= 100_000)    return `₹${(val / 100_000).toFixed(1)}L`
  if (val >= 1_000)      return `₹${(val / 1_000).toFixed(1)}K`
  return `₹${Math.round(val).toLocaleString('en-IN')}`
}

function Reports() {
  const [downloading, setDownloading] = useState('')
  const [stats,       setStats]       = useState(null)
  const [loadingStats, setLoadingStats] = useState(true)
  const [previewModal, setPreviewModal] = useState(null)

  const loadStats = useCallback(async () => {
    setLoadingStats(true)
    try {
      const data = await getDashboardStats()
      if (data?.available) setStats(data)
    } catch {
      // Non-fatal: reports page still usable without stats
    } finally {
      setLoadingStats(false)
    }
  }, [])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  async function handleDownload(riskLevel) {
    setDownloading(riskLevel)
    try {
      await downloadReport(riskLevel)
      toast.success(`Download started: Customer Risk Export (${riskLevel})`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setDownloading('')
    }
  }

  function handlePrint() {
    window.print()
  }

  // Build preview rows from real API data
  function openRevenuePreview() {
    if (!stats) {
      toast.error('No analysis data available. Run batch analysis from Dashboard first.')
      return
    }
    const rows = (stats.results ?? []).slice(0, 8).map(r => ({
      customerID:  r.customerID || '—',
      contract:    r.Contract   || '—',
      churnProb:   `${Math.round(r.churn_probability ?? 0)}%`,
      riskLevel:   r.risk_level || '—',
    }))
    if (rows.length === 0) {
      toast.error('No prediction results available. Run batch analysis first.')
      return
    }
    setPreviewModal({
      title: 'Top At-Risk Customers — Revenue Impact',
      type:  'Real data from batch analysis',
      isCustomerTable: true,
      rows,
    })
  }

  function openExecutivePreview() {
    if (!stats) {
      toast.error('No analysis data available. Run batch analysis from Dashboard first.')
      return
    }
    const rows = [
      { metric: 'Total Customers Analyzed', value: stats.total_analyzed?.toLocaleString() ?? '—' },
      { metric: 'High-Risk Customers',       value: stats.high_risk_count?.toLocaleString() ?? '—' },
      { metric: 'Average Churn Rate',        value: stats.avg_churn_rate != null ? `${stats.avg_churn_rate}%` : '—' },
      { metric: 'Total Monthly Revenue',     value: stats.total_mrr != null ? formatCurrency(stats.total_mrr) : '—' },
      { metric: 'Model Status',              value: 'Active (Logistic Regression & LightGBM)' },
      { metric: 'Pipeline Version',          value: 'v2.4 Production Engine' }
    ]
    setPreviewModal({
      title: 'Executive Summary — Live Metrics',
      type:  'From /dashboard/stats API',
      isCustomerTable: false,
      rows,
    })
  }

  const hasStats = !!stats && stats.total_analyzed > 0

  return (
    <div className="page-layout">
      <Sidebar />
      <div className="page-content" style={{ padding: '24px 32px' }}>

        {/* ── Top Navbar ── */}
        <Header
          title="Reports & Data Export"
          subtitle="Generate, preview, and export high-fidelity customer risk telemetry and executive summaries."
          onRefresh={loadStats}
          isRefreshing={loadingStats}
        />

        {/* Live data summary strip (Slate Stat Cards) */}
        {!loadingStats && (
          <div className="reports-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
            <div className="dashboard-stat-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span className="dashboard-stat-title">Customers Analyzed</span>
                <div className="dashboard-stat-icon-wrap">
                  <Users size={18} />
                </div>
              </div>
              <p className="dashboard-stat-number">
                {hasStats ? stats.total_analyzed.toLocaleString() : '—'}
              </p>
              <p className="dashboard-stat-supporting">Active accounts in current batch</p>
            </div>

            <div className="dashboard-stat-card dashboard-stat-card-high">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span className="dashboard-stat-title">High-Risk Accounts</span>
                <div className="dashboard-stat-icon-wrap" style={{ color: 'var(--danger)' }}>
                  <BarChart2 size={18} />
                </div>
              </div>
              <p className="dashboard-stat-number" style={{ color: 'var(--danger)' }}>
                {hasStats ? stats.high_risk_count.toLocaleString() : '—'}
              </p>
              <p className="dashboard-stat-supporting" style={{ color: 'var(--danger)', fontWeight: 600 }}>
                {hasStats && stats.total_analyzed ? `${((stats.high_risk_count / stats.total_analyzed) * 100).toFixed(1)}% of total cohort` : 'Critical attention needed'}
              </p>
            </div>

            <div className="dashboard-stat-card dashboard-stat-card-low">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span className="dashboard-stat-title">Monthly Revenue</span>
                <div className="dashboard-stat-icon-wrap" style={{ color: 'var(--success)' }}>
                  <DollarSign size={18} />
                </div>
              </div>
              <p className="dashboard-stat-number" style={{ color: 'var(--text-primary)' }}>
                {hasStats && stats.total_mrr != null ? formatCurrency(stats.total_mrr) : '—'}
              </p>
              <p className="dashboard-stat-supporting" style={{ color: 'var(--success)', fontWeight: 600 }}>
                Active recurring MRR
              </p>
            </div>
          </div>
        )}

        {!hasStats && !loadingStats && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            background: 'hsla(38, 92%, 50%, 0.08)', border: '1px solid hsla(38, 92%, 50%, 0.25)',
            borderRadius: '12px', padding: '14px 18px', marginBottom: '24px',
            fontSize: '13px', color: 'hsl(38, 92%, 40%)'
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <span>No analysis data found yet. Run batch analysis from the Dashboard or Upload page to populate live exports.</span>
          </div>
        )}

        {/* ── Available Reports (Clean Report Cards) ── */}
        <div className="reports-grid">

          {/* Card 1: Customer Risk Export */}
          <div className="reports-card">
            <div>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '44px', height: '44px', borderRadius: '12px',
                    background: 'var(--brand-subtle)', color: 'var(--brand)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <FileText size={22} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                      Customer Risk Export
                    </h3>
                    <p style={{ fontSize: '12px', color: 'var(--slate-500)', margin: '2px 0 0 0' }}>
                      Full ML risk report with churn probabilities and cohort tags
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <span className="badge badge-green">Ready</span>
                  <span className="badge badge-slate">CSV</span>
                </div>
              </div>

              <p style={{ fontSize: '13px', color: 'var(--slate-600)', lineHeight: 1.5, marginBottom: '20px' }}>
                Export comprehensive customer telemetry, churn risk scores, contract durations, and recommended intervention actions directly to CSV.
              </p>
            </div>

            <div>
              {/* Primary Download (Brand Accent) */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <button
                  onClick={() => handleDownload('All')}
                  disabled={downloading === 'All'}
                  className="btn-primary"
                  style={{ flex: 1, padding: '10px 16px', fontSize: '13px', justifyContent: 'center' }}
                >
                  <Download size={15} /> {downloading === 'All' ? 'Downloading CSV…' : 'Download All Customers'}
                </button>

                {/* Secondary Download (Slate) */}
                <button
                  onClick={() => handleDownload('High')}
                  disabled={downloading === 'High'}
                  className="btn-secondary"
                  style={{ padding: '10px 16px', fontSize: '13px', whiteSpace: 'nowrap' }}
                >
                  {downloading === 'High' ? 'Downloading…' : 'High Risk Only'}
                </button>
              </div>

              {/* Segment Secondary Filters (Slate) */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => handleDownload('Medium')}
                  disabled={downloading === 'Medium'}
                  className="btn-secondary"
                  style={{ flex: 1, padding: '8px', fontSize: '12px', justifyContent: 'center' }}
                >
                  Medium Risk Only
                </button>
                <button
                  onClick={() => handleDownload('Low')}
                  disabled={downloading === 'Low'}
                  className="btn-secondary"
                  style={{ flex: 1, padding: '8px', fontSize: '12px', justifyContent: 'center' }}
                >
                  Low Risk Only
                </button>
              </div>
            </div>
          </div>

          {/* Card 2: Executive Print Report */}
          <div className="reports-card">
            <div>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '44px', height: '44px', borderRadius: '12px',
                    background: 'var(--surface-muted)', color: 'var(--text-secondary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <BarChart2 size={22} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                      Executive Summary & PDF
                    </h3>
                    <p style={{ fontSize: '12px', color: 'var(--slate-500)', margin: '2px 0 0 0' }}>
                      Executive presentation brief and KPI printout
                    </p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <span className="badge badge-blue">Ready</span>
                  <span className="badge badge-slate">Print / PDF</span>
                </div>
              </div>

              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '20px' }}>
                Generate print-optimized executive reports detailing retention trends, MRR impact analysis, model accuracy, and top critical accounts.
              </p>
            </div>

            <div>
              {/* Primary Print Button (Brand Accent) */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                <button
                  onClick={handlePrint}
                  className="btn-primary"
                  style={{ flex: 1, padding: '10px 16px', fontSize: '13px', justifyContent: 'center' }}
                >
                  <Printer size={15} /> Print / Save as PDF
                </button>

                {/* Secondary Preview Button (Slate) */}
                <button
                  onClick={openExecutivePreview}
                  className="btn-secondary"
                  style={{ padding: '10px 16px', fontSize: '13px' }}
                >
                  <Eye size={15} /> Summary
                </button>
              </div>

              {/* Secondary Preview Top Customers (Slate) */}
              <div>
                <button
                  onClick={openRevenuePreview}
                  className="btn-secondary"
                  style={{ width: '100%', padding: '8px', fontSize: '12px', justifyContent: 'center' }}
                >
                  <Eye size={14} /> Preview Top At-Risk Accounts Table
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* ── Scheduled Reports Notice (Clean Slate Card) ── */}
        <div className="reports-card" style={{ padding: '28px 32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Clock size={18} style={{ color: 'var(--text-muted)' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Automated Scheduled Reports
              </h3>
            </div>
            <span className="badge badge-yellow">Planned Cron Infrastructure</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px 20px', textAlign: 'center', gap: '10px' }}>
            <div style={{
              width: '52px', height: '52px', background: 'var(--surface-muted)',
              borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)'
            }}>
              <Clock size={24} />
            </div>
            <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: '4px 0 0 0' }}>
              Automated Report Scheduling
            </p>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '440px', lineHeight: 1.6, margin: 0 }}>
              Automated recurring reports require backend cron worker infrastructure that is currently scheduled for upcoming platform cycles.
              You can export live data on demand at any time using the CSV and print controls above.
            </p>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: 'var(--surface-muted)', borderRadius: '10px',
              padding: '8px 14px', fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px'
            }}>
              <CheckCircle2 size={14} style={{ color: 'var(--brand)' }} />
              <span>Manual on-demand exports and live data queries are fully operational.</span>
            </div>
          </div>
        </div>

      </div>

      {/* ── Report Preview Modal (Slate System Tables) ── */}
      {previewModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex',
          alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div className="dashboard-card" style={{
            width: '640px', maxWidth: '100%', padding: '28px',
            position: 'relative', background: 'var(--surface)',
            border: '1px solid var(--border)', borderRadius: '16px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px' }}>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  {previewModal.title}
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--slate-500)', marginTop: '2px' }}>
                  {previewModal.type}
                </p>
              </div>
              <button
                onClick={() => setPreviewModal(null)}
                aria-label="Close preview modal"
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--slate-400)', padding: '4px', display: 'flex'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Slate System Table Container */}
            <div className="analytics-table-wrap" style={{ marginBottom: '20px', maxHeight: '360px', overflowY: 'auto' }}>
              <table className="analytics-table">
                {previewModal.isCustomerTable ? (
                  <>
                    <thead>
                      <tr>
                        <th>Customer ID</th>
                        <th>Contract</th>
                        <th>Churn Probability</th>
                        <th>Risk Tier</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewModal.rows.map((row, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.customerID}</td>
                          <td>{row.contract}</td>
                          <td style={{ fontWeight: 700 }}>{row.churnProb}</td>
                          <td>
                            {row.riskLevel === 'High' ? (
                              <span className="badge badge-red">High Risk</span>
                            ) : row.riskLevel === 'Medium' ? (
                              <span className="badge badge-yellow">Medium Risk</span>
                            ) : (
                              <span className="badge badge-green">Low Risk</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                ) : (
                  <>
                    <thead>
                      <tr>
                        <th>Metric / Parameter</th>
                        <th>Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewModal.rows.map((row, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.metric}</td>
                          <td style={{ fontWeight: 700, color: 'var(--brand)' }}>{row.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </>
                )}
              </table>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => setPreviewModal(null)}
                className="btn-secondary"
                style={{ padding: '8px 18px', fontSize: '13px' }}
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default Reports
