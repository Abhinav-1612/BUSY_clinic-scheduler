import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../api/client'
import { Spinner, EmptyState, formatTime } from '../components/ui'
import { Users, X, Mail, Clock, CalendarCheck, CalendarX, ChevronRight, Activity } from 'lucide-react'

// ── Specialty color map ───────────────────────────────────────────────────────
const SPECIALTY_COLORS = {
  'Physical Therapy':  { bg: 'rgba(59,130,246,0.12)',  color: '#3b82f6'  },
  'Dental':            { bg: 'rgba(16,185,129,0.12)',  color: '#10b981'  },
  'Cardiology':        { bg: 'rgba(239,68,68,0.12)',   color: '#ef4444'  },
  'Orthopedics':       { bg: 'rgba(245,158,11,0.12)',  color: '#f59e0b'  },
  'General Medicine':  { bg: 'rgba(107,114,128,0.12)', color: '#6b7280'  },
  'Dermatology':       { bg: 'rgba(236,72,153,0.12)',  color: '#ec4899'  },
  'Pediatrics':        { bg: 'rgba(139,92,246,0.12)',  color: '#8b5cf6'  },
  'Neurology':         { bg: 'rgba(20,184,166,0.12)',  color: '#14b8a6'  },
  'Sports Medicine':   { bg: 'rgba(249,115,22,0.12)', color: '#f97316'  },
  'Oncology':          { bg: 'rgba(220,38,38,0.12)',  color: '#dc2626'  },
}
function specialtyStyle(s) { return SPECIALTY_COLORS[s] || { bg: 'rgba(99,102,241,0.12)', color: '#6366f1' } }
function getInitials(name) {
  return name.split(' ').filter(Boolean).slice(-2).map(w => w[0]).join('').toUpperCase()
}

