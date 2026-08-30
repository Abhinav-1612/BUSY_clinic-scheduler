import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Sidebar from './components/Sidebar'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import AppointmentsPage from './pages/AppointmentsPage'
import SlotsPage from './pages/SlotsPage'
import BulkPage from './pages/BulkPage'
import AlertsPage from './pages/AlertsPage'
import ProvidersPage from './pages/ProvidersPage'

function ProtectedRoute({ children, frontDeskOnly = false }) {
  const { user, isFrontDesk } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (frontDeskOnly && !isFrontDesk) return <Navigate to="/appointments" replace />
  return children
}

function AppLayout({ children }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-content">
        {children}
      </div>
    </div>
  )
}

export default function App() {
  const { user } = useAuth()

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to={user.role === 'front_desk' ? '/dashboard' : '/appointments'} /> : <LoginPage />}
      />

      <Route path="/dashboard" element={
        <ProtectedRoute frontDeskOnly>
          <AppLayout><DashboardPage /></AppLayout>
        </ProtectedRoute>
      } />

      <Route path="/appointments" element={
        <ProtectedRoute>
          <AppLayout><AppointmentsPage /></AppLayout>
        </ProtectedRoute>
      } />

      <Route path="/slots" element={
        <ProtectedRoute>
          <AppLayout><SlotsPage /></AppLayout>
        </ProtectedRoute>
      } />

      <Route path="/bulk" element={
        <ProtectedRoute frontDeskOnly>
          <AppLayout><BulkPage /></AppLayout>
        </ProtectedRoute>
      } />

      <Route path="/providers" element={
        <ProtectedRoute frontDeskOnly>
          <AppLayout><ProvidersPage /></AppLayout>
        </ProtectedRoute>
      } />

      <Route path="/alerts" element={
        <ProtectedRoute frontDeskOnly>
          <AppLayout><AlertsPage /></AppLayout>
        </ProtectedRoute>
      } />

      <Route path="*" element={
        <Navigate to={user ? (user.role === 'front_desk' ? '/dashboard' : '/appointments') : '/login'} replace />
      } />
    </Routes>
  )
}
