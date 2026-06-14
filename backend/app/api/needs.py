from datetime import datetime, timezone
import os
import tempfile
import json

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.ml.llm_extraction import (
    extract_need_from_audio,
    extract_need_from_image,
    extract_need_from_pdf,
    extract_need_from_text,
)
from app.ml.matching import score_volunteers_for_need
from app.ml.ocr import run_ocr_pipeline
from app.ml.priority import compute_priority_score
from app.models.enums import NeedCategory, NeedStatus, NeedUrgency, SourceType
from app.models.user import User
from app.schemas.need import (
    IngestResponse,
    NeedCreateRequest,
    NeedHeatmapItem,
    NeedResponse,
    NeedSourceCreateRequest,
    NeedSourceResponse,
    NeedUpdateRequest,
    OCRExtractRequest,
    OCRExtractionResponse,
    PDFIngestRequest,
    SuggestVolunteersResponse,
    TextIngestRequest,
    VolunteerMatchResult,
    VoiceIngestRequest,
)
from app.services.need_service import (
    add_need_source,
    close_need,
    count_nearby_open_needs,
    count_need_sources,
    create_need,
    get_need_by_id,
    list_need_heatmap_items,
    list_need_sources,
    list_needs,
    set_priority_score,
    update_need,
)
from app.services.volunteer_service import list_volunteers_with_relations

router = APIRouter(prefix="/needs", tags=["Needs"])

# Fields whose change should trigger a priority recompute on PATCH
_PRIORITY_RELEVANT_FIELDS = {"urgency", "category", "description"}


def _auto_score_priority(db: Session, need) -> None:
    """Compute and persist priority_score for a need. Used in auto-triggers."""
    nearby = count_nearby_open_needs(db, need.latitude, need.longitude)
    created_at = need.created_at
    if created_at is not None:
        # SQLite returns naive datetimes; normalise before subtraction
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        days = (datetime.now(timezone.utc) - created_at).days
    else:
        days = 0
    source_count = count_need_sources(db, need.id)
    score = compute_priority_score(
        urgency=need.urgency.value,
        category=need.category.value,
        source_count=source_count,
        description=need.description,
        nearby_open_needs_count=nearby,
        days_since_created=days,
    )
    set_priority_score(db, need, score)


def _to_bool(v: str | bool | None, default: bool = True) -> bool:
    if v is None:
        return default
    if isinstance(v, bool):
        return v
    return str(v).strip().lower() in {"1", "true", "yes", "on"}


def _tmp_file_from_upload(upload: UploadFile, suffix: str = "") -> str:
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp_path = tmp.name
        upload.file.seek(0)
        tmp.write(upload.file.read())
    return tmp_path


def _safe_text_preview(raw: bytes, limit: int = 500) -> str:
    for enc in ("utf-8", "latin-1"):
        try:
            return raw.decode(enc, errors="ignore").strip()[:limit]
        except Exception:
            continue
    return ""


