"""
Synthetic patient data for the HERA demo.

Every patient, event, name, and date below is fabricated for the hackathon.
None of this is real patient information, and none of it was sourced from a
real MyChart/EHR account. This module is what MockEHRAdapter serves.

Primary demo patient: Maya (patient_id "maya-001"). Her event history spans
Jan-Dec 2025 and is written to intentionally trigger every longitudinal
pattern type the analysis engine looks for (see app/engine/longitudinal.py)
so the demo has something real to show, not a scripted flag.

A second, low-signal patient ("patient-002") is included so the engine's
"don't over-flag" behavior has something to be tested against.
"""

from __future__ import annotations

from datetime import date

from app.models.records import EventType, HealthEvent, Location, Patient

# ---------------------------------------------------------------------------
# Patients
# ---------------------------------------------------------------------------

MAYA = Patient(
    patient_id="maya-001",
    name="Maya Restrepo",
    date_of_birth=date(1996, 4, 12),
    sex="female",
    insurance_plan="MidwestCare PPO",
    home_location=Location(lat=43.0731, lon=-89.4012, address="Madison, WI"),
    preferred_language="es",
    mobility_constraints=[],
    accessibility_needs=[],
)

PATIENT_TWO = Patient(
    patient_id="patient-002",
    name="Jordan Kessler",
    date_of_birth=date(1990, 8, 2),
    sex="female",
    insurance_plan="MidwestCare HMO",
    home_location=Location(lat=43.0389, lon=-87.9065, address="Milwaukee, WI"),
    preferred_language="en",
)

PATIENTS: dict[str, Patient] = {p.patient_id: p for p in [MAYA, PATIENT_TWO]}


# ---------------------------------------------------------------------------
# Maya's longitudinal history
# ---------------------------------------------------------------------------
# Designed to demonstrate, with real evidence behind each:
#   - persistent_symptom            (pelvic_pain, 6 encounters, Jan->Dec)
#   - lab_trend                     (ferritin declining, May->Aug)
#   - repeated_treatment_no_improvement (2 med trials, pain unchanged)
#   - multiple_specialist_visits    (primary_care + obgyn)
#   - unresolved_referral           (Dec referral, still pending)

