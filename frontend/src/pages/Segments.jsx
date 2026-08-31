import { useEffect, useState } from 'react'
import Sidebar from '../components/Sidebar'
import { getSegments } from '../api/segments'
import { DollarSign, Clock, Layers } from 'lucide-react'

const SEGMENT_NAMES = {
  0: 'New & Low Spend',
  1: 'High-Value Veterans',
  2: 'Mid-Tier Established',
  3: 'High-Risk Recent',
}

const SEGMENT_COLORS = {
  0: '#3b82f6', // blue
  1: '#10b981', // green
  2: '#8b5cf6', // purple
  3: '#f59e0b', // amber
}

function Segments() {
  const [segments, setSegments] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')

  useEffect(() => {
    loadSegments()
  }, [])

  async function loadSegments() {
    setLoading(true)
    try {
      const data = await getSegments()
      setSegments(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="page-layout">
      <Sidebar />
      <div className="page-content">

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
              Customer Segments
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              AI clustering (K-Means) based on tenure, monthly charges, and total spend
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f5f3ff', border: '1px solid #e8e4f8', padding: '8px 12px', borderRadius: '10px' }}>
            <Layers size={16} color="var(--purple-600)" />
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--purple-700)' }}>4 Clusters Identified</span>
          </div>
        </div>

        {error && (
          <div style={{ background: '#fff1f2', border: '1px solid #fecdd3', color: '#e11d48', fontSize: '13px', padding: '12px 16px', borderRadius: '10px', marginBottom: '20px' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)', fontSize: '14px', padding: '60px 0', justifyContent: 'center' }}>
            <div style={{ width: '18px', height: '18px', border: '2px solid #c4b5fd', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            Running K-Means clustering…
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
            {segments.map((s, idx) => {
              // Map dynamic clusters based on average tenure & charges (simple heuristic mapping)
              // K-Means cluster IDs are non-deterministic per run, so we assign visual themes dynamically.
              const isHighChurn = s.churn_rate_percent > 35
              const color = isHighChurn ? '#e11d48' : SEGMENT_COLORS[idx % 4]
              const name = `Segment ${s.segment}` // Fallback name

              return (
                <div key={s.segment} className="card card-hover" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '5px', background: color }} />
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                    <div>
                      <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                        Cluster {s.segment}
                      </p>
                      <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {SEGMENT_NAMES[idx] || name}
                      </h3>
                    </div>
                    <div style={{ background: `${color}15`, color, padding: '4px 10px', borderRadius: '99px', fontSize: '12px', fontWeight: 600 }}>
                      {s.customer_count.toLocaleString()} customers
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                    <div style={{ background: '#f9fafb', padding: '12px', borderRadius: '10px' }}>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <Clock size={12} /> Avg Tenure
                      </p>
                      <p style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {s.avg_tenure.toFixed(1)} <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>mo</span>
                      </p>
                    </div>
                    <div style={{ background: '#f9fafb', padding: '12px', borderRadius: '10px' }}>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <DollarSign size={12} /> Avg Monthly
                      </p>
                      <p style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        ${s.avg_monthly_charges.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                      <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>Churn Rate</span>
                      <span style={{ fontWeight: 700, color: isHighChurn ? '#e11d48' : 'var(--text-primary)' }}>{s.churn_rate_percent}%</span>
                    </div>
                    <div style={{ width: '100%', height: '8px', background: '#f3f4f6', borderRadius: '99px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${s.churn_rate_percent}%`, background: isHighChurn ? '#e11d48' : color, borderRadius: '99px' }} />
                    </div>
                  </div>

                </div>
              )
            })}
          </div>
        )}
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )
}

export default Segments
