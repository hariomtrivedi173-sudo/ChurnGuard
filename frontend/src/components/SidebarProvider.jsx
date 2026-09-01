import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { SidebarContext } from './SidebarContext'

export function SidebarProvider({ children }) {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    try {
      return localStorage.getItem('churnguard_sidebar_collapsed') === 'true'
    } catch {
      return false
    }
  })

  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const location = useLocation()

  // Close mobile drawer whenever route changes
  useEffect(() => {
    setIsMobileOpen(false)
  }, [location.pathname])

  // Persist sidebar collapsed preference in localStorage
  useEffect(() => {
    try {
      localStorage.setItem('churnguard_sidebar_collapsed', String(isCollapsed))
    } catch {
      // Ignore storage errors
    }
  }, [isCollapsed])

  // Auto-close mobile drawer when viewport expands to desktop
  useEffect(() => {
    function handleResize() {
      if (window.innerWidth >= 1024) {
        setIsMobileOpen(false)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  function toggleSidebar() {
    setIsCollapsed(prev => !prev)
  }

  function openMobileSidebar() {
    setIsMobileOpen(true)
  }

  function closeMobileSidebar() {
    setIsMobileOpen(false)
  }

  return (
    <SidebarContext.Provider
      value={{
        isCollapsed,
        setIsCollapsed,
        toggleSidebar,
        isMobileOpen,
        openMobileSidebar,
        closeMobileSidebar,
      }}
    >
      {children}
    </SidebarContext.Provider>
  )
}

export default SidebarProvider
