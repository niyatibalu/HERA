# HERA — Frontend

Patient experience, clinician-facing longitudinal timeline, and unified health-record presentation for HERA.

> **All patient data in this app is synthetic.** No real patient information is used, and health-record connections are simulated.

## Run

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
npm test           # component + flow tests (Vitest)
npm run build      # type-check + production build
```

## Screens

| Route | Screen |
|---|---|
| `/` | Patient home: care needs, upcoming visits, stalled items, trends |
| `/record` | Unified health record (simulated EHR / portal connection) |
| `/timeline` | Longitudinal health timeline + trend flags for clinician review |
| `/access` | Care access: provider alternatives + route options |
| `/journey` | Care journey tracking with stalled states |
| `/research` | Optional research consent + study matches |

## Structure

```
src/
  api/          client.ts (backend calls + demo fallback), useApi hook
  mocks/        synthetic data, kept separate from components
  components/   HealthTimeline, TrendFlag, ConnectedRecordCard, ProviderMatchCard,
                CareJourney, ResearchConsentCard, StudyMatchCard, …
  pages/        one file per screen
  types.ts      frontend view of the API schema (snake_case field names)
```

## Backend integration

Follows `docs/API_CONTRACT.md` (owned by backend, on `feature/backend`). Copy `.env.example` to `.env.local`:

```
VITE_HERA_API_URL=http://localhost:8000   # backend: uvicorn app.main:app --port 8000
VITE_HERA_MAP_URL=                        # access-map service, when available
```

When a URL is unset, or a request fails, the UI falls back to synthetic data in `src/mocks/`, which mirrors the backend's synthetic patient, providers and studies. Every screen shows whether it is **Live from HERA backend** or **Showing synthetic demo data**.

| Screen | Endpoints used |
|---|---|
| Home, Record, Timeline | `GET /patients/{id}`, `/health-events`, `/providers?specialty=` (provider directory), `/trend-flags?as_of=2025-12-17` |
| Care access | `GET /patients/{id}/providers?specialty=`, `POST /care-journeys/{id}/advance` ×3 when a provider is chosen |
| Care journey | `GET /patients/{id}/care-journeys`, `POST …/advance {state: travel_planned}` |
| Research | `GET/POST /patients/{id}/research-consent`, `GET /study-matches`, `GET /studies` (for titles) |
| Travel options | `GET {MAP_URL}/routes?patient_id=&journey_id=` (**proposed**; not yet built by access-map) |

Frontend-only presentation shapes (not part of the contract): `PatientRecord`, `ProviderOptions`, `RecordSource`, and the `RouteOption` proposal. See `src/types.ts`.

### Open requests for backend (Person 2)

1. **Seed the demo journey to match Maya's story.** The seeded journey starts today in `need_identified`, so the "specialist appointment not scheduled after 9 days" moment only appears with demo data. Suggested: `need_identified` → `provider_matched` (note naming Dr. Renee Whitfield) on 2025-12-08, then `stalled` with a reason.
2. **Let `/advance` accept `provider_id` and `appointment_date`.** Until then, the frontend records the chosen provider and date in the transition notes (`"Re-matched by HERA to Dr. …"`, `"Appointment booked for YYYY-MM-DD"`) and reads them back.
3. **Optional `as_of` on `/care-journeys`** so stall math uses the demo date, like `/trend-flags`.
4. **Optional frontend-only additions to consider for the synthetic data:** `diagnosis` events (for ICD-10 codes on the record) and an `imaging` event for the ultrasound mentioned in ev-014. Demo mode includes these as `ev-f01`–`ev-f04`.

## Product guardrails

- Trend flags are always labelled **"Flagged for clinician review"**. The UI never presents a diagnosis.
- Research participation is opt-in, never automatic. Consenting to de-identified matching and joining a study are separate decisions.
