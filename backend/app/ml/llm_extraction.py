"""
Unified multimodal LLM extraction — single-stage pipeline.

All multimedia (text, images, audio, PDF) are sent **directly** to the LLM
via its multimodal / vision capabilities.  No intermediate EasyOCR, Whisper,
or PyPDF pre-processing step.

Supported input types
─────────────────────
• raw text          → text message
• image URL         → vision (image_url content part)
• image bytes/b64   → vision (base64 data-uri)
• audio URL         → downloaded → Whisper transcription → text to LLM
• PDF URL / bytes   → pages rendered to images → vision

Uses Portkey gateway (PORTKEY_API_KEY + LLM_MODEL) to route to any
multimodal model (Claude 3.5/4, GPT-4o, Gemini 1.5/2, etc.).

Falls back to a rule-based keyword extractor when no API key is set.

Public API
──────────
extract_need_from_text(raw_text)                         -> dict
extract_need_from_image(image_url)                       -> dict
extract_need_from_audio(audio_url=, transcription=)      -> dict
extract_need_from_pdf(pdf_url=, pdf_bytes=)              -> dict
"""

import base64
import json
import logging
import os
import re
import tempfile
import urllib.request
import uuid
from datetime import datetime

logger = logging.getLogger(__name__)

# ── Prompt template (shared across all modalities) ────────────────────────────
_SYSTEM_PROMPT = (
    "You are a precise structured-data extractor for community disaster-relief "
    "needs. You can understand text, images, audio transcriptions, and scanned "
    "documents. Always respond with valid JSON only. No prose, no markdown."
)

_EXTRACTION_PROMPT = """\
Extract community need information from the input provided. Reply with ONLY a JSON object — no prose, no markdown fences.

JSON schema (all fields required):
{{
"category":"<water_access|food|shelter|health|education|sanitation|clothing|legal_aid|mental_health|transportation|other>",
"urgency":"<critical|high|medium|low>",
"location":<"area/address" or null>,
"description":"<max 150 chars>",
"skills_required":["skill1"],
"affected_count":<int or null>,
"confidence":<0.0-1.0>
}}

Urgency: critical=life-threatening, high=serious, medium=can wait days, low=minor.
Skills examples: medical, plumbing, construction, logistics, cooking, teaching, counseling, legal.
"""

_TEXT_PREFIX = "Text:\n{raw_text}\n\n" + _EXTRACTION_PROMPT

_IMAGE_SUFFIX = (
    "The image above is from a disaster-relief field report, complaint form, "
    "WhatsApp screenshot, notice board, or similar. "
    "Read ALL text and visual cues in the image.\n\n" + _EXTRACTION_PROMPT
)

_PDF_SUFFIX = (
    "The images above are pages from a scanned document, field report, or "
    "official form. Read ALL text and visual cues across all pages.\n\n"
    + _EXTRACTION_PROMPT
)

# ── Validated enum values ─────────────────────────────────────────────────────
_VALID_CATEGORIES = {
    "water_access", "food", "shelter", "health", "education",
    "sanitation", "clothing", "legal_aid", "mental_health", "transportation", "other",
}
_VALID_URGENCIES = {"critical", "high", "medium", "low"}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _sanitise(extracted: dict) -> dict:
    """Ensure LLM output conforms to our enum values."""
    category = extracted.get("category", "other")
    if category not in _VALID_CATEGORIES:
        category = "other"

    urgency = extracted.get("urgency", "medium")
    if urgency not in _VALID_URGENCIES:
        urgency = "medium"

    skills = extracted.get("skills_required") or []
    if not isinstance(skills, list):
        skills = [str(skills)]
    skills = [str(s).lower().strip() for s in skills if s]

    affected = extracted.get("affected_count")
    if affected is not None:
        try:
            affected = int(affected)
        except (TypeError, ValueError):
            affected = None

    confidence = float(extracted.get("confidence") or 0.7)
    confidence = max(0.0, min(1.0, confidence))

    # Auto-fill skills from category if LLM returned none
    if not skills:
        from app.ml.matching import CATEGORY_SKILL_MAP
        skills = CATEGORY_SKILL_MAP.get(category, ["management"])

    return {
        "category": category,
        "urgency": urgency,
        "location": extracted.get("location"),
        "description": str(extracted.get("description") or "").strip()
                       or "No description extracted.",
        "skills_required": skills,
        "affected_count": affected,
        "confidence": confidence,
    }


