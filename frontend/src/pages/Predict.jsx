import { useState, useEffect, useCallback } from 'react'
import Sidebar from '../components/Sidebar'
import Header from '../components/Header'
import { apiRequest } from '../api/client'
import toast from 'react-hot-toast'
import { Sparkles, Zap, AlertCircle, RefreshCw, Users, ArrowUpRight, ArrowDownRight, Lightbulb } from 'lucide-react'

// Required fields for CustomerPredictionInput (matches backend Pydantic model)
const REQUIRED_FIELDS = [
  'gender', 'SeniorCitizen', 'Partner', 'Dependents', 'tenure',
  'PhoneService', 'MultipleLines', 'InternetService', 'OnlineSecurity',
  'OnlineBackup', 'DeviceProtection', 'TechSupport', 'StreamingTV',
  'StreamingMovies', 'Contract', 'PaperlessBilling', 'PaymentMethod',
  'MonthlyCharges', 'TotalCharges',
]

// Build the exact payload the backend expects from a raw telco record.
function buildPayload(record) {
  const missing = []
  const payload = {}

  for (const field of REQUIRED_FIELDS) {
    const val = record[field]
    if (val === undefined || val === null || val === '') {
      missing.push(field)
    } else {
      payload[field] = val
    }
  }

  // Coerce numeric fields
  if (payload.tenure         !== undefined) payload.tenure         = parseFloat(payload.tenure)
  if (payload.MonthlyCharges !== undefined) payload.MonthlyCharges = parseFloat(payload.MonthlyCharges)
  if (payload.TotalCharges   !== undefined) payload.TotalCharges   = parseFloat(payload.TotalCharges)

  return { payload, missing }
}

function riskColor(level) {
  if (level === 'High')   return 'var(--danger)'
  if (level === 'Medium') return 'var(--warning)'
  return 'var(--success)'
}

