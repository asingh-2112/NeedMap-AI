"""
End-to-end ML integration test suite.

Uses FastAPI TestClient + in-memory SQLite — NO live server or Supabase
connection required. Just run:

    pytest tests/e2e -v

The `client` fixture is provided by conftest.py (same directory).
Auth is handled by a module-scoped fixture that registers a fresh org+owner
against the in-memory DB.
"""

import uuid
from unittest.mock import patch

import pytest

# Module-level state shared across all test phases
state: dict = {}

# ── Mock LLM extraction result (used in Phases 3 & 5) ────────────────────────
_MOCK_LLM_EXTRACTED = {
    "category":       "water_access",
    "urgency":        "critical",
    "location":       "Block 4, Sector 12",
    "description":    "Families have had no clean water supply for two weeks.",
    "skills_required": ["plumbing", "logistics"],
    "affected_count": 50,
    "confidence":     0.92,
    "model_used":     "llm:claude-sonnet-4-6",
}

# ── Mock OCR result used in Phase 3 ──────────────────────────────────────────
_MOCK_OCR = {
    "multimedia_txt": "Water shortage block 4 urgent critical SOS",
    "ai_extraction":  '{"category_hint": "water_access", "urgency_hint": "critical", "address_hint": "Block 4"}',
    "structured": {
        "category_hint":  "water_access",
        "urgency_hint":   "critical",
        "address_hint":   "Block 4",
        "description":    "Water shortage block 4 urgent critical SOS",
        "keywords_found": ["urgent", "critical", "sos"],
    },
}


# ── Fixtures ──────────────────────────────────────────────────────────────────

# `client` is provided by tests/e2e/conftest.py — no definition needed here.


@pytest.fixture(scope="module")
def auth(client):
    """
    Register a fresh org + owner. Return Authorization headers.
    State populated: org_id, owner_headers.
    """
    suffix = uuid.uuid4().hex[:6]
    r = client.post("/organizations/register", json={
        "organization_name": f"TestOrg-{suffix}",
        "owner_name":        f"owner_{suffix}",
        "owner_email":       f"owner_{suffix}@example.com",
        "owner_password":    "Test@12345",
    })
    assert r.status_code == 201, f"Org register failed: {r.text}"

    data = r.json()
    state["org_id"] = data["organization"]["id"]
    headers = {"Authorization": f"Bearer {data['access_token']}"}
    state["owner_headers"] = headers
    return headers


# ── Helpers ───────────────────────────────────────────────────────────────────

def register_and_login(client, suffix: str, role: str = "volunteer") -> dict:
    """Register a new user and return their auth headers."""
    email = f"{role}_{suffix}@example.com"
    client.post("/auth/register", json={
        "user_name": f"{role}_{suffix}",
        "email":     email,
        "password":  "Test@12345",
        "role":      role,
    })
    r = client.post("/auth/login", json={"email": email, "password": "Test@12345"})
    assert r.status_code == 200, f"Login failed: {r.text}"
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 1 — Need Priority Scoring
# ═══════════════════════════════════════════════════════════════════════════════

