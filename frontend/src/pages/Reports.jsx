import { useState, useEffect, useCallback } from 'react'
import Sidebar from '../components/Sidebar'
import Header from '../components/Header'
import toast from 'react-hot-toast'
import { downloadReport } from '../api/reports'
import { getDashboardStats } from '../api/dashboard'
import { Download, Printer, Eye, FileText, Clock, X, AlertCircle, Users, BarChart2, DollarSign } from 'lucide-react'

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
    } catch (err) {
      console.warn('Could not load dashboard stats for reports preview:', err.message)
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
    const rows = (stats.results ?? []).slice(0, 5).map(r => ({
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
      title: 'Revenue Impact Analysis — Top At-Risk Customers',
      type:  'Real data from last batch analysis',
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
    ]
    setPreviewModal({
      title: 'Executive Summary — Real Metrics',
      type:  'From /dashboard/stats API',
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
          title="Reports"
          subtitle="Download and preview churn analysis reports."
          onRefresh={loadStats}
          isRefreshing={loadingStats}
        />

        {/* Live data summary strip */}
        {!loadingStats && (
          <div className="reports-stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '24px' }}>
            <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Users size={18} color="var(--purple-600)" />
              <div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Customers Analyzed</p>
                <p style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {hasStats ? stats.total_analyzed.toLocaleString() : '—'}
                </p>
              </div>
            </div>
            <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <BarChart2 size={18} color="#DC2626" />
              <div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>High-Risk Accounts</p>
                <p style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {hasStats ? stats.high_risk_count.toLocaleString() : '—'}
                </p>
              </div>
            </div>
            <div className="card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <DollarSign size={18} color="#22C55E" />
              <div>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Monthly Revenue</p>
                <p style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {hasStats && stats.total_mrr != null ? formatCurrency(stats.total_mrr) : '—'}
                </p>
              </div>
            </div>
          </div>
        )}

        {!hasStats && !loadingStats && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.2)', borderRadius: '12px', padding: '12px 16px', marginBottom: '20px', fontSize: '13px', color: '#D97706' }}>
            <AlertCircle size={16} />
            No analysis data yet. Run batch analysis from the Dashboard first to generate reports with real data.
          </div>
        )}

        {/* ── Available Reports ── */}
        <div className="reports-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '28px' }}>

          {/* Card 1: Revenue Impact Analysis */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{ width: '42px', height: '42px', background: '#F0FDF4', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileText size={22} color="#22C55E" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Customer Risk Export</h3>
                  <span className="badge badge-green" style={{ fontSize: '10px' }}>CSV</span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Full ML risk report for all customers — exported from live predictions.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => handleDownload('All')}
                disabled={downloading === 'All'}
                className="btn-primary"
                style={{ flex: 1, padding: '10px', fontSize: '13px', justifyContent: 'center' }}
              >
                <Download size={15} /> {downloading === 'All' ? 'Downloading…' : 'Download All'}
              </button>
              <button
                onClick={() => handleDownload('High')}
                disabled={downloading === 'High'}
                className="btn-secondary"
                style={{ padding: '10px 16px', fontSize: '13px' }}
              >
                {downloading === 'High' ? 'Downloading…' : 'High Risk Only'}
              </button>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
              <button
                onClick={() => handleDownload('Medium')}
                disabled={downloading === 'Medium'}
                className="btn-secondary"
                style={{ flex: 1, padding: '8px', fontSize: '12px', justifyContent: 'center' }}
              >
                Medium Risk
              </button>
              <button
                onClick={() => handleDownload('Low')}
                disabled={downloading === 'Low'}
                className="btn-secondary"
                style={{ flex: 1, padding: '8px', fontSize: '12px', justifyContent: 'center' }}
              >
                Low Risk
              </button>
            </div>
          </div>

          {/* Card 2: Executive Print Report */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{ width: '42px', height: '42px', background: 'var(--purple-50)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileText size={22} color="var(--purple-600)" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Executive Summary</h3>
                  <span className="badge badge-purple" style={{ fontSize: '10px' }}>Preview / Print</span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Key metrics summary from real backend data.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handlePrint}
                className="btn-primary"
                style={{ flex: 1, padding: '10px', fontSize: '13px', justifyContent: 'center' }}
              >
                <Printer size={15} /> Print
              </button>
              <button
                onClick={openExecutivePreview}
                className="btn-secondary"
                style={{ padding: '10px 16px', fontSize: '13px' }}
              >
                <Eye size={15} /> Preview
              </button>
            </div>

            <div style={{ marginTop: '10px' }}>
              <button
                onClick={openRevenuePreview}
                className="btn-secondary"
                style={{ width: '100%', padding: '8px', fontSize: '12px', justifyContent: 'center' }}
              >
                <Eye size={14} /> Preview Top At-Risk Customers
              </button>
            </div>
          </div>

        </div>

        {/* ── Scheduled Reports — honest "not yet available" notice ── */}
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Scheduled Reports</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Automated reports delivered to your inbox</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 20px', textAlign: 'center', gap: '12px' }}>
            <div style={{ width: '56px', height: '56px', background: 'var(--surface-hover)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Clock size={26} color="var(--text-muted)" style={{ opacity: 0.5 }} />
            </div>
            <p style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Report Scheduling Not Yet Available</p>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '400px', lineHeight: 1.7 }}>
              Automated scheduled reports require backend cron infrastructure that is not yet implemented.
              Use the manual download buttons above to export reports on demand.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.2)', borderRadius: '10px', padding: '10px 16px', fontSize: '12px', color: '#d97706' }}>
              <AlertCircle size={14} />
              This feature will be available in a future release.
            </div>
          </div>
        </div>

      </div>

      {/* ── Report Preview Modal — real data only ── */}
      {previewModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="card" style={{ width: '580px', maxWidth: '100%', padding: '24px', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{previewModal.title}</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{previewModal.type}</p>
              </div>
              <button onClick={() => setPreviewModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ background: 'var(--surface-hover)', borderRadius: '12px', padding: '16px', marginBottom: '20px', overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <tbody>
                  {previewModal.rows.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                      {Object.entries(row).map(([k, v]) => (
                        <td key={k} style={{ padding: '8px 10px', color: 'var(--text-primary)', fontWeight: k === 'metric' || k === 'customerID' ? 700 : 500 }}>
                          {v}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => setPreviewModal(null)} className="btn-secondary" style={{ padding: '8px 16px', fontSize: '13px' }}>
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
