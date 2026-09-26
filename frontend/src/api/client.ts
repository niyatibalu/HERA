// HERA API client, following docs/API_CONTRACT.md (feature/backend).
// When VITE_HERA_API_URL is set, requests go to the backend. Otherwise, or when a request fails,
// the client falls back to synthetic demo data so the patient journey always works on stage.
import type {
  CareJourney,
  CareState,
  HealthEvent,
  Patient,
  PatientRecord,
  ProviderMatch,
  ResearchConsent,
  RouteOptionsResponse,
  StudyMatch,
  TrendFlag,
} from '../types'
import { DEMO_TODAY, mockRecord } from '../mocks/record'
import { mockFlags } from '../mocks/timeline'
import { mockJourneys, mockProviderMatches, mockRouteOptions } from '../mocks/care'
import { mockStudyMatches } from '../mocks/research'
import { addDays } from '../lib/format'
import { REMATCH_NOTE_PREFIX, requiredSpecialty } from '../lib/providers'

export type DataSource = 'live' | 'demo'

export interface ApiResult<T> {
  data: T
  source: DataSource
}

const env = import.meta.env as Record<string, string | undefined>
const API_BASE = env.VITE_HERA_API_URL?.replace(/\/$/, '')
const MAP_BASE = env.VITE_HERA_MAP_URL?.replace(/\/$/, '')

export const DEMO_PATIENT_ID = 'maya-001'

// ---------- change notifications (so every screen reflects a mutation) ----------
const listeners = new Set<() => void>()
export function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}
const notify = () => listeners.forEach((fn) => fn())

// ---------- transport ----------
async function http<T>(base: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${base}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } })
  if (!res.ok) throw new Error(`${init?.method ?? 'GET'} ${path} → ${res.status}`)
  return (await res.json()) as T
}

const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) })

/** Runs `live` against a configured service; on any failure (or no service), uses `demo`. */
async function withFallback<T>(base: string | undefined, live: (base: string) => Promise<T>, demo: () => T): Promise<ApiResult<T>> {
  if (!base) return { data: demo(), source: 'demo' }
  try {
    return { data: await live(base), source: 'live' }
  } catch (err) {
    console.warn('[HERA] backend unavailable, using demo data:', err)
    return { data: demo(), source: 'demo' }
  }
}

// ---------- in-memory demo state ----------
const clone = <T>(x: T): T => structuredClone(x)
const freshConsent = (): ResearchConsent => ({ patient_id: DEMO_PATIENT_ID, consent: false, scope: 'de_identified_cohort_matching', revoked: false })
let demoJourneys = clone(mockJourneys)
let demoConsent = freshConsent()

/** Test helper: reset in-memory demo state. */
export function resetDemoState() {
  demoJourneys = clone(mockJourneys)
  demoConsent = freshConsent()
}

function demoJourney(journeyId: string) {
  const j = demoJourneys.find((x) => x.journey_id === journeyId)
  if (!j) throw new Error(`Unknown journey ${journeyId}`)
  return j
}

function demoAdvance(journeyId: string, state: CareState, note?: string) {
  const j = demoJourney(journeyId)
  j.state = state
  j.stalled = false
  j.stalled_reason = null
  j.state_history.push({ state, entered_at: DEMO_TODAY, note })
  return j
}

interface AdvanceBody {
  state: CareState
  note: string
  provider_id?: string
  appointment_date?: string
}

/**
 * Transitions recorded when a patient picks a provider: matched → records shared → scheduled.
 * provider_id and appointment_date travel as fields (docs/API_CONTRACT.md, advance); the notes
 * are human-readable history.
 */
function selectionSteps(providerId: string, providerName: string, appointmentDate: string): AdvanceBody[] {
  return [
    { state: 'provider_matched', note: `${REMATCH_NOTE_PREFIX} ${providerName}`, provider_id: providerId },
    { state: 'records_ready', note: 'Longitudinal record shared with new provider' },
    { state: 'appointment_scheduled', note: `Appointment booked for ${appointmentDate}`, appointment_date: appointmentDate },
  ]
}

