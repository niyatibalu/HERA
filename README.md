# HERA

Women's healthcare continuity and access platform. Connects longitudinal medical
history, flags patterns for clinician review, matches patients to accessible
providers, tracks care through to completion, and (with explicit consent) surfaces
research opportunities.

## Repo layout

- `backend/` — API, synthetic EHR adapter, longitudinal analysis, provider matching,
  care lifecycle, research eligibility. Owner: backend.
- `frontend/` — patient-facing UI. Owner: frontend.
- `map/` — access-aware routing, weather/road conditions, care-access analytics. Owner: map/access.
- `docs/API_CONTRACT.md` — canonical field names and endpoint shapes. Backend owns
  this file; frontend/map read from it, don't edit without a heads-up.

## Branches

- `main` — always demoable. Nobody commits directly here.
- `feature/frontend`
- `feature/backend`
- `feature/access-map`

Integration lead merges into `main` one branch at a time.

## Demo patient

Maya, 29. Full story in `docs/API_CONTRACT.md`.
