// Shared utility components used across the app

// ── Status Badge ──────────────────────────────────────────────────────────────
export function StatusBadge({ status }) {
  const labels = {
    requested:  'Requested',
    confirmed:  'Confirmed',
    checked_in: 'Checked In',
    completed:  'Completed',
    no_show:    'No Show',
    cancelled:  'Cancelled',
  }
  return (
    <span className={`badge badge-${status}`}>
      {labels[status] || status}
    </span>
  )
}

// ── Role Badge ────────────────────────────────────────────────────────────────
export function RoleBadge({ role }) {
  return (
    <span className={`badge badge-${role}`}>
      {role === 'front_desk' ? 'Front Desk' : 'Provider'}
    </span>
  )
}

// ── Loading Spinner ───────────────────────────────────────────────────────────
export function Spinner() {
  return <div className="loading-center"><div className="spinner" /></div>
}

// ── Empty State ───────────────────────────────────────────────────────────────
export function EmptyState({ icon = '📋', title, subtitle }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <h3>{title}</h3>
      {subtitle && <p style={{ marginTop: 4, fontSize: '0.85rem' }}>{subtitle}</p>}
    </div>
  )
}

// ── Modal Wrapper ─────────────────────────────────────────────────────────────
export function Modal({ title, onClose, children, size = '' }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${size}`} role="dialog" aria-modal="true">
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="btn-icon" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Format helpers ────────────────────────────────────────────────────────────
export function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatTime(timeStr) {
  if (!timeStr) return '—'
  const [h, m] = timeStr.split(':')
  const hour = parseInt(h)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const display = hour % 12 || 12
  return `${display}:${m} ${ampm}`
}

export function formatDateTime(isoStr) {
  if (!isoStr) return '—'
  // Ensure the string is parsed as UTC (backend returns naive ISO without Z)
  const utcStr = isoStr.endsWith('Z') ? isoStr : isoStr + 'Z'
  const d = new Date(utcStr)
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  })
}

// ── History event color ───────────────────────────────────────────────────────
export function historyDotColor(eventType, newValue) {
  if (eventType === 'cancellation') return 'red'
  if (eventType === 'visit_note_added') return 'green'
  if (newValue === 'no_show') return 'red'
  if (newValue === 'confirmed') return 'blue'
  if (newValue === 'completed') return 'green'
  return ''
}

// ── Time Picker ───────────────────────────────────────────────────────────────
// value: "HH:MM" (24-hour, e.g. "14:30")
// onChange: (value: "HH:MM") => void
export function TimePicker({ value, onChange, required }) {
  // Parse current 24h value
  const [h24, m] = (value || '09:00').split(':').map(Number)
  const isPM  = h24 >= 12
  const hour12 = h24 % 12 || 12
  const minute = isNaN(m) ? 0 : m

  const HOURS   = Array.from({ length: 12 }, (_, i) => i + 1)   // 1–12
  const MINUTES = [0, 15, 30, 45]

  function emit(newHour12, newMin, newPM) {
    const h24out = newPM ? (newHour12 === 12 ? 12 : newHour12 + 12)
                         : (newHour12 === 12 ? 0  : newHour12)
    onChange(`${String(h24out).padStart(2,'0')}:${String(newMin).padStart(2,'0')}`)
  }

  const selectStyle = {
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg-card)',
    color: 'var(--text-primary)',
    fontSize: '0.95rem',
    fontWeight: 600,
    cursor: 'pointer',
    outline: 'none',
    flex: 1,
  }

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {/* Hour */}
      <select
        style={selectStyle}
        value={hour12}
        onChange={e => emit(parseInt(e.target.value), minute, isPM)}
        required={required}
      >
        {HOURS.map(h => (
          <option key={h} value={h}>{String(h).padStart(2,'0')}</option>
        ))}
      </select>

      <span style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: '1.1rem' }}>:</span>

      {/* Minute */}
      <select
        style={selectStyle}
        value={minute}
        onChange={e => emit(hour12, parseInt(e.target.value), isPM)}
      >
        {MINUTES.map(min => (
          <option key={min} value={min}>{String(min).padStart(2,'0')}</option>
        ))}
      </select>

      {/* AM / PM */}
      <select
        style={{ ...selectStyle, flex: '0 0 70px', textAlign: 'center' }}
        value={isPM ? 'PM' : 'AM'}
        onChange={e => emit(hour12, minute, e.target.value === 'PM')}
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  )
}
