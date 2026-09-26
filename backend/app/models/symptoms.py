"""Patient-reported symptom notes, logged before and after visits.

These are the patient's own notes, not clinical observations. HERA stores and
shows them; it does not analyze or interpret them.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Optional

SYMPTOM_TIMINGS = ("before_visit", "after_visit", "general")


@dataclass
class SymptomLogEntry:
    entry_id: str
    patient_id: str
    logged_on: date
    symptom: str  # free text, e.g. "Pelvic pain"
    severity: int  # 0-10, patient-rated
    timing: str = "general"  # SYMPTOM_TIMINGS
    visit: Optional[str] = None  # which visit this relates to, e.g. "Dr. Okafor · Dec 29"
    note: str = ""
    tags: list[str] = field(default_factory=list)
