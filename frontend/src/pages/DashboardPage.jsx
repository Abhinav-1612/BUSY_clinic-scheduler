import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../api/client'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid, Cell, PieChart, Pie, LabelList
} from 'recharts'
import { Spinner, EmptyState, Modal, StatusBadge, formatDate, formatTime } from '../components/ui'
import { 
  Calendar, UserCheck, AlertTriangle, CheckCircle, 
  MoreVertical, BarChart2, Activity, Heart, Brain, Baby, Bone, Leaf,
  Users, ChevronDown, Stethoscope, User, Shield, Award, Zap,
  TrendingDown, PieChart as PieChartIcon, Search
} from 'lucide-react'
import AppointmentModal from '../components/AppointmentModal'

const STATUS_COLORS = {
  requested: '#fbbf24',
  confirmed: '#4f6ef7',
  checked_in: '#22d3ee',
  completed: '#34d399',
  no_show: '#f87171',
  cancelled: '#4e5a72',
}

const PROVIDER_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1', '#f43f5e'];

const getProviderIcon = (index) => {
  const icons = [User, Stethoscope, Activity, Heart, Shield, Award, Zap];
  const Icon = icons[index % icons.length];
  return <Icon size={14} />;
};

const CustomXAxisTick = ({ x, y, payload }) => {
  const index = payload.index;
  return (
    <g transform={`translate(${x},${y})`}>
      <foreignObject x={-40} y={10} width={80} height={40}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem', gap: '4px' }}>
          {getProviderIcon(index)}
          <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>{payload.value}</span>
        </div>
      </foreignObject>
    </g>
  );
};

const CustomBarLabel = ({ x, y, width, value, maxVal }) => {
  const isTop = y < 50;
  return (
    <text 
      x={x + width / 2} 
      y={isTop ? y + 20 : y - 10} 
      fill={isTop ? '#fff' : 'var(--text-primary)'} 
      textAnchor="middle" 
      fontSize="12" 
      fontWeight="600"
    >
      {value}
    </text>
  );
};

// ── Stat card drill-down config ───────────────────────────────────────────────
// Each key maps to the API params needed to fetch the relevant appointments

