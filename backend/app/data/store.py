"""
In-memory demo store for the two stateful objects: CareJourney and
ResearchConsent. Patient/HealthEvent/Provider/Study are immutable synthetic
data (app/data/*.py) and don't need a store.

Deliberately not a database. For the hackathon, in-process memory is the
right choice: zero setup, zero external dependency, and it resets cleanly
on restart -- which is what DEMO MODE wants (see docs/API_CONTRACT.md).
"""

from __future__ import annotations

import itertools
from datetime import date
from typing import Optional

from app.engine.lifecycle import CareLifecycleEngine
from app.models.care import CareJourney, CareState
from app.models.research import ResearchConsent

_journey_id_counter = itertools.count(1)


class DemoStore:
    def __init__(self) -> None:
        self._lifecycle = CareLifecycleEngine()
        self.journeys: dict[str, CareJourney] = {}
        self.consents: dict[str, ResearchConsent] = {}

    # -- research consent -------------------------------------------------

    def get_or_create_consent(self, patient_id: str) -> ResearchConsent:
        if patient_id not in self.consents:
            self.consents[patient_id] = ResearchConsent(patient_id=patient_id)
        return self.consents[patient_id]

    def set_consent(self, patient_id: str, consent: bool, scope: Optional[str] = None) -> ResearchConsent:
        record = self.get_or_create_consent(patient_id)
        if consent:
            record.consent = True
            record.consent_timestamp = date.today()
            record.revoked = False
            record.revoked_timestamp = None
        else:
            record.revoked = True
            record.revoked_timestamp = date.today()
        if scope:
            record.scope = scope
        return record

    # -- care journeys ------------------------------------------------------

    def journeys_for(self, patient_id: str) -> list[CareJourney]:
        return [j for j in self.journeys.values() if j.patient_id == patient_id]

    def start_journey(self, patient_id: str, need: str) -> CareJourney:
        journey_id = f"journey-{next(_journey_id_counter):04d}"
        journey = self._lifecycle.start_journey(journey_id, patient_id, need, date.today())
        self.journeys[journey_id] = journey
        return journey

    def advance_journey(self, journey_id: str, new_state: CareState, note: Optional[str] = None) -> CareJourney:
        journey = self.journeys[journey_id]
        return self._lifecycle.advance(journey, new_state, date.today(), note)

    def check_stalled(self, journey: CareJourney) -> Optional[str]:
        return self._lifecycle.check_stalled(journey)

    # -- demo seeding ------------------------------------------------------

    def seed_demo_data(self) -> None:
        """Give the demo a care journey to show immediately on startup,
        without requiring a POST first."""
        if not self.journeys_for("maya-001"):
            self.start_journey("maya-001", "chronic pelvic pain specialist evaluation")


store = DemoStore()
store.seed_demo_data()
