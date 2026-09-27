"""
Care lifecycle engine.

Advances and inspects a CareJourney through its states, and detects when a
pathway has stalled -- sitting in a state longer than expected with no
forward progress. This is what turns "a referral was placed" into "we know
whether the patient actually got care."
"""

from __future__ import annotations

from datetime import date
from typing import Optional

from app.models.care import STALL_THRESHOLD_DAYS, STATE_ORDER, CareJourney, CareState, StateTransition


class InvalidTransitionError(ValueError):
    pass


class CareLifecycleEngine:
    def __init__(self, as_of: Optional[date] = None):
        self.as_of = as_of or date.today()

    def start_journey(
        self,
        journey_id: str,
        patient_id: str,
        need: str,
        started_at: date,
        provider_id: Optional[str] = None,
    ) -> CareJourney:
        journey = CareJourney(
            journey_id=journey_id,
            patient_id=patient_id,
            need=need,
            state=CareState.NEED_IDENTIFIED,
            provider_id=provider_id,
        )
        journey.state_history.append(StateTransition(state=CareState.NEED_IDENTIFIED, entered_at=started_at))
        return journey

    def advance(
        self,
        journey: CareJourney,
        new_state: CareState,
        at: date,
        note: Optional[str] = None,
        provider_id: Optional[str] = None,
        appointment_date: Optional[date] = None,
        appointment_time: Optional[str] = None,
        appointment_modality: Optional[str] = None,
    ) -> CareJourney:
        """Move a journey to a new state. Allows forward progress in
        STATE_ORDER, or a transition into/out of STALLED at any point --
        a pathway can stall from any state and can resume from stalled
        back into the state it stalled in.

        `provider_id`/`appointment_date` are optional and only overwrite
        the journey's stored value when explicitly passed -- a caller that
        sends only `{state, note}` leaves both untouched.
        """
        if new_state == CareState.STALLED:
            journey.stalled = True
            journey.stalled_reason = note
        else:
            if journey.state == CareState.STALLED:
                journey.stalled = False
                journey.stalled_reason = None
            elif new_state in STATE_ORDER and journey.state in STATE_ORDER:
                if STATE_ORDER.index(new_state) < STATE_ORDER.index(journey.state):
                    raise InvalidTransitionError(
                        f"cannot move backward from {journey.state.value} to {new_state.value}"
                    )
        journey.state = new_state
        journey.state_history.append(StateTransition(state=new_state, entered_at=at, note=note))
        if provider_id is not None:
            journey.provider_id = provider_id
        if appointment_date is not None:
            journey.appointment_date = appointment_date
        if appointment_time is not None:
            journey.appointment_time = appointment_time
        if appointment_modality is not None:
            journey.appointment_modality = appointment_modality
        return journey

    def cancel_appointment(self, journey: CareJourney, at: date, reason: Optional[str] = None) -> CareJourney:
        """Cancel a booked appointment: the journey goes back to 'records ready' with the same
        provider, so the patient can rebook or choose someone else. Only allowed once booked."""
        if journey.state not in (CareState.APPOINTMENT_SCHEDULED, CareState.TRAVEL_PLANNED) or journey.appointment_date is None:
            raise InvalidTransitionError("there is no booked appointment to cancel")
        note = "Appointment cancelled" + (f": {reason}" if reason else "")
        journey.state = CareState.RECORDS_READY
        journey.stalled = False
        journey.stalled_reason = None
        journey.appointment_date = None
        journey.appointment_time = None
        journey.appointment_modality = None
        journey.state_history.append(StateTransition(state=CareState.RECORDS_READY, entered_at=at, note=note))
        return journey

    def check_stalled(self, journey: CareJourney) -> Optional[str]:
        """Return a human-readable stall reason if this journey's current
        state has sat past its threshold with no progress, else None.
        Does not mutate the journey -- callers decide whether to `advance`
        it into STALLED based on this."""
        if journey.state in (CareState.FOLLOWUP_COMPLETED, CareState.STALLED):
            return None
        if not journey.state_history:
            return None

        current_entry = journey.state_history[-1]
        days_in_state = (self.as_of - current_entry.entered_at).days
        threshold = STALL_THRESHOLD_DAYS.get(journey.state)
        if threshold is None or days_in_state < threshold:
            return None

        need = journey.need
        state_label = journey.state.value.replace("_", " ")
        return (
            f"{need.capitalize()} has been in '{state_label}' for {days_in_state} days, "
            f"past the expected {threshold}-day window. Consider rerouting or following up."
        )
