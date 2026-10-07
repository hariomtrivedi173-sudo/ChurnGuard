# ChurnGuard — Current UI Baseline Specification
## 1. Executive Summary & Identity
- **Application Name**: ChurnGuard
- **Tagline**: AI-Powered Customer Retention Intelligence Platform
- **Icon Mark**: Precision Shield (`Shield` vector geometry with dual-tone gradient fill and subtle signal dot)
- **Wordmark**: `ChurnGuard` (Inter 800, tight tracking `-0.02em`)
- **Brand Subtitle**: `AI Churn Intelligence` / `Enterprise Churn Prevention Platform`
---
## 2. Existing Route & Architecture Map
| Route | Component | Access Type | Primary Role |
| :--- | :--- | :--- | :--- |
| `/` | `Landing.jsx` / `Login.jsx` | Public | Landing Page / Entry Point |
| `/login` | `Login.jsx` | Public | Authentication & JWT token issuance |
| `/register` | `Register.jsx` | Public | 3-step company onboarding & registration |
| `/verify-otp` | `VerifyOTP.jsx` | Public | 6-digit email OTP verification |
| `/dashboard` | `Dashboard.jsx` | Protected | Executive churn intelligence summary & charts |
| `/customers` | `Customers.jsx` | Protected | Paginated customer table, search & risk filtering |
| `/predict` | `Predict.jsx` | Protected | Real-time single customer churn risk inference |
| `/predictions`| `Predict.jsx` | Protected | Route alias to single customer prediction |
| `/upload` | `Upload.jsx` | Protected | Batch CSV dataset ingestion & pipeline execution |
| `/analytics` | `Analytics.jsx` | Protected | Multi-cohort risk segmentation & statistical analysis |
| `/segments` | `Segments.jsx` | Protected | Behavioral customer risk clusters |
| `/reports` | `Reports.jsx` | Protected | Audit log generation, PDF & CSV export |
| `/settings` | `Settings.jsx` | Protected | Profile, company details, notifications & security |
---
## 3. Brand & Slate Neutral Color Hierarchy (Part 1 Foundation)
### Slate Neutral Scale (HSL Format)
- `slate-50`:  `hsl(210, 40%, 98%)` (`#f8fafc`) — Main application background
- `slate-100`: `hsl(210, 40%, 96%)` (`#f1f5f9`) — Subtle sections, hover surfaces, table hovers
- `slate-200`: `hsl(214, 32%, 91%)` (`#e2e8f0`) — Primary borders, dividers, subtle outlines
- `slate-300`: `hsl(213, 27%, 84%)` (`#cbd5e1`) — Stronger borders, input borders
- `slate-400`: `hsl(215, 20%, 65%)` (`#94a3b8`) — Placeholders, disabled states, tertiary icons
- `slate-500`: `hsl(215, 16%, 47%)` (`#64748b`) — Muted helper text, secondary labels, timestamps
- `slate-600`: `hsl(215, 19%, 35%)` (`#475569`) — Secondary body text, table cells, form labels
- `slate-700`: `hsl(215, 25%, 27%)` (`#334155`) — Subheadings, strong secondary text
- `slate-800`: `hsl(217, 33%, 17%)` (`#1e293b`) — Dark mode borders, important text
- `slate-900`: `hsl(222, 47%, 11%)` (`#0f172a`) — Primary text
- `slate-950`: `hsl(229, 84%, 5%)`  (`#020617`) — Highest contrast headings, dark canvas
### Semantic Tokens Mapping (Light UI)
- `background`:        `var(--slate-50)`
- `background-subtle`: `var(--slate-100)`
- `surface`:           `hsl(0, 0%, 100%)` (pure white)
- `surface-muted`:     `var(--slate-100)`
- `border`:            `var(--slate-200)`
- `border-strong`:     `var(--slate-300)`
- `card-bg`:           `hsl(0, 0%, 100%)` (white)
- `card-border`:       `var(--slate-200)`
- `input-bg`:          `hsl(0, 0%, 100%)` (white)
- `input-border`:      `var(--slate-300)`
- `text-primary`:      `var(--slate-900)`
- `text-primary-deep`: `var(--slate-950)`
- `text-secondary`:    `var(--slate-600)`
- `text-muted`:        `var(--slate-500)`
- `text-disabled`:     `var(--slate-400)`
### Brand Accent (Indigo / Violet-Blue, HSL Format)
- `brand` (Primary CTA): `hsl(243, 75%, 59%)` (`#4f46e5`, Indigo 600)
- `brand-hover`:         `hsl(244, 58%, 51%)` (`#4338ca`, Indigo 700)
- `brand-active`:        `hsl(244, 55%, 41%)` (`#3730a3`, Indigo 800)
- `brand-subtle`:        `hsl(238, 100%, 97%)` (`#eef2ff`, Indigo 50)
- `brand-soft`:          `hsl(235, 92%, 89%)` (`#c7d2fe`, Indigo 200)
- `brand-border`:        `hsl(234, 89%, 82%)` (`#a5b4fc`, Indigo 300)
- `brand-glow`:          `hsla(243, 75%, 59%, 0.18)`
### Semantic Status Colors (HSL Format)
- **High Risk / Danger / Error**: Red (`hsl(0, 84%, 60%)` / `#ef4444`)
- **Medium Risk / Warning**:      Amber (`hsl(38, 92%, 50%)` / `#f59e0b`)
- **Low Risk / Safe / Success**:  Emerald Green (`hsl(160, 84%, 39%)` / `#10b981`)
- **Information / Telemetry**:    Blue (`hsl(217, 91%, 60%)` / `#3b82f6`)
---
## 4. Logo Motion System
- **Static Core**: Shield geometric silhouette with stable wordmark `ChurnGuard`.
- **Motion Characteristics**:
  - Ambient breathing and micro signal pulse (subtle, 3–4s cycle).
  - Interactive hover state: subtle scale (1.04x), gentle accent glow, micro-beacon pulse.
  - Wordmark remains rigidly stable (no distracting motion or bouncing).
  - Strict compliance with `prefers-reduced-motion: reduce`.
