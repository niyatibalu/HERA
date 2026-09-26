import type { ReactNode } from 'react'
import type { TrendFlag as TrendFlagData } from '../types'
import { Icon } from './Icon'

const PATTERN_LABEL: Record<TrendFlagData['pattern_type'], string> = {
  symptom_progression: 'Symptom progression',
  lab_decline: 'Lab trend',
  repeated_complaint: 'Repeated complaint',
  unresolved_referral: 'Unresolved care item',
  treatment_without_improvement: 'Treatment response',
}

/** Review badge: HERA flags patterns for clinicians; it never presents a diagnosis. */
export function ReviewBadge() {
  return (
    <span className="badge badge-review">
      <Icon name="flag" size={12} /> Flagged for clinician review
    </span>
  )
}

export function TrendFlag({ flag, compact = false, active = false, onSelect, chart }: {
  flag: TrendFlagData
  compact?: boolean
  active?: boolean
  onSelect?: (flagId: string) => void
  chart?: ReactNode
}) {
  const stats = (
    <div className="trend-stats">
      {flag.encounter_count > 1 && <span><strong className="num">{flag.encounter_count}</strong> {flag.pattern_type === 'lab_decline' ? 'results' : 'encounters'}</span>}
      {flag.span_months > 0 && <span><strong className="num">{flag.span_months}</strong> months</span>}
      <span className="muted">{PATTERN_LABEL[flag.pattern_type]}</span>
    </div>
  )
  return (
    <article className={`trend-flag ${compact ? 'trend-flag-compact' : ''} ${active ? 'is-active' : ''}`} aria-label={`Trend flag: ${flag.title}`}>
      <div className="trend-flag-top">
        <ReviewBadge />
        {!compact && <span className="trend-source">Detected by {flag.generated_by}</span>}
      </div>
      <h3 className="trend-title">{flag.title}</h3>
      <p className="trend-summary">{flag.summary}</p>
      {chart}
      {!compact && <p className="trend-review"><Icon name="stethoscope" size={14} /> {flag.suggested_review}</p>}
      {stats}
      {onSelect && flag.related_event_ids.length > 0 && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onSelect(flag.flag_id)} aria-pressed={active}>
          {active ? 'Showing related events' : `Highlight ${flag.related_event_ids.length} related events`}
        </button>
      )}
    </article>
  )
}
