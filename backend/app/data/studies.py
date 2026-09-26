"""Mock women's-health research studies for eligibility matching."""

from __future__ import annotations

from app.models.research import Study, StudyCriteria

STUDIES: dict[str, Study] = {
    "study-a": Study(
        study_id="study-a",
        title="Chronic Pelvic Pain Hormonal Therapy Outcomes Study",
        description=(
            "Observational study following women with chronic pelvic pain "
            "who have tried hormonal therapy, to understand what predicts "
            "response."
        ),
        criteria=StudyCriteria(
            age_min=18,
            age_max=35,
            sex="female",
            condition_topic="pelvic_pain",
            min_duration_days=180,
            required_treatment_history=["hormonal_therapy"],
        ),
    ),
    "study-b": Study(
        study_id="study-b",
        title="PCOS Metabolic Health Study",
        description="Metabolic and cardiovascular risk tracking in women with PCOS.",
        criteria=StudyCriteria(
            age_min=18,
            age_max=40,
            sex="female",
            condition_topic="pcos",
        ),
    ),
    "study-c": Study(
        study_id="study-c",
        title="Endometriosis Biomarker Study",
        description="Blood biomarker panel for women with surgically confirmed endometriosis.",
        criteria=StudyCriteria(
            age_min=18,
            age_max=45,
            sex="female",
            condition_topic="endometriosis",
            min_duration_days=90,
            required_treatment_history=["surgical_intervention"],
        ),
    ),
}
