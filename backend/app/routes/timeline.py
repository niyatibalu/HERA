from datetime import date
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.encoders import jsonable_encoder

from app.adapters.mock_ehr_adapter import MockEHRAdapter, PatientNotFoundError
from app.engine.longitudinal import LongitudinalAnalysisEngine

router = APIRouter(prefix="/patients", tags=["timeline"])
_adapter = MockEHRAdapter()


@router.get("/{patient_id}/health-events")
def get_health_events(patient_id: str):
    try:
        events = _adapter.get_health_events(patient_id)
    except PatientNotFoundError:
        raise HTTPException(status_code=404, detail=f"patient '{patient_id}' not found")
    return jsonable_encoder(sorted(events, key=lambda e: e.event_date))


@router.get("/{patient_id}/trend-flags")
def get_trend_flags(patient_id: str, as_of: Optional[date] = Query(default=None)):
    """Longitudinal pattern flags. `as_of` lets a demo pin the reference
    date for reproducible day-count math (e.g. referral-pending days);
    omit it to use today's date."""
    try:
        events = _adapter.get_health_events(patient_id)
    except PatientNotFoundError:
        raise HTTPException(status_code=404, detail=f"patient '{patient_id}' not found")
    engine = LongitudinalAnalysisEngine(as_of=as_of)
    return jsonable_encoder(engine.analyze(events))
