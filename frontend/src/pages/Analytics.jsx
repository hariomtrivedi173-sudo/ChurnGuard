import { useState } from 'react'
import Sidebar from '../components/Sidebar'
import Header from '../components/Header'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line
} from 'recharts'
import { TrendingDown, TrendingUp, DollarSign, Users, Calendar } from 'lucide-react'

// Trend Analysis Data (Image 3)
const churnTrendData = [
  { month: 'Jan', churn: 8.2 },
  { month: 'Feb', churn: 7.4 },
  { month: 'Mar', churn: 9.1 },
  { month: 'Apr', churn: 6.8 },
  { month: 'May', churn: 7.5 },
  { month: 'Jun', churn: 6.2 },
  { month: 'Jul', churn: 5.8 },
  { month: 'Aug', churn: 5.2 },
]

const retentionTrendData = [
  { month: 'Jan', retention: 91.8 },
  { month: 'Feb', retention: 92.6 },
  { month: 'Mar', retention: 90.9 },
  { month: 'Apr', retention: 93.2 },
  { month: 'May', retention: 92.5 },
  { month: 'Jun', retention: 93.8 },
  { month: 'Jul', retention: 94.2 },
  { month: 'Aug', retention: 94.8 },
]

// Customer Segmentation Data (Image 4)
const segmentChurnData = [
  { segment: 'Power Users', churn: 5 },
  { segment: 'New Signups', churn: 12 },
  { segment: 'Declining', churn: 28 },
  { segment: 'Dormant', churn: 42 },
]

const segmentDistributionData = [
  { name: 'Power Users', count: 1240, color: '#22c55e' },
  { name: 'New Signups', count: 980, color: '#d97706' },
  { name: 'Declining', count: 620, color: '#e11d48' },
  { name: 'Dormant', count: 340, color: '#7c3aed' },
]

// Retention Cohort Data (Image 5)
const retentionCohortData = [
  { week: 'W1', retention: 100 },
  { week: 'W2', retention: 92 },
  { week: 'W3', retention: 86 },
  { week: 'W4', retention: 81 },
  { week: 'W5', retention: 77 },
  { week: 'W6', retention: 74 },
  { week: 'W7', retention: 70 },
  { week: 'W8', retention: 67 },
]

// Monthly Churn by Plan Stacked Data (Image 5)
const monthlyChurnByPlanData = [
  { month: 'Jan', Enterprise: 4, Growth: 8, Scale: 6, Starter: 14 },
  { month: 'Feb', Enterprise: 3, Growth: 7, Scale: 5, Starter: 13 },
  { month: 'Mar', Enterprise: 5, Growth: 9, Scale: 7, Starter: 15 },
  { month: 'Apr', Enterprise: 2, Growth: 6, Scale: 4, Starter: 12 },
  { month: 'May', Enterprise: 3, Growth: 7, Scale: 5, Starter: 11 },
  { month: 'Jun', Enterprise: 2, Growth: 5, Scale: 4, Starter: 10 },
  { month: 'Jul', Enterprise: 2, Growth: 5, Scale: 4, Starter: 9 },
  { month: 'Aug', Enterprise: 1, Growth: 4, Scale: 3, Starter: 8 },
]

