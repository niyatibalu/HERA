// Frontend view of the HERA data model.
// Mirrors the backend dataclasses in backend/app/models (feature/backend) field-for-field,
// snake_case throughout. Person 2 owns the canonical contract (docs/API_CONTRACT.md);
// anything marked PROVISIONAL is a frontend proposal pending that contract.

export type IsoDate = string

// ---------- records.py ----------

export type EventType = 'encounter' | 'diagnosis' | 'symptom' | 'medication' | 'lab' | 'imaging' | 'procedure' | 'referral'

export interface Location {
  lat: number
  lon: number
  address: string
}

export interface Patient {
  patient_id: string
  name: string
  date_of_birth: IsoDate
  sex: string
  insurance_plan: string
  home_location: Location
  preferred_language: string
  mobility_constraints: string[]
  accessibility_needs: string[]
}

export interface HealthEvent {
  event_id: string
  patient_id: string
  event_type: EventType
  event_date: IsoDate
  /** Normalized grouping label, e.g. "pelvic_pain". */
  topic: string
  description: string
  specialty?: string | null
  provider_id?: string | null
  status?: string | null
  /** 1–5, symptom events only. */
  severity?: number | null
  value?: number | null
  unit?: string | null
  source: string
  raw?: Record<string, unknown>
}

export interface Provider {
  provider_id: string
  name: string
  specialty: string
  location: Location
  wait_days: number
  telehealth_available: boolean
  in_network_plans: string[]
  estimated_cost_usd?: number | null
  accessibility_features: string[]
  languages: string[]
  expertise_tags: string[]
}

/** PROVISIONAL: presentation of the systems a record was assembled from. */
export interface RecordSource {
  source_id: string
  name: string
  system_type: 'ehr' | 'patient_portal' | 'lab' | 'imaging' | 'pharmacy'
  status: 'connected' | 'syncing' | 'error'
  last_synced_at: IsoDate
  simulated: boolean
}

/** PROVISIONAL: GET /patients/{id}/record */
export interface PatientRecord {
  patient: Patient
  events: HealthEvent[]
  providers: Provider[]
  record_sources?: RecordSource[]
}

// ---------- trends.py ----------

export type PatternType =
  | 'persistent_symptom'
  | 'lab_trend'
  | 'repeated_treatment_no_improvement'
  | 'multiple_specialist_visits'
  | 'unresolved_referral'
  | 'care_gap'

export type Trend = 'worsening' | 'stable' | 'improving' | 'unknown'

export interface Evidence {
  event_id: string
  event_date: IsoDate
  excerpt: string
}

export interface TrendFlag {
  flag_id: string
  patient_id: string
  pattern_type: PatternType
  topic: string
  first_seen: IsoDate
  last_seen: IsoDate
  encounter_count: number
  trend: Trend
  evidence: Evidence[]
  message: string
  action: string
  generated_at: IsoDate
}

// ---------- care.py ----------

export type CareState =
  | 'need_identified'
  | 'provider_matched'
  | 'records_ready'
  | 'appointment_scheduled'
  | 'travel_planned'
  | 'appointment_completed'
  | 'followup_required'
  | 'followup_completed'
  | 'stalled'

export interface StateTransition {
  state: CareState
  entered_at: IsoDate
  note?: string | null
}

export interface CareJourney {
  journey_id: string
  patient_id: string
  need: string
  state: CareState
  state_history: StateTransition[]
  provider_id?: string | null
  appointment_date?: IsoDate | null
  stalled: boolean
  stalled_reason?: string | null
}

/** PROVISIONAL: one ranked result from provider matching. */
export interface ProviderMatch {
  provider: Provider
  match_score: number
  distance_miles: number
  in_network: boolean
  reasons: string[]
}

/** PROVISIONAL: GET /patients/{id}/journeys/{journey_id}/provider-options */
export interface ProviderSearchResponse {
  journey_id: string
  need: string
  original: ProviderMatch
  barriers: string[]
  alternatives: ProviderMatch[]
}

// ---------- map (feature/access-map) ----------

/** PROVISIONAL: shape requested from the access-map service. */
export interface RouteOption {
  route_id: string
  mode: 'fastest' | 'safer' | 'transit' | 'telehealth'
  label: string
  duration_minutes?: number | null
  summary: string
  conditions: string[]
  recommended: boolean
}

export interface RouteOptionsResponse {
  destination: string
  appointment_date: IsoDate
  options: RouteOption[]
}

// ---------- research.py ----------

export interface ResearchConsent {
  patient_id: string
  consent: boolean
  consent_timestamp?: IsoDate | null
  scope: string
  revoked: boolean
  revoked_timestamp?: IsoDate | null
}

export interface StudyMatch {
  study_id: string
  /** De-identified pseudonym. The frontend never receives or shows a researcher-side identity. */
  candidate_id: string
  eligibility_status: string
  criteria_satisfied: string[]
  criteria_unknown: string[]
  reason: string
  /** PROVISIONAL: joined from Study so the patient sees what the study is. */
  title?: string
  description?: string
}
