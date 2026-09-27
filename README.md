# HERA

### Connected women’s care, from medical history to the care that comes next.

HERA is a women’s healthcare continuity and access platform designed to connect the pieces of care that often become fragmented across providers, appointments, health systems, and time.

Instead of treating every visit as an isolated event, HERA helps patients and care teams understand the full health journey, identify important longitudinal patterns, find accessible care, navigate the practical barriers to reaching that care, and optionally contribute to women’s health research.

**Live Demo:** https://hera-gamma.vercel.app/

---

## The Problem

Women’s healthcare is often fragmented.

A patient may interact with:

- a primary care physician
- an OB/GYN
- a specialist
- urgent care
- an emergency department
- laboratories
- imaging centers
- another health system entirely

Each provider may only see one piece of the story.

Important information can become scattered across:

- medical records
- laboratory results
- medications
- imaging
- referrals
- specialist notes
- symptom histories
- procedures
- multiple health systems

At the same time, receiving a referral does not necessarily mean a patient can access the recommended care.

A provider may be:

- too far away
- unavailable for weeks
- out of network
- too expensive
- difficult to physically reach
- inaccessible because of transportation or mobility constraints
- impractical to reach during severe weather or road disruptions

This creates two major gaps:

1. **Continuity gap**  
   Providers may not have a clear picture of what has happened across the patient’s entire care journey.

2. **Access gap**  
   Even after the appropriate next step is identified, the patient may struggle to actually receive that care.

HERA is designed to address both.

---

# What HERA Does

HERA creates one continuous layer across a woman’s healthcare journey.

The platform combines six major capabilities:

1. Connected health records
2. Longitudinal health intelligence
3. Intelligent care access
4. Access-aware navigation
5. Continuous care tracking
6. Consent-based research matching

---

## 1. Connected Health Records

With patient authorization, HERA is designed to bring relevant medical information from connected healthcare records into one unified view.

This can include:

- previous appointments
- diagnoses
- symptoms
- medications
- laboratory results
- imaging
- referrals
- procedures
- specialist notes
- ongoing care plans

The goal is not to replace the electronic health record.

The goal is to make the patient’s story understandable across time and across providers.

A future production implementation could integrate with electronic health record systems through standards such as FHIR and supported health-system APIs.

### Current Prototype

The current HERA demo uses **synthetic patient data** to simulate connected health records.

It does **not** access real MyChart accounts or real patient medical information.

---

## 2. Longitudinal Health Intelligence

Medical records are normally organized around individual encounters.

HERA looks across encounters.

Instead of showing a clinician dozens of disconnected events, HERA constructs a longitudinal health timeline and identifies meaningful patterns that may deserve review.

For example:

```text
January
Pelvic pain first documented

March
Heavy menstrual bleeding reported

May
Iron levels decline

July
Pelvic pain worsens

September
Second specialist visit
```

HERA can then surface an insight such as:

> Pelvic pain has been documented across four encounters over eleven months and has increased in severity.

The purpose is not to diagnose the patient.

HERA surfaces **patterns and trends for clinician review**.

Potential signals include:

- persistent symptoms across multiple visits
- increasing symptom severity
- worsening laboratory trends
- repeated treatments without improvement
- repeated visits for related concerns
- unresolved referrals
- incomplete follow-up
- changes across medications or treatment plans

Every future clinical flag should be explainable and connected to the underlying source events.

---

## 3. Intelligent Care Access

When the patient needs another provider or specialist, HERA evaluates whether the original care option is actually realistic.

Instead of only returning the closest provider, HERA can consider:

- specialty
- relevant clinical expertise
- appointment availability
- wait time
- insurance compatibility
- expected cost
- travel distance
- telehealth availability
- accessibility requirements

If the original option is difficult to access, HERA can present alternatives.

### Example

#### Original Referral

- 43-day wait
- 58 miles away
- out of network

#### HERA Alternative

- 8-day wait
- 14 miles away
- in network
- relevant specialty expertise

HERA explains **why** an option may be a better match instead of relying on an unexplained black-box score.

The patient remains in control of the final provider choice.

---

## 4. Access-Aware Navigation

Finding a provider is only useful if the patient can realistically reach them.

HERA extends care navigation beyond simple distance calculations.

The routing layer can account for factors such as:

- travel time
- severe weather
- snow or sleet
- road closures
- construction
- road conditions
- major versus isolated roads
- proximity to populated areas
- nearby healthcare resources
- public transportation
- facility accessibility
- individual mobility needs

Instead of displaying only one route, HERA can explain tradeoffs.

### Example

#### Fastest Route
**38 min**

- moderate winter-weather exposure
- active construction

#### HERA Recommended Route
**44 min**

