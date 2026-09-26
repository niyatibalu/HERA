import unittest
from datetime import date

from app.engine.lifecycle import CareLifecycleEngine, InvalidTransitionError
from app.models.care import CareState


class TestCareLifecycleEngine(unittest.TestCase):
    def setUp(self):
        self.engine = CareLifecycleEngine(as_of=date(2025, 12, 20))

    def test_start_journey_begins_at_need_identified(self):
        j = self.engine.start_journey("j-1", "maya-001", "pelvic pain specialist evaluation", date(2025, 12, 1))
        self.assertEqual(j.state, CareState.NEED_IDENTIFIED)
        self.assertEqual(len(j.state_history), 1)

    def test_advance_moves_forward_and_records_history(self):
        j = self.engine.start_journey("j-1", "maya-001", "specialist eval", date(2025, 12, 1))
        self.engine.advance(j, CareState.PROVIDER_MATCHED, date(2025, 12, 2))
        self.assertEqual(j.state, CareState.PROVIDER_MATCHED)
        self.assertEqual(len(j.state_history), 2)

    def test_advance_rejects_backward_transition(self):
        j = self.engine.start_journey("j-1", "maya-001", "specialist eval", date(2025, 12, 1))
        self.engine.advance(j, CareState.PROVIDER_MATCHED, date(2025, 12, 2))
        self.engine.advance(j, CareState.APPOINTMENT_SCHEDULED, date(2025, 12, 3))
        with self.assertRaises(InvalidTransitionError):
            self.engine.advance(j, CareState.PROVIDER_MATCHED, date(2025, 12, 4))

    def test_check_stalled_flags_provider_matched_after_nine_days(self):
        j = self.engine.start_journey("j-1", "maya-001", "specialist eval", date(2025, 12, 1))
        self.engine.advance(j, CareState.PROVIDER_MATCHED, date(2025, 12, 8))  # 12 days before as_of
        reason = self.engine.check_stalled(j)
        self.assertIsNotNone(reason)
        self.assertIn("12 days", reason)

    def test_check_stalled_returns_none_before_threshold(self):
        j = self.engine.start_journey("j-1", "maya-001", "specialist eval", date(2025, 12, 1))
        self.engine.advance(j, CareState.PROVIDER_MATCHED, date(2025, 12, 15))  # 5 days before as_of
        self.assertIsNone(self.engine.check_stalled(j))

    def test_check_stalled_returns_none_once_followup_completed(self):
        j = self.engine.start_journey("j-1", "maya-001", "specialist eval", date(2025, 1, 1))
        self.engine.advance(j, CareState.FOLLOWUP_COMPLETED, date(2025, 1, 2))
        self.assertIsNone(self.engine.check_stalled(j))

    def test_advance_into_stalled_sets_flag_and_reason(self):
        j = self.engine.start_journey("j-1", "maya-001", "specialist eval", date(2025, 12, 1))
        self.engine.advance(j, CareState.STALLED, date(2025, 12, 10), note="no response from clinic")
        self.assertTrue(j.stalled)
        self.assertEqual(j.stalled_reason, "no response from clinic")

    def test_resuming_from_stalled_clears_flag(self):
        j = self.engine.start_journey("j-1", "maya-001", "specialist eval", date(2025, 12, 1))
        self.engine.advance(j, CareState.STALLED, date(2025, 12, 10), note="no response")
        self.engine.advance(j, CareState.PROVIDER_MATCHED, date(2025, 12, 15))
        self.assertFalse(j.stalled)
        self.assertIsNone(j.stalled_reason)


if __name__ == "__main__":
    unittest.main()
