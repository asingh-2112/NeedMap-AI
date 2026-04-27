import enum


class UserRole(str, enum.Enum):
    OWNER = "owner"
    ADMIN = "admin"
    VOLUNTEER = "volunteer"


class NeedCategory(str, enum.Enum):
    WATER_ACCESS = "water_access"
    FOOD = "food"
    SHELTER = "shelter"
    HEALTH = "health"
    EDUCATION = "education"
    SANITATION = "sanitation"
    CLOTHING = "clothing"
    LEGAL_AID = "legal_aid"
    MENTAL_HEALTH = "mental_health"
    TRANSPORTATION = "transportation"
    OTHER = "other"


class NeedUrgency(str, enum.Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class NeedStatus(str, enum.Enum):
    NEW = "new"
    VERIFIED = "verified"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"


class SourceType(str, enum.Enum):
    PAPER_SURVEY = "paper_survey"
    CSV_UPLOAD = "csv_upload"
    VOICE_NOTE = "voice_note"
    WHATSAPP = "whatsapp"
    TELEGRAM = "telegram"
    WEB_FORM = "web_form"
    PHONE_CALL = "phone_call"


class Proficiency(str, enum.Enum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    EXPERT = "expert"


class AssignmentStatus(str, enum.Enum):
    PROPOSED = "proposed"
    ACCEPTED = "accepted"
    DECLINED = "declined"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