class TestPriorityScoring:

    def test_create_need_auto_computes_priority(self, client, auth):
        """POST /needs → priority_score auto-computed on creation."""
        r = client.post("/needs", headers=auth, json={
            "title":           "Water shortage in Block 4",
            "description":     "Urgent: no water supply. Critical emergency. SOS.",
            "category":        "water_access",
            "urgency":         "critical",
            "organization_id": state["org_id"],
            "latitude":        28.6139,
            "longitude":       77.2090,
            "address":         "Block 4, Sector 12, New Delhi",
        })
        assert r.status_code == 201, r.text
        need = r.json()
        state["need_id"] = need["id"]

        assert need["priority_score"] is not None, "priority_score must be auto-computed"
        # critical(35) + water_access(25) + keywords urgent+critical+emergency+sos(10) = 70+
        assert need["priority_score"] > 70, (
            f"Expected > 70 for critical+water_access+keywords, got {need['priority_score']}"
        )
        state["priority_score_initial"] = need["priority_score"]
        print(f"\n  priority_score (critical+water_access+keywords): {need['priority_score']}")

    def test_patch_urgency_to_low_drops_score(self, client, auth):
        """PATCH urgency=low → priority_score must drop."""
        r = client.patch(f"/needs/{state['need_id']}", headers=auth, json={"urgency": "low"})
        assert r.status_code == 200, r.text
        updated = r.json()

        assert updated["priority_score"] < state["priority_score_initial"], (
            f"Score should drop: was {state['priority_score_initial']}, "
            f"now {updated['priority_score']}"
        )
        state["priority_score_after_low"] = updated["priority_score"]
        print(f"\n  priority_score after urgency=low: {updated['priority_score']}")

    def test_patch_unrelated_field_no_recompute(self, client, auth):
        """PATCH title only → priority_score unchanged (not in trigger fields)."""
        score_before = client.get(f"/needs/{state['need_id']}", headers=auth).json()["priority_score"]

        r = client.patch(f"/needs/{state['need_id']}", headers=auth, json={"title": "Updated title"})
        assert r.status_code == 200, r.text
        assert r.json()["priority_score"] == score_before, "Title-only patch must not recompute score"

    def test_manual_compute_priority_endpoint(self, client, auth):
        """POST /needs/{id}/compute-priority → score updates and returns."""
        # Restore urgency to critical first
        client.patch(f"/needs/{state['need_id']}", headers=auth, json={"urgency": "critical"})

        r = client.post(f"/needs/{state['need_id']}/compute-priority", headers=auth)
        assert r.status_code == 200, r.text
        score = r.json()["priority_score"]
        assert score is not None
        assert score > state["priority_score_after_low"], (
            f"After restoring critical, score {score} should exceed low score {state['priority_score_after_low']}"
        )
        print(f"\n  priority_score after manual recompute (critical restored): {score}")

    def test_low_priority_need_scores_low(self, client, auth):
        """low + transportation + no description → score < 25."""
        r = client.post("/needs", headers=auth, json={
            "title":           "Bus route improvement",
            "category":        "transportation",
            "urgency":         "low",
            "organization_id": state["org_id"],
            "latitude":        28.6200,
            "longitude":       77.2100,
            "address":         "Station Road, Delhi",
        })
        assert r.status_code == 201, r.text
        score = r.json()["priority_score"]
        assert score < 25, f"Expected < 25 for low+transportation, got {score}"
        print(f"\n  priority_score (low+transportation): {score}")


# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 2 — Volunteer Matching & Skill Extraction
# ═══════════════════════════════════════════════════════════════════════════════

