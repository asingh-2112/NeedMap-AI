from datetime import datetime

from pydantic import BaseModel, Field, model_validator
from typing_extensions import Self

from app.models.enums import NeedCategory, NeedStatus, NeedUrgency, SourceType

# Maps used to normalise LLM-extracted values
_CATEGORY_ALIASES: dict[str, NeedCategory] = {
    "water": NeedCategory.WATER_ACCESS,
    "water access": NeedCategory.WATER_ACCESS,
    "drinking water": NeedCategory.WATER_ACCESS,
    "drinking_water": NeedCategory.WATER_ACCESS,
    "food": NeedCategory.FOOD,
    "meals": NeedCategory.FOOD,
    "nutrition": NeedCategory.FOOD,
    "shelter": NeedCategory.SHELTER,
    "housing": NeedCategory.SHELTER,
    "accommodation": NeedCategory.SHELTER,
    "health": NeedCategory.HEALTH,
    "medical": NeedCategory.HEALTH,
    "healthcare": NeedCategory.HEALTH,
    "education": NeedCategory.EDUCATION,
    "school": NeedCategory.EDUCATION,
    "learning": NeedCategory.EDUCATION,
    "sanitation": NeedCategory.SANITATION,
    "hygiene": NeedCategory.SANITATION,
    "cleanliness": NeedCategory.SANITATION,
    "clothing": NeedCategory.CLOTHING,
    "clothes": NeedCategory.CLOTHING,
    "apparel": NeedCategory.CLOTHING,
    "legal": NeedCategory.LEGAL_AID,
    "legal aid": NeedCategory.LEGAL_AID,
    "legal_aid": NeedCategory.LEGAL_AID,
    "lawyer": NeedCategory.LEGAL_AID,
    "mental health": NeedCategory.MENTAL_HEALTH,
    "mental_health": NeedCategory.MENTAL_HEALTH,
    "counseling": NeedCategory.MENTAL_HEALTH,
    "therapy": NeedCategory.MENTAL_HEALTH,
    "transport": NeedCategory.TRANSPORTATION,
    "transportation": NeedCategory.TRANSPORTATION,
    "transportation access": NeedCategory.TRANSPORTATION,
    "mobility": NeedCategory.TRANSPORTATION,
    "other": NeedCategory.OTHER,
    "others": NeedCategory.OTHER,
}

_URGENCY_ALIASES: dict[str, NeedUrgency] = {
    "critical": NeedUrgency.CRITICAL,
    "urgent": NeedUrgency.CRITICAL,
    "emergency": NeedUrgency.CRITICAL,
    "immediate": NeedUrgency.CRITICAL,
    "life threatening": NeedUrgency.CRITICAL,
    "life_threatening": NeedUrgency.CRITICAL,
    "high": NeedUrgency.HIGH,
    "severe": NeedUrgency.HIGH,
    "very important": NeedUrgency.HIGH,
    "medium": NeedUrgency.MEDIUM,
    "moderate": NeedUrgency.MEDIUM,
    "normal": NeedUrgency.MEDIUM,
    "low": NeedUrgency.LOW,
    "minor": NeedUrgency.LOW,
    "whenever": NeedUrgency.LOW,
}


def _normalise_category(raw: str) -> NeedCategory:
    """Try to map an arbitrary string to a NeedCategory enum member."""
    key = raw.strip().lower().replace(" ", "_")
    # Direct match
    try:
        return NeedCategory(key)
    except ValueError:
        pass
    # Alias map
    if key in _CATEGORY_ALIASES:
        return _CATEGORY_ALIASES[key]
    # Substring match against alias keys
    for alias, cat in _CATEGORY_ALIASES.items():
        if alias in key or key in alias:
            return cat
    return NeedCategory.OTHER