function Analytics() {
  const [activeTab, setActiveTab] = useState('Trend Analysis')

  return (
    <div className="page-layout">
      <Sidebar />
      <div className="page-content" style={{ padding: '24px 32px' }}>

        <Header title="Analytics" subtitle="Welcome back, Maya — here's your churn outlook." />

        {/* ── Top 4 Metric Cards (Matching Image 3) ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          
          <div className="card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>6.4%</p>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '6px' }}>Avg Monthly Churn</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
              <div style={{ width: '36px', height: '36px', background: 'rgba(34, 197, 94, 0.12)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TrendingDown size={18} color="#16a34a" />
              </div>
              <span className="badge badge-green" style={{ fontSize: '10px' }}>-1.2%</span>
            </div>
          </div>

          <div className="card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>93.6%</p>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '6px' }}>Retention Rate</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
              <div style={{ width: '36px', height: '36px', background: 'rgba(34, 197, 94, 0.12)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TrendingUp size={18} color="#16a34a" />
              </div>
              <span className="badge badge-green" style={{ fontSize: '10px' }}>+1.2%</span>
            </div>
          </div>

          <div className="card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>$48.2K</p>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '6px' }}>At-Risk MRR</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
              <div style={{ width: '36px', height: '36px', background: 'rgba(217, 119, 6, 0.12)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <DollarSign size={18} color="#d97706" />
              </div>
              <span className="badge badge-amber" style={{ fontSize: '10px' }}>-8%</span>
            </div>
          </div>

          <div className="card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <p style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>4</p>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '6px' }}>Segments Tracked</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
              <div style={{ width: '36px', height: '36px', background: 'var(--purple-50)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users size={18} color="var(--purple-600)" />
              </div>
              <span className="badge badge-green" style={{ fontSize: '10px' }}>stable</span>
            </div>
          </div>

        </div>

        {/* ── Interactive Tab Pill Bar (Matching Image 3, 4 & 5) ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '8px', background: 'var(--surface)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border)' }}>
            {['Trend Analysis', 'Customer Segmentation', 'Retention Analysis', 'Revenue Impact'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`tab-pill ${activeTab === tab ? 'active' : ''}`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--purple-50)', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: '99px', fontSize: '12px', fontWeight: 600, color: 'var(--purple-600)' }}>
            <Calendar size={13} /> ● Last 8 months
          </div>
        </div>

        {/* ── Tab 1: Trend Analysis (Image 3) ── */}
        {activeTab === 'Trend Analysis' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div className="card" style={{ padding: '22px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Churn Trend</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>Monthly churn rate over time</p>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={churnTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="churnWaveGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#e11d48" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#e11d48" stopOpacity={0.01}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} domain={[0, 12]} />
                  <Tooltip contentStyle={{ borderRadius: '10px', background: 'var(--surface)', fontSize: '12px' }} />
                  <Area type="monotone" dataKey="churn" stroke="#e11d48" strokeWidth={2.5} fill="url(#churnWaveGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="card" style={{ padding: '22px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Retention Trend</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>Retained customer percentage</p>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={retentionTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="retentionWaveGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#16a34a" stopOpacity={0.01}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} domain={[50, 100]} />
                  <Tooltip contentStyle={{ borderRadius: '10px', background: 'var(--surface)', fontSize: '12px' }} />
                  <Area type="monotone" dataKey="retention" stroke="#16a34a" strokeWidth={2.5} fill="url(#retentionWaveGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ── Tab 2: Customer Segmentation (Image 4) ── */}
        {activeTab === 'Customer Segmentation' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div className="card" style={{ padding: '22px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Customer Segmentation</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>Churn rate by segment</p>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={segmentChurnData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="segment" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} domain={[0, 60]} />
                  <Tooltip contentStyle={{ borderRadius: '10px', background: 'var(--surface)', fontSize: '12px' }} />
                  <Bar dataKey="churn" radius={[6, 6, 0, 0]}>
                    <Cell fill="#22c55e" />
                    <Cell fill="#d97706" />
                    <Cell fill="#e11d48" />
                    <Cell fill="#7c3aed" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card" style={{ padding: '22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Segment Distribution</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Share of customer base</p>
              </div>

              <div style={{ height: '160px', margin: '8px 0' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={segmentDistributionData} cx="50%" cy="50%" innerRadius={48} outerRadius={68} paddingAngle={3} dataKey="count">
                      {segmentDistributionData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '10px', background: 'var(--surface)', fontSize: '12px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {segmentDistributionData.map(item => (
                  <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color }} />
                      <span style={{ color: 'var(--text-secondary)' }}>{item.name}</span>
                    </div>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{item.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Tab 3: Retention Analysis (Image 5) ── */}
        {activeTab === 'Retention Analysis' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div className="card" style={{ padding: '22px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Retention Cohort</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>Weekly retention after signup</p>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={retentionCohortData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} domain={[60, 100]} />
                  <Tooltip contentStyle={{ borderRadius: '10px', background: 'var(--surface)', fontSize: '12px' }} />
                  <Line type="monotone" dataKey="retention" stroke="#7c3aed" strokeWidth={2.5} dot={{ fill: '#7c3aed', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="card" style={{ padding: '22px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Monthly Churn by Plan</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>Churn rate broken down by plan tier</p>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={monthlyChurnByPlanData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '10px', background: 'var(--surface)', fontSize: '12px' }} />
                  <Bar dataKey="Enterprise" stackId="a" fill="#4c1d95" />
                  <Bar dataKey="Growth" stackId="a" fill="#7c3aed" />
                  <Bar dataKey="Scale" stackId="a" fill="#a78bfa" />
                  <Bar dataKey="Starter" stackId="a" fill="#ddd6fe" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ── Tab 4: Revenue Impact ── */}
        {activeTab === 'Revenue Impact' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div className="card" style={{ padding: '22px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Revenue Loss vs Saved</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>Monthly MRR impact from churn outreach</p>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={[
                  { month: 'May', loss: 12, saved: 28 },
                  { month: 'Jun', loss: 9, saved: 34 },
                  { month: 'Jul', loss: 7, saved: 41 },
                  { month: 'Aug', loss: 5, saved: 48 },
                ]} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: '10px', background: 'var(--surface)', fontSize: '12px' }} />
                  <Bar dataKey="loss" fill="#e11d48" name="Lost MRR ($K)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="saved" fill="#16a34a" name="Saved MRR ($K)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card" style={{ padding: '22px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>MRR Growth Trend</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>Cumulative MRR retention trajectory</p>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={[
                  { month: 'Jan', mrr: 142 }, { month: 'Feb', mrr: 148 },
                  { month: 'Mar', mrr: 152 }, { month: 'Apr', mrr: 160 },
                  { month: 'May', mrr: 167 }, { month: 'Jun', mrr: 172 },
                  { month: 'Jul', mrr: 180 }, { month: 'Aug', mrr: 184.2 },
                ]} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} domain={[100, 200]} />
                  <Tooltip contentStyle={{ borderRadius: '10px', background: 'var(--surface)', fontSize: '12px' }} />
                  <Line type="monotone" dataKey="mrr" stroke="#7c3aed" strokeWidth={2.5} dot={{ fill: '#7c3aed', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

export default Analytics
