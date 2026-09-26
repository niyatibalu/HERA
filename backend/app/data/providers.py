"""
Synthetic provider directory.

Includes Maya's original specialist referral target (deliberately
inaccessible -- far, long wait, out of network) plus alternatives at
varying quality, so the provider matching engine has a real ranking
decision to make rather than an obvious single choice.
"""

from __future__ import annotations

from app.models.records import Location, Provider

PROVIDERS: dict[str, Provider] = {
    "prov-pcp-01": Provider(
        provider_id="prov-pcp-01",
        name="Dr. Alicia Foster",
        specialty="primary_care",
        location=Location(lat=43.0731, lon=-89.4012, address="Madison, WI"),
        wait_days=3,
        telehealth_available=True,
        in_network_plans=["MidwestCare PPO", "MidwestCare HMO"],
        estimated_cost_usd=40,
        accessibility_features=["wheelchair_accessible"],
        languages=["en", "es"],
        expertise_tags=["primary_care"],
        gender='female',
        rating=4.4,
        review_count=88,
        review_highlights=['Takes time to listen', 'Easy to reach through the portal'],
        availability=['weekday_morning', 'weekday_afternoon'],
        sliding_scale=True,
    ),
    "prov-obgyn-01": Provider(
        provider_id="prov-obgyn-01",
        name="Dr. Sarah Lindqvist",
        specialty="obgyn",
        location=Location(lat=43.0800, lon=-89.3900, address="Madison, WI"),
        wait_days=5,
        telehealth_available=True,
        in_network_plans=["MidwestCare PPO"],
        estimated_cost_usd=150,
        accessibility_features=["wheelchair_accessible"],
        languages=["en"],
        expertise_tags=["obstetrics", "general_gynecology"],
        gender='female',
        rating=4.6,
        review_count=143,
        review_highlights=['Explains options clearly', 'Short waits in clinic'],
        availability=['weekday_morning', 'weekday_afternoon'],
        sliding_scale=False,
    ),
    # Maya's originally referred specialist: too far, too long a wait,
    # and out of network for her plan. This is the "inaccessible" option
    # HERA's matching engine is expected to route around.
    "prov-original-specialist": Provider(
        provider_id="prov-original-specialist",
        name="Dr. Renee Whitfield",
        specialty="chronic_pelvic_pain",
        location=Location(lat=41.8781, lon=-87.6298, address="Chicago, IL"),
        wait_days=61,
        telehealth_available=False,
        in_network_plans=[],  # out of network for MidwestCare PPO
        estimated_cost_usd=420,
        accessibility_features=[],
        languages=["en"],
        expertise_tags=["chronic_pelvic_pain", "endometriosis"],
        gender='female',
        rating=4.9,
        review_count=212,
        review_highlights=['Leading endometriosis surgeon', 'Hard to get an appointment'],
        availability=['weekday_morning'],
        sliding_scale=False,
    ),
    # Best accessible alternative.
    "prov-alt-best": Provider(
        provider_id="prov-alt-best",
        name="Dr. Ifeoma Okafor",
        specialty="chronic_pelvic_pain",
        location=Location(lat=43.0625, lon=-89.4306, address="Madison, WI"),
        wait_days=12,
        telehealth_available=True,
        in_network_plans=["MidwestCare PPO", "MidwestCare HMO"],
        estimated_cost_usd=95,
        accessibility_features=["wheelchair_accessible", "ground_floor_entrance"],
        languages=["en", "es"],
        expertise_tags=["chronic_pelvic_pain", "pelvic_floor_dysfunction"],
        gender='female',
        rating=4.8,
        review_count=126,
        review_highlights=['Finally felt believed about my pain', 'Spanish-speaking staff'],
        availability=['weekday_afternoon', 'weekday_evening'],
        sliding_scale=True,
    ),
    # A middling in-network option: generalist, longer wait, no
    # specific chronic-pain expertise -- present so ranking has to
    # weigh multiple real tradeoffs, not just filter one bad option.
    "prov-alt-ok": Provider(
        provider_id="prov-alt-ok",
        name="Dr. Michael Chen",
        specialty="gynecology",
        location=Location(lat=43.1500, lon=-89.3400, address="Sun Prairie, WI"),
        wait_days=21,
        telehealth_available=True,
        in_network_plans=["MidwestCare PPO"],
        estimated_cost_usd=140,
        accessibility_features=[],
        languages=["en"],
        expertise_tags=["general_gynecology"],
        gender='male',
        rating=4.2,
        review_count=61,
        review_highlights=['Thorough but rushed'],
        availability=['weekday_morning'],
        sliding_scale=False,
    ),
    # Telehealth-first option: no clinic to travel to at all. Useful for
    # showing the matching engine's telehealth weighting against a
    # patient with tight travel constraints.
    "prov-alt-telehealth": Provider(
        provider_id="prov-alt-telehealth",
        name="Kara Whitmore, DPT",
        specialty="pelvic_floor_physical_therapy",
        location=Location(lat=42.9633, lon=-88.0034, address="Waukesha, WI"),
        wait_days=6,
        telehealth_available=True,
        in_network_plans=["MidwestCare PPO", "MidwestCare HMO"],
        estimated_cost_usd=70,
        accessibility_features=["wheelchair_accessible"],
        languages=["en"],
        expertise_tags=["chronic_pelvic_pain", "pelvic_floor_dysfunction"],
        gender='female',
        rating=4.7,
        review_count=97,
        review_highlights=['Practical exercises that helped', 'Flexible video visits'],
        availability=['weekday_evening', 'weekend'],
        sliding_scale=True,
    ),
    "prov-pcp-02": Provider(
        provider_id="prov-pcp-02",
        name="Dr. Ben Alvarez",
        specialty="primary_care",
        location=Location(lat=43.0389, lon=-87.9065, address="Milwaukee, WI"),
        wait_days=4,
        telehealth_available=True,
        in_network_plans=["MidwestCare HMO"],
        estimated_cost_usd=35,
        accessibility_features=["wheelchair_accessible"],
        languages=["en"],
        expertise_tags=["primary_care"],
        gender='male',
        rating=4.5,
        review_count=74,
        review_highlights=['Friendly and efficient'],
        availability=['weekday_morning', 'weekday_afternoon', 'weekend'],
        sliding_scale=False,
    ),
}
