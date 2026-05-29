"""
Extraction prompt library — one prompt per archive category.
Each prompt instructs NotebookLM to return structured, parseable output.
"""

# ── System instruction appended to every prompt ───────────────────────────────

SYSTEM_SUFFIX = """

IMPORTANT FORMATTING RULES:
- Return ONLY a numbered list of incidents. No preamble, no summary, no closing remarks.
- Each incident must follow this EXACT format:

INCIDENT [N]
DESCRIPTION: [One clear sentence describing what happened]
DATE: [Year or approximate period, e.g. "1972", "early 1980s", "around 1995", "unknown"]
DATE_PRECISION: [exact / approximate / decade / unknown]
PEOPLE: [Comma-separated list of names mentioned, or "none"]
LOCATIONS: [Comma-separated list of places mentioned, or "none"]
CATEGORY: [The category name as given in the instructions]
ACCESS_TIER: [1 = public, 2 = controlled, 3 = restricted]
SOURCE_CHUNK: [The exact passage or quote from the transcript that supports this incident, max 3 sentences]

If no incidents of this type are found in the transcript, return: NO_INCIDENTS_FOUND
"""

# ── Prompt definitions ────────────────────────────────────────────────────────

PROMPTS = {

    "daily_dateline": {
        "label": "📅 Daily Dateline & Life Events",
        "description": "Core chronological events — where Bapaji was, what he did, key milestones",
        "category": "daily_dateline",
        "access_tier_default": 1,
        "prompt": """Carefully read this transcript and identify every incident that describes:
- Where Bapaji was on a specific day or period (location + what was happening)
- Key milestones in his life (travel, arrivals, departures, significant days)
- Day summaries or diary-like descriptions of his activities
- Any mentions of specific dates, days, or time periods tied to an event

For each incident, extract the information in the format below.
CATEGORY: daily_dateline
""" + SYSTEM_SUFFIX
    },

    "health_aahar": {
        "label": "❤️ Health & Aahar (Diet/Discipline)",
        "description": "Physical health events, diet, daily rhythm, discipline",
        "category": "health_aahar_discipline",
        "access_tier_default": 2,
        "prompt": """Carefully read this transcript and identify every incident that describes:
- Bapaji's physical health — any illness, recovery, medical attention, or health phase
- His food (aahar) — what he ate, who prepared it, any fasting or dietary discipline
- His daily physical routine — sleep, rest, exercise, morning rituals
- Any attending doctors or caregivers mentioned

NOTE: Health details are Tier 2 (controlled access) unless explicitly sensitive (medical reports, diagnoses) which are Tier 3.
CATEGORY: health_aahar_discipline
""" + SYSTEM_SUFFIX
    },

    "spiritual_experiences": {
        "label": "✨ Spiritual Experiences & States",
        "description": "Mystical experiences, meditative states, spiritual milestones",
        "category": "spiritual_exp",
        "access_tier_default": 2,
        "prompt": """Carefully read this transcript and identify every incident that describes:
- Bapaji's direct spiritual experiences — samadhi, visions, states of absorption
- Moments of deep meditation or inner stillness described by witnesses
- Spiritual milestones — first experiences, transformative moments, initiations
- Any accounts of unusual spiritual phenomena observed by others around him
- His retreats, periods of silence (maun), and austerities

CATEGORY: spiritual_exp
""" + SYSTEM_SUFFIX
    },

    "teachings_guidance": {
        "label": "📢 Teachings & Guidance Given",
        "description": "Satsangs, pravachans, personal guidance, philosophical teachings",
        "category": "teachings_guidance",
        "access_tier_default": 1,
        "prompt": """Carefully read this transcript and identify every incident that describes:
- Specific teachings or pravachans given by Bapaji — what topic, what guidance
- Personal guidance given to an individual or group
- Questions he answered and the essence of his response
- Key philosophical statements or principles he articulated
- Evolution of his teaching style or topics over time
- First satsangs, first teachings, early formation of teachings

CATEGORY: teachings_guidance
""" + SYSTEM_SUFFIX
    },

    "people_encounters": {
        "label": "👤 People & Encounters",
        "description": "First meetings, interactions with devotees, family, saints, dignitaries",
        "category": "people_encounters",
        "access_tier_default": 1,
        "prompt": """Carefully read this transcript and identify every incident that describes:
- First meetings between Bapaji and any person (devotee, family member, dignitary, saint)
- Significant interactions — conversations, exchanges, moments of guidance
- A person's entry into the spiritual path through Bapaji
- Dikshas (initiations) given by Bapaji — who received, when, where
- Interactions with other saints or spiritual teachers
- Meetings with government officials, public figures, or dignitaries
- Family interactions and relationships

For each person mentioned, note their name, role/relation, and context.
CATEGORY: people_encounters
""" + SYSTEM_SUFFIX
    },

    "travels_journeys": {
        "label": "🌍 Travels & Journeys",
        "description": "All travel — local, national, international; camps, yatras, tours",
        "category": "travels_journeys",
        "access_tier_default": 1,
        "prompt": """Carefully read this transcript and identify every incident that describes:
- Any journey or travel undertaken by Bapaji — destination, duration, purpose
- Visits to cities, villages, ashrams, centers, or homes of devotees
- International travel — country, city, occasion
- Yatras, pilgrimage tours, research tours
- Camps or retreats held at specific locations
- First visits to a new location
- Regular or recurring travel patterns

CATEGORY: travels_journeys
""" + SYSTEM_SUFFIX
    },

    "institutional_events": {
        "label": "🏛️ Institutional Events & Milestones",
        "description": "Organisation founding, wing formation, registration, governance",
        "category": "institutional_timeline",
        "access_tier_default": 1,
        "prompt": """Carefully read this transcript and identify every incident that describes:
- The founding or formation of SRMD or any of its wings/departments
- Formal registration events (country, year, governing body)
- Inauguration of ashrams, centers, or institutions
- Formation of committees, appointment of trustees or heads
- Governance decisions or structural changes to the organisation
- The pre-institution phase — informal gatherings that preceded formal formation
- First satsangs, first formal events, first publications

CATEGORY: institutional_timeline
""" + SYSTEM_SUFFIX
    },

    "seva_projects": {
        "label": "🌱 Seva Projects & Social Work",
        "description": "Education, healthcare, community seva, disaster relief, cow protection",
        "category": "seva_projects",
        "access_tier_default": 1,
        "prompt": """Carefully read this transcript and identify every incident that describes:
- Any seva (service) project initiated, inaugurated, or guided by Bapaji
- Education initiatives — schools, scholarships, coaching centres, tribal outreach
- Healthcare — medical camps, eye camps, mobile health units
- Disaster relief — floods, droughts, COVID response
- Community projects — cow protection (Gaushala), tree plantation, women empowerment
- Scale of any project — beneficiaries, volunteers, reach
- Bapaji's direct involvement or guidance in any seva activity

CATEGORY: seva_projects
""" + SYSTEM_SUFFIX
    },

    "awards_recognition": {
        "label": "🏅 Awards & Recognition",
        "description": "Honours given to Bapaji or to SRMD institution",
        "category": "awards_accreds",
        "access_tier_default": 1,
        "prompt": """Carefully read this transcript and identify every incident that describes:
- Awards or honours received by Bapaji personally — title, awarding body, year
- Awards or accreditations received by SRMD as an institution
- Honorary doctorates, civic recognitions, government honours
- Acceptance ceremonies — did Bapaji attend in person? Was a speech given?
- Any strategic partnerships or formal recognitions by external bodies

CATEGORY: awards_accreds
""" + SYSTEM_SUFFIX
    },

    "physical_spaces": {
        "label": "🏗️ Physical Spaces & Ashrams",
        "description": "Ashrams, centers, hubs — founding, construction, land, vision",
        "category": "physical_spaces",
        "access_tier_default": 1,
        "prompt": """Carefully read this transcript and identify every incident that describes:
- The founding, construction, or inauguration of any ashram, center, or hub
- Land acquisition — donated, purchased, or leased; donor names if mentioned
- Bapaji's vision or spiritual intent for a specific space
- Construction milestones — start year, completion, phases
- Master-guided decisions about a space — any guidance given at inception
- Expansion or renovation of existing spaces
- Specific locations: city, state, country

CATEGORY: physical_spaces
""" + SYSTEM_SUFFIX
    },

    "contextual_events": {
        "label": "🌐 Social & Contextual Events",
        "description": "National events, disasters, COVID, political transitions, community crises",
        "category": "social_contextual",
        "access_tier_default": 1,
        "prompt": """Carefully read this transcript and identify every incident that describes:
- National or world events mentioned in relation to Bapaji or SRMD (COVID, disasters, elections)
- How Bapaji or the organisation responded to a crisis or social event
- Morbi flood relief or any similar disaster response led by Bapaji
- Political transitions that affected the mission
- Community crises and how the institution responded
- Cultural or social movements of the era that provide context

CATEGORY: social_contextual
""" + SYSTEM_SUFFIX
    },

    "life_formation": {
        "label": "🌱 Life & Formation Phase",
        "description": "Birth, early life, family background, education, spiritual seeking",
        "category": "life_formation",
        "access_tier_default": 1,
        "prompt": """Carefully read this transcript and identify every incident that describes:
- Bapaji's birth, birthplace, early childhood
- Family background — parents, siblings, household
- Formal and informal education
- Early spiritual inclinations or seeking
- First exposure to Jain philosophy or spiritual teachings
- Transformational milestones in his early life
- The period of spiritual seeking before his emergence as a teacher

CATEGORY: life_formation
""" + SYSTEM_SUFFIX
    },

    "counts_milestones": {
        "label": "🔢 Counts & Numerical Milestones",
        "description": "Dikshas, birthdays, appointments, significant numbers",
        "category": "counts",
        "access_tier_default": 1,
        "prompt": """Carefully read this transcript and identify every incident that mentions a significant COUNT or NUMBER related to Bapaji:
- Number of dikshas given (total milestones — 100th, 500th, 1000th, etc.)
- Birthdays (milestone years — 50th, 60th, 70th, etc.)
- Appointments made (to a role, a count of appointments)
- Number of centers opened, countries reached, volunteers serving
- Any numerical milestone celebrated or noted

CATEGORY: counts
""" + SYSTEM_SUFFIX
    },

    "artifacts_objects": {
        "label": "🏺 Sacred Artifacts & Objects",
        "description": "Personal objects, manuscripts, ritual items, significant gifts",
        "category": "artifacts",
        "access_tier_default": 1,
        "prompt": """Carefully read this transcript and identify every incident that describes:
- Personal objects belonging to or used by Bapaji (robes, mala, spectacles, etc.)
- Handwritten notes or manuscripts by him
- Ritual or sacred objects associated with him
- Significant gifts received or given
- Shilalekh (inscriptions) during Pratishthas
- Autographs given at notable moments
- Objects that have a story or significance mentioned in the transcript

CATEGORY: artifacts
""" + SYSTEM_SUFFIX
    },

}

