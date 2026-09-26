from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel

from app.adapters.mock_ehr_adapter import MockEHRAdapter, PatientNotFoundError
from app.data.store import store
from app.data.studies import STUDIES
from app.engine.research_matching import ResearchEligibilityEngine

router = APIRouter(prefix="/patients", tags=["research"])
studies_router = APIRouter(prefix="/studies", tags=["research"])

_adapter = MockEHRAdapter()
_engine = ResearchEligibilityEngine()


class ConsentRequest(BaseModel):
    consent: bool
    scope: Optional[str] = None


@router.get("/{patient_id}/research-consent")
def get_consent(patient_id: str):
    return jsonable_encoder(store.get_or_create_consent(patient_id))


@router.post("/{patient_id}/research-consent")
def set_consent(patient_id: str, body: ConsentRequest):
    """Explicit, revocable consent. Study matching (below) will return
    nothing for this patient unless consent is currently active."""
    record = store.set_consent(patient_id, body.consent, body.scope)
    return jsonable_encoder(record)


@router.get("/{patient_id}/study-matches")
def get_study_matches(patient_id: str):
    try:
        patient = _adapter.get_patient(patient_id)
        events = _adapter.get_health_events(patient_id)
    except PatientNotFoundError:
        raise HTTPException(status_code=404, detail=f"patient '{patient_id}' not found")
    consent = store.get_or_create_consent(patient_id)
    matches = _engine.find_matches(patient, events, consent, list(STUDIES.values()))
    return jsonable_encoder(matches)


@studies_router.get("")
def list_studies():
    """Researcher-side view: study definitions only, no patient data."""
    return jsonable_encoder(list(STUDIES.values()))
