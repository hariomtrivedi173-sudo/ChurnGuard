import { useState, useEffect } from 'react'
import { ThemeContext } from './ThemeContext'

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    try {
      const saved = localStorage.getItem('theme')
      if (saved === 'dark' || saved === 'light') return saved
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark'
      }
      return 'light'
    } catch {
      return 'light'
    }
  })

  // Synchronize data-theme on <html> and localStorage whenever theme changes
  useEffect(() => {
    try {
      document.documentElement.setAttribute('data-theme', theme)
      localStorage.setItem('theme', theme)
      window.dispatchEvent(new CustomEvent('churnguard_theme_changed', { detail: { theme } }))
    } catch {
      // storage unavailable
    }
  }, [theme])

  // Sync across browser tabs and storage events
  useEffect(() => {
    function handleStorageChange(e) {
      if (e.key === 'theme' && (e.newValue === 'light' || e.newValue === 'dark')) {
        setThemeState(e.newValue)
      }
    }
    function handleCustomThemeChange(e) {
      if (e.detail?.theme && (e.detail.theme === 'light' || e.detail.theme === 'dark')) {
        setThemeState(e.detail.theme)
      }
    }
    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('churnguard_theme_changed', handleCustomThemeChange)
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('churnguard_theme_changed', handleCustomThemeChange)
    }
  }, [])

  function setTheme(newTheme) {
    if (newTheme === 'dark' || newTheme === 'light') {
      setThemeState(newTheme)
    }
  }

  function toggleTheme() {
    setThemeState(prev => (prev === 'light' ? 'dark' : 'light'))
  }

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDark: theme === 'dark',
        setTheme,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  )
}

export default ThemeProvider
