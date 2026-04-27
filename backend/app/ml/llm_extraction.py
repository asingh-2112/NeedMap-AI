"""
LLM-powered structured need extraction from raw community text.

Uses Portkey gateway (PORTKEY_API_KEY) to route to Claude, GPT-4, Gemini, or
any other model configured in the Portkey dashboard via PORTKEY_VIRTUAL_KEY.

Falls back to the rule-based keyword extractor if no API key is configured,
so the application always returns a result — never a hard failure.

Public API
----------
extract_need_from_text(raw_text) -> dict
transcribe_audio_url(audio_url)  -> str     (Whisper, optional)
"""

import json
import logging
import os
import tempfile
import urllib.request
import uuid
from datetime import datetime

logger = logging.getLogger(__name__)

# ── Prompt template ───────────────────────────────────────────────────────────
_EXTRACTION_PROMPT = """\
Extract community need info from the text below. Reply with ONLY a JSON object — no prose, no markdown fences.

Text: {raw_text}

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

Urgency: critical=life-threatening, 
high=serious, 
medium=can wait days, 
low=minor.

Skills examples: medical, plumbing, construction, logistics, cooking, teaching, counseling, legal.
"""

# ── Validated enum values (for LLM output sanitisation) ──────────────────────
_VALID_CATEGORIES = {
    "water_access", "food", "shelter", "health", "education",
    "sanitation", "clothing", "legal_aid", "mental_health", "transportation", "other",
}

_VALID_URGENCIES = {"critical", "high", "medium", "low"}


def _sanitise(extracted: dict) -> dict:
    """Ensure LLM output conforms to our enum values; fix common mistakes."""
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

    return {
        "category":       category,
        "urgency":        urgency,
        "location":       extracted.get("location"),
        "description":    str(extracted.get("description") or "").strip() or "No description extracted.",
        "skills_required": skills,
        "affected_count": affected,
        "confidence":     confidence,
    }


def _parse_llm_response(content: str) -> dict:
    """
    Parse LLM response to JSON.

    Handles:
    - Markdown code fences (```json ... ```)
    - Truncated / unterminated JSON (attempts auto-repair)
    - Embedded JSON object inside surrounding prose
    """
    content = content.strip()

    # Strip markdown code fences
    if content.startswith("```"):
        parts = content.split("```")
        # parts[0] is empty, parts[1] is the fenced block, parts[2] is trailing
        inner = parts[1]
        if inner.startswith("json"):
            inner = inner[4:]
        content = inner.strip()

    # If not starting with {, try to find the first { ... } block
    if not content.startswith("{"):
        start = content.find("{")
        if start != -1:
            content = content[start:]

    # Trim to last closing brace (handles trailing prose after valid JSON)
    last_brace = content.rfind("}")
    if last_brace != -1:
        content = content[: last_brace + 1]

    # Attempt direct parse
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        pass

    # Auto-repair: close open strings and brackets, then retry
    repaired = _repair_truncated_json(content)
    return json.loads(repaired)


def _repair_truncated_json(s: str) -> str:
    """
    Best-effort repair for truncated JSON produced by a token-capped LLM.

    Strategy:
    1. Track open string / bracket state as we scan.
    2. Append missing closing characters.
    """
    import re

    in_string = False
    escape_next = False
    stack: list[str] = []  # '{' or '['

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

    # Close any open string
    if in_string:
        s += '"'

    # Remove any trailing comma before we close brackets
    s = re.sub(r",\s*$", "", s.rstrip())

    # Close brackets in reverse order
    closing = {"{": "}", "[": "]"}
    for opener in reversed(stack):
        s += closing[opener]

    return s


# ── Portkey extraction ────────────────────────────────────────────────────────

def _portkey_extract(raw_text: str) -> dict:
    """
    Call LLM via Portkey gateway and return parsed + sanitised extraction dict.

    Uses Portkey trace headers for observability/visualization in Portkey dashboard.
    Raises on network/API errors so the caller can fall back gracefully.
    """
    from openai import OpenAI

    portkey_api_key = os.getenv("PORTKEY_API_KEY")
    llm_model = os.getenv("LLM_MODEL", "claude-sonnet-4-6")

    # Generate trace IDs for Portkey observability
    trace_id = str(uuid.uuid4())
    request_id = str(uuid.uuid4())
    timestamp = datetime.utcnow().isoformat() + "Z"

    # Headers for Portkey gateway with full observability
    portkey_headers = {
        "x-portkey-api-key": portkey_api_key,
        "x-portkey-trace-id": trace_id,
        "x-portkey-request-id": request_id,
        "x-portkey-span-name": "llm.text_extraction",
        "x-portkey-metadata": f"operation=need_extraction,model={llm_model},timestamp={timestamp}",
    }

    client = OpenAI(
        api_key=portkey_api_key,
        base_url="https://api.portkey.ai/v1",
        default_headers=portkey_headers,
    )

    logger.info(
        "🔄 LLM extraction started | trace_id=%s | model=%s | text_len=%d",
        trace_id, llm_model, len(raw_text)
    )

    response = client.chat.completions.create(
        model=llm_model,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a precise structured-data extractor. "
                    "Always respond with valid JSON only. No prose, no markdown. "
                    "Keep description under 200 characters."
                ),
            },
            {
                "role": "user",
                "content": _EXTRACTION_PROMPT.format(raw_text=raw_text),
            },
        ],
        max_tokens=1024,
        temperature=0.1,   # low temperature for deterministic structured output
    )

    content = response.choices[0].message.content
    logger.debug("LLM raw response: %r", content)
    try:
        raw_dict = _parse_llm_response(content)
    except (json.JSONDecodeError, Exception) as exc:
        logger.error("❌ JSON parse failed after repair. content=%r  error=%s", content, exc)
        raise

    logger.info("✅ LLM extraction OK | trace_id=%s | category=%s | urgency=%s",
                trace_id, raw_dict.get("category"), raw_dict.get("urgency"))
    return _sanitise(raw_dict)


