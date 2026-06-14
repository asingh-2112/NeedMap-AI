"""
Unified multimodal LLM extraction — single-stage pipeline via Vertex AI + ADK.

All multimedia (text, images, audio, PDF) are sent **directly** to the LLM
via its multimodal / vision capabilities. No intermediate EasyOCR, Whisper,
or PyPDF pre-processing step.

Supported input types
─────────────────────
• raw text          → text message
• image URL         → vision (base64 inline_data Part)
• audio URL         → downloaded → sent directly to Gemini (native audio)
• PDF URL / bytes   → pages rendered to images → vision

Uses Google ADK (Agent Development Kit) with Gemini on Vertex AI.
Auth via GOOGLE_APPLICATION_CREDENTIALS (service account JSON).

Falls back to a rule-based keyword extractor when no Vertex project is set.

Public API
──────────
extract_need_from_text(raw_text)                         -> dict
extract_need_from_image(image_url)                       -> dict
extract_need_from_audio(audio_url=, transcription=)      -> dict
extract_need_from_pdf(pdf_url=, pdf_bytes=)              -> dict
"""

import asyncio
import base64
import json
import logging
import os
import re
import tempfile
import urllib.request
from datetime import datetime, timezone
from functools import cached_property

from app.core.config import _find_service_account_json, _fetch_secret

# Fix SSL cert verification on macOS Homebrew Python
if 'SSL_CERT_FILE' not in os.environ:
    try:
        import certifi
        os.environ['SSL_CERT_FILE'] = certifi.where()
    except ImportError:
        pass

logger = logging.getLogger(__name__)

