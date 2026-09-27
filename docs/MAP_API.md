# HERA Access Map API

Owned by: map/access (Person 3). Field names follow the same `snake_case` convention
as `docs/API_CONTRACT.md`, and every object reuses the backend's names (`provider_id`,
`wait_days`, `home_location`, `lat`/`lon`, …). The map service reads patients and
providers from the backend when `HERA_API_URL` is set, and falls back to its bundled
synthetic snapshot otherwise.

Base URL (local dev): `http://127.0.0.1:8001`. Standard library only, so there's nothing to install.

## Endpoints

| Method | Path | Returns |
|---|---|---|
| GET | `/health` | `{status, service, demo_mode, backend}` |
| GET | `/world?patient_id=maya-001` | Markers: `patient`, `providers[]` (with `role` = `original` \| `alternative`, `distance_mi`), `facilities[]`, `towns[]`, `original_provider_id`, `data_source` |
| GET | `/routes?patient_id=&provider_id=&journey_id=&scenario=&weights=&date=` | `RouteOptionsResponse` (below) |
| GET | `/conditions?scenario=&date=` | `ConditionsSnapshot` |
| GET | `/analytics/access?region_type=&specialty=&region=` | Population access analytics (below) |
| GET | `/map/?patient_id=&provider_id=&scenario=&route=&embed=1&inapp=1&theme=` | Interactive map page. The web app embeds it (see below). |

### Embedding (used by `frontend/src/components/AccessMapFrame.tsx`)

- `embed=1`: compact map with routes and conditions only, no side panel (care journey travel step).
- `inapp=1`: full map with side panel, without the page title the app already shows (Access map page).
- `theme=light|dark`: match the host app. `route=<route_id>`: route to highlight initially.
- The host highlights a route without reloading with `postMessage({source: 'hera-app', type: 'selectRoute', route_id})`.
- The map reports route clicks with `postMessage({source: 'hera-map', type: 'routeSelected', route_id})`. The app only accepts these from the map's origin.

`/routes` parameters:
- `patient_id` defaults to `maya-001`.
- `provider_id` is the destination. **Frontend: please pass it** once a provider is chosen.
  If it's omitted, the service uses the journey's `provider_id` from the backend, and
  otherwise falls back to the demo's rerouted provider `prov-alt-best`.
