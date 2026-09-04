import { useQuery } from '@tanstack/react-query'
import api from '../api/client'
import { Spinner, EmptyState } from '../components/ui'

export default function ProvidersPage() {
  const { data: providers, isLoading, error } = useQuery({
    queryKey: ['providers'],
    queryFn: () => api.get('/api/providers/').then(res => res.data),
  })

  if (isLoading) return <Spinner />
  if (error) return <div>Error loading providers.</div>
  if (!providers?.length) return <EmptyState title="No providers found" />

  return (
    <div className="page-body">
      <div className="page-header">
        <div>
          <h1 className="page-title">Providers</h1>
        </div>
      </div>

      <div className="card">
        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Specialty</th>
                <th>Email Address</th>
              </tr>
            </thead>
            <tbody>
              {providers.map(p => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 500 }}>{p.display_name}</td>
                  <td>
                    <span className="badge">{p.specialty}</span>
                  </td>
                  <td style={{ color: 'var(--text-secondary)' }}>{p.email}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
