import { afterEach, describe, expect, it, vi } from 'vitest'
import { mockEvents, mockRecord } from '../mocks/record'
import { mockProviderMatches } from '../mocks/care'

// Exercises the client against docs/API_CONTRACT.md paths with a stubbed backend.
async function loadClient() {
  vi.resetModules()
  vi.stubEnv('VITE_HERA_API_URL', 'http://api.test')
  return (await import('../api/client')).api
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('API client (live backend)', () => {
  it('assembles the record from /patients/{id}, /health-events and /providers', async () => {
    const calls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      calls.push(url.replace('http://api.test', ''))
      if (url.endsWith('/patients/maya-001')) return json(mockRecord.patient)
      if (url.endsWith('/health-events')) return json(mockEvents)
      if (url.includes('/providers?specialty=chronic_pelvic_pain')) return json(mockProviderMatches)
      return json({ detail: 'not found' }, 404)
    }))
    const api = await loadClient()
    const r = await api.getRecord('maya-001')
    expect(r.source).toBe('live')
    expect(r.data.patient.name).toBe('Maya Restrepo')
    expect(r.data.providers.map((p) => p.provider_id)).toContain('prov-alt-best')
    expect(calls).toEqual(['/patients/maya-001', '/patients/maya-001/health-events', '/patients/maya-001/providers?specialty=chronic_pelvic_pain'])
  })

  it('joins study titles onto study matches', async () => {
    const urls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      urls.push(url)
      if (url.endsWith('/study-matches')) return json([{ study_id: 'study-a', candidate_id: 'c-1', eligibility_status: 'potentially_eligible', criteria_satisfied: [], criteria_unknown: [], reason: 'r' }])
      if (url.endsWith('/studies')) return json([{ study_id: 'study-a', title: 'Chronic Pelvic Pain Study', description: 'd' }])
      return json({}, 404)
    }))
    const api = await loadClient()
    const m = await api.getStudyMatches('maya-001')
    expect(urls[0]).toBe('http://api.test/patients/maya-001/study-matches')
    expect(m.data[0].title).toBe('Chronic Pelvic Pain Study')
  })

  it('books a provider at a chosen time through /advance', async () => {
    const bodies: { state: string; note: string; provider_id?: string; appointment_date?: string }[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe('http://api.test/patients/maya-001/care-journeys/journey-0001/advance')
      bodies.push(JSON.parse(String(init?.body)))
      return json({ journey_id: 'journey-0001', state: bodies[bodies.length - 1].state, state_history: [] })
    }))
    const api = await loadClient()
    const journey = { journey_id: 'journey-0001', patient_id: 'maya-001', need: 'x', state: 'need_identified' as const, state_history: [{ state: 'need_identified' as const, entered_at: '2025-12-08' }], stalled: false }
    await api.selectProvider('maya-001', journey, mockProviderMatches[0], { date: '2025-12-30', time: '17:30', modality: 'in_person' })
    expect(bodies.map((b) => b.state)).toEqual(['provider_matched', 'records_ready', 'appointment_scheduled'])
    expect(bodies[0]).toMatchObject({ provider_id: 'prov-alt-best' })
    expect(bodies[0].note).toContain('Dr. Ifeoma Okafor')
    expect(bodies.every((b) => b.provider_id === 'prov-alt-best')).toBe(true)
    expect(bodies[2]).toMatchObject({ appointment_date: '2025-12-30', appointment_time: '17:30', appointment_modality: 'in_person' })
    expect(bodies[2].note).toContain('at 5:30 PM (in person)')
  })

  it('falls back to synthetic data when the backend is down', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const api = await loadClient()
    const r = await api.getJourneys('maya-001')
    expect(r.source).toBe('demo')
    expect(r.data[0].journey_id).toBe('jr-specialist')
  })
})

describe('API client (access map)', () => {
  it('passes the chosen provider as the route destination', async () => {
    const urls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      urls.push(url)
      return json({ destination: 'Dr. Ifeoma Okafor — Madison, WI', appointment_date: '2025-12-29', options: [] })
    }))
    vi.resetModules()
    vi.stubEnv('VITE_HERA_MAP_URL', 'http://map.test')
    const { api } = await import('../api/client')
    const r = await api.getRouteOptions('maya-001', 'journey-0001', 'prov-alt-best')
    expect(r.source).toBe('live')
    expect(urls[0]).toBe('http://map.test/routes?patient_id=maya-001&journey_id=journey-0001&provider_id=prov-alt-best')
  })
})
