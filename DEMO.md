# HERA demo script

Draft from backend. Every number below is real output from the running
API (`backend/app/main.py`), not made up — re-run the calls yourself with
`uvicorn app.main:app --reload --port 8000` and hit `/docs` to check.
Frontend/map: build your screens to reproduce this flow; adjust wording
once your UI exists, but keep the underlying data points, since they're
what's actually implemented and testable.

## Startup

```bash
# one-time
cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt && cd ..
cd frontend && npm ci && cd ..          # once feature/frontend is merged
# every time
./scripts/start_demo.sh                 # backend :8000, map :8001, frontend :5173 + preflight
```

Or start each service by hand:

| Service | Command | URL |
|---|---|---|
| Backend | `cd backend && .venv/bin/uvicorn app.main:app --port 8000` | http://127.0.0.1:8000/docs |
| Access map | `cd map && HERA_API_URL=http://127.0.0.1:8000 python3 -m hera_map.server` | http://127.0.0.1:8001/map/ |
| Frontend | `cd frontend && VITE_HERA_API_URL=http://127.0.0.1:8000 VITE_HERA_MAP_URL=http://127.0.0.1:8001 npm run dev` | http://localhost:5173 |

Check everything with `python3 map/tools/preflight.py` before presenting.

## Environment variables

None are required. Everything defaults to synthetic data. See `.env.example`.

| Variable | Used by | Purpose |
|---|---|---|
| `VITE_HERA_API_URL` | frontend | backend URL; unset = built-in demo data |
| `VITE_HERA_MAP_URL` | frontend | map URL; unset = sample routes |
| `HERA_API_URL` | map | backend URL; unset = map's synthetic snapshot |
| `HERA_DEMO_MODE=1` | map | force fully offline, no network calls |
| `HERA_CONDITIONS_SCENARIO` | map | `winter_storm` (default) or `clear` |
| `HERA_LIVE_WEATHER=1` | map | real Open-Meteo forecast (only useful for real dates); falls back to the scenario |

## Demo mode

HERA works with **no internet and no external APIs**:
- Backend: synthetic EHR, deterministic engines, no LLM.
- Map: stdlib server, vendored Leaflet, deterministic `winter_storm` conditions,
  predefined corridors, synthetic referral cohort. Street tiles need internet. Without
  them, the map shows town labels on a blank background, and routes, markers and conditions still render.
- Frontend: every call falls back to built-in synthetic data if its service is down.

For a guaranteed-offline run: `HERA_DEMO_MODE=1 ./scripts/start_demo.sh`.

## Exact demo sequence (~4 min)

1. **Overview → Health record** (`/`, `/record`): Maya, 29, 3 connected record sources, 20 events.
2. **Timeline** (`/timeline`): pelvic pain across encounters and falling ferritin. Point at the
   *persistent_symptom* flag: "for clinician review", never a diagnosis.
3. **Care access** (`/access`): the original referral (Dr. Whitfield, Chicago) is out of
   network, has a 61-day wait and is 122 mi away. Click **Find better options**, then choose **Dr. Okafor**
   (in network, 12-day wait, 1.7 mi, speaks Spanish).
4. **Care journey** (`/journey`): steps advance through matched → records shared → scheduled.
   Under **Plan how to get there**, the map scores routes for the Dec 29 appointment during a
   winter storm:
   - *Fastest route*: 18 min via Regent St, high weather risk, construction, unplowed side streets
   - *HERA recommended*: 28 min via Park St & the Beltline. "Recommended because it uses
     major roads, avoids reported construction, and has lower winter-weather exposure."
   - *Public transit*: 31 min, 1 transfer, step-free. *Telehealth*: available Dec 19.
   Pick **HERA recommended** → **Use HERA recommended**. The journey moves to *Travel planned*.
   The embedded map above the cards shows each route. Clicking a card highlights that route on the
   map, and clicking a route on the map selects its card.
5. **Access map** (sidebar → *Access map*, inside the app): show the route
   lines, the snow zone and the construction marker. Click a route to see its factor breakdown. Switch
   *Travel conditions* to **Clear**: the recommendation flips back to the fastest route, which shows the
   scoring reacting to conditions and not just picking the shortest route. Click **Dr. Renee Whitfield** to show the
   original referral: over 3 hours each way, and the direct I-39/90 route crosses a sleet zone and construction.
6. **Population access**: tick **Show regional care gaps**. Rural SW Wisconsin
   (Dodgeville, Platteville, Richland Center) is a care gap. Across the 320 synthetic referrals,
   220 patients were referred more than 30 mi away and 87 still were after HERA rerouting, and the average wait fell from 52.5 to 27.9 days.
7. **Research** (`/research`): no study matches before consent. Consent, then one
   *potentially eligible* match appears under a pseudonymous `candidate_id`. The patient chooses whether to learn more.

Always say "recommended based on current access and route conditions", never "safe".

