import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import ChurnGuardLogo from '../components/ChurnGuardLogo'
import HeroCockpit from '../components/HeroCockpit'
import InteractiveFigures from '../components/InteractiveFigures'
import {
  ArrowRight,
  Check,
  ChevronRight,
  Cpu,
  Menu,
  Moon,
  Radio,
  Shield,
  Sparkles,
  Sun,
  TrendingDown,
  X,
  Zap,
} from 'lucide-react'
import { useTheme } from '../components/useTheme'
import { getValidToken } from '../utils/auth'

/**
 * ChurnGuard Landing Page
 *
 * Full visual redesign built with Linear-caliber craft:
 * - Pure dusty Mauve aesthetic (50, 100, 200, 700, 800, 900, 950).
 * - Exact structure: Hero → Product Cockpit → Predict → Explain → Act →
 *   Interactive FIGs → Explainable AI → Retention Playbooks → Changelog → Final CTA → Footer.
 * - Zero inline styling.
 * - Semantic risk colors: Red (High), Amber (Medium), Green (Low).
 * - Strictly pure monochromatic Mauve system.
 */

export default function Landing() {
  const { theme, toggleTheme } = useTheme()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activeStoryStep, setActiveStoryStep] = useState(0)

  // Auth state: resolved synchronously from storage on initial mount to eliminate flash
  const [isAuthenticated, setIsAuthenticated] = useState(() => Boolean(getValidToken()))

  useEffect(() => {
    function syncAuthState() {
      setIsAuthenticated(Boolean(getValidToken()))
    }

    window.addEventListener('pageshow', syncAuthState)
    window.addEventListener('storage', syncAuthState)
    window.addEventListener('churnguard_auth_changed', syncAuthState)
    return () => {
      window.removeEventListener('pageshow', syncAuthState)
      window.removeEventListener('storage', syncAuthState)
      window.removeEventListener('churnguard_auth_changed', syncAuthState)
    }
  }, [])

  // Subtle cycle for Predict -> Explain -> Act indicator
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStoryStep((prev) => (prev + 1) % 3)
    }, 4000)
    return () => clearInterval(timer)
  }, [])


  return (
    <div className="landing-page-wrap min-h-dvh bg-mauve-50 dark:bg-mauve-950 text-mauve-950 dark:text-mauve-50 antialiased selection:bg-mauve-200 dark:selection:bg-mauve-800 font-sans overflow-x-clip transition-colors">
      
      {/* ─────────────────────────────────────────────────────────────
          1. NAVIGATION (Sticky, Thin Border, Backdrop Blur)
         ───────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 w-full bg-mauve-50/85 dark:bg-mauve-950/85 backdrop-blur-md border-b border-mauve-200 dark:border-mauve-800 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Logo & Primary Links */}
          <div className="flex items-center gap-8">
            <ChurnGuardLogo
              size="md"
              showWordmark={true}
              linkTo="/"
            />

            <nav className="hidden lg:flex items-center gap-6 text-xs text-mauve-700 dark:text-mauve-200 font-medium tracking-tight">
              <a href="#product" className="hover:text-mauve-950 dark:hover:text-mauve-50 transition-colors">
                Product
              </a>
              <a href="#solutions" className="hover:text-mauve-950 dark:hover:text-mauve-50 transition-colors">
                Solutions
              </a>
              <a href="#how-it-works" className="hover:text-mauve-950 dark:hover:text-mauve-50 transition-colors">
                How It Works
              </a>
              <a href="#figures" className="hover:text-mauve-950 dark:hover:text-mauve-50 transition-colors">
                Architecture
              </a>
              <a href="#explainable-ai" className="hover:text-mauve-950 dark:hover:text-mauve-50 transition-colors">
                Explainable AI
              </a>
              <a href="#playbooks" className="hover:text-mauve-950 dark:hover:text-mauve-50 transition-colors">
                Playbooks
              </a>
              <a href="#changelog" className="hover:text-mauve-950 dark:hover:text-mauve-50 transition-colors">
                Changelog
              </a>
            </nav>
          </div>

          {/* Right Action Group */}
          <div className="flex items-center gap-3 sm:gap-4">
            
            {/* Theme Toggle Button */}
            <button
              id="landing-theme-toggle"
              type="button"
              onClick={toggleTheme}
              className="w-8 h-8 rounded-md border border-mauve-200 dark:border-mauve-800 bg-white dark:bg-mauve-900 text-mauve-700 dark:text-mauve-200 hover:text-mauve-950 dark:hover:text-mauve-50 hover:bg-mauve-100 dark:hover:bg-mauve-800 flex items-center justify-center transition-colors cursor-pointer shadow-xs"
              title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
              aria-label="Toggle theme mode"
            >
              {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
            </button>

            {isAuthenticated ? (
              <Link
                to="/dashboard"
                className="inline-flex items-center justify-center px-3.5 py-1.5 rounded-full text-xs font-semibold bg-mauve-950 text-mauve-50 hover:bg-mauve-900 dark:bg-mauve-50 dark:text-mauve-950 dark:hover:bg-mauve-100 transition-all duration-150 active:scale-95 shadow-xs"
              >
                Dashboard
                <ArrowRight size={13} className="ml-1" />
              </Link>
            ) : (
              <>
                {/* Login Link */}
                <Link
                  to="/login"
                  className="text-xs font-medium text-mauve-700 dark:text-mauve-200 hover:text-mauve-950 dark:hover:text-mauve-50 transition-colors px-2 py-1"
                >
                  Log in
                </Link>

                {/* Primary CTA (Get Started -> /register) */}
                <Link
                  to="/register"
                  className="inline-flex items-center justify-center px-3.5 py-1.5 rounded-full text-xs font-semibold bg-mauve-950 text-mauve-50 hover:bg-mauve-900 dark:bg-mauve-50 dark:text-mauve-950 dark:hover:bg-mauve-100 transition-all duration-150 active:scale-95 shadow-xs"
                >
                  Get Started
                </Link>
              </>
            )}

            {/* Mobile Hamburger Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden w-8 h-8 rounded-md border border-mauve-200 dark:border-mauve-800 flex items-center justify-center text-mauve-700 dark:text-mauve-200"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X size={16} /> : <Menu size={16} />}
            </button>

          </div>
        </div>

        {/* Mobile Full-Width Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden w-full bg-mauve-50 dark:bg-mauve-950 border-b border-mauve-200 dark:border-mauve-800 px-4 py-6 space-y-4 animate-in fade-in duration-150">
            <nav className="flex flex-col space-y-3 text-sm font-medium text-mauve-700 dark:text-mauve-200">
              <a
                href="#product"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 hover:text-mauve-950 dark:hover:text-mauve-50"
              >
                Product
              </a>
              <a
                href="#solutions"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 hover:text-mauve-950 dark:hover:text-mauve-50"
              >
                Solutions
              </a>
              <a
                href="#how-it-works"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 hover:text-mauve-950 dark:hover:text-mauve-50"
              >
                How It Works
              </a>
              <a
                href="#figures"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 hover:text-mauve-950 dark:hover:text-mauve-50"
              >
                Architecture
              </a>
              <a
                href="#explainable-ai"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 hover:text-mauve-950 dark:hover:text-mauve-50"
              >
                Explainable AI
              </a>
              <a
                href="#playbooks"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 hover:text-mauve-950 dark:hover:text-mauve-50"
              >
                Playbooks
              </a>
              <a
                href="#changelog"
                onClick={() => setMobileMenuOpen(false)}
                className="py-1 hover:text-mauve-950 dark:hover:text-mauve-50"
              >
                Changelog
              </a>
            </nav>

            <div className="pt-4 border-t border-mauve-200 dark:border-mauve-800 flex items-center justify-between">
              {isAuthenticated ? (
                <Link
                  to="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="inline-flex items-center justify-center w-full px-4 py-2 rounded-full text-xs font-semibold bg-mauve-950 text-mauve-50 dark:bg-mauve-50 dark:text-mauve-950 shadow-xs"
                >
                  Go to Dashboard
                  <ArrowRight size={13} className="ml-1.5" />
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-sm font-medium text-mauve-700 dark:text-mauve-200"
                  >
                    Log in
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="inline-flex items-center justify-center px-4 py-2 rounded-full text-xs font-semibold bg-mauve-950 text-mauve-50 dark:bg-mauve-50 dark:text-mauve-950 shadow-xs"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* ─────────────────────────────────────────────────────────────
          2. HERO SECTION
         ───────────────────────────────────────────────────────────── */}
      <section className="relative pt-20 sm:pt-28 pb-12 sm:pb-16 text-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          
          {/* Subtle 3-Step Predict -> Explain -> Act Indicator */}
          <div className="inline-flex items-center gap-1 sm:gap-2 px-3 py-1.5 rounded-full bg-white dark:bg-mauve-900 border border-mauve-200 dark:border-mauve-800 shadow-xs mb-8 text-xs font-mono">
            {[
              { label: '01 PREDICT', step: 0 },
              { label: '02 EXPLAIN', step: 1 },
              { label: '03 ACT', step: 2 },
            ].map((item, idx) => (
              <div key={item.label} className="flex items-center gap-1 sm:gap-2">
                <button
                  type="button"
                  onClick={() => setActiveStoryStep(item.step)}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                    activeStoryStep === item.step
                      ? 'bg-mauve-950 text-mauve-50 dark:bg-mauve-50 dark:text-mauve-950'
                      : 'text-mauve-700/70 dark:text-mauve-200/70 hover:text-mauve-950 dark:hover:text-mauve-50'
                  }`}
                >
                  {item.label}
                </button>
                {idx < 2 && (
                  <span className="text-mauve-200 dark:text-mauve-800 font-sans">→</span>
                )}
              </div>
            ))}
          </div>

          {/* Exact Required Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-mauve-950 dark:text-mauve-50 leading-[1.08]">
            The customer retention system for teams and AI agents.
          </h1>

          {/* Sub-headline: Predict -> Explain -> Act story */}
          <p className="mt-6 text-base sm:text-lg text-mauve-700/90 dark:text-mauve-200/90 max-w-2xl mx-auto leading-relaxed">
            Stop customer churn before renewal day. ChurnGuard predicts attrition probability with calibrated ML, explains root causes through transparent SHAP drivers, and automates retention playbooks.
          </p>

          {/* CTA Buttons */}
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link
              to="/register"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full text-sm font-semibold bg-mauve-950 text-mauve-50 hover:bg-mauve-900 dark:bg-mauve-50 dark:text-mauve-950 dark:hover:bg-mauve-100 transition-all duration-150 active:scale-95 shadow-sm"
            >
              <span>Get Started</span>
              <ArrowRight size={15} />
            </Link>

            <a
              href="#how-it-works"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full text-sm font-medium bg-white dark:bg-mauve-900 border border-mauve-200 dark:border-mauve-800 text-mauve-950 dark:text-mauve-50 hover:bg-mauve-100 dark:hover:bg-mauve-800 transition-colors shadow-xs"
            >
              <span>See how it works</span>
              <ChevronRight size={14} className="text-mauve-700 dark:text-mauve-200" />
            </a>
          </div>

          {/* Proof Badges */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 sm:gap-8 text-xs font-mono text-mauve-700/80 dark:text-mauve-200/80">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>Sub-50ms Inference</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>SHAP Attribution Tree</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>HubSpot & Salesforce Ready</span>
            </div>
          </div>

        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          3. PRODUCT COCKPIT (Dominant Desktop Experience)
         ───────────────────────────────────────────────────────────── */}
      <section id="product" className="pb-24 sm:pb-32">
        <HeroCockpit />
      </section>

      {/* ─────────────────────────────────────────────────────────────
          4. PREDICT SECTION
         ───────────────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-20 sm:py-28 border-t border-mauve-200 dark:border-mauve-800 bg-white/40 dark:bg-mauve-900/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            <div className="lg:col-span-5 space-y-4">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-mono uppercase tracking-wider text-mauve-700 dark:text-mauve-200 bg-mauve-100 dark:bg-mauve-900 border border-mauve-200 dark:border-mauve-800">
                <Radio size={12} className="text-mauve-700 dark:text-mauve-200" />
                <span>Phase 01 / Predict</span>
              </div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-mauve-950 dark:text-mauve-50 leading-tight">
                Predict attrition 60 days before contract expiry.
              </h2>
              <p className="text-sm sm:text-base text-mauve-700/90 dark:text-mauve-200/90 leading-relaxed">
                Most teams discover customer churn on cancellation day. ChurnGuard calculates Bayesian attrition probability continuously across 48+ behavioural telemetries.
              </p>

              <div className="space-y-3 pt-3">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-mauve-100 dark:bg-mauve-900 text-mauve-950 dark:text-mauve-50 flex items-center justify-center shrink-0 mt-0.5 border border-mauve-200 dark:border-mauve-800">
                    <Check size={12} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-mauve-950 dark:text-mauve-50">
                      Multi-Signal Ingestion Pipeline
                    </div>
                    <div className="text-xs text-mauve-700/80 dark:text-mauve-200/80">
                      Streams login cadence, seat allocation decay, open ticket latency, and billing changes.
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-mauve-100 dark:bg-mauve-900 text-mauve-950 dark:text-mauve-50 flex items-center justify-center shrink-0 mt-0.5 border border-mauve-200 dark:border-mauve-800">
                    <Check size={12} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-mauve-950 dark:text-mauve-50">
                      Three-Tier Calibrated Risk Scoring
                    </div>
                    <div className="text-xs text-mauve-700/80 dark:text-mauve-200/80">
                      Accounts bucket automatically into High Risk (&gt;70%), Medium Risk (35-70%), or Low Risk (&lt;35%).
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Signal Matrix */}
            <div className="lg:col-span-7">
              <div className="p-6 rounded-lg bg-white dark:bg-mauve-900 border border-mauve-200 dark:border-mauve-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-mauve-200 dark:border-mauve-800">
                  <div className="text-xs font-mono font-semibold text-mauve-950 dark:text-mauve-50">
                    RISK TIER THRESHOLDS
                  </div>
                  <span className="text-[10px] font-mono text-emerald-500 font-semibold">
                    CALIBRATED AUC 0.942
                  </span>
                </div>

                <div className="space-y-3">
                  {/* High Risk Tier */}
                  <div className="p-3.5 rounded-md bg-red-500/5 border border-red-500/20 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-red-600 dark:text-red-400">
                          Critical Risk Tier (&gt;70%)
                        </div>
                        <div className="text-[11px] text-mauve-700/80 dark:text-mauve-200/80">
                          Immediate automated intervention & executive escalation dispatch.
                        </div>
                      </div>
                    </div>
                    <span className="font-mono text-xs font-bold text-red-500">
                      14 Accounts
                    </span>
                  </div>

                  {/* Medium Risk Tier */}
                  <div className="p-3.5 rounded-md bg-amber-500/5 border border-amber-500/20 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-amber-600 dark:text-amber-400">
                          Elevated Risk Tier (35% – 70%)
                        </div>
                        <div className="text-[11px] text-mauve-700/80 dark:text-mauve-200/80">
                          Proactive CSM health check & feature re-onboarding workflows.
                        </div>
                      </div>
                    </div>
                    <span className="font-mono text-xs font-bold text-amber-500">
                      42 Accounts
                    </span>
                  </div>

                  {/* Low Risk Tier */}
                  <div className="p-3.5 rounded-md bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                          Healthy Tier (&lt;35%)
                        </div>
                        <div className="text-[11px] text-mauve-700/80 dark:text-mauve-200/80">
                          Normal telemetry cadence, expansion signal monitoring.
                        </div>
                      </div>
                    </div>
                    <span className="font-mono text-xs font-bold text-emerald-500">
                      12,424 Accounts
                    </span>
                  </div>
                </div>

                <div className="pt-2 text-[10px] font-mono text-mauve-700/60 dark:text-mauve-200/60 flex items-center justify-between">
                  <span>Ensemble: XGBoost + LightGBM + Bayesian Regressor</span>
                  <span>Latency: 38ms</span>
                </div>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          5. EXPLAIN SECTION
         ───────────────────────────────────────────────────────────── */}
      <section id="solutions" className="py-20 sm:py-28 border-t border-mauve-200 dark:border-mauve-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Visual SHAP Tree Mockup */}
            <div className="lg:col-span-7 order-2 lg:order-1">
              <div className="p-6 rounded-lg bg-white dark:bg-mauve-900 border border-mauve-200 dark:border-mauve-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-mauve-200 dark:border-mauve-800">
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-mauve-700 dark:text-mauve-200" />
                    <span className="text-xs font-mono font-semibold text-mauve-950 dark:text-mauve-50">
                      TRANSPARENT CAUSAL DRIVERS (SHAP)
                    </span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-mauve-100 dark:bg-mauve-800 text-mauve-700 dark:text-mauve-200">
                    NO BLACK BOX
                  </span>
                </div>

                <div className="p-3.5 rounded-md bg-mauve-100/50 dark:bg-mauve-950/60 text-xs text-mauve-700 dark:text-mauve-200 leading-relaxed">
                  <strong className="text-mauve-950 dark:text-mauve-50">Plain-English Synthesis:</strong> An account does not churn because of a generic &apos;low score&apos;. ChurnGuard isolates the specific operational blocker — in this case, a 42% drop in developer seat logins following an unresolved SSO issue.
                </div>

                <div className="space-y-3 pt-2">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-mauve-950 dark:text-mauve-50 font-medium">
                        Active seat drop (-42%)
                      </span>
                      <span className="font-mono text-xs font-bold text-red-500">
                        +36.2% Churn
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-mauve-200 dark:bg-mauve-800">
                      <div className="h-full bg-red-500 rounded-full w-[72%]" />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-mauve-950 dark:text-mauve-50 font-medium">
                        Stalled ticket latency (&gt;72h)
                      </span>
                      <span className="font-mono text-xs font-bold text-red-500">
                        +27.8% Churn
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-mauve-200 dark:bg-mauve-800">
                      <div className="h-full bg-red-500 rounded-full w-[56%]" />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-mauve-950 dark:text-mauve-50 font-medium">
                        Production API usage (Protective)
                      </span>
                      <span className="font-mono text-xs font-bold text-emerald-500">
                        -9.5% Retention Shield
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-mauve-200 dark:bg-mauve-800">
                      <div className="h-full bg-emerald-500 rounded-full w-[20%]" />
                    </div>
                  </div>
                </div>

              </div>
            </div>

            <div className="lg:col-span-5 space-y-4 order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-mono uppercase tracking-wider text-mauve-700 dark:text-mauve-200 bg-mauve-100 dark:bg-mauve-900 border border-mauve-200 dark:border-mauve-800">
                <Cpu size={12} className="text-mauve-700 dark:text-mauve-200" />
                <span>Phase 02 / Explain</span>
              </div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-mauve-950 dark:text-mauve-50 leading-tight">
                Explain the exact reasons behind every risk score.
              </h2>
              <p className="text-sm sm:text-base text-mauve-700/90 dark:text-mauve-200/90 leading-relaxed">
                Black-box predictions frustrate customer success teams because they cannot diagnose why an account is slipping. ChurnGuard generates game-theoretic SHAP attributions and plain-English root causes for every customer.
              </p>

              <div className="pt-2">
                <div className="p-3 rounded-md bg-mauve-100/40 dark:bg-mauve-900/40 border border-mauve-200 dark:border-mauve-800 text-xs text-mauve-700 dark:text-mauve-200">
                  <span className="font-mono font-bold text-mauve-950 dark:text-mauve-50">Local Additivity:</span> Base expected risk + Sum of feature attributions = Final predicted probability. Zero arbitrary score adjustments.
                </div>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          6. ACT SECTION
         ───────────────────────────────────────────────────────────── */}
      <section className="py-20 sm:py-28 border-t border-mauve-200 dark:border-mauve-800 bg-white/40 dark:bg-mauve-900/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            <div className="lg:col-span-5 space-y-4">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-mono uppercase tracking-wider text-mauve-700 dark:text-mauve-200 bg-mauve-100 dark:bg-mauve-900 border border-mauve-200 dark:border-mauve-800">
                <Zap size={12} className="text-mauve-700 dark:text-mauve-200" />
                <span>Phase 03 / Act</span>
              </div>
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-mauve-950 dark:text-mauve-50 leading-tight">
                Automate playbooks and close the retention loop.
              </h2>
              <p className="text-sm sm:text-base text-mauve-700/90 dark:text-mauve-200/90 leading-relaxed">
                Insights without action produce churn. ChurnGuard connects directly to Slack, Salesforce, HubSpot, and email automation, dispatching customized playbooks the second an account passes critical thresholds.
              </p>

              <div className="space-y-3 pt-3">
                <div className="flex items-center gap-3 text-xs font-semibold text-mauve-950 dark:text-mauve-50">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Slack alert dispatch to #customer-escalations</span>
                </div>
                <div className="flex items-center gap-3 text-xs font-semibold text-mauve-950 dark:text-mauve-50">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Automated task generation for assigned CSM in CRM</span>
                </div>
                <div className="flex items-center gap-3 text-xs font-semibold text-mauve-950 dark:text-mauve-50">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Staged pricing loyalty discounts before renewal</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="p-6 rounded-lg bg-white dark:bg-mauve-900 border border-mauve-200 dark:border-mauve-800 shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-mauve-200 dark:border-mauve-800">
                  <div className="text-xs font-mono font-semibold text-mauve-950 dark:text-mauve-50">
                    AUTOMATED PLAYBOOK DISPATCHER
                  </div>
                  <span className="text-[10px] font-mono text-emerald-500 font-semibold">
                    100% PROGRAMMATIC
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="p-3.5 rounded-md bg-mauve-100/50 dark:bg-mauve-950/60 border border-mauve-200 dark:border-mauve-800 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded bg-mauve-950 text-mauve-50 dark:bg-mauve-50 dark:text-mauve-950 font-mono text-[10px] flex items-center justify-center font-bold">
                        CSM
                      </div>
                      <div>
                        <div className="font-semibold text-mauve-950 dark:text-mauve-50">Urgent CSM Intervention</div>
                        <div className="text-mauve-700/80 dark:text-mauve-200/80 text-[11px]">Calendar sync + briefing pack generated</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-bold">
                      ACTIVE
                    </span>
                  </div>

                  <div className="p-3.5 rounded-md bg-mauve-100/50 dark:bg-mauve-950/60 border border-mauve-200 dark:border-mauve-800 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded bg-mauve-950 text-mauve-50 dark:bg-mauve-50 dark:text-mauve-950 font-mono text-[10px] flex items-center justify-center font-bold">
                        SSO
                      </div>
                      <div>
                        <div className="font-semibold text-mauve-950 dark:text-mauve-50">Engineering Escort</div>
                        <div className="text-mauve-700/80 dark:text-mauve-200/80 text-[11px]">Routes stuck tickets directly to Senior Architect</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-bold">
                      ACTIVE
                    </span>
                  </div>

                  <div className="p-3.5 rounded-md bg-mauve-100/50 dark:bg-mauve-950/60 border border-mauve-200 dark:border-mauve-800 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded bg-mauve-950 text-mauve-50 dark:bg-mauve-50 dark:text-mauve-950 font-mono text-[10px] flex items-center justify-center font-bold">
                        REV
                      </div>
                      <div>
                        <div className="font-semibold text-mauve-950 dark:text-mauve-50">Loyalty Contract Incentive</div>
                        <div className="text-mauve-700/80 dark:text-mauve-200/80 text-[11px]">15% coupon for 1-year annual lock before 18d expiry</div>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-bold">
                      ACTIVE
                    </span>
                  </div>
                </div>

              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          7. INTERACTIVE FIGURES (3-Column FIG Section)
         ───────────────────────────────────────────────────────────── */}
      <InteractiveFigures />

      {/* ─────────────────────────────────────────────────────────────
          8. EXPLAINABLE AI DEEP DIVE
         ───────────────────────────────────────────────────────────── */}
      <section id="explainable-ai" className="py-20 sm:py-28 lg:py-32 border-b border-mauve-200 dark:border-mauve-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="max-w-2xl mb-12 sm:mb-16">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-mono uppercase tracking-wider text-mauve-700 dark:text-mauve-200 bg-mauve-100 dark:bg-mauve-900 border border-mauve-200 dark:border-mauve-800 mb-4">
              <Sparkles size={12} className="text-mauve-700 dark:text-mauve-200" />
              <span>Explainable AI Engine</span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-mauve-950 dark:text-mauve-50">
              Shapley decomposition for every individual account.
            </h2>
            <p className="mt-3 text-sm sm:text-base text-mauve-700/80 dark:text-mauve-200/80 leading-relaxed">
              Every prediction is decomposed into additive contributions. You always know exactly what pushed the risk higher and what shielded the account.
            </p>
          </div>

          {/* Deep Dive Breakdown Card */}
          <div className="rounded-lg border border-mauve-200 dark:border-mauve-800 bg-white dark:bg-mauve-900/60 p-6 sm:p-8 shadow-sm">
            
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-mauve-200 dark:border-mauve-800 gap-4">
              <div>
                <div className="text-xs font-mono uppercase text-mauve-700/70 dark:text-mauve-200/70">
                  ACCOUNT BREAKDOWN
                </div>
                <div className="text-lg font-bold text-mauve-950 dark:text-mauve-50 mt-0.5">
                  Apex Cloud Systems (CUST-8492)
                </div>
              </div>

              <div className="flex items-center gap-6 font-mono text-xs">
                <div>
                  <span className="text-mauve-700/70 dark:text-mauve-200/70 block text-[10px]">BASE VALUE E[f(x)]</span>
                  <span className="font-bold text-mauve-950 dark:text-mauve-50">21.0%</span>
                </div>
                <div>
                  <span className="text-mauve-700/70 dark:text-mauve-200/70 block text-[10px]">OUTPUT f(x)</span>
                  <span className="font-bold text-red-500 text-sm">88.0%</span>
                </div>
              </div>
            </div>

            {/* Waterfall-Style Visual Drivers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6">
              
              {/* Positive Risk Drivers (Pushing Churn Up) */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-red-500 font-mono uppercase tracking-wider">
                  <TrendingDown size={14} />
                  <span>Risk Accelerators (+67.5% total push)</span>
                </div>

                <div className="space-y-3">
                  <div className="p-3 rounded-md bg-red-500/5 border border-red-500/20">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-mauve-950 dark:text-mauve-50">Seat Utilization Decay</span>
                      <span className="font-mono text-red-500">+36.2%</span>
                    </div>
                    <div className="text-[11px] text-mauve-700/80 dark:text-mauve-200/80 mt-1">
                      Active seats dropped from 240 to 139 over the last 14 days (-42% contraction).
                    </div>
                  </div>

                  <div className="p-3 rounded-md bg-red-500/5 border border-red-500/20">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-mauve-950 dark:text-mauve-50">Unresolved P1 Support Tickets</span>
                      <span className="font-mono text-red-500">+27.8%</span>
                    </div>
                    <div className="text-[11px] text-mauve-700/80 dark:text-mauve-200/80 mt-1">
                      3 open integration tickets stalled over 72h without engineer response.
                    </div>
                  </div>

                  <div className="p-3 rounded-md bg-red-500/5 border border-red-500/20">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-mauve-950 dark:text-mauve-50">Short Renewal Horizon</span>
                      <span className="font-mono text-red-500">+13.5%</span>
                    </div>
                    <div className="text-[11px] text-mauve-700/80 dark:text-mauve-200/80 mt-1">
                      Flexible monthly cycle expiring in 18 days with no renewal intent logged.
                    </div>
                  </div>
                </div>
              </div>

              {/* Negative Risk Drivers (Protective Shields) */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-500 font-mono uppercase tracking-wider">
                  <Shield size={14} />
                  <span>Retention Shields (-19.5% mitigation)</span>
                </div>

                <div className="space-y-3">
                  <div className="p-3 rounded-md bg-emerald-500/5 border border-emerald-500/20">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-mauve-950 dark:text-mauve-50">Production API Integration</span>
                      <span className="font-mono text-emerald-500">-9.5%</span>
                    </div>
                    <div className="text-[11px] text-mauve-700/80 dark:text-mauve-200/80 mt-1">
                      5 production webhooks actively processing ~45,000 monthly events.
                    </div>
                  </div>

                  <div className="p-3 rounded-md bg-emerald-500/5 border border-emerald-500/20">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-mauve-950 dark:text-mauve-50">Customer Tenure (&gt;18 Months)</span>
                      <span className="font-mono text-emerald-500">-10.0%</span>
                    </div>
                    <div className="text-[11px] text-mauve-700/80 dark:text-mauve-200/80 mt-1">
                      Historical tenure establishes established workflow stickiness.
                    </div>
                  </div>

                  <div className="p-3.5 rounded-md bg-mauve-100/50 dark:bg-mauve-950/60 border border-mauve-200 dark:border-mauve-800 text-xs">
                    <div className="font-semibold text-mauve-950 dark:text-mauve-50">
                      Recommendation for Account Executive:
                    </div>
                    <div className="text-mauve-700/80 dark:text-mauve-200/80 text-[11px] mt-1 leading-relaxed">
                      Do not discuss pricing first. Solve the SAML ticket #4819 within 24 hours to eliminate the primary +27.8% friction driver, then present annual lock.
                    </div>
                  </div>
                </div>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          9. RETENTION PLAYBOOKS SECTION
         ───────────────────────────────────────────────────────────── */}
      <section id="playbooks" className="py-20 sm:py-28 lg:py-32 border-b border-mauve-200 dark:border-mauve-800 bg-white/40 dark:bg-mauve-900/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="max-w-2xl mb-12 sm:mb-16">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-mono uppercase tracking-wider text-mauve-700 dark:text-mauve-200 bg-mauve-100 dark:bg-mauve-900 border border-mauve-200 dark:border-mauve-800 mb-4">
              <Zap size={12} className="text-mauve-700 dark:text-mauve-200" />
              <span>Automated Interventions</span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-mauve-950 dark:text-mauve-50">
              Battle-tested playbooks triggered by telemetry.
            </h2>
            <p className="mt-3 text-sm sm:text-base text-mauve-700/80 dark:text-mauve-200/80 leading-relaxed">
              Standardized, repeatable interventions designed by top SaaS customer success leaders.
            </p>
          </div>

          {/* 4 Playbook Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Playbook 1 */}
            <div className="p-6 rounded-lg bg-white dark:bg-mauve-900 border border-mauve-200 dark:border-mauve-800 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-mauve-100 dark:bg-mauve-800 text-mauve-700 dark:text-mauve-200">
                    PLAYBOOK 01
                  </span>
                  <span className="text-[10px] font-mono text-emerald-500 font-bold">
                    84% Save
                  </span>
                </div>
                <h3 className="text-base font-semibold text-mauve-950 dark:text-mauve-50 tracking-tight">
                  Discount Offer & Annual Lock
                </h3>
                <p className="text-xs text-mauve-700/80 dark:text-mauve-200/80 mt-2 leading-relaxed">
                  Triggered when an account with high contract sensitivity nears renewal within 30 days. Auto-stages a 15% 1-year loyalty coupon.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-mauve-200 dark:border-mauve-800 text-[11px] font-mono text-mauve-700/70 dark:text-mauve-200/70">
                <span>Trigger: Exp &lt; 30d • Price Contraction</span>
              </div>
            </div>

            {/* Playbook 2 */}
            <div className="p-6 rounded-lg bg-white dark:bg-mauve-900 border border-mauve-200 dark:border-mauve-800 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-mauve-100 dark:bg-mauve-800 text-mauve-700 dark:text-mauve-200">
                    PLAYBOOK 02
                  </span>
                  <span className="text-[10px] font-mono text-emerald-500 font-bold">
                    78% Save
                  </span>
                </div>
                <h3 className="text-base font-semibold text-mauve-950 dark:text-mauve-50 tracking-tight">
                  CSM Urgent Outreach
                </h3>
                <p className="text-xs text-mauve-700/80 dark:text-mauve-200/80 mt-2 leading-relaxed">
                  Triggered by login contraction &gt; 35% in 14 days. Auto-schedules a 20-minute strategy review directly on the CSM&apos;s calendar with pre-filled context.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-mauve-200 dark:border-mauve-800 text-[11px] font-mono text-mauve-700/70 dark:text-mauve-200/70">
                <span>Trigger: Seat Decay &gt; 35% in 14d</span>
              </div>
            </div>

            {/* Playbook 3 */}
            <div className="p-6 rounded-lg bg-white dark:bg-mauve-900 border border-mauve-200 dark:border-mauve-800 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-mauve-100 dark:bg-mauve-800 text-mauve-700 dark:text-mauve-200">
                    PLAYBOOK 03
                  </span>
                  <span className="text-[10px] font-mono text-emerald-500 font-bold">
                    91% Save
                  </span>
                </div>
                <h3 className="text-base font-semibold text-mauve-950 dark:text-mauve-50 tracking-tight">
                  Onboarding Rescue
                </h3>
                <p className="text-xs text-mauve-700/80 dark:text-mauve-200/80 mt-2 leading-relaxed">
                  Triggered when accounts experience integration ticket stall &gt; 48 hours. Auto-routes priority tickets to Senior Solutions Architects.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-mauve-200 dark:border-mauve-800 text-[11px] font-mono text-mauve-700/70 dark:text-mauve-200/70">
                <span>Trigger: P1 Ticket &gt; 48h Stalled</span>
              </div>
            </div>

            {/* Playbook 4 */}
            <div className="p-6 rounded-lg bg-white dark:bg-mauve-900 border border-mauve-200 dark:border-mauve-800 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-mauve-100 dark:bg-mauve-800 text-mauve-700 dark:text-mauve-200">
                    PLAYBOOK 04
                  </span>
                  <span className="text-[10px] font-mono text-emerald-500 font-bold">
                    73% Save
                  </span>
                </div>
                <h3 className="text-base font-semibold text-mauve-950 dark:text-mauve-50 tracking-tight">
                  Executive Escalation
                </h3>
                <p className="text-xs text-mauve-700/80 dark:text-mauve-200/80 mt-2 leading-relaxed">
                  Triggered when an enterprise account (&gt;₹5,00,000 MRR) breaches 70% attrition risk. Alerts VP of Customer Success with a 1-page executive brief.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-mauve-200 dark:border-mauve-800 text-[11px] font-mono text-mauve-700/70 dark:text-mauve-200/70">
                <span>Trigger: MRR &gt; ₹5L &amp; Risk &gt; 70%</span>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          10. CHANGELOG SECTION
         ───────────────────────────────────────────────────────────── */}
      <section id="changelog" className="py-20 sm:py-28 lg:py-32 border-b border-mauve-200 dark:border-mauve-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="mb-12 sm:mb-16">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-[11px] font-mono uppercase tracking-wider text-mauve-700 dark:text-mauve-200 bg-mauve-100 dark:bg-mauve-900 border border-mauve-200 dark:border-mauve-800 mb-4">
              <span>Changelog</span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-mauve-950 dark:text-mauve-50">
              Shipped continuously with velocity.
            </h2>
            <p className="mt-3 text-sm sm:text-base text-mauve-700/80 dark:text-mauve-200/80 leading-relaxed">
              Every month we deploy improvements to model inference speed, CRM integrations, and automated playbooks.
            </p>
          </div>

          {/* Timeline List */}
          <div className="space-y-8 border-l border-mauve-200 dark:border-mauve-800 pl-6 sm:pl-8 ml-2">
            
            {/* Version 3.4 */}
            <div className="relative">
              <span className="absolute -left-[31px] sm:-left-[39px] top-1.5 w-3 h-3 rounded-full bg-mauve-950 dark:bg-mauve-50 border-2 border-mauve-50 dark:border-mauve-950" />
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-xs font-bold text-mauve-950 dark:text-mauve-50">
                  v3.4.0
                </span>
                <span className="text-xs font-mono text-mauve-700/70 dark:text-mauve-200/70">
                  October 2026
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-semibold">
                  LATEST
                </span>
              </div>
              <h3 className="text-base font-semibold text-mauve-950 dark:text-mauve-50 mt-1">
                SHAP Local Attribution Trees &amp; Agent Webhooks
              </h3>
              <p className="text-xs sm:text-sm text-mauve-700/80 dark:text-mauve-200/80 mt-1 leading-relaxed">
                Replaced static heuristic alerts with real-time SHAP force attributions. Playbooks can now dispatch direct webhooks to custom internal agent frameworks.
              </p>
            </div>

            {/* Version 3.3 */}
            <div className="relative">
              <span className="absolute -left-[31px] sm:-left-[39px] top-1.5 w-3 h-3 rounded-full bg-mauve-200 dark:bg-mauve-800 border-2 border-mauve-50 dark:border-mauve-950" />
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-xs font-bold text-mauve-950 dark:text-mauve-50">
                  v3.3.0
                </span>
                <span className="text-xs font-mono text-mauve-700/70 dark:text-mauve-200/70">
                  September 2026
                </span>
              </div>
              <h3 className="text-base font-semibold text-mauve-950 dark:text-mauve-50 mt-1">
                Local LLM Briefing Generator
              </h3>
              <p className="text-xs sm:text-sm text-mauve-700/80 dark:text-mauve-200/80 mt-1 leading-relaxed">
                Automated 1-paragraph CSM summaries synthesized directly from telemetry logs without transmitting sensitive PII data to third-party endpoints.
              </p>
            </div>

            {/* Version 3.2 */}
            <div className="relative">
              <span className="absolute -left-[31px] sm:-left-[39px] top-1.5 w-3 h-3 rounded-full bg-mauve-200 dark:bg-mauve-800 border-2 border-mauve-50 dark:border-mauve-950" />
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-xs font-bold text-mauve-950 dark:text-mauve-50">
                  v3.2.0
                </span>
                <span className="text-xs font-mono text-mauve-700/70 dark:text-mauve-200/70">
                  August 2026
                </span>
              </div>
              <h3 className="text-base font-semibold text-mauve-950 dark:text-mauve-50 mt-1">
                Bidirectional Salesforce &amp; HubSpot Sync
              </h3>
              <p className="text-xs sm:text-sm text-mauve-700/80 dark:text-mauve-200/80 mt-1 leading-relaxed">
                Real-time two-way synchronization for churn risk scores, primary risk drivers, and dispatched playbook tasks directly inside CRM contact records.
              </p>
            </div>

            {/* Version 3.1 */}
            <div className="relative">
              <span className="absolute -left-[31px] sm:-left-[39px] top-1.5 w-3 h-3 rounded-full bg-mauve-200 dark:bg-mauve-800 border-2 border-mauve-50 dark:border-mauve-950" />
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-xs font-bold text-mauve-950 dark:text-mauve-50">
                  v3.1.0
                </span>
                <span className="text-xs font-mono text-mauve-700/70 dark:text-mauve-200/70">
                  July 2026
                </span>
              </div>
              <h3 className="text-base font-semibold text-mauve-950 dark:text-mauve-50 mt-1">
                Sub-50ms Inference Engine Architecture
              </h3>
              <p className="text-xs sm:text-sm text-mauve-700/80 dark:text-mauve-200/80 mt-1 leading-relaxed">
                Architectural redesign migrating from scheduled batch scoring to continuous stream processing with sub-50ms evaluation speed.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          11. FINAL CTA SECTION
         ───────────────────────────────────────────────────────────── */}
      <section className="py-24 sm:py-32 text-center bg-white/60 dark:bg-mauve-900/40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-mauve-950 dark:text-mauve-50 leading-tight">
            Ready to stop customer churn before it happens?
          </h2>

          <p className="mt-4 text-base sm:text-lg text-mauve-700/80 dark:text-mauve-200/80 max-w-2xl mx-auto leading-relaxed">
            Join modern customer success teams and AI agents safeguarding recurring revenue with ChurnGuard.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/register"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full text-sm font-semibold bg-mauve-950 text-mauve-50 hover:bg-mauve-900 dark:bg-mauve-50 dark:text-mauve-950 dark:hover:bg-mauve-100 transition-all duration-150 active:scale-95 shadow-sm"
            >
              <span>Get Started</span>
              <ArrowRight size={15} />
            </Link>

            <Link
              to="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full text-sm font-medium bg-white dark:bg-mauve-900 border border-mauve-200 dark:border-mauve-800 text-mauve-950 dark:text-mauve-50 hover:bg-mauve-100 dark:hover:bg-mauve-800 transition-colors shadow-xs"
            >
              <span>Log in to your workspace</span>
            </Link>
          </div>

          <div className="mt-8 text-xs font-mono text-mauve-700/70 dark:text-mauve-200/70">
            No credit card required • 14-day trial • Ready in under 10 minutes
          </div>

        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          12. FOOTER
         ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-mauve-200 dark:border-mauve-800 bg-mauve-50 dark:bg-mauve-950 py-12 sm:py-16 text-xs transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-8 mb-12">
            
            {/* Brand Column */}
            <div className="col-span-2 lg:col-span-2 space-y-4">
              <ChurnGuardLogo
                size="md"
                showWordmark={true}
                linkTo="/"
              />
              <p className="text-mauve-700/80 dark:text-mauve-200/80 max-w-sm leading-relaxed">
                The customer retention intelligence system for SaaS teams and AI agents. Continuous risk prediction, causal SHAP attribution, and automated playbook dispatch.
              </p>
              <div className="flex items-center gap-2 text-[11px] font-mono text-mauve-700/70 dark:text-mauve-200/70 pt-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>All Systems Operational (99.99%)</span>
              </div>
            </div>

            {/* Product */}
            <div className="space-y-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-mauve-950 dark:text-mauve-50 font-semibold">
                Product
              </div>
              <ul className="space-y-2 text-mauve-700/80 dark:text-mauve-200/80">
                <li><a href="#product" className="hover:text-mauve-950 dark:hover:text-mauve-50 transition-colors">Cockpit</a></li>
                <li><a href="#how-it-works" className="hover:text-mauve-950 dark:hover:text-mauve-50 transition-colors">Risk Engine</a></li>
                <li><a href="#explainable-ai" className="hover:text-mauve-950 dark:hover:text-mauve-50 transition-colors">Explainable AI</a></li>
                <li><a href="#playbooks" className="hover:text-mauve-950 dark:hover:text-mauve-50 transition-colors">Playbooks</a></li>
                <li><a href="#changelog" className="hover:text-mauve-950 dark:hover:text-mauve-50 transition-colors">Changelog</a></li>
              </ul>
            </div>

            {/* Platform */}
            <div className="space-y-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-mauve-950 dark:text-mauve-50 font-semibold">
                Platform
              </div>
              <ul className="space-y-2 text-mauve-700/80 dark:text-mauve-200/80">
                {isAuthenticated ? (
                  <li><Link to="/dashboard" className="hover:text-mauve-950 dark:hover:text-mauve-50 transition-colors">Dashboard</Link></li>
                ) : (
                  <>
                    <li><Link to="/login" className="hover:text-mauve-950 dark:hover:text-mauve-50 transition-colors">Log In</Link></li>
                    <li><Link to="/register" className="hover:text-mauve-950 dark:hover:text-mauve-50 transition-colors">Sign Up</Link></li>
                  </>
                )}
                <li><a href="#figures" className="hover:text-mauve-950 dark:hover:text-mauve-50 transition-colors">Architecture</a></li>
                <li><span className="text-mauve-700/75 dark:text-mauve-200/70">API Docs</span></li>
                <li><span className="text-mauve-700/75 dark:text-mauve-200/70">Integrations</span></li>
              </ul>
            </div>

            {/* Legal */}
            <div className="space-y-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-mauve-950 dark:text-mauve-50 font-semibold">
                Security &amp; Trust
              </div>
              <ul className="space-y-2 text-mauve-700/80 dark:text-mauve-200/80">
                <li><span className="text-mauve-700/70 dark:text-mauve-200/70">SOC 2 Type II</span></li>
                <li><span className="text-mauve-700/70 dark:text-mauve-200/70">GDPR Compliant</span></li>
                <li><span className="text-mauve-700/70 dark:text-mauve-200/70">Data Isolation</span></li>
                <li><span className="text-mauve-700/70 dark:text-mauve-200/70">Privacy Policy</span></li>
                <li><span className="text-mauve-700/70 dark:text-mauve-200/70">Terms of Service</span></li>
              </ul>
            </div>

          </div>

          <div className="pt-8 border-t border-mauve-200 dark:border-mauve-800 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] font-mono text-mauve-700/70 dark:text-mauve-200/70">
            <div>
              © 2026 ChurnGuard Inc. All rights reserved.
            </div>
            <div className="flex items-center gap-4">
              <span>Designed with precision</span>
              <span>•</span>
              <button
                type="button"
                onClick={toggleTheme}
                className="hover:text-mauve-950 dark:hover:text-mauve-50 transition-colors cursor-pointer"
              >
                Theme: {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
              </button>
            </div>
          </div>

        </div>
      </footer>

    </div>
  )
}
