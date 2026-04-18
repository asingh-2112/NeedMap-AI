"""
Unit tests for app/ml/ocr.py — structured field extraction only.

EasyOCR's _get_reader() and _extract_raw_text() are NOT tested here because
they require the PyTorch model (~200 MB) to be installed.
We test everything downstream of raw text:
  _detect_category, _detect_urgency, _detect_address, _parse_structured_fields.

Run: pytest tests/unit/test_ocr_structured.py -v
"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

# Patch easyocr before importing ocr module so the import doesn't fail in
# environments where easyocr/PyTorch is not installed.
from unittest.mock import MagicMock
sys.modules.setdefault("easyocr", MagicMock())

import pytest
from app.ml.ocr import (
    _detect_category,
    _detect_urgency,
    _detect_address,
    _parse_structured_fields,
    run_ocr_pipeline,
    _CATEGORY_KEYWORDS,
    _URGENCY_KEYWORDS,
)


# ── _detect_category ──────────────────────────────────────────────────────────

class TestDetectCategory:
    def test_water_keyword(self):
        assert _detect_category("the water supply is cut off") == "water_access"

    def test_food_keyword(self):
        assert _detect_category("people are hungry and facing starvation") == "food"

    def test_shelter_keyword(self):
        assert _detect_category("families are homeless with no roof over their heads") == "shelter"

    def test_health_keyword(self):
        assert _detect_category("medical emergency at the hospital") == "health"

    def test_education_keyword(self):
        assert _detect_category("school is closed and students have no books") == "education"

    def test_sanitation_keyword(self):
        assert _detect_category("no working toilet or sewage system") == "sanitation"

    def test_clothing_keyword(self):
        assert _detect_category("people need warm clothes and blankets") == "clothing"

    def test_legal_keyword(self):
        assert _detect_category("legal aid required for court hearing") == "legal_aid"

    def test_mental_health_keyword(self):
        assert _detect_category("trauma and depression support needed") == "mental_health"

    def test_transportation_keyword(self):
        assert _detect_category("ambulance required, stranded with no transport") == "transportation"

    def test_no_match_returns_none(self):
        assert _detect_category("the weather is nice today") is None

    def test_case_insensitive(self):
        assert _detect_category("WATER SUPPLY NEEDED") == "water_access"

    def test_first_match_wins(self):
        # text contains both water and food — whichever category iterates first wins
        result = _detect_category("water and food shortage")
        assert result in _CATEGORY_KEYWORDS  # just assert it's a valid category


# ── _detect_urgency ───────────────────────────────────────────────────────────

class TestDetectUrgency:
    def test_critical_tier(self):
        assert _detect_urgency("patient is dying and it is life-threatening") == "critical"

    def test_critical_sos(self):
        assert _detect_urgency("SOS emergency") == "critical"

    def test_critical_no_water(self):
        assert _detect_urgency("no water for 3 days") == "critical"

    def test_critical_no_food(self):
        assert _detect_urgency("no food available") == "critical"

    def test_high_tier_urgent(self):
        assert _detect_urgency("this is urgent help needed asap") == "high"

    def test_high_tier_crisis(self):
        assert _detect_urgency("crisis situation in the area") == "high"

    def test_high_tier_desperate(self):
        assert _detect_urgency("we are desperate for support") == "high"

    def test_critical_trumps_high(self):
        # Text has both — critical should win (checked first)
        result = _detect_urgency("dying and also urgent")
        assert result == "critical"

    def test_no_urgency_keywords(self):
        assert _detect_urgency("please help with the community garden") is None

    def test_case_insensitive(self):
        assert _detect_urgency("DYING PATIENT") == "critical"


# ── _detect_address ───────────────────────────────────────────────────────────

class TestDetectAddress:
    def test_block_sector_pattern(self):
        text = "Emergency at Block 4, Sector 12, New Delhi"
        result = _detect_address(text)
        assert result is not None
        assert "block" in result.lower() or "Block" in result

    def test_street_pattern(self):
        text = "123, Main Street, Andheri"
        result = _detect_address(text)
        assert result is not None

    def test_village_pattern(self):
        text = "Village Ramnagar, District Varanasi"
        result = _detect_address(text)
        assert result is not None

    def test_no_address_returns_none(self):
        text = "urgent help needed now"
        assert _detect_address(text) is None

    def test_result_is_stripped(self):
        text = "road 15, nearby market"
        result = _detect_address(text)
        if result:
            assert result == result.strip()


# ── _parse_structured_fields ──────────────────────────────────────────────────

class TestParseStructuredFields:
    def test_returns_all_keys(self):
        fields = _parse_structured_fields("urgent water shortage")
        assert "category_hint" in fields
        assert "urgency_hint" in fields
        assert "address_hint" in fields
        assert "description" in fields
        assert "keywords_found" in fields

    def test_description_truncated_to_450(self):
        long_text = "a" * 1000
        fields = _parse_structured_fields(long_text)
        assert len(fields["description"]) <= 450

    def test_keywords_found_is_list(self):
        fields = _parse_structured_fields("urgent critical emergency")
        assert isinstance(fields["keywords_found"], list)

    def test_multiple_urgency_keywords_all_listed(self):
        fields = _parse_structured_fields("urgent critical emergency sos")
        for kw in ["urgent", "critical", "emergency", "sos"]:
            assert kw in fields["keywords_found"]

    def test_full_parse_with_rich_text(self):
        text = (
            "URGENT: no water supply at Block 5, Sector 3. "
            "Patients are dying. Medical emergency. SOS."
        )
        fields = _parse_structured_fields(text)
        assert fields["category_hint"] in ("water_access", "health")  # water seen first
        assert fields["urgency_hint"] == "critical"
        assert fields["address_hint"] is not None
        assert len(fields["keywords_found"]) >= 3

    def test_empty_text_no_crash(self):
        # Caller should raise before calling this, but test defensive behavior
        fields = _parse_structured_fields("   ")
        assert fields["category_hint"] is None
        assert fields["urgency_hint"] is None
        assert fields["keywords_found"] == []


# ── run_ocr_pipeline (with mocked reader) ────────────────────────────────────

class TestRunOcrPipelineWithMock:
    """
    Tests run_ocr_pipeline end-to-end by mocking _get_reader so no model load.
    Validates the output contract (keys, length limits, JSON serialisability).
    """

    def _patch_reader(self, monkeypatch, ocr_text: str):
        import app.ml.ocr as ocr_module

        mock_reader = MagicMock()
        mock_reader.readtext.return_value = ocr_text.split(" ")
        monkeypatch.setattr(ocr_module, "_reader", mock_reader)

    def test_output_keys_present(self, monkeypatch):
        self._patch_reader(monkeypatch, "urgent water shortage at Block 4")
        from app.ml.ocr import run_ocr_pipeline
        result = run_ocr_pipeline("https://example.com/image.jpg")
        assert "multimedia_txt" in result
        assert "ai_extraction" in result
        assert "structured" in result

    def test_multimedia_txt_max_500(self, monkeypatch):
        self._patch_reader(monkeypatch, "word " * 300)
        from app.ml.ocr import run_ocr_pipeline
        result = run_ocr_pipeline("https://example.com/image.jpg")
        assert len(result["multimedia_txt"]) <= 500

    def test_ai_extraction_max_500(self, monkeypatch):
        self._patch_reader(monkeypatch, "urgent water shortage at Block 4 Sector 12")
        from app.ml.ocr import run_ocr_pipeline
        result = run_ocr_pipeline("https://example.com/image.jpg")
        assert len(result["ai_extraction"]) <= 500

    def test_ai_extraction_is_valid_json(self, monkeypatch):
        import json
        self._patch_reader(monkeypatch, "urgent water shortage")
        from app.ml.ocr import run_ocr_pipeline
        result = run_ocr_pipeline("https://example.com/image.jpg")
        parsed = json.loads(result["ai_extraction"])
        assert isinstance(parsed, dict)

    def test_raises_value_error_on_empty_text(self, monkeypatch):
        import app.ml.ocr as ocr_module

        mock_reader = MagicMock()
        mock_reader.readtext.return_value = []  # empty — no text detected
        monkeypatch.setattr(ocr_module, "_reader", mock_reader)

        from app.ml.ocr import run_ocr_pipeline
        with pytest.raises(ValueError, match="No readable text"):
            run_ocr_pipeline("https://example.com/blank.jpg")

    def test_category_hint_surfaced(self, monkeypatch):
        self._patch_reader(monkeypatch, "patients are dying medical emergency hospital")
        from app.ml.ocr import run_ocr_pipeline
        result = run_ocr_pipeline("https://example.com/image.jpg")
        assert result["structured"]["category_hint"] == "health"

    def test_urgency_hint_surfaced(self, monkeypatch):
        self._patch_reader(monkeypatch, "no water for days SOS please help")
        from app.ml.ocr import run_ocr_pipeline
        result = run_ocr_pipeline("https://example.com/image.jpg")
        assert result["structured"]["urgency_hint"] == "critical"