// ── Provider Detail Drawer ─────────────────────────────────────────────────────
function ProviderDrawer({ provider, onClose }) {
  const { data: detail, isLoading } = useQuery({
    queryKey: ['provider-detail', provider.id],
    queryFn: () => api.get(`/api/providers/${provider.id}/detail`).then(r => r.data),
  })
  const sColor = specialtyStyle(provider.specialty)

  return (
    <>
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
        zIndex: 200, backdropFilter: 'blur(2px)', animation: 'fadeIn 0.2s ease',
      }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 480,
        background: 'var(--bg-card)', borderLeft: '1px solid var(--border)',
        zIndex: 201, overflowY: 'auto', boxShadow: '-8px 0 32px rgba(0,0,0,0.15)',
      }}>
        {/* Drawer Header */}
        <div style={{
          padding: '24px 24px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'flex-start', gap: 16,
          background: 'var(--bg-sidebar)', position: 'sticky', top: 0, zIndex: 1,
        }}>
          <div style={{
            width: 60, height: 60, borderRadius: 16, flexShrink: 0,
            background: `linear-gradient(135deg, ${sColor.color}cc, ${sColor.color})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 700, fontSize: '1.3rem',
            boxShadow: `0 4px 14px ${sColor.color}44`,
          }}>
            {getInitials(provider.display_name)}
          </div>
          <div style={{ flex: 1 }}>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {provider.display_name}
            </h2>
            <span style={{
              display: 'inline-block', marginTop: 6, padding: '3px 12px',
              borderRadius: 20, fontSize: '0.78rem', fontWeight: 600,
              background: sColor.bg, color: sColor.color,
            }}>{provider.specialty}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
              <Mail size={13} /><span>{provider.email}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        {isLoading ? (
          <div style={{ padding: 40 }}><Spinner /></div>
        ) : (
          <div style={{ padding: '20px 24px 32px' }}>
            {/* Stats row */}
            <h4 style={{ margin: '0 0 12px', color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              {detail?.is_weekend_fallback
                ? `Next Working Day — ${new Date(detail.schedule_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`
                : "Today's Overview"}
            </h4>
            {detail?.is_weekend_fallback && (
              <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 10, padding: '10px 14px', marginBottom: 12, fontSize: '0.8rem', color: '#f59e0b', fontWeight: 500 }}>
                📅 Today is a weekend — showing next available working day
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
              {[
                { label: 'Total Slots', value: detail?.today_total_slots ?? '—', icon: <Clock size={15}/>, color: '#3b82f6' },
                { label: 'Booked',      value: detail?.today_booked_slots ?? '—', icon: <CalendarCheck size={15}/>, color: '#10b981' },
                { label: 'Free Ahead',  value: detail?.today_free_slots ?? '—', icon: <CalendarX size={15}/>, color: '#f59e0b' },
              ].map(stat => (
                <div key={stat.label} style={{
                  background: 'var(--bg-sidebar)', borderRadius: 12, padding: 14,
                  border: '1px solid var(--border)', textAlign: 'center',
                }}>
                  <div style={{ color: stat.color, marginBottom: 4 }}>{stat.icon}</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{stat.value}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Upcoming 7 days */}
            <div style={{
              background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.18)',
              borderRadius: 12, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24,
            }}>
              <Activity size={18} style={{ color: '#6366f1', flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '1.05rem' }}>
                  {detail?.upcoming_7day_count ?? '—'} appointments
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>scheduled in the next 7 days</div>
              </div>
            </div>

            {/* Today's timeline */}
            <h4 style={{ margin: '0 0 12px', color: 'var(--text-secondary)', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Today's Schedule
            </h4>
            {!detail?.today_schedule?.length ? (
              <EmptyState icon="🗓️" title="No slots today" subtitle="No slots scheduled for this provider today" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {detail.today_schedule.map((slot, i) => {
                  const appt = detail.today_appointments?.find(a => a.start_time === slot.start_time)
                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                      borderRadius: 10,
                      background: slot.is_booked ? 'var(--bg-sidebar)' : 'transparent',
                      border: `1px solid ${slot.is_booked ? 'var(--border)' : 'transparent'}`,
                      opacity: !slot.is_future ? 0.45 : 1,
                    }}>
                      <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-secondary)', width: 60, flexShrink: 0 }}>
                        {formatTime(slot.start_time)}
                      </div>
                      <div style={{
                        width: 9, height: 9, borderRadius: '50%', flexShrink: 0,
                        background: slot.is_booked
                          ? (appt?.status === 'checked_in' ? '#10b981' : '#3b82f6')
                          : '#d1d5db',
                      }} />
                      <div style={{ flex: 1 }}>
                        {appt ? (
                          <>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.88rem' }}>{appt.patient_name}</div>
                            <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>{appt.patient_email}</div>
                          </>
                        ) : (
                          <div style={{ color: 'var(--text-muted)', fontSize: '0.83rem' }}>— Free —</div>
                        )}
                      </div>
                      {appt && (
                        <span style={{
                          fontSize: '0.68rem', padding: '2px 8px', borderRadius: 20, fontWeight: 600,
                          background: appt.status === 'checked_in' ? 'rgba(16,185,129,0.15)' :
                                      appt.status === 'confirmed'  ? 'rgba(59,130,246,0.15)'  :
                                                                     'rgba(245,158,11,0.15)',
                          color: appt.status === 'checked_in' ? '#10b981' :
                                 appt.status === 'confirmed'  ? '#3b82f6'  : '#f59e0b',
                        }}>
                          {appt.status.replace('_', ' ')}
                        </span>
                      )}
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', flexShrink: 0 }}>{slot.duration_minutes}m</div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

// ── Main Providers Page ────────────────────────────────────────────────────────
export default function ProvidersPage() {
  const [selectedProvider, setSelectedProvider] = useState(null)

  const { data: providers, isLoading, error } = useQuery({
    queryKey: ['providers'],
    queryFn: () => api.get('/api/providers/').then(res => res.data),
  })

  if (isLoading) return <Spinner />
  if (error) return <div>Error loading providers.</div>
  if (!providers?.length) return <EmptyState title="No providers found" />

  return (
    <div className="page-body animated-page">
      <div className="premium-page-header">
        <div className="premium-page-icon-wrapper" style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', boxShadow: '0 4px 14px rgba(99,102,241,0.4)' }}>
          <Users size={28} />
        </div>
        <div>
          <h1 className="premium-page-title">Care Team</h1>
          <p className="premium-page-subtitle">{providers.length} providers · click a card to view their schedule</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
        {providers.map(p => {
          const sColor = specialtyStyle(p.specialty)
          return (
            <div
              key={p.id}
              onClick={() => setSelectedProvider(p)}
              className="hover-lift"
              style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 16, padding: '20px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 16,
                transition: 'all 0.2s ease',
              }}
            >
              <div style={{
                width: 52, height: 52, borderRadius: 14, flexShrink: 0,
                background: `linear-gradient(135deg, ${sColor.color}bb, ${sColor.color})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 700, fontSize: '1.1rem',
                boxShadow: `0 4px 10px ${sColor.color}44`,
              }}>
                {getInitials(p.display_name)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {p.display_name}
                </div>
                <span style={{
                  display: 'inline-block', marginTop: 5, padding: '2px 10px',
                  borderRadius: 20, fontSize: '0.72rem', fontWeight: 600,
                  background: sColor.bg, color: sColor.color,
                }}>{p.specialty}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 6, color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                  <Mail size={11} />
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.email}</span>
                </div>
              </div>
              <ChevronRight size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            </div>
          )
        })}
      </div>

      {selectedProvider && (
        <ProviderDrawer provider={selectedProvider} onClose={() => setSelectedProvider(null)} />
      )}
    </div>
  )
}

