// HERA API client.
// When VITE_HERA_API_URL is set, requests go to the backend (feature/backend).
// Otherwise, or when a request fails, the client falls back to synthetic demo data
// so the patient journey always works on stage.
import type {
  CareJourney,
  PatientRecord,
  ProviderSearchResponse,
  ResearchConsent,
  RouteOptionsResponse,
  StudyMatch,
  TrendFlag,
} from '../types'
import { DEMO_TODAY, mockRecord } from '../mocks/record'
import { mockFlags } from '../mocks/timeline'
import { mockJourneys, mockProviderSearch, mockRouteOptions } from '../mocks/care'
import { mockStudyMatches } from '../mocks/research'
import { addDays } from '../lib/format'

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

// ---------- in-memory demo state ----------
const clone = <T>(x: T): T => structuredClone(x)
let demoJourneys = clone(mockJourneys)
let demoConsent: ResearchConsent = { patient_id: DEMO_PATIENT_ID, consent: false, scope: 'de_identified_cohort_matching', revoked: false }
let demoConsentAsked = false

/** Test helper: reset in-memory demo state. */
export function resetDemoState() {
  demoJourneys = clone(mockJourneys)
  demoConsent = { patient_id: DEMO_PATIENT_ID, consent: false, scope: 'de_identified_cohort_matching', revoked: false }
  demoConsentAsked = false
}

async function request<T>(base: string | undefined, path: string, fallback: () => T, init?: RequestInit): Promise<ApiResult<T>> {
  if (!base) return { data: fallback(), source: 'demo' }
  try {
    const res = await fetch(`${base}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    return { data: (await res.json()) as T, source: 'live' }
  } catch (err) {
    console.warn(`[HERA] ${path} unavailable, using demo data:`, err)
    return { data: fallback(), source: 'demo' }
  }
}

function demoSelectProvider(journeyId: string, providerId: string): CareJourney {
  const j = demoJourneys.find((x) => x.journey_id === journeyId)
  const match = [mockProviderSearch.original, ...mockProviderSearch.alternatives].find((m) => m.provider.provider_id === providerId)
  if (!j || !match) throw new Error('Unknown journey or provider')
  const appt = addDays(DEMO_TODAY, match.provider.wait_days)
  const keep = j.state_history.filter((t) => t.state === 'need_identified')
  Object.assign(j, {
    provider_id: providerId,
    state: 'appointment_scheduled',
    appointment_date: appt,
    stalled: false,
    stalled_reason: null,
    state_history: [
      ...keep,
      { state: 'provider_matched', entered_at: DEMO_TODAY, note: `Re-matched by HERA to ${match.provider.name}` },
      { state: 'records_ready', entered_at: DEMO_TODAY, note: 'Longitudinal record shared with new provider' },
      { state: 'appointment_scheduled', entered_at: DEMO_TODAY, note: `Appointment booked for ${appt}` },
    ],
  } satisfies Partial<CareJourney>)
  return clone(j)
}

export const api = {
  getRecord: (patientId: string) =>
    request<PatientRecord>(API_BASE, `/patients/${patientId}/record`, () => mockRecord),

  getFlags: (patientId: string) =>
    request<TrendFlag[]>(API_BASE, `/patients/${patientId}/flags`, () => mockFlags),

  getJourneys: (patientId: string) =>
    request<CareJourney[]>(API_BASE, `/patients/${patientId}/journeys`, () => clone(demoJourneys)),

  getProviderOptions: (patientId: string, journeyId: string) =>
    request<ProviderSearchResponse>(API_BASE, `/patients/${patientId}/journeys/${journeyId}/provider-options`, () => mockProviderSearch),

  async selectProvider(patientId: string, journeyId: string, providerId: string) {
    const r = await request<CareJourney>(
      API_BASE,
      `/patients/${patientId}/journeys/${journeyId}/provider`,
      () => demoSelectProvider(journeyId, providerId),
      { method: 'POST', body: JSON.stringify({ provider_id: providerId }) },
    )
    notify()
    return r
  },

  async planTravel(patientId: string, journeyId: string, routeId: string, routeLabel: string) {
    const r = await request<CareJourney>(
      API_BASE,
      `/patients/${patientId}/journeys/${journeyId}/travel`,
      () => {
        const j = demoJourneys.find((x) => x.journey_id === journeyId)
        if (!j) throw new Error('Unknown journey')
        j.state = 'travel_planned'
        j.state_history = [...j.state_history.filter((t) => t.state !== 'travel_planned'), { state: 'travel_planned', entered_at: DEMO_TODAY, note: `${routeLabel} selected` }]
        return clone(j)
      },
      { method: 'POST', body: JSON.stringify({ route_id: routeId }) },
    )
    notify()
    return r
  },

  getRouteOptions: (patientId: string, journeyId: string) =>
    request<RouteOptionsResponse>(MAP_BASE, `/routes?patient_id=${patientId}&journey_id=${journeyId}`, () => mockRouteOptions),

  getConsent: (patientId: string) =>
    request<ResearchConsent & { asked?: boolean }>(API_BASE, `/patients/${patientId}/research/consent`, () => ({ ...demoConsent, asked: demoConsentAsked })),

  async setConsent(patientId: string, consent: boolean) {
    const r = await request<ResearchConsent>(
      API_BASE,
      `/patients/${patientId}/research/consent`,
      () => {
        demoConsentAsked = true
        const now = new Date().toISOString().slice(0, 10)
        demoConsent = consent
          ? { ...demoConsent, consent: true, consent_timestamp: now, revoked: false, revoked_timestamp: null }
          : { ...demoConsent, revoked: demoConsent.consent, revoked_timestamp: demoConsent.consent ? now : null, consent: false }
        return demoConsent
      },
      { method: 'POST', body: JSON.stringify({ consent }) },
    )
    notify()
    return r
  },

  getStudyMatches: (patientId: string) =>
    request<StudyMatch[]>(API_BASE, `/patients/${patientId}/research/matches`, () => (demoConsent.consent ? mockStudyMatches : [])),
}