- primarily major roads
- lower weather exposure
- avoids reported construction
- passes nearby healthcare facilities

#### Public Transit
**61 min**

HERA does not claim to determine whether a route is objectively safe.

It recommends routes based on the access and travel conditions available to the system.

---

## 5. Continuous Care Journey

HERA does not stop when a referral is placed.

It tracks whether the patient actually progresses through care.

A care journey might look like:

```text
Care need identified
        ↓
Provider matched
        ↓
Medical records available
        ↓
Appointment scheduled
        ↓
Travel planned
        ↓
Visit completed
        ↓
Follow-up completed
```

If something stops progressing, HERA can surface it.

For example:

> Specialist evaluation has been waiting for an appointment for 9 days.

HERA can then help the patient find another option rather than allowing the care pathway to quietly disappear.

This changes the definition of success from:

> Referral placed

to:

> **Care received**

---

## 6. Consent-Based Research Network

One of HERA’s longer-term goals is to help close another major gap in women’s healthcare: the lack of high-quality research data and difficulty recruiting appropriate participants for studies.

HERA can ask patients whether they would like to **voluntarily opt into research matching**.

Participation is optional.

Declining does not affect the patient’s healthcare experience.

A patient may choose to allow a privacy-protected version of their health profile to be considered for relevant research opportunities.

For example, a study might seek participants with:

```text
Age: 18–35
Chronic pelvic pain: >6 months
Previous hormonal therapy: yes
Persistent symptoms: yes
```

HERA could identify consented patients whose profiles potentially match those criteria.

Researchers initially see only de-identified candidate information.

HERA can then ask the patient:

> A women’s health study may match your health profile. Would you like to learn more?

The patient still decides whether to continue.

HERA does **not** automatically enroll patients in research and does not treat AI-based matching as final clinical-study eligibility.

Formal screening and research consent remain part of the study process.

---

# The HERA Loop

HERA is designed around a simple idea:

```text
Connected records
        ↓
Understand the patient’s history
        ↓
Identify longitudinal patterns
        ↓
Determine what care is needed next
        ↓
Find accessible care
        ↓
Help the patient reach it
        ↓
Track whether care was completed
        ↓
Build better longitudinal understanding
        ↓
Optional research participation
        ↓
Better women’s health evidence
```

### Better care creates better data.

### Better data can help create better future care.

---

# Example Patient Journey

Meet **Maya**, a synthetic patient used in the HERA demonstration.

Maya has experienced persistent pelvic pain across several healthcare encounters.

Her health information includes:

- recurring pelvic pain
- heavy menstrual bleeding
- changing laboratory values
- multiple medication trials
- OB/GYN visits
- a specialist referral

Individually, these appear as separate events.

HERA connects them into a timeline.

### HERA Notices

> Pelvic pain has persisted across multiple encounters and continues despite previous treatment adjustments.

The pattern is surfaced for clinician review.

Maya then needs a specialist.

Her original option has a long wait and significant travel burden.

HERA identifies more accessible alternatives and explains the tradeoffs.

After Maya selects a provider, HERA:

1. connects the relevant care information
2. tracks the appointment process
3. helps evaluate realistic travel options
4. monitors whether care is completed
5. continues updating her longitudinal timeline

If Maya separately opts into research matching, HERA can also notify her about studies she may potentially qualify for.

---

# Who HERA Is For

## Patients

HERA gives women a clearer understanding of their care journey and helps remove practical barriers between needing care and receiving it.

## Clinicians

Clinicians gain longitudinal context instead of reviewing isolated visits one by one.

## Care Coordinators

HERA helps identify patients whose care pathways are stalled or incomplete.

## Health Plans and Health Systems

Organizations gain visibility into:

- care completion
- access barriers
- provider shortages
- long wait times
- geographic gaps
- stalled care journeys
- patient navigation needs

## Researchers

With explicit patient consent, HERA can eventually provide infrastructure for finding potentially eligible participants for women’s health studies.

---

# Business Model

HERA is designed to remain **free for patients**.

Patients who already experience barriers to healthcare should not have to pay another fee to overcome those barriers.

The primary commercial model is **B2B2C**.

## Primary Payers

Potential customers include:

- Medicaid managed-care organizations
- health plans
- health systems
- maternal-health programs
- value-based care organizations

These organizations can provide HERA to eligible patients at no cost.

HERA can be priced using:

- enterprise platform contracts
- per-member pricing
- per-pregnancy pricing
- per-care-episode pricing

## Why Organizations Pay

HERA is designed to help improve:

- completion of recommended care
- continuity between providers
- specialist access
- patient navigation
- follow-up completion
- care-coordinator efficiency
- visibility into access barriers

