// Centralized Currency & Localization Formatter

export const CURRENCIES = {
  USD: { symbol: '$', code: 'USD', name: 'USD ($) — US Dollar', locale: 'en-US' },
  EUR: { symbol: '€', code: 'EUR', name: 'EUR (€) — Euro', locale: 'de-DE' },
  GBP: { symbol: '£', code: 'GBP', name: 'GBP (£) — British Pound', locale: 'en-GB' },
  INR: { symbol: '₹', code: 'INR', name: 'INR (₹) — Indian Rupee', locale: 'en-IN' },
  CAD: { symbol: 'CA$', code: 'CAD', name: 'CAD (CA$) — Canadian Dollar', locale: 'en-CA' },
  AUD: { symbol: 'A$', code: 'AUD', name: 'AUD (A$) — Australian Dollar', locale: 'en-AU' },
  JPY: { symbol: '¥', code: 'JPY', name: 'JPY (¥) — Japanese Yen', locale: 'ja-JP' },
}

export const LANGUAGES = [
  { code: 'en',    label: 'English (US)' },
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'es',    label: 'Spanish (Español)' },
  { code: 'fr',    label: 'French (Français)' },
  { code: 'de',    label: 'German (Deutsch)' },
  { code: 'ja',    label: 'Japanese (日本語)' },
]

export const TRANSLATIONS = {
  en: {
    dashboard: 'Dashboard',
    customers: 'Customers',
    predict: 'Predict Churn',
    upload: 'Upload Dataset',
    analytics: 'Analytics',
    reports: 'Reports',
    settings: 'Settings',
    highRisk: 'High Risk',
    medRisk: 'Medium Risk',
    lowRisk: 'Low Risk',
    activeAccounts: 'Active Accounts',
    monthlyRevenue: 'Monthly Recurring Revenue',
  },
  'en-GB': {
    dashboard: 'Dashboard',
    customers: 'Customers',
    predict: 'Predict Churn',
    upload: 'Upload Dataset',
    analytics: 'Analytics',
    reports: 'Reports',
    settings: 'Settings',
    highRisk: 'High Risk',
    medRisk: 'Medium Risk',
    lowRisk: 'Low Risk',
    activeAccounts: 'Active Accounts',
    monthlyRevenue: 'Monthly Recurring Revenue',
  },
  es: {
    dashboard: 'Panel Principal',
    customers: 'Clientes',
    predict: 'Predecir Churn',
    upload: 'Subir Datos',
    analytics: 'Analítica',
    reports: 'Informes',
    settings: 'Configuración',
    highRisk: 'Riesgo Alto',
    medRisk: 'Riesgo Medio',
    lowRisk: 'Riesgo Bajo',
    activeAccounts: 'Cuentas Activas',
    monthlyRevenue: 'Ingresos Recurrentes Mensuales',
  },
  fr: {
    dashboard: 'Tableau de Bord',
    customers: 'Clients',
    predict: 'Prédire l’Attrition',
    upload: 'Téléverser Données',
    analytics: 'Analytique',
    reports: 'Rapports',
    settings: 'Paramètres',
    highRisk: 'Risque Élevé',
    medRisk: 'Risque Moyen',
    lowRisk: 'Risque Faible',
    activeAccounts: 'Comptes Actifs',
    monthlyRevenue: 'Revenu Mensuel Récurrent',
  },
  de: {
    dashboard: 'Dashboard',
    customers: 'Kunden',
    predict: 'Abwanderung Vorhersagen',
    upload: 'Datensatz Hochladen',
    analytics: 'Analysen',
    reports: 'Berichte',
    settings: 'Einstellungen',
    highRisk: 'Hohes Risiko',
    medRisk: 'Mittleres Risiko',
    lowRisk: 'Geringes Risiko',
    activeAccounts: 'Aktive Konten',
    monthlyRevenue: 'Monatlich Wiederkehrender Umsatz',
  },
  ja: {
    dashboard: 'ダッシュボード',
    customers: '顧客管理',
    predict: '解約予測',
    upload: 'データセット登録',
    analytics: '分析',
    reports: 'レポート',
    settings: '設定',
    highRisk: '高リスク',
    medRisk: '中リスク',
    lowRisk: '低リスク',
    activeAccounts: 'アクティブ契約',
    monthlyRevenue: '月間経常収益 (MRR)',
  }
}

export function getActiveCurrency() {
  try {
    const saved = localStorage.getItem('churnguard_currency')
    return CURRENCIES[saved] ? saved : 'USD'
  } catch {
    return 'USD'
  }
}

export function getActiveLanguage() {
  try {
    const saved = localStorage.getItem('app_language')
    return TRANSLATIONS[saved] ? saved : 'en'
  } catch {
    return 'en'
  }
}

export function t(key, langCode = null) {
  const lang = langCode || getActiveLanguage()
  const dict = TRANSLATIONS[lang] || TRANSLATIONS.en
  return dict[key] || TRANSLATIONS.en[key] || key
}

export function formatCurrency(val, currencyCode = null) {
  if (val === null || val === undefined || isNaN(val)) return '—'
  const activeCode = currencyCode || getActiveCurrency()
  const curr = CURRENCIES[activeCode] || CURRENCIES.USD
  const num = Number(val)

  if (activeCode === 'INR') {
    if (num >= 10_000_000) return `₹${(num / 10_000_000).toFixed(1)}Cr`
    if (num >= 100_000)    return `₹${(num / 100_000).toFixed(1)}L`
    if (num >= 1_000)      return `₹${(num / 1_000).toFixed(1)}K`
    return `₹${Math.round(num).toLocaleString('en-IN')}`
  }

  if (num >= 1_000_000_000) return `${curr.symbol}${(num / 1_000_000_000).toFixed(1)}B`
  if (num >= 1_000_000)     return `${curr.symbol}${(num / 1_000_000).toFixed(1)}M`
  if (num >= 1_000)         return `${curr.symbol}${(num / 1_000).toFixed(1)}K`
  return `${curr.symbol}${Math.round(num).toLocaleString(curr.locale)}`
}