---
## 5. Global UI Foundation (Part 2)
- **Canvas / Page Background**: `var(--background)` (`var(--slate-50)` in light mode, `var(--slate-950)` in dark mode).
- **Body & Root Typography**:
  - Global font family: `'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`.
  - Body text: `var(--text-secondary)` (`var(--slate-600)` in light mode, `var(--slate-400)` in dark mode) at `14px`, `line-height: 1.5`.
  - Global rendering: `-webkit-font-smoothing: antialiased`, `-moz-osx-font-smoothing: grayscale`, `text-rendering: optimizeLegibility`.
- **Typography Hierarchy**:
  - **H1**: `clamp(1.75rem, 2.5vw, 2.25rem)`, weight `800`, `letter-spacing: -0.025em`, `line-height: 1.2`, color `var(--heading-h1)` (`slate-950` / white).
  - **H2**: `clamp(1.25rem, 1.8vw, 1.5rem)`, weight `700`, `letter-spacing: -0.02em`, `line-height: 1.25`, color `var(--heading-h2)` (`slate-900` / `slate-50`).
  - **H3**: `1.125rem` (18px), weight `600`, `letter-spacing: -0.015em`, `line-height: 1.35`, color `var(--heading-h3)` (`slate-800` / `slate-100`).
  - **H4 / H5 / H6**: `1rem` / `0.875rem`, weight `600`, color `var(--text-primary)`.
  - **Paragraph (`p`)**: `0.875rem` (14px), color `var(--text-secondary)` (`slate-600`), `line-height: 1.55`.
  - **Small (`small`, `.text-small`, `.text-xs`)**: `0.75rem` (12px), color `var(--text-muted)` (`slate-500`).
  - **Strong (`strong`, `b`)**: weight `600`, color `var(--text-primary)`.
- **Borders & Dividers**:
  - Global border color: `var(--border)` (`slate-200` in light mode, `slate-800` in dark mode).
  - Horizontal rules (`hr`): `border: 0; border-top: 1px solid var(--border); margin: 16px 0;`.
- **Global Focus States**:
  - Elements: `:focus-visible`, `button:focus-visible`, `input:focus-visible`, `select:focus-visible`, `textarea:focus-visible`, `a:focus-visible`, `[role="button"]:focus-visible`, `[tabindex]:focus-visible`.
  - Style: `outline: 2px solid var(--brand); outline-offset: 2px; box-shadow: 0 0 0 4px var(--brand-glow);`.
  - Inactive outline: `:focus:not(:focus-visible) { outline: none; }`.
