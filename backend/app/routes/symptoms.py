from datetime import date
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel, Field, field_validator

from app.data.store import store
from app.routes.preferences import _require_patient

router = APIRouter(prefix="/patients", tags=["symptom-log"])


class SymptomBody(BaseModel):
    symptom: str = Field(min_length=1, max_length=80)
    severity: int = Field(ge=0, le=10)
    timing: Literal["before_visit", "after_visit", "general"] = "general"
    visit: Optional[str] = Field(default=None, max_length=120)
    note: str = Field(default="", max_length=2000)
    logged_on: Optional[date] = None
    tags: list[str] = []

    @field_validator("symptom")
    @classmethod
    def not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("symptom must not be blank")
        return v.strip()


@router.get("/{patient_id}/symptom-log")
def list_symptoms(patient_id: str):
    _require_patient(patient_id)
    return jsonable_encoder(store.symptom_log(patient_id))


@router.post("/{patient_id}/symptom-log", status_code=201)
def add_symptom(patient_id: str, body: SymptomBody):
    _require_patient(patient_id)
    fields = body.model_dump()
    if fields["logged_on"] is None:
        fields.pop("logged_on")
    if fields["timing"] == "general":
        fields["visit"] = None
    return jsonable_encoder(store.add_symptom(patient_id, **fields))


@router.delete("/{patient_id}/symptom-log/{entry_id}", status_code=204)
def delete_symptom(patient_id: str, entry_id: str):
    _require_patient(patient_id)
    if not store.delete_symptom(patient_id, entry_id):
        raise HTTPException(status_code=404, detail="symptom log entry not found")
