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

from app.adapters.mock_ehr_adapter import MockEHRAdapter
from app.engine.lifecycle import CareLifecycleEngine
from app.models.care import CareJourney, CareState
from app.models.connections import MYCHART_SCOPES, ConnectedOrganization, MyChartConnection
from app.models.preferences import CarePreferences
from app.models.research import ResearchConsent
from app.models.symptoms import SymptomLogEntry

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

# Systems Maya's (simulated) MyChart account links to. Match the frontend's
# record source names in frontend/src/mocks/record.ts.
DEMO_ORGANIZATIONS = {
    "maya-001": [
        ConnectedOrganization("Lakeview Primary Care", "ehr"),
        ConnectedOrganization("Capitol Women's Health", "patient_portal"),
        ConnectedOrganization("Dane County Clinical Labs", "lab"),
    ],
}

# Maya's own notes around her visits. Synthetic, written in her voice.
MAYA_SYMPTOM_NOTES = [
    dict(logged_on=date(2025, 8, 12), symptom="Pelvic pain", severity=7, timing="before_visit",
         visit="OB/GYN · Dr. Sarah Lindqvist · Aug 15",
         note="Cramping most mornings, worse the week before my period. Missed 2 days of work this month. Ask why the pill isn't helping."),
    dict(logged_on=date(2025, 8, 18), symptom="Pelvic pain", severity=7, timing="after_visit",
         visit="OB/GYN · Dr. Sarah Lindqvist · Aug 15",
         note="Switched hormonal therapy and ordered an ultrasound. Pain about the same so far."),
    dict(logged_on=date(2025, 9, 24), symptom="Heavy bleeding", severity=6, timing="after_visit",
         visit="OB/GYN · Dr. Sarah Lindqvist · Sep 22",
         note="Ultrasound was clear. Still soaking through pads overnight."),
    dict(logged_on=date(2025, 12, 15), symptom="Pelvic pain", severity=8, timing="before_visit",
         visit="Chronic pelvic pain specialist evaluation (upcoming)",
         note="Pain most days now. Questions: could this be endometriosis? Is pelvic floor PT an option?"),
    dict(logged_on=date(2025, 12, 16), symptom="Fatigue", severity=6, timing="general",
         note="Tired and dizzy on stairs. Taking iron most days."),
]


class DemoStore:
    def __init__(self, today: Optional[date] = None) -> None:
        self.today = today or DEMO_TODAY
        self._lifecycle = CareLifecycleEngine(as_of=self.today)
        self.journeys: dict[str, CareJourney] = {}
        self.consents: dict[str, ResearchConsent] = {}
        self.preferences: dict[str, CarePreferences] = {}
        self.symptom_logs: dict[str, list[SymptomLogEntry]] = {}
        self.mychart: dict[str, MyChartConnection] = {}
        self._symptom_ids = itertools.count(1)

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
        appointment_time: Optional[str] = None,
        appointment_modality: Optional[str] = None,
    ) -> CareJourney:
        journey = self.journeys[journey_id]
        return self._lifecycle.advance(
            journey, new_state, self.today, note,
            provider_id=provider_id, appointment_date=appointment_date,
            appointment_time=appointment_time, appointment_modality=appointment_modality,
        )

    def check_stalled(self, journey: CareJourney) -> Optional[str]:
        return self._lifecycle.check_stalled(journey)

    # -- care preferences --------------------------------------------------

    def get_preferences(self, patient_id: str) -> CarePreferences:
        return self.preferences.get(patient_id) or CarePreferences(patient_id=patient_id)

    def set_preferences(self, prefs: CarePreferences) -> CarePreferences:
        prefs.updated_at = self.today
        self.preferences[prefs.patient_id] = prefs
        return prefs

    # -- symptom log --------------------------------------------------------

    def symptom_log(self, patient_id: str) -> list[SymptomLogEntry]:
        entries = self.symptom_logs.get(patient_id, [])
        return sorted(entries, key=lambda e: (e.logged_on, e.entry_id), reverse=True)

    def add_symptom(self, patient_id: str, **fields) -> SymptomLogEntry:
        fields.setdefault("logged_on", self.today)
        entry = SymptomLogEntry(entry_id=f"sym-{next(self._symptom_ids):04d}", patient_id=patient_id, **fields)
        self.symptom_logs.setdefault(patient_id, []).append(entry)
        return entry

    def delete_symptom(self, patient_id: str, entry_id: str) -> bool:
        entries = self.symptom_logs.get(patient_id, [])
        kept = [e for e in entries if e.entry_id != entry_id]
        self.symptom_logs[patient_id] = kept
        return len(kept) != len(entries)

    # -- MyChart (simulated) -----------------------------------------------

    def get_mychart(self, patient_id: str) -> MyChartConnection:
        return self.mychart.setdefault(patient_id, MyChartConnection(patient_id=patient_id))

    def connect_mychart(self, patient_id: str, scopes: Optional[list[str]] = None) -> MyChartConnection:
        events = MockEHRAdapter().get_health_events(patient_id)
        imported: dict[str, int] = {}
        for e in events:
            imported[e.event_type.value] = imported.get(e.event_type.value, 0) + 1
        conn = MyChartConnection(
            patient_id=patient_id,
            status="connected",
            connected_at=self.today,
            last_synced_at=self.today,
            scopes=list(scopes or MYCHART_SCOPES),
            organizations=list(DEMO_ORGANIZATIONS.get(patient_id, [])),
            imported=imported,
        )
        self.mychart[patient_id] = conn
        return conn

    def disconnect_mychart(self, patient_id: str) -> MyChartConnection:
        self.mychart[patient_id] = MyChartConnection(patient_id=patient_id)
        return self.mychart[patient_id]

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
        self.preferences.clear()
        self.symptom_logs.clear()
        self.mychart.clear()
        self._symptom_ids = itertools.count(1)
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
        if "maya-001" not in self.preferences:
            self.preferences["maya-001"] = CarePreferences(
                patient_id="maya-001",
                max_cost_usd=150,
                needs_financial_assistance=True,
                max_distance_mi=30,
                expertise=["chronic_pelvic_pain", "endometriosis"],
                min_rating=4.0,
                availability=["weekday_afternoon", "weekday_evening"],
                telehealth="no_preference",
                provider_gender="female",
                updated_at=MAYA_REFERRAL_DATE,
            )
        if not self.symptom_logs.get("maya-001"):
            for entry in MAYA_SYMPTOM_NOTES:
                self.add_symptom("maya-001", **entry)


store = DemoStore()
store.seed_demo_data()