## Fallback instructions

| If this breaks… | Do this |
|---|---|
| Backend won't start | Keep going. Frontend and map switch to synthetic data automatically, with the same story. |
| Map service down | Frontend shows sample routes. Restart it with `cd map && HERA_DEMO_MODE=1 python3 -m hera_map.server`. |
| Frontend won't start | Present from the standalone map page http://127.0.0.1:8001/map/?provider_id=prov-alt-best (steps 5–6), and show API responses at `:8000/docs`. |
| No Wi-Fi | `HERA_DEMO_MODE=1 ./scripts/start_demo.sh`. The map loses street tiles but keeps everything else. |
| Browser state weird | Refresh. Frontend demo state resets. To reset backend journeys, restart the backend. |
| Everything is down | Use the screenshots and recording in the team drive (capture them during the final rehearsal). |

## Patient: Maya, 29 (`maya-001`)

Pelvic pain since January 2025. Referred to a specialist who is 122 miles
away, out-of-network, with a 61-day wait. HERA finds an alternative and
tracks the pathway through to research eligibility.

## The flow, screen by screen

### 1. Health record loads
`GET /patients/maya-001` → `GET /patients/maya-001/health-events`
20 events across Jan–Dec 2025, spanning primary care and OB/GYN.

### 2. Longitudinal flags appear
`GET /patients/maya-001/trend-flags`
Six flags fire, each with cited evidence, no diagnostic language:
- **persistent_symptom** — pelvic pain, 5 encounters over 11 months, worsening
- **lab_trend** — ferritin declined 22 → 8 ng/mL (May → Aug)
- **repeated_treatment_no_improvement** — 2 hormonal therapy trials, no change
- **multiple_specialist_visits** — primary care + OB/GYN, unresolved
- **unresolved_referral** — pending referral, no appointment scheduled
- **care_gap** — heavy menstrual bleeding, no follow-up in 293 days

Lead with the persistent_symptom flag on screen — it's the one that reads
closest to a real clinical note.

### 3. Provider match — the "nearest vs. optimized" moment
`GET /patients/maya-001/providers?specialty=chronic_pelvic_pain&telehealth=true`

| Provider | Score | Distance | Note |
|---|---|---|---|
| **Dr. Ifeoma Okafor** | 94.8 | 1.7 mi | in-network, 12-day wait, speaks Spanish |
| Kara Whitmore, DPT | 78.4 | 71 mi | telehealth-first alternative |
| Dr. Sarah Lindqvist | 74.6 | 0.7 mi | her existing OB/GYN |
| Dr. Michael Chen | 69.7 | 6.1 mi | general gyn, longer wait |
| **Dr. Renee Whitfield** | 36.6 | 122.3 mi | **the original referral** — out-of-network, 61-day wait |

The gap between Whitfield (36.6) and Okafor (94.8) *is* the demo. Show
both `match_reasons` and `access_tradeoffs` on screen for each, not just
the score — that's what makes the ranking legible instead of a black box.

### 4. Care pathway advances
`GET /patients/maya-001/care-journeys` → one seeded journey at
`need_identified`.
`POST /patients/maya-001/care-journeys/{id}/advance {"state": "provider_matched"}`
→ then `appointment_scheduled`, etc. Each step is a real state transition,
not a progress bar animation.

### 5. Research consent → study match
`GET /patients/maya-001/study-matches` before consent → **empty array**.
`POST /patients/maya-001/research-consent {"consent": true}`
`GET /patients/maya-001/study-matches` after → **one match**:
> Chronic Pelvic Pain Hormonal Therapy Outcomes Study — potentially
> eligible, 5/5 evaluable criteria met — `candidate_id: candidate-381ea449c617`
> (never Maya's real ID)

This order matters for the demo: show the empty list *before* consent,
then the match appearing *after*, live. That's the whole privacy pitch in
one interaction.

## What's real vs. what needs building

| Piece | Status |
|---|---|
| All data above | Real, running, tested (45/45 backend tests pass) |
| Trend flags, provider ranking, lifecycle, consent gating | Real logic, not scripted |
| The map screen (route options, weather/road conditions) | Built: `map/`, API in `docs/MAP_API.md`. Conditions are a deterministic synthetic scenario by default, with live Open-Meteo weather opt-in |
| Access analytics | Built: `GET :8001/analytics/access` over a synthetic referral cohort |
| Frontend screens | Not built yet — this doc is what they should render |
| Voice/SMS verification | Not in backend scope — check with whoever owns integrations |

## Backup plan

If live API calls fail during the actual demo: every response above can be
hardcoded as a fallback JSON blob per screen (screenshot the real output
now, while it works, and keep it). The backend itself requires no network
access and no LLM to produce any of this — see `docs/API_CONTRACT.md`
FAILSAFE section — so the only real failure mode is the demo laptop's own
server not being up. Start it early, leave it running.
