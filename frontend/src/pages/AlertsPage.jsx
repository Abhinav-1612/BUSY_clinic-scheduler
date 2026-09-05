import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import api from '../api/client'
import { Spinner, EmptyState, formatDate, formatTime } from '../components/ui'
import { Bell, BellOff, Clock, AlertCircle } from 'lucide-react'

export default function AlertsPage() {
  const qc = useQueryClient()

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['alerts'],
    queryFn: () => api.get('/api/alerts/').then(r => r.data),
    refetchInterval: 60000,
  })

  const dismissMutation = useMutation({
    mutationFn: (id) => api.patch(`/api/alerts/${id}/dismiss`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries(['alerts'])
      qc.invalidateQueries(['alerts-count'])
      toast.success('Alert dismissed')
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to dismiss'),
  })

  const alerts = data?.alerts || []
  const active = alerts.filter(a => !a.is_dismissed)
  const dismissed = alerts.filter(a => a.is_dismissed)

  return (
    <div className="page-body animated-page">
      <div className="premium-page-header">
        <div className="premium-page-icon-wrapper" style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)' }}>
          <AlertCircle size={28} />
        </div>
        <div style={{ flex: 1 }}>
          <h1 className="premium-page-title">Unconfirmed Alerts</h1>
          <p className="premium-page-subtitle">
            Appointments still in Requested status within 24 hours of their scheduled time.
            Dismissed alerts reappear automatically if still unconfirmed within 1 hour.
          </p>
        </div>
        <button className="btn btn-ghost hover-lift" onClick={() => refetch()} id="refresh-alerts-btn" style={{ height: 44, padding: '0 24px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          Refresh
        </button>
      </div>

      {isLoading ? <Spinner /> : (
        <>
          {/* Summary */}
          <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 20 }}>
            <div className="stat-card">
              <div className="stat-icon red"><Bell size={18} /></div>
              <div>
                <div className="stat-value">{data?.active_count || 0}</div>
                <div className="stat-label">Active Alerts</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon yellow"><BellOff size={18} /></div>
              <div>
                <div className="stat-value">{dismissed.length}</div>
                <div className="stat-label">Dismissed</div>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon blue"><Clock size={18} /></div>
              <div>
                <div className="stat-value">{data?.total_count || 0}</div>
                <div className="stat-label">Total (24h window)</div>
              </div>
            </div>
          </div>

          {/* Active alerts */}
      <div className="premium-card" style={{ marginBottom: 24 }}>
            <div className="card-header">
              <h3 className="card-title">Active Alerts</h3>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Click Dismiss to acknowledge. Will reappear if still unconfirmed within 1 hour.
              </span>
            </div>

            {active.length === 0 ? (
              <EmptyState icon="✅" title="No active alerts" subtitle="All upcoming appointments are confirmed" />
            ) : active.map(alert => {
              const slotDt = new Date(`${alert.slot_date}T${alert.slot_time}`)
              const hoursUntil = ((slotDt - Date.now()) / 3600000).toFixed(1)
              const isUrgent = parseFloat(hoursUntil) <= 1

              return (
                <div key={alert.id} className="alert-card" style={{ borderColor: isUrgent ? 'rgba(248,113,113,0.4)' : undefined }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      {isUrgent ? (
                        <span className="badge badge-no_show">⚡ Urgent — &lt;1 hour</span>
                      ) : (
                        <span className="badge badge-requested">Unconfirmed</span>
                      )}
                    </div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{alert.patient_name}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                      {formatDate(alert.slot_date)} at {formatTime(alert.slot_time)} · {alert.provider_name}
                    </div>
                    <div style={{ color: isUrgent ? 'var(--red)' : 'var(--text-muted)', fontSize: '0.78rem', marginTop: 2 }}>
                      {hoursUntil > 0 ? `${hoursUntil}h until appointment` : 'Appointment time has passed'}
                    </div>
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => dismissMutation.mutate(alert.id)}
                    disabled={dismissMutation.isPending}
                    id={`dismiss-alert-${alert.id}`}
                  >
                    <BellOff size={13} /> Dismiss
                  </button>
                </div>
              )
            })}
          </div>

          {/* Dismissed alerts */}
          {dismissed.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h3 className="card-title" style={{ color: 'var(--text-muted)' }}>
                  Dismissed Alerts ({dismissed.length})
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  These will reappear if still unconfirmed within 1 hour of appointment
                </span>
              </div>
              {dismissed.map(alert => (
                <div key={alert.id} className="alert-card dismissed">
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{alert.patient_name}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                      {formatDate(alert.slot_date)} at {formatTime(alert.slot_time)} · {alert.provider_name}
                    </div>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Dismissed</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
