"""
HERA API entrypoint.

Run with: uvicorn app.main:app --reload --port 8000
Interactive docs at /docs once running.

Every route here is a thin wrapper over app/engine/*.py -- no business
logic lives in this HTTP layer. If FastAPI/uvicorn are unavailable for any
reason, the engines still run and are still tested directly (see
app/tests/), so a demo can fall back to a CLI script against the same
engine calls if the HTTP layer can't come up.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import demo, lifecycle, mychart, patients, preferences, providers, research, symptoms, timeline

app = FastAPI(title="HERA API", version="0.1.0")

# Hackathon demo only: wide open so frontend/map can hit this from any
# localhost port without CORS friction. Tighten before any real deployment.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(patients.router)
app.include_router(timeline.router)
app.include_router(providers.router)
app.include_router(lifecycle.router)
app.include_router(research.router)
app.include_router(research.studies_router)
app.include_router(preferences.router)
app.include_router(symptoms.router)
app.include_router(mychart.router)
app.include_router(demo.router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
