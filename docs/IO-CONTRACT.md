# NeedMap-AI — API I/O Contract

All requests to protected endpoints must include:
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

Errors follow FastAPI defaults: `{"detail": "<message>"}` with the appropriate HTTP status code.

---

## Auth  `/auth`

### `POST /auth/register`
Auth: **None**

**Request**
```json
{
  "user_name": "string",
  "email": "user@example.com",
  "password": "string",
  "role": "volunteer | admin | owner",   // default: volunteer
  "phone": "string",                     // optional
  "organization_id": 1                   // optional
}
```
**Response** `201`
```json
{
  "id": 1,
  "user_name": "string",
  "email": "user@example.com",
  "role": "volunteer",
  "organization_id": null,
  "phone": null,
  "latitude": null,
  "longitude": null,
  "radius_km": null,
  "is_active": true,
  "created_at": "2026-04-16T10:00:00Z",
  "updated_at": "2026-04-16T10:00:00Z",
  "last_seen": "2026-04-16T10:00:00Z"
}
```

---

### `POST /auth/login`
Auth: **None**

**Request**
```json
{
  "email": "user@example.com",
  "password": "string"
}
```
**Response** `200`
```json
{
  "access_token": "<jwt>",
  "token_type": "bearer"
}
```

---

### `GET /auth/me`
Auth: **Required**

**Response** `200` — same shape as UserResponse above

---

## Users  `/users`

All endpoints require auth and operate on the current authenticated user.

### `PATCH /users/me`
**Request** — provide at least one field
```json
{
  "user_name": "string",   // optional
  "phone": "string"        // optional
}
```
**Response** `200` — UserResponse

---

### `PATCH /users/me/location`
**Request**
```json
{
  "latitude": 28.6139,
  "longitude": 77.2090,
  "radius_km": 25.0       // optional — km the volunteer is willing to travel
}
```
**Response** `200` — UserResponse

---

### `PUT /users/me/password`
**Request**
```json
{
  "old_password": "string",
  "new_password": "string"
}
```
**Response** `200`
```json
{ "message": "Password changed successfully" }
```

---

### `DELETE /users/me`
**Response** `200`
```json
{ "message": "Account deactivated successfully" }
```

---

## Organizations  `/organizations`

### `POST /organizations/register`
Auth: **None** — creates org + admin user atomically

**Request**
```json
{
  "organization_name": "Red Cross Delhi",
  "admin_user_name": "admin_user",
  "admin_email": "admin@redcross.org",
  "admin_password": "string",
  "address": "string",    // optional
  "phone": "string"       // optional
}
```
**Response** `201`
```json
{
  "organization": { "id": 1, "organization_name": "...", "address": null, "phone": null, "is_active": true, "created_at": "..." },
  "admin_user": { /* UserResponse */ },
  "access_token": "<jwt>"
}
```

---

### `GET /organizations`
Auth: **Required**

**Response** `200` — `list[OrganizationResponse]`

---

### `GET /organizations/{organization_id}`
Auth: **Required**

**Response** `200` — OrganizationResponse

---

### `POST /organizations/{organization_id}/members`
Auth: **Required** (owner/admin)

**Request**
```json
{
  "user_name": "string",
  "email": "string",
  "password": "string",
  "role": "volunteer | admin | owner",
  "phone": "string"   // optional
}
```
**Response** `201` — UserResponse

---

### `PATCH /organizations/{organization_id}`
Auth: **Required**

**Request** — at least one field
```json
{
  "organization_name": "string",   // optional
  "address": "string",             // optional
  "phone": "string"                // optional
}
```
**Response** `200` — OrganizationResponse

---

### `DELETE /organizations/{organization_id}`
Auth: **Required** (owner)

**Response** `200`
```json
{ "message": "Organization deactivated successfully" }
```

---

## Needs  `/needs`

### `POST /needs`
Auth: **Required**
**Side-effect:** `priority_score` auto-computed and persisted

**Request**
```json
{
  "title": "string (2–255 chars)",
  "description": "string",         // optional
  "category": "water_access | food | shelter | health | education | sanitation | clothing | legal_aid | mental_health | transportation | other",
  "urgency": "critical | high | medium | low",   // default: medium
  "organization_id": 1,
  "latitude": 28.6139,
  "longitude": 77.2090,
  "address": "string"
}
```
**Response** `201`
```json
{
  "id": 42,
  "title": "string",
  "description": "string",
  "category": "water_access",
  "urgency": "critical",
  "status": "new",
  "organization_id": 1,
  "created_by": 7,
  "priority_score": 87.33,
  "latitude": 28.6139,
  "longitude": 77.2090,
  "address": "string",
  "created_at": "2026-04-16T10:00:00Z",
  "resolved_at": null
}
```

