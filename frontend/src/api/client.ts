// HERA API client, following docs/API_CONTRACT.md (feature/backend).
// When VITE_HERA_API_URL is set, requests go to the backend. Otherwise, or when a request fails,
// the client falls back to synthetic demo data so the patient journey always works on stage.
import type {
  CarePreferences,
  CareJourney,
  CareState,
  HealthEvent,
  Patient,
  PatientRecord,
  ProviderMatch,
  MyChartConnection,
  NewSymptomLogEntry,
  ResearchConsent,
  SymptomLogEntry,
  RouteOptionsResponse,
  StudyMatch,
} from '../types'
import { DEMO_TODAY, mockRecord } from '../mocks/record'
import { mockJourneys, mockProviderMatches, mockRouteOptions } from '../mocks/care'
import { mockStudyMatches } from '../mocks/research'
import { DEMO_LOGIN, mockMyChartConnected, mockMyChartNotConnected, mockPreferences, mockSymptomLog } from '../mocks/patient'
import { currentSession, setSession, type Session } from '../lib/auth'
import { formatTime, modalityLabel, type Booking, type Modality } from '../lib/scheduling'
import { REMATCH_NOTE_PREFIX, requiredSpecialty } from '../lib/providers'
import { ORDER, reachedState } from '../lib/journey'

export type DataSource = 'live' | 'demo'

export interface ApiResult<T> {
  data: T
  source: DataSource
}

const env = import.meta.env as Record<string, string | undefined>
const API_BASE = env.VITE_HERA_API_URL?.replace(/\/$/, '')
const MAP_BASE = env.VITE_HERA_MAP_URL?.replace(/\/$/, '')

export const DEMO_PATIENT_ID = 'maya-001'

/** Access map service base URL (VITE_HERA_MAP_URL), used to embed the interactive map. */
export const MAP_URL = MAP_BASE

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
let demoPreferences = clone(mockPreferences)
let demoSymptoms = clone(mockSymptomLog)
let demoMyChart = clone(mockMyChartNotConnected)
let demoSymptomSeq = mockSymptomLog.length

/** Test helper: reset in-memory demo state. */
export function resetDemoState() {
  demoJourneys = clone(mockJourneys)
  demoConsent = freshConsent()
  demoPreferences = clone(mockPreferences)
  demoSymptoms = clone(mockSymptomLog)
  demoMyChart = clone(mockMyChartNotConnected)
  demoSymptomSeq = mockSymptomLog.length
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
  appointment_time?: string
  appointment_modality?: Modality
}

/**
 * Transitions recorded when a patient picks a provider: matched → records shared → scheduled.
 * provider_id and appointment_date travel as fields (docs/API_CONTRACT.md, advance); the notes
 * are human-readable history.
 */
function selectionSteps(providerId: string, providerName: string, b: Booking): AdvanceBody[] {
  return [
    { state: 'provider_matched', note: `${REMATCH_NOTE_PREFIX} ${providerName}`, provider_id: providerId },
    { state: 'records_ready', note: 'Longitudinal record shared with new provider' },
    {
      state: 'appointment_scheduled',
      note: `Appointment booked for ${b.date} at ${formatTime(b.time)} (${modalityLabel(b.modality).toLowerCase()})`,
      appointment_date: b.date,
      appointment_time: b.time,
      appointment_modality: b.modality,
    },
  ]
}

export class InvalidCredentials extends Error {}

