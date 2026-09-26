import type { ReactNode } from 'react'
import type { TrendFlag as TrendFlagData } from '../types'
import { Icon } from './Icon'
import { flagTitle, patternLabel } from '../lib/record'
import { formatDate, monthsBetween } from '../lib/format'

/** HERA flags patterns for clinicians; it never presents a diagnosis. */
export function ReviewBadge() {
  return (
    <span className="badge badge-review">
      <Icon name="flag" size={12} /> Flagged for clinician review
    </span>
  )
}

const TREND_LABEL: Record<TrendFlagData['trend'], string> = {
  worsening: 'Worsening',
  stable: 'Unchanged',
  improving: 'Improving',
  unknown: '',
}

export function TrendFlag({ flag, compact = false, active = false, onSelect, chart }: {
  flag: TrendFlagData
  compact?: boolean
  active?: boolean
  onSelect?: (flagId: string) => void
  chart?: ReactNode
}) {
  const months = monthsBetween(flag.first_seen, flag.last_seen)
  const title = flagTitle(flag)
  return (
    <article className={`trend-flag ${compact ? 'trend-flag-compact' : ''} ${active ? 'is-active' : ''}`} aria-label={`Trend flag: ${title}`}>
      <div className="trend-flag-top">
        <ReviewBadge />
        {!compact && <span className="trend-source">{patternLabel(flag.pattern_type)}</span>}
      </div>
      <h3 className="trend-title">{title}</h3>
      <p className="trend-summary">{flag.message}</p>
      {chart}
      <div className="trend-stats">
        {flag.encounter_count > 1 && <span><strong className="num">{flag.encounter_count}</strong> {flag.pattern_type === 'lab_trend' ? 'results' : 'encounters'}</span>}
        {months > 0 && <span><strong className="num">{months}</strong> {months === 1 ? 'month' : 'months'}</span>}
        <span className="muted num">
          {flag.first_seen === flag.last_seen ? formatDate(flag.first_seen, { year: true }) : `${formatDate(flag.first_seen)} – ${formatDate(flag.last_seen, { year: true })}`}
        </span>
        {TREND_LABEL[flag.trend] && <span className="muted">{TREND_LABEL[flag.trend]}</span>}
      </div>
      {onSelect && flag.evidence.length > 0 && (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onSelect(flag.flag_id)} aria-pressed={active}>
          {active ? 'Showing evidence on timeline' : `Show ${flag.evidence.length} source ${flag.evidence.length === 1 ? 'record' : 'records'} on timeline`}
        </button>
      )}
    </article>
  )
}
