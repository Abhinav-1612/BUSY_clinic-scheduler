import { useQuery } from '@tanstack/react-query'
import api from '../api/client'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid, Cell, PieChart, Pie, Legend
} from 'recharts'
import { Spinner, EmptyState } from '../components/ui'
import { Calendar, UserCheck, AlertTriangle, CheckCircle } from 'lucide-react'

const STATUS_COLORS = {
  requested: '#fbbf24',
  confirmed: '#4f6ef7',
  checked_in: '#22d3ee',
  completed: '#34d399',
  no_show: '#f87171',
  cancelled: '#4e5a72',
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/api/dashboard/').then(r => r.data),
    refetchInterval: 30000,
  })

  if (isLoading) return <div className="page-body"><Spinner /></div>
  if (!data) return <div className="page-body"><EmptyState title="Could not load dashboard" /></div>

  const { headline, by_status, by_provider, no_show_trend } = data

  return (
    <div className="page-body">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Live overview — refreshes every 30 seconds</p>
        </div>
      </div>

      {/* Headline Numbers */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon blue"><Calendar size={20} /></div>
          <div>
            <div className="stat-value">{headline.appointments_today}</div>
            <div className="stat-label">Appointments Today</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><UserCheck size={20} /></div>
          <div>
            <div className="stat-value">{headline.checked_in_now}</div>
            <div className="stat-label">Checked In Now</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red"><AlertTriangle size={20} /></div>
          <div>
            <div className="stat-value">{headline.no_shows_this_week}</div>
            <div className="stat-label">No-Shows This Week</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon yellow"><CheckCircle size={20} /></div>
          <div>
            <div className="stat-value">{headline.confirmed_upcoming}</div>
            <div className="stat-label">Confirmed Upcoming</div>
          </div>
        </div>
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
                formatter={(v, name) => [`${v}%`, 'No-Show Rate']}
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
    </div>
  )
}