- `scenario` selects a demo conditions scenario: `winter_storm` (default) or `clear`.
- `weights` overrides scoring weights, e.g. `travel_time:0.5,weather:0.1`.
- `pregnant=1` plans for travel during pregnancy. It adds factors for `ride_smoothness` (road-class roughness plus reported potholes/rough pavement), `restrooms` and `food_water` (amenities, towns and clinics along the route; for trips of 45+ min, the longest gap in minutes), `air_quality` (construction zones raise local AQI; EPA's 101+ "unhealthy for sensitive groups" includes pregnancy), `walk_rest` (benches on transit walks) and `obstetric_access` (labor & delivery care nearby). Travel time counts for less. Each option carries `pregnancy_check: [{label, ok}]` for those items, the best option is labeled "Recommended for pregnancy", and the response has a `pregnancy` block (travel tips, nearest labor & delivery hospitals). `/world` also returns `amenities[]` (restrooms, food, water, benches), all synthetic.
- `date` is "today" (default `2025-12-17`, matching frontend `DEMO_TODAY`). The appointment date is `date + wait_days`.

Errors: unknown patient or provider → `404 {detail}`. Bad scenario, weights or date → `400 {detail}`.

## RouteOptionsResponse

A superset of `RouteOptionsResponse` in `frontend/src/types.ts`, so the existing
`RouteOptions` component renders it unchanged.

```jsonc
{
  "patient_id": "maya-001",
  "journey_id": "journey-0001",
  "provider_id": "prov-alt-best",
  "destination": "Dr. Ifeoma Okafor — Madison, WI",
  "destination_detail": { "provider_id", "name", "specialty", "location", "accessibility_features", "telehealth_available", "is_original_referral" },
  "origin": { "lat", "lon", "address" },
  "appointment_date": "2025-12-29",
  "options": [RouteOption],          // sorted by score; telehealth last
  "weights": { "travel_time": 0.22, ... },   // effective weights after patient adjustments
  "conditions": ConditionsSnapshot,
  "nearby_resources": [ { facility_id, name, kind, lat, lon, distance_from_destination_mi } ],
  "data_source": "live" | "demo",
  "disclaimer": "Recommended based on current access and route conditions. ..."
}
```

### RouteOption

| Field | Notes |
|---|---|
| `route_id` | stable per corridor |
| `mode` | `fastest` \| `safer` \| `transit` \| `telehealth`. This is the route's *character*, used for icons. `safer` means "the non-fastest driving alternative", **not** a safety claim. |
| `label` | display text: `HERA recommended`, `Fastest route`, `Alternative route`, `Public transit`, `Telehealth alternative` |
| `recommended` | exactly one option is `true` |
| `duration_minutes` | includes weather slowdown and reported delays; `null` for telehealth |
| `distance_mi`, `name`, `summary` | |
| `conditions[]` | short chips, e.g. `Snow expected`, `Construction: Regent St lane closure`, `Major roads`, `Passes 3 medical facilities`, `No services for 22 mi`, `1 transfer` |
| `score` | 0–100 weighted score; `null` for telehealth |
| `factor_scores` | `{travel_time_score, weather_score, road_condition_score, construction_score, road_type_score, isolation_score, healthcare_proximity_score, accessibility_score, mobility_fit_score, transit_service_score?}` each 0–1, higher = better access / lower risk |
| `weather_risk` | `low` \| `moderate` \| `high` \| `none` |
| `construction` | bool |
| `reasons[]` | why it's recommended (on the recommended option only) |
| `cautions[]` | per-route warnings (closures, isolation, mobility fit) |
| `metrics` | raw inputs behind each factor (exposure share, roads, facilities passed, isolated stretch, transit details) |
| `geometry` | `[[lat, lon], ...]`; empty for telehealth |
| `suggested` | telehealth only: `true` when every in-person route has major barriers |

## Scoring

Each factor is scored 0–1 per route. The overall score is `100 × Σ wᵢ·fᵢ / Σ wᵢ`, taken
over the factors that apply to that route (`transit_service` applies only to transit).
Default weights are in `map/hera_map/data/scoring_weights.json` and can be overridden
with `HERA_SCORING_WEIGHTS=/path.json` or `?weights=`. A patient's mobility and
accessibility needs raise the weight of `accessibility`/`mobility_fit`, and `no_car`
triples `mobility_fit`. A reported closure multiplies the score by 0.3.

| Factor | How it's computed |
|---|---|
| travel_time | fastest open route's minutes ÷ this route's minutes |
| weather | 1 − length-weighted exposure; each road class's exposure is scaled (interstate 0.45 … local/rural 1.0) |
| road_condition | 1 − Σ severity of unplowed/ice/pavement events on the route (−1 for a closure) |
| construction | 1 − Σ severity of construction events on the route |
| road_type | length-weighted road-class quality (interstate/US 1.0, arterial 0.85, local 0.5, rural 0.3) |
| isolation | 1 − longest stretch away from populated areas ÷ 25 mi |
| healthcare_proximity | 0.6 × share of the route within 10 mi of an ER + 0.4 × (facilities within 1 mi ÷ 2) |
| accessibility | destination features vs. patient needs; not step-free transit × 0.6 |
| mobility_fit | patient constraints (`no_car`, `wheelchair_user`, `limited_walking`) vs. route mode and walking |
| transit_service | transfers, headway, sheltered stops |

## ConditionsSnapshot

`{as_of, scenario, summary, source: {weather, roads}, weather: [WeatherZone], road_events: [RoadEvent]}`

- `WeatherZone`: `zone_id, kind (snow|sleet|freezing_rain|ice|rain), severity 0–1, lat, lon, radius_mi, label, window`
- `RoadEvent`: `event_id, kind (construction|closure|unplowed|ice|poor_pavement|flooding), lat, lon, radius_mi, severity, label, road?, delay_minutes`

Sources: `demo:<scenario>` (default), `open-meteo` (with `HERA_LIVE_WEATHER=1`), or
`feed` (with `HERA_ROAD_EVENTS_URL`, a GeoJSON FeatureCollection of Points). If a live
source fails, the demo scenario is used and `source` notes that the live source was unavailable.

## Access analytics

`GET /analytics/access` returns dashboard-ready aggregates over a **synthetic** cohort
of 320 referrals. Regions with fewer than 5 referrals are suppressed, and no record-level data is returned.

- `summary.avg_travel_distance_mi {original_referral, after_hera}`
- `summary.patients_over_30_mi {original_referral, after_hera, pct_original}`
- `summary.wait_time_barriers {referrals_over_30_days, avg_wait_days_original, avg_wait_days_after_hera}`
- `summary.insurance_barriers {out_of_network_referrals, resolved_by_rerouting, uninsured}`
- `summary.stalled_care_pathways {count, pct, avg_days_stalled, by_stage, stall_rate_rerouted_pct, stall_rate_not_rerouted_pct}`
- `summary.rerouting_improvement {rerouted_referrals, distance_mi, wait_days, estimated_cost_usd}` (each `{before, after, avg_reduction}`)
- `summary.telehealth_utilization {pct_all, by_region_type}`
- `summary.completion_rate_pct`
- `route_access_barriers[] {barrier, label, referrals, pct}`
- `geographic_care_gaps[]` and `by_region[] {region, region_type, lat, lon, referrals, avg_distance_to_referred_care_mi, avg_distance_to_nearest_specialist_mi, pct_over_30_mi, avg_wait_days, pct_stalled, public_transit_available, telehealth_share_pct, care_gap}`
- `monthly[] {month, referrals, completed, stalled}`
