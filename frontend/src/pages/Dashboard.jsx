import { useState, useEffect } from 'react'
import Sidebar from '../components/Sidebar'
import Header from '../components/Header'
import { getDashboardStats, runBatchAnalysis } from '../api/dashboard'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts'
import {
  Users, UserCheck, AlertTriangle, TrendingUp,
  ShieldAlert, ShieldCheck, DollarSign, Target, Activity, Sparkles, ChevronRight, Zap
} from 'lucide-react'

const churnVsRetentionData = [
  { month: 'Jan', retained: 92, churn: 8 },
  { month: 'Feb', retained: 93, churn: 7.5 },
  { month: 'Mar', retained: 91, churn: 8.5 },
  { month: 'Apr', retained: 94, churn: 7 },
  { month: 'May', retained: 93, churn: 7.5 },
  { month: 'Jun', retained: 95, churn: 6.5 },
  { month: 'Jul', retained: 96, churn: 6.0 },
  { month: 'Aug', retained: 96, churn: 5.5 },
]

const mrrData = [
  { month: 'Jan', mrr: 142 },
  { month: 'Feb', mrr: 148 },
  { month: 'Mar', mrr: 152 },
  { month: 'Apr', mrr: 160 },
  { month: 'May', mrr: 167 },
  { month: 'Jun', mrr: 172 },
  { month: 'Jul', mrr: 180 },
  { month: 'Aug', mrr: 184 },
]

const planTierData = [
  { name: 'Growth', value: 45, color: '#7c3aed' },
  { name: 'Starter', value: 35, color: '#a78bfa' },
  { name: 'Scale', value: 20, color: '#ddd6fe' },
]

const fallbackHighRisk = [
  { id: '1', name: 'Liam Kim', company: 'Lumen Health · Growth', probability: 100, barPct: 90, color: '#9333ea' },
  { id: '2', name: 'Olivia Reyes', company: 'Skyline Media · Starter', probability: 107, barPct: 95, color: '#6b7280' },
  { id: '3', name: 'Mason Brooks', company: 'Pulse Fitness · Growth', probability: 131, barPct: 100, color: '#16a34a' },
  { id: '4', name: 'Sophia Costa', company: 'Atlas Logistics · Scale', probability: 74, barPct: 70, color: '#ea580c' },
  { id: '5', name: 'Mia Johnson', company: 'Quanta AI · Starter', probability: 94, barPct: 85, color: '#8b5cf6' },
]

const recentActivityList = [
  {
    title: 'New churn prediction completed',
    sub: 'Model scored 48 customers — 7 flagged high risk.',
    time: '2 min ago · AI Engine'
  },
  {
    title: 'High-risk alert: Vertex Retail',
    sub: 'Churn probability rose to 91% after 3 support escalations.',
    time: '18 min ago · System'
  },
  {
    title: 'Dataset uploaded',
    sub: 'customers_q3.csv imported with 12,480 rows.',
    time: '1 hr ago · Maya Chen'
  },
  {
    title: 'Monthly churn report generated',
    sub: 'PDF report ready for download in Reports.',
    time: '3 hr ago · Owen Brooks'
  },
  {
    title: 'Customer reactivated',
    sub: 'Cobalt Bank moved from at-risk to active after outreach.',
    time: '5 hr ago · Liam Carter'
  },
  {
    title: 'Model retrained',
    sub: 'Gradient-boosted model v2.4 deployed with 94.2% accuracy.',
    time: 'Yesterday · AI Engine'
  },
]

