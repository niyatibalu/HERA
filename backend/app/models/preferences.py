"""Patient care preferences used to personalize provider matching."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Optional

AVAILABILITY_SLOTS = ("weekday_morning", "weekday_afternoon", "weekday_evening", "weekend")
TELEHEALTH_PREFERENCES = ("no_preference", "prefer_telehealth", "in_person_only")
GENDER_PREFERENCES = ("no_preference", "female", "male", "nonbinary")


@dataclass
class CarePreferences:
    """What the patient told HERA matters when choosing a provider.

    Every field is optional/neutral by default: an unset preference never
    penalizes a provider, so matching without preferences behaves as before.
    """

    patient_id: str
    # Financial situation
    max_cost_usd: Optional[int] = None  # most she can pay per visit, out of pocket
    needs_financial_assistance: bool = False  # prefer sliding-scale / assistance programs
    # Insurance: None = use the plan on the patient record
    insurance_plan: Optional[str] = None
    # Location
    max_distance_mi: Optional[float] = None
    # Expertise + reviews
    expertise: list[str] = field(default_factory=list)  # e.g. ["endometriosis"]
    min_rating: Optional[float] = None  # 0-5
    # Schedule
    availability: list[str] = field(default_factory=list)  # AVAILABILITY_SLOTS
    # Visit type and clinician
    telehealth: str = "no_preference"  # TELEHEALTH_PREFERENCES
    provider_gender: str = "no_preference"  # GENDER_PREFERENCES
    updated_at: Optional[date] = None