- **Cards**:
  - Background: `var(--card-bg)` (`hsl(0, 0%, 100%)` pure white in light mode, `var(--slate-900)` in dark mode).
  - Border: `1px solid var(--card-border)` (`var(--slate-200)` in light mode, `var(--slate-800)` in dark mode).
  - Border radius: `16px`.
  - Shadow: `var(--shadow-sm)`.
- **Motion & Transitions**:
  - Fast/Interactive (buttons, inputs, links, badges, tabs): `150ms cubic-bezier(0.16, 1, 0.3, 1)`.
  - Normal/Surfaces: `200ms ease`.
  - Smooth/Layout: `300ms cubic-bezier(0.4, 0, 0.2, 1)`.
- **Global Scrollbar**:
  - Width: `6px`.
  - Track: `transparent`.
  - Thumb: `var(--slate-300)` (`var(--slate-400)` on hover) in light mode; `var(--slate-700)` (`var(--slate-600)` on hover) in dark mode.
---
## 6. Sidebar & Topbar Redesign (Part 3)
- **Sidebar Architecture**:
  - Width: `256px` desktop sticky sidebar, collapsible to `80px` icon-only view.
  - Background: `var(--sidebar-bg)` (pure white `hsl(0, 0%, 100%)` in light mode, `var(--slate-900)` in dark mode).
  - Border: `1px solid var(--sidebar-border)` (`var(--slate-200)` in light mode, `var(--slate-800)` in dark mode).
  - Navigation Text: `var(--slate-600)` default; `var(--slate-900)` on hover; `var(--brand)` when active.
  - Navigation Icons: `var(--slate-500)` default; `var(--slate-700)` on hover; `var(--brand)` when active.
  - Active Item: Subtle accent background `var(--brand-subtle)`, left border indicator `3px solid var(--brand)`.
  - Collapsed Tooltips: Neutral dark slate `var(--slate-900)` with slate-800 border and clean arrow indicator.
  - Visual Hierarchy: Sidebar visually recedes to keep focus on main analytics canvas.
- **Logo Preservation**:
  - Genuine ChurnGuard shield silhouette preserved.
  - Normal state: stable geometry with high contrast gradient.
  - Hover state: subtle 1.04x scale, gentle glow, and micro beacon indicator (no distracting continuous rotation).
- **Topbar / Header Architecture**:
  - Container (`.dashboard-navbar`): Crisp card-style topbar with `var(--surface)` background (white), `var(--border)` (`slate-200`), `14px` border radius, and `shadow-sm`.
  - Title & Subtitle: Headings with tight tracking, secondary muted subtitle.
  - Global Search: `var(--slate-50)` background, `var(--slate-200)` border, `var(--slate-400)` placeholder, `var(--slate-500)` icon. Hover: `var(--slate-100)`. Focus: brand ring `var(--brand)`.
  - Search Suggestions: Instant dropdown with categorized pages & actions, keyboard navigation (`↑`/`↓`/`Enter`/`Esc`), and `⌘K` global shortcut.
  - Action Controls: Primary action in brand accent (`var(--brand)` with hover glow), secondary action in neutral subtle slate.
  - Icon Buttons: Theme toggle, notification bell with unread badge, and refresh button all adhere to 36px slate-200 containers.
  - Dropdowns: Small subtle fade/slide animation (`dropdownSlideIn 150ms`).
- **Responsive Navigation**:
  - Desktop (>= 1024px): Full or collapsed desktop sidebar.
  - Tablet & Mobile (< 1024px): Desktop sidebar seamlessly hides, hamburger button activates, slide-over drawer with backdrop blur provides navigation.
---
## 7. Complete Landing Page Redesign (Part 4)
- **Scope & Boundary**:
  - Exclusively redesigned public landing page at route `/` (`frontend/src/pages/Landing.jsx`).
  - Authenticated dashboard functionality (`/dashboard/*`, `/customers`, `/predictions`, `/analytics`, `/batch-predictions`, `/admin`) remained completely untouched.