function Dashboard() {
  const [stats, setStats] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    try {
      const data = await getDashboardStats()
      if (data.available) setStats(data)
    } catch (e) {
      console.log(e)
    }
  }

  // Dynamic values calculated directly from uploaded dataset if available
  const total = stats?.total_analyzed || 12480
  const high  = stats?.high_risk_count  || 1747
  const med   = stats?.medium_risk_count|| 2995
  const low   = stats?.low_risk_count   || 7738
  const activeCount = total - high
  const churnRatePct = stats?.avg_churn_rate !== undefined
    ? stats.avg_churn_rate
    : Math.round((high / total) * 100 * 10) / 10

  const mrrTotal = stats?.total_mrr
    ? `$${stats.total_mrr.toLocaleString()}`
    : '$184.2K'

  // Dynamic Donut percentages based on live database metrics
  const lowPct = Math.round((low / total) * 100)
  const medPct = Math.round((med / total) * 100)
  const highPct = 100 - lowPct - medPct

  const riskDonutData = [
    { name: 'Low Risk', value: lowPct, color: '#22c55e' },
    { name: 'Medium Risk', value: medPct, color: '#d97706' },
    { name: 'High Risk', value: highPct, color: '#e11d48' },
  ]

  const tableData = stats?.results && stats.results.length > 0
    ? stats.results.slice(0, 5).map((r, i) => ({
        id: r.customerID || i,
        name: r.customerID || `Customer #${i + 1}`,
        company: 'Telco Account',
        probability: Math.round(r.churn_probability),
        barPct: Math.min(100, Math.round(r.churn_probability)),
        color: fallbackHighRisk[i % 5].color
      }))
    : fallbackHighRisk

  return (
    <div className="page-layout">
      <Sidebar />
      <div className="page-content" style={{ padding: '24px 32px' }}>

        <Header title="Dashboard" subtitle="Welcome back, Maya — here's your churn outlook." />

        {/* ── Stat Cards Grid (Rows 1 & 2) ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '16px' }}>
          
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>Total Customers</p>
                <p style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                  {total.toLocaleString()}
                </p>
              </div>
              <div style={{ width: '40px', height: '40px', background: 'var(--purple-50)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users size={20} color="var(--purple-600)" />
              </div>
            </div>
            <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>
              <span>↗ +4.2%</span> <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>vs last month</span>
            </div>
          </div>

          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>Active Customers</p>
                <p style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                  {activeCount.toLocaleString()}
                </p>
              </div>
              <div style={{ width: '40px', height: '40px', background: 'rgba(34, 197, 94, 0.12)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <UserCheck size={20} color="#16a34a" />
              </div>
            </div>
            <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#16a34a', fontWeight: 600 }}>
              <span>↗ +2.1%</span> <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>vs last month</span>
            </div>
          </div>

          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>High Risk</p>
                <p style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                  {high.toLocaleString()}
                </p>
              </div>
              <div style={{ width: '40px', height: '40px', background: 'rgba(225, 29, 72, 0.12)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AlertTriangle size={20} color="#e11d48" />
              </div>
            </div>
            <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#e11d48', fontWeight: 600 }}>
              <span>↘ -0.8%</span> <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>vs last month</span>
            </div>
          </div>

          <div className="card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>Churn Rate</p>
                <p style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
                  {churnRatePct}%
                </p>
              </div>
              <div style={{ width: '40px', height: '40px', background: 'rgba(217, 119, 6, 0.12)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <TrendingUp size={20} color="#d97706" />
              </div>
            </div>
            <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#e11d48', fontWeight: 600 }}>
              <span>↘ -1.2%</span> <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>vs last month</span>
            </div>
          </div>

        </div>

        {/* Row 2 of Stat Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
          
          <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '38px', height: '38px', background: 'rgba(217, 119, 6, 0.12)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldAlert size={18} color="#d97706" />
            </div>
            <div>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Medium Risk</p>
              <p style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
                {med.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '38px', height: '38px', background: 'rgba(34, 197, 94, 0.12)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShieldCheck size={18} color="#16a34a" />
            </div>
            <div>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Low Risk</p>
              <p style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
                {low.toLocaleString()}
              </p>
            </div>
          </div>

          <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '38px', height: '38px', background: 'var(--purple-50)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DollarSign size={18} color="var(--purple-600)" />
            </div>
            <div>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Revenue (MRR)</p>
              <p style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
                {mrrTotal}
              </p>
            </div>
          </div>

          <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '38px', height: '38px', background: 'var(--purple-50)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Target size={18} color="var(--purple-600)" />
            </div>
            <div>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Prediction Accuracy</p>
              <p style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>94.2%</p>
            </div>
          </div>

        </div>

        {/* ── Main Charts Row 1 ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '16px' }}>

          <div className="card" style={{ padding: '22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Churn vs Retention Trend</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Monthly churn rate and retained customer base</p>
              </div>
              <span className="badge badge-green" style={{ fontSize: '11px' }}>
                ● Trending down
              </span>
            </div>

            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={churnVsRetentionData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="retainedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.02}/>
                  </linearGradient>
                  <linearGradient id="churnGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.01}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} domain={[0, 100]} />
                <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', fontSize: '12px' }} />
                <Area type="monotone" dataKey="retained" stroke="#8b5cf6" strokeWidth={2.5} fill="url(#retainedGrad)" />
                <Area type="monotone" dataKey="churn" stroke="#ef4444" strokeWidth={2.5} fill="url(#churnGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="card" style={{ padding: '22px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Risk Distribution</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Customers by risk band</p>
            </div>

            <div style={{ position: 'relative', height: '160px', margin: '8px 0' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={riskDonutData}
                    cx="50%" cy="50%"
                    innerRadius={48} outerRadius={68}
                    paddingAngle={3} dataKey="value"
                  >
                    {riskDonutData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-primary)', fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {riskDonutData.map(item => (
                <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color }} />
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{item.name}</span>
                  </div>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{item.value}%</span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* ── Main Charts Row 2 (3 Columns) ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '24px' }}>

          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>Revenue Impact</h3>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '14px' }}>MRR trend (in $K)</p>
            
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={mrrData} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} domain={[50, 200]} />
                <Tooltip contentStyle={{ borderRadius: '10px', background: 'var(--surface)', color: 'var(--text-primary)', fontSize: '11px' }} />
                <Line type="monotone" dataKey="mrr" stroke="#16a34a" strokeWidth={2} dot={{ fill: '#16a34a', r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>Plan Distribution</h3>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '14px' }}>Customers by plan tier</p>

            <ResponsiveContainer width="100%" height={140}>
              <PieChart>
                <Pie data={planTierData} cx="50%" cy="50%" outerRadius={52} dataKey="value">
                  {planTierData.map((e, i) => (
                    <Cell key={i} fill={e.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '10px', background: 'var(--surface)', color: 'var(--text-primary)', fontSize: '11px' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', alignSelf: 'flex-start' }}>Prediction Accuracy</h3>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', alignSelf: 'flex-start', marginBottom: '10px' }}>Model confidence over time</p>

            <div style={{ position: 'relative', width: '110px', height: '110px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="110" height="110" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" stroke="var(--border)" strokeWidth="10" fill="none" />
                <circle cx="50" cy="50" r="40" stroke="var(--purple-600)" strokeWidth="10" fill="none" strokeDasharray="251.2" strokeDashoffset="14.5" strokeLinecap="round" transform="rotate(-90 50 50)" />
              </svg>
              <div style={{ position: 'absolute', textAlign: 'center' }}>
                <p style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>94.2%</p>
                <p style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: '2px' }}>Model accuracy</p>
              </div>
            </div>
          </div>

        </div>

        {/* ── Bottom Section: High Risk Customers & Recent Activity ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '20px' }}>

          <div className="card" style={{ padding: '22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>Highest Risk Customers</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Customers most likely to churn this cycle</p>
              </div>
              <button
                onClick={() => navigate('/customers')}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '2px' }}
              >
                View all <ChevronRight size={14} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {tableData.map(item => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', borderRadius: '12px', background: 'var(--surface-hover)',
                    transition: 'background 150ms ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '50%',
                      background: item.color, color: '#fff', fontWeight: 700, fontSize: '11px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      {item.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{item.name}</p>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.company}</p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '180px' }}>
                    <div style={{ flex: 1, height: '6px', background: 'var(--border)', borderRadius: '99px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${item.barPct}%`, background: '#e11d48', borderRadius: '99px' }} />
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', width: '38px', textAlign: 'right' }}>
                      {item.probability}%
                    </span>
                  </div>

                  <div style={{ marginLeft: '16px' }}>
                    <span className="badge badge-red" style={{ fontSize: '11px' }}>
                      ● High Risk
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: '22px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '2px' }}>Recent Activity</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '20px' }}>Latest events across your workspace</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', position: 'relative' }}>
              <div style={{ position: 'absolute', top: '10px', bottom: '10px', left: '13px', width: '2px', background: 'var(--border)' }} />

              {recentActivityList.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', position: 'relative', zIndex: 1 }}>
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '50%',
                    background: 'var(--purple-50)', border: '2px solid var(--surface)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                  }}>
                    <Activity size={13} color="var(--purple-600)" />
                  </div>
                  <div>
                    <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                      {item.title}
                    </p>
                    <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', lineHeight: 1.3 }}>
                      {item.sub}
                    </p>
                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {item.time}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* ── AI Insight Banner ── */}
        <div style={{
          background: 'var(--purple-50)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '42px', height: '42px', borderRadius: '12px',
              background: 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(124, 58, 237, 0.25)', flexShrink: 0
            }}>
              <Sparkles size={20} color="#fff" />
            </div>
            <div>
              <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                AI Insight · {high} high-risk customers need attention this week
              </p>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Proactive outreach on these accounts could recover an estimated {mrrTotal} MRR. Open the Predictions page to see recommendations.
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate('/predict')}
            className="btn-primary"
            style={{ padding: '9px 18px', fontSize: '13px', whiteSpace: 'nowrap' }}
          >
            <Zap size={15} /> View Predictions
          </button>
        </div>

      </div>
    </div>
  )
}

export default Dashboard