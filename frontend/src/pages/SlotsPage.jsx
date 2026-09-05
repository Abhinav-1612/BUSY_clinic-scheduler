import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import api from '../api/client'
import { useAuth } from '../context/AuthContext'
import { Spinner, EmptyState, Modal, StatusBadge, formatDate, formatTime } from '../components/ui'
import { Plus, Archive, RotateCcw, Clock, Download } from 'lucide-react'

function CreateSlotModal({ onClose }) {
  const qc = useQueryClient()
  const { data: providers } = useQuery({
    queryKey: ['providers'],
    queryFn: () => api.get('/api/providers/').then(r => r.data),
  })
  const [form, setForm] = useState({ provider_id: '', slot_date: '', start_time: '', duration_minutes: 30 })

  const mutation = useMutation({
    mutationFn: (body) => api.post('/api/slots/', body).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries(['slots'])
      qc.invalidateQueries(['dashboard'])  // instant dashboard refresh
      toast.success('Slot created')
      onClose()
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to create slot'),
  })

  function handleSubmit(e) {
    e.preventDefault()
    mutation.mutate({ ...form, provider_id: parseInt(form.provider_id), duration_minutes: parseInt(form.duration_minutes) })
  }

  return (
    <Modal title="Create Availability Slot" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div className="modal-body">
          <div className="form-group">
            <label className="form-label">Provider</label>
            <select className="form-control" value={form.provider_id} onChange={e => setForm(f => ({ ...f, provider_id: e.target.value }))} required>
              <option value="">Select provider…</option>
              {providers?.map(p => <option key={p.id} value={p.id}>{p.display_name}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Date</label>
              <input type="date" className="form-control" value={form.slot_date} onChange={e => setForm(f => ({ ...f, slot_date: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label className="form-label">Start Time</label>
              <input type="time" className="form-control" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} required />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Duration (minutes)</label>
            <select className="form-control" value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))}>
              {[15, 30, 45, 60, 90].map(d => <option key={d} value={d}>{d} min</option>)}
            </select>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" type="button" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Creating…' : 'Create Slot'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default function SlotsPage() {
  const { isFrontDesk } = useAuth()
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [filterDate, setFilterDate] = useState('')
  const [filterProvider, setFilterProvider] = useState('')
  const [showArchived, setShowArchived] = useState(false)

  const { data: providers } = useQuery({
    queryKey: ['providers'],
    queryFn: () => api.get('/api/providers/').then(r => r.data),
    enabled: isFrontDesk,
  })

  const { data: slots, isLoading } = useQuery({
    queryKey: ['slots', filterDate, filterProvider, showArchived],
    queryFn: () => api.get('/api/slots/', {
      params: {
        ...(filterDate && { slot_date: filterDate }),
        ...(filterProvider && { provider_id: filterProvider }),
        include_archived: showArchived,
      }
    }).then(r => r.data),
  })

  const archiveMutation = useMutation({
    mutationFn: (id) => api.patch(`/api/slots/${id}/archive`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries(['slots']); toast.success('Slot archived') },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to archive'),
  })

  const restoreMutation = useMutation({
    mutationFn: (id) => api.patch(`/api/slots/${id}/restore`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries(['slots']); toast.success('Slot restored') },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to restore'),
  })

  // CSV Export
  function handleExport() {
    if (!filterDate) { toast.error('Select a date to export'); return }
    const params = new URLSearchParams({ export_date: filterDate })
    if (filterProvider) params.append('provider_id', filterProvider)
    window.open(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/appointments/export/day-csv?${params}&token=${localStorage.getItem('token')}`, '_blank')
  }

  return (
    <div className="page-body animated-page">
      <div className="premium-page-header">
        <div className="premium-page-icon-wrapper" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)' }}>
          <Clock size={28} />
        </div>
        <div style={{ flex: 1 }}>
          <h1 className="premium-page-title">Availability Slots</h1>
          <p className="premium-page-subtitle">{slots?.length || 0} slots</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-ghost hover-lift" onClick={handleExport} id="export-csv-btn" style={{ height: 44, padding: '0 20px', background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <Download size={16} style={{ marginRight: 6 }} /> Export CSV
          </button>
          {isFrontDesk && (
            <button className="btn btn-primary hover-lift" onClick={() => setShowCreate(true)} id="create-slot-btn" style={{ height: 44, padding: '0 24px' }}>
              <Plus size={18} style={{ marginRight: 6 }} /> New Slot
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="premium-card" style={{ padding: '16px 20px', marginBottom: 24 }}>
        <div className="filter-bar">
          <input type="date" className="form-control" style={{ width: 160 }} value={filterDate} onChange={e => setFilterDate(e.target.value)} />
          {isFrontDesk && (
            <select className="form-control" style={{ width: 180 }} value={filterProvider} onChange={e => setFilterProvider(e.target.value)}>
              <option value="">All providers</option>
              {providers?.map(p => <option key={p.id} value={p.id}>{p.display_name}</option>)}
            </select>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />
            Show archived
          </label>
        </div>
      </div>

      {isLoading ? <Spinner /> : (
        <div className="premium-card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Provider</th>
                <th>Duration</th>
                <th>Status</th>
                {isFrontDesk && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {slots?.length === 0 && (
                <tr><td colSpan={6}><EmptyState title="No slots found" subtitle="Create one or adjust your filters" /></td></tr>
              )}
              {slots?.map(slot => (
                <tr key={slot.id} style={{ opacity: slot.is_archived ? 0.5 : 1 }}>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{formatDate(slot.slot_date)}</td>
                  <td>{formatTime(slot.start_time)}</td>
                  <td>{slot.provider_id}</td>
                  <td>{slot.duration_minutes} min</td>
                  <td>
                    {slot.is_archived
                      ? <span className="badge badge-cancelled">Archived</span>
                      : slot.is_booked
                        ? <span className="badge badge-confirmed">Booked</span>
                        : <span className="badge badge-completed">Available</span>
                    }
                  </td>
                  {isFrontDesk && (
                    <td>
                      {!slot.is_booked && !slot.is_archived && (
                        <button className="btn-icon" title="Archive" onClick={() => archiveMutation.mutate(slot.id)}>
                          <Archive size={13} />
                        </button>
                      )}
                      {slot.is_archived && (
                        <button className="btn-icon" title="Restore" onClick={() => restoreMutation.mutate(slot.id)}>
                          <RotateCcw size={13} />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <CreateSlotModal onClose={() => setShowCreate(false)} />}
    </div>
  )
}
