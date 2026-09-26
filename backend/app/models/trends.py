"""
Longitudinal pattern flags.

A TrendFlag is HERA's core "we noticed something, a clinician should look"
output. It is never a diagnosis and must never be phrased as one -- see
app/engine/longitudinal.py for the guardrails enforced on `message`.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from enum import Enum


class PatternType(str, Enum):
    PERSISTENT_SYMPTOM = "persistent_symptom"
    LAB_TREND = "lab_trend"
    REPEATED_TREATMENT_NO_IMPROVEMENT = "repeated_treatment_no_improvement"
    MULTIPLE_SPECIALIST_VISITS = "multiple_specialist_visits"
    UNRESOLVED_REFERRAL = "unresolved_referral"
    CARE_GAP = "care_gap"


class Trend(str, Enum):
    WORSENING = "worsening"
    STABLE = "stable"
    IMPROVING = "improving"
    UNKNOWN = "unknown"


@dataclass
class Evidence:
    """A single source record cited to support a flag. Never a claim on its
    own -- always tied back to the exact HealthEvent it came from."""

    event_id: str
    event_date: date
    excerpt: str


@dataclass
class TrendFlag:
    flag_id: str
    patient_id: str
    pattern_type: PatternType
    topic: str
    first_seen: date
    last_seen: date
    encounter_count: int
    trend: Trend
    evidence: list[Evidence]
    message: str
    action: str = "clinician_review"
    generated_at: date = field(default_factory=date.today)
