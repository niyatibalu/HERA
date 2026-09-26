// SYNTHETIC DATA — fictional patient for the hackathon demo. No real patient information.
// Mirrors backend/app/data/synthetic_patients.py and providers.py (feature/backend) so the
// demo tells the same story whether or not the backend is running.
import type { HealthEvent, PatientRecord, Provider } from '../types'

/** "Today" inside the demo story: 9 days after Maya's Dec 8 specialist referral. */
export const DEMO_TODAY = '2025-12-17'

const PID = 'maya-001'

type EventInput = Omit<HealthEvent, 'patient_id' | 'source'>
const ev = (e: EventInput): HealthEvent => ({ patient_id: PID, source: 'mock_ehr_adapter', ...e })

export const mockEvents: HealthEvent[] = [
  ev({ event_id: 'ev-001', event_type: 'encounter', event_date: '2025-01-14', topic: 'pelvic_pain', specialty: 'primary_care', provider_id: 'prov-pcp-01', description: 'Primary care visit for new-onset lower pelvic pain.', status: 'active' }),
  ev({ event_id: 'ev-002', event_type: 'symptom', event_date: '2025-01-14', topic: 'pelvic_pain', specialty: 'primary_care', provider_id: 'prov-pcp-01', description: 'Intermittent lower pelvic pain, roughly two weeks.', severity: 2, status: 'active' }),
  ev({ event_id: 'ev-003', event_type: 'encounter', event_date: '2025-03-02', topic: 'heavy_menstrual_bleeding', specialty: 'primary_care', provider_id: 'prov-pcp-01', description: 'Follow-up visit; new complaint of heavy menstrual bleeding.', status: 'active' }),
  ev({ event_id: 'ev-004', event_type: 'symptom', event_date: '2025-03-02', topic: 'heavy_menstrual_bleeding', specialty: 'primary_care', provider_id: 'prov-pcp-01', description: 'Soaking through pads within an hour on heaviest days.', severity: 3, status: 'active' }),
  ev({ event_id: 'ev-005', event_type: 'symptom', event_date: '2025-03-02', topic: 'pelvic_pain', specialty: 'primary_care', provider_id: 'prov-pcp-01', description: 'Pelvic pain persists, now described as sharper.', severity: 3, status: 'active' }),
  ev({ event_id: 'ev-006', event_type: 'lab', event_date: '2025-05-19', topic: 'iron_deficiency', specialty: 'primary_care', provider_id: 'prov-pcp-01', description: 'Ferritin 22 ng/mL, low-normal.', value: 22, unit: 'ng/mL', status: 'active' }),
  ev({ event_id: 'ev-007', event_type: 'encounter', event_date: '2025-05-19', topic: 'iron_deficiency', specialty: 'primary_care', provider_id: 'prov-pcp-01', description: 'Labs reviewed; iron deficiency likely related to heavy menstrual bleeding.', status: 'active' }),
  ev({ event_id: 'ev-008', event_type: 'medication', event_date: '2025-05-19', topic: 'iron_deficiency', specialty: 'primary_care', provider_id: 'prov-pcp-01', description: 'Started oral ferrous sulfate supplementation.', status: 'active', raw: { treatment_category: 'iron_supplementation' } }),
  ev({ event_id: 'ev-009', event_type: 'encounter', event_date: '2025-07-08', topic: 'pelvic_pain', specialty: 'primary_care', provider_id: 'prov-pcp-01', description: 'Return visit: pelvic pain worsened despite supplementation.', status: 'active' }),
  ev({ event_id: 'ev-010', event_type: 'symptom', event_date: '2025-07-08', topic: 'pelvic_pain', specialty: 'primary_care', provider_id: 'prov-pcp-01', description: 'Pain now daily, 7/10 at worst, interfering with work.', severity: 4, status: 'active' }),
  ev({ event_id: 'ev-011', event_type: 'referral', event_date: '2025-07-08', topic: 'pelvic_pain', specialty: 'obgyn', provider_id: 'prov-pcp-01', description: 'Referred to OB/GYN for persistent pelvic pain and heavy menstrual bleeding.', status: 'completed' }),
  ev({ event_id: 'ev-012', event_type: 'encounter', event_date: '2025-08-15', topic: 'pelvic_pain', specialty: 'obgyn', provider_id: 'prov-obgyn-01', description: 'Initial OB/GYN evaluation for pelvic pain.', status: 'active' }),
  ev({ event_id: 'ev-013', event_type: 'lab', event_date: '2025-08-15', topic: 'iron_deficiency', specialty: 'obgyn', provider_id: 'prov-obgyn-01', description: 'Ferritin re-checked at 8 ng/mL, declined from prior 22 ng/mL.', value: 8, unit: 'ng/mL', status: 'active' }),
  ev({ event_id: 'ev-014', event_type: 'encounter', event_date: '2025-09-22', topic: 'pelvic_pain', specialty: 'obgyn', provider_id: 'prov-obgyn-01', description: 'Second OB/GYN visit; pelvic ultrasound reviewed, no clear structural cause.', status: 'active' }),
  ev({ event_id: 'ev-015', event_type: 'symptom', event_date: '2025-09-22', topic: 'pelvic_pain', specialty: 'obgyn', provider_id: 'prov-obgyn-01', description: 'Pain unchanged, now persistent for over six months.', severity: 4, status: 'active' }),
  ev({ event_id: 'ev-016', event_type: 'medication', event_date: '2025-09-22', topic: 'pelvic_pain', specialty: 'obgyn', provider_id: 'prov-obgyn-01', description: 'Trial of combined hormonal contraceptive for symptom management.', status: 'active', raw: { treatment_category: 'hormonal_therapy' } }),
  ev({ event_id: 'ev-017', event_type: 'encounter', event_date: '2025-12-08', topic: 'pelvic_pain', specialty: 'obgyn', provider_id: 'prov-obgyn-01', description: 'Hormonal therapy trial reviewed; symptoms persist despite adjustment.', status: 'active' }),
  ev({ event_id: 'ev-018', event_type: 'medication', event_date: '2025-12-08', topic: 'pelvic_pain', specialty: 'obgyn', provider_id: 'prov-obgyn-01', description: 'Hormonal therapy dose adjusted; second medication trial for pelvic pain.', status: 'active', raw: { treatment_category: 'hormonal_therapy' } }),
  ev({ event_id: 'ev-019', event_type: 'symptom', event_date: '2025-12-08', topic: 'pelvic_pain', specialty: 'obgyn', provider_id: 'prov-obgyn-01', description: 'No improvement on adjusted hormonal therapy; pain persists.', severity: 4, status: 'active' }),
  ev({ event_id: 'ev-020', event_type: 'referral', event_date: '2025-12-08', topic: 'pelvic_pain', specialty: 'chronic_pelvic_pain', provider_id: 'prov-obgyn-01', description: 'Referred to a chronic pelvic pain / pelvic floor specialist.', status: 'pending' }),

  // Frontend-only additions (not yet in backend synthetic data) so the unified record has
  // documented conditions and the imaging study referenced in ev-014.
  ev({ event_id: 'ev-f01', event_type: 'diagnosis', event_date: '2025-01-14', topic: 'pelvic_pain', specialty: 'primary_care', provider_id: 'prov-pcp-01', description: 'Pelvic pain', status: 'ongoing', raw: { icd10: 'R10.2' } }),
  ev({ event_id: 'ev-f02', event_type: 'diagnosis', event_date: '2025-03-02', topic: 'heavy_menstrual_bleeding', specialty: 'primary_care', provider_id: 'prov-pcp-01', description: 'Heavy menstrual bleeding', status: 'active', raw: { icd10: 'N92.0' } }),
  ev({ event_id: 'ev-f03', event_type: 'diagnosis', event_date: '2025-05-19', topic: 'iron_deficiency', specialty: 'primary_care', provider_id: 'prov-pcp-01', description: 'Iron deficiency', status: 'active', raw: { icd10: 'E61.1' } }),
  ev({ event_id: 'ev-f04', event_type: 'imaging', event_date: '2025-09-10', topic: 'pelvic_pain', specialty: 'obgyn', provider_id: 'prov-obgyn-01', description: 'Transvaginal pelvic ultrasound: no clear structural cause identified.', status: 'completed' }),
]

