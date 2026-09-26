import { NavLink, Outlet } from 'react-router-dom'
import { Icon, type IconName } from './Icon'
import type { Patient } from '../types'
import { ageOn } from '../lib/format'
import { DEMO_TODAY } from '../mocks/record'

const NAV: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: '/', label: 'Overview', icon: 'home', end: true },
  { to: '/record', label: 'Health record', icon: 'record' },
  { to: '/timeline', label: 'Health timeline', icon: 'timeline' },
  { to: '/access', label: 'Care access', icon: 'access' },
  { to: '/journey', label: 'Care journey', icon: 'journey' },
  { to: '/research', label: 'Research', icon: 'research' },
]

export function Layout({ patient, sourceCount, attentionCount = 0 }: { patient?: Patient; sourceCount?: number; attentionCount?: number }) {
  const initials = patient?.name.split(' ').map((s) => s[0]).join('') ?? ''
  return (
    <div className="shell">
      <aside className="sidebar">
        <NavLink to="/" className="brand" aria-label="HERA home">
          <span className="brand-mark">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
              <path d="M6 4v16M18 4v16M6 12h12" />
            </svg>
          </span>
          <span>
            <span className="brand-name">HERA</span>
            <span className="brand-sub">Connected women’s care</span>
          </span>
        </NavLink>
        <nav className="nav" aria-label="Main">
          <span className="nav-label">Patient</span>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end}>
              <Icon name={n.icon} />
              {n.label}
              {n.to === '/journey' && attentionCount > 0 && (
                <span className="nav-count" aria-label={`${attentionCount} stalled`}>{attentionCount}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">Hackathon demo · synthetic patient data only</div>
      </aside>
      <div className="main">
        <header className="topbar">
          {patient && (
            <div className="patient-chip">
              <span className="avatar" aria-hidden="true">{initials}</span>
              <div>
                <strong>{patient.name}</strong>
                <span>
                  {ageOn(patient.date_of_birth, DEMO_TODAY)} · {patient.home_location.address} · {patient.insurance_plan}
                </span>
              </div>
            </div>
          )}
          <div className="topbar-right">
            {sourceCount !== undefined && (
              <span className="badge badge-accent">
                <Icon name="link" size={13} /> {sourceCount} record sources connected
              </span>
            )}
            <span className="badge">Synthetic demo data</span>
          </div>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
