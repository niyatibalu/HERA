import unittest
from datetime import date

from app.adapters.mock_ehr_adapter import MockEHRAdapter
from app.engine.longitudinal import LongitudinalAnalysisEngine
from app.models.trends import PatternType, Trend

# Banned phrasing: the engine must describe documented patterns, never
# assert a diagnosis. If any of these ever appear in a generated message,
# something has gone badly wrong and the test should fail loudly.
DIAGNOSTIC_LANGUAGE = [
    "you have", "diagnosed with", "diagnosis is", "confirms you",
    "this means you have", "it is likely you have", "you are suffering from",
]


class TestLongitudinalAnalysisEngine(unittest.TestCase):
    def setUp(self):
        self.adapter = MockEHRAdapter()
        # Fixed as_of date so day-count-dependent patterns (unresolved
        # referral, care gap) are deterministic in tests regardless of
        # when they're actually run.
        self.as_of = date(2025, 12, 20)
        self.engine = LongitudinalAnalysisEngine(as_of=self.as_of)

    def _maya_flags(self):
        events = self.adapter.get_health_events("maya-001")
        return self.engine.analyze(events)

    def test_never_uses_diagnostic_language(self):
        flags = self._maya_flags()
        self.assertTrue(flags, "expected at least one flag to check")
        for flag in flags:
            lowered = flag.message.lower()
            for phrase in DIAGNOSTIC_LANGUAGE:
                self.assertNotIn(phrase, lowered, f"flag message used diagnostic language: {flag.message!r}")

    def test_action_is_always_clinician_review(self):
        for flag in self._maya_flags():
            self.assertEqual(flag.action, "clinician_review")

    def test_every_flag_cites_real_evidence(self):
        events = self.adapter.get_health_events("maya-001")
        real_ids = {e.event_id for e in events}
        flags = self._maya_flags()
        self.assertTrue(flags)
        for flag in flags:
            self.assertTrue(flag.evidence, f"{flag.pattern_type} flag has no evidence")
            for ev in flag.evidence:
                self.assertIn(ev.event_id, real_ids)

    def test_persistent_symptom_detected_for_pelvic_pain(self):
        flags = self._maya_flags()
        matches = [f for f in flags if f.pattern_type == PatternType.PERSISTENT_SYMPTOM and f.topic == "pelvic_pain"]
        self.assertEqual(len(matches), 1)
        flag = matches[0]
        self.assertEqual(flag.trend, Trend.WORSENING)
        self.assertGreaterEqual(flag.encounter_count, 4)
        self.assertIn("months", flag.message)
        self.assertIn("Consider reviewing", flag.message)

    def test_lab_trend_detected_for_declining_ferritin(self):
        flags = self._maya_flags()
        matches = [f for f in flags if f.pattern_type == PatternType.LAB_TREND and f.topic == "iron_deficiency"]
        self.assertEqual(len(matches), 1)
        self.assertEqual(matches[0].trend, Trend.WORSENING)  # ferritin declining = worsening

    def test_repeated_treatment_no_improvement_detected(self):
        flags = self._maya_flags()
        matches = [f for f in flags if f.pattern_type == PatternType.REPEATED_TREATMENT_NO_IMPROVEMENT]
        self.assertEqual(len(matches), 1)
        self.assertIn("without documented improvement", matches[0].message)

    def test_multiple_specialist_visits_detected(self):
        flags = self._maya_flags()
        matches = [f for f in flags if f.pattern_type == PatternType.MULTIPLE_SPECIALIST_VISITS]
        self.assertEqual(len(matches), 1)
        self.assertIn("primary care", matches[0].message)
        self.assertIn("obgyn", matches[0].message)

    def test_unresolved_referral_detected_after_threshold(self):
        flags = self._maya_flags()
        matches = [f for f in flags if f.pattern_type == PatternType.UNRESOLVED_REFERRAL]
        self.assertEqual(len(matches), 1)
        self.assertIn("12 days", matches[0].message)  # Dec 8 -> Dec 20 as_of

    def test_unresolved_referral_not_flagged_before_threshold(self):
        early_engine = LongitudinalAnalysisEngine(as_of=date(2025, 12, 10))
        events = self.adapter.get_health_events("maya-001")
        flags = early_engine.analyze(events)
        matches = [f for f in flags if f.pattern_type == PatternType.UNRESOLVED_REFERRAL]
        self.assertEqual(len(matches), 0)

    def test_low_signal_patient_produces_no_flags(self):
        events = self.adapter.get_health_events("patient-002")
        flags = self.engine.analyze(events)
        self.assertEqual(flags, [])

    def test_empty_history_produces_no_flags(self):
        self.assertEqual(self.engine.analyze([]), [])


if __name__ == "__main__":
    unittest.main()
