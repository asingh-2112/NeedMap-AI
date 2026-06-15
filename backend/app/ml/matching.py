"""
Volunteer–Need matching scorer + skill extraction from free text.

Both functions are pure Python with no DB I/O — callers are responsible
for fetching ORM objects with the required relationships loaded.
"""

# ── Tunable constants ─────────────────────────────────────────────────────────

ACTIVE_TASK_THRESHOLD  = 5    # active_tasks must be below this for full availability score
MAX_RATING             = 5.0  # rating column is out of 5
EXPERIENCED_TASK_COUNT = 20   # tasks_completed / 20, capped at 1.0 — defines "experienced"
DEFAULT_RADIUS_KM      = 50.0 # fallback when volunteer has no radius_km set

# Reliability sub-weights (must sum to 1.0)
RATING_WEIGHT   = 0.50  # peer-rated quality — the strongest single reliability signal
TASKS_WEIGHT    = 0.30  # experience; secondary to quality (100 tasks at 2★ < 5 tasks at 5★)
VERIFIED_WEIGHT = 0.20  # org-issued binary trust flag

# Proficiency → raw score
PROFICIENCY_WEIGHT: dict[str, float] = {
    "beginner":     0.40,
    "intermediate": 0.70,
    "expert":       1.00,
}

# ── Skill taxonomy ────────────────────────────────────────────────────────────
# canonical_skill_name → keywords to scan in free text (case-insensitive substring)

SKILL_TAXONOMY: dict[str, list[str]] = {
    "plumbing":     ["plumb", "pipe", "water repair", "water supply", "sanitation worker"],
    "medical":      ["doctor", "nurse", "medic", "first aid", "health worker", "paramedic", "emt", "physician", "pharmacist"],
    "teaching":     ["teach", "tutor", "education", "trainer", "instructor", "professor", "lecturer"],
    "construction": ["build", "construct", "carpentry", "civil engineer", "mason", "architect", "contractor", "welder"],
    "logistics":    ["logistics", "supply chain", "driver", "delivery", "transport", "dispatch", "warehouse"],
    "legal":        ["lawyer", "legal", "advocate", "paralegal", "law", "attorney", "barrister"],
    "counseling":   ["counsel", "psycholog", "therapy", "mental health", "psychiatr", "social work", "welfare"],
    "cooking":      ["cook", "chef", "food prep", "nutrition", "catering", "culinary", "baker"],
    "tailoring":    ["tailor", "sew", "stitch", "clothing", "garment", "fabric", "fashion"],
    "it_support":   ["it ", "computer", "software", "network", "tech support", "developer", "programmer", "sysadmin"],
    "management":   ["manage", "organiz", "coordinat", "admin", "project manage", "leadership", "supervisor"],
    "language":     ["translat", "interpret", "bilingual", "multilingual", "linguist"],
}

# need category → canonical skills that are relevant
CATEGORY_SKILL_MAP: dict[str, list[str]] = {
    "water_access":   ["plumbing", "construction", "management"],
    "food":           ["cooking", "logistics", "management"],
    "shelter":        ["construction", "logistics", "management"],
    "health":         ["medical", "counseling", "management"],
    "education":      ["teaching", "management", "language"],
    "sanitation":     ["plumbing", "construction", "management"],
    "clothing":       ["tailoring", "logistics", "management"],
    "legal_aid":      ["legal", "language", "management"],
    "mental_health":  ["counseling", "medical", "management"],
    "transportation": ["logistics", "management"],
    "other":          ["management"],
}


# ── Internal helpers (no DB, no side-effects) ─────────────────────────────────

def _relevant_keywords_for_category(need_category: str) -> set[str]:
    """Flatten all keywords for skills relevant to this need category."""
    canonical_skills = CATEGORY_SKILL_MAP.get(need_category, [])
    keywords: set[str] = set()
    for skill in canonical_skills:
        keywords.add(skill)
        keywords.update(SKILL_TAXONOMY.get(skill, []))
    return keywords


def _relevant_keywords_for_need(need_category: str, need_text: str = "") -> set[str]:
    keywords = _relevant_keywords_for_category(need_category)
    for skill in extract_skills_from_text(need_text):
        keywords.add(skill)
        keywords.update(SKILL_TAXONOMY.get(skill, []))
    return keywords


def _skill_score(volunteer, need_category: str, need_text: str = "") -> float:
    """
    Returns 0.0–1.0.
    Finds the best-matching skill the volunteer has for this need category or need text.
    Score = PROFICIENCY_WEIGHT of the best match; 0.0 if no match.
    """
    keywords = _relevant_keywords_for_need(need_category, need_text)
    if not keywords or not volunteer.skills:
        return 0.0

    best = 0.0
    for vs in volunteer.skills:
        skill_lower = vs.skill_name.lower()
        for kw in keywords:
            if kw in skill_lower:
                weight = PROFICIENCY_WEIGHT.get(vs.proficiency.value, 0.4)
                if weight > best:
                    best = weight
                break  # one keyword match per skill entry is enough
    return best


