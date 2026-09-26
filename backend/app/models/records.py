"""
Unified patient health record model.

This is the canonical, standards-adjacent shape HERA uses internally for any
patient record, regardless of where it came from. A real EHR integration
(FHIR R4) would map Patient/Condition/Observation/MedicationRequest/
ServiceRequest/Procedure resources into these same fields -- see
app/adapters/base.py for the adapter boundary that isolates that mapping.

For the hackathon, every field here is populated from synthetic data only.
No real patient information is used or referenced.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from enum import Enum
from typing import Optional


class EventType(str, Enum):
    """What kind of clinical event a HealthEvent represents.

    Maps loosely to FHIR resource types:
      encounter  -> Encounter
      diagnosis  -> Condition
      symptom    -> Observation / Condition (patient-reported)
      medication -> MedicationRequest / MedicationStatement
      lab        -> Observation (laboratory category)
      imaging    -> DiagnosticReport / ImagingStudy
      procedure  -> Procedure
      referral   -> ServiceRequest
    """

    ENCOUNTER = "encounter"
    DIAGNOSIS = "diagnosis"
    SYMPTOM = "symptom"
    MEDICATION = "medication"
    LAB = "lab"
    IMAGING = "imaging"
    PROCEDURE = "procedure"
    REFERRAL = "referral"


@dataclass
class Patient:
    """A patient. All demographic fields are synthetic for the hackathon."""

    patient_id: str
    name: str
    date_of_birth: date
    sex: str
    insurance_plan: str
    home_location: "Location"
    preferred_language: str = "en"
    mobility_constraints: list[str] = field(default_factory=list)
    accessibility_needs: list[str] = field(default_factory=list)

    def age_years(self, as_of: Optional[date] = None) -> int:
        as_of = as_of or date.today()
        years = as_of.year - self.date_of_birth.year
        had_birthday = (as_of.month, as_of.day) >= (
            self.date_of_birth.month,
            self.date_of_birth.day,
        )
        return years if had_birthday else years - 1


@dataclass
class Location:
    lat: float
    lon: float
    address: str


@dataclass
class HealthEvent:
    """One timestamped clinical event on a patient's longitudinal record.

    `topic` is a normalized, lowercase, underscore-separated label used to
    group related events across encounters and specialties (e.g.
    "pelvic_pain", "iron_deficiency"). It is what the longitudinal engine
    groups on -- keep it consistent across synthetic data and adapters.

    `value`/`unit` are used for lab-type events (e.g. value=9.1, unit="g/dL").
    `severity` is an optional 1-5 patient- or clinician-reported severity,
    used only for symptom-type events.
    `source` records which adapter/system produced this event, for
    traceability. `raw` retains the adapter's original payload shape so a
    trend flag can cite exact source data as evidence.
    """

    event_id: str
    patient_id: str
    event_type: EventType
    event_date: date
    topic: str
    description: str
    specialty: Optional[str] = None
    provider_id: Optional[str] = None
    status: Optional[str] = None  # e.g. active, resolved, ongoing, pending
    severity: Optional[int] = None  # 1-5, symptom events only
    value: Optional[float] = None  # lab events only
    unit: Optional[str] = None  # lab events only
    source: str = "mock_ehr_adapter"
    raw: dict = field(default_factory=dict)


@dataclass
class Provider:
    provider_id: str
    name: str
    specialty: str
    location: Location
    wait_days: int
    telehealth_available: bool
    in_network_plans: list[str] = field(default_factory=list)
    estimated_cost_usd: Optional[int] = None
    accessibility_features: list[str] = field(default_factory=list)
    languages: list[str] = field(default_factory=list)
    expertise_tags: list[str] = field(default_factory=list)


@dataclass
class Appointment:
    appointment_id: str
    patient_id: str
    provider_id: str
    scheduled_date: Optional[date]
    completed: bool = False
    modality: str = "in_person"  # in_person | telehealth
