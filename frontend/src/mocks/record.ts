// SYNTHETIC DATA — fictional patient for the hackathon demo. No real patient information.
import type { HealthRecord } from '../types'

export const DEMO_TODAY = '2026-09-26'

export const mockRecord: HealthRecord = {
  patient: {
    patient_id: 'demo-001',
    display_name: 'Amara Lindqvist',
    date_of_birth: '1997-04-12',
    age: 29,
    insurance_plan: 'NorthStar Health PPO',
    primary_care_provider: 'Dr. Helen Marsh, MD',
    home_location: { city: 'Ely', state: 'MN', rural: true },
    record_sources: [
      { source_id: 'src-lakeside', name: 'Lakeside Family Medicine', system_type: 'ehr', status: 'connected', last_synced_at: '2026-09-26T08:14:00', simulated: true },
      { source_id: 'src-northland', name: 'Northland Regional Health', system_type: 'patient_portal', status: 'connected', last_synced_at: '2026-09-26T08:14:00', simulated: true },
      { source_id: 'src-iron-range', name: 'Iron Range Urgent Care', system_type: 'ehr', status: 'connected', last_synced_at: '2026-09-25T21:40:00', simulated: true },
      { source_id: 'src-labs', name: 'Arrowhead Clinical Labs', system_type: 'lab', status: 'connected', last_synced_at: '2026-09-26T06:02:00', simulated: true },
    ],
  },
  diagnoses: [
    { diagnosis_id: 'dx-1', name: 'Chronic pelvic pain', icd10_code: 'R10.2', status: 'under_evaluation', first_recorded_date: '2025-11-04', recorded_by: 'Dr. Helen Marsh', source_id: 'src-lakeside' },
    { diagnosis_id: 'dx-2', name: 'Heavy menstrual bleeding', icd10_code: 'N92.0', status: 'active', first_recorded_date: '2026-03-10', recorded_by: 'Dr. Helen Marsh', source_id: 'src-lakeside' },
    { diagnosis_id: 'dx-3', name: 'Iron deficiency', icd10_code: 'E61.1', status: 'active', first_recorded_date: '2026-05-06', recorded_by: 'Dr. Helen Marsh', source_id: 'src-lakeside' },
    { diagnosis_id: 'dx-4', name: 'Dysmenorrhea', icd10_code: 'N94.6', status: 'active', first_recorded_date: '2026-01-15', recorded_by: 'Dr. Priya Raman', source_id: 'src-northland' },
    { diagnosis_id: 'dx-5', name: 'Seasonal allergic rhinitis', icd10_code: 'J30.2', status: 'resolved', first_recorded_date: '2023-05-02', recorded_by: 'Dr. Helen Marsh', source_id: 'src-lakeside' },
  ],
  medications: [
    { medication_id: 'med-1', name: 'Norethindrone-ethinyl estradiol', dose: '1 mg / 20 mcg', frequency: 'Daily', status: 'active', start_date: '2026-01-15', prescriber: 'Dr. Priya Raman', reason: 'Dysmenorrhea' },
    { medication_id: 'med-2', name: 'Ferrous sulfate', dose: '325 mg', frequency: 'Every other day', status: 'active', start_date: '2026-05-20', prescriber: 'Dr. Helen Marsh', reason: 'Iron deficiency' },
    { medication_id: 'med-3', name: 'Naproxen', dose: '500 mg', frequency: 'As needed', status: 'active', start_date: '2025-12-02', prescriber: 'Iron Range Urgent Care', reason: 'Pelvic pain' },
    { medication_id: 'med-4', name: 'Ibuprofen', dose: '400 mg', frequency: 'As needed', status: 'discontinued', start_date: '2025-11-04', end_date: '2025-12-02', prescriber: 'Dr. Helen Marsh', reason: 'Pelvic pain' },
  ],
  labs: [
    {
      lab_id: 'lab-ferritin', test_name: 'Ferritin', value: 8, unit: 'ng/mL', reference_range: '15–150', flag: 'low', collected_date: '2026-08-12', source_id: 'src-labs',
      history: [
        { date: '2025-11-04', value: 38 },
        { date: '2026-03-10', value: 22 },
        { date: '2026-05-06', value: 11 },
        { date: '2026-08-12', value: 8 },
      ],
    },
    {
      lab_id: 'lab-hgb', test_name: 'Hemoglobin', value: 10.9, unit: 'g/dL', reference_range: '12.0–15.5', flag: 'low', collected_date: '2026-08-12', source_id: 'src-labs',
      history: [
        { date: '2025-11-04', value: 12.8 },
        { date: '2026-05-06', value: 11.2 },
        { date: '2026-08-12', value: 10.9 },
      ],
    },
    {
      lab_id: 'lab-tsh', test_name: 'TSH', value: 1.9, unit: 'mIU/L', reference_range: '0.4–4.0', flag: 'normal', collected_date: '2026-05-06', source_id: 'src-labs',
      history: [{ date: '2026-05-06', value: 1.9 }],
    },
    {
      lab_id: 'lab-hcg', test_name: 'hCG, qualitative', value: 0, unit: '', reference_range: 'Negative', flag: 'normal', collected_date: '2026-07-22', source_id: 'src-iron-range',
      history: [{ date: '2026-07-22', value: 0 }],
    },
  ],
  imaging: [
    { imaging_id: 'img-1', modality: 'Transvaginal ultrasound', body_region: 'Pelvis', status: 'recommended', ordered_date: '2026-09-17', source_id: 'src-northland' },
    { imaging_id: 'img-2', modality: 'Abdominal X-ray', body_region: 'Abdomen', status: 'completed', ordered_date: '2026-07-22', completed_date: '2026-07-22', summary: 'No acute findings.', source_id: 'src-iron-range' },
  ],
  encounters: [
    { encounter_id: 'enc-1', date: '2025-11-04', provider_name: 'Dr. Helen Marsh', specialty: 'Family medicine', facility: 'Lakeside Family Medicine', setting: 'primary_care', reason: 'Pelvic pain', notes_summary: 'Intermittent pelvic pain for ~6 weeks, rated 4/10. Advised NSAIDs, follow up if persists.', source_id: 'src-lakeside' },
    { encounter_id: 'enc-2', date: '2025-12-02', provider_name: 'Dr. Luis Ortega', specialty: 'Urgent care', facility: 'Iron Range Urgent Care', setting: 'urgent_care', reason: 'Lower abdominal pain', notes_summary: 'Pain 5/10, negative UA. Switched to naproxen.', source_id: 'src-iron-range' },
    { encounter_id: 'enc-3', date: '2026-01-15', provider_name: 'Dr. Priya Raman', specialty: 'Obstetrics & gynecology', facility: 'Northland Regional Health', setting: 'specialist', reason: 'Pelvic pain, painful periods', notes_summary: 'Dysmenorrhea with pelvic pain 5/10. Started combined oral contraceptive.', source_id: 'src-northland' },
    { encounter_id: 'enc-4', date: '2026-03-10', provider_name: 'Dr. Helen Marsh', specialty: 'Family medicine', facility: 'Lakeside Family Medicine', setting: 'primary_care', reason: 'Fatigue, heavy periods', notes_summary: 'Heavy menstrual bleeding documented. Labs ordered.', source_id: 'src-lakeside' },
    { encounter_id: 'enc-5', date: '2026-05-06', provider_name: 'Dr. Helen Marsh', specialty: 'Family medicine', facility: 'Lakeside Family Medicine', setting: 'telehealth', reason: 'Lab review', notes_summary: 'Ferritin 11 ng/mL. Iron supplementation started.', source_id: 'src-lakeside' },
    { encounter_id: 'enc-6', date: '2026-07-22', provider_name: 'Dr. Luis Ortega', specialty: 'Urgent care', facility: 'Iron Range Urgent Care', setting: 'urgent_care', reason: 'Severe pelvic pain', notes_summary: 'Pain 7/10, worse than prior. Imaging unremarkable. Advised gynecology follow-up.', source_id: 'src-iron-range' },
    { encounter_id: 'enc-7', date: '2026-09-17', provider_name: 'Dr. Priya Raman', specialty: 'Obstetrics & gynecology', facility: 'Northland Regional Health', setting: 'specialist', reason: 'Persistent pelvic pain', notes_summary: 'Pain 7/10 despite hormonal therapy. Pelvic ultrasound recommended; referral to pelvic pain specialist.', source_id: 'src-northland' },
  ],
  referrals: [
    { referral_id: 'ref-1', specialty: 'Obstetrics & gynecology', reason: 'Pelvic pain', status: 'completed', placed_date: '2025-12-02', referred_by: 'Iron Range Urgent Care', days_open: 0 },
    { referral_id: 'ref-2', specialty: 'Gynecology — pelvic pain & endometriosis', reason: 'Persistent pelvic pain despite hormonal therapy', status: 'scheduled', placed_date: '2026-09-17', referred_by: 'Dr. Priya Raman', days_open: 9 },
    { referral_id: 'ref-3', specialty: 'Pelvic ultrasound', reason: 'Evaluate persistent pelvic pain', status: 'stalled', placed_date: '2026-09-17', referred_by: 'Dr. Priya Raman', days_open: 9 },
  ],
  procedures: [
    { procedure_id: 'proc-1', name: 'Pelvic examination', date: '2026-09-17', provider_name: 'Dr. Priya Raman', source_id: 'src-northland' },
    { procedure_id: 'proc-2', name: 'Pap smear (normal)', date: '2026-01-15', provider_name: 'Dr. Priya Raman', source_id: 'src-northland' },
  ],
}
