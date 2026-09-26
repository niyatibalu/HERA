import type { CSSProperties, ReactNode } from 'react'
import type { ProviderMatch } from '../types'
import { Icon } from './Icon'
import { formatCurrency, specialtyLabel } from '../lib/format'
import { prettyReason } from '../lib/providers'
import { expertiseLabel } from '../lib/preferences'

/** One provider option with the facts that decide whether care is reachable, and why it ranks where it does. */
export function ProviderMatchCard({ match, insurancePlan, rank, variant = 'alternative', compareTo, action }: {
  match: ProviderMatch
  insurancePlan: string
  rank?: number
  variant?: 'original' | 'alternative'
  /** Original option, used to show how much better this one is. */
  compareTo?: ProviderMatch
  action?: ReactNode
}) {
  const p = match.provider
  const sooner = compareTo ? compareTo.provider.wait_days - p.wait_days : 0
  const closer = compareTo ? Math.round(compareTo.distance_mi - match.distance_mi) : 0
  const inNetwork = p.in_network_plans.includes(insurancePlan)
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
          <div className="match-score" style={{ '--score': Math.round(match.score) } as CSSProperties} aria-label={`Match score ${Math.round(match.score)} out of 100`}>
            <span className="num">{Math.round(match.score)}</span>
            <small>match</small>
          </div>
        )}
      </header>

      <dl className="provider-facts">
        <Fact label="Wait" bad={p.wait_days > 30} value={`${p.wait_days} days`} note={sooner > 0 ? `${sooner} days sooner` : undefined} />
        <Fact label="Distance" bad={match.distance_mi >= 40} value={`${match.distance_mi} mi`} note={closer > 20 ? `${closer} mi closer` : undefined} />
        <Fact label="Insurance" bad={!inNetwork} value={inNetwork ? 'In network' : 'Out of network'} />
        <Fact label="Est. cost" bad={(p.estimated_cost_usd ?? 0) > 300} value={p.estimated_cost_usd != null ? formatCurrency(p.estimated_cost_usd) : '—'} />
        <Fact label="Telehealth" bad={!p.telehealth_available} value={p.telehealth_available ? 'Available' : 'Not offered'} />
        {p.rating != null && <Fact label="Rating" value={`★ ${p.rating.toFixed(1)}`} note={p.review_count ? `${p.review_count} reviews` : undefined} />}
      </dl>

      <div className="row provider-tags">
        {p.expertise_tags.slice(0, 2).map((t) => <span key={t} className="badge">{expertiseLabel(t)}</span>)}
        {p.accessibility_features.includes('wheelchair_accessible') && <span className="badge badge-info">Wheelchair accessible</span>}
        {p.sliding_scale && <span className="badge badge-good">Sliding-scale fees</span>}
      </div>
      {p.review_highlights?.[0] && <p className="review-quote">“{p.review_highlights[0]}” <span className="list-meta">· synthetic patient review</span></p>}

      {!isOriginal && (match.match_reasons.length > 0 || match.access_tradeoffs.length > 0) && (
        <div className="why">
          <div className="why-h">Why HERA ranked this option</div>
          <ul>{match.match_reasons.slice(0, 3).map((r) => <li key={r}>{prettyReason(r)}</li>)}</ul>
          {match.access_tradeoffs.length > 0 && (
            <ul className="tradeoffs">{match.access_tradeoffs.slice(0, 2).map((r) => <li key={r}>{prettyReason(r)}</li>)}</ul>
          )}
          {(match.match_reasons.length > 3 || match.access_tradeoffs.length > 2) && (
            <details className="more">
              <summary>Show all {match.match_reasons.length + match.access_tradeoffs.length} reasons</summary>
              <ul>{match.match_reasons.slice(3).map((r) => <li key={r}>{prettyReason(r)}</li>)}</ul>
              {match.access_tradeoffs.length > 2 && <ul className="tradeoffs">{match.access_tradeoffs.slice(2).map((r) => <li key={r}>{prettyReason(r)}</li>)}</ul>}
            </details>
          )}
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