_MAYA_EVENTS = [
    dict(
        event_id="ev-001", event_type=EventType.ENCOUNTER, event_date=date(2025, 1, 14),
        topic="pelvic_pain", specialty="primary_care", provider_id="prov-pcp-01",
        description="Primary care visit for new-onset lower pelvic pain.",
        status="active",
    ),
    dict(
        event_id="ev-002", event_type=EventType.SYMPTOM, event_date=date(2025, 1, 14),
        topic="pelvic_pain", specialty="primary_care", provider_id="prov-pcp-01",
        description="Intermittent lower pelvic pain, roughly two weeks.",
        severity=2, status="active",
    ),
    dict(
        event_id="ev-003", event_type=EventType.ENCOUNTER, event_date=date(2025, 3, 2),
        topic="heavy_menstrual_bleeding", specialty="primary_care", provider_id="prov-pcp-01",
        description="Follow-up visit; new complaint of heavy menstrual bleeding.",
        status="active",
    ),
    dict(
        event_id="ev-004", event_type=EventType.SYMPTOM, event_date=date(2025, 3, 2),
        topic="heavy_menstrual_bleeding", specialty="primary_care", provider_id="prov-pcp-01",
        description="Soaking through pads within an hour on heaviest days.",
        severity=3, status="active",
    ),
    dict(
        event_id="ev-005", event_type=EventType.SYMPTOM, event_date=date(2025, 3, 2),
        topic="pelvic_pain", specialty="primary_care", provider_id="prov-pcp-01",
        description="Pelvic pain persists, now described as sharper.",
        severity=3, status="active",
    ),
    dict(
        event_id="ev-006", event_type=EventType.LAB, event_date=date(2025, 5, 19),
        topic="iron_deficiency", specialty="primary_care", provider_id="prov-pcp-01",
        description="Ferritin 22 ng/mL, low-normal.",
        value=22, unit="ng/mL", status="active",
    ),
    dict(
        event_id="ev-007", event_type=EventType.ENCOUNTER, event_date=date(2025, 5, 19),
        topic="iron_deficiency", specialty="primary_care", provider_id="prov-pcp-01",
        description="Labs reviewed; iron deficiency likely related to heavy menstrual bleeding.",
        status="active",
    ),
    dict(
        event_id="ev-008", event_type=EventType.MEDICATION, event_date=date(2025, 5, 19),
        topic="iron_deficiency", specialty="primary_care", provider_id="prov-pcp-01",
        description="Started oral ferrous sulfate supplementation.",
        status="active", raw={"treatment_category": "iron_supplementation"},
    ),
    dict(
        event_id="ev-009", event_type=EventType.ENCOUNTER, event_date=date(2025, 7, 8),
        topic="pelvic_pain", specialty="primary_care", provider_id="prov-pcp-01",
        description="Return visit: pelvic pain worsened despite supplementation.",
        status="active",
    ),
    dict(
        event_id="ev-010", event_type=EventType.SYMPTOM, event_date=date(2025, 7, 8),
        topic="pelvic_pain", specialty="primary_care", provider_id="prov-pcp-01",
        description="Pain now daily, 7/10 at worst, interfering with work.",
        severity=4, status="active",
    ),
    dict(
        event_id="ev-011", event_type=EventType.REFERRAL, event_date=date(2025, 7, 8),
        topic="pelvic_pain", specialty="obgyn", provider_id="prov-pcp-01",
        description="Referred to OB/GYN for persistent pelvic pain and heavy menstrual bleeding.",
        status="completed",
    ),
    dict(
        event_id="ev-012", event_type=EventType.ENCOUNTER, event_date=date(2025, 8, 15),
        topic="pelvic_pain", specialty="obgyn", provider_id="prov-obgyn-01",
        description="Initial OB/GYN evaluation for pelvic pain.",
        status="active",
    ),
    dict(
        event_id="ev-013", event_type=EventType.LAB, event_date=date(2025, 8, 15),
        topic="iron_deficiency", specialty="obgyn", provider_id="prov-obgyn-01",
        description="Ferritin re-checked at 8 ng/mL, declined from prior 22 ng/mL.",
        value=8, unit="ng/mL", status="active",
    ),
    dict(
        event_id="ev-014", event_type=EventType.ENCOUNTER, event_date=date(2025, 9, 22),
        topic="pelvic_pain", specialty="obgyn", provider_id="prov-obgyn-01",
        description="Second OB/GYN visit; pelvic ultrasound reviewed, no clear structural cause.",
        status="active",
    ),
    dict(
        event_id="ev-015", event_type=EventType.SYMPTOM, event_date=date(2025, 9, 22),
        topic="pelvic_pain", specialty="obgyn", provider_id="prov-obgyn-01",
        description="Pain unchanged, now persistent for over six months.",
        severity=4, status="active",
    ),
    dict(
        event_id="ev-016", event_type=EventType.MEDICATION, event_date=date(2025, 9, 22),
        topic="pelvic_pain", specialty="obgyn", provider_id="prov-obgyn-01",
        description="Trial of combined hormonal contraceptive for symptom management.",
        status="active", raw={"treatment_category": "hormonal_therapy"},
    ),
    dict(
        event_id="ev-017", event_type=EventType.ENCOUNTER, event_date=date(2025, 12, 8),
        topic="pelvic_pain", specialty="obgyn", provider_id="prov-obgyn-01",
        description="Hormonal therapy trial reviewed; symptoms persist despite adjustment.",
        status="active",
    ),
    dict(
        event_id="ev-018", event_type=EventType.MEDICATION, event_date=date(2025, 12, 8),
        topic="pelvic_pain", specialty="obgyn", provider_id="prov-obgyn-01",
        description="Hormonal therapy dose adjusted; second medication trial for pelvic pain.",
        status="active", raw={"treatment_category": "hormonal_therapy"},
    ),
    dict(
        event_id="ev-019", event_type=EventType.SYMPTOM, event_date=date(2025, 12, 8),
        topic="pelvic_pain", specialty="obgyn", provider_id="prov-obgyn-01",
        description="No improvement on adjusted hormonal therapy; pain persists.",
        severity=4, status="active",
    ),
    dict(
        event_id="ev-020", event_type=EventType.REFERRAL, event_date=date(2025, 12, 8),
        topic="pelvic_pain", specialty="chronic_pelvic_pain", provider_id="prov-obgyn-01",
        description="Referred to a chronic pelvic pain / pelvic floor specialist.",
        status="pending",
    ),
]

MAYA_EVENTS: list[HealthEvent] = [
    HealthEvent(patient_id=MAYA.patient_id, **kwargs) for kwargs in _MAYA_EVENTS
]

# ---------------------------------------------------------------------------
# Patient Two: minimal, low-signal history -- nothing should be flagged.
# ---------------------------------------------------------------------------

PATIENT_TWO_EVENTS: list[HealthEvent] = [
    HealthEvent(
        event_id="ev-201", patient_id=PATIENT_TWO.patient_id,
        event_type=EventType.ENCOUNTER, event_date=date(2025, 6, 4),
        topic="annual_wellness_exam", specialty="primary_care", provider_id="prov-pcp-02",
        description="Routine annual well-woman exam, no acute concerns.",
        status="resolved",
    ),
]

HEALTH_EVENTS_BY_PATIENT: dict[str, list[HealthEvent]] = {
    MAYA.patient_id: MAYA_EVENTS,
    PATIENT_TWO.patient_id: PATIENT_TWO_EVENTS,
}
