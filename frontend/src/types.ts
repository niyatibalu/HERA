// Frontend view of the HERA data model.
// Mirrors docs/API_CONTRACT.md (owned by backend, feature/backend) field-for-field, snake_case
// throughout. Anything marked FRONTEND is a presentation-only shape assembled in the client.

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
  gender?: 'female' | 'male' | 'nonbinary' | null
  /** 0-5, from synthetic patient reviews. */
  rating?: number | null
  review_count?: number
  review_highlights?: string[]
  availability?: AvailabilitySlot[]
  sliding_scale?: boolean
}

export type AvailabilitySlot = 'weekday_morning' | 'weekday_afternoon' | 'weekday_evening' | 'weekend'

/** GET/PUT /patients/{id}/preferences. Unset preferences never penalize a provider. */
export interface CarePreferences {
  patient_id: string
  max_cost_usd?: number | null
  needs_financial_assistance: boolean
  /** null = the plan on the patient record */
  insurance_plan?: string | null
  max_distance_mi?: number | null
  expertise: string[]
  min_rating?: number | null
  availability: AvailabilitySlot[]
  telehealth: 'no_preference' | 'prefer_telehealth' | 'in_person_only'
  provider_gender: 'no_preference' | 'female' | 'male' | 'nonbinary'
  pregnant: boolean
  updated_at?: IsoDate | null
}

/** GET/POST /patients/{id}/symptom-log. The patient's own notes; never analyzed. */
export interface SymptomLogEntry {
  entry_id: string
  patient_id: string
  logged_on: IsoDate
  symptom: string
  /** 0-10, patient-rated */
  severity: number
  timing: 'before_visit' | 'after_visit' | 'general'
  visit?: string | null
  note: string
  tags: string[]
}

export type NewSymptomLogEntry = Pick<SymptomLogEntry, 'symptom' | 'severity' | 'timing' | 'note'> & { visit?: string | null }

/** GET /patients/{id}/mychart. Always simulated: no real MyChart/Epic system is contacted. */
export interface MyChartConnection {
  patient_id: string
  status: 'not_connected' | 'connected'
  simulated: boolean
  connected_at?: IsoDate | null
  last_synced_at?: IsoDate | null
  scopes: string[]
  organizations: { name: string; system_type: RecordSource['system_type'] }[]
  imported: Partial<Record<EventType, number>>
}

/** FRONTEND: presentation of the systems a record was assembled from (simulated). */
export interface RecordSource {
  source_id: string
  name: string
  system_type: 'ehr' | 'patient_portal' | 'lab' | 'imaging' | 'pharmacy'
  status: 'connected' | 'syncing' | 'error'
  last_synced_at: IsoDate
  simulated: boolean
}

/** FRONTEND: GET /patients/{id} + /health-events + provider directory, combined. */
export interface PatientRecord {
  patient: Patient
  events: HealthEvent[]
  providers: Provider[]
  record_sources?: RecordSource[]
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
  appointment_time?: string | null
  appointment_modality?: 'in_person' | 'telehealth' | null
  stalled: boolean
  stalled_reason?: string | null
  /** Server-computed warning when the current state is past its expected window. */
  stall_warning?: string | null
}

/** GET /patients/{id}/providers returns these, ranked highest score first. */
export interface ProviderMatch {
  provider: Provider
  /** 0–100 */
  score: number
  distance_mi: number
  match_reasons: string[]
  access_tradeoffs: string[]
}

/** FRONTEND: the original referral vs. better-ranked alternatives for one care journey. */
export interface ProviderOptions {
  journey_id: string
  need: string
  original?: ProviderMatch
  barriers: string[]
  alternatives: ProviderMatch[]
}

// ---------- map (feature/access-map) ----------

/** PROPOSED for the access-map service (feature/access-map); not yet in the contract. */
export interface RouteOption {
  route_id: string
  mode: 'fastest' | 'safer' | 'transit' | 'telehealth'
  label: string
  duration_minutes?: number | null
  summary: string
  conditions: string[]
  recommended: boolean
  /** Present when planning for travel during pregnancy: what matters, met or not. */
  pregnancy_check?: { label: string; ok: boolean }[] | null
}

export interface PregnancyTravel {
  tips: string[]
  labor_delivery_near_destination: { name: string; distance_mi: number }[]
  note: string
}

export interface RouteOptionsResponse {
  /** Destination provider (access map returns it; see docs/MAP_API.md). */
  provider_id?: string
  destination: string
  appointment_date: IsoDate
  options: RouteOption[]
  /** Present when routes were planned for travel during pregnancy (?pregnant=1). */
  pregnancy?: PregnancyTravel | null
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
  /** FRONTEND: joined from GET /studies so the patient sees what the study is. */
  title?: string
  description?: string
}
