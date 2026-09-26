# HERA Integration Checklist

Maintained by the integration lead (Person 3). Re-run it after every merge to `main`.
Quick automated check: `python3 map/tools/preflight.py`.

Last run: 2026-09-26, on `feature/access-map` rebased on `main` (d2415a6), with
`feature/frontend` (65c398c) run from a worktree. Live stack = backend :8000 + map
:8001 (`HERA_API_URL` set) + frontend :5173 (`VITE_HERA_API_URL` + `VITE_HERA_MAP_URL` set).

## Demo flow

- [x] patient record loads: backend 20 events for `maya-001`; frontend shows "Live from HERA backend"
- [x] timeline loads: `GET /patients/maya-001/health-events`, sorted by date
- [x] trend flag appears: 6 flags from `/trend-flags?as_of=2025-12-17`, all `action: clinician_review`
- [x] provider matches load: Okafor 92 vs. original referral Whitfield (out of network, 61 days, 122 mi)
- [x] selected provider appears on map: `/map/?provider_id=prov-alt-best` and `/routes?provider_id=…`
- [x] routes render: 3 in-person routes + telehealth, in the map and in frontend `RouteOptions`
- [x] recommended route explains factors: "uses major roads …, avoids reported construction …, has lower winter-weather exposure", with per-factor scores
- [x] care lifecycle updates: choosing Okafor advances the backend journey to `appointment_scheduled`; choosing the recommended route sets `travel_planned`
- [x] research consent works: study matches `[]` before consent, 1 `potentially_eligible` after (API-verified, consent reset afterwards)
- [x] study match appears: via API; frontend Research page not re-checked in the live-stack run
- [x] analytics load: `GET :8001/analytics/access` (320 synthetic referrals); frontend dashboard not built yet
- [x] demo works offline/mock mode: see failover below

## Failover (tested)

- [x] Backend killed → map serves the synthetic snapshot (`data_source: "demo"`), and the circuit breaker skips the backend for 20 s
- [x] Map killed → frontend journey page shows sample routes ("sample routes until the access map is connected")
- [x] No backend configured → frontend uses its built-in demo data
- [x] Live weather enabled but unreachable → demo scenario used; `conditions.source.weather` says so (unit-tested)
- [x] No street tiles (offline) → map shows banner + town labels; routes/markers still render (Leaflet is vendored, no CDN)
- [x] Map runs with zero installs (Python stdlib only)
- [ ] Fresh clone of `main` → `./scripts/start_demo.sh` → all green. Frontend is merged; re-run once `feature/access-map` merges

## Open integration items

| # | Owner | Item |
|---|---|---|
| 1 | Integration | ~~Merge `feature/frontend` into `main`~~: merged as PR #1 (`28fea51`) on 2026-09-26 after build, lint, 17/17 tests and a live end-to-end run. |
| 2 | Frontend | ~~Pass `provider_id` to `/routes`~~: done in PR #3 (merged `113447a`). |
| 3 | Frontend | ~~Remove "Safer route" wording~~: done in PR #3. |
| 4 | Integration | Map inside the app: done. The compact map is embedded in the care journey travel step (synced with the route cards), and the full map is an *Access map* page in the sidebar. If the map service is down, the travel step shows cards only and the page shows a notice. A separate health-system dashboard page is still not built (care gaps show on the map). |
| 5 | Backend | Fixed demo date: PR #4. Verified: journey starts 2025-12-08, steps dated 2025-12-17. |
| 6 | Backend + Frontend | Chosen provider stored on journey: PR #4 (`50d363a`) + PR #6 (`ea9ad44`). Verified together with this branch on 2026-09-26: backend 65/65, map 32/32, frontend 18/18; booking Dr. Okafor sets `provider_id: prov-alt-best` and `appointment_date: 2025-12-29`; `/routes?journey_id=` resolves to Dr. Okafor; unknown `provider_id` → 400. **Merge #4 and #6 back to back.** |
| 7 | Everyone | Tag `demo-v1` on `main` after the final merge (see DEMO.md). |
