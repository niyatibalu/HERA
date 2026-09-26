"""
Research consent and eligibility matching.

Design rule: research matching must be structurally impossible unless
ResearchConsent.consent is True at the time of matching. See
app/engine/research_matching.py, which re-checks consent before every match
rather than trusting a caller to have checked it.

Candidate-facing and researcher-facing output are deliberately different
shapes: researchers only ever see a de-identified StudyMatch keyed by
candidate_id (a one-way pseudonym), never patient_id, name, or address.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Optional


@dataclass
class ResearchConsent:
    patient_id: str
    consent: bool = False
    consent_timestamp: Optional[date] = None
    scope: str = "de_identified_cohort_matching"
    revoked: bool = False
    revoked_timestamp: Optional[date] = None

    def is_active(self) -> bool:
        return self.consent and not self.revoked


@dataclass
class StudyCriteria:
    age_min: Optional[int] = None
    age_max: Optional[int] = None
    sex: Optional[str] = None
    condition_topic: Optional[str] = None  # e.g. "pelvic_pain"
    min_duration_days: Optional[int] = None
    required_treatment_history: list[str] = field(default_factory=list)


@dataclass
class Study:
    study_id: str
    title: str
    criteria: StudyCriteria
    description: str = ""


@dataclass
class StudyMatch:
    study_id: str
    candidate_id: str  # de-identified, one-way pseudonym -- never patient_id
    eligibility_status: str  # always "potentially_eligible", never a guarantee
    criteria_satisfied: list[str]
    criteria_unknown: list[str]
    reason: str
