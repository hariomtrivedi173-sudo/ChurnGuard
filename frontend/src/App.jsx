import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Customers from './pages/Customers'
import Predict from './pages/Predict'
import Upload from './pages/Upload'
import Analytics from './pages/Analytics'
import Register from './pages/Register'
import Segments from './pages/Segments'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import ProtectedRoute from './components/ProtectedRoute'
import VerifyOTP from './pages/VerifyOTP'
import { SidebarProvider } from './components/SidebarProvider'
import { ThemeProvider } from './components/ThemeProvider'

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <SidebarProvider>
          <Toaster
          position="top-right"
          toastOptions={{
            style: {
              borderRadius: '12px',
              background: 'var(--surface)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
              fontSize: '14px',
            },
          }}
        />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
          <Route path="/predict" element={<ProtectedRoute><Predict /></ProtectedRoute>} />
          <Route path="/predictions" element={<ProtectedRoute><Predict /></ProtectedRoute>} />
          <Route path="/segments" element={<ProtectedRoute><Segments /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
          <Route path="/upload" element={<ProtectedRoute><Upload /></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-otp" element={<VerifyOTP />} />
          <Route path="*" element={<Login />} />
        </Routes>
      </SidebarProvider>
    </BrowserRouter>
  </ThemeProvider>
  )
}

export default App