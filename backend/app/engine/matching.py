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
        if patient.insurance_plan in provider.in_network_plans:
            total += WEIGHT_NETWORK
            reasons.append(f"In-network for {patient.insurance_plan}")
        else:
            tradeoffs.append(f"Out of network for {patient.insurance_plan}")

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
        total += WEIGHT_DISTANCE * distance_score
        if distance_mi <= 15:
            reasons.append(f"Close to home: {distance_mi} mi")
        elif distance_mi >= 40:
            tradeoffs.append(f"Far from home: {distance_mi} mi")
        if request.max_distance_mi is not None and distance_mi > request.max_distance_mi:
            tradeoffs.append(f"Exceeds stated travel limit of {request.max_distance_mi} mi")

        # -- cost --------------------------------------------------------------
        if provider.estimated_cost_usd is not None:
            cost_score = max(0.0, 1 - provider.estimated_cost_usd / COST_USD_CEILING)
            total += WEIGHT_COST * cost_score
            if provider.estimated_cost_usd >= 300:
                tradeoffs.append(f"High estimated cost: ${provider.estimated_cost_usd}")
        else:
            total += WEIGHT_COST * 0.5  # unknown cost -- neutral credit

        # -- telehealth -----------------------------------------------------
        if request.prefer_telehealth and provider.telehealth_available:
            total += WEIGHT_TELEHEALTH
            reasons.append("Telehealth available")
        elif request.prefer_telehealth and not provider.telehealth_available:
            tradeoffs.append("No telehealth option")
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

        return ProviderMatch(
            provider=provider,
            score=round(total, 1),
            distance_mi=distance_mi,
            match_reasons=reasons,
            access_tradeoffs=tradeoffs,
        )
