import type { CareJourney, PatientRecord, SymptomLogEntry } from '../types'
import { formatDate, specialtyLabel } from './format'
import { isComplete } from './journey'
import { providerLookup } from './record'

export const TIMING_LABEL: Record<SymptomLogEntry['timing'], string> = {
  before_visit: 'Before visit',
  after_visit: 'After visit',
  general: 'Note',
}

export const COMMON_SYMPTOMS = ['Pelvic pain', 'Heavy bleeding', 'Fatigue', 'Bloating', 'Pain during sex', 'Painful periods', 'Nausea', 'Headache', 'Mood changes', 'Back pain']

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Visits a note can be attached to: upcoming care needs first, then past visits, newest first. */
export function visitOptions(record: PatientRecord, journeys: CareJourney[]): string[] {
  const provider = providerLookup(record.providers)
  const upcoming = journeys.filter((j) => !isComplete(j)).map((j) => `${cap(j.need)} (upcoming)`)
  const past = record.events
    .filter((e) => e.event_type === 'encounter')
    .sort((a, b) => b.event_date.localeCompare(a.event_date))
    .map((e) => [specialtyLabel(e.specialty), provider(e.provider_id)?.name, formatDate(e.event_date)].filter(Boolean).join(' · '))
  return [...new Set([...upcoming, ...past])]
}

export interface VisitGroup {
  visit: string | null
  latest: string
  before: SymptomLogEntry[]
  after: SymptomLogEntry[]
  general: SymptomLogEntry[]
}

/** Notes grouped by the visit they belong to (general notes together), most recent group first. */
export function groupByVisit(entries: SymptomLogEntry[]): VisitGroup[] {
  const groups = new Map<string, VisitGroup>()
  for (const e of entries) {
    const key = e.timing === 'general' || !e.visit ? '' : e.visit
    const g = groups.get(key) ?? { visit: key || null, latest: e.logged_on, before: [], after: [], general: [] }
    if (e.logged_on > g.latest) g.latest = e.logged_on
    ;(e.timing === 'before_visit' ? g.before : e.timing === 'after_visit' ? g.after : g.general).push(e)
    groups.set(key, g)
  }
  const byDate = (a: SymptomLogEntry, b: SymptomLogEntry) => a.logged_on.localeCompare(b.logged_on)
  for (const g of groups.values()) [g.before, g.after, g.general].forEach((l) => l.sort(byDate))
  // Visit groups first (most recent first); general notes last.
  return [...groups.values()].sort((a, b) => Number(!a.visit) - Number(!b.visit) || b.latest.localeCompare(a.latest))
}
