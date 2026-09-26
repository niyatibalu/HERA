// Turns the backend's flat HealthEvent list into the sections of a unified record.
import type { EventType, HealthEvent, PatientRecord, Provider } from '../types'
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