/** Signs in against the backend; if the backend can't be reached, checks the synthetic demo account locally. */
export async function signIn(email: string, password: string): Promise<Session> {
  const e = email.trim().toLowerCase()
  if (API_BASE) {
    let res: Response | undefined
    try {
      res = await fetch(`${API_BASE}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: e, password }) })
    } catch (err) {
      console.warn('[HERA] backend unavailable for sign-in, using demo account check:', err)
    }
    if (res?.status === 401) throw new InvalidCredentials('Email or password is incorrect')
    if (res?.ok) {
      const s = (await res.json()) as Session
      setSession(s)
      return s
    }
  }
  if (e !== DEMO_LOGIN.email || password !== DEMO_LOGIN.password) throw new InvalidCredentials('Email or password is incorrect')
  const s: Session = { token: 'demo-offline', email: e, patient_id: DEMO_LOGIN.patient_id, name: DEMO_LOGIN.name }
  setSession(s)
  return s
}

export async function signOut() {
  const s = currentSession()
  setSession(null)
  if (API_BASE && s && s.token !== 'demo-offline') {
    await fetch(`${API_BASE}/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${s.token}` } }).catch(() => undefined)
  }
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

  getJourneys: (patientId: string) =>
    withFallback<CareJourney[]>(API_BASE, (base) => http(base, `/patients/${patientId}/care-journeys`), () => clone(demoJourneys)),

  getProviderMatches: (patientId: string, specialty: string) =>
    withFallback<ProviderMatch[]>(
      API_BASE,
      (base) => http(base, `/patients/${patientId}/providers?specialty=${encodeURIComponent(specialty)}`),
      () => mockProviderMatches,
    ),

  /** Books a provider by advancing the journey, setting provider_id and appointment_date on the way. */
  /** Books a provider at a chosen time by advancing the journey: matched → records shared → scheduled. */
  async selectProvider(patientId: string, journey: CareJourney, match: ProviderMatch, booking: Booking) {
    // Skip steps the journey already passed (e.g. rebooking after a cancellation keeps records shared).
    const reached = ORDER.indexOf(reachedState(journey))
    const steps = selectionSteps(match.provider.provider_id, match.provider.name, booking)
      .filter((st) => ORDER.indexOf(st.state) > reached || st.state === 'appointment_scheduled')
      .map((st) => ({ ...st, provider_id: match.provider.provider_id }))
    const journeyId = journey.journey_id
    const r = await withFallback<CareJourney>(
      API_BASE,
      async (base) => {
        let j: CareJourney | undefined
        for (const st of steps) j = await http<CareJourney>(base, `/patients/${patientId}/care-journeys/${journeyId}/advance`, post(st))
        return j!
      },
      () => {
        const j = demoJourney(journeyId)
        for (const st of steps) demoAdvance(journeyId, st.state, st.note)
        Object.assign(j, {
          provider_id: match.provider.provider_id,
          appointment_date: booking.date,
          appointment_time: booking.time,
          appointment_modality: booking.modality,
        })
        return clone(j)
      },
    )
    notify()
    return r
  },

  /** Cancels a booked appointment; the journey returns to "records shared" with the same provider. */
  async cancelAppointment(patientId: string, journeyId: string, reason?: string) {
    const r = await withFallback<CareJourney>(
      API_BASE,
      (base) => http(base, `/patients/${patientId}/care-journeys/${journeyId}/cancel-appointment`, post({ reason: reason || null })),
      () => {
        const j = demoJourney(journeyId)
        Object.assign(j, { appointment_date: null, appointment_time: null, appointment_modality: null })
        demoAdvance(journeyId, 'records_ready', `Appointment cancelled${reason ? `: ${reason}` : ''}`)
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
  getRouteOptions: (patientId: string, journeyId: string, providerId?: string, pregnant = false) => {
    const q = new URLSearchParams({ patient_id: patientId, journey_id: journeyId })
    if (providerId) q.set('provider_id', providerId)
    if (pregnant) q.set('pregnant', '1')
    return withFallback<RouteOptionsResponse>(MAP_BASE, (base) => http(base, `/routes?${q}`), () => mockRouteOptions)
  },

  // ---------- care preferences ----------

  getPreferences: (patientId: string) =>
    withFallback<CarePreferences>(API_BASE, (base) => http(base, `/patients/${patientId}/preferences`), () => clone(demoPreferences)),

  /** Saves preferences; provider matches re-rank on the next load. */
  async savePreferences(patientId: string, prefs: CarePreferences) {
    const { patient_id: _id, updated_at: _at, ...body } = prefs
    const r = await withFallback<CarePreferences>(
      API_BASE,
      (base) => http(base, `/patients/${patientId}/preferences`, { method: 'PUT', body: JSON.stringify(body) }),
      () => (demoPreferences = { ...clone(prefs), patient_id: patientId, updated_at: DEMO_TODAY }),
    )
    notify()
    return r
  },

  // ---------- symptom log ----------

  getSymptomLog: (patientId: string) =>
    withFallback<SymptomLogEntry[]>(API_BASE, (base) => http(base, `/patients/${patientId}/symptom-log`), () => clone(demoSymptoms)),

  async addSymptom(patientId: string, entry: NewSymptomLogEntry) {
    const body = { ...entry, visit: entry.timing === 'general' ? null : entry.visit || null }
    const r = await withFallback<SymptomLogEntry>(
      API_BASE,
      (base) => http(base, `/patients/${patientId}/symptom-log`, post(body)),
      () => {
        const e: SymptomLogEntry = { ...body, symptom: body.symptom.trim(), entry_id: `sym-${String(++demoSymptomSeq).padStart(4, '0')}`, patient_id: patientId, logged_on: DEMO_TODAY, tags: [] }
        demoSymptoms = [e, ...demoSymptoms]
        return clone(e)
      },
    )
    notify()
    return r
  },

  async deleteSymptom(patientId: string, entryId: string) {
    const r = await withFallback<null>(
      API_BASE,
      async (base) => {
        const res = await fetch(`${base}/patients/${patientId}/symptom-log/${entryId}`, { method: 'DELETE' })
        if (!res.ok) throw new Error(`DELETE symptom-log → ${res.status}`)
        return null
      },
      () => {
        demoSymptoms = demoSymptoms.filter((e) => e.entry_id !== entryId)
        return null
      },
    )
    notify()
    return r
  },

  // ---------- MyChart (simulated) ----------

  getMyChart: (patientId: string) =>
    withFallback<MyChartConnection>(API_BASE, (base) => http(base, `/patients/${patientId}/mychart`), () => clone(demoMyChart)),

  async connectMyChart(patientId: string) {
    const r = await withFallback<MyChartConnection>(
      API_BASE,
      (base) => http(base, `/patients/${patientId}/mychart/connect`, post({})),
      () => (demoMyChart = mockMyChartConnected(DEMO_TODAY)),
    )
    notify()
    return r
  },

  async disconnectMyChart(patientId: string) {
    const r = await withFallback<MyChartConnection>(
      API_BASE,
      (base) => http(base, `/patients/${patientId}/mychart/disconnect`, post({})),
      () => (demoMyChart = clone(mockMyChartNotConnected)),
    )
    notify()
    return r
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
