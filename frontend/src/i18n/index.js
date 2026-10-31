import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import enUS from './locales/en-US.json' with { type: 'json' }
import enGB from './locales/en-GB.json' with { type: 'json' }
import es from './locales/es.json' with { type: 'json' }
import fr from './locales/fr.json' with { type: 'json' }
import de from './locales/de.json' with { type: 'json' }
import ja from './locales/ja.json' with { type: 'json' }

export const SUPPORTED_LANGUAGES = [
  { code: 'en-US', label: 'English (US)' },
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'es',    label: 'Spanish (Español)' },
  { code: 'fr',    label: 'French (Français)' },
  { code: 'de',    label: 'German (Deutsch)' },
  { code: 'ja',    label: 'Japanese (日本語)' },
]

export const NAMESPACES = [
  'common',
  'sidebar',
  'header',
  'settings',
  'dashboard',
  'customers',
  'predict',
  'upload',
  'datasets',
  'analytics',
  'reports',
  'errors'
]

const resources = {
  'en-US': { translation: enUS, ...enUS },
  'en':    { translation: enUS, ...enUS },
  'en-GB': { translation: enGB, ...enGB },
  'es':    { translation: es,   ...es },
  'fr':    { translation: fr,   ...fr },
  'de':    { translation: de,   ...de },
  'ja':    { translation: ja,   ...ja },
}

export function getStoredLanguage() {
  try {
    const saved = localStorage.getItem('app_language')
    if (saved && resources[saved]) return saved
    if (saved === 'en') return 'en-US'
    return 'en-US'
  } catch {
    return 'en-US'
  }
}

export function updateHtmlLang(lng) {
  if (typeof document !== 'undefined') {
    const cleanLang = (lng === 'en') ? 'en-US' : (lng || 'en-US')
    document.documentElement.lang = cleanLang
  }
}

const initialLang = getStoredLanguage()
updateHtmlLang(initialLang)

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: initialLang,
    fallbackLng: 'en-US',
    defaultNS: 'translation',
    ns: ['translation', ...NAMESPACES],
    interpolation: {
      escapeValue: false, // React already safes from XSS
    },
    react: {
      useSuspense: false,
    },
  })

i18n.on('languageChanged', (lng) => {
  updateHtmlLang(lng)
  try {
    localStorage.setItem('app_language', lng)
  } catch {}
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('churnguard_regional_updated'))
  }
})

export async function changeAppLanguage(langCode) {
  const target = (langCode === 'en') ? 'en-US' : (langCode || 'en-US')
  await i18n.changeLanguage(target)
  updateHtmlLang(target)
  try {
    localStorage.setItem('app_language', target)
  } catch {}
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('churnguard_regional_updated'))
  }
  return target
}

export default i18n

