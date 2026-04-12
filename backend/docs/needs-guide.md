# NeedMap AI — Needs API Guide for Frontend

> This document explains how to use Need and Need Source endpoints from the frontend.
> All endpoints in this guide require a valid JWT token.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Create Need](#2-create-need)
3. [List Needs](#3-list-needs)
4. [Heatmap Needs](#4-heatmap-needs)
5. [Get Single Need](#5-get-single-need)
6. [Update Need](#6-update-need)
7. [Close Need](#7-close-need)
8. [Add Need Source](#8-add-need-source)
9. [List Need Sources](#9-list-need-sources)
10. [Error Reference](#10-error-reference)
11. [Frontend Flow Diagrams](#11-frontend-flow-diagrams)

---

## 1. Overview

Needs represent community problems that require action (water, food, shelter, etc.).
Need Sources are raw inputs that support those needs (voice notes, surveys, uploads).

### Essential frontend rules

- Always attach `Authorization: Bearer <token>`
- `organization_id` must refer to an existing active organization
- `latitude`, `longitude`, and `address` are required when creating a need
- Use `GET /needs/heatmap` for map markers (already filtered to geo-ready records)
- Closing a need is soft-close (`status = closed`) via `DELETE /needs/{id}`
- Add source records using `/needs/{need_id}/sources` to keep audit trail

### Base pattern for all requests

```javascript
const token = localStorage.getItem("access_token");
const headers = {
  "Authorization": `Bearer ${token}`,
  "Content-Type": "application/json"
};
```

---

## 2. Create Need

### Endpoint
```
POST /needs
Authorization: Bearer <token>
Content-Type: application/json
```

### Request Body
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

### Field Rules
| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `title` | string | ✅ | 2–255 chars |
| `description` | string | ❌ | Optional |
| `category` | enum | ✅ | See enum list in api.md |
| `urgency` | enum | ✅ | `critical`, `high`, `medium`, `low` |
| `organization_id` | integer | ✅ | Must exist and be active |
| `latitude` | number | ✅ | -90 to 90 |
| `longitude` | number | ✅ | -180 to 180 |
| `address` | string | ✅ | 2–500 chars |

### Success Response `201`
Returns full need object.

### Error Responses
| Code | `detail` | What to show user |
|------|----------|-------------------|
| `401` | `"Invalid or expired token"` | Redirect to login |
| `404` | `"Organization not found"` | Ask user to pick valid org |
| `422` | Validation object | Ask user to provide latitude, longitude, and address |
| `422` | Validation object | Show field errors |

### JavaScript Example
```javascript
async function createNeed(payload) {
  const token = localStorage.getItem("access_token");

  const response = await fetch("http://localhost:8000/needs", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (response.ok) return await response.json();
  throw await response.json();
}
```

---

## 3. List Needs

### Endpoint
```
GET /needs
Authorization: Bearer <token>
```

### Query Parameters (all optional)
| Param | Type | Example |
|------|------|---------|
| `status` | enum | `?status=new` |
| `urgency` | enum | `?urgency=critical` |
| `category` | enum | `?category=food` |
| `organization_id` | integer | `?organization_id=1` |

### Success Response `200`
Array of need objects.

### JavaScript Example
```javascript
async function listNeeds(filters = {}) {
  const token = localStorage.getItem("access_token");
  const query = new URLSearchParams(filters).toString();

  const response = await fetch(`http://localhost:8000/needs${query ? `?${query}` : ""}`, {
    headers: { "Authorization": `Bearer ${token}` }
  });

  if (response.ok) return await response.json();
  throw await response.json();
}
```

---

## 4. Heatmap Needs

### Endpoint
```
GET /needs/heatmap
Authorization: Bearer <token>
```

### Success Response `200`
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

### Frontend usage
Use this endpoint directly for map marker plotting.

---

## 5. Get Single Need

### Endpoint
```
GET /needs/{need_id}
Authorization: Bearer <token>
```

### Error Responses
| Code | `detail` |
|------|----------|
| `404` | `"Need not found"` |

---

## 6. Update Need

### Endpoint
```
PATCH /needs/{need_id}
Authorization: Bearer <token>
Content-Type: application/json
```

### Request Body
All fields optional, but at least one required.

Example:
```json
{
  "status": "verified",
  "urgency": "high",
  "priority_score": 87.5,
  "resolved_at": "2026-04-06T10:00:00Z"
}
```

### Validation Rules
- At least one field must be sent
- If updating location, send `latitude`, `longitude`, and `address` together
- If changing `organization_id`, target organization must exist and be active

### Error Responses
| Code | `detail` |
|------|----------|
| `404` | `"Need not found"` or `"Organization not found"` |
| `422` | `"Provide at least one field to update"` |
| `422` | `"Provide latitude, longitude, and address together"` |

---

## 7. Close Need

### Endpoint
```
DELETE /needs/{need_id}
Authorization: Bearer <token>
```

### What happens
Sets need status to `closed`.

### Success Response `200`
```json
{ "message": "Need closed successfully" }
```

---

## 8. Add Need Source

### Endpoint
```
POST /needs/{need_id}/sources
Authorization: Bearer <token>
Content-Type: application/json
```

### Request Body
```json
{
  "source_type": "voice_note",
  "location": "Block C Gate",
  "multimedia_txt": "Transcribed text",
  "ai_extraction": "Structured summary"
}
```

### Field Rules
| Field | Type | Required |
|-------|------|----------|
| `source_type` | enum | ✅ |
| `location` | string | ❌ |
| `multimedia_txt` | string | ❌ |
| `ai_extraction` | string | ❌ |

### Success Response `201`
Returns created source object.

### Error Responses
| Code | `detail` |
|------|----------|
| `404` | `"Need not found"` |

---

## 9. List Need Sources

### Endpoint
```
GET /needs/{need_id}/sources
Authorization: Bearer <token>
```

### Success Response `200`
Array of source objects for the need.

---

## 10. Error Reference

| Endpoint | HTTP Code | Typical `detail` | Meaning |
|----------|-----------|------------------|---------|
| `POST /needs` | `404` | `"Organization not found"` | Invalid/inactive org |
| `POST /needs` | `422` | Validation error on `latitude`/`longitude`/`address` | Missing required location fields |
| `GET /needs/{id}` | `404` | `"Need not found"` | Invalid need id |
| `PATCH /needs/{id}` | `422` | `"Provide at least one field to update"` | Empty body |
| `DELETE /needs/{id}` | `404` | `"Need not found"` | Invalid need id |
| `POST /needs/{id}/sources` | `404` | `"Need not found"` | Invalid need id |
| Any protected endpoint | `401` | `"Invalid or expired token"` | Auth required / token expired |

---

## 11. Frontend Flow Diagrams

### Create Need Flow
```
Open "Create Need" form
   │
Fill title/category/urgency/org
   │
(Optional) attach location
   │
POST /needs
   │
├── 201 → Redirect to need details
├── 422 → Show field errors
└── 404 → Show "Organization not found"
```

### Need Detail Flow
```
Open /needs/{id}
   │
GET /needs/{id}
   │
├── 200 → Show full details + sources
└── 404 → Show not found page
```

### Source Tracking Flow
```
Need detail screen
   │
Add source (voice/upload/survey)
   │
POST /needs/{id}/sources
   │
├── 201 → Refresh source list
└── 404 → Need not found
```

---

## Quick Reference

```javascript
POST   /needs
GET    /needs
GET    /needs/heatmap
GET    /needs/{id}
PATCH  /needs/{id}
DELETE /needs/{id}
POST   /needs/{id}/sources
GET    /needs/{id}/sources
```
