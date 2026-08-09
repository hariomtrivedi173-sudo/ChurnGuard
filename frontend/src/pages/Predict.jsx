import { useState } from 'react'
import Sidebar from '../components/Sidebar'
import { predictChurn } from '../api/predict'
import toast from 'react-hot-toast'

const initialForm = {
  gender: 'Female',
  SeniorCitizen: 'No',
  Partner: 'No',
  Dependents: 'No',
  tenure: 12,
  PhoneService: 'Yes',
  MultipleLines: 'No',
  InternetService: 'Fiber optic',
  OnlineSecurity: 'No',
  OnlineBackup: 'No',
  DeviceProtection: 'No',
  TechSupport: 'No',
  StreamingTV: 'No',
  StreamingMovies: 'No',
  Contract: 'Month-to-month',
  PaperlessBilling: 'Yes',
  PaymentMethod: 'Electronic check',
  MonthlyCharges: 70,
  TotalCharges: 840,
}

const yesNo = ['Yes', 'No']
const yesNoService = ['Yes', 'No', 'No internet service']

function Predict() {
  const [form, setForm] = useState(initialForm)
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function updateField(field, value) {
    setForm({ ...form, [field]: value })
  }

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
      toast.success(`Prediction complete — ${data.risk_level} risk`)
    } catch (err) {
      setError(err.message)
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const riskColors = {
    High: 'bg-rose-100 text-rose-700',
    Medium: 'bg-amber-100 text-amber-700',
    Low: 'bg-green-100 text-green-700',
  }

  return (
    <div className="min-h-screen bg-purple-50 flex gap-4 p-4">
      <Sidebar />

      <div className="flex-1 grid grid-cols-2 gap-4">
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-6 h-fit">
          <h1 className="text-xl font-bold text-gray-800 mb-4">Predict churn risk</h1>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Gender">
              <Select value={form.gender} onChange={(v) => updateField('gender', v)} options={['Male', 'Female']} />
            </Field>
            <Field label="Senior citizen">
              <Select value={form.SeniorCitizen} onChange={(v) => updateField('SeniorCitizen', v)} options={yesNo} />
            </Field>
            <Field label="Partner">
              <Select value={form.Partner} onChange={(v) => updateField('Partner', v)} options={yesNo} />
            </Field>
            <Field label="Dependents">
              <Select value={form.Dependents} onChange={(v) => updateField('Dependents', v)} options={yesNo} />
            </Field>
            <Field label="Tenure (months)">
              <input type="number" min="0" value={form.tenure} onChange={(e) => updateField('tenure', e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-sm" />
            </Field>
            <Field label="Contract">
              <Select value={form.Contract} onChange={(v) => updateField('Contract', v)} options={['Month-to-month', 'One year', 'Two year']} />
            </Field>
            <Field label="Internet service">
              <Select value={form.InternetService} onChange={(v) => updateField('InternetService', v)} options={['DSL', 'Fiber optic', 'No']} />
            </Field>
            <Field label="Payment method">
              <Select value={form.PaymentMethod} onChange={(v) => updateField('PaymentMethod', v)}
                options={['Electronic check', 'Mailed check', 'Bank transfer (automatic)', 'Credit card (automatic)']} />
            </Field>
            <Field label="Tech support">
              <Select value={form.TechSupport} onChange={(v) => updateField('TechSupport', v)} options={yesNoService} />
            </Field>
            <Field label="Online security">
              <Select value={form.OnlineSecurity} onChange={(v) => updateField('OnlineSecurity', v)} options={yesNoService} />
            </Field>
            <Field label="Monthly charges ($)">
              <input type="number" step="0.01" value={form.MonthlyCharges} onChange={(e) => updateField('MonthlyCharges', e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-sm" />
            </Field>
            <Field label="Total charges ($)">
              <input type="number" step="0.01" value={form.TotalCharges} onChange={(e) => updateField('TotalCharges', e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-sm" />
            </Field>
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 rounded-xl transition-colors duration-100 ease-out">
            {loading ? 'Analyzing...' : 'Predict churn risk'}
          </button>
        </form>

        <div className="bg-white rounded-2xl shadow-sm p-6 h-fit">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Result</h2>

          {error && <div className="bg-rose-100 text-rose-700 text-sm rounded-xl px-3 py-2">{error}</div>}

          {!result && !error && (
            <p className="text-sm text-gray-400">Fill in the form and click predict to see a result here.</p>
          )}

          {result && (
            <div>
              <div className={`inline-block px-4 py-2 rounded-xl font-bold text-lg mb-1 ${riskColors[result.risk_level]}`}>
                {result.risk_level} risk — {result.churn_probability}%
              </div>
              <p className="text-sm text-gray-500 mb-4">{result.priority}</p>

              <p className="text-sm font-medium text-gray-700 mb-2">Top factors</p>
              <div className="space-y-2 mb-4">
                {result.top_factors.map((f) => (
                  <div key={f.feature} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{f.feature}</span>
                    <span className={f.direction === 'increases churn risk' ? 'text-rose-600' : 'text-green-600'}>
                      {f.direction === 'increases churn risk' ? '▲' : '▼'} {Math.abs(f.impact)}
                    </span>
                  </div>
                ))}
              </div>

              <p className="text-sm font-medium text-gray-700 mb-2">Recommended actions</p>
              <div className="space-y-2">
                {result.recommended_actions.map((a, i) => (
                  <div key={i} className="bg-purple-50 rounded-xl p-3">
                    <p className="text-sm font-medium text-purple-800">{a.action}</p>
                    <p className="text-xs text-gray-500 mt-1">{a.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <label className="text-xs text-gray-500">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  )
}

function Select({ value, onChange, options }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 rounded-xl bg-gray-50 border border-gray-200 text-sm">
      {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
    </select>
  )
}

export default Predict