// Use local date (not UTC) to avoid off-by-one at midnight for IST/UTC+offset timezones
function localDateStr(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function getStatParams(key) {
  const today = localDateStr()
  const weekStart = (() => {
    const d = new Date()
    d.setDate(d.getDate() - d.getDay() + 1) // Monday
    return localDateStr(d)
  })()
  const weekEnd = (() => {
    const d = new Date()
    d.setDate(d.getDate() - d.getDay() + 7) // Sunday
    return localDateStr(d)
  })()

  switch (key) {
    case 'today': return { date_from: today, date_to: today, page_size: 100 }
    case 'checked_in': return { date_from: today, date_to: today, status: 'checked_in', page_size: 100 }
    case 'no_show': return { date_from: weekStart, date_to: weekEnd, status: 'no_show', page_size: 100 }
    case 'confirmed': return { date_from: today, status: 'confirmed', page_size: 100 }
    default: return {}
  }
}

const STAT_TITLES = {
  today: "Today's Appointments",
  checked_in: 'Currently Checked In',
  no_show: 'No-Shows This Week',
  confirmed: 'Confirmed Upcoming',
}

// ── Stat Detail Modal ─────────────────────────────────────────────────────────
function StatDetailModal({ statKey, onClose }) {
  const params = getStatParams(statKey)
  const [selectedApptId, setSelectedApptId] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['stat-detail', statKey, params],
    queryFn: () => api.get('/api/appointments/', { params }).then(r => r.data),
    refetchOnMount: true,
    staleTime: 0,
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

// ── Provider Detail Modal ─────────────────────────────────────────────────────
function ProviderDetailModal({ provider, isToday, onClose }) {
  const [selectedApptId, setSelectedApptId] = useState(null)

  // Use the same GET /api/appointments/ endpoint, filtering by provider_id
  // and optionally by date.
  const params = { provider_id: provider.provider_id }
  if (isToday) {
    const todayStr = new Date().toISOString().split('T')[0]
    params.date_from = todayStr
    params.date_to = todayStr
  }

  const { data, isLoading } = useQuery({
    queryKey: ['provider-detail', provider.provider_id, isToday],
    queryFn: () => api.get('/api/appointments/', { params }).then(r => r.data),
  })

  const appointments = data?.data || []

  return (
    <>
      <Modal title={`Appointments for ${provider.provider} ${isToday ? '(Today)' : ''}`} onClose={onClose} size="modal-lg">
        <div className="modal-body" style={{ padding: 0 }}>
          {isLoading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><Spinner /></div>
          ) : appointments.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              No appointments found.
            </div>
          ) : (
            <div className="table-wrapper" style={{ border: 'none', borderRadius: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th>Date / Time</th>
                    <th>Patient</th>
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
  const [showProviderToday, setShowProviderToday] = useState(false)
  const [activeProvider, setActiveProvider] = useState(null)
  const [selectedApptId, setSelectedApptId] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/api/dashboard/').then(r => r.data),
    refetchInterval: 8000,         // refresh every 8 seconds
    refetchOnWindowFocus: true,    // also refresh when switching back to tab
  })

  if (isLoading) return <div className="page-body"><Spinner /></div>
  if (!data) return <div className="page-body"><EmptyState title="Could not load dashboard" /></div>

  const { headline, by_status, by_provider, by_provider_today, no_show_trend } = data
  const providerDataToUse = showProviderToday ? by_provider_today : by_provider

  const statCards = [
    {
      key: 'today',
      icon: <Calendar size={22} />,
      iconClass: 'blue',
      value: headline.appointments_today?.value ?? headline.appointments_today,
      trend: headline.appointments_today?.trend ?? 0,
      trendText: headline.appointments_today?.trend_text ?? 'vs. yesterday',
      label: 'Appointments Today',
      linkText: 'View all appointments',
    },
    {
      key: 'checked_in',
      icon: <UserCheck size={22} />,
      iconClass: 'green',
      value: headline.checked_in_now?.value ?? headline.checked_in_now,
      trend: headline.checked_in_now?.trend ?? 0,
      trendText: headline.checked_in_now?.trend_text ?? 'vs. yesterday',
      label: 'Checked In Now',
      linkText: 'View checked in',
    },
    {
      key: 'no_show',
      icon: <AlertTriangle size={22} />,
      iconClass: 'red',
      value: headline.no_shows_this_week?.value ?? headline.no_shows_this_week,
      trend: headline.no_shows_this_week?.trend ?? 0,
      trendText: headline.no_shows_this_week?.trend_text ?? 'vs. last week',
      label: 'No-Shows This Week',
      linkText: 'View no-shows',
    },
    {
      key: 'confirmed',
      icon: <CheckCircle size={22} />,
      iconClass: 'yellow',
      value: headline.confirmed_upcoming?.value ?? headline.confirmed_upcoming,
      trend: headline.confirmed_upcoming?.trend ?? 0,
      trendText: headline.confirmed_upcoming?.trend_text ?? 'vs. yesterday',
      label: 'Confirmed Upcoming',
      linkText: 'View upcoming',
    },
  ]

  return (
    <div className="page-body">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title dashboard-page-title">Dashboard</h1>
          <p className="page-subtitle">Live overview — refreshes every 30 seconds</p>
        </div>
        <div className="dashboard-top-widgets">
          <div className="dtw-search">
            <Search size={16} />
            <span className="dtw-search-text">Search patients, appointments...</span>
            <span className="dtw-search-badge">Ctrl K</span>
          </div>
          <div className="dtw-date">
            <Calendar size={16} />
            <span>{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </div>
          {data.next_appointment && (
            <div 
              className="dtw-next-appt" 
              onClick={() => setSelectedApptId(data.next_appointment.id)}
              style={{ cursor: 'pointer' }}
              title="View Appointment Details"
            >
              <div className="dtw-next-icon"><Calendar size={22} /></div>
              <div className="dtw-next-content">
                <div className="dtw-next-label">Next Appointment</div>
                <div className="dtw-next-time">
                  {data.next_appointment.date !== localDateStr() && (
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary)', marginRight: 6 }}>
                      {new Date(data.next_appointment.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                  {data.next_appointment.time} — {data.next_appointment.patient_name}
                </div>
                <div className="dtw-next-doc">{data.next_appointment.provider}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Headline Numbers — all clickable */}
      <div className="styled-metric-grid">
        {statCards.map(card => (
          <div
            key={card.key}
            className={`styled-metric-card theme-${card.iconClass}`}
            onClick={() => setActiveStatKey(card.key)}
            title={`Click to see ${card.label}`}
            id={`stat-card-${card.key}`}
          >
            <div className="smc-top">
              <div className="smc-icon-box">{card.icon}</div>
              <div className="smc-content">
                <div className="smc-label">{card.label}</div>
                <div className="smc-value-row">
                  <div className="smc-value">{card.value}</div>
                  <div className="smc-trend-col">
                    <div className={`smc-trend-pill ${card.trend >= 0 ? 'positive' : 'negative'}`}>
                      {card.trend >= 0 ? '↑' : '↓'} {card.trend > 0 ? '+' : ''}{card.trend}%
                    </div>
                    <div className="smc-trend-text">{card.trendText}</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="smc-bottom">
              <span className="smc-link-text">{card.linkText} →</span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="chart-grid">
        {/* No-Show Trend */}
        <div className="provider-chart-card theme-red" style={{ marginTop: 0 }}>
          <div className="pcc-header">
            <div className="pcc-title-area">
              <div className="pcc-icon theme-red"><TrendingDown size={22} /></div>
              <div>
                <h3 className="pcc-title">No-Show Rate Trend</h3>
                <p className="pcc-subtitle">Percentage of missed appointments over the last 8 weeks</p>
              </div>
            </div>
            <div className="pcc-actions">
              <button className="btn btn-ghost pcc-menu-btn"><MoreVertical size={16} /></button>
            </div>
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
        <div className="provider-chart-card theme-yellow" style={{ marginTop: 0 }}>
          <div className="pcc-header">
            <div className="pcc-title-area">
              <div className="pcc-icon theme-yellow"><PieChartIcon size={22} /></div>
              <div>
                <h3 className="pcc-title">Appointments by Status</h3>
                <p className="pcc-subtitle">Distribution of all scheduled appointments</p>
              </div>
            </div>
            <div className="pcc-actions">
              <button className="btn btn-ghost pcc-menu-btn"><MoreVertical size={16} /></button>
            </div>
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
                  percent > 0.04 ? `${status.replace('_', ' ')} ${(percent * 100).toFixed(0)}%` : ''
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
      <div className="provider-chart-card theme-blue">
        <div className="pcc-header">
          <div className="pcc-title-area">
            <div className="pcc-icon"><Users size={22} /></div>
            <div>
              <h3 className="pcc-title">Appointments by Provider</h3>
              <p className="pcc-subtitle">Number of appointments scheduled with each provider</p>
            </div>
          </div>
          <div className="pcc-actions">
            <button
              className="btn btn-ghost pcc-dropdown-btn"
              onClick={() => setShowProviderToday(!showProviderToday)}
            >
              {showProviderToday ? 'Today Only' : 'All Time'} <ChevronDown size={14} />
            </button>
            <button className="btn btn-ghost pcc-menu-btn">
              <MoreVertical size={16} />
            </button>
            <div className="pcc-total-card">
              <div className="pcc-total-icon"><BarChart2 size={20} /></div>
              <div className="pcc-total-content">
                <div className="pcc-total-label">Total Appointments</div>
                <div className="pcc-total-value">
                  {providerDataToUse.reduce((acc, p) => acc + p.count, 0)}
                </div>
              </div>
              <div className="pcc-total-trend">
                <div className={`smc-trend-pill ${data.total_appointments_trend >= 0 ? 'positive' : 'negative'}`}>
                  {data.total_appointments_trend >= 0 ? '↗' : '↘'} {data.total_appointments_trend > 0 ? '+' : ''}{data.total_appointments_trend}%
                </div>
                <div className="smc-trend-text">vs. last week</div>
              </div>
            </div>
          </div>
        </div>
        
        {providerDataToUse.length === 0 ? (
          <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            No appointments found
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={providerDataToUse} margin={{ top: 40, right: 10, left: -20, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis 
                dataKey="provider" 
                tick={(props) => <CustomXAxisTick {...props} />} 
                interval={0}
                axisLine={false}
                tickLine={false}
              />
              <YAxis 
                tick={{ fill: 'var(--text-muted)', fontSize: 11 }} 
                allowDecimals={false} 
                axisLine={false}
                tickLine={false}
                label={{ value: 'Number of Appointments', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: 'var(--text-muted)', fontSize: 11 } }}
              />
              <Tooltip
                contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                cursor={{ fill: 'var(--bg-base)' }}
              />
              <Bar 
                dataKey="count" 
                radius={[4, 4, 0, 0]} 
                name="Appointments"
                onClick={(data) => setActiveProvider(data)}
                style={{ cursor: 'pointer' }}
                barSize={45}
              >
                {providerDataToUse.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={PROVIDER_COLORS[index % PROVIDER_COLORS.length]} />
                ))}
                <LabelList 
                  dataKey="count" 
                  content={(props) => <CustomBarLabel {...props} maxVal={Math.max(...providerDataToUse.map(p => p.count))} />} 
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* No-Show detail table */}
      <div className="provider-chart-card theme-red">
        <div className="pcc-header">
          <div className="pcc-title-area">
            <div className="pcc-icon theme-red"><AlertTriangle size={22} /></div>
            <div>
              <h3 className="pcc-title">Weekly No-Show Detail</h3>
              <p className="pcc-subtitle">Breakdown of missed appointments</p>
            </div>
          </div>
          <div className="pcc-actions">
            <button className="btn btn-ghost pcc-menu-btn"><MoreVertical size={16} /></button>
          </div>
        </div>
        <div className="table-wrapper" style={{ border: 'none', margin: '0 24px 24px 24px' }}>
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

      {/* Provider Drill-Down Modal */}
      {activeProvider && (
        <ProviderDetailModal
          provider={activeProvider.payload || activeProvider}
          onClose={() => setActiveProvider(null)}
          isToday={showProviderToday}
        />
      )}

      {/* Appointment Detail Modal for Next Appt */}
      {selectedApptId && (
        <AppointmentModal
          appointmentId={selectedApptId}
          onClose={() => setSelectedApptId(null)}
        />
      )}
    </div>
  )
}
