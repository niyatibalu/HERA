import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icon, type IconName } from './Icon'
import type { DataSource } from '../api/client'

export function PageHeader({ eyebrow, title, lede, actions }: { eyebrow?: string; title: string; lede?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1 className="page-title">{title}</h1>
        {lede && <p className="page-lede">{lede}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </div>
  )
}

export function Card({ title, sub, icon, action, children, className = '' }: {
  title?: ReactNode
  sub?: ReactNode
  icon?: IconName
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`card ${className}`}>
      {title && (
        <header className="card-header">
          <div>
            <h2 className="card-title">
              {icon && <Icon name={icon} size={16} />}
              {title}
            </h2>
            {sub && <div className="card-sub">{sub}</div>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

export function CardLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="card-link">
      {children} →
    </Link>
  )
}

type AlertTone = 'stalled' | 'review' | 'info' | 'good'
const ALERT_ICON: Record<AlertTone, IconName> = { stalled: 'pause', review: 'flag', info: 'info', good: 'check' }

export function Alert({ tone, title, children, action }: { tone: AlertTone; title: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className={`alert alert-${tone}`} role={tone === 'stalled' ? 'alert' : tone === 'good' ? 'status' : undefined}>
      <Icon name={ALERT_ICON[tone]} className="alert-icon" />
      <div>
        <div className="alert-title">{title}</div>
        {children && <div className="alert-text">{children}</div>}
      </div>
      {action && <div className="alert-action">{action}</div>}
    </div>
  )
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return <div className="loading" role="status">{label}</div>
}

export function DataSourceNote({ source }: { source?: DataSource }) {
  if (!source) return null
  return (
    <span className="demo-note">
      <Icon name={source === 'live' ? 'link' : 'info'} size={13} />
      {source === 'live' ? 'Live from HERA backend' : 'Showing synthetic demo data'}
    </span>
  )
}
