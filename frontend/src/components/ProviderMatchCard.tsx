import type { ReactNode } from 'react'
import type { ProviderMatch } from '../types'
import { Icon } from './Icon'
import { formatCurrency, humanize, specialtyLabel } from '../lib/format'

const LANG: Record<string, string> = { en: 'English', es: 'Spanish' }

/** One provider option with the facts that decide whether care is reachable, and why it ranks where it does. */
export function ProviderMatchCard({ match, rank, variant = 'alternative', compareTo, action }: {
  match: ProviderMatch
  rank?: number
  variant?: 'original' | 'alternative'
  /** Original option, used to show how much better this one is. */
  compareTo?: ProviderMatch
  action?: ReactNode
}) {
  const p = match.provider
  const sooner = compareTo ? compareTo.provider.wait_days - p.wait_days : 0
  const closer = compareTo ? compareTo.distance_miles - match.distance_miles : 0
  const isOriginal = variant === 'original'

  return (
    <article className={`provider-card ${isOriginal ? 'is-original' : ''}`} aria-label={`${isOriginal ? 'Original referral' : 'Provider option'}: ${p.name}`}>
      <header className="provider-head">
        <div className="provider-id">
          {rank != null && <span className="provider-rank num">{rank}</span>}
          <div>
            <h3 className="provider-name">{p.name}</h3>
            <div className="list-meta">{specialtyLabel(p.specialty)} · {p.location.address}</div>
          </div>
        </div>
        {!isOriginal && (
          <div className="match-score" aria-label={`Match score ${Math.round(match.match_score * 100)} out of 100`}>
            <span className="num">{Math.round(match.match_score * 100)}</span>
            <small>match</small>
          </div>
        )}
      </header>

      <dl className="provider-facts">
        <Fact label="Wait" bad={p.wait_days > 30} value={`${p.wait_days} days`} note={sooner > 0 ? `${sooner} days sooner` : undefined} />
        <Fact label="Distance" bad={match.distance_miles > 60} value={`${match.distance_miles} mi`} note={closer > 20 ? `${closer} mi closer` : undefined} />
        <Fact label="Insurance" bad={!match.in_network} value={match.in_network ? 'In network' : 'Out of network'} />
        <Fact label="Est. cost" bad={(p.estimated_cost_usd ?? 0) > 300} value={p.estimated_cost_usd != null ? formatCurrency(p.estimated_cost_usd) : '—'} />
        <Fact label="Telehealth" bad={!p.telehealth_available} value={p.telehealth_available ? 'Available' : 'Not offered'} />
      </dl>

      <div className="row provider-tags">
        {p.expertise_tags.map((t) => <span key={t} className="badge">{humanize(t)}</span>)}
        {p.accessibility_features.map((t) => <span key={t} className="badge badge-info">{humanize(t)}</span>)}
        {p.languages.length > 1 && <span className="badge badge-info">{p.languages.map((l) => LANG[l] ?? l).join(' · ')}</span>}
      </div>

      {!isOriginal && match.reasons.length > 0 && (
        <div className="why">
          <div className="why-h">Why HERA ranked this option</div>
          <ul>{match.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
      )}
      {action && <div className="provider-action">{action}</div>}
    </article>
  )
}

function Fact({ label, value, bad, note }: { label: string; value: string; bad?: boolean; note?: string }) {
  return (
    <div className={`fact ${bad ? 'is-bad' : ''}`}>
      <dt>{label}</dt>
      <dd className="num">
        {bad && <Icon name="alert" size={13} />}
        {value}
      </dd>
      {note && <div className="fact-note num">{note}</div>}
    </div>
  )
}
