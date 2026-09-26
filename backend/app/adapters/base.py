"""
Health record adapter interface.

Every source of patient data -- a mock for the hackathon today, a real
FHIR-based EHR connection later -- implements this interface. Nothing else
in the backend (engines, routes) ever reads raw EHR/FHIR data directly; it
only ever sees `Patient` and `HealthEvent` objects returned here. That
boundary is what lets a real standards-based integration (e.g. SMART on
FHIR against an Epic/MyChart-supported endpoint) get swapped in later
without rewriting the analysis or matching engines.

Do NOT implement a real MyChart/EHR connection for the hackathon. Use
MockEHRAdapter, which serves synthetic data only.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from app.models.records import HealthEvent, Patient


class HealthRecordAdapter(ABC):
    """Abstract boundary between HERA and any record source.

    A future `FHIRAdapter` implementation would authenticate via SMART on
    FHIR, fetch Patient/Condition/Observation/MedicationRequest/
    ServiceRequest/Procedure resources for an authorized patient, and map
    each resource into a `HealthEvent` with `source="fhir:<system>"` and
    the original resource preserved in `raw` for auditability -- the same
    contract MockEHRAdapter fulfills below.
    """

    @abstractmethod
    def get_patient(self, patient_id: str) -> Patient:
        """Return the patient's demographic/profile record."""

    @abstractmethod
    def get_health_events(self, patient_id: str) -> list[HealthEvent]:
        """Return every known HealthEvent for this patient, any order.

        Callers (engines) are responsible for sorting/grouping; adapters
        just need to return a complete, accurate set.
        """

    @abstractmethod
    def list_patient_ids(self) -> list[str]:
        """Return every patient_id this adapter can serve. Used for demo
        listing and for research cohort scanning."""
