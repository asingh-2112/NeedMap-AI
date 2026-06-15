"""
POST /api/translate — translate user-generated content via Cloud Translation API.

Request:
  {
    "texts": ["Water shortage in district", "Medical supplies needed"],
    "target": "hi"
  }

Response:
  {
    "translations": ["जिले में पानी की कमी", "चिकित्सा आपूर्ति की आवश्यकता"],
    "target": "hi",
    "cached": false
  }
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from app.ml.translation import batch_translate

router = APIRouter(prefix="/api/translate", tags=["translate"])

SUPPORTED_LANGUAGES = {"en", "hi", "mr", "ta", "te", "kn"}


class TranslateRequest(BaseModel):
    texts: list[str] = Field(..., min_length=1, max_length=50)
    target: str = Field(..., min_length=2, max_length=2)
    source: str = Field("en", min_length=2, max_length=2)


class TranslateResponse(BaseModel):
    translations: list[str]
    target: str
    source: str


@router.post("", response_model=TranslateResponse)
async def translate(request: TranslateRequest):
    if request.target not in SUPPORTED_LANGUAGES:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported target language: {request.target}. Supported: {', '.join(sorted(SUPPORTED_LANGUAGES))}"
        )

    if request.target == request.source:
        return TranslateResponse(
            translations=request.texts,
            target=request.target,
            source=request.source,
        )

    translated = await batch_translate(
        texts=request.texts,
        target_language=request.target,
        source_language=request.source,
    )

    return TranslateResponse(
        translations=translated,
        target=request.target,
        source=request.source,
    )