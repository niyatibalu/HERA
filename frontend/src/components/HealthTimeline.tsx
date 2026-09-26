import type { HealthEvent, Provider } from '../types'
import { Icon } from './Icon'
import { EVENT_TYPE_META } from '../lib/eventTypes'
import { formatDate, humanize, monthKey, monthLabel, specialtyLabel } from '../lib/format'

/** Chronological, month-grouped view of a patient's longitudinal record. */
export function HealthTimeline({ events, provider, flaggedIds, highlightIds }: {
  events: HealthEvent[]
  provider: (id?: string | null) => Provider | undefined
  /** event_id → number of flags citing it */
  flaggedIds: Map<string, number>
  /** When set, these events are emphasized and the rest are dimmed. */
  highlightIds?: Set<string>
}) {
  const sorted = [...events].sort((a, b) => a.event_date.localeCompare(b.event_date) || a.event_id.localeCompare(b.event_id))
  const months = new Map<string, HealthEvent[]>()
  for (const e of sorted) months.set(monthKey(e.event_date), [...(months.get(monthKey(e.event_date)) ?? []), e])

  if (sorted.length === 0) return <div className="empty">No events match these filters.</div>

  return (
    <ol className="htl" aria-label="Health timeline">
      {[...months.entries()].map(([key, evs]) => (
        <li key={key} className="htl-month">
          <h3 className="htl-month-label">{monthLabel(key)}</h3>
          <ol className="htl-events">
            {evs.map((e) => {
              const meta = EVENT_TYPE_META[e.event_type]
              const flagged = flaggedIds.get(e.event_id) ?? 0
              const dim = highlightIds && !highlightIds.has(e.event_id)
              const lit = highlightIds?.has(e.event_id)
              const p = provider(e.provider_id)
              return (
                <li key={e.event_id} id={`event-${e.event_id}`} className={`htl-event type-${e.event_type} ${dim ? 'is-dim' : ''} ${lit ? 'is-lit' : ''}`}>
                  <span className="htl-node" aria-hidden="true"><Icon name={meta.icon} size={13} /></span>
                  <div className="htl-body">
                    <div className="htl-top">
                      <span className="htl-type">{meta.label}</span>
                      <span className="htl-date num">{formatDate(e.event_date)}</span>
                      {e.severity != null && <span className="badge num">Severity {e.severity}/5</span>}
                      {e.value != null && <span className="badge num">{e.value} {e.unit}</span>}
                      {flagged > 0 && (
                        <span className="badge badge-review">
                          <Icon name="flag" size={11} /> Cited in {flagged} {flagged === 1 ? 'flag' : 'flags'}
                        </span>
                      )}
                    </div>
                    <p className="htl-desc">{e.description}</p>
                    <p className="htl-meta">
                      {humanize(e.topic)}
                      {e.specialty && ` · ${specialtyLabel(e.specialty)}`}
                      {p && ` · ${p.name}`}
                    </p>
                  </div>
                </li>
              )
            })}
          </ol>
        </li>
      ))}
    </ol>
  )
}
