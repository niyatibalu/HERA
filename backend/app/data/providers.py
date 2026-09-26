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

# ---------------------------------------------------------------------------
# A wider synthetic directory so patient preferences (expertise, gender,
# schedule, budget, insurance, telehealth, distance) visibly change who
# ranks first. All names, locations, ratings and reviews are fabricated.
# ---------------------------------------------------------------------------
def _p(pid, name, specialty, lat, lon, address, wait, tele, plans, cost, access, langs, tags,
       gender, rating, reviews, highlights, availability, sliding):
    return pid, Provider(
        provider_id=pid, name=name, specialty=specialty, location=Location(lat=lat, lon=lon, address=address),
        wait_days=wait, telehealth_available=tele, in_network_plans=plans, estimated_cost_usd=cost,
        accessibility_features=access, languages=langs, expertise_tags=tags, gender=gender, rating=rating,
        review_count=reviews, review_highlights=highlights, availability=availability, sliding_scale=sliding,
    )


PPO, HMO, MEDICAID = "MidwestCare PPO", "MidwestCare HMO", "BadgerCare Medicaid"
WHEELCHAIR = ["wheelchair_accessible"]

PROVIDERS.update(dict([
    _p("prov-endo-madison", "Dr. Priya Raman", "gynecologic_surgery", 43.0766, -89.4500, "Madison, WI", 24, False,
       [PPO, HMO], 180, WHEELCHAIR, ["en", "hi"], ["endometriosis", "chronic_pelvic_pain", "minimally_invasive_surgery"],
       "female", 4.9, 188, ["Explained every option before surgery"], ["weekday_morning", "weekday_afternoon"], False),
    _p("prov-pfpt-madison", "Lauren Kim, DPT", "pelvic_floor_physical_therapy", 43.0930, -89.3510, "Madison, WI", 5, True,
       [PPO, HMO, MEDICAID], 60, WHEELCHAIR, ["en"], ["pelvic_floor_dysfunction", "chronic_pelvic_pain", "postpartum"],
       "female", 4.8, 143, ["Evening sessions fit my work schedule"], ["weekday_evening", "weekend"], True),
    _p("prov-pfpt-middleton", "Marcus Bell, DPT", "pelvic_floor_physical_therapy", 43.0972, -89.5043, "Middleton, WI", 3, True,
       [PPO], 65, [], ["en"], ["pelvic_floor_dysfunction"],
       "male", 4.6, 58, ["Clear home exercise plan"], ["weekday_morning", "weekday_evening"], False),
    _p("prov-cpp-fitchburg", "Dr. Daniel Ortiz", "chronic_pelvic_pain", 42.9608, -89.4698, "Fitchburg, WI", 18, True,
       [PPO, HMO, MEDICAID], 110, WHEELCHAIR, ["en", "es"], ["chronic_pelvic_pain", "pain_management", "endometriosis"],
       "male", 4.6, 92, ["Took my pain seriously from the first visit"], ["weekday_afternoon", "weekday_evening"], True),
    _p("prov-cpp-janesville", "Dr. Grace Holloway", "chronic_pelvic_pain", 42.6828, -89.0187, "Janesville, WI", 9, True,
       [PPO], 90, WHEELCHAIR, ["en"], ["chronic_pelvic_pain", "vulvodynia"],
       "female", 4.5, 64, ["Worth the drive"], ["weekday_morning", "weekend"], True),
    _p("prov-rei-madison", "Dr. Hannah Weiss", "reproductive_endocrinology", 43.0610, -89.4010, "Madison, WI", 30, True,
       [PPO], 210, WHEELCHAIR, ["en"], ["reproductive_endocrinology", "pcos", "endometriosis", "fertility"],
       "female", 4.7, 120, ["Very thorough hormone workup"], ["weekday_morning"], False),
    _p("prov-urogyn-madison", "Dr. Samuel Adeyemi", "urogynecology", 43.1000, -89.3300, "Madison, WI", 14, False,
       [PPO, HMO], 160, WHEELCHAIR, ["en", "yo"], ["urogynecology", "pelvic_floor_dysfunction", "bladder_pain"],
       "male", 4.4, 51, ["Knowledgeable about bladder pain"], ["weekday_afternoon"], False),
    _p("prov-gyn-riley", "Dr. Riley Chen-Park", "gynecology", 43.0740, -89.3900, "Madison, WI", 10, True,
       [PPO, HMO, MEDICAID], 100, WHEELCHAIR, ["en", "es"], ["general_gynecology", "lgbtq_care", "chronic_pelvic_pain"],
       "nonbinary", 4.8, 77, ["Welcoming and never rushed"], ["weekday_evening", "weekend"], True),
    _p("prov-endo-milwaukee", "Dr. Olivia Brandt", "gynecologic_surgery", 43.0500, -87.9500, "Milwaukee, WI", 20, True,
       [PPO, HMO], 170, WHEELCHAIR, ["en"], ["endometriosis", "chronic_pelvic_pain", "minimally_invasive_surgery"],
       "female", 4.8, 201, ["Regional endometriosis expert"], ["weekday_afternoon"], False),
    _p("prov-tele-nwosu", "Dr. Amara Nwosu", "chronic_pelvic_pain", 43.0389, -87.9065, "Milwaukee, WI (telehealth-first)", 4, True,
       [PPO, HMO, MEDICAID], 75, [], ["en", "es"], ["chronic_pelvic_pain", "endometriosis", "pain_management"],
       "female", 4.6, 84, ["Video visits that actually felt personal"], ["weekday_evening", "weekend"], True),
    _p("prov-pain-sunprairie", "Dr. Victor Hale", "pain_management", 43.1836, -89.2137, "Sun Prairie, WI", 7, True,
       [HMO], 130, WHEELCHAIR, ["en"], ["pain_management", "chronic_pelvic_pain"],
       "male", 4.1, 39, ["Good at medication options"], ["weekday_morning", "weekday_afternoon"], False),
    _p("prov-gyn-baraboo", "Dr. Beth Lindgren", "gynecology", 43.4711, -89.7443, "Baraboo, WI", 6, True,
       [PPO, MEDICAID], 85, [], ["en"], ["general_gynecology"],
       "female", 4.3, 29, ["Small practice, easy to get in"], ["weekday_morning", "weekday_afternoon"], True),
]))
