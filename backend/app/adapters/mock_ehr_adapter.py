"""
Mock EHR adapter -- the only adapter used for the hackathon.

Serves synthetic patient data through the same `HealthRecordAdapter`
interface a real FHIR-based connection would implement. This is what makes
the "simulated MyChart/EHR connection" claim literally true rather than
aspirational: engines and routes never know or care that the data is mock,
because they only ever touch the interface in app/adapters/base.py.

No network calls, no real patient data, no external dependency -- this
adapter always works, which matters for demo reliability (see FAILSAFE
requirements in docs/API_CONTRACT.md).
"""

from __future__ import annotations

from app.adapters.base import HealthRecordAdapter
from app.data.synthetic_patients import HEALTH_EVENTS_BY_PATIENT, PATIENTS
from app.models.records import HealthEvent, Patient


class PatientNotFoundError(KeyError):
    pass


class MockEHRAdapter(HealthRecordAdapter):
    def get_patient(self, patient_id: str) -> Patient:
        try:
            return PATIENTS[patient_id]
        except KeyError:
            raise PatientNotFoundError(patient_id) from None

    def get_health_events(self, patient_id: str) -> list[HealthEvent]:
        if patient_id not in PATIENTS:
            raise PatientNotFoundError(patient_id)
        return list(HEALTH_EVENTS_BY_PATIENT.get(patient_id, []))

    def list_patient_ids(self) -> list[str]:
        return list(PATIENTS.keys())
