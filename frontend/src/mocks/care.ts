// SYNTHETIC DATA — care journeys, provider matching and route options for the demo.
// Providers mirror backend/app/data/providers.py.
import type { CareJourney, ProviderSearchResponse, RouteOptionsResponse } from '../types'
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
    stalled_reason: 'The referred specialist has a 61-day wait, is out of network for MidwestCare PPO, and is 147 miles away.',
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

export const mockProviderSearch: ProviderSearchResponse = {
  journey_id: 'jr-specialist',
  need: 'Chronic pelvic pain specialist evaluation',
  original: {
    provider: byId('prov-original-specialist'),
    match_score: 0.41,
    distance_miles: 147,
    in_network: false,
    reasons: ['Relevant expertise in chronic pelvic pain and endometriosis'],
  },
  barriers: ['61-day wait', '147 miles away', 'Out of network', 'No telehealth'],
  alternatives: [
    {
      provider: byId('prov-alt-best'),
      match_score: 0.93,
      distance_miles: 2,
      in_network: true,
      reasons: [
        'Chronic pelvic pain and pelvic floor expertise matches the referral',
        'In network for MidwestCare PPO: about $95',
        'Seen in 12 days instead of 61',
        'Speaks Spanish, Maya’s preferred language',
        'Offers telehealth for follow-ups',
      ],
    },
    {
      provider: byId('prov-alt-ok'),
      match_score: 0.64,
      distance_miles: 7,
      in_network: true,
      reasons: [
        'In network and nearby',
        'General gynecology, with no specific chronic pelvic pain expertise',
        '21-day wait',
      ],
    },
  ],
}

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
