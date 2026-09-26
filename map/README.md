# HERA access map

Access-aware routing, travel conditions and population access analytics for HERA.
It's Python standard library only, with Leaflet vendored in `web/vendor`, so it runs from a
fresh clone with no `pip install`, no `npm install` and no internet.

```bash
cd map
python3 -m hera_map.server                 # http://127.0.0.1:8001/map/
python3 -m unittest discover -s tests -t .  # tests
```

With the backend running, read live patient and provider data (and still fall back if it goes down):

```bash
HERA_API_URL=http://127.0.0.1:8000 python3 -m hera_map.server
```

API reference: [`docs/MAP_API.md`](../docs/MAP_API.md).

## Layout

| Path | What |
|---|---|
| `hera_map/server.py` | HTTP server + static map page |
| `hera_map/sources.py` | backend client with synthetic snapshot fallback |
| `hera_map/routing.py` | route candidates (demo corridors + generated fallback) |
| `hera_map/conditions.py` | weather/road snapshot + adapters (demo scenario, Open-Meteo, GeoJSON road feed) |
| `hera_map/scoring.py` | transparent route scoring, reasons, cautions |
| `hera_map/analytics.py` | population access analytics |
| `hera_map/data/` | synthetic providers/facilities/towns, corridors, scenarios, weights, referral cohort |
| `tools/generate_referrals.py` | regenerates the synthetic referral cohort (seeded) |
| `web/` | interactive Leaflet map |

## Environment

| Variable | Default | Purpose |
|---|---|---|
| `HERA_MAP_PORT` / `HERA_MAP_HOST` | `8001` / `127.0.0.1` | where the service listens |
| `HERA_API_URL` | unset | backend base URL; unset = synthetic snapshot |
| `HERA_DEMO_MODE` | unset | `1` forces all-synthetic, no network calls at all |
| `HERA_CONDITIONS_SCENARIO` | `winter_storm` | demo conditions (`winter_storm`, `clear`) |
| `HERA_LIVE_WEATHER` | unset | `1` = Open-Meteo forecast (no key), falls back to scenario |
| `HERA_ROAD_EVENTS_URL` | unset | GeoJSON road-event feed, falls back to scenario |
| `HERA_SCORING_WEIGHTS` | bundled | path to a weights JSON |
| `HERA_DEMO_TODAY` | `2025-12-17` | "today" for the demo story |
| `HERA_BACKEND_TIMEOUT_S` / `HERA_LIVE_TIMEOUT_S` | `1.5` / `2.5` | network timeouts |

## Language rule

HERA never calls a route "safe". Routes are "recommended based on current access and
route conditions" or "lower-risk based on configured factors". A test enforces this.

## Data

All patients, providers, facilities, referrals, transit schedules and conditions are
synthetic. Town coordinates are approximate public geography, used only to estimate
how populated an area is. Street tiles come from OpenStreetMap when online. Offline,
the map shows town labels on a blank background, and routes, markers and conditions still render.
