"""
Need priority scorer — rule-based, pure Python, no DB I/O.

All threshold constants are named so they can be tuned without touching logic.
"""

# ── Tunable constants ─────────────────────────────────────────────────────────

MAX_SOURCES_FOR_FULL_SCORE   = 5   # 5+ corroborating sources → full source component
KEYWORD_SATURATION_THRESHOLD = 3   # 3+ urgency keywords in description → full keyword component
GEO_DENSITY_SATURATION       = 10  # 10+ nearby open needs → full geo-density component
AGE_DECAY_DAYS               = 30  # 30 days unresolved → full age-decay component

# ── Scoring tables ────────────────────────────────────────────────────────────

URGENCY_SCORES: dict[str, float] = {
    "critical": 1.00,
    "high":     0.75,
    "medium":   0.50,
    "low":      0.25,
}

CATEGORY_SCORES: dict[str, float] = {
    "water_access":   1.00,
    "health":         1.00,
    "shelter":        0.90,
    "food":           0.85,
    "sanitation":     0.80,
    "mental_health":  0.70,
    "legal_aid":      0.65,
    "education":      0.60,
    "clothing":       0.55,
    "transportation": 0.40,
    "other":          0.35,
}

# Keywords that signal urgency — each matched once (no double-counting)
URGENCY_KEYWORDS: list[str] = [
    "urgent", "critical", "emergency", "immediate", "dying",
    "no water", "no food", "no shelter", "crisis", "danger",
    "life-threatening", "severe", "acute", "desperate", "sos",
]

# ── Component functions ───────────────────────────────────────────────────────

def _urgency_component(urgency: str) -> float:
    return URGENCY_SCORES.get(urgency.lower(), 0.50)


def _category_component(category: str) -> float:
    return CATEGORY_SCORES.get(category.lower(), 0.35)


def _source_count_component(source_count: int) -> float:
    return min(source_count / MAX_SOURCES_FOR_FULL_SCORE, 1.0)


def _keyword_density_component(description: str | None) -> float:
    if not description:
        return 0.0
    text = description.lower()
    matches = sum(1 for kw in URGENCY_KEYWORDS if kw in text)
    return min(matches / KEYWORD_SATURATION_THRESHOLD, 1.0)


def _geo_density_component(nearby_open_needs_count: int) -> float:
    """More clustered open needs → higher score (signals a hotspot / disaster zone)."""
    return min(nearby_open_needs_count / GEO_DENSITY_SATURATION, 1.0)


def _age_decay_component(days_since_created: int) -> float:
    """Needs that have gone unresolved longer get a higher urgency boost."""
    return min(days_since_created / AGE_DECAY_DAYS, 1.0)


# ── Public entry point ────────────────────────────────────────────────────────

def compute_priority_score(
    urgency: str,
    category: str,
    source_count: int,
    description: str | None,
    nearby_open_needs_count: int = 0,
    days_since_created: int = 0,
) -> float:
    """
    Compute a priority score in [0.0, 100.0] for a need.

    Weights
    -------
    urgency       35% — how severe the need is
    category      25% — how critical the need type is (water/health > transportation)
    source_count  10% — more corroborating sources = higher confidence
    keyword       10% — urgency signal words in the description
    geo_density   10% — cluster of open needs nearby = potential disaster zone
    age_decay     10% — longer unresolved = higher urgency boost

    All inputs are plain Python types so this function can be unit-tested
    without a database session.
    """
    weighted = (
        _urgency_component(urgency)              * 0.35
        + _category_component(category)          * 0.25
        + _source_count_component(source_count)  * 0.10
        + _keyword_density_component(description)* 0.10
        + _geo_density_component(nearby_open_needs_count) * 0.10
        + _age_decay_component(days_since_created)        * 0.10
    )
    return round(min(max(weighted * 100, 0.0), 100.0), 2)
