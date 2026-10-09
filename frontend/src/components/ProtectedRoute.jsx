import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { getValidToken } from '../utils/auth'

function ProtectedRoute({ children }) {
  const [token, setToken] = useState(() => getValidToken())
  const location = useLocation()

  useEffect(() => {
    function verifyToken() {
      const valid = getValidToken()
      setToken(valid)
      if (!valid) {
        window.location.replace('/login')
      }
    }

    window.addEventListener('pageshow', verifyToken)
    window.addEventListener('storage', verifyToken)
    window.addEventListener('churnguard_auth_changed', verifyToken)
    return () => {
      window.removeEventListener('pageshow', verifyToken)
      window.removeEventListener('storage', verifyToken)
      window.removeEventListener('churnguard_auth_changed', verifyToken)
    }
  }, [])

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children
}

export default ProtectedRoute