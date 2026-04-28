"""
OCR pipeline — now a thin wrapper around the unified LLM vision extraction.

The old EasyOCR-based pipeline has been replaced with a single-stage approach
where the image is sent directly to the LLM's vision model.

This module is kept for backward compatibility with existing imports.
"""

import json

from app.ml.llm_extraction import extract_need_from_image

# Re-export detection helpers used by keyword fallback
from app.ml.llm_extraction import _detect_category, _detect_urgency, _detect_address  # noqa: F401


def run_ocr_pipeline(image_url: str) -> dict:
    """
    Full image → structured extraction pipeline (single-stage LLM vision).

    Args:
        image_url: Publicly accessible image URL (JPEG, PNG, BMP, WEBP).

    Returns:
    {
        "multimedia_txt": str,   — LLM-generated text description, max 500 chars
        "ai_extraction":  str,   — JSON of structured fields, max 500 chars
        "structured":     dict,  — parsed fields for immediate use
    }
    """
    extracted = extract_need_from_image(image_url)

    structured = {
        "category_hint":   extracted["category"],
        "urgency_hint":    extracted["urgency"],
        "address_hint":    extracted["location"],
        "description":     extracted["description"],
        "skills_required": extracted["skills_required"],
        "affected_count":  extracted["affected_count"],
        "confidence":      extracted["confidence"],
        "model_used":      extracted["model_used"],
        "keywords_found":  [],
    }

    multimedia_txt = extracted.get("multimedia_txt", extracted["description"])[:500]
    ai_extraction = json.dumps(structured, ensure_ascii=False)[:500]

    return {
        "multimedia_txt": multimedia_txt,
        "ai_extraction":  ai_extraction,
        "structured":     structured,
    }
