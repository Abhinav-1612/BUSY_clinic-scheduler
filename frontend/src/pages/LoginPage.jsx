import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { CalendarDays, Users, Stethoscope, HeartPulse } from 'lucide-react'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const user = await login(email, password)
      navigate(user.role === 'front_desk' ? '/dashboard' : '/appointments')
    } catch (err) {
      setError(err.response?.data?.detail || 'Login failed. Check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  function fillDemo(role) {
    const creds = {
      front_desk: { email: 'frontdesk@clinic.demo', password: 'Demo1234!' },
      provider:   { email: 'dr.smith@clinic.demo',  password: 'Demo1234!' },
    }
    setEmail(creds[role].email)
    setPassword(creds[role].password)
  }

  return (
    <div className="login-page">
      <div className="login-split-card">
        
        {/* Left Side: Form */}
        <div className="login-left">
          <div className="login-logo" style={{ marginBottom: '40px', alignItems: 'center' }}>
            <div className="login-logo-icon" style={{ 
              background: 'linear-gradient(135deg, var(--accent) 0%, #3b82f6 100%)', 
              color: 'white', 
              boxShadow: '0 4px 14px rgba(59, 130, 246, 0.4)' 
            }}>
              <HeartPulse size={24} />
            </div>
            <div>
              <div className="login-logo-text" style={{ fontSize: '1.5rem', letterSpacing: '-0.5px' }}>SyncCare</div>
              <div className="login-logo-sub" style={{ fontSize: '0.85rem', fontWeight: 500, opacity: 0.8 }}>Clinic Scheduler</div>
            </div>
            <div style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right', lineHeight: 1.5, fontWeight: 500, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              Better Care.<br/>Brighter Days.
            </div>
          </div>

          <h1 className="login-title" style={{ 
            fontSize: '2.4rem', 
            marginBottom: '8px', 
            background: 'linear-gradient(to right, var(--text-primary), var(--accent))', 
            WebkitBackgroundClip: 'text', 
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-1px'
          }}>
            Welcome back
          </h1>
          <p className="login-subtitle" style={{ fontSize: '1.05rem', marginBottom: '32px', lineHeight: 1.6 }}>
            Sign in to BUSY Clinic Scheduler and be a part of smoother, smarter healthcare.
          </p>

          {error && <div className="error-msg">{error}</div>}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '8px' }}>Email Address</label>
              <input
                id="login-email"
                type="email"
                className="form-control login-input"
                placeholder="Enter your email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '8px' }}>Password</label>
              <input
                id="login-password"
                type="password"
                className="form-control login-input"
                placeholder="Enter your password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            
            <button
              id="login-submit"
              type="submit"
              className="btn btn-primary w-full login-btn"
              style={{ justifyContent: 'center', padding: '14px', marginTop: '12px', fontSize: '1.05rem', fontWeight: 600, letterSpacing: '0.5px' }}
              disabled={loading}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', margin: '36px 0 24px 0' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            <span style={{ padding: '0 16px', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '1px' }}>Quick Access</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <button
              className="btn btn-ghost demo-btn"
              style={{ flex: 1, justifyContent: 'center', border: '1px solid var(--border)', padding: '12px', borderRadius: '12px', fontWeight: 600 }}
              onClick={() => fillDemo('front_desk')}
              type="button"
            >
              🖥️ Front Desk
            </button>
            <button
              className="btn btn-ghost demo-btn"
              style={{ flex: 1, justifyContent: 'center', border: '1px solid var(--border)', padding: '12px', borderRadius: '12px', fontWeight: 600 }}
              onClick={() => fillDemo('provider')}
              type="button"
            >
              👨‍⚕️ Provider
            </button>
          </div>
        </div>

        {/* Right Side: Image and Marketing Copy */}
        <div className="login-right">
          <div className="login-right-overlay" />
          <div className="login-right-content">
            <h2 className="login-right-title">Healthy People<br/>Happier Tomorrows</h2>
            <p className="login-right-subtitle">
              Efficient scheduling.<br/>More time for what matters.
            </p>
            
            <ul className="login-feature-list">
              <li className="login-feature-item">
                <div className="login-feature-icon"><CalendarDays size={24} /></div>
                <span>Book<br/>Appointments</span>
              </li>
              <li className="login-feature-item">
                <div className="login-feature-icon"><Users size={24} /></div>
                <span>Manage<br/>Schedules</span>
              </li>
              <li className="login-feature-item">
                <div className="login-feature-icon"><Stethoscope size={24} /></div>
                <span>Better<br/>Patient Care</span>
              </li>
            </ul>
          </div>
        </div>

      </div>
    </div>
  )
}
