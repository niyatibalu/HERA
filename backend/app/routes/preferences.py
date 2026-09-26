from typing import Literal, Optional

from fastapi import APIRouter, HTTPException
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel, Field

from app.adapters.mock_ehr_adapter import MockEHRAdapter, PatientNotFoundError
from app.data.store import store
from app.models.preferences import CarePreferences

router = APIRouter(prefix="/patients", tags=["preferences"])
_adapter = MockEHRAdapter()

Slot = Literal["weekday_morning", "weekday_afternoon", "weekday_evening", "weekend"]


class PreferencesBody(BaseModel):
    max_cost_usd: Optional[int] = Field(default=None, ge=0)
    needs_financial_assistance: bool = False
    insurance_plan: Optional[str] = None
    max_distance_mi: Optional[float] = Field(default=None, gt=0)
    expertise: list[str] = []
    min_rating: Optional[float] = Field(default=None, ge=0, le=5)
    availability: list[Slot] = []
    telehealth: Literal["no_preference", "prefer_telehealth", "in_person_only"] = "no_preference"
    provider_gender: Literal["no_preference", "female", "male", "nonbinary"] = "no_preference"


def _require_patient(patient_id: str) -> None:
    try:
        _adapter.get_patient(patient_id)
    except PatientNotFoundError:
        raise HTTPException(status_code=404, detail=f"patient '{patient_id}' not found")


@router.get("/{patient_id}/preferences")
def get_preferences(patient_id: str):
    _require_patient(patient_id)
    return jsonable_encoder(store.get_preferences(patient_id))


@router.put("/{patient_id}/preferences")
def put_preferences(patient_id: str, body: PreferencesBody):
    _require_patient(patient_id)
    data = body.model_dump()
    data["availability"] = list(dict.fromkeys(data["availability"]))
    data["expertise"] = [e.strip() for e in dict.fromkeys(data["expertise"]) if e.strip()]
    if data["insurance_plan"] is not None and not data["insurance_plan"].strip():
        data["insurance_plan"] = None
    return jsonable_encoder(store.set_preferences(CarePreferences(patient_id=patient_id, **data)))