export const api = {
  /** GET /patients/{id} + /health-events, plus the provider directory from /providers. */
  getRecord: (patientId: string) =>
    withFallback<PatientRecord>(
      API_BASE,
      async (base) => {
        const [patient, events] = await Promise.all([
          http<Patient>(base, `/patients/${patientId}`),
          http<HealthEvent[]>(base, `/patients/${patientId}/health-events`),
        ])
        const matches = await http<ProviderMatch[]>(base, `/patients/${patientId}/providers?specialty=${requiredSpecialty(events)}`)
        return { patient, events, providers: matches.map((m) => m.provider), record_sources: mockRecord.record_sources }
      },
      () => mockRecord,
    ),

  getFlags: (patientId: string) =>
    withFallback<TrendFlag[]>(API_BASE, (base) => http(base, `/patients/${patientId}/trend-flags?as_of=${DEMO_TODAY}`), () => mockFlags),

  getJourneys: (patientId: string) =>
    withFallback<CareJourney[]>(API_BASE, (base) => http(base, `/patients/${patientId}/care-journeys`), () => clone(demoJourneys)),

  getProviderMatches: (patientId: string, specialty: string) =>
    withFallback<ProviderMatch[]>(
      API_BASE,
      (base) => http(base, `/patients/${patientId}/providers?specialty=${encodeURIComponent(specialty)}`),
      () => mockProviderMatches,
    ),

  /** Books a provider by advancing the journey, setting provider_id and appointment_date on the way. */
  async selectProvider(patientId: string, journeyId: string, match: ProviderMatch) {
    const appt = addDays(DEMO_TODAY, match.provider.wait_days)
    const steps = selectionSteps(match.provider.provider_id, match.provider.name, appt)
    const r = await withFallback<CareJourney>(
      API_BASE,
      async (base) => {
        let j: CareJourney | undefined
        for (const s of steps) j = await http<CareJourney>(base, `/patients/${patientId}/care-journeys/${journeyId}/advance`, post(s))
        return j!
      },
      () => {
        const j = demoJourney(journeyId)
        for (const s of steps) demoAdvance(journeyId, s.state, s.note)
        Object.assign(j, { provider_id: match.provider.provider_id, appointment_date: appt })
        return clone(j)
      },
    )
    notify()
    return r
  },

  async planTravel(patientId: string, journeyId: string, routeLabel: string) {
    const body = { state: 'travel_planned' as CareState, note: `${routeLabel} selected` }
    const r = await withFallback<CareJourney>(
      API_BASE,
      (base) => http(base, `/patients/${patientId}/care-journeys/${journeyId}/advance`, post(body)),
      () => clone(demoAdvance(journeyId, body.state, body.note)),
    )
    notify()
    return r
  },

  /** GET {MAP_URL}/routes (docs/MAP_API.md, feature/access-map). `providerId` is the destination. */
  getRouteOptions: (patientId: string, journeyId: string, providerId?: string) => {
    const q = new URLSearchParams({ patient_id: patientId, journey_id: journeyId })
    if (providerId) q.set('provider_id', providerId)
    return withFallback<RouteOptionsResponse>(MAP_BASE, (base) => http(base, `/routes?${q}`), () => mockRouteOptions)
  },

  getConsent: (patientId: string) =>
    withFallback<ResearchConsent>(API_BASE, (base) => http(base, `/patients/${patientId}/research-consent`), () => clone(demoConsent)),

  async setConsent(patientId: string, consent: boolean) {
    const r = await withFallback<ResearchConsent>(
      API_BASE,
      (base) => http(base, `/patients/${patientId}/research-consent`, post({ consent })),
      () => {
        // Same semantics as backend/app/data/store.py: declining records a revocation.
        const today = new Date().toISOString().slice(0, 10)
        demoConsent = consent
          ? { ...demoConsent, consent: true, consent_timestamp: today, revoked: false, revoked_timestamp: null }
          : { ...demoConsent, revoked: true, revoked_timestamp: today }
        return clone(demoConsent)
      },
    )
    notify()
    return r
  },

  /** GET /study-matches joined with GET /studies for titles. Always [] without active consent. */
  getStudyMatches: (patientId: string) =>
    withFallback<StudyMatch[]>(
      API_BASE,
      async (base) => {
        const [matches, studies] = await Promise.all([
          http<StudyMatch[]>(base, `/patients/${patientId}/study-matches`),
          http<{ study_id: string; title: string; description: string }[]>(base, '/studies'),
        ])
        return matches.map((m) => {
          const s = studies.find((x) => x.study_id === m.study_id)
          return { ...m, title: s?.title, description: s?.description }
        })
      },
      () => (demoConsent.consent && !demoConsent.revoked ? mockStudyMatches : []),
    ),
}
