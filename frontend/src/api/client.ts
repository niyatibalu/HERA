// HERA API client.
// When VITE_HERA_API_URL is set, requests go to the backend (feature/backend).
// Otherwise, or when a request fails, the client falls back to synthetic demo data
// so the patient journey always works on stage.
import type {
  CareJourney,
  HealthRecord,
  ProviderSearchResponse,
  ResearchConsent,
  RouteOptionsResponse,
  StudyMatch,
  TimelineResponse,
} from '../types'
import { mockRecord } from '../mocks/record'
import { mockTimeline } from '../mocks/timeline'
import { mockJourneys, mockProviderSearch, mockRouteOptions } from '../mocks/care'
import { mockStudyMatches } from '../mocks/research'

export type DataSource = 'live' | 'demo'

export interface ApiResult<T> {
  data: T
  source: DataSource
}

const API_BASE = (import.meta.env.VITE_HERA_API_URL as string | undefined)?.replace(/\/$/, '')
const MAP_BASE = (import.meta.env.VITE_HERA_MAP_URL as string | undefined)?.replace(/\/$/, '')

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

// Consent is held in memory when no backend is connected.
let demoConsent: ResearchConsent = { consent_status: 'not_asked' }

export const api = {
  getRecord: (patientId: string) =>
    request<HealthRecord>(API_BASE, `/patients/${patientId}/record`, () => mockRecord),

  getTimeline: (patientId: string) =>
    request<TimelineResponse>(API_BASE, `/patients/${patientId}/timeline`, () => mockTimeline),

  searchProviders: (patientId: string, careNeed: string) =>
    request<ProviderSearchResponse>(
      API_BASE,
      `/patients/${patientId}/providers?care_need=${encodeURIComponent(careNeed)}`,
      () => mockProviderSearch,
    ),

  getJourneys: (patientId: string) =>
    request<CareJourney[]>(API_BASE, `/patients/${patientId}/journeys`, () => mockJourneys),

  getRouteOptions: (patientId: string, journeyId: string) =>
    request<RouteOptionsResponse>(MAP_BASE, `/patients/${patientId}/journeys/${journeyId}/routes`, () => mockRouteOptions),

  getConsent: (patientId: string) =>
    request<ResearchConsent>(API_BASE, `/patients/${patientId}/research/consent`, () => demoConsent),

  setConsent: (patientId: string, consent_status: 'granted' | 'declined') =>
    request<ResearchConsent>(
      API_BASE,
      `/patients/${patientId}/research/consent`,
      () => {
        demoConsent = { consent_status, updated_at: new Date().toISOString() }
        return demoConsent
      },
      { method: 'POST', body: JSON.stringify({ consent_status }) },
    ),

  getStudyMatches: (patientId: string) =>
    request<StudyMatch[]>(API_BASE, `/patients/${patientId}/research/matches`, () => mockStudyMatches),
}

export const DEMO_PATIENT_ID = 'demo-001'

/** Test helper: reset in-memory demo state. */
export function resetDemoState() {
  demoConsent = { consent_status: 'not_asked' }
}
