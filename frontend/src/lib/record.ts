// Turns the backend's flat HealthEvent list into the sections of a unified record.
import type { EventType, HealthEvent, PatientRecord, Provider, TrendFlag } from '../types'
import { humanize } from './format'

export type EventsByType = Record<EventType, HealthEvent[]>

export function groupEvents(events: HealthEvent[]): EventsByType {
  const out: EventsByType = { encounter: [], diagnosis: [], symptom: [], medication: [], lab: [], imaging: [], procedure: [], referral: [] }
  for (const e of [...events].sort((a, b) => b.event_date.localeCompare(a.event_date))) out[e.event_type].push(e)
  return out
}

export function providerLookup(providers: Provider[]) {
  const map = new Map(providers.map((p) => [p.provider_id, p]))
  return (id?: string | null) => (id ? map.get(id) : undefined)
}

export interface Condition {
  topic: string
  label: string
  first_seen: string
  last_seen: string
  event_count: number
  status: string
  icd10?: string
}

/** One row per clinical topic, with its documented span. */
export function conditions(events: HealthEvent[]): Condition[] {
  const byTopic = new Map<string, HealthEvent[]>()
  for (const e of events) byTopic.set(e.topic, [...(byTopic.get(e.topic) ?? []), e])
  return [...byTopic.entries()]
    .map(([topic, evs]) => {
      const sorted = [...evs].sort((a, b) => a.event_date.localeCompare(b.event_date))
      const dx = sorted.find((e) => e.event_type === 'diagnosis')
      return {
        topic,
        label: dx?.description ?? humanize(topic),
        first_seen: sorted[0].event_date,
        last_seen: sorted[sorted.length - 1].event_date,
        event_count: sorted.length,
        status: dx?.status ?? sorted[sorted.length - 1].status ?? 'active',
        icd10: dx?.raw?.icd10 as string | undefined,
      }
    })
    .sort((a, b) => b.event_count - a.event_count)
}

/** Clinicians the patient has seen, with visit counts. */
export function careTeam(record: PatientRecord) {
  const find = providerLookup(record.providers)
  const counts = new Map<string, number>()
  for (const e of record.events) if (e.event_type === 'encounter' && e.provider_id) counts.set(e.provider_id, (counts.get(e.provider_id) ?? 0) + 1)
  return [...counts.entries()].map(([id, visits]) => ({ provider: find(id), provider_id: id, visits })).filter((x) => x.provider)
}

// ---------- trend flag presentation ----------

const PATTERN_LABEL: Record<TrendFlag['pattern_type'], string> = {
  persistent_symptom: 'Persistent symptom',
  lab_trend: 'Lab trend',
  repeated_treatment_no_improvement: 'Treatment response',
  multiple_specialist_visits: 'Multiple specialties',
  unresolved_referral: 'Unresolved referral',
  care_gap: 'Care gap',
}
export const patternLabel = (p: TrendFlag['pattern_type']) => PATTERN_LABEL[p]

export function flagTitle(f: TrendFlag) {
  const topic = humanize(f.topic)
  switch (f.pattern_type) {
    case 'persistent_symptom':
      return `${topic} ${f.trend === 'worsening' ? 'increasing' : 'persisting'} across encounters`
    case 'lab_trend':
      return `${topic}: lab values ${f.trend === 'unknown' ? 'changing' : f.trend}`
    case 'repeated_treatment_no_improvement':
      return 'Repeated treatment without improvement'
    case 'multiple_specialist_visits':
      return `${topic} seen across multiple specialties`
    case 'unresolved_referral':
      return 'Specialist referral not yet scheduled'
    case 'care_gap':
      return `Care gap: ${topic.toLowerCase()}`
  }
}

/** Numeric series behind a flag: symptom severity for symptom patterns, lab values for lab trends. */
export function flagSeries(f: TrendFlag, events: HealthEvent[]) {
  const topicEvents = events.filter((e) => e.topic === f.topic).sort((a, b) => a.event_date.localeCompare(b.event_date))
  if (f.pattern_type === 'lab_trend') {
    const labs = topicEvents.filter((e) => e.event_type === 'lab' && e.value != null)
    if (labs.length < 2) return undefined
    return { label: labs[0].description.split(' ')[0], unit: labs[0].unit ?? '', max: undefined as number | undefined, points: labs.map((e) => ({ date: e.event_date, value: e.value!, event_id: e.event_id })) }
  }
  if (f.pattern_type === 'persistent_symptom') {
    const sx = topicEvents.filter((e) => e.event_type === 'symptom' && e.severity != null)
    if (sx.length < 2) return undefined
    return { label: 'Reported severity', unit: '/5', max: 5, points: sx.map((e) => ({ date: e.event_date, value: e.severity!, event_id: e.event_id })) }
  }
  return undefined
}

export type FlagSeries = NonNullable<ReturnType<typeof flagSeries>>
