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


/**
 * Mirrors GET /patients/maya-001/providers?specialty=chronic_pelvic_pain with Maya's seeded preferences
 * (backend/app/data/store.py): every provider, ranked,
 * scored with the backend's weights (backend/app/engine/matching.py).
 */
export const mockProviderMatches: ProviderMatch[] = [
  { provider: byId("prov-alt-best"), score: 91.5, distance_mi: 1.7, match_reasons: ["Expertise you asked for: chronic pelvic pain", "In-network for MidwestCare PPO", "Short wait: 12 days", "Close to home: 1.7 mi", "Within your budget: $95 per visit", "Offers sliding-scale fees / financial assistance", "Telehealth available", "Speaks es", "Rated 4.8/5 by 126 patients", "Has appointments when you're free: weekday afternoons, weekday evenings", "Matches your preference for a female clinician"], access_tradeoffs: [] },
  { provider: byId("prov-pfpt-madison"), score: 88.5, distance_mi: 2.9, match_reasons: ["Expertise you asked for: chronic pelvic pain", "In-network for MidwestCare PPO", "Short wait: 5 days", "Close to home: 2.9 mi", "Within your budget: $60 per visit", "Offers sliding-scale fees / financial assistance", "Telehealth available", "Rated 4.8/5 by 143 patients", "Has appointments when you're free: weekday evenings", "Matches your preference for a female clinician"], access_tradeoffs: ["No confirmed es language support"] },
  { provider: byId("prov-tele-nwosu"), score: 86.9, distance_mi: 75.5, match_reasons: ["Expertise you asked for: chronic pelvic pain, endometriosis", "In-network for MidwestCare PPO", "Short wait: 4 days", "Within your budget: $75 per visit", "Offers sliding-scale fees / financial assistance", "Telehealth available", "Speaks es", "Rated 4.6/5 by 84 patients", "Has appointments when you're free: weekday evenings", "Matches your preference for a female clinician"], access_tradeoffs: ["Beyond your 30 mi travel limit (75.5 mi)"] },
  { provider: byId("prov-cpp-fitchburg"), score: 86.8, distance_mi: 8.5, match_reasons: ["Expertise you asked for: chronic pelvic pain, endometriosis", "In-network for MidwestCare PPO", "Close to home: 8.5 mi", "Within your budget: $110 per visit", "Offers sliding-scale fees / financial assistance", "Telehealth available", "Speaks es", "Rated 4.6/5 by 92 patients", "Has appointments when you're free: weekday afternoons, weekday evenings"], access_tradeoffs: ["Not a female clinician (your preference)"] },
  { provider: byId("prov-gyn-riley"), score: 85.4, distance_mi: 0.6, match_reasons: ["Expertise you asked for: chronic pelvic pain", "In-network for MidwestCare PPO", "Short wait: 10 days", "Close to home: 0.6 mi", "Within your budget: $100 per visit", "Offers sliding-scale fees / financial assistance", "Telehealth available", "Speaks es", "Rated 4.8/5 by 77 patients", "Has appointments when you're free: weekday evenings"], access_tradeoffs: ["Not a female clinician (your preference)"] },
  { provider: byId("prov-endo-madison"), score: 82.0, distance_mi: 2.5, match_reasons: ["Expertise you asked for: chronic pelvic pain, endometriosis", "In-network for MidwestCare PPO", "Close to home: 2.5 mi", "Rated 4.9/5 by 188 patients", "Has appointments when you're free: weekday afternoons", "Matches your preference for a female clinician"], access_tradeoffs: ["Above your $150 budget: $180 per visit", "No sliding-scale or financial assistance program listed", "No confirmed es language support"] },
  { provider: byId("prov-alt-telehealth"), score: 78.9, distance_mi: 71.0, match_reasons: ["Expertise you asked for: chronic pelvic pain", "In-network for MidwestCare PPO", "Short wait: 6 days", "Within your budget: $70 per visit", "Offers sliding-scale fees / financial assistance", "Telehealth available", "Rated 4.7/5 by 97 patients", "Has appointments when you're free: weekday evenings", "Matches your preference for a female clinician"], access_tradeoffs: ["Beyond your 30 mi travel limit (71.0 mi)", "No confirmed es language support"] },
  { provider: byId("prov-endo-milwaukee"), score: 74.8, distance_mi: 73.3, match_reasons: ["Expertise you asked for: chronic pelvic pain, endometriosis", "In-network for MidwestCare PPO", "Telehealth available", "Rated 4.8/5 by 201 patients", "Has appointments when you're free: weekday afternoons", "Matches your preference for a female clinician"], access_tradeoffs: ["Beyond your 30 mi travel limit (73.3 mi)", "Above your $150 budget: $170 per visit", "No sliding-scale or financial assistance program listed", "No confirmed es language support"] },
  { provider: byId("prov-rei-madison"), score: 73.6, distance_mi: 0.8, match_reasons: ["Expertise you asked for: endometriosis", "In-network for MidwestCare PPO", "Close to home: 0.8 mi", "Telehealth available", "Rated 4.7/5 by 120 patients", "Matches your preference for a female clinician"], access_tradeoffs: ["Long wait: 30 days", "Above your $150 budget: $210 per visit", "No sliding-scale or financial assistance program listed", "No confirmed es language support", "No appointments at the times you said you're free"] },
  { provider: byId("prov-pcp-01"), score: 73.4, distance_mi: 0.0, match_reasons: ["In-network for MidwestCare PPO", "Short wait: 3 days", "Close to home: 0.0 mi", "Within your budget: $40 per visit", "Offers sliding-scale fees / financial assistance", "Telehealth available", "Speaks es", "Has appointments when you're free: weekday afternoons", "Matches your preference for a female clinician"], access_tradeoffs: ["Not a match for chronic pelvic pain, endometriosis (provider is primary care)"] },
  { provider: byId("prov-cpp-janesville"), score: 73.0, distance_mi: 33.2, match_reasons: ["Expertise you asked for: chronic pelvic pain", "In-network for MidwestCare PPO", "Short wait: 9 days", "Within your budget: $90 per visit", "Offers sliding-scale fees / financial assistance", "Telehealth available", "Rated 4.5/5 by 64 patients", "Matches your preference for a female clinician"], access_tradeoffs: ["Beyond your 30 mi travel limit (33.2 mi)", "No confirmed es language support", "No appointments at the times you said you're free"] },
  { provider: byId("prov-obgyn-01"), score: 69.1, distance_mi: 0.7, match_reasons: ["In-network for MidwestCare PPO", "Short wait: 5 days", "Close to home: 0.7 mi", "Within your budget: $150 per visit", "Telehealth available", "Rated 4.6/5 by 143 patients", "Has appointments when you're free: weekday afternoons", "Matches your preference for a female clinician"], access_tradeoffs: ["Not a match for chronic pelvic pain, endometriosis (provider is obgyn)", "No sliding-scale or financial assistance program listed", "No confirmed es language support"] },
  { provider: byId("prov-pain-sunprairie"), score: 66.8, distance_mi: 12.2, match_reasons: ["Expertise you asked for: chronic pelvic pain", "Short wait: 7 days", "Close to home: 12.2 mi", "Within your budget: $130 per visit", "Telehealth available", "Has appointments when you're free: weekday afternoons"], access_tradeoffs: ["Out of network for MidwestCare PPO", "No sliding-scale or financial assistance program listed", "No confirmed es language support", "Not a female clinician (your preference)"] },
  { provider: byId("prov-pfpt-middleton"), score: 62.3, distance_mi: 5.5, match_reasons: ["In-network for MidwestCare PPO", "Short wait: 3 days", "Close to home: 5.5 mi", "Within your budget: $65 per visit", "Telehealth available", "Rated 4.6/5 by 58 patients", "Has appointments when you're free: weekday evenings"], access_tradeoffs: ["Not a match for chronic pelvic pain, endometriosis (provider is pelvic floor physical therapy)", "No sliding-scale or financial assistance program listed", "No confirmed es language support", "Not a female clinician (your preference)"] },
  { provider: byId("prov-gyn-baraboo"), score: 59.0, distance_mi: 32.5, match_reasons: ["In-network for MidwestCare PPO", "Short wait: 6 days", "Within your budget: $85 per visit", "Offers sliding-scale fees / financial assistance", "Telehealth available", "Has appointments when you're free: weekday afternoons", "Matches your preference for a female clinician"], access_tradeoffs: ["Not a match for chronic pelvic pain, endometriosis (provider is gynecology)", "Beyond your 30 mi travel limit (32.5 mi)", "No confirmed es language support"] },
  { provider: byId("prov-alt-ok"), score: 53.7, distance_mi: 6.1, match_reasons: ["In-network for MidwestCare PPO", "Close to home: 6.1 mi", "Within your budget: $140 per visit", "Telehealth available"], access_tradeoffs: ["Not a match for chronic pelvic pain, endometriosis (provider is gynecology)", "No sliding-scale or financial assistance program listed", "No confirmed es language support", "No appointments at the times you said you're free", "Not a female clinician (your preference)"] },
  { provider: byId("prov-urogyn-madison"), score: 53.1, distance_mi: 4.0, match_reasons: ["In-network for MidwestCare PPO", "Short wait: 14 days", "Close to home: 4.0 mi", "Has appointments when you're free: weekday afternoons"], access_tradeoffs: ["Not a match for chronic pelvic pain, endometriosis (provider is urogynecology)", "Above your $150 budget: $160 per visit", "No sliding-scale or financial assistance program listed", "No confirmed es language support", "Not a female clinician (your preference)"] },
  { provider: byId("prov-original-specialist"), score: 48.6, distance_mi: 122.3, match_reasons: ["Expertise you asked for: chronic pelvic pain, endometriosis", "Rated 4.9/5 by 212 patients", "Matches your preference for a female clinician"], access_tradeoffs: ["Out of network for MidwestCare PPO", "Long wait: 61 days", "Beyond your 30 mi travel limit (122.3 mi)", "Above your $150 budget: $420 per visit", "No sliding-scale or financial assistance program listed", "No confirmed es language support", "No appointments at the times you said you're free"] },
  { provider: byId("prov-pcp-02"), score: 40.3, distance_mi: 75.5, match_reasons: ["Short wait: 4 days", "Within your budget: $35 per visit", "Telehealth available", "Rated 4.5/5 by 74 patients", "Has appointments when you're free: weekday afternoons"], access_tradeoffs: ["Not a match for chronic pelvic pain, endometriosis (provider is primary care)", "Out of network for MidwestCare PPO", "Beyond your 30 mi travel limit (75.5 mi)", "No sliding-scale or financial assistance program listed", "No confirmed es language support", "Not a female clinician (your preference)"] },
]

// Placeholder for the access-map teammate's routing output (feature/access-map).
export const mockRouteOptions: RouteOptionsResponse = {
  destination: 'Dr. Ifeoma Okafor — Madison, WI',
  appointment_date: '2025-12-29',
  options: [
    { route_id: 'r-fast', mode: 'fastest', label: 'Fastest route', duration_minutes: 12, summary: 'Residential streets via Regent St', conditions: ['Ice advisory', 'Unplowed side streets'], recommended: false },
    { route_id: 'r-safe', mode: 'safer', label: 'Lower-risk route', duration_minutes: 16, summary: 'Beltline (US-12) and Park St, both major roads', conditions: ['Priority plow routes', 'Passes 2 medical facilities'], recommended: true },
    { route_id: 'r-transit', mode: 'transit', label: 'Public transit', duration_minutes: 31, summary: 'Metro Transit Route A with 1 transfer', conditions: ['Step-free buses', '6 min walk'], recommended: false },
    { route_id: 'r-tele', mode: 'telehealth', label: 'Telehealth alternative', summary: 'Video intake with Dr. Okafor’s clinic', conditions: ['Available Dec 22'], recommended: false },
  ],
}
