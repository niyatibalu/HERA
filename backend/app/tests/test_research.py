import unittest
from datetime import date

from app.adapters.mock_ehr_adapter import MockEHRAdapter
from app.data.studies import STUDIES
from app.engine.research_matching import ResearchEligibilityEngine, pseudonymous_candidate_id
from app.models.records import EventType, HealthEvent
from app.models.research import ResearchConsent


class TestResearchEligibilityEngine(unittest.TestCase):
    def setUp(self):
        self.engine = ResearchEligibilityEngine()
        self.adapter = MockEHRAdapter()
        self.maya = self.adapter.get_patient("maya-001")
        self.maya_events = self.adapter.get_health_events("maya-001")
        self.studies = list(STUDIES.values())

    def test_no_consent_returns_no_matches(self):
        consent = ResearchConsent(patient_id="maya-001", consent=False)
        matches = self.engine.find_matches(self.maya, self.maya_events, consent, self.studies)
        self.assertEqual(matches, [])

    def test_revoked_consent_returns_no_matches_even_if_consent_flag_true(self):
        consent = ResearchConsent(
            patient_id="maya-001", consent=True, consent_timestamp=date(2025, 6, 1),
            revoked=True, revoked_timestamp=date(2025, 11, 1),
        )
        matches = self.engine.find_matches(self.maya, self.maya_events, consent, self.studies)
        self.assertEqual(matches, [])

    def test_active_consent_matches_pelvic_pain_study(self):
        consent = ResearchConsent(patient_id="maya-001", consent=True, consent_timestamp=date(2025, 6, 1))
        matches = self.engine.find_matches(self.maya, self.maya_events, consent, self.studies)
        study_ids = {m.study_id for m in matches}
        self.assertIn("study-a", study_ids)
        self.assertNotIn("study-b", study_ids)  # no PCOS data
        self.assertNotIn("study-c", study_ids)  # no endometriosis data

    def test_match_status_is_always_potentially_eligible(self):
        consent = ResearchConsent(patient_id="maya-001", consent=True, consent_timestamp=date(2025, 6, 1))
        matches = self.engine.find_matches(self.maya, self.maya_events, consent, self.studies)
        for m in matches:
            self.assertEqual(m.eligibility_status, "potentially_eligible")

    def test_match_uses_pseudonymous_candidate_id_never_patient_id(self):
        consent = ResearchConsent(patient_id="maya-001", consent=True, consent_timestamp=date(2025, 6, 1))
        matches = self.engine.find_matches(self.maya, self.maya_events, consent, self.studies)
        self.assertTrue(matches)
        for m in matches:
            self.assertNotEqual(m.candidate_id, "maya-001")
            self.assertTrue(m.candidate_id.startswith("candidate-"))

    def test_candidate_id_is_stable_across_calls(self):
        self.assertEqual(pseudonymous_candidate_id("maya-001"), pseudonymous_candidate_id("maya-001"))

    def test_candidate_id_differs_between_patients(self):
        self.assertNotEqual(pseudonymous_candidate_id("maya-001"), pseudonymous_candidate_id("patient-002"))

    def test_unknown_treatment_history_reported_not_excluded(self):
        # A patient with pelvic pain documented long enough, but zero
        # treatment records at all -- treatment history should come back
        # "unknown", not disqualify the match outright.
        events = [
            HealthEvent(
                event_id="e1", patient_id="p-x", event_type=EventType.SYMPTOM,
                event_date=date(2024, 1, 1), topic="pelvic_pain",
                description="pelvic pain", severity=3,
            ),
            HealthEvent(
                event_id="e2", patient_id="p-x", event_type=EventType.SYMPTOM,
                event_date=date(2025, 1, 1), topic="pelvic_pain",
                description="pelvic pain persists", severity=3,
            ),
        ]
        from app.models.records import Location, Patient
        patient = Patient(
            patient_id="p-x", name="Test Patient", date_of_birth=date(1998, 1, 1),
            sex="female", insurance_plan="Test Plan",
            home_location=Location(lat=0, lon=0, address="nowhere"),
        )
        consent = ResearchConsent(patient_id="p-x", consent=True, consent_timestamp=date(2025, 6, 1))
        matches = self.engine.find_matches(patient, events, consent, [STUDIES["study-a"]])
        self.assertEqual(len(matches), 1)
        self.assertTrue(any("treatment history" in c for c in matches[0].criteria_unknown))

    def test_missing_condition_excludes_study(self):
        events = self.adapter.get_health_events("patient-002")  # no pelvic pain data
        patient = self.adapter.get_patient("patient-002")
        consent = ResearchConsent(patient_id="patient-002", consent=True, consent_timestamp=date(2025, 6, 1))
        matches = self.engine.find_matches(patient, events, consent, self.studies)
        self.assertEqual(matches, [])


if __name__ == "__main__":
    unittest.main()
