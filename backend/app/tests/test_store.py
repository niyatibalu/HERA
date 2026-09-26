"""
Tests for the in-memory demo store: the fixed demo date, Maya's seeded
journey, and the advance endpoint's optional provider_id/appointment_date.
"""

import importlib
import os
import unittest
from datetime import date

from app.data import store as store_module
from app.models.care import CareState


class TestDemoDate(unittest.TestCase):
    def test_default_demo_today_is_2025_12_17(self):
        self.assertEqual(store_module.DEFAULT_DEMO_TODAY, date(2025, 12, 17))

    def test_store_defaults_to_demo_today(self):
        s = store_module.DemoStore()
        self.assertEqual(s.today, date(2025, 12, 17))

    def test_store_accepts_explicit_today_override(self):
        s = store_module.DemoStore(today=date(2026, 1, 1))
        self.assertEqual(s.today, date(2026, 1, 1))

    def test_env_var_overrides_default(self):
        os.environ["HERA_DEMO_TODAY"] = "2025-12-25"
        try:
            reloaded = importlib.reload(store_module)
            self.assertEqual(reloaded.DEMO_TODAY, date(2025, 12, 25))
        finally:
            del os.environ["HERA_DEMO_TODAY"]
            importlib.reload(store_module)  # restore module state for other tests


class TestMayaSeededJourney(unittest.TestCase):
    def setUp(self):
        self.store = store_module.DemoStore()
        self.store.seed_demo_data()

    def test_seeded_at_referral_event_date(self):
        journey = self.store.journeys_for("maya-001")[0]
        self.assertEqual(journey.state_history[0].entered_at, date(2025, 12, 8))

    def test_seeded_with_original_provider(self):
        journey = self.store.journeys_for("maya-001")[0]
        self.assertEqual(journey.provider_id, "prov-original-specialist")

    def test_seeding_is_idempotent(self):
        self.store.seed_demo_data()  # calling again should not duplicate
        self.assertEqual(len(self.store.journeys_for("maya-001")), 1)

    def test_seeded_journey_already_stalled_at_default_demo_today(self):
        # referral: 2025-12-08, demo today: 2025-12-17 -> 9 days in
        # need_identified, past its 3-day threshold with nobody having
        # matched her to a new provider yet.
        journey = self.store.journeys_for("maya-001")[0]
        warning = self.store.check_stalled(journey)
        self.assertIsNotNone(warning)
        self.assertIn("9 days", warning)


class TestReset(unittest.TestCase):
    def test_reset_clears_mutations_and_reseeds(self):
        s = store_module.DemoStore()
        s.seed_demo_data()
        journey = s.journeys_for("maya-001")[0]
        s.advance_journey(journey.journey_id, CareState.PROVIDER_MATCHED, provider_id="prov-alt-best")
        s.set_consent("maya-001", True)

        s.reset()

        journeys = s.journeys_for("maya-001")
        self.assertEqual(len(journeys), 1)
        self.assertEqual(journeys[0].state, CareState.NEED_IDENTIFIED)  # back to seeded state
        self.assertEqual(journeys[0].provider_id, "prov-original-specialist")  # not prov-alt-best
        self.assertFalse(s.get_or_create_consent("maya-001").consent)  # consent cleared too


class TestAdvanceWithProviderAndAppointment(unittest.TestCase):
    def setUp(self):
        self.store = store_module.DemoStore()
        self.journey = self.store.start_journey("maya-001", "test need", started_at=date(2025, 12, 8))

    def test_advance_with_only_state_and_note_still_works(self):
        journey = self.store.advance_journey(self.journey.journey_id, CareState.PROVIDER_MATCHED, note="matched")
        self.assertEqual(journey.state, CareState.PROVIDER_MATCHED)
        self.assertIsNone(journey.provider_id)
        self.assertIsNone(journey.appointment_date)

    def test_advance_can_set_provider_id(self):
        journey = self.store.advance_journey(
            self.journey.journey_id, CareState.PROVIDER_MATCHED,
            note="re-matched", provider_id="prov-alt-best",
        )
        self.assertEqual(journey.provider_id, "prov-alt-best")

    def test_advance_can_set_appointment_date(self):
        journey = self.store.advance_journey(
            self.journey.journey_id, CareState.APPOINTMENT_SCHEDULED,
            provider_id="prov-alt-best", appointment_date=date(2025, 12, 29),
        )
        self.assertEqual(journey.appointment_date, date(2025, 12, 29))

    def test_advance_without_provider_id_does_not_clear_existing_value(self):
        self.store.advance_journey(self.journey.journey_id, CareState.PROVIDER_MATCHED, provider_id="prov-alt-best")
        journey = self.store.advance_journey(self.journey.journey_id, CareState.RECORDS_READY, note="records shared")
        self.assertEqual(journey.provider_id, "prov-alt-best")  # untouched, not wiped to None


if __name__ == "__main__":
    unittest.main()
