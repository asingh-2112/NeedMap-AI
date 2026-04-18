"""
Unit tests for app/ml/matching.py

Uses SimpleNamespace to fake Volunteer/Need ORM objects — no DB needed.
Run: pytest tests/unit/test_matching.py -v
"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

import pytest
from types import SimpleNamespace
from app.ml.matching import (
    score_volunteers_for_need,
    extract_skills_from_text,
    _skill_score,
    _geo_score,
    _reliability_score,
    _availability_score,
    ACTIVE_TASK_THRESHOLD,
    MAX_RATING,
    EXPERIENCED_TASK_COUNT,
    DEFAULT_RADIUS_KM,
    PROFICIENCY_WEIGHT,
)


# ── Helpers: build fake ORM objects ──────────────────────────────────────────

def make_skill(skill_name: str, proficiency: str = "beginner"):
    return SimpleNamespace(
        skill_name=skill_name,
        proficiency=SimpleNamespace(value=proficiency),
    )


def make_volunteer(
    id=1,
    skills=None,
    lat=None,
    lng=None,
    radius_km=None,
    rating=5.0,
    tasks_completed=10,
    verified=True,
    availability=True,
    active_tasks=0,
):
    user = SimpleNamespace(
        latitude=lat,
        longitude=lng,
        radius_km=radius_km,
    )
    return SimpleNamespace(
        id=id,
        user=user,
        skills=skills or [],
        rating=rating,
        tasks_completed=tasks_completed,
        verified=verified,
        availability=availability,
        active_tasks=active_tasks,
    )


def make_need(category="health", lat=28.6139, lng=77.2090):
    return SimpleNamespace(
        category=SimpleNamespace(value=category),
        latitude=lat,
        longitude=lng,
    )


# ── _skill_score ──────────────────────────────────────────────────────────────

class TestSkillScore:
    def test_expert_match(self):
        v = make_volunteer(skills=[make_skill("doctor", "expert")])
        assert _skill_score(v, "health") == pytest.approx(PROFICIENCY_WEIGHT["expert"])

    def test_intermediate_match(self):
        v = make_volunteer(skills=[make_skill("nurse", "intermediate")])
        assert _skill_score(v, "health") == pytest.approx(PROFICIENCY_WEIGHT["intermediate"])

    def test_beginner_match(self):
        v = make_volunteer(skills=[make_skill("first aid", "beginner")])
        assert _skill_score(v, "health") == pytest.approx(PROFICIENCY_WEIGHT["beginner"])

    def test_best_skill_wins(self):
        # has beginner medical and expert medical — expert should win
        v = make_volunteer(skills=[
            make_skill("nurse", "beginner"),
            make_skill("doctor", "expert"),
        ])
        assert _skill_score(v, "health") == pytest.approx(PROFICIENCY_WEIGHT["expert"])

    def test_no_matching_skill(self):
        v = make_volunteer(skills=[make_skill("tailoring", "expert")])
        assert _skill_score(v, "health") == 0.0

    def test_no_skills(self):
        v = make_volunteer(skills=[])
        assert _skill_score(v, "health") == 0.0

    def test_wrong_category_skill(self):
        v = make_volunteer(skills=[make_skill("cook", "expert")])
        assert _skill_score(v, "water_access") == 0.0

    def test_keyword_substring_match(self):
        # "medic" is a keyword for medical
        v = make_volunteer(skills=[make_skill("medic", "intermediate")])
        assert _skill_score(v, "health") > 0.0


# ── _geo_score ────────────────────────────────────────────────────────────────

class TestGeoScore:
    def test_same_location(self):
        score = _geo_score(28.6139, 77.2090, 28.6139, 77.2090, radius_km=50)
        assert score == pytest.approx(1.0)

    def test_beyond_radius_is_zero(self):
        # ~111 km away (roughly 1 degree latitude)
        score = _geo_score(28.0, 77.0, 29.0, 77.0, radius_km=50)
        assert score == 0.0

    def test_half_radius_approx_half_score(self):
        # ~25 km away at 50 km radius → score ≈ 0.5
        score = _geo_score(28.0, 77.0, 28.225, 77.0, radius_km=50)
        assert 0.4 < score < 0.6

    def test_no_location_returns_neutral(self):
        assert _geo_score(None, None, 28.6139, 77.2090, radius_km=50) == 0.5

    def test_only_lat_set_returns_neutral(self):
        assert _geo_score(28.6139, None, 28.6139, 77.2090, radius_km=50) == 0.5

    def test_fallback_radius_used_when_none(self):
        # should not crash, returns valid float
        score = _geo_score(28.0, 77.0, 28.1, 77.0, radius_km=None)
        assert 0.0 <= score <= 1.0

    def test_score_decreases_with_distance(self):
        s1 = _geo_score(28.0, 77.0, 28.1, 77.0, radius_km=50)
        s2 = _geo_score(28.0, 77.0, 28.3, 77.0, radius_km=50)
        assert s1 > s2


# ── _reliability_score ────────────────────────────────────────────────────────

class TestReliabilityScore:
    def test_perfect_reliability(self):
        v = make_volunteer(rating=5.0, tasks_completed=EXPERIENCED_TASK_COUNT, verified=True)
        assert _reliability_score(v) == pytest.approx(1.0)

    def test_zero_reliability(self):
        v = make_volunteer(rating=0.0, tasks_completed=0, verified=False)
        assert _reliability_score(v) == pytest.approx(0.0)

    def test_rating_dominates(self):
        # High rating, no tasks, not verified  vs  low rating, many tasks, verified
        high_rated = make_volunteer(rating=5.0, tasks_completed=0, verified=False)
        low_rated  = make_volunteer(rating=1.0, tasks_completed=100, verified=True)
        assert _reliability_score(high_rated) > _reliability_score(low_rated)

    def test_none_rating_treated_as_zero(self):
        v = make_volunteer(rating=None, tasks_completed=5, verified=False)
        score = _reliability_score(v)
        assert score >= 0.0

    def test_verified_adds_value(self):
        base = dict(rating=3.0, tasks_completed=10)
        unverified = make_volunteer(**base, verified=False)
        verified   = make_volunteer(**base, verified=True)
        assert _reliability_score(verified) > _reliability_score(unverified)

    def test_tasks_capped_at_experienced_threshold(self):
        v1 = make_volunteer(rating=3.0, tasks_completed=EXPERIENCED_TASK_COUNT, verified=False)
        v2 = make_volunteer(rating=3.0, tasks_completed=EXPERIENCED_TASK_COUNT * 10, verified=False)
        assert _reliability_score(v1) == pytest.approx(_reliability_score(v2))


# ── _availability_score ───────────────────────────────────────────────────────

class TestAvailabilityScore:
    def test_available_not_overloaded(self):
        v = make_volunteer(availability=True, active_tasks=0)
        assert _availability_score(v) == 1.0

    def test_unavailable(self):
        v = make_volunteer(availability=False, active_tasks=0)
        assert _availability_score(v) == 0.0

    def test_overloaded(self):
        v = make_volunteer(availability=True, active_tasks=ACTIVE_TASK_THRESHOLD)
        assert _availability_score(v) == 0.0

    def test_one_below_threshold_still_available(self):
        v = make_volunteer(availability=True, active_tasks=ACTIVE_TASK_THRESHOLD - 1)
        assert _availability_score(v) == 1.0


# ── score_volunteers_for_need (composite) ────────────────────────────────────

class TestScoreVolunteersForNeed:
    def test_returns_list_of_dicts(self):
        v = make_volunteer(id=1)
        need = make_need()
        results = score_volunteers_for_need([v], need)
        assert isinstance(results, list)
        assert len(results) == 1
        r = results[0]
        assert "volunteer_id" in r
        assert "composite_score" in r
        assert "skill_score" in r
        assert "geo_score" in r
        assert "reliability_score" in r
        assert "availability_score" in r

    def test_scores_in_range_0_to_100(self):
        volunteers = [make_volunteer(id=i) for i in range(5)]
        need = make_need()
        for r in score_volunteers_for_need(volunteers, need):
            assert 0.0 <= r["composite_score"] <= 100.0
            assert 0.0 <= r["skill_score"] <= 100.0
            assert 0.0 <= r["geo_score"] <= 100.0
            assert 0.0 <= r["reliability_score"] <= 100.0
            assert 0.0 <= r["availability_score"] <= 100.0

    def test_sorted_descending(self):
        # v1: expert medical, nearby; v2: no skills, far
        v1 = make_volunteer(id=1, skills=[make_skill("doctor", "expert")], lat=28.6, lng=77.2, radius_km=50)
        v2 = make_volunteer(id=2, skills=[], lat=0.0, lng=0.0, radius_km=50)
        need = make_need(category="health", lat=28.61, lng=77.21)
        results = score_volunteers_for_need([v2, v1], need)  # pass in wrong order
        assert results[0]["volunteer_id"] == 1  # expert+nearby wins

    def test_empty_volunteers_returns_empty(self):
        assert score_volunteers_for_need([], make_need()) == []

    def test_skill_match_raises_composite_above_no_skill(self):
        # Same geo/reliability/availability, one has matching skill
        base = dict(lat=28.6, lng=77.2, radius_km=50, rating=3.0, tasks_completed=5, verified=False)
        with_skill    = make_volunteer(id=1, skills=[make_skill("nurse", "expert")], **base)
        without_skill = make_volunteer(id=2, skills=[], **base)
        need = make_need(category="health", lat=28.61, lng=77.21)
        results = {r["volunteer_id"]: r for r in score_volunteers_for_need([with_skill, without_skill], need)}
        assert results[1]["composite_score"] > results[2]["composite_score"]

    def test_unavailable_volunteer_scores_lower(self):
        base = dict(lat=28.6, lng=77.2, radius_km=50, rating=5.0,
                    tasks_completed=20, verified=True,
                    skills=[make_skill("doctor", "expert")])
        available   = make_volunteer(id=1, availability=True,  active_tasks=0, **base)
        unavailable = make_volunteer(id=2, availability=False, active_tasks=0, **base)
        need = make_need(category="health", lat=28.61, lng=77.21)
        results = {r["volunteer_id"]: r for r in score_volunteers_for_need([available, unavailable], need)}
        assert results[1]["composite_score"] > results[2]["composite_score"]

    def test_category_string_fallback(self):
        # need.category without .value attribute — raw string
        need = SimpleNamespace(category="health", latitude=28.0, longitude=77.0)
        v = make_volunteer()
        results = score_volunteers_for_need([v], need)
        assert len(results) == 1  # didn't crash


# ── extract_skills_from_text ──────────────────────────────────────────────────

class TestExtractSkillsFromText:
    def test_nurse_extracts_medical(self):
        skills = extract_skills_from_text("I am a nurse and do first aid")
        assert "medical" in skills

    def test_teaching_keywords(self):
        skills = extract_skills_from_text("I teach maths and work as a tutor")
        assert "teaching" in skills

    def test_multiple_skills(self):
        skills = extract_skills_from_text("I am a nurse who does logistics and food prep")
        assert "medical" in skills
        assert "logistics" in skills
        assert "cooking" in skills

    def test_case_insensitive(self):
        skills = extract_skills_from_text("I AM A DOCTOR")
        assert "medical" in skills

    def test_empty_string(self):
        assert extract_skills_from_text("") == []

    def test_none_returns_empty(self):
        assert extract_skills_from_text(None) == []

    def test_no_keywords_returns_empty(self):
        assert extract_skills_from_text("I enjoy hiking and photography") == []

    def test_no_duplicate_canonical_skills(self):
        # "doctor nurse medic" — all map to "medical"
        skills = extract_skills_from_text("doctor nurse medic physician")
        assert skills.count("medical") == 1

    def test_plumbing_extraction(self):
        skills = extract_skills_from_text("I do plumbing and pipe repairs")
        assert "plumbing" in skills

    def test_legal_extraction(self):
        skills = extract_skills_from_text("I am a lawyer and work as an advocate")
        assert "legal" in skills

    def test_it_support_extraction(self):
        skills = extract_skills_from_text("I work as a software developer")
        assert "it_support" in skills

    def test_counseling_extraction(self):
        skills = extract_skills_from_text("I provide mental health counseling and therapy")
        assert "counseling" in skills