def _normalise_urgency(raw: str) -> NeedUrgency:
    """Try to map an arbitrary string to a NeedUrgency enum member."""
    key = raw.strip().lower().replace(" ", "_")
    try:
        return NeedUrgency(key)
    except ValueError:
        pass
    if key in _URGENCY_ALIASES:
        return _URGENCY_ALIASES[key]
    for alias, urg in _URGENCY_ALIASES.items():
        if alias in key or key in alias:
            return urg
    return NeedUrgency.MEDIUM


class NeedCreateRequest(BaseModel):
    title: str = Field(..., min_length=2, max_length=255)
    description: str | None = None
    category: NeedCategory
    urgency: NeedUrgency
    organization_id: int = Field(..., gt=0)
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    address: str = Field(..., min_length=2, max_length=500)
    house_number: str | None = Field(default=None, max_length=50)
    street: str | None = Field(default=None, max_length=255)
    colony: str | None = Field(default=None, max_length=255)
    city: str | None = Field(default=None, max_length=100)
    state: str | None = Field(default=None, max_length=100)
    pincode: str | None = Field(default=None, max_length=10)
    country: str | None = Field(default=None, max_length=100)
    affected_count: int | None = Field(default=None, ge=0)

    @model_validator(mode="after")
    def validate_location_pair(self) -> Self:
        if not self.address.strip():
            raise ValueError("Address is required and cannot be empty")
        if self.latitude == 0.0 and self.longitude == 0.0:
            raise ValueError("Latitude and longitude must be provided (cannot be 0,0)")
        return self

    @model_validator(mode="after")
    def validate_description(self) -> Self:
        if not self.description or not self.description.strip():
            raise ValueError("Description is required")
        if len(self.description.strip()) < 10:
            raise ValueError("Description must be at least 10 characters")
        return self


class NeedUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=255)
    description: str | None = None
    category: NeedCategory | None = None
    urgency: NeedUrgency | None = None
    status: NeedStatus | None = None
    organization_id: int | None = None
    priority_score: float | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    address: str | None = Field(default=None, max_length=500)
    resolved_at: datetime | None = None

    @model_validator(mode="after")
    def validate_payload(self):
        if (
            self.title is None
            and self.description is None
            and self.category is None
            and self.urgency is None
            and self.status is None
            and self.organization_id is None
            and self.priority_score is None
            and self.latitude is None
            and self.longitude is None
            and self.address is None
            and self.resolved_at is None
        ):
            raise ValueError("Provide at least one field to update")

        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Both latitude and longitude are required together")

        location_fields = {"latitude", "longitude", "address"}
        provided_location_fields = self.model_fields_set.intersection(location_fields)

        if provided_location_fields and provided_location_fields != location_fields:
            raise ValueError("Provide latitude, longitude, and address together")

        if provided_location_fields == location_fields:
            if self.latitude is None or self.longitude is None or self.address is None:
                raise ValueError("Latitude, longitude, and address cannot be null")
            if not self.address.strip():
                raise ValueError("Address is required")

        return self


class NeedResponse(BaseModel):
    id: int
    title: str
    description: str | None
    category: NeedCategory
    urgency: NeedUrgency
    status: NeedStatus
    organization_id: int
    created_by: int | None
    priority_score: float | None
    latitude: float
    longitude: float
    address: str
    house_number: str | None = None
    street: str | None = None
    colony: str | None = None
    city: str | None = None
    state: str | None = None
    pincode: str | None = None
    country: str | None = None
    affected_count: int | None = None
    created_at: datetime
    resolved_at: datetime | None

    model_config = {"from_attributes": True}


class NeedHeatmapItem(BaseModel):
    id: int
    title: str
    category: NeedCategory
    urgency: NeedUrgency
    latitude: float
    longitude: float


class NeedSourceCreateRequest(BaseModel):
    source_type: SourceType
    location: str | None = Field(default=None, max_length=100)
    multimedia_txt: str | None = Field(default=None, max_length=500)
    ai_extraction: str | None = Field(default=None, max_length=500)


