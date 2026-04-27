"""
OCR pipeline — URL-based image text extraction using EasyOCR.

Accepts a publicly accessible image URL (Supabase Storage, S3, etc.).
EasyOCR's reader.readtext() accepts URLs directly — no download step needed.

GPU is controlled via the OCR_USE_GPU environment variable (default: true).
The EasyOCR Reader is expensive to initialise (~5-10 s, ~200 MB model load),
so it is kept as a module-level lazy singleton.
"""

import json
import os
import re

# ── EasyOCR lazy singleton ────────────────────────────────────────────────────

_reader = None


def _get_reader():
    global _reader
    if _reader is None:
        import easyocr
        use_gpu = os.getenv("OCR_USE_GPU", "true").lower() == "true"
        _reader = easyocr.Reader(["en"], gpu=use_gpu)
    return _reader


# ── Keyword tables for structured field extraction ────────────────────────────

# Maps NeedCategory values → synonyms to scan in OCR text
_CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "water_access":   ["water", "tap", "pipe", "well", "flood", "drinking", "plumb"],
    "food":           ["food", "hungry", "starvation", "meal", "nutrition", "ration", "feeding"],
    "shelter":        ["shelter", "homeless", "roof", "house", "accommodation", "dwelling", "tent"],
    "health":         ["health", "medical", "hospital", "sick", "disease", "injury", "medicine", "clinic"],
    "education":      ["school", "education", "learn", "student", "teacher", "class", "books"],
    "sanitation":     ["toilet", "sanitation", "sewage", "hygiene", "waste", "drain", "garbage"],
    "clothing":       ["clothes", "clothing", "blanket", "dress", "garment", "wear", "uniform"],
    "legal_aid":      ["legal", "law", "rights", "justice", "court", "police", "arrest"],
    "mental_health":  ["mental", "depression", "anxiety", "trauma", "stress", "suicide", "counseling"],
    "transportation": ["transport", "vehicle", "bus", "ambulance", "road", "travel", "stranded"],
}

# Signals urgency regardless of category
_URGENCY_KEYWORDS: list[str] = [
    "urgent", "critical", "emergency", "immediate", "dying",
    "no water", "no food", "no shelter", "crisis", "danger",
    "life-threatening", "severe", "acute", "desperate", "sos",
    "help", "asap", "today",
]

# Regex patterns for address detection (tries each in order, returns first match)
_ADDRESS_PATTERNS: list[str] = [
    r'(?:block|sector|street|road|village|town|district|area|colony|nagar|ward|plot|flat|floor)\s+[\w\d]+(?:\s*[,\-]\s*[\w\d\s]+){0,3}',
    r'\b\d+[,\s]+[\w\s]+(?:street|road|avenue|lane|colony|nagar|marg)\b',
]


# ── Internal helpers ──────────────────────────────────────────────────────────

def _extract_raw_text(image_url: str) -> str:
    """Run EasyOCR on an image URL and return concatenated detected text."""
    reader = _get_reader()
    results = reader.readtext(image_url, detail=0, paragraph=True)
    raw = " ".join(results).strip()
    if not raw:
        raise ValueError("No readable text found in image")
    return raw


def _detect_category(text: str) -> str | None:
    """Return the first NeedCategory value whose keywords appear in text."""
    for category, keywords in _CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if kw in text:
                return category
    return None


def _detect_urgency(text: str) -> str | None:
    """Return 'critical' if strong urgency signals found, 'high' for softer ones."""
    strong = ["dying", "life-threatening", "emergency", "critical", "sos", "no water", "no food", "no shelter"]
    soft   = ["urgent", "immediate", "crisis", "danger", "severe", "acute", "desperate", "asap", "today"]
    for kw in strong:
        if kw in text:
            return "critical"
    for kw in soft:
        if kw in text:
            return "high"
    return None


def _detect_address(text: str) -> str | None:
    """Return the first address-like string found via regex, or None."""
    for pattern in _ADDRESS_PATTERNS:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(0).strip()
    return None


def _parse_structured_fields(raw_text: str) -> dict:
    """
    Extract structured fields from raw OCR text.

    Returns:
    {
        "category_hint":  str | None,   — matched NeedCategory value
        "urgency_hint":   str | None,   — 'critical' | 'high' | None
        "address_hint":   str | None,   — first address-like string found
        "description":    str,          — first 450 chars of raw text
        "keywords_found": list[str],    — urgency keywords detected
    }
    """
    text_lower = raw_text.lower()
    keywords_found = [kw for kw in _URGENCY_KEYWORDS if kw in text_lower]

    return {
        "category_hint":  _detect_category(text_lower),
        "urgency_hint":   _detect_urgency(text_lower),
        "address_hint":   _detect_address(raw_text),
        "description":    raw_text[:450],
        "keywords_found": keywords_found,
    }


# ── Public entry point ────────────────────────────────────────────────────────

def run_ocr_pipeline(image_url: str) -> dict:
    """
    Full OCR pipeline: image URL → LLM-powered structured extraction.

    Flow:
      1. EasyOCR reads the image and returns raw text.
      2. Raw text is passed to extract_need_from_text (LLM via Portkey if
         configured, keyword-based fallback otherwise).
      3. Result is normalised to the response format expected by the OCR endpoint.

    Args:
        image_url: Publicly accessible image URL (JPEG, PNG, BMP, WEBP).

    Returns:
    {
        "multimedia_txt": str,   — raw OCR text, max 500 chars
        "ai_extraction":  str,   — JSON of structured fields, max 500 chars
        "structured":     dict,  — parsed fields for immediate use by the caller
    }

    Raises:
        ValueError: if the image URL yields no readable text.
    """
    from app.ml.llm_extraction import extract_need_from_text

    raw_text = _extract_raw_text(image_url)

    # LLM extraction (falls back to keywords if Portkey not configured)
    extracted = extract_need_from_text(raw_text)

    # Normalise to the structured dict format expected by the OCR response schema.
    # Keep the *_hint keys for backward compatibility with OCRExtractionResponse.
    structured = {
        "category_hint":   extracted["category"],
        "urgency_hint":    extracted["urgency"],
        "address_hint":    extracted["location"],
        "description":     extracted["description"],
        "skills_required": extracted["skills_required"],
        "affected_count":  extracted["affected_count"],
        "confidence":      extracted["confidence"],
        "model_used":      extracted["model_used"],
        # legacy keyword field — kept for compatibility but empty for LLM path
        "keywords_found":  [],
    }

    multimedia_txt = raw_text[:500]
    ai_extraction  = json.dumps(structured, ensure_ascii=False)[:500]

    return {
        "multimedia_txt": multimedia_txt,
        "ai_extraction":  ai_extraction,
        "structured":     structured,
    }
