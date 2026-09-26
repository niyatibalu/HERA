"""
Research eligibility engine.

Hard privacy rule, enforced in code rather than left to caller discipline:
`find_matches` re-checks `ResearchConsent.is_active()` itself and returns
nothing if consent isn't active, even if a caller forgets to check first.

Matching is structural, not clinical: it compares what's documented in a
patient's record against a study's stated criteria and reports which
criteria are satisfied, which are not, and which can't be determined from
available data. It never asserts final eligibility -- only
"potentially_eligible", because real enrollment requires formal clinical
screening HERA does not perform.

Researcher-facing output uses a one-way pseudonymous candidate_id derived
from the patient_id and never exposes name, address, or any other direct
identifier.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass

from app.models.records import HealthEvent, Patient
from app.models.research import ResearchConsent, Study, StudyMatch

_CANDIDATE_ID_SALT = "hera-research-network-v1"  # fixed salt: deterministic, non-reversible


def pseudonymous_candidate_id(patient_id: str) -> str:
    """One-way id: same patient always maps to the same candidate_id (so a
    researcher can tell repeat matches apart), but the patient_id cannot be
    recovered from it."""
    digest = hashlib.sha256(f"{_CANDIDATE_ID_SALT}:{patient_id}".encode()).hexdigest()
    return f"candidate-{digest[:12]}"


@dataclass
class _CriterionResult:
    label: str
    satisfied: bool | None  # True / False / None = unknown


class ResearchEligibilityEngine:
    def find_matches(
        self,
        patient: Patient,
        events: list[HealthEvent],
        consent: ResearchConsent,
        studies: list[Study],
    ) -> list[StudyMatch]:
        """Return potential study matches for a patient. Returns an empty
        list -- never partial data -- unless consent is active."""
        if not consent.is_active():
            return []

        candidate_id = pseudonymous_candidate_id(patient.patient_id)
        matches: list[StudyMatch] = []
        for study in studies:
            results = self._evaluate(patient, events, study)
            satisfied = [r.label for r in results if r.satisfied is True]
            unmet = [r for r in results if r.satisfied is False]
            unknown = [r.label for r in results if r.satisfied is None]

            if unmet:
                continue  # any clearly-failed criterion excludes the study

            reason = (
                f"Matches {len(satisfied)} of {len(results)} evaluable criteria for "
                f"\"{study.title}\"."
            )
            if unknown:
                reason += f" {len(unknown)} criteria could not be determined from available records."

            matches.append(StudyMatch(
                study_id=study.study_id,
                candidate_id=candidate_id,
                eligibility_status="potentially_eligible",
                criteria_satisfied=satisfied,
                criteria_unknown=unknown,
                reason=reason,
            ))
        return matches

    # -- criterion evaluation -----------------------------------------------

    def _evaluate(self, patient: Patient, events: list[HealthEvent], study: Study) -> list[_CriterionResult]:
        c = study.criteria
        results: list[_CriterionResult] = []

        if c.sex is not None:
            results.append(_CriterionResult(f"sex is {c.sex}", patient.sex == c.sex))

        if c.age_min is not None or c.age_max is not None:
            age = patient.age_years()
            ok = True
            if c.age_min is not None and age < c.age_min:
                ok = False
            if c.age_max is not None and age > c.age_max:
                ok = False
            results.append(_CriterionResult(f"age within {c.age_min}-{c.age_max}", ok))

        if c.condition_topic is not None:
            topic_events = [e for e in events if e.topic == c.condition_topic]
            if not topic_events:
                results.append(_CriterionResult(f"documented {c.condition_topic.replace('_', ' ')}", False))
            else:
                results.append(_CriterionResult(f"documented {c.condition_topic.replace('_', ' ')}", True))

                if c.min_duration_days is not None:
                    first = min(e.event_date for e in topic_events)
                    last = max(e.event_date for e in topic_events)
                    duration = (last - first).days
                    results.append(_CriterionResult(
                        f"{c.condition_topic.replace('_', ' ')} documented for >= {c.min_duration_days} days",
                        duration >= c.min_duration_days,
                    ))

        for required_tag in c.required_treatment_history:
            has_treatment = any(
                e.raw.get("treatment_category") == required_tag for e in events
            )
            has_any_treatment_data = any("treatment_category" in e.raw for e in events)
            if has_treatment:
                satisfied = True
            elif has_any_treatment_data:
                satisfied = False
            else:
                satisfied = None  # no treatment data recorded at all -- genuinely unknown
            results.append(_CriterionResult(
                f"treatment history includes {required_tag.replace('_', ' ')}", satisfied
            ))

        return results