## Future Research Revenue

Patients may separately opt into research matching.

Pharmaceutical companies, universities, CROs, and research organizations could pay HERA for:

- study recruitment infrastructure
- cohort discovery
- participant matching
- recruitment campaigns

Researchers would pay for **recruitment infrastructure**, not unrestricted access to identifiable patient medical records.

The patient remains in control.

---

# Privacy by Design

HERA deals with highly sensitive healthcare information.

Any production implementation would require rigorous privacy, security, compliance, and consent controls.

Core principles include:

- explicit patient authorization for health-record access
- explicit and separate consent for research participation
- minimum necessary data access
- role-based permissions
- secure transmission and storage
- auditability
- revocable research consent
- de-identification where appropriate

The current demonstration uses only fictional and synthetic information.

---

# AI Philosophy

HERA uses AI to organize and interpret complexity, not to replace clinicians.

AI can assist with:

- extracting structured information from medical records
- summarizing longitudinal histories
- identifying patterns across visits
- highlighting unresolved care
- explaining provider matches
- matching consented patients to potential research studies

AI should **not** independently:

- diagnose a patient
- prescribe treatment
- replace emergency medical judgment
- determine final research eligibility
- make autonomous clinical decisions

Important outputs should remain explainable and connected to supporting evidence.

---

# Product Principles

## Patient First

Care recommendations should optimize for the patient’s ability to receive appropriate care, not simply keep them inside a particular health system.

## Continuity Over Encounters

Healthcare should be understood as a journey rather than a collection of disconnected appointments.

## Access Means Completion

Finding a provider is not enough.

Success means the patient actually receives the care.

## Explainable Intelligence

HERA should show why something was flagged or recommended.

## Consent Is Active

Research participation and medical-record access should never be assumed.

## Technology Should Remove Friction

Patients should not need to understand healthcare infrastructure in order to navigate it.

---

# Current Prototype

The current HERA prototype demonstrates:

- patient dashboard
- longitudinal health timeline
- health trend identification
- active care journeys
- specialist and provider discovery
- access-aware care navigation
- referral and care tracking
- connected-record experience
- research consent workflow
- potential research matching
- health-system access insights

The demo uses synthetic data and simulated integrations.

---

# Tech Stack

- **Frontend:** React 19 + TypeScript, Vite, React Router; plain CSS design system (Inter); Vitest + Testing Library
- **Backend:** Python, FastAPI + Uvicorn: synthetic EHR adapter, provider matching, care-journey lifecycle, symptom log, care preferences, simulated MyChart connection, research consent and matching, demo sign-in
- **Access map:** Python standard library only (no dependencies): route scoring, weather/road-condition adapters (optional live Open-Meteo weather), pregnancy-aware routing and access analytics; Leaflet (vendored) with OpenStreetMap tiles
- **Deployment:** Vercel (web app and access map); the backend is designed for an always-on host such as Railway (see `docs/DEPLOY.md`)
- **Data:** synthetic demo datasets (patients, providers, facilities, routes, conditions, referral cohort)

---

# Running HERA Locally

Clone the repository:

```bash
git clone https://github.com/sahanaganesh-code/HERA.git
cd HERA
```

Install dependencies (one time):

```bash
cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt && cd ..
cd frontend && npm ci && cd ..
```

The access map (`map/`) needs no installation: it uses only the Python standard library.

Start everything (backend on :8000, access map on :8001, web app on :5173) and run the startup checks:

```bash
./scripts/start_demo.sh
```

Then open http://localhost:5173 and sign in as the demo patient (`maya@example.com` / `HeraDemo2025!`, or **Use this account**).

Run the tests:

```bash
cd backend && .venv/bin/python -m pytest -q app/tests    # backend
cd map && python3 -m unittest discover -s tests -t .     # access map
cd frontend && npm test                                  # web app
```

See `DEMO.md` for the full demo walkthrough and fallbacks, and `docs/API_CONTRACT.md` / `docs/MAP_API.md` for the APIs.

---

# Environment Variables

None are required: everything runs on synthetic data by default. Optional settings (see `.env.example`):

```env
# Web app (frontend/.env.local)
VITE_HERA_API_URL=http://127.0.0.1:8000   # backend; unset = built-in data
VITE_HERA_MAP_URL=http://127.0.0.1:8001   # access map; unset = sample routes

# Access map
HERA_API_URL=http://127.0.0.1:8000        # read patients/providers from the backend (falls back if down)
HERA_DEMO_MODE=1                          # force fully offline, deterministic data
HERA_LIVE_WEATHER=1                       # live Open-Meteo forecast (no key needed)
```

Do not commit production API keys or secrets to the repository.

