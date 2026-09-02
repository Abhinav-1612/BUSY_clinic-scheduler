import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import {
  Spinner, Modal, StatusBadge,
  formatDate, formatTime, formatDateTime, historyDotColor
} from './ui'
import { Plus, X, RefreshCw, FileText, UserPlus } from 'lucide-react'

const NEXT_STATUSES = {
  requested:  ['confirmed', 'cancelled'],
  confirmed:  ['checked_in', 'no_show', 'cancelled'],
  checked_in: ['completed'],
  completed:  [],
  no_show:    [],
  cancelled:  [],
}

const STATUS_LABELS = {
  confirmed:  'Confirm',
  checked_in: 'Check In',
  completed:  'Complete',
  no_show:    'No Show',
  cancelled:  'Cancel',
}

export default function AppointmentModal({ appointmentId, onClose }) {
  const { isFrontDesk, user } = useAuth()
  const qc = useQueryClient()
  const [cancelReason, setCancelReason] = useState('')
  const [showCancelInput, setShowCancelInput] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [showNoteForm, setShowNoteForm] = useState(false)
  const [reassignPid, setReassignPid] = useState('')
  const [showReassign, setShowReassign] = useState(false)
  const [supportPid, setSupportPid] = useState('')

  const { data: appt, isLoading } = useQuery({
    queryKey: ['appointment', appointmentId],
    queryFn: () => api.get(`/api/appointments/${appointmentId}`).then(r => r.data),
  })

  const { data: history } = useQuery({
    queryKey: ['appointment-history', appointmentId],
    queryFn: () => api.get(`/api/appointments/${appointmentId}/history`).then(r => r.data),
  })

  const { data: notes } = useQuery({
    queryKey: ['appointment-notes', appointmentId],
    queryFn: () => api.get(`/api/notes/appointment/${appointmentId}`).then(r => r.data),
  })

  const { data: providers } = useQuery({
    queryKey: ['providers'],
    queryFn: () => api.get('/api/providers/').then(r => r.data),
    enabled: isFrontDesk,
  })

  const statusMutation = useMutation({
    mutationFn: (body) => api.patch(`/api/appointments/${appointmentId}/status`, body).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries(['appointment', appointmentId])
      qc.invalidateQueries(['appointment-history', appointmentId])
      qc.invalidateQueries(['appointments'])
      qc.invalidateQueries(['stat-detail'])
      qc.invalidateQueries(['dashboard'])
      toast.success('Status updated')
      setShowCancelInput(false)
      setCancelReason('')
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to update status'),
  })

  const noteMutation = useMutation({
    mutationFn: (content) => api.post('/api/notes/', { appointment_id: appointmentId, content }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries(['appointment-notes', appointmentId])
      qc.invalidateQueries(['appointment-history', appointmentId])
      toast.success('Note added')
      setNoteText('')
      setShowNoteForm(false)
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to add note'),
  })

  const reassignMutation = useMutation({
    mutationFn: (pid) => api.patch(`/api/appointments/${appointmentId}/reassign`, { new_provider_id: parseInt(pid) }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries(['appointment', appointmentId])
      qc.invalidateQueries(['appointment-history', appointmentId])
      qc.invalidateQueries(['stat-detail'])
      toast.success('Appointment reassigned')
      setShowReassign(false)
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to reassign'),
  })

  const addSupportMutation = useMutation({
    mutationFn: (pid) => api.post(`/api/appointments/${appointmentId}/care-team/${pid}`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries(['appointment', appointmentId])
      qc.invalidateQueries(['appointment-history', appointmentId])
      toast.success('Supporting provider added')
      setSupportPid('')
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to add provider'),
  })

  const removeSupportMutation = useMutation({
    mutationFn: (pid) => api.delete(`/api/appointments/${appointmentId}/care-team/${pid}`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries(['appointment', appointmentId])
      qc.invalidateQueries(['appointment-history', appointmentId])
      toast.success('Supporting provider removed')
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to remove provider'),
  })

  function handleStatusClick(newStatus) {
    if (newStatus === 'cancelled') { setShowCancelInput(true); return }
    statusMutation.mutate({ status: newStatus })
  }

  function handleCancelSubmit() {
    if (!cancelReason.trim()) { toast.error('Cancellation reason is required'); return }
    statusMutation.mutate({ status: 'cancelled', cancel_reason: cancelReason })
  }

  if (isLoading) return (
    <Modal title="Appointment Detail" onClose={onClose} size="modal-lg">
      <div className="modal-body"><Spinner /></div>
    </Modal>
  )

  if (!appt) return null

  const nextStatuses = NEXT_STATUSES[appt.status] || []
  const schedulingProvider = appt.care_team?.find(m => m.role === 'scheduling')
  const supportingProviders = appt.care_team?.filter(m => m.role === 'supporting') || []
  const availableToAdd = providers?.filter(p =>
    !appt.care_team?.some(m => m.provider_id === p.id)
  ) || []

  return (
    <Modal title="Appointment Detail" onClose={onClose} size="modal-lg">
      <div className="modal-body">
        {/* Patient & Slot Info */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          <div>
            <div className="form-label">Patient</div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '1rem' }}>{appt.patient_name}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{appt.patient_email}</div>
            {appt.patient_phone && <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{appt.patient_phone}</div>}
          </div>
          <div>
            <div className="form-label">Appointment</div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {formatDate(appt.slot?.date)} at {formatTime(appt.slot?.start_time)}
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              {appt.slot?.duration_minutes} min · {appt.slot?.provider_name}
            </div>
          </div>
        </div>

        {/* Status + Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          <StatusBadge status={appt.status} />
          {appt.cancel_reason && (
            <span style={{ fontSize: '0.78rem', color: 'var(--red)' }}>
              Reason: {appt.cancel_reason}
            </span>
          )}
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {nextStatuses.map(s => (
              <button
                key={s}
                className={`btn btn-sm ${s === 'cancelled' ? 'btn-danger' : 'btn-primary'}`}
                onClick={() => handleStatusClick(s)}
                disabled={statusMutation.isPending}
                id={`status-btn-${s}`}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
            {isFrontDesk && appt.status !== 'cancelled' && appt.status !== 'completed' && (
              <button className="btn btn-ghost btn-sm" onClick={() => setShowReassign(!showReassign)}>
                <RefreshCw size={12} /> Reassign
              </button>
            )}
          </div>
        </div>

        {/* Cancel reason input */}
        {showCancelInput && (
          <div style={{ background: 'var(--red-light)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, padding: 14, marginBottom: 16 }}>
            <div className="form-label" style={{ color: 'var(--red)' }}>Cancellation Reason (required)</div>
            <textarea
              className="form-control"
              placeholder="Why is this appointment being cancelled?"
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              rows={2}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="btn btn-danger btn-sm" onClick={handleCancelSubmit} disabled={statusMutation.isPending}>
                Confirm Cancel
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCancelInput(false)}>Dismiss</button>
            </div>
          </div>
        )}

        {/* Reassign */}
        {showReassign && isFrontDesk && (
          <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 8, padding: 14, marginBottom: 16 }}>
            <div className="form-label">Reassign to Provider</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <select className="form-control" value={reassignPid} onChange={e => setReassignPid(e.target.value)}>
                <option value="">Select provider…</option>
                {providers?.map(p => <option key={p.id} value={p.id}>{p.display_name}</option>)}
              </select>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => reassignPid && reassignMutation.mutate(reassignPid)}
                disabled={!reassignPid || reassignMutation.isPending}
              >
                Reassign
              </button>
            </div>
          </div>
        )}

        {/* Care Team */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div className="form-label" style={{ marginBottom: 0 }}>Care Team</div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {schedulingProvider && (
              <span className="badge badge-confirmed">
                👨‍⚕️ {schedulingProvider.provider_name} (Scheduling)
              </span>
            )}
            {supportingProviders.map(m => (
              <span key={m.provider_id} className="badge badge-provider" style={{ alignItems: 'center', gap: 6 }}>
                {m.provider_name}
                {isFrontDesk && (
                  <button
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0, lineHeight: 1, marginLeft: 2 }}
                    onClick={() => removeSupportMutation.mutate(m.provider_id)}
                  >
                    <X size={10} />
                  </button>
                )}
              </span>
            ))}
          </div>
          {isFrontDesk && availableToAdd.length > 0 && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <select className="form-control" value={supportPid} onChange={e => setSupportPid(e.target.value)} style={{ maxWidth: 200 }}>
                <option value="">Add supporting provider…</option>
                {availableToAdd.map(p => <option key={p.id} value={p.id}>{p.display_name}</option>)}
              </select>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => supportPid && addSupportMutation.mutate(parseInt(supportPid))}
                disabled={!supportPid}
              >
                <UserPlus size={13} /> Add
              </button>
            </div>
          )}
        </div>

        <hr className="divider" />

        {/* Visit Notes */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h4><FileText size={14} style={{ marginRight: 6 }} />Visit Notes</h4>
            {user?.role === 'provider' && (
              <button className="btn btn-ghost btn-sm" onClick={() => setShowNoteForm(!showNoteForm)}>
                <Plus size={13} /> Add Note
              </button>
            )}
          </div>
          {showNoteForm && (
            <div style={{ marginBottom: 12 }}>
              <textarea
                className="form-control"
                placeholder="Enter visit observations…"
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                rows={3}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => noteText.trim() && noteMutation.mutate(noteText)}
                  disabled={noteMutation.isPending || !noteText.trim()}
                >
                  Save Note
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowNoteForm(false)}>Cancel</button>
              </div>
            </div>
          )}
          {notes?.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No visit notes yet.</p>
          )}
          {notes?.map(note => (
            <div key={note.id} className="note-card">
              <div className="note-meta">
                <span className="note-author">{note.provider_name}</span>
                <span className="note-time">{formatDateTime(note.created_at)}</span>
              </div>
              <div className="note-content">{note.content}</div>
            </div>
          ))}
        </div>

        <hr className="divider" />

        {/* Immutable History Timeline */}
        <div>
          <h4 style={{ marginBottom: 14 }}>Activity Timeline</h4>
          <div className="timeline">
            {history?.map(h => (
              <div key={h.id} className="timeline-item">
                <div className={`timeline-dot ${historyDotColor(h.event_type, h.new_value)}`} />
                <div className="timeline-time">{formatDateTime(h.created_at)}</div>
                <div className="timeline-desc">
                  {h.description || `${h.event_type.replace(/_/g, ' ')}: ${h.old_value || '—'} → ${h.new_value || '—'}`}
                </div>
                <div className="timeline-author">by {h.changed_by} ({h.changed_by_role})</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}
