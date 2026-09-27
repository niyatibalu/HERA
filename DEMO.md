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

## Sign in

The app opens on a sign-in page. Use the synthetic demo account, or click **Use demo account**:

| Email | Password |
|---|---|
| `maya@example.com` | `HeraDemo2025!` |

It's a fictional patient with synthetic data only. The backend checks the password against a salted hash (`backend/app/routes/auth.py`).
If the backend is down, the frontend checks the same demo account locally so the demo still opens. This gates the web
app for the demo; it is not production authentication (the other API routes are not protected).

## Exact demo sequence (~4 min)

0. **Sign in** as Maya (above).

1. **Home** (`/`): "Good morning, Maya" with one priority: *Specialist referral stalled, no appointment booked after 9 days*. Below it: her care journey, latest note, upcoming care and symptoms.
2. **Records → Connect MyChart**: show what HERA asks to read (read-only), then **Allow and connect**.
   20 records import from 3 health systems. Say it clearly: the connection is simulated and the data synthetic.
3. **Health timeline** (`/timeline`): her visits in order, with her own notes before and after each. Log a new
   "before visit" note for the upcoming specialist visit. HERA stores the notes and doesn't interpret them.
   (Trends aren't in HERA: patients already get them in MyChart.)
4. **Care → Find care** (`/access`): **Your care preferences** covers budget and financial assistance,
   insurance, travel limit, expertise and minimum rating, availability, telehealth and clinician gender.
   The original referral (Dr. Whitfield, Chicago) is out of network, has a 61-day wait and is 122 mi away.
   Click **Find better options**. Dr. Okafor ranks first, with reasons tied to Maya's preferences
   ("Within your budget", "Has appointments when you're free", "Matches your preference for a female
   clinician"). Optional: **Edit preferences**, switch the clinician to *Male*, then **Save and re-rank**
   to show the ranking change, and switch it back. Choose **Dr. Okafor**, pick **In person**, choose
   **Mon, Dec 29 at 5:30 PM**, then **Book**. The confirmation has **Next: plan your trip**.
   **Care → Appointments** shows the booking with **Reschedule** and **Cancel appointment** (asks first, records a reason).
   Optional: tick **Planning for pregnancy** on the journey's travel step (or **I'm pregnant** in preferences). The top route
   becomes *Recommended for pregnancy*, and each route shows a ✓/✕ pregnancy check (distance to labor & delivery care,
   places to stop, icy stretches, weather, walking). Clinicians experienced with pregnancy get a badge and rank higher.
5. **Care → Journey** (`/journey`): steps advance through matched → records shared → scheduled.
   Under **Plan how to get there**, the embedded map scores routes for the Dec 29 appointment during a winter storm:
   - *Fastest route*: 18 min via Regent St, high weather risk, construction, unplowed side streets
   - *HERA recommended*: 28 min via Park St & the Beltline, "uses major roads, avoids reported
     construction, and has lower winter-weather exposure"
   Click cards to highlight routes on the map, then **Use HERA recommended**. The journey moves to *Travel planned*.
6. **Care → Map**: switch *Travel conditions* to **Clear** and the recommendation flips to the fastest
   route. Tick **Show regional care gaps**: rural SW Wisconsin is a care gap (synthetic cohort).
7. **Research** (`/research`): no study matches before consent. Consent, then one *potentially eligible*
   match appears under a pseudonymous `candidate_id`.

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
