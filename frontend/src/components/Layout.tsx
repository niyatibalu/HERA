import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { signOut } from '../api/client'
import { Icon, type IconName } from './Icon'
import type { MyChartConnection, Patient } from '../types'
import { ageOn } from '../lib/format'
import { DEMO_TODAY } from '../mocks/record'

/** Care has three views (find care, journey, map) that share one nav item. */
const CARE_PATHS = ['/care', '/access', '/appointments', '/journey', '/map']

const NAV: { to: string; label: string; icon: IconName; end?: boolean; match?: string[] }[] = [
  { to: '/', label: 'Home', icon: 'home', end: true },
  { to: '/access', label: 'Care', icon: 'stethoscope', match: CARE_PATHS },
  { to: '/timeline', label: 'Health timeline', icon: 'timeline' },
  { to: '/record', label: 'Records', icon: 'record' },
  { to: '/research', label: 'Research', icon: 'research' },
]

export function Layout({ patient, mychart, attentionCount = 0 }: { patient?: Patient; mychart?: MyChartConnection; attentionCount?: number }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const initials = patient?.name.split(' ').map((s) => s[0]).join('') ?? ''
  return (
    <div className="shell">
      <aside className="sidebar">
        <NavLink to="/" className="brand" aria-label="HERA home">
          <span className="brand-mark" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
              <path d="M4 17 5.5 8l4 3.5L12 5l2.5 6.5 4-3.5L20 17z" />
              <path d="M5 20.5h14" />
            </svg>
          </span>
          <span className="brand-name">HERA</span>
        </NavLink>

        <nav className="nav" aria-label="Main">
          {NAV.map((n) => {
            const active = n.match ? n.match.some((p) => pathname.startsWith(p)) : undefined
            return (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => ((active ?? isActive) ? 'active' : '')}>
                <Icon name={n.icon} size={19} />
                {n.label}
                {n.to === '/access' && attentionCount > 0 && (
                  <span className="nav-count" aria-label={`${attentionCount} needs attention`}>{attentionCount}</span>
                )}
              </NavLink>
            )
          })}
        </nav>

        <div className="sidebar-foot">
          {mychart && (
            mychart.status === 'connected' ? (
              <div className="sync-status is-on"><span className="dot" aria-hidden="true" /> MyChart connected</div>
            ) : (
              <NavLink to="/record" className="sync-status"><span className="dot" aria-hidden="true" /> Connect MyChart</NavLink>
            )
          )}
          {patient && (
            <div className="patient-chip">
              <span className="avatar" aria-hidden="true">{initials}</span>
              <div>
                <strong>{patient.name}</strong>
                <span>{ageOn(patient.date_of_birth, DEMO_TODAY)} · {patient.home_location.address}</span>
              </div>
            </div>
          )}
          <div className="sidebar-foot-row">
            <p className="demo-flag">Demo · synthetic data</p>
            <button type="button" className="btn btn-ghost btn-sm" onClick={async () => { await signOut(); navigate('/login', { replace: true }) }}>Sign out</button>
          </div>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  )
}

/** Tabs across the three Care views. */
export function CareTabs() {
  const tabs = [
    { to: '/access', label: 'Find care' },
    { to: '/appointments', label: 'Appointments' },
    { to: '/journey', label: 'Journey' },
    { to: '/map', label: 'Map' },
  ]
  return (
    <nav className="tabs" aria-label="Care">
      {tabs.map((t) => (
        <NavLink key={t.to} to={t.to} className={({ isActive }) => `tab${isActive ? ' is-active' : ''}`}>
          {t.label}
        </NavLink>
      ))}
    </nav>
  )
}
