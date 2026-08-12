import { useState } from 'react'
import Sidebar from '../components/Sidebar'
import Header from '../components/Header'
import toast from 'react-hot-toast'
import { downloadReport } from '../api/reports'
import { Download, Printer, Eye, Calendar, FileText, Plus, Clock, X, Save, Edit2 } from 'lucide-react'

const initialScheduledReports = [
  { id: '1', name: 'Weekly Churn Digest', schedule: 'Every Monday 9:00 AM', nextRun: 'Aug 11, 2026', format: 'PDF' },
  { id: '2', name: 'Monthly Executive Summary', schedule: '1st of every month', nextRun: 'Sep 01, 2026', format: 'PDF' },
  { id: '3', name: 'Daily Risk Alert', schedule: 'Every day 7:00 AM', nextRun: 'Tomorrow', format: 'CSV' },
]

function Reports() {
  const [downloading, setDownloading] = useState('')
  const [scheduledReports, setScheduledReports] = useState(initialScheduledReports)

  // Preview Modal State
  const [previewModal, setPreviewModal] = useState(null) // { title: string, rows: [] }

  // Edit Schedule Modal State
  const [editingSchedule, setEditingSchedule] = useState(null) // report object or null

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

  function handleSaveSchedule(e) {
    e.preventDefault()
    if (!editingSchedule) return
    setScheduledReports(prev => prev.map(item => item.id === editingSchedule.id ? editingSchedule : item))
    toast.success(`Updated schedule for ${editingSchedule.name}`)
    setEditingSchedule(null)
  }

  function handleAddNewSchedule() {
    const newId = String(Date.now())
    const newItem = { id: newId, name: 'Custom Risk Digest', schedule: 'Every Friday 5:00 PM', nextRun: 'Aug 15, 2026', format: 'PDF' }
    setScheduledReports(prev => [...prev, newItem])
    toast.success('Added new scheduled report')
  }

  return (
    <div className="page-layout">
      <Sidebar />
      <div className="page-content" style={{ padding: '24px 32px' }}>

        <Header title="Reports" subtitle="Welcome back, Maya — here's your churn outlook." />

        {/* ── Top Section: Available Reports (Matching Image 1 & 2) ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '28px' }}>
          
          {/* Card 1: Revenue Impact Analysis */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{ width: '42px', height: '42px', background: '#f0fdf4', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileText size={22} color="#16a34a" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Revenue Impact Analysis</h3>
                  <span className="badge badge-green" style={{ fontSize: '10px' }}>Excel</span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Projected MRR impact from predicted churn over the next 90 days.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              <span>📅 Aug 02, 2026</span>
              <span>📦 2.4 MB</span>
              <span>📊 6,240 rows</span>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => handleDownload('All')}
                disabled={downloading === 'All'}
                className="btn-primary"
                style={{ flex: 1, padding: '10px', fontSize: '13px', justifyContent: 'center' }}
              >
                <Download size={15} /> {downloading === 'All' ? 'Downloading…' : 'Download'}
              </button>
              <button
                onClick={() => setPreviewModal({
                  title: 'Revenue Impact Analysis Preview',
                  type: 'Excel Data',
                  rows: [
                    { customer: 'Lumen Health', mrr: '$2,400', risk: 'High (100%)', impact: '$28,800/yr' },
                    { customer: 'Skyline Media', mrr: '$1,300', risk: 'High (107%)', impact: '$15,600/yr' },
                    { customer: 'Pulse Fitness', mrr: '$470', risk: 'High (131%)', impact: '$5,640/yr' },
                    { customer: 'Northwind Labs', mrr: '$840', risk: 'Medium (45%)', impact: '$10,080/yr' },
                  ]
                })}
                className="btn-secondary"
                style={{ padding: '10px 16px', fontSize: '13px' }}
              >
                <Eye size={15} /> Preview
              </button>
            </div>
          </div>

          {/* Card 2: Executive Print Report */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
              <div style={{ width: '42px', height: '42px', background: 'var(--purple-50)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Printer size={22} color="var(--purple-600)" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Executive Print Report</h3>
                  <span className="badge badge-purple" style={{ fontSize: '10px' }}>Print</span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Print-ready executive summary with charts and recommendations.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              <span>📅 Aug 03, 2026</span>
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
                onClick={() => setPreviewModal({
                  title: 'Executive Summary Executive Overview',
                  type: 'Print Document',
                  rows: [
                    { metric: 'Total Active Customer Accounts', value: '10,842' },
                    { metric: 'High-Risk Retention Targets', value: '1,747 Accounts' },
                    { metric: 'Model Prediction Accuracy', value: '94.2% AUC' },
                    { metric: 'Projected MRR Saved This Quarter', value: '$48,200' },
                  ]
                })}
                className="btn-secondary"
                style={{ padding: '10px 16px', fontSize: '13px' }}
              >
                <Eye size={15} /> Preview
              </button>
            </div>
          </div>

        </div>

        {/* ── Bottom Section: Scheduled Reports ── */}
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Scheduled Reports</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Automated reports delivered to your inbox</p>
            </div>
            <button
              onClick={handleAddNewSchedule}
              className="btn-secondary"
              style={{ padding: '8px 14px', fontSize: '12px' }}
            >
              <Plus size={14} /> New Schedule
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {scheduledReports.map(item => (
              <div
                key={item.id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '14px 18px', borderRadius: '12px', background: 'var(--surface-hover)',
                  border: '1px solid var(--border)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'var(--purple-50)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Clock size={18} color="var(--purple-600)" />
                  </div>
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{item.name}</p>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{item.schedule}</p>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>Next run</p>
                    <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>{item.nextRun}</p>
                  </div>

                  <span className="badge badge-purple" style={{ fontSize: '11px' }}>
                    {item.format}
                  </span>

                  <button
                    onClick={() => setEditingSchedule({ ...item })}
                    style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <Edit2 size={13} /> Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ── Report Preview Modal ── */}
      {previewModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="card" style={{ width: '560px', maxWidth: '100%', padding: '24px', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>{previewModal.title}</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{previewModal.type}</p>
              </div>
              <button onClick={() => setPreviewModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ background: 'var(--surface-hover)', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <tbody>
                  {previewModal.rows.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                      {Object.entries(row).map(([k, v]) => (
                        <td key={k} style={{ padding: '8px 10px', color: 'var(--text-primary)', fontWeight: k === 'customer' || k === 'metric' ? 700 : 500 }}>
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

      {/* ── Edit Schedule Modal ── */}
      {editingSchedule && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="card" style={{ width: '460px', maxWidth: '100%', padding: '24px', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Edit Scheduled Report</h3>
              <button onClick={() => setEditingSchedule(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveSchedule} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>Report Name</label>
                <input
                  type="text"
                  value={editingSchedule.name}
                  onChange={e => setEditingSchedule({ ...editingSchedule, name: e.target.value })}
                  className="input-base"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>Schedule Frequency</label>
                <input
                  type="text"
                  value={editingSchedule.schedule}
                  onChange={e => setEditingSchedule({ ...editingSchedule, schedule: e.target.value })}
                  className="input-base"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>File Format</label>
                <select
                  value={editingSchedule.format}
                  onChange={e => setEditingSchedule({ ...editingSchedule, format: e.target.value })}
                  className="input-base"
                >
                  <option value="PDF">PDF Document</option>
                  <option value="CSV">CSV Spreadsheet</option>
                  <option value="EXCEL">Excel Document</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" onClick={() => setEditingSchedule(null)} className="btn-secondary" style={{ padding: '8px 16px', fontSize: '13px' }}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" style={{ padding: '8px 16px', fontSize: '13px' }}>
                  <Save size={14} /> Save Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}

export default Reports
