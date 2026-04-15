# NeedMap AI — Volunteers & Skills API Guide for Frontend

> This document explains how to use the Volunteer and Volunteer Skills endpoints
> for creating profiles, listing, updating, and managing skills.
> All endpoints require a valid JWT token.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Create Volunteer Profile](#2-create-volunteer-profile)
3. [List Volunteers](#3-list-volunteers)
4. [Get Single Volunteer](#4-get-single-volunteer)
5. [Update Volunteer](#5-update-volunteer)
6. [Add Skill](#6-add-skill)
7. [Update Skill](#7-update-skill)
8. [Remove Skill](#8-remove-skill)
9. [Error Reference](#9-error-reference)
10. [Frontend Flow Diagrams](#10-frontend-flow-diagrams)

---

## 1. Overview

A Volunteer profile is a separate record linked to a User. When a user with the `volunteer`
role wants to participate in assignments, they create a volunteer profile first.

### Key rules

- Only users with role `volunteer` can create a volunteer profile
- Each user can have **one** volunteer profile (1:1 relationship)
- `organization_id` is optional — a volunteer can exist without an org
- **Owner or admin** can update volunteer profiles (verify, change availability, assign org)
- Skills are attached to a volunteer profile, not to the user directly
- Duplicate skill names on the same volunteer are rejected

### Proficiency levels (enum)

| Value |
|-------|
| `beginner` |
| `intermediate` |
| `expert` |

### Base pattern for all requests

```javascript
const token = localStorage.getItem("access_token");
const headers = {
  "Authorization": `Bearer ${token}`,
  "Content-Type": "application/json"
};
```

---

## 2. Create Volunteer Profile

### Endpoint
```
POST /volunteers
Authorization: Bearer <token>
Content-Type: application/json
```

### Who can call this?
Only users with role = `volunteer`. Others get `403`.

### What happens
- Creates a volunteer profile linked to the authenticated user
- If `organization_id` is provided, the org must exist and be active
- Each user can only have **one** volunteer profile

### Request Body
```json
{
  "organization_id": 1,
  "availability": true
}
```

### Field Rules
| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `organization_id` | integer | ❌ | Must refer to an active organization if provided |
| `availability` | boolean | ❌ | Defaults to `true` |

### Success Response `201`
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

### Error Responses
| Code | `detail` | What to show user |
|------|----------|-------------------|
| `401` | `"Invalid or expired token"` | Redirect to login |
| `403` | `"Only users with volunteer role can create a volunteer profile"` | "You need a volunteer account" |
| `404` | `"Organization not found"` | "Organization not found" |
| `409` | `"Volunteer profile already exists"` | "You already have a volunteer profile" |

### JavaScript Example
```javascript
async function createVolunteerProfile(organizationId = null) {
  const token = localStorage.getItem("access_token");

  const response = await fetch("http://localhost:8000/volunteers", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      organization_id: organizationId,
      availability: true
    })
  });

  if (response.ok) return await response.json();

  const error = await response.json();

  if (response.status === 403) {
    alert("Only volunteers can create a volunteer profile.");
  } else if (response.status === 409) {
    alert("You already have a volunteer profile.");
  }

  return null;
}
```

---

## 3. List Volunteers

### Endpoint
```
GET /volunteers
Authorization: Bearer <token>
```

### Query Parameters
| Param | Type | Example |
|-------|------|---------|
| `availability` | boolean | `?availability=true` |
| `organization_id` | integer | `?organization_id=1` |
| `verified` | boolean | `?verified=true` |

### Success Response `200`
```json
[
  {
    "id": 1,
    "user_id": 2,
    "organization_id": 1,
    "availability": true,
    "rating": 4.5,
    "tasks_completed": 12,
    "active_tasks": 1,
    "is_active": true,
    "verified": true,
    "created_at": "2026-04-05T12:00:00Z"
  }
]
```

> Only **active** volunteer profiles are returned.

### Error Responses
| Code | `detail` | What to show user |
|------|----------|-------------------|
| `401` | `"Invalid or expired token"` | Redirect to login |

### JavaScript Example
```javascript
async function listVolunteers({ availability, organizationId, verified } = {}) {
  const token = localStorage.getItem("access_token");
  const params = new URLSearchParams();

  if (availability !== undefined) params.set("availability", availability);
  if (organizationId) params.set("organization_id", organizationId);
  if (verified !== undefined) params.set("verified", verified);

  const url = `http://localhost:8000/volunteers?${params}`;

  const response = await fetch(url, {
    headers: { "Authorization": `Bearer ${token}` }
  });

  if (response.ok) return await response.json();
  return [];
}
```

---

## 4. Get Single Volunteer

### Endpoint
```
GET /volunteers/{volunteer_id}
Authorization: Bearer <token>
```

### Success Response `200`
Same as single item in the list above.

### Error Responses
| Code | `detail` | What to show user |
|------|----------|-------------------|
| `401` | `"Invalid or expired token"` | Redirect to login |
| `404` | `"Volunteer not found"` | "Volunteer not found" |

### JavaScript Example
```javascript
async function getVolunteer(volunteerId) {
  const token = localStorage.getItem("access_token");

  const response = await fetch(`http://localhost:8000/volunteers/${volunteerId}`, {
    headers: { "Authorization": `Bearer ${token}` }
  });

  if (response.ok) return await response.json();

  if (response.status === 404) alert("Volunteer not found.");
  return null;
}
```

---

## 5. Update Volunteer

### Endpoint
```
PATCH /volunteers/{volunteer_id}
Authorization: Bearer <token>
Content-Type: application/json
```

### Who can call this?
Only **owner** or **admin**. Others get `403`.

### Request Body (at least one field required)
```json
{
  "availability": false,
  "organization_id": 2,
  "verified": true
}
```

### Field Rules
| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `availability` | boolean | ❌ | `true` or `false` |
| `organization_id` | integer | ❌ | Must refer to an active organization |
| `verified` | boolean | ❌ | `true` or `false` |

> ⚠️ **At least one field must be provided.** Sending `{}` returns `422`.

### Success Response `200`
Returns updated volunteer object.

### Error Responses
| Code | `detail` | What to show user |
|------|----------|-------------------|
| `401` | `"Invalid or expired token"` | Redirect to login |
| `403` | `"Only owner or admin can update volunteer profiles"` | "You don't have permission" |
| `404` | `"Volunteer not found"` or `"Organization not found"` | "Not found" |
| `422` | `"Provide at least one field to update"` | "Please fill at least one field" |

### JavaScript Example
```javascript
async function updateVolunteer(volunteerId, changes) {
  const token = localStorage.getItem("access_token");

  const response = await fetch(`http://localhost:8000/volunteers/${volunteerId}`, {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(changes)
  });

  if (response.ok) return await response.json();

  const error = await response.json();
  if (response.status === 403) alert("You don't have permission.");
  return null;
}

// Usage — verify a volunteer
await updateVolunteer(1, { verified: true });

// Usage — change availability
await updateVolunteer(1, { availability: false });
```

---

## 6. Add Skill

### Endpoint
```
POST /volunteers/{volunteer_id}/skills
Authorization: Bearer <token>
Content-Type: application/json
```

### Request Body
```json
{
  "skill_name": "First Aid",
  "proficiency": "intermediate"
}
```

### Field Rules
| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `skill_name` | string | ✅ | 2–100 chars; must be unique per volunteer |
| `proficiency` | enum | ✅ | `beginner`, `intermediate`, `expert` |

### Success Response `201`
```json
{
  "id": 1,
  "volunteer_id": 1,
  "skill_name": "First Aid",
  "proficiency": "intermediate"
}
```

### Error Responses
| Code | `detail` | What to show user |
|------|----------|-------------------|
| `401` | `"Invalid or expired token"` | Redirect to login |
| `404` | `"Volunteer not found"` | "Volunteer not found" |
| `409` | `"Skill already exists for this volunteer"` | "This skill is already added" |
| `422` | Validation object | Show field errors |

### JavaScript Example
```javascript
async function addSkill(volunteerId, skillName, proficiency) {
  const token = localStorage.getItem("access_token");

  const response = await fetch(`http://localhost:8000/volunteers/${volunteerId}/skills`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ skill_name: skillName, proficiency })
  });

  if (response.ok) return await response.json();

  const error = await response.json();
  if (response.status === 409) alert("This skill is already added.");
  return null;
}

// Usage
await addSkill(1, "First Aid", "intermediate");
await addSkill(1, "Driving", "expert");
```

---

## 7. Update Skill

### Endpoint
```
PATCH /volunteers/{volunteer_id}/skills/{skill_id}
Authorization: Bearer <token>
Content-Type: application/json
```

### Request Body
```json
{
  "proficiency": "expert"
}
```

### Field Rules
| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `proficiency` | enum | ✅ | `beginner`, `intermediate`, `expert` |

### Success Response `200`
```json
{
  "id": 1,
  "volunteer_id": 1,
  "skill_name": "First Aid",
  "proficiency": "expert"
}
```

### Error Responses
| Code | `detail` | What to show user |
|------|----------|-------------------|
| `401` | `"Invalid or expired token"` | Redirect to login |
| `404` | `"Volunteer not found"` or `"Skill not found"` | "Not found" |

### JavaScript Example
```javascript
async function updateSkill(volunteerId, skillId, proficiency) {
  const token = localStorage.getItem("access_token");

  const response = await fetch(
    `http://localhost:8000/volunteers/${volunteerId}/skills/${skillId}`,
    {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ proficiency })
    }
  );

  if (response.ok) return await response.json();
  return null;
}

// Usage — upgrade to expert
await updateSkill(1, 1, "expert");
```

---

## 8. Remove Skill

### Endpoint
```
DELETE /volunteers/{volunteer_id}/skills/{skill_id}
Authorization: Bearer <token>
```

### Success Response `200`
```json
{ "message": "Skill removed successfully" }
```

### Error Responses
| Code | `detail` | What to show user |
|------|----------|-------------------|
| `401` | `"Invalid or expired token"` | Redirect to login |
| `404` | `"Volunteer not found"` or `"Skill not found"` | "Not found" |

### JavaScript Example
```javascript
async function removeSkill(volunteerId, skillId) {
  const token = localStorage.getItem("access_token");

  const response = await fetch(
    `http://localhost:8000/volunteers/${volunteerId}/skills/${skillId}`,
    {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${token}` }
    }
  );

  if (response.ok) {
    alert("Skill removed.");
    return true;
  }

  return false;
}
```

---

## 9. Error Reference

### Full error table

| Endpoint | HTTP Code | `detail` | Cause | Frontend Action |
|----------|-----------|----------|-------|-----------------|
| `POST /volunteers` | `403` | `"Only users with volunteer role..."` | Wrong role | Show permission error |
| `POST /volunteers` | `404` | `"Organization not found"` | Invalid org | Show org selector |
| `POST /volunteers` | `409` | `"Volunteer profile already exists"` | Duplicate profile | Redirect to profile |
| `GET /volunteers/{id}` | `404` | `"Volunteer not found"` | Invalid id | Show "not found" |
| `PATCH /volunteers/{id}` | `403` | `"Only owner or admin..."` | Wrong role | Show permission error |
| `PATCH /volunteers/{id}` | `422` | `"Provide at least one field..."` | Empty body | Show validation msg |
| `POST /{id}/skills` | `404` | `"Volunteer not found"` | Invalid volunteer | Show "not found" |
| `POST /{id}/skills` | `409` | `"Skill already exists..."` | Duplicate skill | Show "already added" |
| `PATCH /{id}/skills/{sid}` | `404` | `"Skill not found"` | Invalid skill id | Show "not found" |
| `DELETE /{id}/skills/{sid}` | `404` | `"Skill not found"` | Invalid skill id | Show "not found" |
| Any protected endpoint | `401` | `"Invalid or expired token"` | Auth issue | Redirect to login |

### Role permissions summary

| Action | `owner` | `admin` | `volunteer` |
|--------|---------|---------|-------------|
| Create volunteer profile | ❌ | ❌ | ✅ (own) |
| List volunteers | ✅ | ✅ | ✅ |
| View volunteer | ✅ | ✅ | ✅ |
| Update volunteer | ✅ | ✅ | ❌ |
| Add skill | ✅ | ✅ | ✅ |
| Update skill | ✅ | ✅ | ✅ |
| Remove skill | ✅ | ✅ | ✅ |

---

## 10. Frontend Flow Diagrams

### Volunteer Onboarding Flow
```
User registers as volunteer (POST /auth/register, role=volunteer)
    │
    Login → POST /auth/login → save token
    │
    Create volunteer profile → POST /volunteers
    │
    ├── 201 → Profile created → redirect to dashboard
    │
    ├── 409 → Already has profile → redirect to profile page
    │
    └── 403 → Not a volunteer role → show error
    │
    Add skills → POST /volunteers/{id}/skills (repeat for each skill)
    │
    ├── 201 → Skill added → refresh skill list
    │
    └── 409 → Duplicate skill → show "already added"
```

### Admin Managing Volunteers
```
Admin/Owner opens /volunteers page
    │
    GET /volunteers → Render list with filters
    │
    Click volunteer → GET /volunteers/{id}
    │
    ├── Show profile details + skills
    │
    ├── [Verify] button → PATCH /volunteers/{id} { "verified": true }
    │       ├── 200 → Update UI badge
    │       └── 403 → "No permission"
    │
    ├── [Assign to Org] → PATCH /volunteers/{id} { "organization_id": X }
    │       ├── 200 → Updated
    │       └── 404 → "Organization not found"
    │
    └── [Toggle Availability] → PATCH /volunteers/{id} { "availability": false }
            └── 200 → Update toggle
```

### Skill Management Flow
```
Volunteer opens their profile
    │
    ├── Show existing skills list
    │
    ├── [Add Skill] button
    │       Show form: skill_name (text), proficiency (dropdown)
    │       Submit → POST /volunteers/{id}/skills
    │       ├── 201 → Refresh skill list
    │       └── 409 → "Skill already added"
    │
    ├── [Edit Proficiency] on a skill
    │       Show dropdown: beginner / intermediate / expert
    │       Submit → PATCH /volunteers/{id}/skills/{skill_id}
    │       └── 200 → Update in list
    │
    └── [Remove Skill] on a skill
            Confirm dialog
            Submit → DELETE /volunteers/{id}/skills/{skill_id}
            └── 200 → Remove from list
```

### Recommended Volunteer Profile Layout
```
┌─────────────────────────────────────┐
│    Volunteer Profile                │
├─────────────────────────────────────┤
│                                     │
│  👤 Name:       Ravi Kumar          │
│  📧 Email:      ravi@example.com    │
│  🏢 Org:        Hope Foundation     │
│  ✅ Available:  Yes                 │
│  🔖 Verified:   ✓                  │
│  ⭐ Rating:     4.5                 │
│  📋 Tasks:      12 done / 1 active  │
│                                     │
├─────────────────────────────────────┤
│  🛠️ Skills                          │
│  ┌─────────────────────────────┐    │
│  │ First Aid      │ expert    [✏️❌]│
│  │ Driving        │ beginner  [✏️❌]│
│  │ Communication  │ intermed. [✏️❌]│
│  └─────────────────────────────┘    │
│  [+ Add Skill]                      │
│                                     │
└─────────────────────────────────────┘
```

---

## Quick Reference

```javascript
// Create volunteer profile (volunteer role only)
POST   /volunteers                              → Bearer token required

// List volunteers (with filters)
GET    /volunteers                              → Bearer token required

// Get single volunteer
GET    /volunteers/{id}                         → Bearer token required

// Update volunteer (owner/admin only)
PATCH  /volunteers/{id}                         → Bearer token required

// Add skill to volunteer
POST   /volunteers/{id}/skills                  → Bearer token required

// Update skill proficiency
PATCH  /volunteers/{id}/skills/{skill_id}       → Bearer token required

// Remove skill
DELETE /volunteers/{id}/skills/{skill_id}       → Bearer token required
```