export default function Predict() {
  const [customers,    setCustomers]    = useState([])
  const [selectedIdx,  setSelectedIdx]  = useState(0)
  const [result,       setResult]       = useState(null)
  const [loading,      setLoading]      = useState(false)
  const [loadingCusts, setLoadingCusts] = useState(true)
  const [loadError,    setLoadError]    = useState('')
  const [predError,    setPredError]    = useState('')

  const loadCustomers = useCallback(async () => {
    setLoadingCusts(true)
    setLoadError('')
    try {
      const data = await apiRequest('/telco/customers?page=1&limit=100')
      const records = data?.records ?? []
      setCustomers(records)
      setSelectedIdx(0)
      setResult(null)
      setPredError('')
    } catch (err) {
      setLoadError(`Failed to load customers: ${err.message}`)
      toast.error(`Failed to load customers: ${err.message}`)
    } finally {
      setLoadingCusts(false)
    }
  }, [])

  useEffect(() => {
    loadCustomers()
  }, [loadCustomers])

  const selectedCustomer = customers[selectedIdx] ?? null

  function handleSelectChange(e) {
    setSelectedIdx(Number(e.target.value))
    setResult(null)
    setPredError('')
  }

  async function handleRunPrediction(e) {
    e.preventDefault()
    if (!selectedCustomer) return

    setLoading(true)
    setResult(null)
    setPredError('')

    const { payload, missing } = buildPayload(selectedCustomer)

    if (missing.length > 0) {
      const msg = `Missing required fields: ${missing.join(', ')}`
      setPredError(msg)
      toast.error(msg)
      setLoading(false)
      return
    }

    try {
      const data = await apiRequest('/predict/full', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setResult(data)
      toast.success(`Prediction: ${data.risk_level} Risk (${data.churn_probability}%)`)
    } catch (err) {
      setPredError(`Prediction failed: ${err.message}`)
      toast.error(`Prediction failed: ${err.message}`)
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  // Customer detail fields to display
  const detailFields = selectedCustomer
    ? [
        { label: 'Tenure (Mo)',        value: `${selectedCustomer.tenure ?? 0} mos` },
        { label: 'Contract',           value: selectedCustomer.Contract        ?? '—' },
        { label: 'Internet Service',   value: selectedCustomer.InternetService ?? '—' },
        { label: 'Monthly Charges',    value: selectedCustomer.MonthlyCharges  != null ? `₹${parseFloat(selectedCustomer.MonthlyCharges).toFixed(2)}` : '—' },
        { label: 'Total Charges',      value: selectedCustomer.TotalCharges    != null ? `₹${parseFloat(selectedCustomer.TotalCharges).toFixed(2)}`  : '—' },
        { label: 'Payment Method',     value: selectedCustomer.PaymentMethod   ?? '—' },
      ]
    : []

  return (
    <div className="page-layout">
      <Sidebar />
      <div className="page-content" style={{ padding: '24px 32px' }}>

        <Header
          title="Predict Churn"
          subtitle="Run real-time inference on customer telemetry with explainable factor attributions."
        />

        {/* Customer load error */}
        {loadError && !loadingCusts && (
          <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', color: 'var(--danger)', fontSize: '13px', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{loadError}</span>
            <button onClick={loadCustomers} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontWeight: 600, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <RefreshCw size={13} /> Retry
            </button>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 1fr)', gap: '20px', alignItems: 'start' }}>

          {/* ── Left Card: Prediction Form ── */}
          <div className="dashboard-card" style={{ padding: '24px' }}>
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Prediction Form
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--slate-500)', marginTop: '2px' }}>
                Select an account from your loaded dataset to evaluate churn risk
              </p>
            </div>

            {/* No customers state */}
            {!loadingCusts && customers.length === 0 && !loadError && (
              <div style={{ textAlign: 'center', padding: '36px 0', color: 'var(--slate-500)' }}>
                <Users size={38} style={{ margin: '0 auto 12px', opacity: 0.3, display: 'block' }} />
                <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>No customer records found</p>
                <p style={{ fontSize: '12px', color: 'var(--slate-500)' }}>Upload a CSV dataset to run predictions.</p>
              </div>
            )}

            {/* Loading customers */}
            {loadingCusts && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '36px 0', justifyContent: 'center', color: 'var(--slate-500)', fontSize: '13px' }}>
                <div style={{ width: '16px', height: '16px', border: '2px solid var(--slate-300)', borderTopColor: 'var(--brand)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                Loading customer telemetry…
              </div>
            )}

            {!loadingCusts && customers.length > 0 && (
              <form onSubmit={handleRunPrediction}>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--slate-600)', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: '6px' }}>
                    Select Customer ({customers.length} available)
                  </label>
                  <select
                    value={selectedIdx}
                    onChange={handleSelectChange}
                    className="input-base"
                    style={{ fontWeight: 600, fontSize: '13px' }}
                  >
                    {customers.map((c, i) => (
                      <option key={c._id || c.customerID || i} value={i}>
                        {c.customerID || `Customer #${i + 1}`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Customer Telemetry Summary Cards */}
                {selectedCustomer && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '24px' }}>
                    {detailFields.map(({ label, value }) => (
                      <div key={label} style={{ background: 'var(--surface-muted)', padding: '10px 12px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                        <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase', margin: 0 }}>{label}</p>
                        <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '3px', margin: '3px 0 0 0', wordBreak: 'break-word' }}>{String(value)}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Validation error */}
                {predError && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', color: 'var(--danger)', fontSize: '12px', padding: '10px 14px', borderRadius: '10px', marginBottom: '16px' }}>
                    <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>{predError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary"
                  style={{ width: '100%', padding: '11px', fontSize: '13px', justifyContent: 'center' }}
                >
                  {loading ? (
                    <><span className="btn-spinner" /> Evaluating Risk Models…</>
                  ) : (
                    <><Zap size={15} /> Run Prediction</>
                  )}
                </button>
              </form>
            )}
          </div>

          {/* ── Right Card: Prediction Result ── */}
          <div className="dashboard-card" style={{ padding: '24px', minHeight: '380px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>Prediction Result</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>Explainable AI risk scoring</p>
              </div>
              <span className="badge badge-purple" style={{ fontSize: '10px' }}>ChurnGuard ML</span>
            </div>

            {/* Idle state */}
            {!result && !loading && !predError && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px 20px' }}>
                <div style={{ width: '52px', height: '52px', background: 'var(--brand-subtle)', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
                  <Sparkles size={24} color="var(--brand)" />
                </div>
                <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Awaiting Inference</h4>
                <p style={{ fontSize: '12px', color: 'var(--slate-500)', maxWidth: '280px', lineHeight: 1.5, margin: 0 }}>
                  Select an account and click "Run Prediction" to compute calibrated churn probability, feature attributions, and mitigation playbooks.
                </p>
              </div>
            )}

            {/* Loading state */}
            {loading && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '40px' }}>
                <div style={{ width: '24px', height: '24px', border: '3px solid var(--slate-300)', borderTopColor: 'var(--brand)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <p style={{ fontSize: '13px', color: 'var(--slate-600)', fontWeight: 500, margin: 0 }}>Running Supervised Inference…</p>
              </div>
            )}

            {/* Error state */}
            {predError && !loading && !result && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px 20px' }}>
                <AlertCircle size={32} color="var(--danger)" style={{ marginBottom: '10px', opacity: 0.7 }} />
                <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Prediction Failed</p>
                <p style={{ fontSize: '12px', color: 'var(--slate-500)', maxWidth: '280px', margin: 0 }}>{predError}</p>
              </div>
            )}

            {/* Success: Real Prediction Result with Reveal Animation */}
            {result && !loading && (
              <div className="predict-result-reveal" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                {/* Risk score & Large Probability */}
                <div style={{
                  background: 'var(--surface-muted)',
                  border: `1px solid var(--border)`,
                  borderLeft: `4px solid ${riskColor(result.risk_level)}`,
                  borderRadius: '12px',
                  padding: '16px 18px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
                    <div>
                      <span className={result.risk_level === 'High' ? 'badge badge-red' : result.risk_level === 'Medium' ? 'badge badge-yellow' : 'badge badge-green'} style={{ fontSize: '11px', marginBottom: '6px' }}>
                        ● {result.risk_level} Risk Level
                      </span>
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                        Calibrated Churn Probability
                      </p>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '38px', fontWeight: 800, color: riskColor(result.risk_level), lineHeight: 1 }}>
                        {result.churn_probability}%
                      </span>
                    </div>
                  </div>

                  {/* Probability Bar */}
                  <div style={{ height: '6px', background: 'var(--border)', borderRadius: '99px', overflow: 'hidden', marginTop: '10px' }}>
                    <div style={{ height: '100%', width: `${result.churn_probability}%`, background: riskColor(result.risk_level), borderRadius: '99px', transition: 'width 600ms ease' }} />
                  </div>

                  {result.priority && (
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '8px', fontWeight: 600, margin: '8px 0 0 0' }}>
                      Outreach Priority: {result.priority}
                    </p>
                  )}
                </div>

                {/* AI Explanation: Top Contributing Factors */}
                {result.top_factors && result.top_factors.length > 0 && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                      <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                        Explainable Factors (Feature Attributions)
                      </p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {result.top_factors.map((f, i) => {
                        const isRisk = f.direction === 'increases churn risk'
                        return (
                          <div
                            key={i}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              fontSize: '12px',
                              background: 'var(--surface)',
                              border: '1px solid var(--border)',
                              padding: '8px 12px',
                              borderRadius: '8px'
                            }}
                          >
                            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{f.feature}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                color: isRisk ? 'var(--danger)' : 'var(--success)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '2px'
                              }}>
                                {isRisk ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                                {isRisk ? '+' : '−'}{(f.impact * 100).toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Recommended Actions */}
                {result.recommended_actions && result.recommended_actions.length > 0 && (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                      <Lightbulb size={13} color="var(--brand)" />
                      <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                        Recommended Mitigation Actions
                      </p>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {result.recommended_actions.map((a, i) => (
                        <div
                          key={i}
                          style={{
                            fontSize: '12px',
                            background: 'var(--surface-muted)',
                            padding: '10px 12px',
                            borderRadius: '8px',
                            border: '1px solid var(--border)',
                            borderLeft: '3px solid var(--brand)'
                          }}
                        >
                          <p style={{ fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{a.action}</p>
                          {a.reason && <p style={{ color: 'var(--text-muted)', marginTop: '3px', fontSize: '11px', margin: '3px 0 0 0' }}>{a.reason}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  )
}