---

### `GET /needs`
Auth: **Required**

**Query params** (all optional)
| Param | Type | Example |
|---|---|---|
| `status` | NeedStatus | `new` |
| `urgency` | NeedUrgency | `critical` |
| `category` | NeedCategory | `water_access` |
| `organization_id` | int | `1` |

**Response** `200` — `list[NeedResponse]`

---

### `GET /needs/{need_id}`
Auth: **Required**

**Response** `200` — NeedResponse

---

### `GET /needs/heatmap`
Auth: **Required**
> Register before `/{need_id}` — static path

**Response** `200`
```json
[
  {
    "id": 42,
    "title": "string",
    "category": "water_access",
    "urgency": "critical",
    "latitude": 28.6139,
    "longitude": 77.2090
  }
]
```

---

### `PATCH /needs/{need_id}`
Auth: **Required**
**Side-effect:** `priority_score` recomputed if `urgency`, `category`, or `description` is in payload

**Request** — at least one field; `latitude + longitude + address` must be provided together if any
```json
{
  "title": "string",
  "description": "string",
  "category": "food",
  "urgency": "high",
  "status": "verified | assigned | in_progress | resolved | closed",
  "organization_id": 1,
  "latitude": 28.61,
  "longitude": 77.20,
  "address": "string"
}
```
**Response** `200` — NeedResponse

---

### `DELETE /needs/{need_id}`
Auth: **Required**

**Response** `200`
```json
{ "message": "Need closed successfully" }
```

---

### `POST /needs/{need_id}/compute-priority`   *(ML)*
Auth: **Required**
Manually triggers priority score recomputation.

**Response** `200` — NeedResponse (with updated `priority_score`)

---

### `GET /needs/{need_id}/suggest-volunteers`   *(ML)*
Auth: **Required**
Returns volunteers ranked by composite match score for this need.

**Query params**
| Param | Type | Default | Description |
|---|---|---|---|
| `organization_id` | int | — | Filter to one org |
| `verified_only` | bool | `false` | Only verified volunteers |
| `limit` | int | `20` | Max results (1–100) |

**Response** `200`
```json
{
  "need_id": 42,
  "scored_volunteers": [
    {
      "volunteer_id": 3,
      "composite_score": 74.5,
      "skill_score": 40.0,
      "geo_score": 80.0,
      "reliability_score": 60.0,
      "availability_score": 100.0
    }
  ]
}
```

---

### `POST /needs/ocr-extract`   *(ML)*
Auth: **Required**
> Register before `/{need_id}` — static path

Runs OCR on a public image URL. Optionally creates a NeedSource record.

**Request**
```json
{
  "image_url": "https://storage.example.com/scans/form-123.jpg",
  "need_id": 42   // optional — if provided, creates NeedSource
}
```
**Response** `200`
```json
{
  "source_id": 7,              // null if need_id was not provided
  "need_id": 42,               // null if need_id was not provided
  "multimedia_txt": "Urgent: no water supply in Block 4...",
  "ai_extraction": "{\"category_hint\": \"water_access\", \"urgency_hint\": \"critical\", ...}",
  "structured": {
    "category_hint": "water_access",
    "urgency_hint": "critical",
    "address_hint": "Block 4, Sector 12",
    "description": "Urgent: no water supply in Block 4...",
    "keywords_found": ["urgent", "no water"]
  },
  "category_hint": "water_access",
  "urgency_hint": "critical",
  "address_hint": "Block 4, Sector 12"
}
```
**Errors**
| Code | When |
|---|---|
| `400` | `image_url` is empty |
| `400` | Image yields no readable text |
| `404` | `need_id` doesn't exist |

---

### `POST /needs/{need_id}/sources`
Auth: **Required**

**Request**
```json
{
  "source_type": "paper_survey | csv_upload | voice_note | whatsapp | telegram | web_form | phone_call",
  "location": "string (≤100 chars)",   // optional — URL or physical ref
  "multimedia_txt": "string (≤500)",   // optional
  "ai_extraction": "string (≤500)"     // optional — JSON string
}
```
**Response** `201`
```json
{
  "id": 7,
  "need_id": 42,
  "source_type": "paper_survey",
  "location": "https://...",
  "multimedia_txt": "...",
  "ai_extraction": "...",
  "processed_at": null,
  "created_at": "2026-04-16T10:00:00Z"
}
```

---

### `GET /needs/{need_id}/sources`
Auth: **Required**

**Response** `200` — `list[NeedSourceResponse]`

---

## Volunteers  `/volunteers`

### `POST /volunteers`
Auth: **Required**
**Side-effect:** if `bio` is provided, skills are extracted via ML and auto-registered at `beginner` proficiency

