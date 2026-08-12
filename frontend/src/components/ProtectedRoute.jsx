import { Navigate } from 'react'

function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token')

  if (!token || token === 'undefined' || token === 'null') {
    return <Navigate to="/" replace />
  }

  return children
}

export default ProtectedRoute