class TestVolunteerMatchingAndSkillExtraction:

    def test_setup_health_need_for_matching(self, client, auth):
        """Create a health need — used for all Phase 2 matching tests."""
        r = client.post("/needs", headers=auth, json={
            "title":           "Medical emergency — clinic needs staff",
            "description":     "Urgent medical support needed. Patients are sick.",
            "category":        "health",
            "urgency":         "high",
            "organization_id": state["org_id"],
            "latitude":        28.6150,
            "longitude":       77.2095,
            "address":         "City Hospital, New Delhi",
        })
        assert r.status_code == 201, r.text
        state["health_need_id"] = r.json()["id"]

    def test_create_nurse_volunteer_extracts_medical_skill(self, client, auth):
        """POST /volunteers with bio containing nurse/first aid → medical skill auto-extracted."""
        vol_headers = register_and_login(client, uuid.uuid4().hex[:6], role="volunteer")

        r = client.post("/volunteers", headers=vol_headers, json={
            "organization_id": state["org_id"],
            "bio": "I am a nurse with experience in first aid and health worker duties",
        })
        assert r.status_code == 201, r.text
        vol = r.json()
        state["volunteer_id"] = vol["id"]

        skill_names = [s["skill_name"] for s in vol.get("skills", [])]
        assert "medical" in skill_names, (
            f"Expected 'medical' in auto-extracted skills, got {skill_names}"
        )
        print(f"\n  Nurse volunteer skills: {skill_names}")

    def test_create_chef_volunteer_extracts_cooking_skill(self, client, auth):
        """POST /volunteers with bio containing chef/cook → cooking skill auto-extracted."""
        vol_headers = register_and_login(client, uuid.uuid4().hex[:6], role="volunteer")

        r = client.post("/volunteers", headers=vol_headers, json={
            "organization_id": state["org_id"],
            "bio": "I am a chef with cooking and catering experience",
        })
        assert r.status_code == 201, r.text
        vol = r.json()
        state["volunteer_id_2"] = vol["id"]

        skill_names = [s["skill_name"] for s in vol.get("skills", [])]
        assert "cooking" in skill_names, (
            f"Expected 'cooking' in auto-extracted skills, got {skill_names}"
        )
        print(f"\n  Chef volunteer skills: {skill_names}")

    def test_suggest_volunteers_returns_sorted_list(self, client, auth):
        """GET /needs/{id}/suggest-volunteers → list, sorted desc by composite_score."""
        r = client.get(
            f"/needs/{state['health_need_id']}/suggest-volunteers",
            headers=auth,
            params={"limit": 50},
        )
        assert r.status_code == 200, r.text
        result = r.json()

        assert result["need_id"] == state["health_need_id"]
        volunteers = result["scored_volunteers"]
        assert len(volunteers) > 0, "Expected at least one volunteer"

        scores = [v["composite_score"] for v in volunteers]
        assert scores == sorted(scores, reverse=True), "Volunteers must be sorted desc"
        print(f"\n  Top volunteer score: {scores[0]}, count: {len(scores)}")

    def test_nurse_ranks_above_chef_for_health_need(self, client, auth):
        """Nurse (medical skill) should score >= chef for a health need."""
        r = client.get(
            f"/needs/{state['health_need_id']}/suggest-volunteers",
            headers=auth,
            params={"limit": 100},
        )
        assert r.status_code == 200, r.text
        scored = {v["volunteer_id"]: v for v in r.json()["scored_volunteers"]}

        if state.get("volunteer_id") in scored and state.get("volunteer_id_2") in scored:
            nurse_score = scored[state["volunteer_id"]]["composite_score"]
            chef_score  = scored[state["volunteer_id_2"]]["composite_score"]
            assert nurse_score >= chef_score, (
                f"Nurse {nurse_score} should >= chef {chef_score} for health need"
            )
            print(f"\n  Nurse score: {nurse_score}, Chef score: {chef_score}")
        else:
            pytest.skip("One or both volunteers not in scored list (possibly no location set)")

    def test_all_score_fields_in_range(self, client, auth):
        """All per-dimension scores must be 0–100."""
        r = client.get(
            f"/needs/{state['health_need_id']}/suggest-volunteers",
            headers=auth,
        )
        assert r.status_code == 200, r.text
        for v in r.json()["scored_volunteers"]:
            for field in ["composite_score", "skill_score", "geo_score",
                          "reliability_score", "availability_score"]:
                assert 0 <= v[field] <= 100, f"{field}={v[field]} out of [0,100]"

    def test_limit_param_respected(self, client, auth):
        """limit=1 → at most 1 volunteer returned."""
        r = client.get(
            f"/needs/{state['health_need_id']}/suggest-volunteers",
            headers=auth,
            params={"limit": 1},
        )
        assert r.status_code == 200, r.text
        assert len(r.json()["scored_volunteers"]) <= 1

    def test_verified_only_filter_does_not_error(self, client, auth):
        """verified_only=true → valid response (may be empty if none verified)."""
        r = client.get(
            f"/needs/{state['health_need_id']}/suggest-volunteers",
            headers=auth,
            params={"verified_only": True},
        )
        assert r.status_code == 200, r.text
        assert isinstance(r.json()["scored_volunteers"], list)


# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 3 — OCR Pipeline  (run_ocr_pipeline is mocked — no EasyOCR/GPU needed)
# ═══════════════════════════════════════════════════════════════════════════════

class TestOCRPipeline:

    def test_ocr_extract_without_need_id(self, client, auth):
        """POST /needs/ocr-extract without need_id → structured result, source_id=None."""
        with patch("app.api.needs.run_ocr_pipeline", return_value=_MOCK_OCR):
            r = client.post("/needs/ocr-extract", headers=auth,
                            json={"image_url": "https://example.com/test.png"})
        assert r.status_code == 200, r.text

        result = r.json()
        assert "multimedia_txt" in result
        assert "ai_extraction" in result
        assert "structured" in result
        assert result["source_id"] is None
        assert result["need_id"] is None
        print(f"\n  OCR multimedia_txt: {result['multimedia_txt'][:80]}")

    def test_ocr_extract_with_need_id_creates_source(self, client, auth):
        """POST /needs/ocr-extract with need_id → NeedSource created, source_id returned."""
        with patch("app.api.needs.run_ocr_pipeline", return_value=_MOCK_OCR):
            r = client.post("/needs/ocr-extract", headers=auth, json={
                "image_url": "https://example.com/test.png",
                "need_id":   state["need_id"],
            })
        assert r.status_code == 200, r.text

        result = r.json()
        assert result["source_id"] is not None, "source_id must be set when need_id provided"
        assert result["need_id"] == state["need_id"]
        state["ocr_source_id"] = result["source_id"]

    def test_ocr_source_appears_in_need_sources(self, client, auth):
        """GET /needs/{id}/sources → OCR-created source is listed."""
        r = client.get(f"/needs/{state['need_id']}/sources", headers=auth)
        assert r.status_code == 200, r.text
        ids = [s["id"] for s in r.json()]
        assert state["ocr_source_id"] in ids

    def test_ocr_source_has_multimedia_txt(self, client, auth):
        """NeedSource.multimedia_txt must be non-empty."""
        r = client.get(f"/needs/{state['need_id']}/sources", headers=auth)
        source = next(s for s in r.json() if s["id"] == state["ocr_source_id"])
        assert source["multimedia_txt"] is not None
        assert len(source["multimedia_txt"]) > 0

    def test_ocr_empty_url_returns_400(self, client, auth):
        """Blank image_url → 400."""
        r = client.post("/needs/ocr-extract", headers=auth, json={"image_url": "   "})
        assert r.status_code == 400

    def test_ocr_nonexistent_need_id_returns_404(self, client, auth):
        """Valid image URL + nonexistent need_id → 404."""
        with patch("app.api.needs.run_ocr_pipeline", return_value=_MOCK_OCR):
            r = client.post("/needs/ocr-extract", headers=auth, json={
                "image_url": "https://example.com/test.png",
                "need_id":   999999,
            })
        assert r.status_code == 404, r.text


# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 4 — Assignment match_score auto-population
# ═══════════════════════════════════════════════════════════════════════════════

