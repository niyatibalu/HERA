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

Set these in `frontend/.env.local` to use live services. When unset, or when a request fails, the UI falls back to synthetic demo data so the demo never breaks.

```
VITE_HERA_API_URL=http://localhost:8000   # feature/backend
VITE_HERA_MAP_URL=http://localhost:8001   # feature/access-map (route options)
```

Endpoints the frontend currently expects. These are **provisional**: Person 2 owns the canonical contract in `API_CONTRACT.md`, and `src/types.ts` should be updated to match it.

| Method | Path | Returns |
|---|---|---|
| GET | `/patients/{id}/record` | `HealthRecord` |
| GET | `/patients/{id}/timeline` | `{ events: TimelineEvent[], flags: TrendFlag[] }` |
| GET | `/patients/{id}/providers?care_need=` | `ProviderSearchResponse` |
| GET | `/patients/{id}/journeys` | `CareJourney[]` |
| GET | `/patients/{id}/journeys/{journey_id}/routes` (map service) | `RouteOptionsResponse` |
| GET / POST | `/patients/{id}/research/consent` | `ResearchConsent` (POST body `{ consent_status }`) |
| GET | `/patients/{id}/research/matches` | `StudyMatch[]` |

## Product guardrails

- Trend flags are always labelled **"Flagged for clinician review"**. The UI never presents a diagnosis.
- Research participation is opt-in, never automatic. Consenting to de-identified matching and joining a study are separate decisions.
