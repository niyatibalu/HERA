from fastapi import APIRouter, HTTPException
from fastapi.encoders import jsonable_encoder

from app.adapters.mock_ehr_adapter import MockEHRAdapter, PatientNotFoundError

router = APIRouter(prefix="/patients", tags=["patients"])
_adapter = MockEHRAdapter()


@router.get("")
def list_patients():
    return {"patient_ids": _adapter.list_patient_ids()}


@router.get("/{patient_id}")
def get_patient(patient_id: str):
    try:
        patient = _adapter.get_patient(patient_id)
    except PatientNotFoundError:
        raise HTTPException(status_code=404, detail=f"patient '{patient_id}' not found")
    return jsonable_encoder(patient)
