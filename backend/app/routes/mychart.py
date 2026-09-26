from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel

from app.data.store import store
from app.models.connections import MYCHART_SCOPES
from app.routes.preferences import _require_patient

router = APIRouter(prefix="/patients", tags=["mychart"])


class ConnectBody(BaseModel):
    scopes: Optional[list[str]] = None


@router.get("/{patient_id}/mychart")
def get_mychart(patient_id: str):
    _require_patient(patient_id)
    return jsonable_encoder(store.get_mychart(patient_id))


@router.post("/{patient_id}/mychart/connect")
def connect_mychart(patient_id: str, body: Optional[ConnectBody] = None):
    """Simulated patient-authorized MyChart link. No real MyChart/Epic system is contacted."""
    _require_patient(patient_id)
    scopes = body.scopes if body and body.scopes else None
    if scopes:
        unknown = [s for s in scopes if s not in MYCHART_SCOPES]
        if unknown:
            raise HTTPException(status_code=400, detail=f"unknown scopes: {', '.join(unknown)}")
    return jsonable_encoder(store.connect_mychart(patient_id, scopes))


@router.post("/{patient_id}/mychart/disconnect")
def disconnect_mychart(patient_id: str):
    _require_patient(patient_id)
    return jsonable_encoder(store.disconnect_mychart(patient_id))
