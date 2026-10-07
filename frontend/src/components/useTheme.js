import { useContext } from 'react'
import { ThemeContext } from './ThemeContext'

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    // Fallback if rendered outside provider
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'light'
    return {
      theme: currentTheme,
      isDark: currentTheme === 'dark',
      setTheme: (t) => {
        document.documentElement.setAttribute('data-theme', t)
        try { localStorage.setItem('theme', t) } catch {}
      },
      toggleTheme: () => {
        const next = currentTheme === 'light' ? 'dark' : 'light'
        document.documentElement.setAttribute('data-theme', next)
        try { localStorage.setItem('theme', next) } catch {}
      }
    }
  }
  return context
}

export default useTheme
