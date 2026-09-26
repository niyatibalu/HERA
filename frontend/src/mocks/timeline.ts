// SYNTHETIC DATA — the flags the backend longitudinal engine is designed to produce for Maya
// (see the pattern list in backend/app/data/synthetic_patients.py). Every flag cites evidence
// events from mocks/record.ts.
import type { TrendFlag } from '../types'

const base = { patient_id: 'maya-001', action: 'clinician_review', generated_at: '2025-12-17' }

export const mockFlags: TrendFlag[] = [
  {
    ...base,
    flag_id: 'flag-pelvic-pain',
    pattern_type: 'persistent_symptom',
    topic: 'pelvic_pain',
    first_seen: '2025-01-14',
    last_seen: '2025-12-08',
    encounter_count: 6,
    trend: 'worsening',
    message: 'Pelvic pain has been documented across 6 encounters over 11 months, and reported severity has increased from 2/5 to 4/5. Consider reviewing the full longitudinal history.',
    evidence: [
      { event_id: 'ev-002', event_date: '2025-01-14', excerpt: 'Intermittent lower pelvic pain, roughly two weeks.' },
      { event_id: 'ev-005', event_date: '2025-03-02', excerpt: 'Pelvic pain persists, now described as sharper.' },
      { event_id: 'ev-010', event_date: '2025-07-08', excerpt: 'Pain now daily, 7/10 at worst, interfering with work.' },
      { event_id: 'ev-015', event_date: '2025-09-22', excerpt: 'Pain unchanged, now persistent for over six months.' },
      { event_id: 'ev-019', event_date: '2025-12-08', excerpt: 'No improvement on adjusted hormonal therapy; pain persists.' },
    ],
  },
  {
    ...base,
    flag_id: 'flag-ferritin',
    pattern_type: 'lab_trend',
    topic: 'iron_deficiency',
    first_seen: '2025-05-19',
    last_seen: '2025-08-15',
    encounter_count: 2,
    trend: 'worsening',
    message: 'Ferritin declined from 22 to 8 ng/mL between May and August, after iron supplementation began. Heavy menstrual bleeding was documented during the same period.',
    evidence: [
      { event_id: 'ev-006', event_date: '2025-05-19', excerpt: 'Ferritin 22 ng/mL, low-normal.' },
      { event_id: 'ev-008', event_date: '2025-05-19', excerpt: 'Started oral ferrous sulfate supplementation.' },
      { event_id: 'ev-013', event_date: '2025-08-15', excerpt: 'Ferritin re-checked at 8 ng/mL, declined from prior 22 ng/mL.' },
    ],
  },
  {
    ...base,
    flag_id: 'flag-treatment',
    pattern_type: 'repeated_treatment_no_improvement',
    topic: 'pelvic_pain',
    first_seen: '2025-09-22',
    last_seen: '2025-12-08',
    encounter_count: 2,
    trend: 'stable',
    message: 'Two hormonal therapy trials have been documented for pelvic pain without reported improvement.',
    evidence: [
      { event_id: 'ev-016', event_date: '2025-09-22', excerpt: 'Trial of combined hormonal contraceptive for symptom management.' },
      { event_id: 'ev-018', event_date: '2025-12-08', excerpt: 'Hormonal therapy dose adjusted; second medication trial for pelvic pain.' },
      { event_id: 'ev-019', event_date: '2025-12-08', excerpt: 'No improvement on adjusted hormonal therapy; pain persists.' },
    ],
  },
  {
    ...base,
    flag_id: 'flag-specialists',
    pattern_type: 'multiple_specialist_visits',
    topic: 'pelvic_pain',
    first_seen: '2025-01-14',
    last_seen: '2025-12-08',
    encounter_count: 5,
    trend: 'unknown',
    message: 'Pelvic pain has been evaluated in primary care and OB/GYN by 2 clinicians without a documented resolution.',
    evidence: [
      { event_id: 'ev-001', event_date: '2025-01-14', excerpt: 'Primary care visit for new-onset lower pelvic pain.' },
      { event_id: 'ev-009', event_date: '2025-07-08', excerpt: 'Return visit: pelvic pain worsened despite supplementation.' },
      { event_id: 'ev-012', event_date: '2025-08-15', excerpt: 'Initial OB/GYN evaluation for pelvic pain.' },
      { event_id: 'ev-014', event_date: '2025-09-22', excerpt: 'Second OB/GYN visit; pelvic ultrasound reviewed, no clear structural cause.' },
      { event_id: 'ev-017', event_date: '2025-12-08', excerpt: 'Hormonal therapy trial reviewed; symptoms persist despite adjustment.' },
    ],
  },
  {
    ...base,
    flag_id: 'flag-referral',
    pattern_type: 'unresolved_referral',
    topic: 'pelvic_pain',
    first_seen: '2025-12-08',
    last_seen: '2025-12-08',
    encounter_count: 1,
    trend: 'unknown',
    message: 'A referral to a chronic pelvic pain specialist placed on Dec 8 has not been scheduled after 9 days.',
    evidence: [{ event_id: 'ev-020', event_date: '2025-12-08', excerpt: 'Referred to a chronic pelvic pain / pelvic floor specialist.' }],
  },
]
