// SYNTHETIC DATA — Maya's care preferences, symptom notes and MyChart link.
// Mirrors the seeds in backend/app/data/store.py so demo mode matches the live backend.
import type { CarePreferences, MyChartConnection, SymptomLogEntry } from '../types'

export const mockPreferences: CarePreferences = {
  patient_id: 'maya-001',
  max_cost_usd: 150,
  needs_financial_assistance: true,
  insurance_plan: null,
  max_distance_mi: 30,
  expertise: ['chronic_pelvic_pain', 'endometriosis'],
  min_rating: 4,
  availability: ['weekday_afternoon', 'weekday_evening'],
  telehealth: 'no_preference',
  provider_gender: 'female',
  updated_at: '2025-12-08',
}

const entry = (n: number, e: Omit<SymptomLogEntry, 'entry_id' | 'patient_id' | 'tags'>): SymptomLogEntry => ({
  entry_id: `sym-${String(n).padStart(4, '0')}`,
  patient_id: 'maya-001',
  tags: [],
  ...e,
})

/** Newest first, like GET /symptom-log. */
export const mockSymptomLog: SymptomLogEntry[] = [
  entry(5, { logged_on: '2025-12-16', symptom: 'Fatigue', severity: 6, timing: 'general', visit: null, note: 'Tired and dizzy on stairs. Taking iron most days.' }),
  entry(4, { logged_on: '2025-12-15', symptom: 'Pelvic pain', severity: 8, timing: 'before_visit', visit: 'Chronic pelvic pain specialist evaluation (upcoming)', note: 'Pain most days now. Questions: could this be endometriosis? Is pelvic floor PT an option?' }),
  entry(3, { logged_on: '2025-09-24', symptom: 'Heavy bleeding', severity: 6, timing: 'after_visit', visit: 'OB/GYN · Dr. Sarah Lindqvist · Sep 22', note: 'Ultrasound was clear. Still soaking through pads overnight.' }),
  entry(2, { logged_on: '2025-08-18', symptom: 'Pelvic pain', severity: 7, timing: 'after_visit', visit: 'OB/GYN · Dr. Sarah Lindqvist · Aug 15', note: 'Switched hormonal therapy and ordered an ultrasound. Pain about the same so far.' }),
  entry(1, { logged_on: '2025-08-12', symptom: 'Pelvic pain', severity: 7, timing: 'before_visit', visit: 'OB/GYN · Dr. Sarah Lindqvist · Aug 15', note: "Cramping most mornings, worse the week before my period. Missed 2 days of work this month. Ask why the pill isn't helping." }),
]

export const MYCHART_SCOPES = ['visits', 'conditions', 'medications', 'labs', 'imaging', 'referrals', 'clinical_notes'] as const

export const mockMyChartNotConnected: MyChartConnection = {
  patient_id: 'maya-001',
  status: 'not_connected',
  simulated: true,
  scopes: [],
  organizations: [],
  imported: {},
}

export const mockMyChartConnected = (today: string): MyChartConnection => ({
  patient_id: 'maya-001',
  status: 'connected',
  simulated: true,
  connected_at: today,
  last_synced_at: today,
  scopes: [...MYCHART_SCOPES],
  organizations: [
    { name: 'Lakeview Primary Care', system_type: 'ehr' },
    { name: 'Capitol Women’s Health', system_type: 'patient_portal' },
    { name: 'Dane County Clinical Labs', system_type: 'lab' },
  ],
  imported: { encounter: 7, symptom: 6, lab: 2, medication: 3, referral: 2 },
})

/** Synthetic demo sign-in. Mirrors backend/app/routes/auth.py; used when the backend can't be reached. */
export const DEMO_LOGIN = { email: 'maya@example.com', password: 'HeraDemo2025!', patient_id: 'maya-001', name: 'Maya Restrepo' }
