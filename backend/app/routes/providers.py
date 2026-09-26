from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.encoders import jsonable_encoder

from app.adapters.mock_ehr_adapter import MockEHRAdapter, PatientNotFoundError
from app.data.providers import PROVIDERS
from app.engine.matching import MatchRequest, ProviderMatchingEngine

router = APIRouter(prefix="/patients", tags=["providers"])
_adapter = MockEHRAdapter()
_engine = ProviderMatchingEngine()


@router.get("/{patient_id}/providers")
def match_providers(
    patient_id: str,
    specialty: str = Query(..., description="required specialty, e.g. chronic_pelvic_pain"),
    telehealth: bool = Query(default=False, description="patient prefers a telehealth option"),
    max_distance_mi: Optional[float] = Query(default=None),
):
    try:
        patient = _adapter.get_patient(patient_id)
    except PatientNotFoundError:
        raise HTTPException(status_code=404, detail=f"patient '{patient_id}' not found")

    request = MatchRequest(
        required_specialty=specialty, prefer_telehealth=telehealth, max_distance_mi=max_distance_mi,
    )
    results = _engine.rank(patient, list(PROVIDERS.values()), request)
    return jsonable_encoder(results)