class TestAssignmentMatchScore:

    def test_assignment_without_match_score_auto_computed(self, client, auth):
        """POST /assignments omitting match_score → it's computed and stored."""
        if "volunteer_id" not in state:
            pytest.skip("Nurse volunteer not created (Phase 2 failed)")

        r = client.post("/assignments", headers=auth, json={
            "need_id":         state["need_id"],
            "volunteer_id":    state["volunteer_id"],
            "organization_id": state["org_id"],
            # match_score intentionally omitted
        })
        assert r.status_code == 201, r.text
        a = r.json()
        state["assignment_id"] = a["id"]

        assert a["match_score"] is not None, "match_score must be auto-computed"
        assert 0 <= a["match_score"] <= 100
        print(f"\n  Auto-computed match_score: {a['match_score']}")

    def test_assignment_explicit_match_score_preserved(self, client, auth):
        """POST /assignments with explicit match_score=42.0 → value not overridden."""
        if "volunteer_id_2" not in state:
            pytest.skip("Chef volunteer not created (Phase 2 failed)")

        r = client.post("/assignments", headers=auth, json={
            "need_id":         state["need_id"],
            "volunteer_id":    state["volunteer_id_2"],
            "organization_id": state["org_id"],
            "match_score":     42.0,
        })
        assert r.status_code == 201, r.text
        assert r.json()["match_score"] == 42.0

    def test_match_score_persisted_on_fetch(self, client, auth):
        """GET /assignments/{id} → match_score survives round-trip."""
        if "assignment_id" not in state:
            pytest.skip("Assignment not created")
        r = client.get(f"/assignments/{state['assignment_id']}", headers=auth)
        assert r.status_code == 200, r.text
        assert r.json()["match_score"] is not None

    def test_status_lifecycle_proposed_to_completed(self, client, auth):
        """proposed → accepted → in_progress → completed."""
        if "assignment_id" not in state:
            pytest.skip("Assignment not created")
        aid = state["assignment_id"]

        for status_val in ("accepted", "in_progress", "completed"):
            r = client.patch(f"/assignments/{aid}/status", headers=auth,
                             json={"status": status_val})
            assert r.status_code == 200, f"Transition to {status_val} failed: {r.text}"
            assert r.json()["status"] == status_val

    def test_invalid_status_transition_rejected(self, client, auth):
        """completed → accepted is invalid → 422."""
        if "assignment_id" not in state:
            pytest.skip("Assignment not created")
        r = client.patch(f"/assignments/{state['assignment_id']}/status", headers=auth,
                         json={"status": "accepted"})
        assert r.status_code == 422, f"Expected 422, got {r.status_code}: {r.text}"


# ═══════════════════════════════════════════════════════════════════════════════
# PHASE 5 — LLM Ingest (text + voice)
# extract_need_from_text is mocked so no Portkey API key required
# ═══════════════════════════════════════════════════════════════════════════════