**Request**
```json
{
  "organization_id": 1,    // optional
  "bio": "I am a nurse and have experience in first aid and counseling"   // optional
}
```
**Response** `201`
```json
{
  "id": 3,
  "user_id": 7,
  "organization_id": 1,
  "availability": true,
  "rating": null,
  "tasks_completed": 0,
  "active_tasks": 0,
  "is_active": true,
  "verified": false,
  "skills": [
    { "id": 1, "skill_name": "medical",    "proficiency": "beginner" },
    { "id": 2, "skill_name": "counseling", "proficiency": "beginner" }
  ],
  "created_at": "2026-04-16T10:00:00Z"
}
```

---

### `GET /volunteers`
Auth: **Required**

**Query params** (all optional)
| Param | Type |
|---|---|
| `availability` | bool |
| `organization_id` | int |
| `verified` | bool |

**Response** `200` — `list[VolunteerResponse]`

---

### `GET /volunteers/{volunteer_id}`
Auth: **Required**

**Response** `200` — VolunteerResponse

---

### `PATCH /volunteers/{volunteer_id}`
Auth: **Required**

**Request** — at least one field
```json
{
  "availability": false,
  "organization_id": 2
}
```
**Response** `200` — VolunteerResponse

---

### `POST /volunteers/{volunteer_id}/skills`
Auth: **Required**

**Request**
```json
{
  "skill_name": "medical",
  "proficiency": "beginner | intermediate | expert"
}
```
**Response** `201`
```json
{
  "id": 5,
  "volunteer_id": 3,
  "skill_name": "medical",
  "proficiency": "intermediate"
}
```

---

### `PATCH /volunteers/{volunteer_id}/skills/{skill_id}`
Auth: **Required**

**Request**
```json
{
  "proficiency": "expert"
}
```
**Response** `200` — VolunteerSkillResponse

---

### `DELETE /volunteers/{volunteer_id}/skills/{skill_id}`
Auth: **Required**

**Response** `200`
```json
{ "message": "Skill removed successfully" }
```

---

## Assignments  `/assignments`

### `POST /assignments`
Auth: **Required** (owner or admin only)
**Side-effect:** if `match_score` omitted, it is auto-computed via ML and stored

**Request**
```json
{
  "need_id": 42,
  "volunteer_id": 3,
  "organization_id": 1,
  "match_score": 74.5   // optional — auto-computed if omitted
}
```
**Response** `201`
```json
{
  "id": 11,
  "need_id": 42,
  "volunteer_id": 3,
  "organization_id": 1,
  "status": "proposed",
  "match_score": 74.5,
  "assigned_at": "2026-04-16T10:00:00Z",
  "accepted_at": null,
  "completed_at": null,
  "feedback": null,
  "rating": null
}
```

---

### `GET /assignments`
Auth: **Required**

**Query params** (all optional)
| Param | Type |
|---|---|
| `need_id` | int |
| `volunteer_id` | int |
| `organization_id` | int |
| `status` | AssignmentStatus |

**Response** `200` — `list[AssignmentResponse]`

---

### `GET /assignments/{assignment_id}`
Auth: **Required**

**Response** `200` — AssignmentResponse

---

### `PATCH /assignments/{assignment_id}/status`
Auth: **Required**

**Valid transitions**
```
proposed  →  accepted | declined | cancelled
accepted  →  in_progress | cancelled
declined  →  cancelled
in_progress  →  completed | cancelled
completed →  cancelled
```

**Request**
```json
{
  "status": "accepted | declined | in_progress | completed | cancelled"
}
```
**Response** `200` — AssignmentResponse

---

### `PATCH /assignments/{assignment_id}/feedback`
Auth: **Required**

**Request** — at least one field
```json
{
  "feedback": "Volunteer arrived on time and resolved the issue.",
  "rating": 4.5
}
```
**Response** `200` — AssignmentResponse
> When `rating` is provided, volunteer's average rating is automatically recalculated.

---

## Enum Reference

| Enum | Values |
|---|---|
| `NeedCategory` | `water_access` `food` `shelter` `health` `education` `sanitation` `clothing` `legal_aid` `mental_health` `transportation` `other` |
| `NeedUrgency` | `critical` `high` `medium` `low` |
| `NeedStatus` | `new` `verified` `assigned` `in_progress` `resolved` `closed` |
| `SourceType` | `paper_survey` `csv_upload` `voice_note` `whatsapp` `telegram` `web_form` `phone_call` |
| `Proficiency` | `beginner` `intermediate` `expert` |
| `AssignmentStatus` | `proposed` `accepted` `declined` `in_progress` `completed` `cancelled` |
| `UserRole` | `owner` `admin` `volunteer` |
