import { useState } from 'react'
import Sidebar from '../components/Sidebar'
import { predictChurn } from '../api/predict'
import toast from 'react-hot-toast'
import { BrainCircuit, AlertTriangle, CheckCircle, TrendingDown, ArrowUp, ArrowDown, Lightbulb } from 'lucide-react'

const initialForm = {
  gender: 'Female', SeniorCitizen: 'No', Partner: 'No', Dependents: 'No',
  tenure: 12, PhoneService: 'Yes', MultipleLines: 'No',
  InternetService: 'Fiber optic', OnlineSecurity: 'No', OnlineBackup: 'No',
  DeviceProtection: 'No', TechSupport: 'No', StreamingTV: 'No', StreamingMovies: 'No',
  Contract: 'Month-to-month', PaperlessBilling: 'Yes',
  PaymentMethod: 'Electronic check', MonthlyCharges: 70, TotalCharges: 840,
}

const yesNo        = ['Yes', 'No']
const yesNoService = ['Yes', 'No', 'No internet service']

const riskConfig = {
  High:   { color: '#e11d48', bg: '#fff1f2', border: '#fecdd3', icon: AlertTriangle,   label: 'High Risk' },
  Medium: { color: '#d97706', bg: '#fffbeb', border: '#fde68a', icon: TrendingDown,    label: 'Medium Risk' },
  Low:    { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', icon: CheckCircle,     label: 'Low Risk' },
}

function Predict() {
  const [form,    setForm]    = useState(initialForm)
  const [result,  setResult]  = useState(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  function updateField(field, value) { setForm({ ...form, [field]: value }) }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    setResult(null)
    try {
      const data = await predictChurn({
        ...form,
        tenure: Number(form.tenure),
        MonthlyCharges: Number(form.MonthlyCharges),
        TotalCharges: Number(form.TotalCharges),
      })
      setResult(data)
      toast.success(`Prediction: ${data.risk_level} risk — ${data.churn_probability}%`)
    } catch (err) {
      setError(err.message)
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-layout">
      <Sidebar />
      <div className="page-content">
        <div style={{ marginBottom: '24px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>Churn Predictor</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Fill in customer details to get an AI-powered churn prediction with SHAP explanations</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', alignItems: 'start' }}>

          {/* ── Input form ── */}
          <form onSubmit={handleSubmit} className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <div style={{ width: '36px', height: '36px', background: 'var(--purple-100)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BrainCircuit size={18} color="var(--purple-600)" />
              </div>
              <p style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>Customer Profile</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
              <PField label="Gender"><PSelect value={form.gender} onChange={v => updateField('gender', v)} options={['Male', 'Female']} /></PField>
              <PField label="Senior Citizen"><PSelect value={form.SeniorCitizen} onChange={v => updateField('SeniorCitizen', v)} options={yesNo} /></PField>
              <PField label="Partner"><PSelect value={form.Partner} onChange={v => updateField('Partner', v)} options={yesNo} /></PField>
              <PField label="Dependents"><PSelect value={form.Dependents} onChange={v => updateField('Dependents', v)} options={yesNo} /></PField>
              <PField label="Tenure (months)">
                <input type="number" min="0" value={form.tenure} onChange={e => updateField('tenure', e.target.value)} className="input-base" />
              </PField>
              <PField label="Contract">
                <PSelect value={form.Contract} onChange={v => updateField('Contract', v)} options={['Month-to-month', 'One year', 'Two year']} />
              </PField>
              <PField label="Internet Service">
                <PSelect value={form.InternetService} onChange={v => updateField('InternetService', v)} options={['DSL', 'Fiber optic', 'No']} />
              </PField>
              <PField label="Payment Method">
                <PSelect value={form.PaymentMethod} onChange={v => updateField('PaymentMethod', v)} options={['Electronic check', 'Mailed check', 'Bank transfer (automatic)', 'Credit card (automatic)']} />
              </PField>
              <PField label="Tech Support">
                <PSelect value={form.TechSupport} onChange={v => updateField('TechSupport', v)} options={yesNoService} />
              </PField>
              <PField label="Online Security">
                <PSelect value={form.OnlineSecurity} onChange={v => updateField('OnlineSecurity', v)} options={yesNoService} />
              </PField>
              <PField label="Monthly Charges ($)">
                <input type="number" step="0.01" value={form.MonthlyCharges} onChange={e => updateField('MonthlyCharges', e.target.value)} className="input-base" />
              </PField>
              <PField label="Total Charges ($)">
                <input type="number" step="0.01" value={form.TotalCharges} onChange={e => updateField('TotalCharges', e.target.value)} className="input-base" />
              </PField>
            </div>

            <button id="predict-btn" type="submit" disabled={loading} className="btn-primary" style={{ width: '100%', padding: '12px', fontSize: '14px' }}>
              {loading
                ? <span style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}><Spinner /> Analyzing…</span>
                : <span style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}><BrainCircuit size={16} /> Predict Churn Risk</span>
              }
            </button>
          </form>

          {/* ── Results panel ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {error && (
              <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', color: '#e11d48', fontSize: '13px', padding: '12px 16px', borderRadius: '12px' }}>
                {error}
              </div>
            )}

            {!result && !error && !loading && (
              <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
                <BrainCircuit size={40} color="#c4b5fd" style={{ margin: '0 auto 14px' }} />
                <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>Ready to predict</p>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Fill in the customer profile and click Predict Churn Risk</p>
              </div>
            )}

            {loading && (
              <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                  <Spinner /> Running ML models…
                </div>
              </div>
            )}

            {result && (() => {
              const cfg = riskConfig[result.risk_level] || riskConfig.Low
              const RiskIcon = cfg.icon
              return (
                <>
                  {/* Risk banner */}
                  <div style={{ background: cfg.bg, border: `1.5px solid ${cfg.border}`, borderRadius: '14px', padding: '20px 22px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                      <div style={{ width: '42px', height: '42px', background: cfg.color + '20', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <RiskIcon size={22} color={cfg.color} />
                      </div>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: '20px', color: cfg.color }}>{cfg.label}</p>
                        <p style={{ fontSize: '13px', color: cfg.color + 'cc' }}>{result.priority}</p>
                      </div>
                    </div>
                    {/* Probability bar */}
                    <div style={{ background: '#fff', borderRadius: '99px', height: '10px', overflow: 'hidden', marginBottom: '6px' }}>
                      <div style={{ height: '100%', width: `${result.churn_probability}%`, background: cfg.color, borderRadius: '99px', transition: 'width 600ms ease' }} />
                    </div>
                    <p style={{ fontSize: '13px', color: cfg.color, fontWeight: 600 }}>{result.churn_probability}% churn probability</p>
                  </div>

                  {/* Top factors */}
                  {result.top_factors?.length > 0 && (
                    <div className="card" style={{ padding: '20px 22px' }}>
                      <p style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)', marginBottom: '14px' }}>Top Contributing Factors</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {result.top_factors.map(f => {
                          const isRisk = f.direction === 'increases churn risk'
                          return (
                            <div key={f.feature} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{f.feature}</span>
                              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: 600, color: isRisk ? '#e11d48' : '#16a34a' }}>
                                {isRisk ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
                                {Math.abs(f.impact).toFixed(4)}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Recommendations */}
                  {result.recommended_actions?.length > 0 && (
                    <div className="card" style={{ padding: '20px 22px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                        <Lightbulb size={16} color="var(--purple-600)" />
                        <p style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>Recommended Actions</p>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {result.recommended_actions.map((a, i) => (
                          <div key={i} style={{ background: 'var(--purple-50)', border: '1px solid var(--purple-100)', borderRadius: '10px', padding: '12px 14px' }}>
                            <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--purple-700)', marginBottom: '4px' }}>{a.action}</p>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{a.reason}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )
            })()}
          </div>
        </div>
      </div>
    </div>
  )
}

function PField({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '5px' }}>{label}</label>
      {children}
    </div>
  )
}

function PSelect({ value, onChange, options }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} className="input-base">
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

function Spinner() {
  return (
    <div style={{ width: '15px', height: '15px', border: '2px solid rgba(255,255,255,.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
  )
}

export default Predict