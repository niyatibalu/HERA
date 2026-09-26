import { useId, useState } from 'react'
import type { FlagSeries } from '../lib/record'
import { daysBetween, formatDate } from '../lib/format'

const W = 320
const H = 120
const PAD = { top: 14, right: 12, bottom: 22, left: 28 }

/** Single-series trend (symptom severity or a lab value) with hover readout and a table fallback. */
export function TrendChart({ series, referenceLow, referenceLabel }: { series: FlagSeries; referenceLow?: number; referenceLabel?: string }) {
  const [hover, setHover] = useState<number | null>(null)
  const titleId = useId()
  const pts = series.points
  const first = pts[0].date
  const span = Math.max(1, daysBetween(first, pts[pts.length - 1].date))
  const yMax = series.max ?? Math.ceil((Math.max(...pts.map((p) => p.value), referenceLow ?? 0) * 1.15) / 10) * 10
  const x = (d: string) => PAD.left + (daysBetween(first, d) / span) * (W - PAD.left - PAD.right)
  const y = (v: number) => PAD.top + (1 - v / yMax) * (H - PAD.top - PAD.bottom)
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const ticks = series.max ? [1, 3, 5].filter((t) => t <= yMax) : [0, yMax / 2, yMax]
  const active = hover != null ? pts[hover] : pts[pts.length - 1]

  return (
    <figure className="trend-chart" aria-labelledby={titleId}>
      <figcaption id={titleId} className="trend-chart-cap">
        <span>{series.label}</span>
        <span className="trend-chart-read num">
          <strong>{active.value}{series.unit.startsWith('/') ? series.unit : ` ${series.unit}`}</strong> · {formatDate(active.date, { year: true })}
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${series.label} over time`} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="chart-grid" />
            <text x={PAD.left - 6} y={y(t) + 3} className="chart-axis" textAnchor="end">{t}</text>
          </g>
        ))}
        {referenceLow != null && (
          <g>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(referenceLow)} y2={y(referenceLow)} className="chart-ref" />
            <text x={W - PAD.right} y={y(referenceLow) - 4} className="chart-axis" textAnchor="end">{referenceLabel ?? `ref ${referenceLow}`}</text>
          </g>
        )}
        <text x={PAD.left} y={H - 5} className="chart-axis">{formatDate(first)}</text>
        <text x={W - PAD.right} y={H - 5} className="chart-axis" textAnchor="end">{formatDate(pts[pts.length - 1].date)}</text>
        {hover != null && <line x1={x(pts[hover].date)} x2={x(pts[hover].date)} y1={PAD.top} y2={H - PAD.bottom} className="chart-crosshair" />}
        <path d={path} className="chart-line" />
        {pts.map((p, i) => (
          <g key={p.event_id} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0} aria-label={`${formatDate(p.date, { year: true })}: ${p.value}`}>
            <circle cx={x(p.date)} cy={y(p.value)} r={12} fill="transparent" />
            <circle cx={x(p.date)} cy={y(p.value)} r={hover === i ? 5.5 : 4} className="chart-dot" />
          </g>
        ))}
      </svg>
      <table className="visually-hidden">
        <caption>{series.label}</caption>
        <thead><tr><th>Date</th><th>Value</th></tr></thead>
        <tbody>{pts.map((p) => <tr key={p.event_id}><td>{p.date}</td><td>{p.value} {series.unit}</td></tr>)}</tbody>
      </table>
    </figure>
  )
}