- **11-Section Architecture**:
  1. **Navigation**: Clean Slate sticky header with ChurnGuard animated logo, center links (`#product`, `#workflow`, `#analytics`, `#features`), and minimal auth buttons (`Login`, `Get Started`).
  2. **Hero Section**:
     - Headline: *"Predict customer churn before it becomes revenue loss."*
     - Supporting copy: Grounded in real ChurnGuard ML capabilities (behavioral telemetry, random forest / gradient boosting risk classification, explainable factor attribution, actionable retention playbooks).
     - CTAs: Primary *"Get Started"* (`/register`), Secondary *"Explore Dashboard"* (`/dashboard`).
  3. **Hero Product Visualization**:
     - High-fidelity interface simulation showing customer `#CUST-8492`, Risk Score `78.4%` (High Risk), probability gauge, top AI drivers (month-to-month contract, electronic check), and automated recommendation card.
  4. **FIG 1.0 — Churn Intelligence**:
     - Small figure number badge, uppercase technical sublabel, title, and descriptive documentation caption.
     - Animated SVG telemetry flow lines (`anim-flow-line`) streaming through ingestion nodes to an AI Risk Engine core beacon, outputting classified risk predictions and automated playbooks.
  5. **FIG 2.0 — Customer Risk**:
     - Risk categories: High Risk (>65%), Medium Risk (35–65%), Low Risk (<35%).
     - Real-time classification scanning beam animation (`anim-scan-beam`) with interactive category filtering pills.
  6. **FIG 3.0 — Prediction Explanation**:
     - Explainable AI waterfall visualization displaying customer attributes (Contract, Billing, Service, Tenure) leading to calibrated probability and directional factor influence bars (+32% Month-to-month, +18% Electronic check, -14% Tenure).
  7. **FIG 4.0 — Recommended Actions**:
     - Linear intervention pipeline: High Risk Customer → AI Diagnosis → Targeted Recommendation → Operational Action, connected via subtle CSS beacon lines.
  8. **FIG 5.0 — Analytics**:
     - Multi-cohort data visualization featuring interactive tabs:
       - *Tenure Hazard Curve*: Smooth SVG area curve demonstrating peak churn risk at 0–12 months inflection point.
       - *Contract Cohort Distribution*: Comparative churn rate breakdown (Month-to-Month 42.7% vs One-Year 11.3% vs Two-Year 2.8%).
       - Labeled clearly with *"Demo visualization — Illustrative values"*.
  9. **Product Workflow**:
     - 5-step numbered horizontal pipeline on desktop, collapsing to vertical stack on mobile:
       `01 Upload Customer Data` → `02 AI Analyzes Signals` → `03 Predict Churn Risk` → `04 Understand Why` → `05 Take Action`.
       Interactive cyclic step focus with auto-advance timer.
  10. **Final CTA**:
      - Headline: *"Turn churn signals into action."*
      - Elevated Slate surface card with *"Get Started"* and *"Login"* links.
  11. **Footer**:
      - Minimal white/slate footer with ChurnGuard logo, product links, authentication links, operational status badge, and copyright notice.
- **Visual & Motion Language**:
  - Slate neutral palette (`slate-50` through `slate-950`) accented with genuine ChurnGuard brand blue (`hsl(221.2, 83.2%, 53.3%)`).
  - Original animations created strictly with native CSS keyframes (`flowDash`, `scanBeamVertical`, `signalPulse`, `nodeBeacon`) and SVG path stroke offsets without external animation libraries.
  - Fully accessible with `@media (prefers-reduced-motion: reduce)` overrides disabling all loop animations.
  - Fully responsive across desktop (1440px), tablet (768px), and mobile (375px) with zero horizontal overflow.
---
## 8. Authenticated Dashboard Redesign (Part 5)
- **Scope & Boundary**:
  - Exclusively redesigned the authenticated `/dashboard` route (`frontend/src/pages/Dashboard.jsx`).
  - Preserved 100% of existing API endpoints (`getDashboardStats()`, `runBatchAnalysis()`, `getMLMetrics()`, `getUploadHistory()`), calculations, and state logic. Zero backend modifications.
