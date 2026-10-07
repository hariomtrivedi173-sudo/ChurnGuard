import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import ChurnGuardLogo from '../components/ChurnGuardLogo'
import { useTheme } from '../components/useTheme'
import {
  ArrowRight, ArrowUpRight, CheckCircle2,
  Zap, Database, Cpu, Sliders, AlertTriangle,
  Clock, Sparkles, Activity, FileSpreadsheet,
  Sun, Moon
} from 'lucide-react'

export default function Landing() {
  const { theme, toggleTheme } = useTheme()
  const [activeWorkflowStep, setActiveWorkflowStep] = useState(0)
  const [activeAnalyticsTab, setActiveAnalyticsTab] = useState('tenure')
  const [activeRiskFilter, setActiveRiskFilter] = useState('all')

  // Auto-advance workflow demonstration gently
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveWorkflowStep((prev) => (prev + 1) % 5)
    }, 4500)
    return () => clearInterval(timer)
  }, [])

  const workflowSteps = [
    {
      num: '01',
      title: 'Upload Customer Data',
      tag: 'Raw Telemetry Ingestion',
      desc: 'Ingests billing records, contract commitment parameters, tenure length, and service telemetry via CSV upload or real-time sync.',
      icon: FileSpreadsheet,
    },
    {
      num: '02',
      title: 'AI Analyzes Signals',
      tag: 'Ensemble Machine Learning',
      desc: 'Processes 19 predictive behavioral dimensions across multi-model estimators with calibrated probability curves.',
      icon: Cpu,
    },
    {
      num: '03',
      title: 'Predict Churn Risk',
      tag: 'Risk Tier Stratification',
      desc: 'Calculates precise attrition probabilities, segmenting the customer base into High (>65%), Medium (35–65%), and Low (<35%) risk tiers.',
      icon: AlertTriangle,
    },
    {
      num: '04',
      title: 'Understand Why',
      tag: 'Explainable AI Attribution',
      desc: 'Isolates the mechanical friction drivers behind each flagged account, distinguishing pricing sensitivity from onboarding service gaps.',
      icon: Sliders,
    },
    {
      num: '05',
      title: 'Take Action',
      tag: 'Operational Retention Playbooks',
      desc: 'Deploys prescribed customer success interventions, automated contract transition incentives, and proactive team workflows.',
      icon: CheckCircle2,
    },
  ]

  const sampleRiskAccounts = [
    { id: '#CUST-7590', name: 'Apex Cloud Systems', tier: 'High Risk', prob: 88.4, mrr: '₹6,450', tenure: '4 mos', contract: 'Month-to-month' },
    { id: '#CUST-5575', name: 'Vortex Media Group', tier: 'High Risk', prob: 76.2, mrr: '₹5,695', tenure: '6 mos', contract: 'Month-to-month' },
    { id: '#CUST-3668', name: 'Krypton Logistics', tier: 'Medium Risk', prob: 48.1, mrr: '₹5,385', tenure: '14 mos', contract: 'One year' },
    { id: '#CUST-2184', name: 'Solaria BioLabs', tier: 'Medium Risk', prob: 41.5, mrr: '₹3,200', tenure: '18 mos', contract: 'Month-to-month' },
    { id: '#CUST-9012', name: 'Zenith Retail Corp', tier: 'Low Risk', prob: 12.8, mrr: '₹8,900', tenure: '42 mos', contract: 'Two year' },
    { id: '#CUST-4431', name: 'Atlas Data Services', tier: 'Low Risk', prob: 8.4, mrr: '₹4,150', tenure: '56 mos', contract: 'Two year' },
  ]

  const filteredAccounts = activeRiskFilter === 'all'
    ? sampleRiskAccounts
    : sampleRiskAccounts.filter(acc => acc.tier.toLowerCase().includes(activeRiskFilter.toLowerCase()))

  return (
    <div className="landing-page-wrap">
      {/* ─────────────────────────────────────────────────────────────
          1. NAVIGATION
         ───────────────────────────────────────────────────────────── */}
      <nav className="landing-nav" aria-label="Main Navigation">
        <div className="landing-nav-inner">
          <ChurnGuardLogo
            variant="landing"
            size="md"
            linkTo="/"
            showWordmark={true}
            showTagline={true}
            tagline="AI Churn Intelligence"
          />

          <ul className="landing-nav-links">
            <li>
              <a href="#product" className="landing-nav-link">Product</a>
            </li>
            <li>
              <a href="#workflow" className="landing-nav-link">How It Works</a>
            </li>
            <li>
              <a href="#analytics" className="landing-nav-link">Analytics</a>
            </li>
            <li>
              <a href="#features" className="landing-nav-link">Features</a>
            </li>
          </ul>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              id="landing-theme-toggle"
              type="button"
              onClick={toggleTheme}
              className="navbar-icon-btn theme-btn"
              title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
              aria-label={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
              aria-pressed={theme === 'dark'}
              style={{ width: '36px', height: '36px' }}
            >
              {theme === 'light' ? (
                <Moon size={16} className="theme-switch-icon moon-icon" />
              ) : (
                <Sun size={16} className="theme-switch-icon sun-icon" />
              )}
            </button>
            <Link
              to="/login"
              className="landing-nav-link"
              style={{ fontWeight: 600 }}
            >
              Login
            </Link>
            <Link
              to="/register"
              className="landing-btn-hero landing-btn-primary"
              style={{ padding: '8px 18px', fontSize: '13px', borderRadius: '10px' }}
            >
              Get Started
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </nav>

      {/* ─────────────────────────────────────────────────────────────
          2. HERO
         ───────────────────────────────────────────────────────────── */}
      <section className="landing-hero-section landing-grid-bg">
        <div style={{ marginBottom: '16px' }}>
          <span className="figure-badge">
            <Sparkles size={12} />
            Enterprise Retention Intelligence
          </span>
        </div>

        <h1 className="landing-hero-headline">
          Predict customer churn before it becomes revenue loss.
        </h1>

        <p className="landing-hero-sub">
          ChurnGuard ingests customer usage telemetry, calculates calibrated attrition risk
          with ensemble machine learning, explains the underlying behavioral drivers, and
          prescribes targeted retention actions.
        </p>

        <div className="landing-cta-group">
          <Link to="/register" className="landing-btn-hero landing-btn-primary">
            Get Started
            <ArrowRight size={16} />
          </Link>
          <Link to="/dashboard" className="landing-btn-hero landing-btn-secondary">
            Explore Dashboard
            <ArrowUpRight size={16} color="var(--slate-400)" />
          </Link>
        </div>

        {/* Hero Capabilities Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '28px',
            marginTop: '44px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--slate-600)' }}>
            <CheckCircle2 size={16} color="var(--success)" />
            <span>Ensemble Machine Learning</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--slate-600)' }}>
            <CheckCircle2 size={16} color="var(--success)" />
            <span>Calibrated Risk Scoring</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--slate-600)' }}>
            <CheckCircle2 size={16} color="var(--success)" />
            <span>Explainable Factor Attribution</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--slate-600)' }}>
            <CheckCircle2 size={16} color="var(--success)" />
            <span>Targeted Retention Playbooks</span>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          3. HERO PRODUCT VISUALIZATION
         ───────────────────────────────────────────────────────────── */}
      <section id="product" style={{ padding: '0 24px 70px 24px', maxWidth: '1200px', margin: '0 auto' }}>
        <div className="figure-card" style={{ boxShadow: 'var(--shadow-lg)' }}>
          {/* Mock Window Bar */}
          <div className="figure-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#EF4444' }} />
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#F59E0B' }} />
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10B981' }} />
              <span style={{ marginLeft: '12px', fontSize: '12px', fontFamily: 'monospace', color: 'var(--slate-500)' }}>
                churnguard.internal / telemetry / active-cohort
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="figure-badge" style={{ fontSize: '10px', padding: '2px 8px' }}>
                Product Visualization
              </span>
            </div>
          </div>

          {/* Product Interface Preview */}
          <div style={{ padding: '28px', backgroundColor: 'var(--background)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
              {/* Left Column: Customer Profile & Risk Level */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="card" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
                    <div>
                      <span style={{ fontSize: '11px', fontFamily: 'monospace', color: 'var(--slate-500)' }}>#CUST-8492</span>
                      <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                        Apex Cloud Systems
                      </h3>
                      <p style={{ fontSize: '12px', color: 'var(--slate-500)' }}>Enterprise Account · 8 months tenure · ₹6,450 / month</p>
                    </div>
                    <span className="badge badge-red" style={{ fontSize: '12px', padding: '4px 10px' }}>
                      High Risk
                    </span>
                  </div>

                  {/* Probability Dial / Progress */}
                  <div style={{ margin: '18px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--slate-600)' }}>Calculated Churn Probability</span>
                      <span style={{ fontSize: '24px', fontWeight: 800, color: 'var(--danger)' }}>78.4%</span>
                    </div>
                    <div style={{ height: '10px', background: 'var(--slate-200)', borderRadius: '99px', overflow: 'hidden', display: 'flex' }}>
                      <div style={{ width: '78.4%', background: 'var(--danger)', borderRadius: '99px', transition: 'width 300ms ease' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--slate-400)', marginTop: '6px' }}>
                      <span>Safe (&lt;35%)</span>
                      <span>Moderate (35–65%)</span>
                      <span style={{ color: 'var(--danger)', fontWeight: 600 }}>Critical (&gt;65%)</span>
                    </div>
                  </div>

                  <div style={{ padding: '12px', borderRadius: '10px', background: 'var(--slate-50)', border: '1px solid var(--border)', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ color: 'var(--slate-500)' }}>Contract Type:</span>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Month-to-Month</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--slate-500)' }}>Support Plan:</span>
                      <span style={{ fontWeight: 600, color: 'var(--danger)' }}>None (Self-Serve Only)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: AI Explanation & Prescribed Recommendation */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="card" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                    <Sliders size={16} color="var(--slate-700)" />
                    <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                      AI Explanation — Attribution Breakdown
                    </h4>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span style={{ color: 'var(--slate-700)' }}>Month-to-month commitment friction</span>
                      <span style={{ fontWeight: 700, color: 'var(--danger)' }}>+32% Risk</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span style={{ color: 'var(--slate-700)' }}>No Tech Support add-on on Fiber tier</span>
                      <span style={{ fontWeight: 700, color: 'var(--danger)' }}>+22% Risk</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span style={{ color: 'var(--slate-700)' }}>High electronic billing sensitivity</span>
                      <span style={{ fontWeight: 700, color: 'var(--danger)' }}>+18% Risk</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px' }}>
                      <span style={{ color: 'var(--slate-700)' }}>Multi-user household partner anchor</span>
                      <span style={{ fontWeight: 700, color: 'var(--success)' }}>-12% Protection</span>
                    </div>
                  </div>

                  {/* Recommendation Card */}
                  <div style={{ padding: '14px', borderRadius: '12px', background: 'var(--slate-50)', border: '1px solid var(--slate-200)', borderLeft: '3px solid var(--slate-900)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      <Zap size={15} color="var(--slate-900)" />
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--slate-900)' }}>
                        Prescribed Retention Playbook
                      </span>
                    </div>
                    <p style={{ fontSize: '12px', color: 'var(--slate-700)', lineHeight: 1.45, margin: 0 }}>
                      Transition account to Annual Commitment with complimentary 3-month Dedicated Support add-on.
                      Estimated risk reduction: <strong>-42%</strong>.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          4. FIG 1.0 — CHURN INTELLIGENCE (ANIMATED DATA PIPELINE)
         ───────────────────────────────────────────────────────────── */}
      <section style={{ padding: '60px 24px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <span className="figure-badge">FIG 1.0</span>
          <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--slate-400)', letterSpacing: '0.08em', marginTop: '6px', textTransform: 'uppercase' }}>
            TELEMETRY INGESTION &amp; PIPELINE FLOW
          </p>
          <h2 style={{ fontSize: '28px', fontWeight: 800, marginTop: '4px', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            Churn Intelligence
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--slate-600)', maxWidth: '640px', margin: '8px auto 0 auto', lineHeight: 1.5 }}>
            Customer data streams converge into ChurnGuard's AI engine to continuously compute calibrated risk predictions and trigger proactive retention workflows.
          </p>
        </div>

        {/* Animated Visual Canvas */}
        <div className="figure-card" style={{ padding: '36px 24px', background: 'var(--surface)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', position: 'relative' }}>
            {/* 1. Input Data Nodes */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minWidth: '160px', flex: 1 }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--slate-400)', textTransform: 'uppercase' }}>
                Customer Data Streams
              </span>
              <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'var(--slate-50)', border: '1px solid var(--border)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Database size={14} color="var(--slate-600)" />
                <span>Billing History</span>
              </div>
              <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'var(--slate-50)', border: '1px solid var(--border)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={14} color="var(--slate-600)" />
                <span>Account Tenure</span>
              </div>
              <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'var(--slate-50)', border: '1px solid var(--border)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={14} color="var(--slate-600)" />
                <span>Service Telemetry</span>
              </div>
              <div style={{ padding: '10px 14px', borderRadius: '8px', background: 'var(--slate-50)', border: '1px solid var(--border)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sliders size={14} color="var(--slate-600)" />
                <span>Contract Type</span>
              </div>
            </div>

            {/* Connecting SVG Flow 1 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '60px', height: '140px' }}>
              <svg width="60" height="140" viewBox="0 0 60 140" fill="none" style={{ overflow: 'visible' }}>
                <path d="M 0 20 Q 30 20 60 70" stroke="var(--slate-300)" strokeWidth="2" className="anim-flow-line" />
                <path d="M 0 55 Q 30 55 60 70" stroke="var(--slate-300)" strokeWidth="2" className="anim-flow-line" />
                <path d="M 0 85 Q 30 85 60 70" stroke="var(--slate-300)" strokeWidth="2" className="anim-flow-line" />
                <path d="M 0 120 Q 30 120 60 70" stroke="var(--slate-300)" strokeWidth="2" className="anim-flow-line" />
                <circle cx="30" cy="45" r="3.5" fill="var(--slate-400)" />
                <circle cx="30" cy="95" r="3.5" fill="var(--slate-400)" />
              </svg>
            </div>

            {/* 2. Central AI Analysis Node */}
            <div
              className="anim-node-pulse"
              style={{
                padding: '24px 20px',
                borderRadius: '16px',
                background: 'var(--surface)',
                border: '1.5px solid var(--slate-300)',
                boxShadow: 'var(--shadow-sm)',
                textAlign: 'center',
                minWidth: '200px',
                flex: 1,
              }}
            >
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'var(--slate-900)', margin: '0 auto 10px auto', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.12)' }}>
                <Cpu size={22} color="#ffffff" />
              </div>
              <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--slate-900)', margin: '0 0 4px 0' }}>
                AI Analysis Node
              </h4>
              <p style={{ fontSize: '11px', color: 'var(--slate-600)', margin: 0 }}>
                Voting Classifier Ensemble<br />(XGBoost + LightGBM + RF)
              </p>
            </div>

            {/* Connecting SVG Flow 2 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '60px', height: '140px' }}>
              <svg width="60" height="140" viewBox="0 0 60 140" fill="none" style={{ overflow: 'visible' }}>
                <path d="M 0 70 Q 30 70 60 40" stroke="var(--slate-300)" strokeWidth="2" className="anim-flow-line" />
                <path d="M 0 70 Q 30 70 60 100" stroke="var(--slate-300)" strokeWidth="2" className="anim-flow-line" />
                <circle cx="30" cy="55" r="3.5" fill="var(--danger)" />
                <circle cx="30" cy="85" r="3.5" fill="var(--success)" />
              </svg>
            </div>

            {/* 3. Output Stage: Prediction & Action */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: '180px', flex: 1 }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--slate-400)', textTransform: 'uppercase' }}>
                Inference Outcome
              </span>
              <div style={{ padding: '12px', borderRadius: '10px', background: 'var(--slate-50)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--slate-600)' }}>Risk Prediction</span>
                  <span className="badge badge-red" style={{ fontSize: '10px' }}>78.4% Probability</span>
                </div>
                <span style={{ fontSize: '10px', color: 'var(--slate-500)' }}>Calibrated multi-model confidence</span>
              </div>
              <div style={{ padding: '12px', borderRadius: '10px', background: 'var(--slate-50)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--slate-600)' }}>Action Dispatched</span>
                  <span className="badge badge-green" style={{ fontSize: '10px' }}>Playbook Ready</span>
                </div>
                <span style={{ fontSize: '10px', color: 'var(--slate-500)' }}>CS team outreach playbook queued</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          5. FIG 2.0 — CUSTOMER RISK (MOVING CLASSIFICATION FLOW)
         ───────────────────────────────────────────────────────────── */}
      <section style={{ padding: '60px 24px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <span className="figure-badge">FIG 2.0</span>
          <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--slate-400)', letterSpacing: '0.08em', marginTop: '6px', textTransform: 'uppercase' }}>
            CALIBRATED RISK STRATIFICATION
          </p>
          <h2 style={{ fontSize: '28px', fontWeight: 800, marginTop: '4px', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            Customer Risk
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--slate-600)', maxWidth: '640px', margin: '8px auto 0 auto', lineHeight: 1.5 }}>
            Incoming account signals are evaluated against threshold sensitivities and dynamically categorized into operational risk cohorts.
          </p>
        </div>

        <div className="figure-card" style={{ padding: '28px', position: 'relative' }}>
          {/* Subtle Scanning Beam */}
          <div className="anim-scan-beam" />

          {/* Filter Pills */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setActiveRiskFilter('all')}
                className={`tab-pill ${activeRiskFilter === 'all' ? 'active' : ''}`}
              >
                All Accounts ({sampleRiskAccounts.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveRiskFilter('high')}
                className={`tab-pill ${activeRiskFilter === 'high' ? 'active' : ''}`}
              >
                High Risk
              </button>
              <button
                type="button"
                onClick={() => setActiveRiskFilter('medium')}
                className={`tab-pill ${activeRiskFilter === 'medium' ? 'active' : ''}`}
              >
                Medium Risk
              </button>
              <button
                type="button"
                onClick={() => setActiveRiskFilter('low')}
                className={`tab-pill ${activeRiskFilter === 'low' ? 'active' : ''}`}
              >
                Low Risk
              </button>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--slate-500)', fontStyle: 'italic' }}>
              Simulated Real-Time Classification
            </span>
          </div>

          {/* 3 Risk Cohort Columns */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px' }}>
            {/* High Risk Tier */}
            <div style={{ borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--slate-50)', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--danger)' }} />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--danger)' }}>High Risk (&gt;65%)</span>
                </div>
                <span className="badge badge-red" style={{ fontSize: '10px' }}>Immediate Action</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filteredAccounts.filter(a => a.tier === 'High Risk').map(acc => (
                  <div key={acc.id} className="card" style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{acc.name}</span>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--danger)' }}>{acc.prob}%</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--slate-500)', marginTop: '4px' }}>
                      <span>{acc.contract}</span>
                      <span>{acc.mrr}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Medium Risk Tier */}
            <div style={{ borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--slate-50)', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--warning)' }} />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--warning)' }}>Medium Risk (35–65%)</span>
                </div>
                <span className="badge badge-amber" style={{ fontSize: '10px' }}>Monitor</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filteredAccounts.filter(a => a.tier === 'Medium Risk').map(acc => (
                  <div key={acc.id} className="card" style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{acc.name}</span>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--warning)' }}>{acc.prob}%</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--slate-500)', marginTop: '4px' }}>
                      <span>{acc.contract}</span>
                      <span>{acc.mrr}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Low Risk Tier */}
            <div style={{ borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--slate-50)', padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)' }} />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--success)' }}>Low Risk (&lt;35%)</span>
                </div>
                <span className="badge badge-green" style={{ fontSize: '10px' }}>Stable</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {filteredAccounts.filter(a => a.tier === 'Low Risk').map(acc => (
                  <div key={acc.id} className="card" style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)' }}>{acc.name}</span>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--success)' }}>{acc.prob}%</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--slate-500)', marginTop: '4px' }}>
                      <span>{acc.contract}</span>
                      <span>{acc.mrr}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          6. FIG 3.0 — PREDICTION EXPLANATION (EXPLAINABLE AI)
         ───────────────────────────────────────────────────────────── */}
      <section style={{ padding: '60px 24px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <span className="figure-badge">FIG 3.0</span>
          <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--slate-400)', letterSpacing: '0.08em', marginTop: '6px', textTransform: 'uppercase' }}>
            TRANSPARENT ATTRIBUTION ENGINE
          </p>
          <h2 style={{ fontSize: '28px', fontWeight: 800, marginTop: '4px', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            Prediction Explanation
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--slate-600)', maxWidth: '640px', margin: '8px auto 0 auto', lineHeight: 1.5 }}>
            No black-box opacity. ChurnGuard reveals the exact mechanical forces behind every prediction, separating friction drivers from loyalty anchors.
          </p>
        </div>

        <div className="figure-card" style={{ padding: '28px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '28px' }}>
            {/* Left: Account Attributes */}
            <div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--slate-400)', textTransform: 'uppercase', display: 'block', marginBottom: '12px' }}>
                Evaluated Customer Attributes
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '8px', background: 'var(--slate-50)', fontSize: '12px' }}>
                  <span style={{ color: 'var(--slate-600)' }}>Contract Duration</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Month-to-Month</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '8px', background: 'var(--slate-50)', fontSize: '12px' }}>
                  <span style={{ color: 'var(--slate-600)' }}>Account Tenure</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>4 Months (Early Lifecycle)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '8px', background: 'var(--slate-50)', fontSize: '12px' }}>
                  <span style={{ color: 'var(--slate-600)' }}>Internet Service Tier</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Fiber Optic (No TechSupport)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '8px', background: 'var(--slate-50)', fontSize: '12px' }}>
                  <span style={{ color: 'var(--slate-600)' }}>Payment Method</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Electronic Check</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderRadius: '8px', background: 'var(--slate-50)', fontSize: '12px' }}>
                  <span style={{ color: 'var(--slate-600)' }}>Monthly Charges</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>₹5,850 / month</span>
                </div>
              </div>
            </div>

            {/* Right: Factor Attributions */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '12px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--slate-400)', textTransform: 'uppercase' }}>
                  Attribution Factor Impact
                </span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--danger)' }}>
                  Overall Churn Probability: 84.6%
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--danger)' }}>Month-to-Month Contract Elasticity</span>
                    <span style={{ fontWeight: 700, color: 'var(--danger)' }}>+34% Risk</span>
                  </div>
                  <div style={{ height: '7px', background: 'var(--slate-100)', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{ width: '85%', height: '100%', background: 'var(--danger)', borderRadius: '99px' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--danger)' }}>Fiber Optic Without Tech Support</span>
                    <span style={{ fontWeight: 700, color: 'var(--danger)' }}>+26% Risk</span>
                  </div>
                  <div style={{ height: '7px', background: 'var(--slate-100)', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{ width: '68%', height: '100%', background: 'var(--danger)', borderRadius: '99px' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--danger)' }}>Electronic Check Payment Friction</span>
                    <span style={{ fontWeight: 700, color: 'var(--danger)' }}>+16% Risk</span>
                  </div>
                  <div style={{ height: '7px', background: 'var(--slate-100)', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{ width: '42%', height: '100%', background: 'var(--danger)', borderRadius: '99px' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--success)' }}>Multi-User Household Account (Partner)</span>
                    <span style={{ fontWeight: 700, color: 'var(--success)' }}>-14% Retention Anchor</span>
                  </div>
                  <div style={{ height: '7px', background: 'var(--slate-100)', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{ width: '38%', height: '100%', background: 'var(--success)', borderRadius: '99px' }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          7. FIG 4.0 — RECOMMENDED ACTIONS
         ───────────────────────────────────────────────────────────── */}
      <section style={{ padding: '60px 24px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <span className="figure-badge">FIG 4.0</span>
          <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--slate-400)', letterSpacing: '0.08em', marginTop: '6px', textTransform: 'uppercase' }}>
            OPERATIONAL PLAYBOOK DISPATCH
          </p>
          <h2 style={{ fontSize: '28px', fontWeight: 800, marginTop: '4px', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            Recommended Action
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--slate-600)', maxWidth: '640px', margin: '8px auto 0 auto', lineHeight: 1.5 }}>
            Predictions seamlessly connect into operational playbooks for customer success teams to proactively eliminate friction before cancellation.
          </p>
        </div>

        <div className="figure-card" style={{ padding: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', position: 'relative' }}>
            {/* Step 1: Flagged Customer */}
            <div className="card" style={{ padding: '16px', flex: 1, minWidth: '220px' }}>
              <span className="badge badge-red" style={{ fontSize: '10px', marginBottom: '8px' }}>High Risk Flag</span>
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: '4px 0 2px 0' }}>
                Account #7590-VHVEG
              </h4>
              <p style={{ fontSize: '12px', color: 'var(--slate-500)', margin: 0 }}>
                88.4% churn risk · ₹2,985 MRR
              </p>
            </div>

            {/* Flow Line 1 */}
            <div style={{ width: '40px', textAlign: 'center' }}>
              <svg width="40" height="24" viewBox="0 0 40 24" fill="none">
                <line x1="0" y1="12" x2="40" y2="12" stroke="var(--slate-300)" strokeWidth="2" className="anim-flow-line" />
              </svg>
            </div>

            {/* Step 2: AI Diagnosis */}
            <div className="card" style={{ padding: '16px', flex: 1, minWidth: '220px' }}>
              <span className="badge badge-amber" style={{ fontSize: '10px', marginBottom: '8px' }}>Diagnosis</span>
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: '4px 0 2px 0' }}>
                Identified Friction Points
              </h4>
              <p style={{ fontSize: '12px', color: 'var(--slate-500)', margin: 0 }}>
                Month-to-month commitment &amp; support gap
              </p>
            </div>

            {/* Flow Line 2 */}
            <div style={{ width: '40px', textAlign: 'center' }}>
              <svg width="40" height="24" viewBox="0 0 40 24" fill="none">
                <line x1="0" y1="12" x2="40" y2="12" stroke="var(--slate-300)" strokeWidth="2" className="anim-flow-line" />
              </svg>
            </div>

            {/* Step 3: Prescribed Playbook */}
            <div className="card" style={{ padding: '16px', flex: 1, minWidth: '220px', borderLeft: '3px solid var(--slate-900)' }}>
              <span className="badge badge-green" style={{ fontSize: '10px', marginBottom: '8px' }}>Action Triggered</span>
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: '4px 0 2px 0' }}>
                Annual Plan + Support Addon
              </h4>
              <p style={{ fontSize: '12px', color: 'var(--slate-500)', margin: 0 }}>
                Dispatched to Customer Success queue (-42% risk)
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          8. FIG 5.0 — ANALYTICS
         ───────────────────────────────────────────────────────────── */}
      <section id="analytics" style={{ padding: '60px 24px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <span className="figure-badge">FIG 5.0</span>
          <p style={{ fontSize: '11px', fontWeight: 700, color: 'var(--slate-400)', letterSpacing: '0.08em', marginTop: '6px', textTransform: 'uppercase' }}>
            PORTFOLIO RISK DYNAMICS
          </p>
          <h2 style={{ fontSize: '28px', fontWeight: 800, marginTop: '4px', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            Analytics
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--slate-600)', maxWidth: '640px', margin: '8px auto 0 auto', lineHeight: 1.5 }}>
            Multi-cohort telemetry uncovers systemic attrition patterns across customer lifecycles, contract architectures, and revenue exposure.
          </p>
          <span style={{ fontSize: '11px', color: 'var(--slate-400)', display: 'block', marginTop: '4px' }}>
            (Demo visualization — Illustrative values)
          </span>
        </div>

        <div className="figure-card" style={{ padding: '24px' }}>
          {/* Tab Controls */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
            <button
              type="button"
              onClick={() => setActiveAnalyticsTab('tenure')}
              className={`tab-pill ${activeAnalyticsTab === 'tenure' ? 'active' : ''}`}
            >
              Tenure Lifecycle (0–72m)
            </button>
            <button
              type="button"
              onClick={() => setActiveAnalyticsTab('contract')}
              className={`tab-pill ${activeAnalyticsTab === 'contract' ? 'active' : ''}`}
            >
              Contract Cohorts
            </button>
          </div>

          {activeAnalyticsTab === 'tenure' ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div>
                  <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                    Early Tenure Friction (58% of Churn Happens in Months 0–12)
                  </h4>
                  <p style={{ fontSize: '12px', color: 'var(--slate-500)', margin: '2px 0 0 0' }}>
                    Attrition sensitivity drops sharply once customer lifecycle crosses the 12-month milestone.
                  </p>
                </div>
                <span className="badge badge-red" style={{ fontSize: '11px' }}>Peak Risk: 0–12m</span>
              </div>

              {/* SVG Area Sparkline / Chart */}
              <div style={{ height: '140px', width: '100%', marginTop: '16px' }}>
                <svg width="100%" height="100%" viewBox="0 0 600 120" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(0, 84%, 60%)" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="hsl(0, 84%, 60%)" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M 0,20 Q 80,30 150,85 T 300,105 T 450,110 T 600,115 L 600,120 L 0,120 Z"
                    fill="url(#areaGrad)"
                  />
                  <path
                    d="M 0,20 Q 80,30 150,85 T 300,105 T 450,110 T 600,115"
                    fill="none"
                    stroke="var(--danger)"
                    strokeWidth="3"
                  />
                  <circle cx="150" cy="85" r="4" fill="var(--danger)" />
                  <text x="160" y="80" fill="var(--slate-500)" fontSize="10" fontFamily="sans-serif">12m Inflection Point</text>
                </svg>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--slate-400)', marginTop: '8px' }}>
                <span>0m (New Account)</span>
                <span>12m</span>
                <span>24m</span>
                <span>36m</span>
                <span>48m</span>
                <span>72m (Mature Baseline)</span>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ marginBottom: '14px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  Churn Probability by Contract Commitment Type
                </h4>
                <p style={{ fontSize: '12px', color: 'var(--slate-500)', margin: '2px 0 0 0' }}>
                  Two-year commitments reduce churn rate by ~90% compared to month-to-month contracts.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--danger)' }}>Month-to-Month Contract</span>
                    <span style={{ fontWeight: 700, color: 'var(--danger)' }}>42.7% Churn Rate</span>
                  </div>
                  <div style={{ height: '8px', background: 'var(--slate-100)', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{ width: '42.7%', height: '100%', background: 'var(--danger)', borderRadius: '99px' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--warning)' }}>One-Year Contract</span>
                    <span style={{ fontWeight: 700, color: 'var(--warning)' }}>11.3% Churn Rate</span>
                  </div>
                  <div style={{ height: '8px', background: 'var(--slate-100)', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{ width: '11.3%', height: '100%', background: 'var(--warning)', borderRadius: '99px' }} />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--success)' }}>Two-Year Contract</span>
                    <span style={{ fontWeight: 700, color: 'var(--success)' }}>2.8% Churn Rate</span>
                  </div>
                  <div style={{ height: '8px', background: 'var(--slate-100)', borderRadius: '99px', overflow: 'hidden' }}>
                    <div style={{ width: '2.8%', height: '100%', background: 'var(--success)', borderRadius: '99px' }} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          9. PRODUCT WORKFLOW (01 -> 02 -> 03 -> 04 -> 05)
         ───────────────────────────────────────────────────────────── */}
      <section id="workflow" style={{ padding: '60px 24px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <span className="figure-badge">Operational Architecture</span>
          <h2 style={{ fontSize: '28px', fontWeight: 800, marginTop: '8px', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            Product Workflow
          </h2>
          <p style={{ fontSize: '14px', color: 'var(--slate-600)', maxWidth: '620px', margin: '8px auto 0 auto' }}>
            A continuous closed-loop retention engine that transforms raw customer telemetry into measurable retention ROI.
          </p>
        </div>

        {/* 5-Step Grid: Horizontal on Desktop, Vertical on Mobile */}
        <div className="workflow-horizontal-grid">
          {workflowSteps.map((step, idx) => {
            const Icon = step.icon
            const isActive = activeWorkflowStep === idx
            return (
              <div
                key={step.num}
                className="workflow-step-card"
                onClick={() => setActiveWorkflowStep(idx)}
                style={{
                  cursor: 'pointer',
                  borderColor: isActive ? 'var(--slate-900)' : 'var(--border)',
                  backgroundColor: 'var(--surface)',
                  boxShadow: isActive ? '0 0 0 1px var(--slate-900), var(--shadow-sm)' : 'none',
                  transition: 'all 0.25s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span className="workflow-step-num" style={{ color: isActive ? 'var(--slate-900)' : 'var(--slate-400)' }}>{step.num}</span>
                  <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: isActive ? 'var(--slate-900)' : 'var(--slate-100)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={15} color={isActive ? '#ffffff' : 'var(--slate-600)'} />
                  </div>
                </div>
                <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  {step.title}
                </h4>
                <p style={{ fontSize: '11px', color: 'var(--slate-500)', lineHeight: 1.45, margin: 0 }}>
                  {step.desc}
                </p>
              </div>
            )
          })}
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          10. FINAL CTA
         ───────────────────────────────────────────────────────────── */}
      <section style={{ padding: '80px 24px', textAlign: 'center', backgroundColor: 'var(--background)' }}>
        <div
          style={{
            maxWidth: '800px',
            margin: '0 auto',
            padding: '50px 32px',
            borderRadius: '24px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-md)',
          }}
        >
          <span className="figure-badge" style={{ marginBottom: '14px' }}>
            Enterprise Retention System
          </span>
          <h2 style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.025em', color: 'var(--text-primary)', marginTop: '8px' }}>
            Turn churn signals into action.
          </h2>
          <p style={{ fontSize: '15px', color: 'var(--slate-600)', maxWidth: '560px', margin: '12px auto 28px auto', lineHeight: 1.55 }}>
            Equip your retention and customer success teams with predictive intelligence that safeguards recurring revenue.
          </p>
          <div className="landing-cta-group">
            <Link to="/register" className="landing-btn-hero landing-btn-primary" style={{ padding: '12px 28px' }}>
              Get Started
              <ArrowRight size={16} />
            </Link>
            <Link to="/login" className="landing-btn-hero landing-btn-secondary" style={{ padding: '12px 24px' }}>
              Login
            </Link>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          11. FOOTER
         ───────────────────────────────────────────────────────────── */}
      <footer
        style={{
          borderTop: '1px solid var(--border)',
          backgroundColor: 'var(--surface)',
          padding: '44px 24px 32px 24px',
          color: 'var(--slate-600)',
          fontSize: '13px',
        }}
      >
        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '20px',
            paddingBottom: '28px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <ChurnGuardLogo
            variant="navbar"
            size="sm"
            linkTo="/"
            showWordmark={true}
            showTagline={false}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
            <Link to="/dashboard" style={{ color: 'var(--slate-600)', textDecoration: 'none' }}>
              Dashboard
            </Link>
            <Link to="/customers" style={{ color: 'var(--slate-600)', textDecoration: 'none' }}>
              Customers
            </Link>
            <Link to="/predict" style={{ color: 'var(--slate-600)', textDecoration: 'none' }}>
              Predict
            </Link>
            <Link to="/analytics" style={{ color: 'var(--slate-600)', textDecoration: 'none' }}>
              Analytics
            </Link>
            <Link to="/reports" style={{ color: 'var(--slate-600)', textDecoration: 'none' }}>
              Reports
            </Link>
            <Link to="/login" style={{ color: 'var(--slate-600)', textDecoration: 'none' }}>
              Login
            </Link>
            <Link to="/register" style={{ color: 'var(--slate-900)', textDecoration: 'none', fontWeight: 600 }}>
              Get Started
            </Link>
          </div>
        </div>

        <div
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            paddingTop: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            color: 'var(--slate-500)',
            fontSize: '12px',
          }}
        >
          <span>&copy; {new Date().getFullYear()} ChurnGuard Inc. All rights reserved. Enterprise AI Customer Retention Intelligence Platform.</span>
          <span>Preserving customer relationships through machine learning.</span>
        </div>
      </footer>
    </div>
  )
}