class NeedSourceResponse(BaseModel):
    id: int
    need_id: int
    source_type: SourceType
    location: str | None
    multimedia_txt: str | None
    ai_extraction: str | None
    processed_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── ML: Volunteer–Need matching ───────────────────────────────────────────────

class VolunteerMatchResult(BaseModel):
    volunteer_id: int
    composite_score: float
    skill_score: float
    geo_score: float
    reliability_score: float
    availability_score: float


class SuggestVolunteersResponse(BaseModel):
    need_id: int
    scored_volunteers: list[VolunteerMatchResult]


# ── ML: OCR extraction ────────────────────────────────────────────────────────

class OCRExtractRequest(BaseModel):
    image_url: str
    need_id: int | None = None


class OCRExtractionResponse(BaseModel):
    source_id: int | None = None
    need_id: int | None = None
    multimedia_txt: str
    ai_extraction: str
    structured: dict
    category_hint: str | None = None
    urgency_hint: str | None = None
    address_hint: str | None = None


# ── ML: LLM ingest (text + voice) ────────────────────────────────────────────

class TextIngestRequest(BaseModel):
    """
    Ingest raw community need text from any source:
    field notes, WhatsApp/Telegram messages, web-form submissions, etc.

    If create_need=True (default), a Need record is created from the
    extracted data and returned in the response.
    """
    raw_text: str = Field(..., min_length=10, max_length=5000,
                          description="Raw field note, message, or survey text")
    organization_id: int
    # Location for the resulting Need record (0.0/0.0 if unknown)
    latitude: float = Field(default=0.0, ge=-90, le=90)
    longitude: float = Field(default=0.0, ge=-180, le=180)
    address: str = Field(default="", max_length=500,
                         description="Known address; extracted location used as fallback")
    create_need: bool = Field(default=True,
                              description="Create a Need record from the extracted data")


class VoiceIngestRequest(BaseModel):
    """
    Ingest a voice-note or field audio recording.

    Provide either:
    - audio_url: public URL to an audio file (Gemini natively understands audio), OR
    - transcription: pre-transcribed text (for demos or manual transcription)
    """
    audio_url: str | None = Field(
        default=None,
        description="Public URL to MP3/WAV/M4A audio file — Gemini understands audio natively",
    )
    transcription: str | None = Field(
        default=None,
        min_length=10,
        max_length=5000,
        description="Pre-transcribed text (use instead of audio_url for demos)",
    )
    organization_id: int
    latitude: float = Field(default=0.0, ge=-90, le=90)
    longitude: float = Field(default=0.0, ge=-180, le=180)
    address: str = Field(default="", max_length=500)
    create_need: bool = True

    @model_validator(mode="after")
    def require_audio_or_transcription(self):
        if not self.audio_url and not self.transcription:
            raise ValueError("Provide either audio_url or transcription")
        return self


class PDFIngestRequest(BaseModel):
    """
    Ingest a PDF document (field report, official form, scanned complaint).

    PDF pages are rendered to images and sent directly to Gemini vision.
    Provide either pdf_url (public URL) or upload via the
    /ingest/pdf-upload endpoint.
    """
    pdf_url: str = Field(..., description="Public URL to a PDF document")
    organization_id: int
    latitude: float = Field(default=0.0, ge=-90, le=90)
    longitude: float = Field(default=0.0, ge=-180, le=180)
    address: str = Field(default="", max_length=500)
    create_need: bool = True


class IngestResponse(BaseModel):
    """Response from POST /needs/ingest/text, /voice, or /pdf."""
    # What the LLM extracted
    category: str
    urgency: str
    location: str | None = None
    description: str
    skills_required: list[str]
    affected_count: int | None = None
    confidence: float
    model_used: str
    # Created records (if create_need=True)
    need_id: int | None = None
    source_id: int | None = None
    # Raw input that was processed
    raw_text: str
