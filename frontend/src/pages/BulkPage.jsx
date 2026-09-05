import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'react-hot-toast'
import api from '../api/client'
import { Spinner, EmptyState, formatDate, formatTime } from '../components/ui'
import { Zap, CheckCircle, AlertCircle, Layers } from 'lucide-react'

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']

export default function BulkPage() {
  const { data: providers } = useQuery({
    queryKey: ['providers'],
    queryFn: () => api.get('/api/providers/').then(r => r.data),
  })

  const [providerId, setProviderId] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [blocks, setBlocks] = useState([
    { day_of_week: 0, start_time: '09:00', duration_minutes: 30 },
  ])
  const [result, setResult] = useState(null)

  const mutation = useMutation({
    mutationFn: (body) => api.post('/api/bulk/generate-slots', body).then(r => r.data),
    onSuccess: (data) => {
      setResult(data)
      toast.success(`Created ${data.summary.created_count} slots, skipped ${data.summary.skipped_count}`)
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Generation failed'),
  })

  function addBlock() {
    setBlocks(b => [...b, { day_of_week: 0, start_time: '09:00', duration_minutes: 30 }])
  }

  function removeBlock(i) {
    setBlocks(b => b.filter((_, idx) => idx !== i))
  }

  function updateBlock(i, field, val) {
    setBlocks(b => b.map((block, idx) => idx === i ? { ...block, [field]: val } : block))
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!providerId) { toast.error('Select a provider'); return }
    setResult(null)
    mutation.mutate({
      provider_id: parseInt(providerId),
      date_from: dateFrom,
      date_to: dateTo,
      weekly_blocks: blocks.map(b => ({ ...b, day_of_week: parseInt(b.day_of_week), duration_minutes: parseInt(b.duration_minutes) })),
    })
  }

  return (
    <div className="page-body animated-page">
      <div className="premium-page-header">
        <div className="premium-page-icon-wrapper" style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', boxShadow: '0 4px 14px rgba(139, 92, 246, 0.4)' }}>
          <Layers size={28} />
        </div>
        <div>
          <h1 className="premium-page-title">Bulk Slot Generator</h1>
          <p className="premium-page-subtitle">Generate recurring weekly availability slots across a date range</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
        {/* Form */}
        <form onSubmit={handleSubmit} className="premium-card">
          <h3 style={{ marginBottom: 18, color: 'var(--text-primary)' }}>Configure Pattern</h3>

          <div className="form-group">
            <label className="form-label">Provider</label>
            <select className="form-control" value={providerId} onChange={e => setProviderId(e.target.value)} required>
              <option value="">Select provider…</option>
              {providers?.map(p => <option key={p.id} value={p.id}>{p.display_name}</option>)}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">From Date</label>
              <input type="date" className="form-control" value={dateFrom} onChange={e => setDateFrom(e.target.value)} required />
            </div>
            <div className="form-group">
              <label className="form-label">To Date</label>
              <input type="date" className="form-control" value={dateTo} onChange={e => setDateTo(e.target.value)} required />
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <label className="form-label" style={{ margin: 0 }}>Weekly Time Blocks</label>
              <button type="button" className="btn btn-ghost btn-sm" onClick={addBlock}>+ Add Block</button>
            </div>

            {blocks.map((block, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px 32px', gap: 8, marginBottom: 8 }}>
                <select
                  className="form-control"
                  value={block.day_of_week}
                  onChange={e => updateBlock(i, 'day_of_week', e.target.value)}
                >
                  {DAYS.map((d, idx) => <option key={idx} value={idx}>{d}</option>)}
                </select>
                <input
                  type="time"
                  className="form-control"
                  value={block.start_time}
                  onChange={e => updateBlock(i, 'start_time', e.target.value)}
                />
                <select
                  className="form-control"
                  value={block.duration_minutes}
                  onChange={e => updateBlock(i, 'duration_minutes', e.target.value)}
                >
                  {[15, 30, 45, 60].map(d => <option key={d} value={d}>{d}m</option>)}
                </select>
                <button
                  type="button"
                  className="btn-icon"
                  onClick={() => removeBlock(i)}
                  disabled={blocks.length === 1}
                  style={{ height: 36 }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <button type="submit" className="btn btn-primary w-full hover-lift" disabled={mutation.isPending} style={{ height: 44, fontSize: '1rem' }}>
            <Zap size={16} style={{ marginRight: 6 }} /> 
            {mutation.isPending ? 'Generating…' : 'Generate Slots'}
          </button>
        </form>

        {/* Results */}
        <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', minHeight: 400 }}>
          {!result && !mutation.isPending && (
            <div className="card">
              <EmptyState
                icon="🗓️"
                title="No results yet"
                subtitle="Configure a pattern and click Generate to see results"
              />
            </div>
          )}
          {mutation.isPending && <div className="card"><Spinner /></div>}

          {result && (
            <div>
              {/* Summary */}
              <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 16 }}>
                <div className="stat-card">
                  <div className="stat-icon blue"><Zap size={18} /></div>
                  <div>
                    <div className="stat-value">{result.summary.total_attempted}</div>
                    <div className="stat-label">Total Attempted</div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon green"><CheckCircle size={18} /></div>
                  <div>
                    <div className="stat-value">{result.summary.created_count}</div>
                    <div className="stat-label">Created</div>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon red"><AlertCircle size={18} /></div>
                  <div>
                    <div className="stat-value">{result.summary.skipped_count}</div>
                    <div className="stat-label">Skipped</div>
                  </div>
                </div>
              </div>

              {/* Created list */}
              {result.created.length > 0 && (
                <div className="card" style={{ marginBottom: 12 }}>
                  <div className="card-header">
                    <h4 className="card-title" style={{ color: 'var(--green)' }}>
                      ✓ Created Slots ({result.created.length})
                    </h4>
                  </div>
                  <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                    {result.created.map((s, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: '0.83rem' }}>
                        <span style={{ color: 'var(--text-primary)' }}>{formatDate(s.date)} at {formatTime(s.start_time)}</span>
                        <span style={{ color: 'var(--text-muted)' }}>{s.duration_minutes} min</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Skipped list */}
              {result.skipped.length > 0 && (
                <div className="card">
                  <div className="card-header">
                    <h4 className="card-title" style={{ color: 'var(--yellow)' }}>
                      ⚠ Skipped ({result.skipped.length})
                    </h4>
                  </div>
                  <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                    {result.skipped.map((s, i) => (
                      <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: '0.83rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-primary)' }}>{formatDate(s.date)} at {formatTime(s.start_time)}</span>
                        </div>
                        <div style={{ color: 'var(--yellow)', fontSize: '0.75rem', marginTop: 2 }}>{s.reason}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