- **6-Level Visual Priority Hierarchy**:
  1. **Page Identity**:
     - Clean Slate header with system status badge (*Live System*), contextual subtitle, and primary actions (*Run Batch Analysis* with inline spinner, *Upload Dataset*).
  2. **Key Metrics (Stat Cards)**:
     - 7 White cards (`background: var(--surface)`, `border: 1px solid var(--slate-200)`):
       - *Total Customers*: `total_analyzed`
       - *Active Customers*: `total_analyzed - high_risk_count`
       - *High Risk*: `high_risk_count` with subtle semantic red accent (`border-left: 3px solid var(--danger)`)
       - *Medium Risk*: `medium_risk_count` with subtle semantic amber accent (`border-left: 3px solid var(--warning)`)
       - *Low Risk*: `low_risk_count` with subtle semantic green accent (`border-left: 3px solid var(--success)`)
       - *Total MRR*: formatted Indian Rupee currency (`total_mrr`)
       - *Churn Rate*: `avg_churn_rate%`
     - Typography: Title (`var(--slate-600)`), Number (`var(--slate-900)`), Supporting text (`var(--slate-500)`). Subtle hover elevation (`translateY(-2px)`, `shadow-md`).
  3. **Risk Overview**:
     - *Revenue at Risk*: Headline showing exposed MRR vs total MRR, multi-segment progress meter (Red / Amber / Green), and 3-card waterfall breakdown (High Risk MRR, Medium Risk MRR, Retained MRR).
     - *High-Risk Customer Profile*: Behavioral archetype traits (Month-to-month contracts, Electronic check payment, Fiber optic service, Early tenure) with actionable retention callout.
  4. **Churn Analytics**:
     - *Customer Tenure vs. Churn Risk*: Area chart with lifecycle hazard curve (peak vulnerability at 0–12m onboarding).
     - *Churn Risk by Contract Type*: Horizontal stacked bar chart (Month-to-Month vs 1-Year vs 2-Year commitments).
     - Styling: Grid lines in `var(--slate-200)`, axes in `var(--slate-500)`, semantic series (Red, Amber, Green). Subtle 600ms entrance animation (`isAnimationActive={true}`), no continuous looping. Custom white tooltip with slate border and shadow.
  5. **Customer Insights**:
     - *Top Churn Drivers*: ML feature importance ranking with rank badges, category tags, directional pills (*Increases Risk* / *Protects Retention*), and relative impact bars.
     - *Model Confidence & Evaluation*: Circular F1 Score gauge with production status badge and 4-metric scorecard (*Accuracy*, *Precision*, *Recall*, *AUC Score*).
     - *Highest Risk Customers*: Priority outreach list with initials avatar, account plan, probability progress bar, and *High Risk* badge. Quick link to `/customers`.
     - *AI Revenue Protection Banner*: Highlighted endangered revenue summary with direct link to single-customer prediction (`/predict`).
  6. **Recent Activity**:
     - Telemetry synchronization audit log showing dataset filename, new records inserted, duplicates skipped, and relative timestamps on a clean vertical timeline.
- **Responsive Behavior**:
  - Desktop: 7-column stat cards (`.dashboard-stat-grid`), 2-column split grids for analytics and insights.
  - Tablet (<= 1400px / 1080px): 4-column / 2-column stat cards, single-column stacked grids for charts.
  - Mobile (<= 480px): 1-column stat cards, auto-resizing charts with zero horizontal scroll overflow.
---
## 9. Customers, Predict Churn & Upload Redesign (Part 6)
- **Scope & Boundary**:
  - Exclusively redesigned `Customers.jsx` (`/customers`), `Predict.jsx` (`/predict`), and `Upload.jsx` (`/upload`).
  - Preserved 100% of backend API interactions, data structures, validation routines, abort controllers, and state management. Zero unnecessary database writes.
- **Customers Component (`frontend/src/pages/Customers.jsx`)**:
  - Professional analytics table with `.analytics-table-wrap` and `.analytics-table` classes.
  - Table header in `var(--slate-50)` (`#f8fafc`), table rows in white (`var(--surface)`), hover in `var(--slate-50)`, dividers in `var(--slate-200)`.
  - Standardized semantic risk badges:
    - *High Risk*: Red badge (`badge badge-red`, `● High Risk`)
    - *Medium Risk*: Amber badge (`badge badge-yellow`, `● Medium Risk`)
    - *Low Risk*: Green badge (`badge badge-green`, `● Low Risk`)
  - Clean Slate controls: debounced search input in `slate-50` with `slate-200` border, clear button, interactive risk filter tabs (*All*, *High Risk*, *Medium Risk*, *Low Risk*), total dataset counter badge.
  - Add Customer and Edit Customer modals redesigned with Slate dialog tokens, form inputs with brand focus rings, and zero page-reload optimistic state updates.
- **Predict Churn Component (`frontend/src/pages/Predict.jsx`)**:
  - Form: Elevated white card with `var(--slate-200)` border, clean uppercase labels in `var(--slate-600)`, customer select dropdown with brand focus ring, and 6-field customer telemetry summary in `slate-50` chips.
  - Prediction Result:
    - Large bold churn probability display (`38px`, risk-colored).
    - Risk badge (High / Medium / Low) with priority label.
    - AI Explanation: Top contributing factors with directional impact indicators (`+` Increases Risk / `−` Protects Retention) and percentage attributions.
    - Recommended Actions: Mitigation playbook cards with brand accent left border (`3px solid var(--brand)`).
    - Subtle reveal entrance animation (`.predict-result-reveal` via `fadeIn` + `scaleUp`).