# ── Rule-based fallback ───────────────────────────────────────────────────────

def _keyword_fallback(raw_text: str) -> dict:
    """
    Rule-based keyword extraction — always works, no API key needed.
    Re-uses the category/urgency/address detectors from ocr.py.
    """
    from app.ml.ocr import _detect_category, _detect_urgency, _detect_address
    from app.ml.matching import extract_skills_from_text

    text_lower = raw_text.lower()
    category   = _detect_category(text_lower) or "other"
    urgency    = _detect_urgency(text_lower) or "low"
    location   = _detect_address(raw_text)
    skills     = extract_skills_from_text(raw_text)
    description = raw_text[:450].strip()

    return {
        "category":       category,
        "urgency":        urgency,
        "location":       location,
        "description":    description,
        "skills_required": skills,
        "affected_count": None,
        "confidence":     0.35,   # lower confidence for rule-based
    }


# ── Public API ────────────────────────────────────────────────────────────────

def extract_need_from_text(raw_text: str) -> dict:
    """
    Extract a structured need record from any raw text (field notes, survey
    text, WhatsApp message, voice transcription, etc.).

    Uses Portkey LLM if PORTKEY_API_KEY is set; falls back to keyword
    extraction otherwise. Always returns a result — never raises.

    Returns:
    {
        "category":       str,         — NeedCategory value
        "urgency":        str,         — NeedUrgency value
        "location":       str | None,  — extracted address or area
        "description":    str,         — 1–2 sentence summary
        "skills_required": list[str],  — volunteer skills needed
        "affected_count": int | None,  — estimated people affected
        "confidence":     float,       — 0.0–1.0
        "model_used":     str,         — "llm:<model>" or "keyword_fallback"
    }
    """
    portkey_api_key = os.getenv("PORTKEY_API_KEY")

    if portkey_api_key:
        try:
            result = _portkey_extract(raw_text)
            model_tag = f"llm:{os.getenv('LLM_MODEL', 'claude-sonnet-4-6')}"
            result["model_used"] = model_tag
            logger.info(
                "LLM extraction OK  model=%s  category=%s  urgency=%s  confidence=%.2f",
                os.getenv("LLM_MODEL"),
                result["category"],
                result["urgency"],
                result["confidence"],
            )
            return result
        except Exception as exc:
            logger.warning(
                "LLM extraction failed (%s) — falling back to keyword extraction", exc
            )

    result = _keyword_fallback(raw_text)
    result["model_used"] = "keyword_fallback"
    logger.info(
        "Keyword extraction  category=%s  urgency=%s", result["category"], result["urgency"]
    )
    return result


def transcribe_audio_url(audio_url: str) -> str:
    """
    Transcribe audio from a public URL using OpenAI Whisper.

    Tries Portkey gateway first (if PORTKEY_API_KEY set), then falls back to
    direct OpenAI API (OPENAI_API_KEY).

    Returns the transcription text.
    Raises ValueError if no transcription API is configured or download fails.
    """
    portkey_api_key = os.getenv("PORTKEY_API_KEY")
    openai_api_key  = os.getenv("OPENAI_API_KEY")

    if not portkey_api_key and not openai_api_key:
        raise ValueError(
            "No transcription API configured. "
            "Set PORTKEY_API_KEY or OPENAI_API_KEY, "
            "or provide a pre-transcribed 'transcription' field instead."
        )

    # Download audio to a temp file (Whisper API requires a file object)
    try:
        suffix = _guess_audio_suffix(audio_url)
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp_path = tmp.name
        urllib.request.urlretrieve(audio_url, tmp_path)  # noqa: S310
    except Exception as exc:
        raise ValueError(f"Failed to download audio from URL: {exc}") from exc

    try:
        import openai as _openai

        if portkey_api_key:
            # Generate trace IDs for Portkey observability
            trace_id = str(uuid.uuid4())
            request_id = str(uuid.uuid4())
            timestamp = datetime.utcnow().isoformat() + "Z"

            # Headers for Portkey gateway with observability
            portkey_headers = {
                "x-portkey-api-key": portkey_api_key,
                "x-portkey-trace-id": trace_id,
                "x-portkey-request-id": request_id,
                "x-portkey-span-name": "llm.voice_transcription",
                "x-portkey-metadata": f"operation=voice_transcription,model=whisper-1,timestamp={timestamp}",
            }

            client = _openai.OpenAI(
                api_key=portkey_api_key,
                base_url="https://api.portkey.ai/v1",
                default_headers=portkey_headers,
            )
            logger.info("🔄 Voice transcription via Portkey | trace_id=%s", trace_id)
        else:
            client = _openai.OpenAI(api_key=openai_api_key)
            logger.info("🔄 Voice transcription via OpenAI direct")

        with open(tmp_path, "rb") as f:
            transcript = client.audio.transcriptions.create(model="whisper-1", file=f)

        logger.info("✅ Voice transcription OK | length=%d chars", len(transcript.text))
        return transcript.text

    except Exception as exc:
        raise ValueError(f"Whisper transcription failed: {exc}") from exc

    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


def _guess_audio_suffix(url: str) -> str:
    """Return a file extension for the audio URL (e.g. '.mp3', '.wav')."""
    lower = url.lower().split("?")[0]
    for ext in (".mp3", ".wav", ".m4a", ".ogg", ".webm", ".flac"):
        if lower.endswith(ext):
            return ext
    return ".mp3"  # default
