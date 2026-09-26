// Frontend view of the HERA data model.
// Field names are snake_case to match the backend API naming rule (e.g. `wait_days`).
// Person 2 owns the canonical contract (API_CONTRACT.md); update these types when it lands.

export type IsoDate = string

export interface RecordSource {
  source_id: string
  name: string
  system_type: 'ehr' | 'patient_portal' | 'lab' | 'imaging' | 'pharmacy'
  status: 'connected' | 'syncing' | 'error'
  last_synced_at: IsoDate
  simulated: boolean
}

export interface Patient {
  patient_id: string
  display_name: string
  date_of_birth: IsoDate
  age: number
  insurance_plan: string
  primary_care_provider: string
  home_location: { city: string; state: string; rural: boolean }
  record_sources: RecordSource[]
}

export interface Diagnosis {
  diagnosis_id: string
  name: string
  icd10_code: string
  status: 'active' | 'resolved' | 'under_evaluation'
  first_recorded_date: IsoDate
  recorded_by: string
  source_id: string
}

export interface Medication {
  medication_id: string
  name: string
  dose: string
  frequency: string
  status: 'active' | 'discontinued'
  start_date: IsoDate
  end_date?: IsoDate
  prescriber: string
  reason: string
}

export interface LabResult {
  lab_id: string
  test_name: string
  value: number
  unit: string
  reference_range: string
  flag: 'low' | 'high' | 'normal'
  collected_date: IsoDate
  source_id: string
  history: { date: IsoDate; value: number }[]
}

export interface ImagingStudy {
  imaging_id: string
  modality: string
  body_region: string
  status: 'completed' | 'recommended' | 'scheduled'
  ordered_date: IsoDate
  completed_date?: IsoDate
  summary?: string
  source_id: string
}

export interface Encounter {
  encounter_id: string
  date: IsoDate
  provider_name: string
  specialty: string
  facility: string
  setting: 'primary_care' | 'specialist' | 'urgent_care' | 'emergency' | 'telehealth'
  reason: string
  notes_summary: string
  source_id: string
}

export interface Referral {
  referral_id: string
  specialty: string
  reason: string
  status: 'placed' | 'scheduled' | 'completed' | 'stalled'
  placed_date: IsoDate
  referred_by: string
  days_open: number
}

export interface Procedure {
  procedure_id: string
  name: string
  date: IsoDate
  provider_name: string
  source_id: string
}

export interface HealthRecord {
  patient: Patient
  diagnoses: Diagnosis[]
  medications: Medication[]
  labs: LabResult[]
  imaging: ImagingStudy[]
  encounters: Encounter[]
  referrals: Referral[]
  procedures: Procedure[]
}

export type TimelineCategory = 'symptom' | 'lab' | 'visit' | 'referral' | 'medication' | 'imaging'

export interface TimelineEvent {
  event_id: string
  date: IsoDate
  category: TimelineCategory
  title: string
  detail: string
  /** Patient-reported severity 0–10 where documented. */
  severity?: number
  setting?: string
  source_id?: string
  /** Trend flags this event contributes to. */
  flag_ids: string[]
}

export interface TrendSeries {
  label: string
  unit: string
  points: { date: IsoDate; value: number }[]
  /** Optional reference band, e.g. lab normal range. */
  reference_low?: number
  reference_high?: number
}

export interface TrendFlag {
  flag_id: string
  pattern_type:
    | 'symptom_progression'
    | 'lab_decline'
    | 'repeated_complaint'
    | 'unresolved_referral'
    | 'treatment_without_improvement'
  title: string
  summary: string
  suggested_review: string
  encounter_count: number
  span_months: number
  related_event_ids: string[]
  series?: TrendSeries
  review_status: 'flagged_for_review' | 'reviewed'
  generated_by: string
  generated_at: IsoDate
}

export interface TimelineResponse {
  events: TimelineEvent[]
  flags: TrendFlag[]
}

export interface Provider {
  provider_id: string
  name: string
  specialty: string
  facility: string
  expertise: string[]
  wait_days: number
  distance_miles: number
  in_network: boolean
  insurance_note: string
  estimated_cost_usd: number
  telehealth_available: boolean
  accessibility: string[]
  next_available_date: IsoDate
  match_score: number
  match_reasons: string[]
}

export interface ProviderSearchResponse {
  care_need: string
  original_provider: Provider
  barriers: string[]
  alternatives: Provider[]
}

export type JourneyStepStatus = 'complete' | 'in_progress' | 'stalled' | 'pending'

export interface JourneyStep {
  step_id: string
  key:
    | 'need_identified'
    | 'provider_matched'
    | 'records_shared'
    | 'appointment_scheduled'
    | 'travel_planned'
    | 'appointment_completed'
    | 'follow_up_complete'
  label: string
  status: JourneyStepStatus
  completed_date?: IsoDate
  due_date?: IsoDate
  stalled_days?: number
  detail?: string
}

export interface CareJourney {
  journey_id: string
  care_need: string
  started_date: IsoDate
  provider_name?: string
  appointment_date?: IsoDate
  steps: JourneyStep[]
}

export interface RouteOption {
  route_id: string
  mode: 'fastest' | 'safer' | 'transit' | 'telehealth'
  label: string
  duration_minutes?: number
  summary: string
  conditions: string[]
  recommended: boolean
}

export interface RouteOptionsResponse {
  destination: string
  appointment_date: IsoDate
  options: RouteOption[]
}

export type ConsentStatus = 'not_asked' | 'granted' | 'declined'

export interface ResearchConsent {
  consent_status: ConsentStatus
  updated_at?: IsoDate
}

export interface StudyMatch {
  study_id: string
  title: string
  sponsor: string
  summary: string
  match_criteria: string[]
  location: string
  remote_option: boolean
  time_commitment: string
  contact_note: string
}
