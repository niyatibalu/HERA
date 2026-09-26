"""
In-memory demo store for the two stateful objects: CareJourney and
ResearchConsent. Patient/HealthEvent/Provider/Study are immutable synthetic
data (app/data/*.py) and don't need a store.

Deliberately not a database. For the hackathon, in-process memory is the
right choice: zero setup, zero external dependency, and it resets cleanly
on restart -- which is what DEMO MODE wants (see docs/API_CONTRACT.md).

All "today" references in here use a fixed demo date rather than the real
wall clock, so lifecycle stall math and consent timestamps stay consistent
with the synthetic patient data (Maya's referral event is dated 2025-12-08)
regardless of when the demo is actually run. This mirrors the frontend's
own DEMO_TODAY constant -- see frontend/src/mocks/record.ts.
"""

from __future__ import annotations

import itertools
import os
from datetime import date
from typing import Optional

from app.engine.lifecycle import CareLifecycleEngine
from app.models.care import CareJourney, CareState
from app.models.research import ResearchConsent

_journey_id_counter = itertools.count(1)

# Fixed reference "today" for the demo, overridable via HERA_DEMO_TODAY
# (ISO format, e.g. "2025-12-20") for anyone rehearsing on a different date.
DEFAULT_DEMO_TODAY = date(2025, 12, 17)


def _resolve_demo_today() -> date:
    override = os.environ.get("HERA_DEMO_TODAY")
    return date.fromisoformat(override) if override else DEFAULT_DEMO_TODAY


DEMO_TODAY = _resolve_demo_today()

# Matches ev-020 in app/data/synthetic_patients.py -- the referral to a
# chronic pelvic pain specialist that seeds Maya's care journey below.
MAYA_REFERRAL_DATE = date(2025, 12, 8)
MAYA_ORIGINAL_PROVIDER_ID = "prov-original-specialist"


class DemoStore:
    def __init__(self, today: Optional[date] = None) -> None:
        self.today = today or DEMO_TODAY
        self._lifecycle = CareLifecycleEngine(as_of=self.today)
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
            record.consent_timestamp = self.today
            record.revoked = False
            record.revoked_timestamp = None
        else:
            record.revoked = True
            record.revoked_timestamp = self.today
        if scope:
            record.scope = scope
        return record

    # -- care journeys ------------------------------------------------------

    def journeys_for(self, patient_id: str) -> list[CareJourney]:
        return [j for j in self.journeys.values() if j.patient_id == patient_id]

    def start_journey(
        self,
        patient_id: str,
        need: str,
        started_at: Optional[date] = None,
        provider_id: Optional[str] = None,
    ) -> CareJourney:
        journey_id = f"journey-{next(_journey_id_counter):04d}"
        journey = self._lifecycle.start_journey(
            journey_id, patient_id, need, started_at or self.today, provider_id=provider_id,
        )
        self.journeys[journey_id] = journey
        return journey

    def advance_journey(
        self,
        journey_id: str,
        new_state: CareState,
        note: Optional[str] = None,
        provider_id: Optional[str] = None,
        appointment_date: Optional[date] = None,
    ) -> CareJourney:
        journey = self.journeys[journey_id]
        return self._lifecycle.advance(
            journey, new_state, self.today, note,
            provider_id=provider_id, appointment_date=appointment_date,
        )

    def check_stalled(self, journey: CareJourney) -> Optional[str]:
        return self._lifecycle.check_stalled(journey)

    # -- demo seeding ------------------------------------------------------

    def reset(self) -> None:
        """Clear all stateful data and reseed from scratch.

        Two uses: test isolation (this store is a module-level singleton
        shared by every route, so tests that mutate a journey would
        otherwise leak state into each other -- see app/tests/test_api.py),
        and resetting a live demo between run-throughs without restarting
        the server."""
        self.journeys.clear()
        self.consents.clear()
        self.seed_demo_data()

    def seed_demo_data(self) -> None:
        """Give the demo a care journey to show immediately on startup,
        without requiring a POST first. Seeded at the referral's actual
        event date, pointing at the originally-referred (inaccessible)
        specialist -- HERA re-matches her to a better provider via a
        later `advance` call that overwrites `provider_id`."""
        if not self.journeys_for("maya-001"):
            self.start_journey(
                "maya-001",
                "chronic pelvic pain specialist evaluation",
                started_at=MAYA_REFERRAL_DATE,
                provider_id=MAYA_ORIGINAL_PROVIDER_ID,
            )


store = DemoStore()
store.seed_demo_data()
