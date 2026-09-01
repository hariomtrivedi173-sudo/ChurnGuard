import { useState, useEffect, useCallback } from 'react'
import Sidebar from '../components/Sidebar'
import Header from '../components/Header'
import { apiRequest } from '../api/client'
import toast from 'react-hot-toast'
import { Sparkles, Zap, AlertCircle, RefreshCw, Users } from 'lucide-react'

// Required fields for CustomerPredictionInput (matches backend Pydantic model)
const REQUIRED_FIELDS = [
  'gender', 'SeniorCitizen', 'Partner', 'Dependents', 'tenure',
  'PhoneService', 'MultipleLines', 'InternetService', 'OnlineSecurity',
  'OnlineBackup', 'DeviceProtection', 'TechSupport', 'StreamingTV',
  'StreamingMovies', 'Contract', 'PaperlessBilling', 'PaymentMethod',
  'MonthlyCharges', 'TotalCharges',
]

// Build the exact payload the backend expects from a raw telco record.
// Returns { payload, missing } where missing is an array of missing field names.
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
  if (payload.tenure      !== undefined) payload.tenure         = parseFloat(payload.tenure)
  if (payload.MonthlyCharges !== undefined) payload.MonthlyCharges = parseFloat(payload.MonthlyCharges)
  if (payload.TotalCharges   !== undefined) payload.TotalCharges   = parseFloat(payload.TotalCharges)

  return { payload, missing }
}

function riskColor(level) {
  if (level === 'High')   return '#EF4444'
  if (level === 'Medium') return '#F59E0B'
  return '#10B981'
}