- **Upload Dataset Component (`frontend/src/pages/Upload.jsx`)**:
  - Premium upload dropzone (`.upload-dropzone`): 2px dashed `slate-300` border, hover transition to brand accent (`var(--brand)`), active dragging state in `var(--brand-subtle)`.
  - Upload Progress: Animated progress track in `var(--slate-200)` with `var(--brand)` fill and sequential stage labels.
  - Success State: Green-themed container (`rgba(16, 185, 129, 0.08)`) with metric breakdown cards (Total Rows, New Records Added, Duplicates Skipped, Total in Database).
  - Error State: Red-themed container (`rgba(239, 68, 68, 0.08)`) with clean error description.
  - Dataset schema preview table and upload history audit log formatted with `slate-50` header rows and `slate-200` borders.
---
## 10. Analytics, Reports & Settings Redesign (Part 7)
- **Scope & Boundary**:
  - Exclusively redesigned `Analytics.jsx` (`/analytics`), `Reports.jsx` (`/reports`), and `Settings.jsx` (`/settings`).
  - Preserved 100% of ML calculations, model metrics, chart data structures, authentication routines, and security logic.
- **Analytics Component (`frontend/src/pages/Analytics.jsx`)**:
  - Information-dense Slate dashboard cards (`.dashboard-stat-card`, `.dashboard-card`).
  - Clear chart hierarchy with controlled brand accent and semantic risk colors.
  - All 6 core intelligence visualizations:
    1. *Model Metrics*: Clean evaluation grid featuring Accuracy (81.5%), Precision (60.9%), Recall (83.7%), F1 Score (70.5%), and ROC-AUC (89.6%).
    2. *Confusion Matrix*: 2x2 Slate matrix grid (`.confusion-matrix-grid`, `.confusion-matrix-cell`) with True Negatives (844), False Positives (201), False Negatives (61), and True Positives (313), complete with specificity and sensitivity calculation chips.
    3. *ROC Curve*: Smooth Recharts `AreaChart` plotting False Positive Rate vs. True Positive Rate with linear baseline reference and ROC-AUC badge.
    4. *Feature Importance*: Horizontal `BarChart` of top model predictors (Contract type, tenure, monthly charges, internet service) with percentage attributions.
    5. *Churn Distribution*: Risk tier distribution bars (High, Medium, Low) with accounts count and percentage shares.
    6. *Segments*: Contract cohort donut chart (Month-to-month, One year, Two year) with retention rates and monthly revenue breakdown.
- **Reports Component (`frontend/src/pages/Reports.jsx`)**:
  - Clean report cards (`.reports-card`) with `slate-200` borders and subtle elevation.
  - Summary metric strip with customers analyzed, high-risk accounts (semantic red), and monthly recurring revenue (semantic green).
  - Export controls:
    - Primary export buttons in brand accent (`btn-primary` with `var(--brand)`).
    - Secondary buttons in Slate (`btn-secondary` with `var(--slate-700)` and `slate-200` border).
  - Semantic status badges (`badge badge-green`, `badge badge-blue`, `badge badge-slate`).
  - Slate system table modal (`.analytics-table-wrap`, `.analytics-table`) for previewing top at-risk customer cohorts and live executive metrics with high/medium/low risk badges.
- **Settings Component (`frontend/src/pages/Settings.jsx`)**:
  - Tab Bar: Clean Slate pill container (`.settings-tabs-bar`) with 5 tabs:
    - *Profile*, *Security*, *Notifications*, *Appearance*, *Language*.
    - Active tab: Brand accent (`background: var(--brand); color: #ffffff;`).
    - Inactive tabs: Slate-600 (`color: var(--slate-600); background: transparent;`).
  - Cards: White (`var(--surface)`), borders in `var(--slate-200)`, border-radius `16px`.
  - Inputs: White (`#ffffff`), `var(--slate-300)` border, and focus state with brand accent ring (`border-color: var(--brand); box-shadow: 0 0 0 3px var(--brand-glow)`).
  - Authentication and security logic preserved 100%:
    - Zero alterations to password OTP verification endpoints, avatar multipart file upload, or profile MongoDB synchronization.
