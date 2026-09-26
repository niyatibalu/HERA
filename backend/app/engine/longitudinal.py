"""
Longitudinal analysis engine.

Looks across a patient's HealthEvents over time and flags patterns worth a
clinician's attention. This engine NEVER diagnoses. It only describes what
is documented in the record and how it has changed -- every flag carries
the exact source events it was derived from (see TrendFlag.evidence) and
every message is built from a fixed set of templates that describe
observations, not conditions.

Deterministic and rule-based on purpose: no LLM call is required to produce
a flag, so this engine works with zero external dependencies and zero
network access (see docs/API_CONTRACT.md, FAILSAFE section).

Patterns detected:
  persistent_symptom              -- same topic, documented repeatedly
  lab_trend                       -- same lab (topic+unit), values trending
  repeated_treatment_no_improvement -- >=2 treatments, symptom unimproved
  multiple_specialist_visits      -- >=2 distinct specialties, same topic
  unresolved_referral             -- pending referral, aging past threshold
  care_gap                        -- long silence on an active topic
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date, timedelta
from itertools import count
from typing import Optional

from app.models.records import EventType, HealthEvent
from app.models.trends import Evidence, PatternType, Trend, TrendFlag

# Tunable thresholds. Kept as module constants (not magic numbers scattered
# through the logic) so they're easy to defend and easy to change together.
MIN_ENCOUNTERS_FOR_PERSISTENT_SYMPTOM = 3
MIN_LAB_POINTS_FOR_TREND = 2
REFERRAL_UNRESOLVED_THRESHOLD_DAYS = 9
CARE_GAP_THRESHOLD_DAYS = 180
_MONOTONIC_TOLERANCE = 0  # severity/lab comparisons treat ties as "stable"


def _round_months(days: int) -> int:
    """Round a day span to the nearest whole month for human-readable
    messages (e.g. 328 days -> "11 months"), using a 30.44-day average
    month length."""
    return max(1, round(days / 30.44))


@dataclass
class _FlagIdSource:
    """Tiny deterministic id generator so tests can assert on ids without
    reaching into engine internals."""

    prefix: str = "flag"
    _counter = count(1)

    def next(self) -> str:
        return f"{self.prefix}-{next(self._counter):04d}"


class LongitudinalAnalysisEngine:
    def __init__(self, as_of: Optional[date] = None):
        self.as_of = as_of or date.today()
        self._ids = _FlagIdSource()

    # -- public API -----------------------------------------------------

    def analyze(self, events: list[HealthEvent]) -> list[TrendFlag]:
        """Run every pattern detector over one patient's events and return
        all flags found, sorted most-recent-evidence-first."""
        if not events:
            return []

        events = sorted(events, key=lambda e: e.event_date)
        by_topic = self._group_by_topic(events)

        flags: list[TrendFlag] = []
        for topic, topic_events in by_topic.items():
            flags += self._persistent_symptom(topic, topic_events)
            flags += self._multiple_specialist_visits(topic, topic_events)
            flags += self._repeated_treatment_no_improvement(topic, topic_events)
            flags += self._care_gap(topic, topic_events)

        flags += self._lab_trends(by_topic)
        flags += self._unresolved_referrals(events)

        flags.sort(key=lambda f: f.last_seen, reverse=True)
        return flags

    # -- grouping ---------------------------------------------------------

    @staticmethod
    def _group_by_topic(events: list[HealthEvent]) -> dict[str, list[HealthEvent]]:
        groups: dict[str, list[HealthEvent]] = defaultdict(list)
        for e in events:
            groups[e.topic].append(e)
        return groups

    # -- pattern: persistent_symptom --------------------------------------

    def _persistent_symptom(self, topic: str, events: list[HealthEvent]) -> list[TrendFlag]:
        symptom_events = [e for e in events if e.event_type == EventType.SYMPTOM]
        encounter_dates = sorted({e.event_date for e in events if e.event_type == EventType.ENCOUNTER})

        if len(symptom_events) < MIN_ENCOUNTERS_FOR_PERSISTENT_SYMPTOM:
            return []

        severities = [e.severity for e in symptom_events if e.severity is not None]
        trend = self._severity_trend(severities)

        first_seen = symptom_events[0].event_date
        last_seen = symptom_events[-1].event_date
        months = _round_months((last_seen - first_seen).days)
        encounter_count = max(len(symptom_events), len(encounter_dates))

        trend_phrase = {
            Trend.WORSENING: "and has increased in severity",
            Trend.IMPROVING: "and has decreased in severity",
            Trend.STABLE: "and severity has stayed roughly stable",
            Trend.UNKNOWN: "",
        }[trend]

        topic_readable = topic.replace("_", " ")
        message = (
            f"{topic_readable.capitalize()} has been documented across "
            f"{encounter_count} encounters over {months} months {trend_phrase}."
            .replace("  ", " ").strip()
        )
        message = message.rstrip(".") + ". Consider reviewing the full longitudinal history."

        evidence = [
            Evidence(event_id=e.event_id, event_date=e.event_date, excerpt=e.description)
            for e in symptom_events
        ]

        return [TrendFlag(
            flag_id=self._ids.next(),
            patient_id=events[0].patient_id,
            pattern_type=PatternType.PERSISTENT_SYMPTOM,
            topic=topic,
            first_seen=first_seen,
            last_seen=last_seen,
            encounter_count=encounter_count,
            trend=trend,
            evidence=evidence,
            message=message,
        )]

    @staticmethod
    def _severity_trend(severities: list[int]) -> Trend:
        if len(severities) < 2:
            return Trend.UNKNOWN
        midpoint = len(severities) // 2
        first_half = severities[: max(midpoint, 1)]
        second_half = severities[max(midpoint, 1):] or severities[-1:]
        first_avg = sum(first_half) / len(first_half)
        second_avg = sum(second_half) / len(second_half)
        if second_avg - first_avg > _MONOTONIC_TOLERANCE:
            return Trend.WORSENING
        if first_avg - second_avg > _MONOTONIC_TOLERANCE:
            return Trend.IMPROVING
        return Trend.STABLE

    # -- pattern: lab_trend -------------------------------------------------

    def _lab_trends(self, by_topic: dict[str, list[HealthEvent]]) -> list[TrendFlag]:
        flags: list[TrendFlag] = []
        for topic, events in by_topic.items():
            labs = [e for e in events if e.event_type == EventType.LAB and e.value is not None]
            # Group by unit as a proxy for "same test" -- see module docstring
            # in app/models/records.py on why `unit` disambiguates test type.
            by_unit: dict[str, list[HealthEvent]] = defaultdict(list)
            for lab in labs:
                by_unit[lab.unit or ""].append(lab)

            for unit, points in by_unit.items():
                if len(points) < MIN_LAB_POINTS_FOR_TREND:
                    continue
                points = sorted(points, key=lambda e: e.event_date)
                values = [p.value for p in points]
                trend = self._severity_trend([int(round(v)) for v in values])

                first, last = points[0], points[-1]
                topic_readable = topic.replace("_", " ")
                direction = {
                    Trend.WORSENING: "risen",
                    Trend.IMPROVING: "declined",
                    Trend.STABLE: "stayed stable",
                }.get(trend, "changed")
                # For iron-style markers, a falling value is the concerning
                # direction -- flip the plain-language label without
                # changing the underlying Trend enum, since "worsening"
                # for the *condition* means the lab is declining here.
                condition_trend = Trend.WORSENING if last.value < first.value else (
                    Trend.IMPROVING if last.value > first.value else Trend.STABLE
                )
                direction = {
                    Trend.WORSENING: "declined",
                    Trend.IMPROVING: "improved",
                    Trend.STABLE: "stayed stable",
                }[condition_trend]

                message = (
                    f"{topic_readable.capitalize()} lab values have {direction} "
                    f"from {first.value}{unit} on {first.event_date.isoformat()} "
                    f"to {last.value}{unit} on {last.event_date.isoformat()}. "
                    f"Consider reviewing the full longitudinal history."
                )

                flags.append(TrendFlag(
                    flag_id=self._ids.next(),
                    patient_id=points[0].patient_id,
                    pattern_type=PatternType.LAB_TREND,
                    topic=topic,
                    first_seen=first.event_date,
                    last_seen=last.event_date,
                    encounter_count=len(points),
                    trend=condition_trend,
                    evidence=[
                        Evidence(event_id=p.event_id, event_date=p.event_date,
                                 excerpt=f"{p.description} ({p.value}{unit})")
                        for p in points
                    ],
                    message=message,
                ))
        return flags

    # -- pattern: repeated_treatment_no_improvement --------------------------

    def _repeated_treatment_no_improvement(self, topic: str, events: list[HealthEvent]) -> list[TrendFlag]:
        medications = [e for e in events if e.event_type == EventType.MEDICATION]
        symptoms = sorted(
            [e for e in events if e.event_type == EventType.SYMPTOM and e.severity is not None],
            key=lambda e: e.event_date,
        )
        if len(medications) < 2 or len(symptoms) < 2:
            return []

        # "No improvement" = severity at/after the last treatment is not
        # lower than severity before the first treatment.
        first_treatment_date = min(m.event_date for m in medications)
        before = [s for s in symptoms if s.event_date <= first_treatment_date]
        after = [s for s in symptoms if s.event_date > first_treatment_date]
        if not before or not after:
            return []

        before_avg = sum(s.severity for s in before) / len(before)
        after_avg = sum(s.severity for s in after) / len(after)
        if after_avg < before_avg:
            return []  # it actually improved -- not this pattern

        topic_readable = topic.replace("_", " ")
        treatments_desc = "; ".join(sorted({m.description for m in medications}))
        message = (
            f"{len(medications)} treatment changes have been tried for {topic_readable} "
            f"without documented improvement in symptom severity ({treatments_desc}). "
            f"Consider reviewing the full longitudinal history."
        )

        evidence = [
            Evidence(event_id=e.event_id, event_date=e.event_date, excerpt=e.description)
            for e in sorted(medications + symptoms, key=lambda e: e.event_date)
        ]

        return [TrendFlag(
            flag_id=self._ids.next(),
            patient_id=events[0].patient_id,
            pattern_type=PatternType.REPEATED_TREATMENT_NO_IMPROVEMENT,
            topic=topic,
            first_seen=min(e.event_date for e in medications),
            last_seen=max(e.event_date for e in medications),
            encounter_count=len(medications),
            trend=Trend.WORSENING if after_avg > before_avg else Trend.STABLE,
            evidence=evidence,
            message=message,
        )]

    # -- pattern: multiple_specialist_visits ---------------------------------

    def _multiple_specialist_visits(self, topic: str, events: list[HealthEvent]) -> list[TrendFlag]:
        encounters = [e for e in events if e.event_type == EventType.ENCOUNTER and e.specialty]
        specialties = sorted({e.specialty for e in encounters})
        if len(specialties) < 2:
            return []

        topic_readable = topic.replace("_", " ")
        specialty_list = ", ".join(s.replace("_", " ") for s in specialties)
        message = (
            f"{topic_readable.capitalize()} has been evaluated across {len(specialties)} "
            f"different specialties ({specialty_list}) without a documented resolution. "
            f"Consider reviewing the full longitudinal history."
        )

        return [TrendFlag(
            flag_id=self._ids.next(),
            patient_id=events[0].patient_id,
            pattern_type=PatternType.MULTIPLE_SPECIALIST_VISITS,
            topic=topic,
            first_seen=min(e.event_date for e in encounters),
            last_seen=max(e.event_date for e in encounters),
            encounter_count=len(encounters),
            trend=Trend.UNKNOWN,
            evidence=[
                Evidence(event_id=e.event_id, event_date=e.event_date,
                         excerpt=f"{e.specialty}: {e.description}")
                for e in encounters
            ],
            message=message,
        )]

    # -- pattern: unresolved_referral ----------------------------------------

    def _unresolved_referrals(self, events: list[HealthEvent]) -> list[TrendFlag]:
        flags = []
        for e in events:
            if e.event_type != EventType.REFERRAL or e.status != "pending":
                continue
            days_pending = (self.as_of - e.event_date).days
            if days_pending < REFERRAL_UNRESOLVED_THRESHOLD_DAYS:
                continue

            message = (
                f"Referral for {e.topic.replace('_', ' ')} "
                f"({e.description.rstrip('.')}) has been pending for {days_pending} days "
                f"without a scheduled appointment."
            )
            flags.append(TrendFlag(
                flag_id=self._ids.next(),
                patient_id=e.patient_id,
                pattern_type=PatternType.UNRESOLVED_REFERRAL,
                topic=e.topic,
                first_seen=e.event_date,
                last_seen=e.event_date,
                encounter_count=1,
                trend=Trend.UNKNOWN,
                evidence=[Evidence(event_id=e.event_id, event_date=e.event_date, excerpt=e.description)],
                message=message,
            ))
        return flags

    # -- pattern: care_gap -----------------------------------------------------

    def _care_gap(self, topic: str, events: list[HealthEvent]) -> list[TrendFlag]:
        active_events = sorted(
            [e for e in events if e.status == "active"], key=lambda e: e.event_date
        )
        if len(active_events) < 2:
            return []

        last_active = active_events[-1]
        gap_days = (self.as_of - last_active.event_date).days
        if gap_days < CARE_GAP_THRESHOLD_DAYS:
            return []

        topic_readable = topic.replace("_", " ")
        message = (
            f"No follow-up has been documented for {topic_readable} in {gap_days} days, "
            f"despite it last being recorded as active. Consider reviewing whether "
            f"follow-up is still needed."
        )
        return [TrendFlag(
            flag_id=self._ids.next(),
            patient_id=events[0].patient_id,
            pattern_type=PatternType.CARE_GAP,
            topic=topic,
            first_seen=active_events[0].event_date,
            last_seen=last_active.event_date,
            encounter_count=len(active_events),
            trend=Trend.UNKNOWN,
            evidence=[Evidence(event_id=last_active.event_id, event_date=last_active.event_date,
                                excerpt=last_active.description)],
            message=message,
        )]