def _parse_llm_response(content: str) -> dict:
    """Parse LLM response to JSON, handling fences, prose, truncation."""
    content = content.strip()

    if content.startswith("```"):
        parts = content.split("```")
        inner = parts[1]
        if inner.startswith("json"):
            inner = inner[4:]
        content = inner.strip()

    if not content.startswith("{"):
        start = content.find("{")
        if start != -1:
            content = content[start:]

    last_brace = content.rfind("}")
    if last_brace != -1:
        content = content[: last_brace + 1]

    try:
        return json.loads(content)
    except json.JSONDecodeError:
        pass

    repaired = _repair_truncated_json(content)
    return json.loads(repaired)


def _repair_truncated_json(s: str) -> str:
    """Best-effort repair for truncated JSON from a token-capped LLM."""
    in_string = False
    escape_next = False
    stack: list[str] = []

    for ch in s:
        if escape_next:
            escape_next = False
            continue
        if ch == "\\" and in_string:
            escape_next = True
            continue
        if ch == '"':
            in_string = not in_string
            continue
        if in_string:
            continue
        if ch in ("{", "["):
            stack.append(ch)
        elif ch in ("}", "]"):
            if stack:
                stack.pop()

    if in_string:
        s += '"'

    s = re.sub(r",\s*$", "", s.rstrip())

    closing = {"{": "}", "[": "]"}
    for opener in reversed(stack):
        s += closing[opener]

    return s


def _get_portkey_client():
    """Return (client, model, trace_id) or (None, None, None) if not configured."""
    from openai import OpenAI

    portkey_api_key = os.getenv("PORTKEY_API_KEY")
    if not portkey_api_key:
        return None, None, None

    llm_model = os.getenv("LLM_MODEL", "claude-sonnet-4-6")
    trace_id = str(uuid.uuid4())
    request_id = str(uuid.uuid4())
    timestamp = datetime.utcnow().isoformat() + "Z"

    portkey_headers = {
        "x-portkey-api-key": portkey_api_key,
        "x-portkey-trace-id": trace_id,
        "x-portkey-request-id": request_id,
        "x-portkey-span-name": "llm.multimodal_extraction",
        "x-portkey-metadata": (
            f"operation=need_extraction,model={llm_model},timestamp={timestamp}"
        ),
    }

    client = OpenAI(
        api_key=portkey_api_key,
        base_url="https://api.portkey.ai/v1",
        default_headers=portkey_headers,
    )
    return client, llm_model, trace_id


def _call_llm(messages: list[dict], trace_id: str = "") -> dict:
    """
    Send messages to LLM via Portkey and return sanitised extraction dict.
    Raises on failure so callers can fall back.
    """
    client, llm_model, tid = _get_portkey_client()
    if client is None:
        raise RuntimeError("PORTKEY_API_KEY not configured")

    trace_id = trace_id or tid
    logger.info("🔄 LLM extraction started | trace_id=%s | model=%s", trace_id, llm_model)

    response = client.chat.completions.create(
        model=llm_model,
        messages=messages,
        max_tokens=1024,
        temperature=0.1,
    )

    content = response.choices[0].message.content
    logger.debug("LLM raw response: %r", content)

    try:
        raw_dict = _parse_llm_response(content)
    except (json.JSONDecodeError, Exception) as exc:
        logger.error("❌ JSON parse failed. content=%r error=%s", content, exc)
        raise

    logger.info(
        "✅ LLM extraction OK | trace_id=%s | category=%s | urgency=%s",
        trace_id, raw_dict.get("category"), raw_dict.get("urgency"),
    )
    return _sanitise(raw_dict)