# ── Prompt template (shared across all modalities) ────────────────────────────
_SYSTEM_PROMPT = (
    "You are a precise structured-data extractor for community disaster-relief "
    "needs. You can understand text, images, audio, and scanned "
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

_AUDIO_PROMPT = (
    "The following is a transcription of an audio field report or voice note "
    "from a disaster-relief operation. Extract the structured need information.\n\n"
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


# ══════════════════════════════════════════════════════════════════════════════
# Gemini LLM — Vertex AI (primary) with AI Studio fallback
# ══════════════════════════════════════════════════════════════════════════════
#
# Auth priority:
#   1. Vertex AI via service account JSON (GOOGLE_APPLICATION_CREDENTIALS)
#      → Free tier available in Google Cloud ($300 credit for new projects)
#   2. AI Studio API key (GEMINI_API_KEY env var) — fallback
#      → https://aistudio.google.com/apikey

# Service account details for Vertex AI
_VERTEX_PROJECT = "big-depth-420713"
_VERTEX_LOCATION = "us-central1"


def _resolve_auth() -> tuple[str | None, str | None, str]:
    """
    Resolve auth method and return (model_id, auth_mode, provider_label).

    Auth discovery order:
    1. Vertex AI via auto-detected service-account.json
    2. AI Studio API key from Secret Manager (`needmap-gemini-api-key`) or env
    3. None — LLM disabled
    """
    from google.genai import Client

    model = os.getenv("LLM_MODEL", "gemini-2.5-flash")

    # 1. Try Vertex AI with service account (auto-detected, not from env)
    sa_path = _find_service_account_json()
    if sa_path:
        try:
            import google.auth
            google.auth.load_credentials_from_file(sa_path)
            vertex_model = (
                f"projects/{_VERTEX_PROJECT}/locations/{_VERTEX_LOCATION}"
                f"/publishers/google/models/{model}"
            )
            return vertex_model, "vertex", "Vertex AI"
        except Exception as exc:
            logger.warning("Vertex AI auth failed (%s), trying fallback", exc)

    # 2. Fallback: AI Studio API key (env → Secret Manager)
    api_key = os.getenv("GEMINI_API_KEY") or _fetch_secret("needmap-gemini-api-key")
    if api_key:
        return model, "studio", "AI Studio"

    return None, None, "none"


class _GeminiClient:
    """
    Gemini LLM wrapper — Vertex AI (primary) / AI Studio (fallback).

    Uses service account JSON at GOOGLE_APPLICATION_CREDENTIALS for Vertex AI.
    Falls back to GEMINI_API_KEY for AI Studio if service account unavailable.
    """

    def __init__(self, model_id: str, auth_mode: str) -> None:
        self._model_id = model_id
        self._auth_mode = auth_mode  # "vertex" or "studio"

    @cached_property
    def _client(self):
        """Build genai.Client based on auth mode."""
        from google.genai import Client

        if self._auth_mode == "vertex":
            return Client(
                vertexai=True,
                project=_VERTEX_PROJECT,
                location=_VERTEX_LOCATION,
            )
        else:
            api_key = os.getenv("GEMINI_API_KEY")
            if not api_key:
                raise RuntimeError("GEMINI_API_KEY not set")
            return Client(api_key=api_key)

    @cached_property
    def _gemini(self):
        """Lazy-init the ADK Gemini LLM with correct auth."""
        from google.adk.models.google_llm import Gemini
        client = self._client

        class _AuthGemini(Gemini):
            model: str = self._model_id

            @cached_property
            def api_client(self):
                return client

        return _AuthGemini(model=self._model_id)

    async def _generate(self, contents, config=None) -> str:
        """Send contents to Gemini and return the text response."""
        from google.adk.models import LlmRequest
        from google.genai import types as genai_types

        if config is None:
            config = genai_types.GenerateContentConfig(
                temperature=0.1,
                max_output_tokens=1024,
            )

        llm_request = LlmRequest(
            model=self._model_id,
            contents=contents,
            config=config,
        )

        response_text = ""
        async for llm_response in self._gemini.generate_content_async(llm_request, stream=False):
            if llm_response.content and llm_response.content.parts:
                for part in llm_response.content.parts:
                    if part.text:
                        response_text += part.text

        return response_text

    def generate(self, contents: list, config=None) -> str:
        """Synchronous wrapper for _generate."""
        return asyncio.run(self._generate(contents, config))


def _get_gemini_client():
    """Return (_GeminiClient, model_id, provider_label) or (None, None, None)."""
    model_id, auth_mode, label = _resolve_auth()
    if auth_mode is None:
        return None, None, None
    return _GeminiClient(model_id=model_id, auth_mode=auth_mode), model_id, label


def _call_llm(contents: list, config=None) -> dict:
    """
    Send contents to Gemini (Vertex or AI Studio) and return sanitised dict.
    Raises on failure so callers can fall back.
    """
    client, model_id, provider = _get_gemini_client()
    if client is None:
        raise RuntimeError(
            "No Gemini auth configured. Set GOOGLE_APPLICATION_CREDENTIALS "
            "(service account JSON) or GEMINI_API_KEY (AI Studio)."
        )

    logger.info("🔄 LLM extraction via %s | model=%s", provider, model_id)

    try:
        response_text = client.generate(contents, config)
    except Exception as exc:
        logger.error("❌ Gemini API call failed: %s", exc)
        raise

    logger.debug("LLM raw response: %r", response_text)

    try:
        raw_dict = _parse_llm_response(response_text)
    except (json.JSONDecodeError, Exception) as exc:
        logger.error("❌ JSON parse failed. content=%r error=%s", response_text, exc)
        raise

    logger.info(
        "✅ LLM extraction OK | model=%s | category=%s | urgency=%s",
        model_id, raw_dict.get("category"), raw_dict.get("urgency"),
    )
    return _sanitise(raw_dict)


# ── Helpers for building multimodal contents ──────────────────────────────────

def _download_bytes(url: str) -> bytes:
    """Download a URL and return raw bytes."""
    with urllib.request.urlopen(url) as resp:  # noqa: S310
        return resp.read()


def _guess_mime_type(url: str, default: str = "image/jpeg") -> str:
    """Guess MIME type from URL extension."""
    lower = url.lower().split("?")[0]
    mapping = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".gif": "image/gif",
        ".mp3": "audio/mp3",
        ".wav": "audio/wav",
        ".m4a": "audio/mp4",
        ".ogg": "audio/ogg",
        ".webm": "audio/webm",
        ".flac": "audio/flac",
    }
    for ext, mime in mapping.items():
        if lower.endswith(ext):
            return mime
    return default


def _make_text_contents(system_prompt: str, user_text: str):
    """Build contents list for a text-only LLM call."""
    from google.genai import types as genai_types

    return [
        genai_types.Content(
            role="user",
            parts=[genai_types.Part(text=system_prompt + "\n\n" + user_text)],
        )
    ]


def _make_image_contents(system_prompt: str, image_url: str):
    """Build contents list with an image (downloaded as base64 inline_data)."""
    from google.genai import types as genai_types

    image_bytes = _download_bytes(image_url)
    mime_type = _guess_mime_type(image_url)

    return [
        genai_types.Content(
            role="user",
            parts=[
                genai_types.Part(
                    inline_data=genai_types.Blob(data=image_bytes, mime_type=mime_type)
                ),
                genai_types.Part(text=system_prompt + "\n\n" + _IMAGE_SUFFIX),
            ],
        )
    ]


def _make_audio_contents(system_prompt: str, audio_url: str):
    """Build contents list with audio (downloaded as inline_data)."""
    from google.genai import types as genai_types

    audio_bytes = _download_bytes(audio_url)
    mime_type = _guess_mime_type(audio_url, default="audio/mp3")

    return [
        genai_types.Content(
            role="user",
            parts=[
                genai_types.Part(
                    inline_data=genai_types.Blob(data=audio_bytes, mime_type=mime_type)
                ),
                genai_types.Part(text=system_prompt + "\n\n" + _AUDIO_PROMPT),
            ],
        )
    ]


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
    Vertex AI (primary) → AI Studio (fallback) → keyword fallback.

    Returns dict with: category, urgency, location, description,
    skills_required, affected_count, confidence, model_used.
    """
    try:
        model_id, auth_mode, _ = _resolve_auth()
        if auth_mode:
            contents = _make_text_contents(_SYSTEM_PROMPT, _TEXT_PREFIX.format(raw_text=raw_text))
            result = _call_llm(contents)
            result["model_used"] = f"gemini:{os.getenv('LLM_MODEL', 'gemini-2.5-flash')}:{auth_mode}"
            return result
    except Exception as exc:
        logger.warning("Gemini text extraction failed (%s) — keyword fallback", exc)

    result = _keyword_fallback(raw_text)
    result["model_used"] = "keyword_fallback"
    return result


def extract_need_from_image(image_url: str) -> dict:
    """
    Send image DIRECTLY to Gemini vision for structured extraction.
    Vertex AI (primary) → AI Studio (fallback).

    Returns dict with: category, urgency, location, description,
    skills_required, affected_count, confidence, model_used, multimedia_txt.
    """
    _, auth_mode, _ = _resolve_auth()
    if not auth_mode:
        raise ValueError(
            "Image extraction requires Gemini auth. "
            "Set GOOGLE_APPLICATION_CREDENTIALS or GEMINI_API_KEY."
        )

    try:
        contents = _make_image_contents(_SYSTEM_PROMPT, image_url)
        result = _call_llm(contents)
        result["model_used"] = f"gemini_vision:{os.getenv('LLM_MODEL', 'gemini-2.5-flash')}:{auth_mode}"
        result["multimedia_txt"] = result.get("description", "")[:500]
        return result

    except Exception as exc:
        raise ValueError(
            f"Image extraction failed: {exc}. "
            "Check GOOGLE_APPLICATION_CREDENTIALS or GEMINI_API_KEY."
        ) from exc


def extract_need_from_audio(
    audio_url: str | None = None,
    transcription: str | None = None,
) -> dict:
    """
    Extract structured need from audio.

    Strategy:
      1. If pre-transcribed text is provided → send text to LLM.
      2. If audio_url → send audio directly to Gemini (native audio understanding).

    Gemini 2.5 Flash natively understands audio — no separate Whisper
    transcription step needed.

    Returns dict with: category, urgency, location, description,
    skills_required, affected_count, confidence, model_used, raw_text.
    """
    if not audio_url and not transcription:
        raise ValueError("Provide either audio_url or transcription")

    if transcription:
        result = extract_need_from_text(transcription)
        result["raw_text"] = transcription
        return result

    # Send audio directly to Gemini (native multimodal audio)
    _, auth_mode, _ = _resolve_auth()
    if not auth_mode:
        raise ValueError(
            "Audio extraction requires Gemini auth. "
            "Set GOOGLE_APPLICATION_CREDENTIALS or GEMINI_API_KEY."
        )

    try:
        contents = _make_audio_contents(_SYSTEM_PROMPT, audio_url)
        result = _call_llm(contents)
        result["model_used"] = f"gemini_audio:{os.getenv('LLM_MODEL', 'gemini-2.5-flash')}:{auth_mode}"
        result["raw_text"] = result.get("description", "")
        return result

    except Exception as exc:
        raise ValueError(
            f"Audio extraction failed: {exc}. "
            "Ensure GEMINI_API_KEY is set."
        ) from exc


def extract_need_from_pdf(
    pdf_url: str | None = None,
    pdf_bytes: bytes | None = None,
) -> dict:
    """
    Extract structured need from a PDF document.

    Strategy (single-stage — LLM reads the document directly as images):
      1. Convert each PDF page to an image.
      2. Send all page images to Gemini vision in a single request.
      3. LLM reads text + visual cues across all pages.

    Falls back to text extraction + LLM if image conversion is unavailable.

    Returns dict with: category, urgency, location, description,
    skills_required, affected_count, confidence, model_used, multimedia_txt.
    """
    _, auth_mode, _ = _resolve_auth()

    # Get PDF bytes
    if pdf_bytes is None:
        if not pdf_url:
            raise ValueError("Provide either pdf_url or pdf_bytes")
        pdf_bytes = _download_bytes(pdf_url)

    # Strategy 1: PDF pages → images → Gemini vision
    if auth_mode:
        try:
            page_images_b64 = _pdf_to_base64_images(pdf_bytes)
            if page_images_b64:
                from google.genai import types as genai_types

                parts = []
                for b64_img in page_images_b64:
                    parts.append(
                        genai_types.Part(
                            inline_data=genai_types.Blob(
                                data=base64.b64decode(b64_img),
                                mime_type="image/png",
                            )
                        )
                    )
                parts.append(genai_types.Part(text=_SYSTEM_PROMPT + "\n\n" + _PDF_SUFFIX))

                contents = [genai_types.Content(role="user", parts=parts)]
                result = _call_llm(contents)
                result["model_used"] = f"gemini_vision_pdf:{os.getenv('LLM_MODEL', 'gemini-2.5-flash')}:{auth_mode}"
                result["multimedia_txt"] = result.get("description", "")[:500]
                return result
        except Exception as exc:
            logger.warning("PDF→image→Gemini failed (%s), trying text fallback", exc)

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
        "PDF extraction failed. "
        "Set GOOGLE_APPLICATION_CREDENTIALS (Vertex AI) or GEMINI_API_KEY (AI Studio),"
        " or install pymupdf/pypdf for text extraction."
    )


# ── Legacy alias ──────────────────────────────────────────────────────────────

def transcribe_audio_url(audio_url: str) -> str:
    """Legacy alias. Audio is now sent directly to Gemini — no separate transcription."""
    result = extract_need_from_audio(audio_url=audio_url)
    return result.get("raw_text", "")


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