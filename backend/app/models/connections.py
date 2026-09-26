"""Record connections, e.g. the patient's MyChart account (simulated)."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Optional

MYCHART_SCOPES = ("visits", "conditions", "medications", "labs", "imaging", "referrals", "clinical_notes")


@dataclass
class ConnectedOrganization:
    name: str
    system_type: str  # ehr | patient_portal | lab | imaging | pharmacy


@dataclass
class MyChartConnection:
    """A patient-authorized, read-only MyChart link. Simulated for the hackathon:
    no real MyChart/Epic account or API is contacted, and the imported data is the
    synthetic record served by MockEHRAdapter."""

    patient_id: str
    status: str = "not_connected"  # not_connected | connected
    simulated: bool = True
    connected_at: Optional[date] = None
    last_synced_at: Optional[date] = None
    scopes: list[str] = field(default_factory=list)
    organizations: list[ConnectedOrganization] = field(default_factory=list)
    imported: dict[str, int] = field(default_factory=dict)  # event_type -> count