def _download_to_tempfile(url: str, suffix: str = "") -> str:
    """Download a URL to a temp file and return the path."""
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp_path = tmp.name
    urllib.request.urlretrieve(url, tmp_path)  # noqa: S310
    return tmp_path


def _url_to_base64(url: str, media_type: str = "image/jpeg") -> str:
    """Download a URL and return a base64 data URI."""
    tmp_path = _download_to_tempfile(url)
    try:
        with open(tmp_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode("utf-8")
        return f"data:{media_type};base64,{b64}"
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


def _guess_image_media_type(url: str) -> str:
    """Guess MIME type from image URL extension."""
    lower = url.lower().split("?")[0]
    if lower.endswith(".png"):
        return "image/png"
    if lower.endswith(".webp"):
        return "image/webp"
    if lower.endswith(".gif"):
        return "image/gif"
    return "image/jpeg"


# ── Rule-based fallback (no API key needed) ───────────────────────────────────

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

_URGENCY_KEYWORDS: list[str] = [
    "urgent", "critical", "emergency", "immediate", "dying",
    "no water", "no food", "no shelter", "crisis", "danger",
    "life-threatening", "severe", "acute", "desperate", "sos",
    "help", "asap", "today",
]

_ADDRESS_PATTERNS: list[str] = [
    r'(?:block|sector|street|road|village|town|district|area|colony|nagar|ward|plot|flat|floor)\s+[\w\d]+(?:\s*[,\-]\s*[\w\d\s]+){0,3}',
    r'\b\d+[,\s]+[\w\s]+(?:street|road|avenue|lane|colony|nagar|marg)\b',
]


def _detect_category(text: str) -> str | None:
    for category, keywords in _CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if kw in text:
                return category
    return None


def _detect_urgency(text: str) -> str | None:
    strong = ["dying", "life-threatening", "emergency", "critical", "sos",
              "no water", "no food", "no shelter"]
    soft = ["urgent", "immediate", "crisis", "danger", "severe", "acute",
            "desperate", "asap", "today"]
    for kw in strong:
        if kw in text:
            return "critical"
    for kw in soft:
        if kw in text:
            return "high"
    return None


def _detect_address(text: str) -> str | None:
    for pattern in _ADDRESS_PATTERNS:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(0).strip()
    return None


def _keyword_fallback(raw_text: str) -> dict:
    """Rule-based keyword extraction — always works, no API key needed."""
    from app.ml.matching import extract_skills_from_text

    text_lower = raw_text.lower()
    category = _detect_category(text_lower) or "other"
    urgency = _detect_urgency(text_lower) or "low"
    location = _detect_address(raw_text)
    skills = extract_skills_from_text(raw_text)
    description = raw_text[:450].strip()

    return {
        "category": category,
        "urgency": urgency,
        "location": location,
        "description": description,
        "skills_required": skills,
        "affected_count": None,
        "confidence": 0.35,
    }


# ══════════════════════════════════════════════════════════════════════════════
# PUBLIC API — one function per modality, each sends directly to the LLM
# ══════════════════════════════════════════════════════════════════════════════

def extract_need_from_text(raw_text: str) -> dict:
    """
    Extract structured need from raw text (field notes, messages, etc.).
    LLM via Portkey if configured; keyword fallback otherwise.

    Returns dict with: category, urgency, location, description,
    skills_required, affected_count, confidence, model_used.
    """
    portkey_api_key = os.getenv("PORTKEY_API_KEY")

    if portkey_api_key:
        try:
            messages = [
                {"role": "system", "content": _SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": _TEXT_PREFIX.format(raw_text=raw_text),
                },
            ]
            result = _call_llm(messages)
            result["model_used"] = f"llm:{os.getenv('LLM_MODEL', 'claude-sonnet-4-6')}"
            return result
        except Exception as exc:
            logger.warning("LLM text extraction failed (%s) — keyword fallback", exc)

    result = _keyword_fallback(raw_text)
    result["model_used"] = "keyword_fallback"
    return result


def extract_need_from_image(image_url: str) -> dict:
    """
    Send image DIRECTLY to the LLM vision model for structured extraction.
    No EasyOCR, no intermediate OCR step — the LLM reads the image natively.

    Returns dict with: category, urgency, location, description,
    skills_required, affected_count, confidence, model_used, multimedia_txt.
    """
    portkey_api_key = os.getenv("PORTKEY_API_KEY")
    if not portkey_api_key:
        raise ValueError(
            "Image extraction requires PORTKEY_API_KEY with a vision-capable model "
            "(GPT-4o, Claude 3.5+, Gemini 1.5+)"
        )

    # Always use base64 with explicit media type to avoid Vertex AI/Gemini
    # mimeType errors (direct URLs fail on Gemini without a mimeType param)
    try:
        media_type = _guess_image_media_type(image_url)
        data_uri = _url_to_base64(image_url, media_type)
        image_content = {"type": "image_url", "image_url": {"url": data_uri}}

        messages = [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {
                "role": "user",
                "content": [
                    image_content,
                    {"type": "text", "text": _IMAGE_SUFFIX},
                ],
            },
        ]

        result = _call_llm(messages)
        result["model_used"] = f"llm_vision:{os.getenv('LLM_MODEL', 'claude-sonnet-4-6')}"
        result["multimedia_txt"] = result.get("description", "")[:500]
        return result

    except Exception as exc:
        raise ValueError(
            f"Image extraction failed: {exc}. "
            "Ensure PORTKEY_API_KEY routes to a vision-capable model."
        ) from exc


def extract_need_from_audio(
    audio_url: str | None = None,
    transcription: str | None = None,
) -> dict:
    """
    Extract structured need from audio.

    Strategy:
      1. If pre-transcribed text is provided → send text to LLM.
      2. If audio_url → Whisper transcription → send text to LLM.

    Returns dict with: category, urgency, location, description,
    skills_required, affected_count, confidence, model_used, raw_text.
    """
    if not audio_url and not transcription:
        raise ValueError("Provide either audio_url or transcription")

    if transcription:
        result = extract_need_from_text(transcription)
        result["raw_text"] = transcription
        return result

    # Whisper transcription → LLM text extraction
    raw_text = _transcribe_via_whisper(audio_url)
    result = extract_need_from_text(raw_text)
    result["raw_text"] = raw_text
    result["model_used"] = f"whisper+{result['model_used']}"
    return result


def extract_need_from_pdf(
    pdf_url: str | None = None,
    pdf_bytes: bytes | None = None,
) -> dict:
    """
    Extract structured need from a PDF document.

    Strategy (single-stage — LLM reads the document directly as images):
      1. Convert each PDF page to an image.
      2. Send all page images to the LLM vision model in a single request.
      3. LLM reads text + visual cues across all pages.

    Falls back to text extraction + LLM if image conversion is unavailable.

    Returns dict with: category, urgency, location, description,
    skills_required, affected_count, confidence, model_used, multimedia_txt.
    """
    portkey_api_key = os.getenv("PORTKEY_API_KEY")

    # Get PDF bytes
    if pdf_bytes is None:
        if not pdf_url:
            raise ValueError("Provide either pdf_url or pdf_bytes")
        tmp_path = _download_to_tempfile(pdf_url, suffix=".pdf")
        try:
            with open(tmp_path, "rb") as f:
                pdf_bytes = f.read()
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

    # Strategy 1: PDF pages → images → LLM vision
    if portkey_api_key:
        try:
            page_images_b64 = _pdf_to_base64_images(pdf_bytes)
            if page_images_b64:
                content_parts = []
                for b64_img in page_images_b64:
                    content_parts.append({
                        "type": "image_url",
                        "image_url": {"url": f"data:image/png;base64,{b64_img}"},
                    })
                content_parts.append({"type": "text", "text": _PDF_SUFFIX})

                messages = [
                    {"role": "system", "content": _SYSTEM_PROMPT},
                    {"role": "user", "content": content_parts},
                ]

                result = _call_llm(messages)
                result["model_used"] = f"llm_vision_pdf:{os.getenv('LLM_MODEL', 'claude-sonnet-4-6')}"
                result["multimedia_txt"] = result.get("description", "")[:500]
                return result
        except Exception as exc:
            logger.warning("PDF→image→LLM failed (%s), trying text fallback", exc)

    # Strategy 2: Extract text from PDF → LLM
    try:
        text = _extract_text_from_pdf(pdf_bytes)
        if text.strip():
            result = extract_need_from_text(text)
            result["multimedia_txt"] = text[:500]
            return result
    except Exception as exc:
        logger.warning("PDF text extraction failed (%s)", exc)

    raise ValueError(
        "PDF extraction failed. Ensure PORTKEY_API_KEY is set with a "
        "vision-capable model, or install pymupdf/pypdf for text extraction."
    )


# ── Audio helper ──────────────────────────────────────────────────────────────

def _transcribe_via_whisper(audio_url: str) -> str:
    """Transcribe audio via Whisper (Portkey gateway or direct OpenAI)."""
    portkey_api_key = os.getenv("PORTKEY_API_KEY")
    openai_api_key = os.getenv("OPENAI_API_KEY")

    if not portkey_api_key and not openai_api_key:
        raise ValueError(
            "No transcription API configured. "
            "Set PORTKEY_API_KEY or OPENAI_API_KEY, "
            "or provide a pre-transcribed 'transcription' field instead."
        )

    suffix = _guess_audio_suffix(audio_url)
    tmp_path = _download_to_tempfile(audio_url, suffix=suffix)

    try:
        import openai as _openai

        if portkey_api_key:
            trace_id = str(uuid.uuid4())
            client = _openai.OpenAI(
                api_key=portkey_api_key,
                base_url="https://api.portkey.ai/v1",
                default_headers={
                    "x-portkey-api-key": portkey_api_key,
                    "x-portkey-trace-id": trace_id,
                    "x-portkey-span-name": "llm.voice_transcription",
                },
            )
            logger.info("🔄 Voice transcription via Portkey | trace_id=%s", trace_id)
        else:
            client = _openai.OpenAI(api_key=openai_api_key)
            logger.info("🔄 Voice transcription via OpenAI direct")

        with open(tmp_path, "rb") as f:
            transcript = client.audio.transcriptions.create(model="whisper-1", file=f)

        logger.info("✅ Transcription OK | length=%d chars", len(transcript.text))
        return transcript.text

    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


def _guess_audio_suffix(url: str) -> str:
    lower = url.lower().split("?")[0]
    for ext in (".mp3", ".wav", ".m4a", ".ogg", ".webm", ".flac"):
        if lower.endswith(ext):
            return ext
    return ".mp3"


# ── PDF helpers ───────────────────────────────────────────────────────────────

def _pdf_to_base64_images(pdf_bytes: bytes, max_pages: int = 5) -> list[str]:
    """
    Convert PDF pages to base64-encoded PNG images using PyMuPDF (fitz).
    Returns list of base64 strings (one per page, up to max_pages).
    """
    try:
        import fitz  # PyMuPDF
    except ImportError:
        logger.warning("PyMuPDF not installed — cannot render PDF pages to images")
        return []

    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    images: list[str] = []
    for page_num in range(min(len(doc), max_pages)):
        page = doc[page_num]
        pix = page.get_pixmap(dpi=150)
        img_bytes = pix.tobytes("png")
        images.append(base64.b64encode(img_bytes).decode("utf-8"))
    doc.close()
    return images


def _extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extract text from PDF using PyMuPDF (preferred) or pypdf (fallback)."""
    try:
        import fitz
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        text = ""
        for page in doc:
            text += page.get_text() + "\n"
        doc.close()
        return text.strip()
    except ImportError:
        pass

    try:
        import io
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(pdf_bytes))
        text = ""
        for page in reader.pages:
            text += (page.extract_text() or "") + "\n"
        return text.strip()
    except ImportError:
        pass

    raise ImportError("Install pymupdf or pypdf for PDF text extraction")


# ── Legacy aliases ────────────────────────────────────────────────────────────

def transcribe_audio_url(audio_url: str) -> str:
    """Legacy alias for Whisper transcription."""
    return _transcribe_via_whisper(audio_url)