function Predict() {
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

  // ── Customer detail fields to display (only real Telco fields) ──
  const detailFields = selectedCustomer
    ? [
        { label: 'Tenure (Mo)',        value: selectedCustomer.tenure          ?? '—' },
        { label: 'Contract',           value: selectedCustomer.Contract        ?? '—' },
        { label: 'Internet Service',   value: selectedCustomer.InternetService ?? '—' },
        { label: 'Monthly Charges',    value: selectedCustomer.MonthlyCharges  != null ? `$${parseFloat(selectedCustomer.MonthlyCharges).toFixed(2)}` : '—' },
        { label: 'Total Charges',      value: selectedCustomer.TotalCharges    != null ? `$${parseFloat(selectedCustomer.TotalCharges).toFixed(2)}`  : '—' },
        { label: 'Payment Method',     value: selectedCustomer.PaymentMethod   ?? '—' },
      ]
    : []

  return (
    <div className="page-layout">
      <Sidebar />
      <div className="page-content" style={{ padding: '24px 32px' }}>

        <Header title="Predictions" subtitle="Run AI-powered churn predictions on your customers." />

        {/* ── Customer load error ── */}
        {loadError && !loadingCusts && (
          <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', color: '#e11d48', fontSize: '13px', padding: '12px 16px', borderRadius: '10px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>{loadError}</span>
            <button onClick={loadCustomers} style={{ background: 'none', border: 'none', color: '#e11d48', cursor: 'pointer', fontWeight: 600, fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <RefreshCw size={13} /> Retry
            </button>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'start' }}>

          {/* Left Card: Prediction Form */}
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>
              Prediction Form
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>
              Select a customer from your uploaded dataset
            </p>

            {/* No customers state */}
            {!loadingCusts && customers.length === 0 && !loadError && (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <Users size={40} style={{ margin: '0 auto 12px', opacity: 0.2, display: 'block' }} />
                <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>No customers found</p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Upload a CSV dataset to run predictions.</p>
              </div>
            )}

            {/* Loading customers */}
            {loadingCusts && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '32px 0', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                <div style={{ width: '18px', height: '18px', border: '2px solid var(--purple-200)', borderTopColor: 'var(--purple-600)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                Loading customers…
              </div>
            )}

            {!loadingCusts && customers.length > 0 && (
              <form onSubmit={handleRunPrediction}>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '6px' }}>
                    CUSTOMER ({customers.length} loaded)
                  </label>
                  <select
                    value={selectedIdx}
                    onChange={handleSelectChange}
                    className="input-base"
                    style={{ fontWeight: 600 }}
                  >
                    {customers.map((c, i) => (
                      <option key={c._id || c.customerID || i} value={i}>
                        {c.customerID || `Customer #${i + 1}`}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Real customer fields — no fabricated values */}
                {selectedCustomer && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
                    {detailFields.map(({ label, value }) => (
                      <div key={label} style={{ background: 'var(--surface-hover)', padding: '12px 14px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                        <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</p>
                        <p style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px', wordBreak: 'break-word' }}>{String(value)}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Validation error (missing fields) */}
                {predError && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', background: '#fff1f2', border: '1px solid #fecdd3', color: '#e11d48', fontSize: '12px', padding: '10px 14px', borderRadius: '10px', marginBottom: '16px' }}>
                    <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
                    <span>{predError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary"
                  style={{ width: '100%', padding: '12px', fontSize: '14px', justifyContent: 'center' }}
                >
                  {loading
                    ? <><div style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Analyzing…</>
                    : <><Zap size={16} /> Run Prediction</>}
                </button>
              </form>
            )}
          </div>

          {/* Right Card: Prediction Result */}
          <div className="card" style={{ padding: '24px', minHeight: '360px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>Prediction Result</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>AI-powered churn analysis</p>
              </div>
              <span className="badge badge-purple" style={{ fontSize: '11px' }}>● ChurnGuard ML</span>
            </div>

            {/* Idle state */}
            {!result && !loading && !predError && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px 20px' }}>
                <div style={{ width: '56px', height: '56px', background: 'var(--purple-50)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
                  <Sparkles size={26} color="var(--purple-600)" />
                </div>
                <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>Ready to predict</h4>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '280px', lineHeight: 1.5 }}>
                  Select a customer and click Run Prediction to see the actual ML churn probability, risk factors, and recommendations.
                </p>
              </div>
            )}

            {/* Loading state */}
            {loading && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '40px' }}>
                <div style={{ width: '24px', height: '24px', border: '3px solid var(--purple-400)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>Running ML inference…</p>
              </div>
            )}

            {/* Error state — no fallback data shown */}
            {predError && !loading && !result && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '40px 20px' }}>
                <AlertCircle size={32} color="#F87171" style={{ marginBottom: '12px', opacity: 0.6 }} />
                <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>Prediction failed</p>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '280px', lineHeight: 1.5 }}>{predError}</p>
              </div>
            )}

            {/* Success: real prediction result */}
            {result && !loading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                {/* Risk score */}
                <div style={{
                  background: `rgba(${result.risk_level === 'High' ? '248,113,113' : result.risk_level === 'Medium' ? '251,191,36' : '52,211,153'}, 0.12)`,
                  border: `1px solid rgba(${result.risk_level === 'High' ? '248,113,113' : result.risk_level === 'Medium' ? '251,191,36' : '52,211,153'}, 0.3)`,
                  borderRadius: '14px', padding: '16px 20px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <p style={{ fontSize: '16px', fontWeight: 800, color: riskColor(result.risk_level) }}>{result.risk_level} Churn Risk</p>
                    <span style={{ fontSize: '20px', fontWeight: 800, color: riskColor(result.risk_level) }}>{result.churn_probability}%</span>
                  </div>
                  <div style={{ height: '8px', background: `rgba(${result.risk_level === 'High' ? '248,113,113' : result.risk_level === 'Medium' ? '251,191,36' : '52,211,153'}, 0.25)`, borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${result.churn_probability}%`, background: riskColor(result.risk_level), borderRadius: '99px' }} />
                  </div>
                  {result.priority && (
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', fontWeight: 600 }}>{result.priority}</p>
                  )}
                </div>

                {/* Top factors */}
                {result.top_factors && result.top_factors.length > 0 && (
                  <div>
                    <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>Top Contributing Factors</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {result.top_factors.map((f, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', background: 'var(--surface-hover)', padding: '8px 12px', borderRadius: '8px' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>{f.feature}</span>
                          <span style={{ color: riskColor(result.risk_level), fontWeight: 600 }}>
                            {f.direction === 'increases churn risk' ? '+' : '−'}{(f.impact * 100).toFixed(0)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommendations */}
                {result.recommended_actions && result.recommended_actions.length > 0 && (
                  <div>
                    <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>Recommended Actions</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {result.recommended_actions.map((a, i) => (
                        <div key={i} style={{ fontSize: '12px', background: 'var(--purple-50)', padding: '8px 12px', borderRadius: '8px', borderLeft: '3px solid var(--accent)' }}>
                          <p style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{a.action}</p>
                          {a.reason && <p style={{ color: 'var(--text-muted)', marginTop: '2px' }}>{a.reason}</p>}
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

export default Predict