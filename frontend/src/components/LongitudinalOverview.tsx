import { useState } from 'react'
import type { EventType, HealthEvent } from '../types'
import { daysBetween, formatDate, humanize, parseDate } from '../lib/format'

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']

/** Marker shape per event type, so type never depends on color alone. */
function Marker({ type, x, y, r, className }: { type: EventType; x: number; y: number; r: number; className: string }) {
  switch (type) {
    case 'lab':
      return <rect x={x - r} y={y - r} width={r * 2} height={r * 2} transform={`rotate(45 ${x} ${y})`} className={className} />
    case 'medication':
      return <rect x={x - r} y={y - r} width={r * 2} height={r * 2} rx={1.5} className={className} />
    case 'referral':
      return <path d={`M${x - r},${y + r * 0.85} L${x},${y - r} L${x + r},${y + r * 0.85} Z`} className={className} />
    default:
      return <circle cx={x} cy={y} r={r} className={className} />
  }
}

const LEGEND: { type: EventType; label: string }[] = [
  { type: 'encounter', label: 'Visit / symptom' },
  { type: 'lab', label: 'Lab' },
  { type: 'medication', label: 'Medication' },
  { type: 'referral', label: 'Referral' },
]

/**
 * One lane per clinical topic across the full span of the record. Shows at a glance that
 * separate visits belong to the same ongoing story.
 */
export function LongitudinalOverview({ events, highlightIds, today }: { events: HealthEvent[]; highlightIds?: Set<string>; today: string }) {
  const [hover, setHover] = useState<HealthEvent | null>(null)
  const shown = events.filter((e) => e.event_type !== 'diagnosis')
  const topics = [...new Set(shown.map((e) => e.topic))].sort(
    (a, b) => shown.filter((e) => e.topic === b).length - shown.filter((e) => e.topic === a).length,
  )
  const start = `${shown.map((e) => e.event_date).sort()[0].slice(0, 7)}-01`
  const { y: ey, m: em } = parseDate(today)
  const end = `${ey}-${String(em).padStart(2, '0')}-28`
  const total = daysBetween(start, end)

  const LABEL_W = 150
  const W = 900
  const LANE_H = 44
  const TOP = 24
  const H = TOP + topics.length * LANE_H + 22
  const x = (d: string) => LABEL_W + (daysBetween(start, d) / total) * (W - LABEL_W - 16)

  const months: string[] = []
  for (let i = 0; ; i++) {
    const s = parseDate(start)
    const m = ((s.m - 1 + i) % 12) + 1
    const y = s.y + Math.floor((s.m - 1 + i) / 12)
    const key = `${y}-${String(m).padStart(2, '0')}-01`
    if (key > end) break
    months.push(key)
  }

  return (
    <div className="lanes">
      <div className="lanes-scroll">
        <svg viewBox={`0 0 ${W} ${H}`} className="lanes-svg" role="img" aria-label="Events by topic over time" onMouseLeave={() => setHover(null)}>
          {months.map((m) => (
            <g key={m}>
              <line x1={x(m)} x2={x(m)} y1={TOP - 6} y2={H - 16} className="chart-grid" />
              <text x={x(m) + 3} y={12} className="chart-axis">{MONTHS[parseDate(m).m - 1]}{parseDate(m).m === 1 ? ` ’${String(parseDate(m).y).slice(2)}` : ''}</text>
            </g>
          ))}
          <line x1={x(today)} x2={x(today)} y1={TOP - 6} y2={H - 16} className="chart-today" />
          <text x={x(today)} y={H - 4} className="chart-axis chart-today-label" textAnchor="middle">Today</text>
          {topics.map((t, i) => {
            const cy = TOP + i * LANE_H + LANE_H / 2
            const laneEvents = shown.filter((e) => e.topic === t)
            const dates = laneEvents.map((e) => e.event_date).sort()
            return (
              <g key={t}>
                <text x={0} y={cy + 4} className="lanes-label">{humanize(t)}</text>
                <line x1={x(dates[0])} x2={x(dates[dates.length - 1])} y1={cy} y2={cy} className="lanes-span" />
                {laneEvents.map((e, k) => {
                  const same = laneEvents.filter((o, j) => j < k && o.event_date === e.event_date).length
                  const cx = x(e.event_date) + same * 9
                  const r = e.severity ? 3.5 + e.severity * 0.9 : 4.5
                  const lit = highlightIds?.has(e.event_id)
                  const dim = highlightIds && !lit
                  return (
                    <g key={e.event_id} onMouseEnter={() => setHover(e)}>
                      <circle cx={cx} cy={cy} r={12} fill="transparent" />
                      <Marker type={e.event_type} x={cx} y={cy} r={r} className={`lanes-mark ${lit ? 'is-lit' : ''} ${dim ? 'is-dim' : ''}`} />
                    </g>
                  )
                })}
              </g>
            )
          })}
        </svg>
      </div>
      <div className="lanes-foot">
        <div className="lanes-legend" aria-label="Legend">
          {LEGEND.map((l) => (
            <span key={l.type}>
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><Marker type={l.type} x={7} y={7} r={4.5} className="lanes-mark" /></svg>
              {l.label}
            </span>
          ))}
          <span className="muted">Larger marker = higher reported severity</span>
        </div>
        <div className="lanes-hover" aria-live="polite">
          {hover ? (
            <>
              <strong className="num">{formatDate(hover.event_date, { year: true })}</strong> · {hover.description}
            </>
          ) : (
            <span className="muted">Hover a marker for details</span>
          )}
        </div>
      </div>
    </div>
  )
}
