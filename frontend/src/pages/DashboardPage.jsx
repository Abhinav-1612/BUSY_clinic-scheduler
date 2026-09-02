import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../api/client'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid, Cell, PieChart, Pie
} from 'recharts'
import { Spinner, EmptyState, Modal, StatusBadge, formatDate, formatTime } from '../components/ui'
import { Calendar, UserCheck, AlertTriangle, CheckCircle } from 'lucide-react'
import AppointmentModal from '../components/AppointmentModal'

const STATUS_COLORS = {
  requested: '#fbbf24',
  confirmed: '#4f6ef7',
  checked_in: '#22d3ee',
  completed: '#34d399',
  no_show: '#f87171',
  cancelled: '#4e5a72',
}

// ── Stat card drill-down config ───────────────────────────────────────────────
// Each key maps to the API params needed to fetch the relevant appointments
function getStatParams(key) {
  const today = new Date().toISOString().split('T')[0]
  const weekStart = (() => {
    const d = new Date()
    d.setDate(d.getDate() - d.getDay() + 1) // Monday
    return d.toISOString().split('T')[0]
  })()
  const weekEnd = (() => {
    const d = new Date()
    d.setDate(d.getDate() - d.getDay() + 7) // Sunday
    return d.toISOString().split('T')[0]
  })()

  switch (key) {
    case 'today':      return { date_from: today, date_to: today, page_size: 100 }
    case 'checked_in': return { date_from: today, date_to: today, status: 'checked_in', page_size: 100 }
    case 'no_show':    return { date_from: weekStart, date_to: weekEnd, status: 'no_show', page_size: 100 }
    case 'confirmed':  return { date_from: today, status: 'confirmed', page_size: 100 }
    default:           return {}
  }
}

const STAT_TITLES = {
  today:      "Today's Appointments",
  checked_in: 'Currently Checked In',
  no_show:    'No-Shows This Week',
  confirmed:  'Confirmed Upcoming',
}

