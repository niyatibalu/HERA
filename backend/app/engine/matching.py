"""
Provider matching engine.

Ranks candidate providers for a patient's care need. Deterministic and
explainable on purpose: every score decomposes into named, weighted
components, and every result carries both `match_reasons` (why it ranked
where it did) and `access_tradeoffs` (what's imperfect about it) so a
patient or care coordinator can see the reasoning, not just a sorted list.

This is what lets HERA route around an inaccessible original referral
(too far, too long a wait, out of network) instead of just reporting that
it's inaccessible.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field

from app.models.preferences import CarePreferences
from app.models.records import Location, Patient, Provider

# Scoring weights. Sum does not need to equal any particular value -- scores
# are reported on a normalized 0-100 scale for readability, not compared
# across different weighting configurations.
WEIGHT_SPECIALTY_FIT = 30
WEIGHT_NETWORK = 20
WEIGHT_WAIT = 15
WEIGHT_DISTANCE = 15
WEIGHT_COST = 10
WEIGHT_TELEHEALTH = 5
WEIGHT_ACCESSIBILITY = 5
# Patient-preference components. An unset preference earns full neutral
# credit, so it never changes the ranking on its own.
WEIGHT_REVIEWS = 8
WEIGHT_EXPERTISE = 6
WEIGHT_SCHEDULE = 6
WEIGHT_GENDER = 6
MAX_TOTAL = (
    WEIGHT_SPECIALTY_FIT + WEIGHT_NETWORK + WEIGHT_WAIT + WEIGHT_DISTANCE + WEIGHT_COST
    + WEIGHT_TELEHEALTH + WEIGHT_ACCESSIBILITY + WEIGHT_REVIEWS + WEIGHT_EXPERTISE
    + WEIGHT_SCHEDULE + WEIGHT_GENDER
)

SLOT_LABELS = {
    "weekday_morning": "weekday mornings",
    "weekday_afternoon": "weekday afternoons",
    "weekday_evening": "weekday evenings",
    "weekend": "weekends",
}

# Normalization ceilings: values at/beyond these get zero credit on that
# component, rather than an unbounded penalty.
WAIT_DAYS_CEILING = 60
DISTANCE_MI_CEILING = 75
COST_USD_CEILING = 500


def _haversine_miles(a: Location, b: Location) -> float:
    r = 3958.8  # earth radius, miles
    lat1, lon1, lat2, lon2 = map(math.radians, [a.lat, a.lon, b.lat, b.lon])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


@dataclass
class MatchRequest:
    required_specialty: str
    prefer_telehealth: bool = False
    max_distance_mi: float | None = None
    preferences: CarePreferences | None = None


@dataclass
class ProviderMatch:
    provider: Provider
    score: float
    distance_mi: float
    match_reasons: list[str] = field(default_factory=list)
    access_tradeoffs: list[str] = field(default_factory=list)


class ProviderMatchingEngine:
    def rank(
        self,
        patient: Patient,
        providers: list[Provider],
        request: MatchRequest,
    ) -> list[ProviderMatch]:
        results = [self._score(patient, p, request) for p in providers]
        results.sort(key=lambda m: m.score, reverse=True)
        return results

    def _score(self, patient: Patient, provider: Provider, request: MatchRequest) -> ProviderMatch:
        reasons: list[str] = []
        tradeoffs: list[str] = []
        total = 0.0
        prefs = request.preferences or CarePreferences(patient_id=patient.patient_id)
        plan = prefs.insurance_plan or patient.insurance_plan
        max_distance = request.max_distance_mi if request.max_distance_mi is not None else prefs.max_distance_mi
        telehealth_pref = "prefer_telehealth" if request.prefer_telehealth else prefs.telehealth

        # -- specialty fit --------------------------------------------------
        if provider.specialty == request.required_specialty:
            total += WEIGHT_SPECIALTY_FIT
            reasons.append(f"Specialty match: {provider.specialty.replace('_', ' ')}")
        elif request.required_specialty in provider.expertise_tags:
            total += WEIGHT_SPECIALTY_FIT * 0.85
            reasons.append(f"Relevant expertise: {request.required_specialty.replace('_', ' ')}")
        else:
            partial = WEIGHT_SPECIALTY_FIT * 0.3
            total += partial
            tradeoffs.append(
                f"Not a specialty match for {request.required_specialty.replace('_', ' ')} "
                f"(provider is {provider.specialty.replace('_', ' ')})"
            )

        # -- network / insurance ---------------------------------------------
        if plan in provider.in_network_plans:
            total += WEIGHT_NETWORK
            reasons.append(f"In-network for {plan}")
        else:
            tradeoffs.append(f"Out of network for {plan}")

        # -- wait time -----------------------------------------------------
        wait_score = max(0.0, 1 - provider.wait_days / WAIT_DAYS_CEILING)
        total += WEIGHT_WAIT * wait_score
        if provider.wait_days <= 14:
            reasons.append(f"Short wait: {provider.wait_days} days")
        elif provider.wait_days >= 30:
            tradeoffs.append(f"Long wait: {provider.wait_days} days")

        # -- distance --------------------------------------------------------
        distance_mi = round(_haversine_miles(patient.home_location, provider.location), 1)
        distance_score = max(0.0, 1 - distance_mi / DISTANCE_MI_CEILING)
        remote_ok = telehealth_pref == "prefer_telehealth" and provider.telehealth_available
        if max_distance is not None and distance_mi > max_distance and not remote_ok:
            distance_score = 0.0
            tradeoffs.append(f"Beyond your {max_distance:g} mi travel limit ({distance_mi} mi)")
        elif distance_mi >= 40:
            tradeoffs.append(f"Far from home: {distance_mi} mi")
        total += WEIGHT_DISTANCE * distance_score
        if distance_mi <= 15:
            reasons.append(f"Close to home: {distance_mi} mi")

        # -- cost --------------------------------------------------------------
        cost = provider.estimated_cost_usd
        if cost is not None:
            cost_score = max(0.0, 1 - cost / COST_USD_CEILING)
            if prefs.max_cost_usd is not None:
                if cost <= prefs.max_cost_usd:
                    cost_score = max(cost_score, 0.9)
                    reasons.append(f"Within your budget: ${cost} per visit")
                elif prefs.needs_financial_assistance and provider.sliding_scale:
                    cost_score = max(cost_score, 0.6)
                    tradeoffs.append(f"Above your ${prefs.max_cost_usd} budget before financial assistance (${cost})")
                else:
                    cost_score = 0.0
                    tradeoffs.append(f"Above your ${prefs.max_cost_usd} budget: ${cost} per visit")
            elif cost >= 300:
                tradeoffs.append(f"High estimated cost: ${cost}")
            total += WEIGHT_COST * cost_score
        else:
            total += WEIGHT_COST * 0.5  # unknown cost -- neutral credit
        if prefs.needs_financial_assistance:
            if provider.sliding_scale:
                reasons.append("Offers sliding-scale fees / financial assistance")
            else:
                tradeoffs.append("No sliding-scale or financial assistance program listed")

        # -- telehealth -----------------------------------------------------
        if telehealth_pref == "prefer_telehealth" and provider.telehealth_available:
            total += WEIGHT_TELEHEALTH
            reasons.append("Telehealth available (your preference)")
        elif telehealth_pref == "prefer_telehealth":
            tradeoffs.append("No telehealth option")
        elif telehealth_pref == "in_person_only":
            total += WEIGHT_TELEHEALTH  # every provider offers in-person visits
        elif provider.telehealth_available:
            total += WEIGHT_TELEHEALTH * 0.5
            reasons.append("Telehealth available")

        # -- accessibility needs -----------------------------------------------
        needs = patient.accessibility_needs
        if needs:
            met = [n for n in needs if n in provider.accessibility_features]
            unmet = [n for n in needs if n not in provider.accessibility_features]
            if met:
                total += WEIGHT_ACCESSIBILITY * (len(met) / len(needs))
                reasons.append(f"Meets accessibility needs: {', '.join(met)}")
            for n in unmet:
                tradeoffs.append(f"Does not confirm accessibility need: {n}")
        else:
            total += WEIGHT_ACCESSIBILITY  # no needs stated -- full neutral credit

        if patient.preferred_language not in ("en", *provider.languages):
            tradeoffs.append(f"No confirmed {patient.preferred_language} language support")
        elif patient.preferred_language in provider.languages:
            reasons.append(f"Speaks {patient.preferred_language}")

        # -- expertise the patient asked for ---------------------------------
        if prefs.expertise:
            skills = {provider.specialty, *provider.expertise_tags}
            matched = [e for e in prefs.expertise if e in skills]
            total += WEIGHT_EXPERTISE * len(matched) / len(prefs.expertise)
            if matched:
                reasons.append(f"Expertise you asked for: {', '.join(m.replace('_', ' ') for m in matched)}")
            else:
                tradeoffs.append(f"No listed expertise in {', '.join(e.replace('_', ' ') for e in prefs.expertise)}")
        else:
            total += WEIGHT_EXPERTISE

        # -- patient reviews (synthetic) -------------------------------------
        if provider.rating is not None:
            total += WEIGHT_REVIEWS * provider.rating / 5
            if prefs.min_rating is not None and provider.rating < prefs.min_rating:
                tradeoffs.append(f"Rated {provider.rating:g}, below your minimum of {prefs.min_rating:g}")
            elif provider.rating >= 4.5:
                reasons.append(f"Rated {provider.rating:g}/5 by {provider.review_count} patients")
        else:
            total += WEIGHT_REVIEWS * 0.5

        # -- schedule ---------------------------------------------------------
        if prefs.availability:
            overlap = [s for s in prefs.availability if s in provider.availability]
            if overlap:
                total += WEIGHT_SCHEDULE
                reasons.append(f"Has appointments when you're free: {', '.join(SLOT_LABELS.get(s, s) for s in overlap)}")
            else:
                tradeoffs.append("No appointments at the times you said you're free")
        else:
            total += WEIGHT_SCHEDULE

        # -- clinician gender preference -------------------------------------
        if prefs.provider_gender != "no_preference":
            if provider.gender == prefs.provider_gender:
                total += WEIGHT_GENDER
                reasons.append(f"Matches your preference for a {prefs.provider_gender} clinician")
            else:
                tradeoffs.append(f"Not a {prefs.provider_gender} clinician (your preference)")
        else:
            total += WEIGHT_GENDER

        return ProviderMatch(
            provider=provider,
            score=round(100 * total / MAX_TOTAL, 1),
            distance_mi=distance_mi,
            match_reasons=reasons,
            access_tradeoffs=tradeoffs,
        )
