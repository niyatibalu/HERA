import { useMemo, useState } from 'react'
import { api, DEMO_PATIENT_ID } from '../api/client'
import { useApi } from '../api/useApi'
import { Alert, Card, DataSourceNote, Loading, PageHeader } from '../components/common'
import { HealthTimeline } from '../components/HealthTimeline'
import { EVENT_TYPE_META } from '../lib/eventTypes'
import { LongitudinalOverview } from '../components/LongitudinalOverview'
import { TrendChart } from '../components/TrendChart'
import { TrendFlag } from '../components/TrendFlag'
import { flagSeries, providerLookup } from '../lib/record'
import { formatDate, monthsBetween } from '../lib/format'
import { DEMO_TODAY } from '../mocks/record'
import type { EventType } from '../types'

/** Typical lower reference limits used to annotate lab trend charts. */
const LAB_REFERENCE: Record<string, { low: number; label: string }> = {
  iron_deficiency: { low: 15, label: 'Typical lower limit 15' },
}

const FILTERS: (EventType | 'all')[] = ['all', 'encounter', 'symptom', 'lab', 'medication', 'imaging', 'referral']

export function TimelinePage() {
  const record = useApi(() => api.getRecord(DEMO_PATIENT_ID), 'record')
  const flags = useApi(() => api.getFlags(DEMO_PATIENT_ID), 'flags')
  const [activeFlag, setActiveFlag] = useState<string | null>(null)
  const [filter, setFilter] = useState<EventType | 'all'>('all')

  const flaggedIds = useMemo(() => {
    const m = new Map<string, number>()
    for (const f of flags.data ?? []) for (const ev of f.evidence) m.set(ev.event_id, (m.get(ev.event_id) ?? 0) + 1)
    return m
  }, [flags.data])

  if (!record.data || !flags.data) return <Loading label="Building longitudinal timeline…" />

  const r = record.data
  const provider = providerLookup(r.providers)
  const events = r.events.filter((e) => e.event_type !== 'diagnosis')
  const visible = filter === 'all' ? events : events.filter((e) => e.event_type === filter)
  const selected = flags.data.find((f) => f.flag_id === activeFlag)
  const highlight = selected ? new Set(selected.evidence.map((e) => e.event_id)) : undefined
  const dates = events.map((e) => e.event_date).sort()
  const span = monthsBetween(dates[0], dates[dates.length - 1])

  const toggleFlag = (id: string) => {
    const next = activeFlag === id ? null : id
    setActiveFlag(next)
    const f = flags.data!.find((x) => x.flag_id === next)
    if (f) {
      setFilter('all')
      requestAnimationFrame(() => document.getElementById(`event-${f.evidence[0].event_id}`)?.scrollIntoView?.({ behavior: 'smooth', block: 'center' }))
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Longitudinal health timeline"
        title="The whole story, in order"
        lede={`${events.length} documented events across ${span} months, from every connected record. HERA points out patterns that are hard to see one visit at a time.`}
        actions={<DataSourceNote source={flags.source} />}
      />

      <Alert tone="review" title={`HERA detected ${flags.data.length} longitudinal ${flags.data.length === 1 ? 'pattern' : 'patterns'} for clinician review`}>
        These are observations about documented records, not diagnoses. Every flag cites the source records behind it so a clinician can check it.
      </Alert>

      <Card className="section-gap" icon="timeline" title="Longitudinal overview" sub={`${formatDate(dates[0], { year: true })} – today · one lane per health topic`}>
        <div className="card-body">
          <LongitudinalOverview events={r.events} highlightIds={highlight} today={DEMO_TODAY} />
        </div>
      </Card>

      <div className="grid grid-main section-gap">
        <Card
          icon="clock"
          title="All events"
          sub={selected ? 'Highlighting the source records for the selected flag' : 'Chronological, from all connected records'}
          action={selected && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setActiveFlag(null)}>Clear highlight</button>}
        >
          <div className="filter-row" role="group" aria-label="Filter by event type">
            {FILTERS.map((f) => (
              <button key={f} type="button" className={`chip ${filter === f ? 'is-on' : ''}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>
                {f === 'all' ? 'All' : EVENT_TYPE_META[f].plural}
                <span className="chip-count num">{f === 'all' ? events.length : events.filter((e) => e.event_type === f).length}</span>
              </button>
            ))}
          </div>
          <div className="card-body">
            <HealthTimeline events={visible} provider={provider} flaggedIds={flaggedIds} highlightIds={highlight} />
          </div>
        </Card>

        <aside className="stack sticky-col" aria-label="Flagged patterns">
          <h2 className="section-label">Flagged for clinician review</h2>
          {flags.data.map((f) => {
            const series = flagSeries(f, r.events)
            const ref = f.pattern_type === 'lab_trend' ? LAB_REFERENCE[f.topic] : undefined
            return (
                <TrendFlag
                  key={f.flag_id}
                  flag={f}
                  active={activeFlag === f.flag_id}
                  onSelect={toggleFlag}
                  chart={series && <TrendChart series={series} referenceLow={ref?.low} referenceLabel={ref?.label} />}
                >
                {activeFlag === f.flag_id && (
                  <div className="evidence">
                    <div className="evidence-h">Source records</div>
                    <ul>
                      {f.evidence.map((e) => (
                        <li key={e.event_id}>
                          <span className="num muted">{formatDate(e.event_date, { year: true })}</span> {e.excerpt}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                </TrendFlag>
            )
          })}
        </aside>
      </div>
    </>
  )
}
