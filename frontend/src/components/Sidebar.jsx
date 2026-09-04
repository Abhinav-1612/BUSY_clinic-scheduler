import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useQuery } from '@tanstack/react-query'
import api from '../api/client'
import {
  LayoutDashboard, Calendar, Clock, Users,
  Bell, LogOut, Layers, Sun, Moon,
  Stethoscope, CalendarPlus, ChevronDown
} from 'lucide-react'

function AlertBadge() {
  const { data } = useQuery({
    queryKey: ['alerts-count'],
    queryFn: () => api.get('/api/alerts/').then(r => r.data),
    refetchInterval: 60000, // poll every 60s
  })
  const count = data?.active_count || 0
  if (!count) return null
  return <span className="nav-badge" style={{ background: 'var(--red)', color: '#fff', padding: '3px 8px', borderRadius: '12px', fontWeight: 'bold' }}>{count}</span>
}

export default function Sidebar() {
  const { user, logout, isFrontDesk } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  // Hardcoded per user request
  const initials = 'AS'
  const displayRole = user?.role === 'front_desk' ? 'Front Desk' : 'Provider'

  return (
    <aside className="sidebar styled-sidebar">
      <div className="sidebar-logo styled-logo">
        <div className="sidebar-logo-icon styled-logo-icon">
          <CalendarPlus size={20} strokeWidth={2.5} />
        </div>
        <div>
          <div className="sidebar-logo-text styled-logo-text">ClinicFlow</div>
          <div className="sidebar-logo-sub styled-logo-sub">Scheduling System</div>
        </div>
      </div>

      <nav className="sidebar-nav styled-nav">
        {isFrontDesk && (
          <>
            <NavLink to="/dashboard" className={({ isActive }) => `nav-link styled-nav-link${isActive ? ' active' : ''}`}>
              <LayoutDashboard size={18} /> Dashboard
            </NavLink>
          </>
        )}

        <div className="nav-section-label styled-nav-label">SCHEDULING</div>
        <NavLink to="/appointments" className={({ isActive }) => `nav-link styled-nav-link${isActive ? ' active' : ''}`}>
          <Calendar size={18} /> Appointments
        </NavLink>
        <NavLink to="/slots" className={({ isActive }) => `nav-link styled-nav-link${isActive ? ' active' : ''}`}>
          <Clock size={18} /> Availability Slots
        </NavLink>

        {isFrontDesk && (
          <>
            <div className="nav-section-label styled-nav-label">TOOLS</div>
            <NavLink to="/bulk" className={({ isActive }) => `nav-link styled-nav-link${isActive ? ' active' : ''}`}>
              <Layers size={18} /> Bulk Generator
            </NavLink>
            <NavLink to="/providers" className={({ isActive }) => `nav-link styled-nav-link${isActive ? ' active' : ''}`}>
              <Users size={18} /> Providers
            </NavLink>
            <NavLink to="/alerts" className={({ isActive }) => `nav-link styled-nav-link${isActive ? ' active' : ''}`}>
              <Bell size={18} /> Alerts
              <AlertBadge />
            </NavLink>
          </>
        )}
      </nav>

      <div className="sidebar-bottom-section">
        {/* Info Card */}
        <div className="sidebar-info-card">
          <div className="sidebar-info-icon">
            <Stethoscope size={28} strokeWidth={2} />
          </div>
          <div className="sidebar-info-content">
            <div className="sidebar-info-title">Better Care<br/>Brighter Days</div>
            <div className="sidebar-info-text">Efficient scheduling for healthier communities.</div>
          </div>
        </div>

        {/* User Profile */}
        <div className="styled-user-profile">
          <div className="styled-user-avatar">{initials}</div>
          <div style={{ flex: 1 }}>
            <div className="styled-user-name">Abhinav Singh</div>
            <div className="styled-user-role">{displayRole}</div>
          </div>
          <ChevronDown size={16} className="styled-user-chevron" />
        </div>

        {/* Action Pills */}
        <div className="styled-action-pills">
          <button className="styled-pill-btn" onClick={toggleTheme}>
            {theme === 'dark' ? <><Sun size={14} /> Light</> : <><Moon size={14} /> Dark</>}
          </button>
          <button className="styled-pill-btn" onClick={handleLogout}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </div>
    </aside>
  )
}
