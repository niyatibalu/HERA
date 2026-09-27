"""Care lifecycle: the state a patient's care need is in, end to end."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from enum import Enum
from typing import Optional


class CareState(str, Enum):
    NEED_IDENTIFIED = "need_identified"
    PROVIDER_MATCHED = "provider_matched"
    RECORDS_READY = "records_ready"
    APPOINTMENT_SCHEDULED = "appointment_scheduled"
    TRAVEL_PLANNED = "travel_planned"
    APPOINTMENT_COMPLETED = "appointment_completed"
    FOLLOWUP_REQUIRED = "followup_required"
    FOLLOWUP_COMPLETED = "followup_completed"
    STALLED = "stalled"


# States listed in their expected forward order. Used to detect regressions
# and to measure "how long has this sat in its current state".
STATE_ORDER = [
    CareState.NEED_IDENTIFIED,
    CareState.PROVIDER_MATCHED,
    CareState.RECORDS_READY,
    CareState.APPOINTMENT_SCHEDULED,
    CareState.TRAVEL_PLANNED,
    CareState.APPOINTMENT_COMPLETED,
    CareState.FOLLOWUP_REQUIRED,
    CareState.FOLLOWUP_COMPLETED,
]

# Per-state expected max days before HERA considers the pathway at risk of
# stalling. Tunable; deliberately generous where a state can legitimately
# take a while (e.g. waiting for an appointment date).
STALL_THRESHOLD_DAYS = {
    CareState.NEED_IDENTIFIED: 3,
    CareState.PROVIDER_MATCHED: 9,
    CareState.RECORDS_READY: 5,
    CareState.APPOINTMENT_SCHEDULED: 45,  # covers wait time up to the visit
    CareState.TRAVEL_PLANNED: 14,
    CareState.APPOINTMENT_COMPLETED: 2,
    CareState.FOLLOWUP_REQUIRED: 30,
}


@dataclass
class StateTransition:
    state: CareState
    entered_at: date
    note: Optional[str] = None


@dataclass
class CareJourney:
    journey_id: str
    patient_id: str
    need: str  # human-readable, e.g. "pelvic pain specialist evaluation"
    state: CareState
    state_history: list[StateTransition] = field(default_factory=list)
    provider_id: Optional[str] = None
    appointment_date: Optional[date] = None
    appointment_time: Optional[str] = None  # "HH:MM", 24h, clinic local time
    appointment_modality: Optional[str] = None  # in_person | telehealth
    stalled: bool = False
    stalled_reason: Optional[str] = None
