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
- [ ] Fresh clone of `main` → `./scripts/start_demo.sh` → all green. Blocked until `feature/frontend` merges

## Open integration items

| # | Owner | Item |
|---|---|---|
| 1 | Frontend | Merge `feature/frontend` into `main` (not merged yet). |
| 2 | Frontend | `api.getRouteOptions` should also pass `provider_id` (`/routes?patient_id=…&journey_id=…&provider_id=…`). Without it, the map assumes the demo reroute (`prov-alt-best`), which is wrong if the user picks a different provider. |
| 3 | Frontend | Demo mock in `src/mocks/care.ts` labels a route "Safer route". Team rule: never call a route safe. Suggest "Lower-risk route" or reuse the map's "HERA recommended". |
| 4 | Frontend | Optional: embed the full interactive map with `<iframe src="${VITE_HERA_MAP_URL}/map/?provider_id=…">` on the travel step, and a health-system dashboard from `/analytics/access`. |
| 5 | Backend | Journey `state_history` uses the real `date.today()` (shows "Sep 26" in the UI) while the demo story is set in Dec 2025. Consider a fixed demo date, like the frontend's `DEMO_TODAY = 2025-12-17`. |
| 6 | Backend | Seeded journey has `provider_id: null` and `/advance` doesn't record the chosen provider. The map works around this, but storing `provider_id` on `provider_matched` would make `/routes?journey_id=` exact. |
| 7 | Everyone | Tag `demo-v1` on `main` after the final merge (see DEMO.md). |
