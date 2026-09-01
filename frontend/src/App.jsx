import { useState } from 'react'
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
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className={`app-layout${collapsed ? ' sidebar-collapsed' : ''}`}>
      <Sidebar />

      {/* Floating toggle tab — sticks to edge of sidebar */}
      <button
        className="sidebar-toggle-btn"
        onClick={() => setCollapsed(c => !c)}
        title={collapsed ? 'Open sidebar' : 'Close sidebar'}
        id="sidebar-toggle-btn"
        aria-label="Toggle sidebar"
      >
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="none"
          style={{
            transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.32s ease',
          }}
        >
          <path
            d="M8 1L3 6l5 5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

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