Use `.env.local` for local development and ensure sensitive files are included in `.gitignore`.

---

# Demo Mode

HERA is designed to support a deterministic demo experience using synthetic patient information.

This allows the full care flow to be demonstrated without exposing real patient information or depending entirely on live healthcare integrations.

Demo mode may include:

- synthetic patient records
- predefined health trends
- sample provider options
- simulated access barriers
- predetermined route conditions
- mock research studies

Demo data should never be interpreted as real medical advice or real-world clinical outcomes.

---

# Architecture

```text
HERA/
├── frontend/          React + Vite web app
│   └── src/
│       ├── pages/          Home, Records, Health timeline, Care (find care, appointments, journey, map), Research, Sign in
│       ├── components/     ProviderMatchCard, Scheduler, CareJourney, RouteOptions, AccessMapFrame, MyChartCard, …
│       ├── api/            API client with built-in fallback data
│       └── mocks/          synthetic fallback data
│
├── backend/           FastAPI service
│   └── app/
│       ├── engine/         provider matching, care lifecycle, longitudinal analysis, research matching
│       ├── routes/         patients, providers, care journeys, preferences, symptom log, MyChart, research, auth
│       ├── models/         records, care, preferences, symptoms, connections, research
│       ├── adapters/       synthetic EHR adapter (FHIR-style boundary)
│       └── data/           synthetic patients, providers, studies, demo store
│
├── map/               Access map service (Python stdlib)
│   ├── hera_map/          routing, scoring, conditions, analytics, server
│   ├── web/               Leaflet map page
│   └── app.py             WSGI entry point for hosting
│
├── docs/              API contracts, deployment guide
├── scripts/           start_demo.sh
└── DEMO.md            demo walkthrough
```

---

# Roadmap

## Near Term

- production-ready provider matching
- real scheduling integrations
- standards-based health-record connectivity
- stronger longitudinal trend analysis
- multilingual patient experience
- SMS and low-bandwidth access
- transportation-resource integrations
- accessibility personalization
- real-time route-condition integrations

## Longer Term

- health-system interoperability across organizations
- Medicaid and payer integrations
- real-time specialist availability
- regional care-access intelligence
- maternal-care deployments
- expansion into broader women’s health
- consent-based clinical research network
- longitudinal real-world evidence infrastructure

---

# Initial Market

HERA can begin with **maternal healthcare**, particularly for Medicaid-covered and underserved pregnant and postpartum patients.

Maternal care provides a strong initial use case because a single pregnancy can involve:

- primary care
- obstetrics
- maternal-fetal medicine
- imaging
- laboratories
- hospital care
- transportation
- delivery
- postpartum follow-up

The same underlying continuity infrastructure can later expand into:

- pelvic health
- endometriosis
- PCOS
- reproductive health
- menopause
- women’s cardiovascular health
- other complex women’s-health journeys

---

# Future Research Network

HERA’s research layer is designed around a simple principle:

> The patient is the beneficiary, not the product.

Patients can voluntarily choose to participate in research matching.

Researchers can define eligibility criteria.

HERA can identify potentially eligible, consented participants using de-identified profiles.

The patient is then asked whether she wants to learn more.

This can help researchers:

- find appropriate participants
- reach populations historically underrepresented in research
- improve recruitment efficiency
- build stronger women’s-health datasets

without giving unrestricted access to identifiable patient data.

---

# Limitations

The current version of HERA is a prototype.

Current limitations include:

- synthetic patient data
- simulated EHR integration
- simulated provider availability
- simulated research matching
- incomplete production compliance infrastructure
- no autonomous clinical decision-making
- no validated medical-device functionality

A production deployment would require significant additional work around:

- HIPAA compliance
- healthcare interoperability
- clinical validation
- regulatory review where applicable
- security
- patient consent
- data governance
- health-system integrations
- liability and risk management

---

# Vision

Healthcare should not require patients to become their own care coordinators.

Women should not have to reconstruct their medical history every time they see a new clinician.

A referral should not become a dead end because the provider is inaccessible.

Important health patterns should not disappear simply because they occurred across different appointments.

And women should have the choice to help build the research evidence that future care depends on.

HERA’s goal is to connect those pieces.

## Every doctor sees an appointment. HERA sees the journey.

---

# Disclaimer

HERA is currently a prototype.

The application:

- is not a medical device
- does not provide medical diagnoses
- does not replace professional medical advice
- does not contain real patient data
- does not currently provide production clinical decision support
- should not be used for emergency care

For medical emergencies, contact appropriate emergency services or a qualified healthcare professional.

---

# HERA

### Connected women’s care.

**A referral isn’t access. Receiving care is.**
