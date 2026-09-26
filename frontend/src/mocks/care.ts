// SYNTHETIC DATA — care journeys, provider matching and route options for the demo.
// Providers mirror backend/app/data/providers.py.
import type { CareJourney, ProviderMatch, RouteOptionsResponse } from '../types'
import { mockProviders } from './record'

const byId = (id: string) => mockProviders.find((p) => p.provider_id === id)!

export const mockJourneys: CareJourney[] = [
  {
    journey_id: 'jr-specialist',
    patient_id: 'maya-001',
    need: 'Chronic pelvic pain specialist evaluation',
    state: 'records_ready',
    provider_id: 'prov-original-specialist',
    appointment_date: null,
    stalled: true,
    stalled_reason: 'The referred specialist has a 61-day wait, is out of network for MidwestCare PPO, and is 122 miles away.',
    state_history: [
      { state: 'need_identified', entered_at: '2025-12-08', note: 'Referral placed by Dr. Sarah Lindqvist' },
      { state: 'provider_matched', entered_at: '2025-12-08', note: 'Referred to Dr. Renee Whitfield (Chicago, IL)' },
      { state: 'records_ready', entered_at: '2025-12-08', note: '24 records packaged for the specialist' },
    ],
  },
  {
    journey_id: 'jr-obgyn',
    patient_id: 'maya-001',
    need: 'OB/GYN evaluation — pelvic pain and heavy bleeding',
    state: 'followup_completed',
    provider_id: 'prov-obgyn-01',
    appointment_date: '2025-08-15',
    stalled: false,
    state_history: [
      { state: 'need_identified', entered_at: '2025-07-08', note: 'Referral placed by Dr. Alicia Foster' },
      { state: 'provider_matched', entered_at: '2025-07-08', note: 'Dr. Sarah Lindqvist · in network' },
      { state: 'records_ready', entered_at: '2025-07-09' },
      { state: 'appointment_scheduled', entered_at: '2025-07-10', note: 'Aug 15' },
      { state: 'travel_planned', entered_at: '2025-08-12' },
      { state: 'appointment_completed', entered_at: '2025-08-15' },
      { state: 'followup_required', entered_at: '2025-08-15', note: 'Pelvic ultrasound and repeat visit' },
      { state: 'followup_completed', entered_at: '2025-09-22', note: 'Ultrasound reviewed at follow-up' },
    ],
  },
]

/**
 * The provider the Dec 8 referral originally went to. The backend's seeded journey does not carry
 * a provider_id yet, so the frontend falls back to this id to show "original vs. alternatives".
 */
export const ORIGINAL_REFERRAL_PROVIDER_ID = 'prov-original-specialist'

const PLAN = 'MidwestCare PPO'

/**
 * Mirrors GET /patients/maya-001/providers?specialty=chronic_pelvic_pain: every provider, ranked,
 * scored with the backend's weights (backend/app/engine/matching.py).
 */
export const mockProviderMatches: ProviderMatch[] = [
  {
    provider: byId('prov-alt-best'), score: 92.3, distance_mi: 1.7,
    match_reasons: ['Specialty match: chronic pelvic pain', `In-network for ${PLAN}`, 'Short wait: 12 days', 'Close to home: 1.7 mi', 'Telehealth available', 'Speaks es'],
    access_tradeoffs: [],
  },
  {
    provider: byId('prov-pcp-01'), score: 75.0, distance_mi: 0,
    match_reasons: [`In-network for ${PLAN}`, 'Short wait: 3 days', 'Close to home: 0.0 mi', 'Telehealth available', 'Speaks es'],
    access_tradeoffs: ['Not a specialty match for chronic pelvic pain (provider is primary care)'],
  },
  {
    provider: byId('prov-obgyn-01'), score: 72.1, distance_mi: 0.7,
    match_reasons: [`In-network for ${PLAN}`, 'Short wait: 5 days', 'Close to home: 0.7 mi', 'Telehealth available'],
    access_tradeoffs: ['Not a specialty match for chronic pelvic pain (provider is obgyn)', 'No confirmed es language support'],
  },
  {
    provider: byId('prov-alt-ok'), score: 67.2, distance_mi: 6.1,
    match_reasons: [`In-network for ${PLAN}`, 'Close to home: 6.1 mi', 'Telehealth available'],
    access_tradeoffs: ['Not a specialty match for chronic pelvic pain (provider is gynecology)', 'No confirmed es language support'],
  },
  {
    provider: byId('prov-original-specialist'), score: 36.6, distance_mi: 122.3,
    match_reasons: ['Specialty match: chronic pelvic pain'],
    access_tradeoffs: [`Out of network for ${PLAN}`, 'Long wait: 61 days', 'Far from home: 122.3 mi', 'High estimated cost: $420', 'No confirmed es language support'],
  },
]

// Placeholder for the access-map teammate's routing output (feature/access-map).
export const mockRouteOptions: RouteOptionsResponse = {
  destination: 'Dr. Ifeoma Okafor — Madison, WI',
  appointment_date: '2025-12-29',
  options: [
    { route_id: 'r-fast', mode: 'fastest', label: 'Fastest route', duration_minutes: 12, summary: 'Residential streets via Regent St', conditions: ['Ice advisory', 'Unplowed side streets'], recommended: false },
    { route_id: 'r-safe', mode: 'safer', label: 'Safer route', duration_minutes: 16, summary: 'Beltline (US-12) and Park St, both major roads', conditions: ['Priority plow routes', 'Passes 2 medical facilities'], recommended: true },
    { route_id: 'r-transit', mode: 'transit', label: 'Public transit', duration_minutes: 31, summary: 'Metro Transit Route A with 1 transfer', conditions: ['Step-free buses', '6 min walk'], recommended: false },
    { route_id: 'r-tele', mode: 'telehealth', label: 'Telehealth alternative', summary: 'Video intake with Dr. Okafor’s clinic', conditions: ['Available Dec 22'], recommended: false },
  ],
}