# ── Category metadata for display ────────────────────────────────────────────

CATEGORY_META = {
    "daily_dateline":       {"color": "#c9a84c", "icon": "📅", "tier_default": 1, "label": "Daily Dateline"},
    "health_aahar_discipline": {"color": "#d94a4a", "icon": "❤️",  "tier_default": 2, "label": "Health & Aahar"},
    "spiritual_exp":        {"color": "#8a50d9", "icon": "✨", "tier_default": 2, "label": "Spiritual Experience"},
    "teachings_guidance":   {"color": "#4a90d9", "icon": "📢", "tier_default": 1, "label": "Teachings & Guidance"},
    "people_encounters":    {"color": "#d04090", "icon": "👤", "tier_default": 1, "label": "People & Encounters"},
    "travels_journeys":     {"color": "#3ab0b8", "icon": "🌍", "tier_default": 1, "label": "Travels & Journeys"},
    "institutional_timeline":{"color": "#3a9a60","icon": "🏛️", "tier_default": 1, "label": "Institutional"},
    "seva_projects":        {"color": "#3ab0b8", "icon": "🌱", "tier_default": 1, "label": "Seva Projects"},
    "awards_accreds":       {"color": "#d98030", "icon": "🏅", "tier_default": 1, "label": "Awards & Recognition"},
    "physical_spaces":      {"color": "#90c030", "icon": "🏗️", "tier_default": 1, "label": "Physical Spaces"},
    "social_contextual":    {"color": "#4a90d9", "icon": "🌐", "tier_default": 1, "label": "Social Context"},
    "life_formation":       {"color": "#6ab0f5", "icon": "🌱", "tier_default": 1, "label": "Life & Formation"},
    "counts":               {"color": "#c9a84c", "icon": "🔢", "tier_default": 1, "label": "Counts & Milestones"},
    "artifacts":            {"color": "#d04090", "icon": "🏺", "tier_default": 1, "label": "Artifacts & Objects"},
}

def get_category_color(category: str) -> str:
    return CATEGORY_META.get(category, {}).get("color", "#607090")

def get_category_icon(category: str) -> str:
    return CATEGORY_META.get(category, {}).get("icon", "●")

def get_all_categories() -> list[str]:
    return list(CATEGORY_META.keys())
