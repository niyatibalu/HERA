# HERA demo script

Draft from backend. Every number below is real output from the running
API (`backend/app/main.py`), not made up — re-run the calls yourself with
`uvicorn app.main:app --reload --port 8000` and hit `/docs` to check.
Frontend/map: build your screens to reproduce this flow; adjust wording
once your UI exists, but keep the underlying data points, since they're
what's actually implemented and testable.

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
| The map screen (route options, weather/road conditions) | Not built yet — map owner's scope. `Provider.location` / `Patient.home_location` lat/lon are real and ready to consume |
| Frontend screens | Not built yet — this doc is what they should render |
| Voice/SMS verification | Not in backend scope — check with whoever owns integrations |

## Backup plan

If live API calls fail during the actual demo: every response above can be
hardcoded as a fallback JSON blob per screen (screenshot the real output
now, while it works, and keep it). The backend itself requires no network
access and no LLM to produce any of this — see `docs/API_CONTRACT.md`
FAILSAFE section — so the only real failure mode is the demo laptop's own
server not being up. Start it early, leave it running.