const madison = (lat: number, lon: number, address = 'Madison, WI') => ({ lat, lon, address })

export const mockProviders: Provider[] = [
  { provider_id: 'prov-pcp-01', name: 'Dr. Alicia Foster', specialty: 'primary_care', location: madison(43.0731, -89.4012), wait_days: 3, telehealth_available: true, in_network_plans: ['MidwestCare PPO', 'MidwestCare HMO'], estimated_cost_usd: 40, accessibility_features: ['wheelchair_accessible'], languages: ['en', 'es'], expertise_tags: ['primary_care'] },
  { provider_id: 'prov-obgyn-01', name: 'Dr. Sarah Lindqvist', specialty: 'obgyn', location: madison(43.08, -89.39), wait_days: 5, telehealth_available: true, in_network_plans: ['MidwestCare PPO'], estimated_cost_usd: 150, accessibility_features: ['wheelchair_accessible'], languages: ['en'], expertise_tags: ['obstetrics', 'general_gynecology'] },
  { provider_id: 'prov-original-specialist', name: 'Dr. Renee Whitfield', specialty: 'chronic_pelvic_pain', location: madison(41.8781, -87.6298, 'Chicago, IL'), wait_days: 61, telehealth_available: false, in_network_plans: [], estimated_cost_usd: 420, accessibility_features: [], languages: ['en'], expertise_tags: ['chronic_pelvic_pain', 'endometriosis'] },
  { provider_id: 'prov-alt-best', name: 'Dr. Ifeoma Okafor', specialty: 'chronic_pelvic_pain', location: madison(43.0625, -89.4306), wait_days: 12, telehealth_available: true, in_network_plans: ['MidwestCare PPO', 'MidwestCare HMO'], estimated_cost_usd: 95, accessibility_features: ['wheelchair_accessible', 'ground_floor_entrance'], languages: ['en', 'es'], expertise_tags: ['chronic_pelvic_pain', 'pelvic_floor_dysfunction'] },
  { provider_id: 'prov-alt-telehealth', name: 'Kara Whitmore, DPT', specialty: 'pelvic_floor_physical_therapy', location: madison(42.9633, -88.0034, 'Waukesha, WI'), wait_days: 6, telehealth_available: true, in_network_plans: ['MidwestCare PPO', 'MidwestCare HMO'], estimated_cost_usd: 70, accessibility_features: ['wheelchair_accessible'], languages: ['en'], expertise_tags: ['chronic_pelvic_pain', 'pelvic_floor_dysfunction'] },
  { provider_id: 'prov-alt-ok', name: 'Dr. Michael Chen', specialty: 'gynecology', location: madison(43.15, -89.34, 'Sun Prairie, WI'), wait_days: 21, telehealth_available: true, in_network_plans: ['MidwestCare PPO'], estimated_cost_usd: 140, accessibility_features: [], languages: ['en'], expertise_tags: ['general_gynecology'] },
]

export const mockRecord: PatientRecord = {
  patient: {
    patient_id: PID,
    name: 'Maya Restrepo',
    date_of_birth: '1996-04-12',
    sex: 'female',
    insurance_plan: 'MidwestCare PPO',
    home_location: { lat: 43.0731, lon: -89.4012, address: 'Madison, WI' },
    preferred_language: 'es',
    mobility_constraints: [],
    accessibility_needs: [],
  },
  events: mockEvents,
  providers: mockProviders,
  record_sources: [
    { source_id: 'src-pcp', name: 'Lakeview Primary Care', system_type: 'ehr', status: 'connected', last_synced_at: '2025-12-17T08:14:00', simulated: true },
    { source_id: 'src-obgyn', name: 'Capitol Women’s Health', system_type: 'patient_portal', status: 'connected', last_synced_at: '2025-12-17T08:14:00', simulated: true },
    { source_id: 'src-labs', name: 'Dane County Clinical Labs', system_type: 'lab', status: 'connected', last_synced_at: '2025-12-17T06:02:00', simulated: true },
  ],
}
