// Centralized Currency, Formatting & Localization Formatter
import i18n from '../i18n/index.js'

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
  { code: 'en-US', label: 'English (US)' },
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'es',    label: 'Spanish (Español)' },
  { code: 'fr',    label: 'French (Français)' },
  { code: 'de',    label: 'German (Deutsch)' },
  { code: 'ja',    label: 'Japanese (日本語)' },
]

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
    if (i18n && i18n.language) return i18n.language
    const saved = localStorage.getItem('app_language')
    if (saved === 'en') return 'en-US'
    return saved || 'en-US'
  } catch {
    return 'en-US'
  }
}

/**
 * Universal translation helper that delegates directly to i18next instance.
 * Accepts namespace-prefixed keys (e.g. 'common.save', 'sidebar.dashboard', 'settings.profile.firstName').
 */
export function t(key, options = {}) {
  if (!key) return ''
  if (typeof options === 'string') {
    options = { lng: options }
  }
  return i18n.t(key, options)
}

export const tSidebar = (key, langCode = null) => {
  const cleanKey = key.replace('sidebar.', '')
  return t(`sidebar.${cleanKey}`, langCode ? { lng: langCode } : {})
}

/**
 * Intl.NumberFormat localized formatter following the active language.
 */
export function formatNumber(val, options = {}, lang = null) {
  if (val === null || val === undefined || isNaN(val)) return '—'
  const locale = lang || getActiveLanguage() || 'en-US'
  try {
    return new Intl.NumberFormat(locale, options).format(Number(val))
  } catch {
    return Number(val).toLocaleString()
  }
}

/**
 * Intl.DateTimeFormat localized formatter following the active language.
 */
export function formatDate(dateVal, options = { dateStyle: 'medium' }, lang = null) {
  if (!dateVal) return ''
  const locale = lang || getActiveLanguage() || 'en-US'
  try {
    const d = typeof dateVal === 'string' || typeof dateVal === 'number' ? new Date(dateVal) : dateVal
    if (isNaN(d.getTime())) return ''
    return new Intl.DateTimeFormat(locale, options).format(d)
  } catch {
    return String(dateVal)
  }
}

/**
 * Localized relative time formatter using Intl.RelativeTimeFormat.
 */
export function formatRelativeTime(isoString, lang = null) {
  if (!isoString) return ''
  const locale = lang || getActiveLanguage() || 'en-US'
  try {
    const then = new Date(isoString).getTime()
    if (isNaN(then)) return ''
    const diffSec = Math.round((then - Date.now()) / 1000)
    const absSec = Math.abs(diffSec)

    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })

    if (absSec < 60) return rtf.format(diffSec, 'second')
    const diffMin = Math.round(diffSec / 60)
    if (Math.abs(diffMin) < 60) return rtf.format(diffMin, 'minute')
    const diffHr = Math.round(diffMin / 60)
    if (Math.abs(diffHr) < 24) return rtf.format(diffHr, 'hour')
    const diffDays = Math.round(diffHr / 24)
    if (Math.abs(diffDays) < 30) return rtf.format(diffDays, 'day')
    const diffMonths = Math.round(diffDays / 30)
    if (Math.abs(diffMonths) < 12) return rtf.format(diffMonths, 'month')
    const diffYears = Math.round(diffMonths / 12)
    return rtf.format(diffYears, 'year')
  } catch {
    return ''
  }
}

/**
 * Currency Formatter: Reporting Currency selector is fully independent from interface language.
 */
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

export const formatMoney = formatCurrency