class TestLLMIngest:

    def test_text_ingest_extracts_and_creates_need(self, client, auth):
        """POST /needs/ingest/text → LLM extracts fields, Need created, need_id returned."""
        with patch("app.api.needs.extract_need_from_text", return_value=_MOCK_LLM_EXTRACTED):
            r = client.post("/needs/ingest/text", headers=auth, json={
                "raw_text":       "the families near the old bridge have no clean water since 2 weeks",
                "organization_id": state["org_id"],
                "latitude":       28.6139,
                "longitude":      77.2090,
                "address":        "Old Bridge area, Delhi",
                "create_need":    True,
            })
        assert r.status_code == 201, r.text
        body = r.json()

        assert body["category"]  == "water_access"
        assert body["urgency"]   == "critical"
        assert body["need_id"]   is not None,   "need_id must be set when create_need=true"
        assert body["source_id"] is not None,   "source_id must be set when create_need=true"
        assert body["confidence"] > 0
        assert "plumbing" in body["skills_required"]
        state["ingest_need_id"]   = body["need_id"]
        state["ingest_source_id"] = body["source_id"]
        print(f"\n  Text ingest need_id={body['need_id']}  confidence={body['confidence']}")

    def test_text_ingest_without_create_need_returns_extraction_only(self, client, auth):
        """POST /needs/ingest/text with create_need=false → extracted data, no need_id."""
        with patch("app.api.needs.extract_need_from_text", return_value=_MOCK_LLM_EXTRACTED):
            r = client.post("/needs/ingest/text", headers=auth, json={
                "raw_text":       "urgent: clinic has no medicine, patients are suffering",
                "organization_id": state["org_id"],
                "create_need":    False,
            })
        assert r.status_code == 201, r.text
        body = r.json()

        assert body["need_id"]   is None, "need_id should be None when create_need=false"
        assert body["source_id"] is None
        assert body["category"]  == "water_access"   # from mock
        assert body["model_used"] == "llm:claude-sonnet-4-6"

    def test_text_ingest_too_short_returns_422(self, client, auth):
        """raw_text < 10 chars → 422 validation error."""
        r = client.post("/needs/ingest/text", headers=auth, json={
            "raw_text":       "short",
            "organization_id": state["org_id"],
        })
        assert r.status_code == 422

    def test_text_ingest_need_appears_on_heatmap(self, client, auth):
        """Need created via ingest appears in GET /needs/heatmap."""
        if "ingest_need_id" not in state:
            pytest.skip("Ingest need not created")
        r = client.get("/needs/heatmap", headers=auth)
        assert r.status_code == 200, r.text
        ids = [n["id"] for n in r.json()]
        assert state["ingest_need_id"] in ids, "Ingested need must appear on heatmap"

    def test_text_ingest_source_stored_correctly(self, client, auth):
        """GET /needs/{id}/sources → source from text ingest has multimedia_txt set."""
        if "ingest_need_id" not in state:
            pytest.skip("Ingest need not created")
        r = client.get(f"/needs/{state['ingest_need_id']}/sources", headers=auth)
        assert r.status_code == 200, r.text
        sources = r.json()
        assert len(sources) > 0, "At least one source must exist"
        src = sources[0]
        assert src["multimedia_txt"] is not None
        assert len(src["multimedia_txt"]) > 0

    def test_voice_ingest_with_transcription(self, client, auth):
        """POST /needs/ingest/voice with transcription field → same flow as text ingest."""
        with patch("app.api.needs.extract_need_from_text", return_value=_MOCK_LLM_EXTRACTED):
            r = client.post("/needs/ingest/voice", headers=auth, json={
                "transcription":  "Field worker report: no water in Block 4, families affected",
                "organization_id": state["org_id"],
                "latitude":        28.6150,
                "longitude":       77.2095,
                "create_need":     True,
            })
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["need_id"]   is not None
        assert body["source_id"] is not None
        assert body["category"]  == "water_access"
        print(f"\n  Voice ingest (transcription) need_id={body['need_id']}")

    def test_voice_ingest_no_audio_no_transcription_returns_422(self, client, auth):
        """Neither audio_url nor transcription provided → 422."""
        r = client.post("/needs/ingest/voice", headers=auth, json={
            "organization_id": state["org_id"],
        })
        assert r.status_code == 422

    def test_voice_ingest_audio_url_no_api_key_returns_400(self, client, auth):
        """audio_url with no PORTKEY_API_KEY/OPENAI_API_KEY configured → 400."""
        # transcribe_audio_url raises ValueError when no key → endpoint returns 400
        with patch("app.api.needs.transcribe_audio_url",
                   side_effect=ValueError("No transcription API configured")):
            r = client.post("/needs/ingest/voice", headers=auth, json={
                "audio_url":       "https://example.com/field_report.mp3",
                "organization_id": state["org_id"],
            })
        assert r.status_code == 400
        assert "transcription API" in r.json()["detail"]

    def test_ingest_fallback_keyword_extraction(self, client, auth):
        """When PORTKEY_API_KEY not set, keyword fallback runs and still returns valid data."""
        # Simulate keyword_fallback result (confidence=0.35, model_used=keyword_fallback)
        fallback_result = {
            "category":       "health",
            "urgency":        "high",
            "location":       None,
            "description":    "Medical emergency at the clinic.",
            "skills_required": ["medical"],
            "affected_count": None,
            "confidence":     0.35,
            "model_used":     "keyword_fallback",
        }
        with patch("app.api.needs.extract_need_from_text", return_value=fallback_result):
            r = client.post("/needs/ingest/text", headers=auth, json={
                "raw_text":       "Medical emergency at the clinic, doctor needed urgently",
                "organization_id": state["org_id"],
                "create_need":    False,
            })
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["model_used"] == "keyword_fallback"
        assert body["confidence"] == 0.35
        assert body["category"]   == "health"
