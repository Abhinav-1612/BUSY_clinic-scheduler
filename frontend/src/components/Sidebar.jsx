import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useQuery } from '@tanstack/react-query'
import api from '../api/client'
import {
  LayoutDashboard, Calendar, Clock, Users,
  BarChart2, Bell, LogOut, Layers
} from 'lucide-react'

function AlertBadge() {
  const { data } = useQuery({
    queryKey: ['alerts-count'],
    queryFn: () => api.get('/api/alerts/').then(r => r.data),
    refetchInterval: 60000, // poll every 60s
  })
  const count = data?.active_count || 0
  if (!count) return null
  return <span className="nav-badge">{count}</span>
}

export default function Sidebar() {
  const { user, logout, isFrontDesk } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const initials = user?.full_name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">🏥</div>
        <div>
          <div className="sidebar-logo-text">ClinicFlow</div>
          <div className="sidebar-logo-sub">Scheduling System</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {isFrontDesk && (
          <>
            <div className="nav-section-label">Overview</div>
            <NavLink to="/dashboard" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <LayoutDashboard size={16} /> Dashboard
            </NavLink>
          </>
        )}

        <div className="nav-section-label">Scheduling</div>
        <NavLink to="/appointments" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          <Calendar size={16} /> Appointments
        </NavLink>
        <NavLink to="/slots" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
          <Clock size={16} /> Availability Slots
        </NavLink>

        {isFrontDesk && (
          <>
            <div className="nav-section-label">Tools</div>
            <NavLink to="/bulk" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <Layers size={16} /> Bulk Generator
            </NavLink>
            <NavLink to="/providers" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <Users size={16} /> Providers
            </NavLink>
            <NavLink to="/alerts" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <Bell size={16} /> Alerts
              <AlertBadge />
            </NavLink>
          </>
        )}
      </nav>

      <div className="sidebar-footer">
        <div className="user-info">
          <div className="user-avatar">{initials}</div>
          <div>
            <div className="user-name">{user?.full_name}</div>
            <div className="user-role">
              {user?.role === 'front_desk' ? 'Front Desk' : 'Provider'}
            </div>
          </div>
        </div>
        <button
          className="btn btn-ghost btn-sm w-full"
          style={{ justifyContent: 'center' }}
          onClick={handleLogout}
          id="logout-btn"
        >
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </aside>
  )
}
