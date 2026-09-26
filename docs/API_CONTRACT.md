# HERA API Contract

Owned by: backend (Person 2). Update this file first, announce the change,
then frontend/map update their integrations, then commit separately —
see the git protocol in the team plan.

Base URL (local dev): `http://localhost:8000`

Field names are canonical `snake_case` everywhere. Do not introduce a
second spelling of any field (e.g. always `wait_days`, never `waitDays`,
`wait_time`, or `estimatedWait`).

## Core objects

| Object | Shape | Notes |
|---|---|---|
| `Patient` | `patient_id, name, date_of_birth, sex, insurance_plan, home_location{lat,lon,address}, preferred_language, mobility_constraints[], accessibility_needs[]` | Synthetic only |
| `HealthEvent` | `event_id, patient_id, event_type, event_date, topic, description, specialty?, provider_id?, status?, severity?(1-5), value?, unit?, source, raw{}` | `event_type` ∈ `encounter, diagnosis, symptom, medication, lab, imaging, procedure, referral` |
| `TrendFlag` | `flag_id, patient_id, pattern_type, topic, first_seen, last_seen, encounter_count, trend, evidence[], message, action, generated_at` | `action` is always `"clinician_review"`. Never a diagnosis. |
| `Provider` | `provider_id, name, specialty, location, wait_days, telehealth_available, in_network_plans[], estimated_cost_usd?, accessibility_features[], languages[], expertise_tags[], gender?, rating?(0-5), review_count, review_highlights[], availability[], sliding_scale` | Ratings and reviews are synthetic. `availability` ⊂ `weekday_morning, weekday_afternoon, weekday_evening, weekend` |
| `CarePreferences` | `patient_id, max_cost_usd?, needs_financial_assistance, insurance_plan?, max_distance_mi?, expertise[], min_rating?, availability[], telehealth, provider_gender, updated_at?` | `telehealth` ∈ `no_preference, prefer_telehealth, in_person_only`; `provider_gender` ∈ `no_preference, female, male, nonbinary`. An unset preference never penalizes a provider. |
| `SymptomLogEntry` | `entry_id, patient_id, logged_on, symptom, severity(0-10), timing, visit?, note, tags[]` | `timing` ∈ `before_visit, after_visit, general`. Patient's own notes: stored and shown, never analyzed. |
| `MyChartConnection` | `patient_id, status, simulated, connected_at?, last_synced_at?, scopes[], organizations[{name, system_type}], imported{event_type: count}` | `status` ∈ `not_connected, connected`. Always `simulated: true`: no real MyChart/Epic system is contacted. |
| `ProviderMatch` | `provider, score(0-100), distance_mi, match_reasons[], access_tradeoffs[]` | Returned sorted, highest score first |
| `CareJourney` | `journey_id, patient_id, need, state, state_history[], provider_id?, appointment_date?, stalled, stalled_reason?` | `state` ∈ see below |
| `ResearchConsent` | `patient_id, consent, consent_timestamp?, scope, revoked, revoked_timestamp?` | `is_active` = `consent && !revoked` |
| `Study` | `study_id, title, criteria{...}, description` | |
| `StudyMatch` | `study_id, candidate_id, eligibility_status, criteria_satisfied[], criteria_unknown[], reason` | `candidate_id` is a one-way pseudonym. Never `patient_id`, name, or address. `eligibility_status` is always `"potentially_eligible"`. |

`CareState` values, in expected order:
`need_identified → provider_matched → records_ready → appointment_scheduled
→ travel_planned → appointment_completed → followup_required →
followup_completed`, plus `stalled` (reachable from any state).

## Endpoints

| Method | Path | Returns |
|---|---|---|
| GET | `/health` | `{status: "ok"}` |
| GET | `/patients` | `{patient_ids: [...]}` |
| GET | `/patients/{id}` | `Patient` |
| GET | `/patients/{id}/health-events` | `HealthEvent[]`, sorted by date |
| GET | `/patients/{id}/trend-flags?as_of=YYYY-MM-DD` | `TrendFlag[]` (`as_of` optional) |
| GET | `/patients/{id}/providers?specialty=...&telehealth=bool&max_distance_mi=...` | `ProviderMatch[]`, ranked |
| GET | `/patients/{id}/care-journeys` | `CareJourney[]` (includes `stall_warning`) |
| POST | `/patients/{id}/care-journeys` `{need}` | `CareJourney` |
| POST | `/patients/{id}/care-journeys/{journey_id}/advance` `{state, note?, provider_id?, appointment_date?}` | `CareJourney`, 400 on invalid transition |
| GET | `/patients/{id}/research-consent` | `ResearchConsent` |
| POST | `/patients/{id}/research-consent` `{consent, scope?}` | `ResearchConsent` |
| GET | `/patients/{id}/study-matches` | `StudyMatch[]` — always `[]` unless consent is active |
| GET | `/studies` | `Study[]` — researcher-side, no patient data |
| GET | `/patients/{id}/preferences` | `CarePreferences` (defaults if never saved) |
| PUT | `/patients/{id}/preferences` `{...CarePreferences fields}` | `CarePreferences`, 422 on invalid values. Saved preferences personalize `GET /providers`. |
| GET | `/patients/{id}/symptom-log` | `SymptomLogEntry[]`, newest first |
| POST | `/patients/{id}/symptom-log` `{symptom, severity, timing?, visit?, note?, logged_on?}` | `SymptomLogEntry` (201). `logged_on` defaults to the demo date. |
| DELETE | `/patients/{id}/symptom-log/{entry_id}` | 204, or 404 if unknown |
| GET | `/patients/{id}/mychart` | `MyChartConnection` |
| POST | `/patients/{id}/mychart/connect` `{scopes?}` | `MyChartConnection` (simulated import from the synthetic record), 400 on unknown scope |
| POST | `/patients/{id}/mychart/disconnect` | `MyChartConnection` with `status: not_connected` |

