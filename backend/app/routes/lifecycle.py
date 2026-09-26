from datetime import date
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel

from app.data.providers import PROVIDERS
from app.data.store import store
from app.engine.lifecycle import InvalidTransitionError
from app.models.care import CareState

router = APIRouter(prefix="/patients", tags=["care-lifecycle"])


class StartJourneyRequest(BaseModel):
    need: str


class AdvanceRequest(BaseModel):
    state: CareState
    note: Optional[str] = None
    # Optional: set/overwrite the journey's provider or appointment date in
    # the same call as the state transition (e.g. re-matching to a new
    # provider while moving into provider_matched). Omitting both leaves
    # whatever is already stored untouched -- a {state, note}-only request
    # keeps working exactly as before.
    provider_id: Optional[str] = None
    appointment_date: Optional[date] = None


def _serialize_journey(journey) -> dict:
    payload = jsonable_encoder(journey)
    payload["stall_warning"] = store.check_stalled(journey)
    return payload


@router.get("/{patient_id}/care-journeys")
def list_journeys(patient_id: str):
    return [_serialize_journey(j) for j in store.journeys_for(patient_id)]


@router.post("/{patient_id}/care-journeys")
def start_journey(patient_id: str, body: StartJourneyRequest):
    journey = store.start_journey(patient_id, body.need)
    return _serialize_journey(journey)


@router.post("/{patient_id}/care-journeys/{journey_id}/advance")
def advance_journey(patient_id: str, journey_id: str, body: AdvanceRequest):
    journey = store.journeys.get(journey_id)
    if journey is None or journey.patient_id != patient_id:
        raise HTTPException(status_code=404, detail="care journey not found")
    if body.provider_id is not None and body.provider_id not in PROVIDERS:
        raise HTTPException(status_code=400, detail=f"unknown provider_id '{body.provider_id}'")
    try:
        journey = store.advance_journey(
            journey_id, body.state, body.note,
            provider_id=body.provider_id, appointment_date=body.appointment_date,
        )
    except InvalidTransitionError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return _serialize_journey(journey)
