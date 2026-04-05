# NeedMap AI — Backend API Documentation

> Base URL: `http://localhost:8000`  
> All request bodies use `Content-Type: application/json`  
> Protected routes require `Authorization: Bearer <access_token>` header  
> All timestamps are ISO 8601 UTC (e.g., `2026-04-05T12:34:56Z`)

---

## Table of Contents

1. [Auth](#1-auth)
2. [Users](#2-users)
3. [Organizations](#3-organizations)
4. [Needs](#4-needs)
5. [Need Sources](#5-need-sources)
6. [Volunteers](#6-volunteers)
7. [Volunteer Skills](#7-volunteer-skills)
8. [Assignments](#8-assignments)
9. [System](#9-system)
10. [Enum Reference](#10-enum-reference)

---

## 1. Auth

### `POST /auth/register`
Create a new user account.  
**Auth required:** No

**Request Body**
```json
{
  "user_name": "Abhishek Singh",
  "email": "aksingh@example.com",
  "password": "StrongPass@123",
  "role": "volunteer",
  "phone": "+91XXXXXXXXXX",
  "latitude": 28.6139,
  "longitude": 77.2090,
  "radius_km": 5.0
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `user_name` | `string` | ✅ | 2–255 chars |
| `email` | `string` | ✅ | Must be unique, valid email format |
| `password` | `string` | ✅ | Min 8 chars |
| `role` | `string` enum | ✅ | See [Enum Reference](#10-enum-reference) |
| `phone` | `string \| null` | ❌ | |
| `latitude` | `number \| null` | ❌ | -90 to 90; send with browser geolocation |
| `longitude` | `number \| null` | ❌ | -180 to 180; send with browser geolocation |
| `radius_km` | `number \| null` | ❌ | Must be > 0 |

**Location collection recommendation**
- Frontend should use browser geolocation (`navigator.geolocation`) and send coordinates.
- `latitude` and `longitude` must be sent together (or both omitted).
- User can register without location and set it later using `PATCH /users/me/location`.

**Success Response `201`**
```json
{
  "id": 1,
  "user_name": "Abhishek Singh",
  "email": "aksingh@example.com",
  "role": "volunteer",
  "phone": "+91XXXXXXXXXX",
  "organization_id": null,
  "latitude": 28.6139,
  "longitude": 77.2090,
  "radius_km": 5.0,
  "is_active": true,
  "created_at": "2026-04-05T12:34:56Z"
}
```

**Error Responses**
| Code | Reason |
|------|--------|
| `409` | Email already exists |
| `422` | Validation error (missing/invalid fields) |

---

### `POST /auth/login`
Authenticate and receive a JWT token.  
**Auth required:** No

**Request Body**
```json
{
  "email": "aksingh@example.com",
  "password": "StrongPass@123"
}
```

| Field | Type | Required |
|-------|------|----------|
| `email` | `string` | ✅ |
| `password` | `string` | ✅ |

**Success Response `200`**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 3600
}
```

**Error Responses**
| Code | Reason |
|------|--------|
| `401` | Invalid email or password |
| `403` | Account is inactive |

---

### `GET /auth/me`
Get the currently authenticated user's profile.  
**Auth required:** Yes

**Request Body:** None

**Success Response `200`**
```json
{
  "id": 1,
  "user_name": "Abhishek Singh",
  "email": "aksingh@example.com",
  "role": "volunteer",
  "phone": "+91XXXXXXXXXX",
  "organization_id": null,
  "latitude": 28.6139,
  "longitude": 77.2090,
  "radius_km": 5.0,
  "is_active": true,
  "last_seen": "2026-04-05T12:50:00Z",
  "created_at": "2026-04-05T12:34:56Z"
}
```

**Error Responses**
| Code | Reason |
|------|--------|
| `401` | Missing, invalid, or expired token |

---

## 2. Users

### `PATCH /users/me/location`
Set or update the logged-in user's location and matching radius.  
**Auth required:** Yes

**Request Body**
```json
{
  "latitude": 28.6139,
  "longitude": 77.2090,
  "radius_km": 5.0
}
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `latitude` | `number \| null` | ❌ | -90 to 90; must come with `longitude` |
| `longitude` | `number \| null` | ❌ | -180 to 180; must come with `latitude` |
| `radius_km` | `number \| null` | ❌ | Must be > 0 |

Validation rules:
- Send both `latitude` and `longitude` together.
- You can update only `radius_km` without coordinates.
- At least one of these must be provided: coordinate pair or `radius_km`.

**Success Response `200`**
```json
{
  "id": 1,
  "user_name": "Abhishek Singh",
  "email": "aksingh@example.com",
  "role": "volunteer",
  "phone": "+91XXXXXXXXXX",
  "organization_id": null,
  "latitude": 28.6139,
  "longitude": 77.2090,
  "radius_km": 5.0,
  "is_active": true,
  "last_seen": null,
  "created_at": "2026-04-05T12:34:56Z"
}
```

**Error Responses**
| Code | Reason |
|------|--------|
| `401` | Missing, invalid, or expired token |
| `422` | Invalid coordinates or payload validation failed |

---

## 3. Organizations

### `POST /organizations`
Create a new organization. Caller becomes the owner.  
**Auth required:** Yes (`admin` or `ngo_coordinator` role)

**Request Body**
```json
{
  "organization_name": "Hope Foundation",
  "address": "12 Main Street, Delhi",
  "phone": "+911234567890"
}
```

| Field | Type | Required |
|-------|------|----------|
| `organization_name` | `string` | ✅ |
| `address` | `string \| null` | ❌ |
| `phone` | `string \| null` | ❌ |

**Success Response `201`**
```json
{
  "id": 1,
  "organization_name": "Hope Foundation",
  "address": "12 Main Street, Delhi",
  "phone": "+911234567890",
  "user_id": 1,
  "is_active": true,
  "created_at": "2026-04-05T12:00:00Z"
}
```

---

### `GET /organizations`
List all active organizations.  
**Auth required:** Yes

**Query Parameters:** None (filters can be added later)

**Success Response `200`**
```json
[
  {
    "id": 1,
    "organization_name": "Hope Foundation",
    "address": "12 Main Street, Delhi",
    "phone": "+911234567890",
    "user_id": 1,
    "is_active": true,
    "created_at": "2026-04-05T12:00:00Z"
  }
]
```

---

### `GET /organizations/{organization_id}`
Get details of a single organization.  
**Auth required:** Yes

**Success Response `200`** — same as single item above

**Error Responses**
| Code | Reason |
|------|--------|
| `404` | Organization not found |

---

### `PATCH /organizations/{organization_id}`
Update organization fields.  
**Auth required:** Yes (owner or admin only)

**Request Body** (all fields optional)
```json
{
  "organization_name": "Hope Foundation Updated",
  "address": "New Address",
  "phone": "+911234567891",
  "is_active": true
}
```

**Success Response `200`** — updated organization object

**Error Responses**
| Code | Reason |
|------|--------|
| `403` | Not the owner or admin |
| `404` | Not found |

---

### `DELETE /organizations/{organization_id}`
Soft-delete (deactivate) an organization (`is_active = false`).  
**Auth required:** Yes (owner or admin only)

**Success Response `200`**
```json
{ "message": "Organization deactivated successfully" }
```

---

## 4. Needs

### `POST /needs`
Create a new community need.  
**Auth required:** Yes

**Request Body**
```json
{
  "title": "Clean water needed in Block C",
  "description": "Residents have had no tap water for 3 days",
  "category": "water_access",
  "urgency": "critical",
  "organization_id": 1,
  "latitude": 28.6139,
  "longitude": 77.2090,
  "address": "Block C, Sector 7, Delhi"
}
```

| Field | Type | Required |
|-------|------|----------|
| `title` | `string` | ✅ |
| `description` | `string \| null` | ❌ |
| `category` | `string` enum | ✅ |
| `urgency` | `string` enum | ✅ |
| `organization_id` | `integer` | ✅ |
| `latitude` | `number \| null` | ❌ |
| `longitude` | `number \| null` | ❌ |
| `address` | `string \| null` | ❌ |

**Success Response `201`**
```json
{
  "id": 1,
  "title": "Clean water needed in Block C",
  "description": "Residents have had no tap water for 3 days",
  "category": "water_access",
  "urgency": "critical",
  "status": "new",
  "organization_id": 1,
  "created_by": 1,
  "priority_score": null,
  "latitude": 28.6139,
  "longitude": 77.2090,
  "address": "Block C, Sector 7, Delhi",
  "created_at": "2026-04-05T12:00:00Z"
}
```

---

### `GET /needs`
List needs with optional filters.  
**Auth required:** Yes

**Query Parameters**
| Param | Type | Example |
|-------|------|---------|
| `status` | `string` enum | `?status=new` |
| `urgency` | `string` enum | `?urgency=critical` |
| `category` | `string` enum | `?category=food` |
| `organization_id` | `integer` | `?organization_id=1` |

**Success Response `200`** — array of need objects

---

### `GET /needs/heatmap`
Get needs with geo coordinates for map rendering.  
**Auth required:** Yes

**Success Response `200`**
```json
[
  {
    "id": 1,
    "title": "Clean water needed in Block C",
    "category": "water_access",
    "urgency": "critical",
    "latitude": 28.6139,
    "longitude": 77.2090
  }
]
```

---

### `GET /needs/{need_id}`
Get details of a single need.  
**Auth required:** Yes

**Error Responses**
| Code | Reason |
|------|--------|
| `404` | Need not found |

---

### `PATCH /needs/{need_id}`
Update need fields (status, priority_score, etc.).  
**Auth required:** Yes

**Request Body** (all optional)
```json
{
  "status": "verified",
  "urgency": "high",
  "priority_score": 87.5,
  "resolved_at": "2026-04-06T10:00:00Z"
}
```

---

### `DELETE /needs/{need_id}`
Soft-close a need (`status = closed`).  
**Auth required:** Yes

**Success Response `200`**
```json
{ "message": "Need closed successfully" }
```

---

## 5. Need Sources

### `POST /needs/{need_id}/sources`
Add a raw source record to a need.  
**Auth required:** Yes

**Request Body**
```json
{
  "source_type": "voice_note",
  "location": "Block C Gate",
  "multimedia_txt": "Transcribed text of the voice note",
  "ai_extraction": "Extracted structured data by AI"
}
```

| Field | Type | Required |
|-------|------|----------|
| `source_type` | `string` enum | ✅ |
| `location` | `string \| null` | ❌ |
| `multimedia_txt` | `string \| null` | ❌ |
| `ai_extraction` | `string \| null` | ❌ |

**Success Response `201`** — created source object

---

### `GET /needs/{need_id}/sources`
List all source records for a need.  
**Auth required:** Yes

**Success Response `200`** — array of source objects

---

## 6. Volunteers

### `POST /volunteers`
Create a volunteer profile for the authenticated user.  
**Auth required:** Yes (role must be `volunteer`)

**Request Body**
```json
{
  "organization_id": 1,
  "availability": true
}
```

| Field | Type | Required |
|-------|------|----------|
| `organization_id` | `integer \| null` | ❌ |
| `availability` | `boolean` | ❌ default `true` |

**Success Response `201`**
```json
{
  "id": 1,
  "user_id": 2,
  "organization_id": 1,
  "availability": true,
  "rating": null,
  "tasks_completed": 0,
  "active_tasks": 0,
  "is_active": true,
  "verified": false,
  "created_at": "2026-04-05T12:00:00Z"
}
```

---

### `GET /volunteers`
List volunteers with optional filters.  
**Auth required:** Yes

**Query Parameters**
| Param | Type | Example |
|-------|------|---------|
| `availability` | `boolean` | `?availability=true` |
| `organization_id` | `integer` | `?organization_id=1` |
| `verified` | `boolean` | `?verified=true` |

**Success Response `200`** — array of volunteer objects

---

### `GET /volunteers/{volunteer_id}`
Get volunteer details including skills.  
**Auth required:** Yes

**Error Responses**
| Code | Reason |
|------|--------|
| `404` | Volunteer not found |

---

### `PATCH /volunteers/{volunteer_id}`
Update volunteer profile.  
**Auth required:** Yes (owner or admin only)

**Request Body** (all optional)
```json
{
  "availability": false,
  "organization_id": 2,
  "verified": true
}
```

---

## 7. Volunteer Skills

### `POST /volunteers/{volunteer_id}/skills`
Add a skill to a volunteer.  
**Auth required:** Yes

**Request Body**
```json
{
  "skill_name": "First Aid",
  "proficiency": "intermediate"
}
```

| Field | Type | Required |
|-------|------|----------|
| `skill_name` | `string` | ✅ |
| `proficiency` | `string` enum | ✅ |

**Success Response `201`**
```json
{
  "id": 1,
  "volunteer_id": 1,
  "skill_name": "First Aid",
  "proficiency": "intermediate"
}
```

---

### `PATCH /volunteers/{volunteer_id}/skills/{skill_id}`
Update skill proficiency level.  
**Auth required:** Yes

**Request Body**
```json
{ "proficiency": "expert" }
```

---

### `DELETE /volunteers/{volunteer_id}/skills/{skill_id}`
Remove a skill from a volunteer.  
**Auth required:** Yes

**Success Response `200`**
```json
{ "message": "Skill removed successfully" }
```

---

## 8. Assignments

### `POST /assignments`
Assign a volunteer to a need.  
**Auth required:** Yes (`ngo_coordinator` or `admin`)

**Request Body**
```json
{
  "need_id": 1,
  "volunteer_id": 2,
  "organization_id": 1,
  "match_score": 91.5
}
```

| Field | Type | Required |
|-------|------|----------|
| `need_id` | `integer` | ✅ |
| `volunteer_id` | `integer` | ✅ |
| `organization_id` | `integer` | ✅ |
| `match_score` | `number \| null` | ❌ |

**Success Response `201`**
```json
{
  "id": 1,
  "need_id": 1,
  "volunteer_id": 2,
  "organization_id": 1,
  "status": "proposed",
  "match_score": 91.5,
  "assigned_at": "2026-04-05T13:00:00Z"
}
```

---

### `GET /assignments`
List assignments with optional filters.  
**Auth required:** Yes

**Query Parameters**
| Param | Type | Example |
|-------|------|---------|
| `need_id` | `integer` | `?need_id=1` |
| `volunteer_id` | `integer` | `?volunteer_id=2` |
| `organization_id` | `integer` | `?organization_id=1` |
| `status` | `string` enum | `?status=accepted` |

---

### `GET /assignments/{assignment_id}`
Get details of a single assignment.  
**Auth required:** Yes

**Error Responses**
| Code | Reason |
|------|--------|
| `404` | Assignment not found |

---

### `PATCH /assignments/{assignment_id}/status`
Update assignment lifecycle status.  
**Auth required:** Yes

**Request Body**
```json
{ "status": "accepted" }
```

**Valid status transitions**
```
proposed → accepted → in_progress → completed
proposed → declined
any → cancelled
```

---

### `PATCH /assignments/{assignment_id}/feedback`
Submit feedback and rating after completion.  
**Auth required:** Yes

**Request Body**
```json
{
  "feedback": "Volunteer was very responsive and helpful.",
  "rating": 4.5
}
```

| Field | Type | Notes |
|-------|------|-------|
| `feedback` | `string \| null` | Free text |
| `rating` | `number \| null` | 0.0 to 5.0 |

---

## 9. System

### `GET /`
Basic service check.  
**Auth required:** No

**Success Response `200`**
```json
{ "status": "ok", "app": "NeedMap AI" }
```

---

### `GET /health`
Database connectivity check.  
**Auth required:** No

**Success Response `200`**
```json
{ "status": "healthy", "database": "connected" }
```

**Error Response `503`**
```json
{ "detail": "Database unhealthy" }
```

---

## 10. Enum Reference

### `UserRole`
| Value | Description |
|-------|-------------|
| `admin` | Full system access |
| `ngo_coordinator` | Manages organization, needs, assignments |
| `volunteer` | Field worker |
| `field_reporter` | Submits need reports only |

### `NeedCategory`
| Value |
|-------|
| `water_access` |
| `food` |
| `shelter` |
| `health` |
| `education` |
| `sanitation` |
| `clothing` |
| `legal_aid` |
| `mental_health` |
| `transportation` |
| `other` |

### `NeedUrgency`
| Value |
|-------|
| `critical` |
| `high` |
| `medium` |
| `low` |

### `NeedStatus`
| Value |
|-------|
| `new` |
| `verified` |
| `assigned` |
| `in_progress` |
| `resolved` |
| `closed` |

### `SourceType`
| Value |
|-------|
| `paper_survey` |
| `csv_upload` |
| `voice_note` |
| `whatsapp` |
| `telegram` |
| `web_form` |
| `phone_call` |

### `Proficiency`
| Value |
|-------|
| `beginner` |
| `intermediate` |
| `expert` |

### `AssignmentStatus`
| Value |
|-------|
| `proposed` |
| `accepted` |
| `declined` |
| `in_progress` |
| `completed` |
| `cancelled` |
