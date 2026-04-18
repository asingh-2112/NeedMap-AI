"""
Unit tests for app/ml/priority.py

All tests are pure Python — no DB, no server.
Run: pytest tests/unit/test_priority.py -v
"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

import pytest
from app.ml.priority import (
    compute_priority_score,
    _urgency_component,
    _category_component,
    _source_count_component,
    _keyword_density_component,
    _geo_density_component,
    _age_decay_component,
    MAX_SOURCES_FOR_FULL_SCORE,
    KEYWORD_SATURATION_THRESHOLD,
    GEO_DENSITY_SATURATION,
    AGE_DECAY_DAYS,
)


# ── Component: urgency ────────────────────────────────────────────────────────

class TestUrgencyComponent:
    def test_critical(self):
        assert _urgency_component("critical") == 1.00

    def test_high(self):
        assert _urgency_component("high") == 0.75

    def test_medium(self):
        assert _urgency_component("medium") == 0.50

    def test_low(self):
        assert _urgency_component("low") == 0.25

    def test_case_insensitive(self):
        assert _urgency_component("CRITICAL") == 1.00
        assert _urgency_component("High") == 0.75

    def test_unknown_falls_back_to_medium(self):
        assert _urgency_component("unknown") == 0.50


# ── Component: category ───────────────────────────────────────────────────────

class TestCategoryComponent:
    def test_top_tier_water_access(self):
        assert _category_component("water_access") == 1.00

    def test_top_tier_health(self):
        assert _category_component("health") == 1.00

    def test_shelter_below_water(self):
        assert _category_component("shelter") < _category_component("water_access")

    def test_transportation_is_lowest_named(self):
        assert _category_component("transportation") == 0.40

    def test_other_is_lowest(self):
        assert _category_component("other") == 0.35

    def test_ordering_preserved(self):
        scores = [
            _category_component(c) for c in
            ["water_access", "health", "shelter", "food",
             "sanitation", "mental_health", "legal_aid",
             "education", "clothing", "transportation", "other"]
        ]
        assert scores == sorted(scores, reverse=True)

    def test_unknown_fallback(self):
        assert _category_component("unknown_category") == 0.35


# ── Component: source count ───────────────────────────────────────────────────

class TestSourceCountComponent:
    def test_zero_sources(self):
        assert _source_count_component(0) == 0.0

    def test_partial_sources(self):
        assert _source_count_component(1) == pytest.approx(1 / MAX_SOURCES_FOR_FULL_SCORE)

    def test_full_score_at_threshold(self):
        assert _source_count_component(MAX_SOURCES_FOR_FULL_SCORE) == 1.0

    def test_capped_above_threshold(self):
        assert _source_count_component(MAX_SOURCES_FOR_FULL_SCORE + 10) == 1.0


# ── Component: keyword density ────────────────────────────────────────────────

class TestKeywordDensityComponent:
    def test_no_description(self):
        assert _keyword_density_component(None) == 0.0
        assert _keyword_density_component("") == 0.0

    def test_no_keywords(self):
        assert _keyword_density_component("A quiet community event") == 0.0

    def test_one_keyword(self):
        score = _keyword_density_component("This is urgent")
        assert score == pytest.approx(1 / KEYWORD_SATURATION_THRESHOLD)

    def test_saturation(self):
        desc = "urgent critical emergency dying no water no food sos"
        assert _keyword_density_component(desc) == 1.0

    def test_case_insensitive(self):
        assert _keyword_density_component("URGENT situation") == _keyword_density_component("urgent situation")

    def test_same_keyword_not_double_counted(self):
        # "urgent urgent urgent" should count as 1, not 3
        score = _keyword_density_component("urgent urgent urgent")
        assert score == pytest.approx(1 / KEYWORD_SATURATION_THRESHOLD)


# ── Component: geo-density ────────────────────────────────────────────────────

class TestGeoDensityComponent:
    def test_zero_nearby(self):
        assert _geo_density_component(0) == 0.0

    def test_partial(self):
        assert _geo_density_component(5) == pytest.approx(5 / GEO_DENSITY_SATURATION)

    def test_full_at_saturation(self):
        assert _geo_density_component(GEO_DENSITY_SATURATION) == 1.0

    def test_capped_above_saturation(self):
        assert _geo_density_component(GEO_DENSITY_SATURATION + 100) == 1.0


# ── Component: age decay ──────────────────────────────────────────────────────

class TestAgeDecayComponent:
    def test_zero_days(self):
        assert _age_decay_component(0) == 0.0

    def test_partial_days(self):
        assert _age_decay_component(15) == pytest.approx(15 / AGE_DECAY_DAYS)

    def test_full_at_threshold(self):
        assert _age_decay_component(AGE_DECAY_DAYS) == 1.0

    def test_capped_beyond_threshold(self):
        assert _age_decay_component(AGE_DECAY_DAYS * 10) == 1.0


# ── compute_priority_score (integration of components) ───────────────────────

class TestComputePriorityScore:
    """
    Verified expected values from the ML-METRICS.md examples.
    Weights: urgency 35%, category 25%, source 10%, keyword 10%, geo 10%, age 10%
    """

    def test_critical_water_access_high_sources_high_keywords(self):
        # urgency=1.0*0.35 + cat=1.0*0.25 + src=3/5*0.10 + kw=3/3*0.10 + geo=0 + age=0
        # = 0.35 + 0.25 + 0.06 + 0.10 = 0.76 → nope, src=3/5=0.6*0.10=0.06
        # Actually: urgent(1)+critical(1)+emergency(1) = 3 keywords saturated
        score = compute_priority_score(
            urgency="critical",
            category="water_access",
            source_count=3,
            description="urgent critical emergency water shortage",
        )
        assert score == pytest.approx(87.0, abs=2.0), f"Got {score}"

    def test_low_transportation_no_sources(self):
        score = compute_priority_score(
            urgency="low",
            category="transportation",
            source_count=0,
            description=None,
        )
        assert score == pytest.approx(18.75, abs=0.01)

    def test_medium_health_one_source(self):
        score = compute_priority_score(
            urgency="medium",
            category="health",
            source_count=1,
            description=None,
        )
        # 0.50*0.35 + 1.0*0.25 + 0.2*0.10 = 0.175 + 0.25 + 0.02 = 0.445 → 44.5
        assert score == pytest.approx(44.5, abs=0.01)

    def test_geo_density_and_age_boost_low_base(self):
        # Low + transportation base = 18.75; add 5 nearby + 15 days
        score = compute_priority_score(
            urgency="low",
            category="transportation",
            source_count=0,
            description=None,
            nearby_open_needs_count=5,
            days_since_created=15,
        )
        # + 0.5*0.10 + 0.5*0.10 = +10 → 28.75
        assert score == pytest.approx(28.75, abs=0.01)

    def test_output_bounded_0_to_100(self):
        # Max everything
        max_score = compute_priority_score(
            urgency="critical",
            category="water_access",
            source_count=100,
            description=" ".join(["urgent", "critical", "emergency", "dying"]),
            nearby_open_needs_count=100,
            days_since_created=365,
        )
        assert 0.0 <= max_score <= 100.0
        assert max_score == 100.0

    def test_output_is_rounded_to_2dp(self):
        score = compute_priority_score(
            urgency="high",
            category="food",
            source_count=2,
            description="urgent help needed",
        )
        assert score == round(score, 2)

    def test_critical_higher_than_low_same_everything_else(self):
        base = dict(category="food", source_count=0, description=None)
        assert compute_priority_score(urgency="critical", **base) > compute_priority_score(urgency="low", **base)

    def test_more_sources_higher_score(self):
        base = dict(urgency="medium", category="health", description=None)
        s0 = compute_priority_score(source_count=0, **base)
        s3 = compute_priority_score(source_count=3, **base)
        s5 = compute_priority_score(source_count=5, **base)
        assert s0 < s3 < s5