// ── Stat Detail Modal ─────────────────────────────────────────────────────────
function StatDetailModal({ statKey, onClose }) {
  const params = getStatParams(statKey)
  const [selectedApptId, setSelectedApptId] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['stat-detail', statKey],
    queryFn: () => api.get('/api/appointments/', { params }).then(r => r.data),
  })

  const appointments = data?.data || []

  return (
    <>
      <Modal title={STAT_TITLES[statKey]} onClose={onClose} size="modal-lg">
        <div className="modal-body" style={{ padding: 0 }}>
          {isLoading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>
          ) : appointments.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              No appointments found for this category.
            </div>
          ) : (
            <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Date / Time</th>
                    <th>Patient</th>
                    <th>Provider</th>
                    <th>Status</th>
                    <th>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.map(a => (
                    <tr
                      key={a.id}
                      onClick={() => setSelectedApptId(a.id)}
                      style={{ cursor: 'pointer' }}
                      title="Click to open full detail"
                    >
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {formatDate(a.slot?.date)}
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                          {formatTime(a.slot?.start_time)}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{a.patient_name}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>{a.patient_email}</div>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{a.slot?.provider_name || '—'}</td>
                      <td><StatusBadge status={a.status} /></td>
                      <td style={{ color: 'var(--text-muted)' }}>{a.slot?.duration_minutes} min</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Modal>

      {/* Full appointment detail — stacks on top of this modal */}
      {selectedApptId && (
        <AppointmentModal
          appointmentId={selectedApptId}
          onClose={() => setSelectedApptId(null)}
        />
      )}
    </>
  )
}

// ── Dashboard Page ────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [activeStatKey, setActiveStatKey] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/api/dashboard/').then(r => r.data),
    refetchInterval: 30000,
  })

  if (isLoading) return <div className="page-body"><Spinner /></div>
  if (!data) return <div className="page-body"><EmptyState title="Could not load dashboard" /></div>

  const { headline, by_status, by_provider, no_show_trend } = data

  const statCards = [
    {
      key: 'today',
      icon: <Calendar size={20} />,
      iconClass: 'blue',
      value: headline.appointments_today,
      label: 'Appointments Today',
      hint: 'Click to view',
    },
    {
      key: 'checked_in',
      icon: <UserCheck size={20} />,
      iconClass: 'green',
      value: headline.checked_in_now,
      label: 'Checked In Now',
      hint: 'Click to view',
    },
    {
      key: 'no_show',
      icon: <AlertTriangle size={20} />,
      iconClass: 'red',
      value: headline.no_shows_this_week,
      label: 'No-Shows This Week',
      hint: 'Click to view',
    },
    {
      key: 'confirmed',
      icon: <CheckCircle size={20} />,
      iconClass: 'yellow',
      value: headline.confirmed_upcoming,
      label: 'Confirmed Upcoming',
      hint: 'Click to view',
    },
  ]

  return (
    <div className="page-body">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Live overview — refreshes every 30 seconds</p>
        </div>
      </div>

      {/* Headline Numbers — all clickable */}
      <div className="stat-grid">
        {statCards.map(card => (
          <div
            key={card.key}
            className="stat-card stat-card-clickable"
            onClick={() => setActiveStatKey(card.key)}
            title={`Click to see ${card.label}`}
            id={`stat-card-${card.key}`}
            style={{ cursor: 'pointer' }}
          >
            <div className={`stat-icon ${card.iconClass}`}>{card.icon}</div>
            <div style={{ flex: 1 }}>
              <div className="stat-value">{card.value}</div>
              <div className="stat-label">{card.label}</div>
            </div>
            <div style={{
              fontSize: '0.7rem', color: 'var(--accent)',
              fontWeight: 600, letterSpacing: '0.03em',
              alignSelf: 'flex-end',
            }}>
              {card.hint} →
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="chart-grid">
        {/* No-Show Trend */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">No-Show Rate — Last 8 Weeks</h3>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={no_show_trend} margin={{ left: -20, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="week_label" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
              <YAxis
                tickFormatter={v => `${v}%`}
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                domain={[0, 100]}
              />
              <Tooltip
                contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }}
                labelStyle={{ color: 'var(--text-primary)' }}
                formatter={(v) => [`${v}%`, 'No-Show Rate']}
              />
              <Line
                type="monotone"
                dataKey="no_show_rate"
                stroke="var(--red)"
                strokeWidth={2.5}
                dot={{ fill: 'var(--red)', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Appointments by Status */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Appointments by Status</h3>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={by_status}
                dataKey="count"
                nameKey="status"
                cx="50%" cy="50%"
                outerRadius={80}
                label={({ status, percent }) =>
                  percent > 0.04 ? `${status.replace('_',' ')} ${(percent * 100).toFixed(0)}%` : ''
                }
                labelLine={false}
              >
                {by_status.map((entry, i) => (
                  <Cell key={i} fill={STATUS_COLORS[entry.status] || '#666'} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }}
                formatter={(v, name) => [v, name.replace('_', ' ')]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Provider Breakdown */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Appointments by Provider</h3>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={by_provider} margin={{ left: -20, right: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="provider" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
            <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }}
              labelStyle={{ color: 'var(--text-primary)' }}
            />
            <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} name="Appointments" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* No-Show detail table */}
      <div className="card mt-24">
        <div className="card-header">
          <h3 className="card-title">Weekly No-Show Detail</h3>
        </div>
        <div className="table-wrapper" style={{ border: 'none' }}>
          <table>
            <thead>
              <tr>
                <th>Week</th>
                <th>Total Appointments</th>
                <th>No-Shows</th>
                <th>No-Show Rate</th>
              </tr>
            </thead>
            <tbody>
              {no_show_trend.map((w, i) => (
                <tr key={i}>
                  <td style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{w.week_label}</td>
                  <td>{w.total_appointments}</td>
                  <td style={{ color: w.no_shows > 0 ? 'var(--red)' : 'var(--text-muted)' }}>
                    {w.no_shows}
                  </td>
                  <td>
                    <span style={{
                      color: w.no_show_rate > 20 ? 'var(--red)' : w.no_show_rate > 10 ? 'var(--yellow)' : 'var(--green)',
                      fontWeight: 600
                    }}>
                      {w.no_show_rate}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stat Drill-Down Modal */}
      {activeStatKey && (
        <StatDetailModal
          statKey={activeStatKey}
          onClose={() => setActiveStatKey(null)}
        />
      )}
    </div>
  )
}
