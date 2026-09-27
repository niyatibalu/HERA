import { type FormEvent, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { InvalidCredentials, signIn } from '../api/client'
import { Icon } from '../components/Icon'
import { currentSession } from '../lib/auth'
import { DEMO_LOGIN } from '../mocks/patient'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const next = new URLSearchParams(location.search).get('next') || '/'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (currentSession()) return <Navigate to={next} replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) return setError('Enter your email and password.')
    setBusy(true)
    setError(null)
    try {
      await signIn(email, password)
      navigate(next.startsWith('/') ? next : '/', { replace: true })
    } catch (err) {
      setError(err instanceof InvalidCredentials ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const useDemo = () => {
    setEmail(DEMO_LOGIN.email)
    setPassword(DEMO_LOGIN.password)
    setError(null)
  }

  return (
    <div className="auth">
      <section className="auth-brand" aria-hidden="true">
        <div className="auth-brand-inner">
          <div className="brand auth-logo">
            <span className="brand-mark">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
                <path d="M4 17 5.5 8l4 3.5L12 5l2.5 6.5 4-3.5L20 17z" />
                <path d="M5 20.5h14" />
              </svg>
            </span>
            <span className="brand-name">HERA</span>
          </div>
          <h2 className="auth-tagline">Your care, connected from the first symptom to the last follow-up.</h2>
          <ul className="auth-points">
            <li><Icon name="record" size={18} /> Every record in one place</li>
            <li><Icon name="stethoscope" size={18} /> Care you can actually reach</li>
            <li><Icon name="journey" size={18} /> Followed through to completion</li>
          </ul>
        </div>
      </section>

      <main className="auth-main">
        <form className="auth-card" onSubmit={submit} aria-labelledby="signin-h" noValidate>
          <h1 id="signin-h" className="auth-title">Sign in</h1>
          <p className="auth-sub">Welcome back. Sign in to see your care.</p>

          <label className="field">
            <span className="field-label">Email</span>
            <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoFocus />
          </label>
          <label className="field">
            <span className="field-label">Password</span>
            <span className="password-row">
              <input className="input" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowPassword((v) => !v)} aria-pressed={showPassword}>
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </span>
          </label>

          {error && <p className="error-text" role="alert">{error}</p>}

          <button type="submit" className="btn btn-primary btn-lg auth-submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          <div className="demo-account">
            <div>
              <div className="demo-account-title">Demo account</div>
              <div className="demo-account-text">Synthetic patient Maya Restrepo · {DEMO_LOGIN.email}</div>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={useDemo}>Use demo account</button>
          </div>
        </form>
      </main>
    </div>
  )
}
