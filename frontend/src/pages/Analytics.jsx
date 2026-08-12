
import { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import { getMLMetrics } from '../api/metrics'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
  BarChart, Bar, Cell, LabelList,
} from 'recharts'

const MetricCard = ({ label, value, color, subtitle }) => {
  const colors = {
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    green: 'bg-green-50  text-green-700  border-green-200',
    blue: 'bg-blue-50   text-blue-700   border-blue-200',
    amber: 'bg-amber-50  text-amber-700  border-amber-200',
    rose: 'bg-rose-50   text-rose-700   border-rose-200',
  }
  return (
    <div className={`rounded-2xl border p-5 ${colors[color]}`}>
      <p className="text-xs font-medium opacity-70 mb-1">{label}</p>
      <p className="text-3xl font-bold">{value}</p>
      {subtitle && <p className="text-xs opacity-60 mt-1">{subtitle}</p>}
    </div>
  )
}

const IMPORTANCE_COLORS = [
  '#7c3aed', '#8b5cf6', '#a78bfa', '#c4b5fd',
  '#ddd6fe', '#ede9fe', '#6d28d9', '#5b21b6', '#4c1d95', '#3b0764',
]

function Analytics() {
  const [metrics, setMetrics] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const data = await getMLMetrics()
      setMetrics(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const cm = metrics?.confusion_matrix

  return (
    <div className="min-h-screen bg-purple-50 flex gap-4 p-4">
      <Sidebar />

      <div className="flex-1">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-1">Model Analytics</h1>
          <p className="text-sm text-gray-400">
            VotingEnsemble — threshold 0.35 — tested on 20% held-out data
          </p>
        </div>

        {error && (
          <div className="bg-rose-100 text-rose-700 text-sm rounded-xl px-4 py-3 mb-4">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-gray-400 py-8">
            <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
            Computing metrics…
          </div>
        )}

        {metrics && (
          <>
            {/* ── Metric Cards ── */}
            <div className="grid grid-cols-5 gap-4 mb-6">
              <MetricCard label="Accuracy" value={`${(metrics.accuracy * 100).toFixed(1)}%`} color="purple" subtitle="Overall correct" />
              <MetricCard label="Precision" value={`${(metrics.precision * 100).toFixed(1)}%`} color="blue" subtitle="Of predicted churners" />
              <MetricCard label="Recall" value={`${(metrics.recall * 100).toFixed(1)}%`} color="green" subtitle="Actual churners caught" />
              <MetricCard label="F1 Score" value={`${(metrics.f1_score * 100).toFixed(1)}%`} color="amber" subtitle="Precision × Recall balance" />
              <MetricCard label="AUC" value={`${(metrics.auc * 100).toFixed(1)}%`} color="rose" subtitle="Area under ROC curve" />
            </div>

            {/* ── Confusion Matrix + ROC Curve ── */}
            <div className="grid grid-cols-2 gap-4 mb-6">

              {/* Confusion Matrix */}
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h2 className="text-sm font-bold text-gray-800 mb-1">Confusion Matrix</h2>
                <p className="text-xs text-gray-400 mb-5">Actual vs predicted on test set</p>

                <div className="grid grid-cols-2 gap-2 max-w-xs mx-auto">
                  {/* Header row */}
                  <div />
                  <div className="grid grid-cols-2 gap-2 mb-1">
                    <p className="text-xs text-center text-gray-400 font-medium">Pred No</p>
                    <p className="text-xs text-center text-gray-400 font-medium">Pred Yes</p>
                  </div>

                  {/* Row 1: Actual No */}
                  <div className="flex items-center">
                    <p className="text-xs text-gray-400 font-medium whitespace-nowrap">Actual No</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-green-100 rounded-xl p-3 text-center">
                      <p className="text-lg font-bold text-green-700">{cm.true_negative}</p>
                      <p className="text-xs text-green-600">TN</p>
                    </div>
                    <div className="bg-rose-100 rounded-xl p-3 text-center">
                      <p className="text-lg font-bold text-rose-700">{cm.false_positive}</p>
                      <p className="text-xs text-rose-600">FP</p>
                    </div>
                  </div>

                  {/* Row 2: Actual Yes */}
                  <div className="flex items-center">
                    <p className="text-xs text-gray-400 font-medium whitespace-nowrap">Actual Yes</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-amber-100 rounded-xl p-3 text-center">
                      <p className="text-lg font-bold text-amber-700">{cm.false_negative}</p>
                      <p className="text-xs text-amber-600">FN</p>
                    </div>
                    <div className="bg-green-100 rounded-xl p-3 text-center">
                      <p className="text-lg font-bold text-green-700">{cm.true_positive}</p>
                      <p className="text-xs text-green-600">TP</p>
                    </div>
                  </div>
                </div>

                {/* Legend */}
                <div className="mt-5 grid grid-cols-2 gap-2 text-xs text-gray-500">
                  <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" />TN = Correctly predicted no churn</div>
                  <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-400 inline-block" />FP = Predicted churn, actually stayed</div>
                  <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />FN = Missed churner (most costly)</div>
                  <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" />TP = Correctly predicted churn</div>
                </div>
              </div>

              {/* ROC Curve */}
              <div className="bg-white rounded-2xl shadow-sm p-6">
                <h2 className="text-sm font-bold text-gray-800 mb-1">ROC Curve</h2>
                <p className="text-xs text-gray-400 mb-4">
                  AUC = {(metrics.auc * 100).toFixed(2)}% — higher is better (random = 50%)
                </p>
                <ResponsiveContainer width="100%" height={230}>
                  <LineChart data={metrics.roc_curve} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis
                      dataKey="fpr"
                      label={{ value: 'False Positive Rate', position: 'insideBottom', offset: -2, fontSize: 10, fill: '#9ca3af' }}
                      tick={{ fontSize: 10 }}
                      domain={[0, 1]}
                    />
                    <YAxis
                      dataKey="tpr"
                      label={{ value: 'True Positive Rate', angle: -90, position: 'insideLeft', offset: 10, fontSize: 10, fill: '#9ca3af' }}
                      tick={{ fontSize: 10 }}
                      domain={[0, 1]}
                    />
                    <Tooltip
                      formatter={(v, name) => [v.toFixed(4), name === 'tpr' ? 'TPR' : 'FPR']}
                      labelFormatter={(fpr) => `FPR: ${Number(fpr).toFixed(4)}`}
                    />
                    {/* Diagonal baseline (random classifier) */}
                    <Line
                      data={[{ fpr: 0, tpr: 0 }, { fpr: 1, tpr: 1 }]}
                      type="linear"
                      dataKey="tpr"
                      stroke="#e5e7eb"
                      strokeDasharray="4 4"
                      dot={false}
                      strokeWidth={1}
                    />
                    {/* Actual ROC */}
                    <Line
                      type="monotone"
                      dataKey="tpr"
                      stroke="#7c3aed"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* ── Feature Importance ── */}
            <div className="bg-white rounded-2xl shadow-sm p-6">
              <h2 className="text-sm font-bold text-gray-800 mb-1">Top 10 Feature Importances</h2>
              <p className="text-xs text-gray-400 mb-4">
                From the Random Forest inside the VotingEnsemble — which features drive churn predictions most
              </p>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={metrics.feature_importance}
                  layout="vertical"
                  margin={{ top: 4, right: 60, bottom: 4, left: 140 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} domain={[0, 'dataMax + 0.01']} />
                  <YAxis type="category" dataKey="feature" tick={{ fontSize: 11 }} width={130} />
                  <Tooltip
                    formatter={(v) => [`${(v * 100).toFixed(2)}%`, 'Importance']}
                  />
                  <Bar dataKey="importance" radius={[0, 6, 6, 0]} maxBarSize={22}>
                    {metrics.feature_importance.map((_, i) => (
                      <Cell key={i} fill={IMPORTANCE_COLORS[i % IMPORTANCE_COLORS.length]} />
                    ))}
                    <LabelList
                      dataKey="importance"
                      position="right"
                      formatter={(v) => `${(v * 100).toFixed(1)}%`}
                      style={{ fontSize: 10, fill: '#6b7280' }}
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default Analytics