@router.post("", response_model=NeedResponse, status_code=status.HTTP_201_CREATED)
def create_need_route(
    payload: NeedCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    need = create_need(db=db, current_user=current_user, payload=payload)
    _auto_score_priority(db, need)
    return need


@router.get("", response_model=list[NeedResponse])
def list_needs_route(
    status: NeedStatus | None = None,
    urgency: NeedUrgency | None = None,
    category: NeedCategory | None = None,
    organization_id: int | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return list_needs(
        db=db,
        current_user=current_user,
        status_filter=status,
        urgency_filter=urgency,
        category_filter=category,
        organization_id=organization_id,
    )


# ── Static sub-paths must come before /{need_id} ─────────────────────────────

@router.post(
    "/ingest/upload",
    response_model=IngestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Ingest uploaded file (image/audio/pdf/csv) → extraction → structured Need",
)
def ingest_upload_route(
    file: UploadFile = File(...),
    source_type: str = Form(...),
    organization_id: int = Form(...),
    latitude: float = Form(0.0),
    longitude: float = Form(0.0),
    address: str = Form(""),
    create_need: str = Form("true"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    st = source_type.strip().lower()
    if st not in {"image", "voice_note", "document", "csv_upload", "web_form"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="source_type must be one of: image, voice_note, document, csv_upload, web_form",
        )

    file_bytes = file.file.read()
    if not file_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty")

    parsed_create_need = _to_bool(create_need, default=True)
    extracted: dict
    raw_text = ""
    tmp_path: str | None = None

    try:
        if st == "image":
            suffix = os.path.splitext(file.filename or "")[1] or ".jpg"
            tmp_path = _tmp_file_from_upload(file, suffix=suffix)
            extracted = extract_need_from_image(f"file://{tmp_path}")
            raw_text = extracted.get("multimedia_txt", extracted.get("description", ""))
            source_enum = SourceType.IMAGE

        elif st == "voice_note":
            suffix = os.path.splitext(file.filename or "")[1] or ".mp3"
            tmp_path = _tmp_file_from_upload(file, suffix=suffix)
            extracted = extract_need_from_audio(audio_url=f"file://{tmp_path}")
            raw_text = extracted.pop("raw_text", "")
            source_enum = SourceType.VOICE_NOTE

        elif st == "document":
            extracted = extract_need_from_pdf(pdf_bytes=file_bytes)
            raw_text = extracted.pop("multimedia_txt", extracted.get("description", ""))
            source_enum = SourceType.DOCUMENT

        elif st in {"csv_upload", "web_form"}:
            raw_text = _safe_text_preview(file_bytes, limit=5000)
            if len(raw_text) < 10:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Uploaded text/CSV file does not contain enough readable content",
                )
            extracted = extract_need_from_text(raw_text)
            source_enum = SourceType.CSV_UPLOAD if st == "csv_upload" else SourceType.WEB_FORM

        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported source_type")

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"File ingestion failed: {exc}") from exc
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

    need_id = source_id = None
    if parsed_create_need:
        need_id, source_id = _create_need_from_extraction(
            db=db,
            current_user=current_user,
            extracted=extracted,
            payload_org_id=organization_id,
            payload_lat=latitude,
            payload_lng=longitude,
            payload_address=address,
            source_type=source_enum,
            raw_text=raw_text,
        )

    return IngestResponse(
        category=extracted["category"],
        urgency=extracted["urgency"],
        location=extracted.get("location"),
        description=extracted["description"],
        skills_required=extracted["skills_required"],
        affected_count=extracted.get("affected_count"),
        confidence=extracted["confidence"],
        model_used=extracted.get("model_used", "uploaded_file_ingest"),
        need_id=need_id,
        source_id=source_id,
        raw_text=raw_text[:500],
    )


@router.post(
    "/{need_id}/sources/upload",
    response_model=NeedSourceResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Attach uploaded file as a source to an existing need",
)
def add_need_source_upload_route(
    need_id: int,
    file: UploadFile = File(...),
    source_type: str = Form(...),
    location: str | None = Form(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    st = source_type.strip().lower()
    if st not in {"image", "voice_note", "document", "csv_upload", "web_form", "paper_survey"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid source_type for upload",
        )

    source_map = {
        "image": SourceType.IMAGE,
        "voice_note": SourceType.VOICE_NOTE,
        "document": SourceType.DOCUMENT,
        "csv_upload": SourceType.CSV_UPLOAD,
        "web_form": SourceType.WEB_FORM,
        "paper_survey": SourceType.PAPER_SURVEY,
    }
    raw = file.file.read()
    preview = _safe_text_preview(raw)
    ai_payload = json.dumps(
        {
            "file_name": file.filename,
            "content_type": file.content_type,
            "size_bytes": len(raw),
        },
        ensure_ascii=False,
    )[:500]

    return add_need_source(
        db=db,
        need_id=need_id,
        payload=NeedSourceCreateRequest(
            source_type=source_map[st],
            location=(location or file.filename or "")[:100] or None,
            multimedia_txt=preview or None,
            ai_extraction=ai_payload,
        ),
        current_user=current_user,
    )


@router.post(
    "/ocr-extract",
    response_model=OCRExtractionResponse,
    summary="Extract structured data from an image URL using OCR",
)
def ocr_extract_route(
    payload: OCRExtractRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not payload.image_url.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="image_url is required")

    try:
        result = run_ocr_pipeline(payload.image_url)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    source_id: int | None = None
    if payload.need_id is not None:
        source = add_need_source(
            db=db,
            need_id=payload.need_id,
            payload=NeedSourceCreateRequest(
                source_type=SourceType.IMAGE,
                location=payload.image_url[:100],
                multimedia_txt=result["multimedia_txt"],
                ai_extraction=result["ai_extraction"],
            ),
            current_user=current_user,
        )
        source_id = source.id

    structured = result["structured"]
    return OCRExtractionResponse(
        source_id=source_id,
        need_id=payload.need_id,
        multimedia_txt=result["multimedia_txt"],
        ai_extraction=result["ai_extraction"],
        structured=structured,
        category_hint=structured.get("category_hint"),
        urgency_hint=structured.get("urgency_hint"),
        address_hint=structured.get("address_hint"),
    )


def _create_need_from_extraction(
    db: Session,
    current_user: User,
    extracted: dict,
    payload_org_id: int,
    payload_lat: float,
    payload_lng: float,
    payload_address: str,
    source_type: "SourceType",
    raw_text: str,
) -> tuple[int, int]:
    """
    Shared helper: create a Need + NeedSource from LLM-extracted data.
    Returns (need_id, source_id).
    """
    # Derive address: request value → LLM location → fallback
    address = (
        payload_address.strip()
        or extracted.get("location")
        or "Location not specified"
    )

    need = create_need(
        db=db,
        current_user=current_user,
        payload=NeedCreateRequest(
            title=extracted["description"][:100],
            description=extracted["description"],
            category=extracted["category"],
            urgency=extracted["urgency"],
            organization_id=payload_org_id,
            latitude=payload_lat,
            longitude=payload_lng,
            address=address,
        ),
    )
    _auto_score_priority(db, need)

    import json as _json
    source = add_need_source(
        db=db,
        need_id=need.id,
        payload=NeedSourceCreateRequest(
            source_type=source_type,
            location=(extracted.get("location") or "")[:100] or None,
            multimedia_txt=raw_text[:500],
            ai_extraction=_json.dumps({
                k: v for k, v in extracted.items() if k != "model_used"
            }, ensure_ascii=False)[:500],
        ),
        current_user=current_user,
    )
    return need.id, source.id


@router.post(
    "/ingest/text",
    response_model=IngestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Ingest raw text → LLM extraction → structured Need",
)
def ingest_text_route(
    payload: TextIngestRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Accept any raw community text (field note, WhatsApp message, web-form
    submission) and use the LLM to extract a structured need record.

    If `create_need=true` (default), a Need and NeedSource are persisted.
    """
    extracted = extract_need_from_text(payload.raw_text)

    need_id = source_id = None
    if payload.create_need:
        need_id, source_id = _create_need_from_extraction(
            db=db,
            current_user=current_user,
            extracted=extracted,
            payload_org_id=payload.organization_id,
            payload_lat=payload.latitude,
            payload_lng=payload.longitude,
            payload_address=payload.address,
            source_type=SourceType.WEB_FORM,
            raw_text=payload.raw_text,
        )

    return IngestResponse(
        category=extracted["category"],
        urgency=extracted["urgency"],
        location=extracted.get("location"),
        description=extracted["description"],
        skills_required=extracted["skills_required"],
        affected_count=extracted.get("affected_count"),
        confidence=extracted["confidence"],
        model_used=extracted["model_used"],
        need_id=need_id,
        source_id=source_id,
        raw_text=payload.raw_text[:500],
    )


@router.post(
    "/ingest/voice",
    response_model=IngestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Ingest voice note → Whisper transcription → LLM extraction → structured Need",
)
def ingest_voice_route(
    payload: VoiceIngestRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Accept a voice recording URL or pre-transcribed text.

    Flow:
      1. If `audio_url` provided → Whisper (via Portkey/OpenAI) transcribes it.
      2. If `transcription` provided → used directly.
      3. LLM extracts structured need record from the transcription.
      4. If `create_need=true`, Need + NeedSource persisted.
    """
    # Single-stage: audio → LLM extraction (Whisper transcription if needed)
    try:
        extracted = extract_need_from_audio(
            audio_url=payload.audio_url,
            transcription=payload.transcription,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        )
    raw_text = extracted.pop("raw_text", payload.transcription or "")

    # Step 3: persist
    need_id = source_id = None
    if payload.create_need:
        need_id, source_id = _create_need_from_extraction(
            db=db,
            current_user=current_user,
            extracted=extracted,
            payload_org_id=payload.organization_id,
            payload_lat=payload.latitude,
            payload_lng=payload.longitude,
            payload_address=payload.address,
            source_type=SourceType.VOICE_NOTE,
            raw_text=raw_text,
        )

    return IngestResponse(
        category=extracted["category"],
        urgency=extracted["urgency"],
        location=extracted.get("location"),
        description=extracted["description"],
        skills_required=extracted["skills_required"],
        affected_count=extracted.get("affected_count"),
        confidence=extracted["confidence"],
        model_used=extracted["model_used"],
        need_id=need_id,
        source_id=source_id,
        raw_text=raw_text[:500],
    )


@router.post(
    "/ingest/pdf",
    response_model=IngestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Ingest PDF document → LLM vision extraction → structured Need",
)
def ingest_pdf_route(
    payload: PDFIngestRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Accept a PDF document URL.  Pages are rendered to images and sent
    directly to the LLM vision model — no PyPDF text-extraction stage.
    """
    try:
        extracted = extract_need_from_pdf(pdf_url=payload.pdf_url)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        )

    raw_text = extracted.pop("multimedia_txt", "")

    need_id = source_id = None
    if payload.create_need:
        need_id, source_id = _create_need_from_extraction(
            db=db,
            current_user=current_user,
            extracted=extracted,
            payload_org_id=payload.organization_id,
            payload_lat=payload.latitude,
            payload_lng=payload.longitude,
            payload_address=payload.address,
            source_type=SourceType.DOCUMENT,
            raw_text=raw_text,
        )

    return IngestResponse(
        category=extracted["category"],
        urgency=extracted["urgency"],
        location=extracted.get("location"),
        description=extracted["description"],
        skills_required=extracted["skills_required"],
        affected_count=extracted.get("affected_count"),
        confidence=extracted["confidence"],
        model_used=extracted["model_used"],
        need_id=need_id,
        source_id=source_id,
        raw_text=raw_text[:500],
    )


@router.get("/heatmap", response_model=list[NeedHeatmapItem])
def heatmap_needs_route(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    items = list_need_heatmap_items(db=db, current_user=current_user)
    return [
        NeedHeatmapItem(
            id=item.id,
            title=item.title,
            category=item.category,
            urgency=item.urgency,
            latitude=item.latitude,
            longitude=item.longitude,
        )
        for item in items
    ]


# ── Parameterised routes ──────────────────────────────────────────────────────

@router.get("/{need_id}", response_model=NeedResponse)
def get_need_route(
    need_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_need_by_id(db=db, need_id=need_id, current_user=current_user)


@router.patch("/{need_id}", response_model=NeedResponse)
def update_need_route(
    need_id: int,
    payload: NeedUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    updated = update_need(db=db, current_user=current_user, need_id=need_id, payload=payload)
    if payload.model_fields_set & _PRIORITY_RELEVANT_FIELDS:
        _auto_score_priority(db, updated)
    return updated


@router.delete("/{need_id}", status_code=status.HTTP_200_OK)
def close_need_route(
    need_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    close_need(db=db, current_user=current_user, need_id=need_id)
    return {"message": "Need deleted successfully"}


@router.post(
    "/{need_id}/compute-priority",
    response_model=NeedResponse,
    summary="Manually trigger priority score computation for a need",
)
def compute_priority_route(
    need_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    need = get_need_by_id(db=db, need_id=need_id, current_user=current_user)
    _auto_score_priority(db, need)
    return need


@router.get(
    "/{need_id}/suggest-volunteers",
    response_model=SuggestVolunteersResponse,
    summary="Rank volunteers by match score for a given need",
)
def suggest_volunteers_route(
    need_id: int,
    organization_id: int | None = None,
    verified_only: bool = False,
    limit: int = Query(default=20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    need = get_need_by_id(db=db, need_id=need_id, current_user=current_user)
    volunteers = list_volunteers_with_relations(
        db,
        organization_id=organization_id if organization_id is not None else need.organization_id,
        verified=True if verified_only else None,
    )
    scored = score_volunteers_for_need(volunteers, need)[:limit]
    return SuggestVolunteersResponse(
        need_id=need_id,
        scored_volunteers=[VolunteerMatchResult(**s) for s in scored],
    )


@router.post("/{need_id}/sources", response_model=NeedSourceResponse, status_code=status.HTTP_201_CREATED)
def add_need_source_route(
    need_id: int,
    payload: NeedSourceCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return add_need_source(db=db, need_id=need_id, payload=payload, current_user=current_user)


@router.get("/{need_id}/sources", response_model=list[NeedSourceResponse])
def list_need_sources_route(
    need_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return list_need_sources(db=db, need_id=need_id, current_user=current_user)
