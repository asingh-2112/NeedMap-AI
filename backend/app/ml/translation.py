"""
Cloud Translation API wrapper — uses Google Cloud Translation API v3
for real-time translation of user-generated content (titles, descriptions,
names) at retrieval time.

No static dictionary — all translation goes through the Cloud Translation API.

Auth via same service account as Vertex AI (auto-detected).
"""

import asyncio
import logging
import os
from functools import lru_cache

from app.core.config import _get_google_creds

logger = logging.getLogger(__name__)

SUPPORTED_LANGUAGES = {"en", "hi", "mr", "ta", "te", "kn"}


def _get_translation_client():
    """Return a Translate client using the shared Google credentials."""
    creds, _ = _get_google_creds()
    if not creds:
        return None
    from google.cloud import translate_v3 as translate
    return translate.TranslationServiceClient(credentials=creds)


@lru_cache(maxsize=128)
def translate_text(text: str, target_language: str, source_language: str = "en") -> str:
    """
    Translate a single text string using Cloud Translation API v3.

    Args:
        text: The text to translate (user-generated content like titles, descriptions, names)
        target_language: Target language code (hi, mr, ta, te, kn)
        source_language: Source language code (default: en)

    Returns:
        Translated text, or the original text if translation fails / unsupported language
    """
    if not text or not text.strip():
        return text

    if target_language not in SUPPORTED_LANGUAGES or target_language == "en":
        return text

    if source_language == target_language:
        return text

    client = _get_translation_client()
    if client is None:
        logger.warning("Translation client unavailable — returning original text")
        return text

    _, project = _get_google_creds()
    if not project:
        return text

    try:
        parent = f"projects/{project}/locations/us-central1"
        response = client.translate_text(
            request={
                "parent": parent,
                "contents": [text],
                "mime_type": "text/plain",
                "source_language_code": source_language,
                "target_language_code": target_language,
            }
        )
        if response.translations:
            return response.translations[0].translated_text
        return text
    except Exception as e:
        logger.debug("Translation failed for '%s' -> %s: %s", text[:50], target_language, e)
        return text


@lru_cache(maxsize=256)
def _translate_text_sync(text: str, target_language: str, source_language: str = "en") -> str:
    """Sync wrapper for translate_text — used by batch_translate."""
    return translate_text(text, target_language, source_language)


async def translate_text_async(text: str, target_language: str, source_language: str = "en") -> str:
    """Async wrapper — runs translation in a thread to avoid blocking."""
    if not text or not text.strip():
        return text
    if target_language not in SUPPORTED_LANGUAGES or target_language == "en":
        return text
    if source_language == target_language:
        return text

    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(
        None, _translate_text_sync, text, target_language, source_language
    )


async def batch_translate(
    texts: list[str],
    target_language: str,
    source_language: str = "en",
) -> list[str]:
    """Translate multiple texts concurrently."""
    tasks = [
        translate_text_async(t, target_language, source_language)
        for t in texts
    ]
    return await asyncio.gather(*tasks)