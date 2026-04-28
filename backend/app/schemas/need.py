from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from app.models.enums import NeedCategory, NeedStatus, NeedUrgency, SourceType


class NeedCreateRequest(BaseModel):
    title: str = Field(..., min_length=2, max_length=255)
    description: str | None = None
    category: NeedCategory
    urgency: NeedUrgency
    organization_id: int
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    address: str = Field(..., min_length=2, max_length=500)

    @model_validator(mode="after")
    def validate_location_pair(self):
        if not self.address.strip():
            raise ValueError("Address is required")
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
    - audio_url: public URL to an audio file (Whisper transcribes it), OR
    - transcription: pre-transcribed text (for demos or manual transcription)
    """
    audio_url: str | None = Field(
        default=None,
        description="Public URL to MP3/WAV/M4A audio file — transcribed via Whisper",
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

    PDF pages are sent directly to the LLM vision model — no PyPDF
    pre-processing. Provide either pdf_url (public URL) or upload via
    the /ingest/pdf-upload endpoint.
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