Unknown `patient_id` → `404 {detail: "..."}` on every patient-scoped route.

Interactive docs once the server is running: `GET /docs`.

### `advance` — setting provider_id / appointment_date

`provider_id` and `appointment_date` on the advance request are optional
and only overwrite the journey's stored value when explicitly sent — a
request with only `{state, note}` leaves both untouched, so every existing
caller keeps working unchanged. Use them to record a provider/appointment
in the same call as the state transition instead of encoding that
information in `note` text:

```
POST /patients/maya-001/care-journeys/journey-0001/advance
{
  "state": "appointment_scheduled",
  "note": "Re-matched by HERA to Dr. Ifeoma Okafor",
  "provider_id": "prov-alt-best",
  "appointment_date": "2025-12-29"
}
```

`GET /patients/{id}/care-journeys` always reflects the current
`provider_id`/`appointment_date` on each journey — no need to parse them
back out of `note` strings.

An unknown `provider_id` (not present in the provider directory) is
rejected with `400 {detail: "unknown provider_id '...'"}` and the journey
is left completely unchanged — nothing is stored, and the state transition
itself does not happen either.

## Provider matching and preferences

`GET /patients/{id}/providers` scores specialty fit, network, wait, distance, cost,
telehealth and accessibility, plus the patient's saved preferences: budget and financial
assistance, insurance plan, travel limit, requested expertise, minimum rating, schedule
availability, telehealth preference and clinician gender. Each preference adds a
`match_reasons` entry when met and an `access_tradeoffs` entry when not. Scores are
normalized to 0–100. Expertise the patient asks for defines the fit: providers with it get full specialty credit, and providers without it are ranked down with a "Not a match for …" tradeoff. Language match (patient's `preferred_language`) is scored too. The synthetic directory has 19 providers across pelvic pain, endometriosis surgery, pelvic floor therapy, fertility, urogynecology, pain management and gynecology.

Trend flags (`/trend-flags`) remain available in the API but are no longer shown in the
app: patients already get trends from MyChart. The app shows a patient-written symptom
log instead.

## Demo patient

**Maya, 29** (`patient_id: "maya-001"`). Pelvic pain first documented
January 2025, heavy menstrual bleeding in March, iron deficiency in May,
worsening pain in July, second (OB/GYN) specialist visit in August/September,
hormonal therapy trial with no improvement through December, referred to a
chronic pelvic pain specialist who is out-of-network / 61-day wait / 122 mi
away. HERA's matching engine ranks an in-network, 12-day-wait, 1.7 mi
alternative (`prov-alt-best`) above the original referral.

Her care journey (`GET /patients/maya-001/care-journeys`) is seeded on
server startup at `need_identified`, dated to her actual referral event
(2025-12-08), with `provider_id` already set to the originally-referred,
inaccessible specialist (`prov-original-specialist`). HERA re-matching her
to a better provider is expected to happen via an `advance` call that
overwrites `provider_id` — see the `advance` section above. At the default
demo date this journey already shows a `stall_warning` (9 days in
`need_identified`, past its 3-day threshold), which is the point: nothing
happened after the original referral until HERA intervened.

## FAILSAFE

- The longitudinal, matching, lifecycle, and research engines
  (`backend/app/engine/`) are pure Python stdlib — **no LLM call and no
  network access is required** for any of them to run. They pass their
  full test suite with nothing installed beyond Python itself.
- `fastapi`/`uvicorn` are only the HTTP wrapper. If the server can't start
  for any reason, every engine can still be run and demoed directly from a
  Python shell against the same calls the routes make.
- All patient/provider/study data is synthetic and generated in-process —
  there is no external data dependency to fail.
- DEMO MODE = the default running state of this backend. There is no
  separate "demo mode" flag to remember to flip; running `uvicorn
  app.main:app` always serves synthetic data with deterministic engines.
- The care-journey/consent store's notion of "today" is a fixed demo date
  (`2025-12-17` by default — same date the frontend's own `DEMO_TODAY`
  mock uses), not the real wall clock, so stall warnings and timestamps
  stay consistent with the synthetic patient data no matter what day the
  demo is actually run on. Override it with `HERA_DEMO_TODAY=YYYY-MM-DD`
  if you need to rehearse against a different date.
- The demo store is a single in-process singleton — restarting the server
  (or calling `store.reset()`) wipes any mutations (advanced journeys,
  granted consent) and reseeds Maya's journey from scratch. Useful for
  resetting between run-throughs.
