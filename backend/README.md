# HERA backend

## Run

    python3 -m venv .venv && source .venv/bin/activate
    pip install -r requirements.txt
    uvicorn app.main:app --reload --port 8000

Then see `docs/API_CONTRACT.md` (repo root) for endpoints, or open
http://localhost:8000/docs for interactive Swagger UI.

## Test

No install required -- the engine and data layer are pure stdlib:

    python3 -m unittest discover -s app/tests -v

## Layout

    app/models/     dataclasses: Patient, HealthEvent, Provider, TrendFlag,
                     CareJourney, ResearchConsent, Study, StudyMatch
    app/adapters/    HealthRecordAdapter interface + MockEHRAdapter
                     (synthetic data only -- see app/data/)
    app/data/        synthetic patients (incl. demo patient Maya), providers,
                     mock studies
    app/engine/      longitudinal analysis, provider matching, care
                     lifecycle, research eligibility -- all deterministic,
                     no LLM/network required
    app/routes/      FastAPI HTTP layer over the engines above
    app/tests/       unittest suite, zero external dependencies