def _geo_score(vol_lat, vol_lng, need_lat: float, need_lng: float, radius_km) -> float:
    """
    Returns 0.0–1.0.
    Score = max(0, 1 - distance_km / effective_radius).
    Falls back to 0.5 (neutral) when the volunteer has no location set.
    """
    if vol_lat is None or vol_lng is None:
        return 0.5  # neutral — don't penalise volunteers who haven't set location

    effective_radius = radius_km if (radius_km and radius_km > 0) else DEFAULT_RADIUS_KM
    try:
        from geopy.distance import geodesic
        distance_km = geodesic((vol_lat, vol_lng), (need_lat, need_lng)).km
        return max(0.0, 1.0 - distance_km / effective_radius)
    except Exception:
        return 0.5


def _reliability_score(volunteer) -> float:
    """
    Returns 0.0–1.0.
    Composite of rating (50%), task experience (30%), verified status (20%).

    Why these weights:
      RATING 50%   — peer-rated quality is the strongest quality signal
      TASKS  30%   — experience matters but volume doesn't override quality
      VERIFIED 20% — org-issued trust badge, meaningful but not dominant
    """
    rating_comp   = (volunteer.rating or 0.0) / MAX_RATING
    tasks_comp    = min((volunteer.tasks_completed or 0) / EXPERIENCED_TASK_COUNT, 1.0)
    verified_comp = 1.0 if volunteer.verified else 0.0
    return (
        rating_comp   * RATING_WEIGHT
        + tasks_comp  * TASKS_WEIGHT
        + verified_comp * VERIFIED_WEIGHT
    )


def _availability_score(volunteer) -> float:
    """
    Returns 1.0 if the volunteer is available and not overloaded, else 0.0.
    Overloaded = active_tasks >= ACTIVE_TASK_THRESHOLD.
    """
    if volunteer.availability and (volunteer.active_tasks or 0) < ACTIVE_TASK_THRESHOLD:
        return 1.0
    return 0.0


# ── Public entry points ───────────────────────────────────────────────────────

def score_volunteers_for_need(volunteers, need) -> list[dict]:
    """
    Score each volunteer against a need and return a list sorted by
    composite_score descending.

    Precondition: each Volunteer in `volunteers` must have .user and .skills
    eagerly loaded (use list_volunteers_with_relations from volunteer_service).

    Weights:  skill 40%, geo 30%, reliability 20%, availability 10%

    Returns list of dicts:
    [
      {
        "volunteer_id":       int,
        "composite_score":    float (0.0–100.0),
        "skill_score":        float (0.0–100.0),
        "geo_score":          float (0.0–100.0),
        "reliability_score":  float (0.0–100.0),
        "availability_score": float (0.0–100.0),
      },
      ...
    ]
    """
    need_category = need.category.value if hasattr(need.category, "value") else str(need.category)
    need_text = " ".join(
        str(getattr(need, field, "") or "")
        for field in ("title", "description", "address", "city", "state")
    )

    results = []
    for v in volunteers:
        skill  = _skill_score(v, need_category, need_text)
        geo    = _geo_score(v.user.latitude, v.user.longitude, need.latitude, need.longitude, v.user.radius_km)
        rel    = _reliability_score(v)
        avail  = _availability_score(v)

        composite = skill * 0.40 + geo * 0.30 + rel * 0.20 + avail * 0.10

        results.append({
            "volunteer_id":       v.id,
            "composite_score":    round(min(max(composite * 100, 0.0), 100.0), 2),
            "skill_score":        round(skill  * 100, 2),
            "geo_score":          round(geo    * 100, 2),
            "reliability_score":  round(rel    * 100, 2),
            "availability_score": round(avail  * 100, 2),
        })

    return sorted(results, key=lambda x: x["composite_score"], reverse=True)


def extract_skills_from_text(description: str) -> list[str]:
    """
    Scan free text (case-insensitive) for SKILL_TAXONOMY keywords.
    Returns a list of matched canonical skill names.

    Example:
      "I am a nurse and do first aid" → ["medical"]
      "I teach maths and do logistics" → ["teaching", "logistics"]
    """
    if not description:
        return []

    text = description.lower()
    matched: list[str] = []

    for canonical, keywords in SKILL_TAXONOMY.items():
        for kw in keywords:
            if kw in text:
                matched.append(canonical)
                break  # one keyword hit per canonical skill is enough

    return matched
