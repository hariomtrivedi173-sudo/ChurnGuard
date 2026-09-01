import { useContext } from 'react'
import { SidebarContext } from './SidebarContext'

export function useSidebar() {
  const context = useContext(SidebarContext)
  if (!context) {
    return {
      isCollapsed: false,
      setIsCollapsed: () => {},
      toggleSidebar: () => {},
      isMobileOpen: false,
      openMobileSidebar: () => {},
      closeMobileSidebar: () => {},
    }
  }
  return context
}

export default useSidebar
