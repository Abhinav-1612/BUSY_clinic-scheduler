import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import {
  StatusBadge, Spinner, EmptyState, Modal,
  formatDate, formatTime
} from '../components/ui'
import { Plus } from 'lucide-react'
import AppointmentModal from '../components/AppointmentModal'

// ── Create Appointment Modal ──────────────────────────────────────────────────
function CreateAppointmentModal({ onClose }) {
  const qc = useQueryClient()
  const [step, setStep] = useState(1)  // 1=pick slot, 2=patient details
  const [providerId, setProviderId] = useState('')
  const [slotDate, setSlotDate] = useState('')
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [form, setForm] = useState({ patient_name: '', patient_email: '', patient_phone: '' })

  const { data: providers } = useQuery({
    queryKey: ['providers'],
    queryFn: () => api.get('/api/providers/').then(r => r.data),
  })

  const { data: slots } = useQuery({
    queryKey: ['slots-available', providerId, slotDate],
    queryFn: () => api.get('/api/slots/', {
      params: { provider_id: providerId, slot_date: slotDate, include_archived: false }
    }).then(r => r.data.filter(s => !s.is_booked)),
    enabled: !!providerId && !!slotDate,
  })

  const mutation = useMutation({
    mutationFn: (body) => api.post('/api/appointments/', body).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries(['appointments'])
      qc.invalidateQueries(['slots'])
      toast.success('Appointment booked successfully!')
      onClose()
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to book appointment'),
  })

  function handleBook() {
    if (!selectedSlot) { toast.error('Please select a time slot'); return }
    if (!form.patient_name.trim()) { toast.error('Patient name is required'); return }
    if (!form.patient_email.trim()) { toast.error('Patient email is required'); return }
    mutation.mutate({ slot_id: selectedSlot.id, ...form })
  }

  // Format time nicely
  function fmt(t) {
    if (!t) return ''
    const [h, m] = t.split(':')
    const hr = parseInt(h)
    return `${hr > 12 ? hr - 12 : hr}:${m} ${hr >= 12 ? 'PM' : 'AM'}`
  }

  return (
    <Modal title="Book New Appointment" onClose={onClose} size="modal-lg">
      <div className="modal-body">

        {/* Step 1 — Choose slot */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14, fontSize: '0.9rem' }}>
            Step 1: Select an available slot
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Provider</label>
              <select className="form-control" value={providerId}
                onChange={e => { setProviderId(e.target.value); setSelectedSlot(null) }} required>
                <option value="">Select a doctor…</option>
                {providers?.map(p => <option key={p.id} value={p.id}>{p.display_name}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Date</label>
              <input type="date" className="form-control" value={slotDate}
                onChange={e => { setSlotDate(e.target.value); setSelectedSlot(null) }}
                min={(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })()} />
            </div>
          </div>

          {providerId && slotDate && (
            slots?.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No available slots for this doctor on this date.
              </p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {slots?.map(s => (
                  <button
                    key={s.id}
                    className={`btn btn-sm ${selectedSlot?.id === s.id ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setSelectedSlot(s)}
                    type="button"
                  >
                    {fmt(s.start_time)} ({s.duration_minutes} min)
                  </button>
                ))}
              </div>
            )
          )}
        </div>

        <hr className="divider" />

        {/* Step 2 — Patient details */}
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 14, fontSize: '0.9rem' }}>
            Step 2: Patient details
          </div>
          <div className="form-group">
            <label className="form-label">Full Name *</label>
            <input className="form-control" placeholder="e.g. John Smith"
              value={form.patient_name} onChange={e => setForm(f => ({ ...f, patient_name: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Email *</label>
              <input type="email" className="form-control" placeholder="patient@example.com"
                value={form.patient_email} onChange={e => setForm(f => ({ ...f, patient_email: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Phone (optional)</label>
              <input className="form-control" placeholder="555-0100"
                value={form.patient_phone} onChange={e => setForm(f => ({ ...f, patient_phone: e.target.value }))} />
            </div>
          </div>
        </div>

        {/* Summary */}
        {selectedSlot && (
          <div style={{ background: 'var(--bg-base)', border: '1px solid var(--accent)', borderRadius: 8, padding: 12, marginTop: 4 }}>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 2 }}>Booking summary</div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {providers?.find(p => p.id === parseInt(providerId))?.display_name} · {slotDate} at {fmt(selectedSlot.start_time)} ({selectedSlot.duration_minutes} min)
            </div>
          </div>
        )}
      </div>

      <div className="modal-footer">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button
          className="btn btn-primary"
          onClick={handleBook}
          disabled={mutation.isPending || !selectedSlot}
          id="book-appointment-submit"
        >
          {mutation.isPending ? 'Booking…' : 'Book Appointment'}
        </button>
      </div>
    </Modal>
  )
}

// ── Appointments Page ─────────────────────────────────────────────────────────
export default function AppointmentsPage() {
  const { isFrontDesk } = useAuth()
  const [selectedId, setSelectedId] = useState(null)
  const [showCreate, setShowCreate] = useState(false)

  // Filters
  const [patientName, setPatientName] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterProvider, setFilterProvider] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [sortBy, setSortBy] = useState('date')
  const [sortOrder, setSortOrder] = useState('asc')
  const [page, setPage] = useState(1)

  // Server-side filtered query
  const params = {
    page,
    page_size: 20,
    sort_by: sortBy,
    sort_order: sortOrder,
    ...(patientName && { patient_name: patientName }),
    ...(filterStatus && { status: filterStatus }),
    ...(filterProvider && { provider_id: filterProvider }),
    ...(dateFrom && { date_from: dateFrom }),
    ...(dateTo && { date_to: dateTo }),
  }

  const { data, isLoading } = useQuery({
    queryKey: ['appointments', params],
    queryFn: () => api.get('/api/appointments/', { params }).then(r => r.data),
    keepPreviousData: true,
  })

  const { data: providers } = useQuery({
    queryKey: ['providers'],
    queryFn: () => api.get('/api/providers/').then(r => r.data),
    enabled: isFrontDesk,
  })

  function handleSort(col) {
    if (sortBy === col) {
      setSortOrder(o => o === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(col)
      setSortOrder('asc')
    }
    setPage(1)
  }

  function clearFilters() {
    setPatientName(''); setFilterStatus(''); setFilterProvider('')
    setDateFrom(''); setDateTo(''); setPage(1)
  }

  const appointments = data?.data || []
  const total = data?.total || 0
  const totalPages = data?.total_pages || 1

  return (
    <div className="page-body">
      <div className="page-header">
        <div>
          <h1 className="page-title">Appointments</h1>
          <p className="page-subtitle">
            {total} appointment{total !== 1 ? 's' : ''} found
          </p>
        </div>
        {isFrontDesk && (
          <button className="btn btn-primary" onClick={() => setShowCreate(true)} id="new-appointment-btn">
            <Plus size={15} /> New Appointment
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: 16 }}>
        <div className="filter-bar">
          <div className="search-box" style={{ flex: 2 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              placeholder="Search patient name…"
              value={patientName}
              onChange={e => { setPatientName(e.target.value); setPage(1) }}
            />
          </div>

          <select className="form-control" style={{ width: 140 }} value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }}>
            <option value="">All statuses</option>
            {['requested', 'confirmed', 'checked_in', 'completed', 'no_show', 'cancelled'].map(s => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </select>

          {isFrontDesk && (
            <select className="form-control" style={{ width: 160 }} value={filterProvider} onChange={e => { setFilterProvider(e.target.value); setPage(1) }}>
              <option value="">All providers</option>
              {providers?.map(p => <option key={p.id} value={p.id}>{p.display_name}</option>)}
            </select>
          )}

          <input type="date" className="form-control" style={{ width: 140 }} value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1) }} placeholder="From" />
          <input type="date" className="form-control" style={{ width: 140 }} value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1) }} placeholder="To" />

          <button className="btn btn-ghost btn-sm" onClick={clearFilters}>Clear</button>
        </div>
      </div>

      {/* Table */}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th className="sortable" onClick={() => handleSort('date')}>
                Date / Time {sortBy === 'date' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th>Patient</th>
              <th className="sortable" onClick={() => handleSort('provider')}>
                Provider {sortBy === 'provider' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th className="sortable" onClick={() => handleSort('status')}>
                Status {sortBy === 'status' ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
              </th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: 'auto' }} /></td></tr>
            ) : appointments.length === 0 ? (
              <tr><td colSpan={5}><div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>No appointments match your filters</div></td></tr>
            ) : appointments.map(a => (
              <tr key={a.id} onClick={() => setSelectedId(a.id)}>
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
                <td>{a.slot?.provider_name || '—'}</td>
                <td><StatusBadge status={a.status} /></td>
                <td style={{ color: 'var(--text-muted)' }}>{a.slot?.duration_minutes} min</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <span>Showing {((page - 1) * 20) + 1}–{Math.min(page * 20, total)} of {total}</span>
            <div className="pagination-controls">
              <button className="pagination-btn" onClick={() => setPage(p => p - 1)} disabled={page === 1}>← Prev</button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = i + 1
                return (
                  <button key={p} className={`pagination-btn ${page === p ? 'active' : ''}`} onClick={() => setPage(p)}>
                    {p}
                  </button>
                )
              })}
              <button className="pagination-btn" onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>Next →</button>
            </div>
          </div>
        )}
      </div>

      {/* Appointment Detail Modal */}
      {selectedId && <AppointmentModal appointmentId={selectedId} onClose={() => setSelectedId(null)} />}

      {/* Create Appointment Modal */}
      {showCreate && <CreateAppointmentModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}
