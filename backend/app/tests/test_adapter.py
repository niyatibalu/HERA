import unittest

from app.adapters.mock_ehr_adapter import MockEHRAdapter, PatientNotFoundError
from app.models.records import HealthEvent


class TestMockEHRAdapter(unittest.TestCase):
    def setUp(self):
        self.adapter = MockEHRAdapter()

    def test_list_patient_ids_includes_demo_patients(self):
        ids = self.adapter.list_patient_ids()
        self.assertIn("maya-001", ids)
        self.assertIn("patient-002", ids)

    def test_get_patient_returns_expected_patient(self):
        patient = self.adapter.get_patient("maya-001")
        self.assertEqual(patient.patient_id, "maya-001")
        self.assertEqual(patient.insurance_plan, "MidwestCare PPO")

    def test_get_patient_unknown_id_raises(self):
        with self.assertRaises(PatientNotFoundError):
            self.adapter.get_patient("does-not-exist")

    def test_get_health_events_unknown_id_raises(self):
        with self.assertRaises(PatientNotFoundError):
            self.adapter.get_health_events("does-not-exist")

    def test_maya_health_events_are_well_formed(self):
        events = self.adapter.get_health_events("maya-001")
        self.assertGreaterEqual(len(events), 15)
        for event in events:
            self.assertIsInstance(event, HealthEvent)
            self.assertEqual(event.patient_id, "maya-001")
            self.assertTrue(event.topic)
            self.assertTrue(event.description)

    def test_events_are_chronologically_sortable_and_span_months(self):
        events = self.adapter.get_health_events("maya-001")
        dates = sorted(e.event_date for e in events)
        span_days = (dates[-1] - dates[0]).days
        self.assertGreater(span_days, 300)  # spans most of a year

    def test_patient_two_has_minimal_history(self):
        events = self.adapter.get_health_events("patient-002")
        self.assertEqual(len(events), 1)


if __name__ == "__main__":
    unittest.main()
