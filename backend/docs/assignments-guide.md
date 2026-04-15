# NeedMap AI — Assignments API Guide for Frontend

> This document explains how to use the Assignment endpoints for creating,
> listing, status management, and feedback submission.
> All endpoints require a valid JWT token.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Create Assignment](#2-create-assignment)
3. [List Assignments](#3-list-assignments)
4. [Get Single Assignment](#4-get-single-assignment)
5. [Update Assignment Status](#5-update-assignment-status)
6. [Submit Feedback](#6-submit-feedback)
7. [Error Reference](#7-error-reference)
8. [Frontend Flow Diagrams](#8-frontend-flow-diagrams)

---

## 1. Overview

Assignments link **volunteers** to **needs**. An admin or owner creates an assignment,
the volunteer accepts/declines it, works through it, and completes it. Feedback and
ratings are submitted after completion.

### Key rules

- Only **owner** or **admin** can create assignments
- Status transitions follow a strict lifecycle (see diagram below)
- Duplicate active assignments (same volunteer + same need) are rejected
- Volunteer `active_tasks` and `tasks_completed` counters are updated automatically
- Volunteer `rating` is recalculated as an average when feedback ratings are submitted
- `match_score` is optional and can be set by AI or manually (0–100)

### Status lifecycle

```
proposed → accepted → in_progress → completed
proposed → declined
any      → cancelled
```

### Assignment statuses (enum)

| Value | Meaning |
|-------|---------|
| `proposed` | Assignment created, waiting for volunteer response |
| `accepted` | Volunteer accepted the assignment |
| `declined` | Volunteer declined the assignment |
| `in_progress` | Volunteer is actively working on it |
| `completed` | Work finished |
| `cancelled` | Assignment cancelled (from any state) |

### Base pattern for all requests

```javascript
const token = localStorage.getItem("access_token");
const headers = {
  "Authorization": `Bearer ${token}`,
  "Content-Type": "application/json"
};
```

---

## 2. Create Assignment

### Endpoint
```
POST /assignments
Authorization: Bearer <token>
Content-Type: application/json
```

### Who can call this?
Only **owner** or **admin**. Others get `403`.

### What happens
- Links a volunteer to a need under an organization
- Sets initial status to `proposed`
- Increments volunteer's `active_tasks` counter
- Rejects duplicate active assignments (same need + volunteer)

### Request Body
```json
{
  "need_id": 1,
  "volunteer_id": 2,
  "organization_id": 1,
  "match_score": 91.5
}
```

### Field Rules
| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `need_id` | integer | ✅ | Must refer to an existing need |
| `volunteer_id` | integer | ✅ | Must refer to an active volunteer |
| `organization_id` | integer | ✅ | Must refer to an active organization |
| `match_score` | number | ❌ | 0–100; AI or manual matching score |

### Success Response `201`
```json
{
  "id": 1,
  "need_id": 1,
  "volunteer_id": 2,
  "organization_id": 1,
  "status": "proposed",
  "match_score": 91.5,
  "assigned_at": "2026-04-05T13:00:00Z",
  "accepted_at": null,
  "completed_at": null,
  "feedback": null,
  "rating": null
}
```

### Error Responses
| Code | `detail` | What to show user |
|------|----------|-------------------|
| `401` | `"Invalid or expired token"` | Redirect to login |
| `403` | `"Only owner or admin can perform this action"` | "You don't have permission" |
| `404` | `"Need not found"` | "Need not found" |
| `404` | `"Organization not found"` | "Organization not found" |
| `404` | `"Volunteer not found"` | "Volunteer not found" |
| `409` | `"Volunteer already has an active assignment for this need"` | "Already assigned" |

### JavaScript Example
```javascript
async function createAssignment(payload) {
  const token = localStorage.getItem("access_token");

  const response = await fetch("http://localhost:8000/assignments", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (response.ok) return await response.json();

  const error = await response.json();
  if (response.status === 403) alert("You don't have permission.");
  else if (response.status === 409) alert("Volunteer is already assigned to this need.");
  return null;
}

// Usage
await createAssignment({
  need_id: 1,
  volunteer_id: 2,
  organization_id: 1,
  match_score: 91.5
});
```

---

## 3. List Assignments

### Endpoint
```
GET /assignments
Authorization: Bearer <token>
```

### Query Parameters
| Param | Type | Example |
|-------|------|---------|
| `need_id` | integer | `?need_id=1` |
| `volunteer_id` | integer | `?volunteer_id=2` |
| `organization_id` | integer | `?organization_id=1` |
| `status` | enum | `?status=accepted` |

### Success Response `200`
```json
[
  {
    "id": 1,
    "need_id": 1,
    "volunteer_id": 2,
    "organization_id": 1,
    "status": "proposed",
    "match_score": 91.5,
    "assigned_at": "2026-04-05T13:00:00Z",
    "accepted_at": null,
    "completed_at": null,
    "feedback": null,
    "rating": null
  }
]
```

### Error Responses
| Code | `detail` | What to show user |
|------|----------|-------------------|
| `401` | `"Invalid or expired token"` | Redirect to login |

### JavaScript Example
```javascript
async function listAssignments({ needId, volunteerId, organizationId, status } = {}) {
  const token = localStorage.getItem("access_token");
  const params = new URLSearchParams();

  if (needId) params.set("need_id", needId);
  if (volunteerId) params.set("volunteer_id", volunteerId);
  if (organizationId) params.set("organization_id", organizationId);
  if (status) params.set("status", status);

  const response = await fetch(`http://localhost:8000/assignments?${params}`, {
    headers: { "Authorization": `Bearer ${token}` }
  });

  if (response.ok) return await response.json();
  return [];
}

// Usage — assignments for a specific need
const needAssignments = await listAssignments({ needId: 1 });

// Usage — volunteer's assignments
const myAssignments = await listAssignments({ volunteerId: 2 });

// Usage — filter by status
const active = await listAssignments({ status: "in_progress" });
```

---

## 4. Get Single Assignment

### Endpoint
```
GET /assignments/{assignment_id}
Authorization: Bearer <token>
```

### Success Response `200`
Same structure as single item in list response.

### Error Responses
| Code | `detail` | What to show user |
|------|----------|-------------------|
| `401` | `"Invalid or expired token"` | Redirect to login |
| `404` | `"Assignment not found"` | "Assignment not found" |

### JavaScript Example
```javascript
async function getAssignment(assignmentId) {
  const token = localStorage.getItem("access_token");

  const response = await fetch(`http://localhost:8000/assignments/${assignmentId}`, {
    headers: { "Authorization": `Bearer ${token}` }
  });

  if (response.ok) return await response.json();
  if (response.status === 404) alert("Assignment not found.");
  return null;
}
```

---

## 5. Update Assignment Status

### Endpoint
```
PATCH /assignments/{assignment_id}/status
Authorization: Bearer <token>
Content-Type: application/json
```

### Request Body
```json
{
  "status": "accepted"
}
```

### Valid Transitions

| Current Status | Can transition to |
|----------------|-------------------|
| `proposed` | `accepted`, `declined`, `cancelled` |
| `accepted` | `in_progress`, `cancelled` |
| `declined` | `cancelled` |
| `in_progress` | `completed`, `cancelled` |
| `completed` | `cancelled` |
| `cancelled` | _(none — terminal state)_ |

### What happens automatically

| Transition | Side effect |
|-----------|-------------|
| → `accepted` | Sets `accepted_at` timestamp |
| → `completed` | Sets `completed_at`, increments `tasks_completed`, decrements `active_tasks` |
| → `declined` | Decrements `active_tasks` |
| → `cancelled` | Decrements `active_tasks` (if not already completed/declined) |

### Success Response `200`
Returns updated assignment object.

### Error Responses
| Code | `detail` | What to show user |
|------|----------|-------------------|
| `401` | `"Invalid or expired token"` | Redirect to login |
| `404` | `"Assignment not found"` | "Assignment not found" |
| `422` | `"Cannot transition from 'X' to 'Y'"` | Show invalid transition message |

### JavaScript Example
```javascript
async function updateAssignmentStatus(assignmentId, newStatus) {
  const token = localStorage.getItem("access_token");

  const response = await fetch(
    `http://localhost:8000/assignments/${assignmentId}/status`,
    {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ status: newStatus })
    }
  );

  if (response.ok) return await response.json();

  const error = await response.json();
  if (response.status === 422) alert(error.detail);
  return null;
}

// Usage — volunteer accepts
await updateAssignmentStatus(1, "accepted");

// Usage — volunteer starts work
await updateAssignmentStatus(1, "in_progress");

// Usage — mark completed
await updateAssignmentStatus(1, "completed");

// Usage — cancel at any point
await updateAssignmentStatus(1, "cancelled");
```

---

## 6. Submit Feedback

### Endpoint
```
PATCH /assignments/{assignment_id}/feedback
Authorization: Bearer <token>
Content-Type: application/json
```

### Request Body
```json
{
  "feedback": "Volunteer was very responsive and helpful.",
  "rating": 4.5
}
```

### Field Rules
| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `feedback` | string | ❌ | Max 2000 chars; at least one of feedback/rating required |
| `rating` | number | ❌ | 0.0 to 5.0; at least one of feedback/rating required |

> ⚠️ At least one of `feedback` or `rating` must be provided.

### What happens on rating
- The volunteer's `rating` field is **recalculated** as the average of all their rated assignments

### Success Response `200`
Returns updated assignment object with feedback and rating populated.

### Error Responses
| Code | `detail` | What to show user |
|------|----------|-------------------|
| `401` | `"Invalid or expired token"` | Redirect to login |
| `404` | `"Assignment not found"` | "Assignment not found" |
| `422` | `"Provide at least feedback or rating"` | "Please provide feedback or a rating" |

### JavaScript Example
```javascript
async function submitFeedback(assignmentId, feedback, rating) {
  const token = localStorage.getItem("access_token");

  const body = {};
  if (feedback) body.feedback = feedback;
  if (rating !== undefined) body.rating = rating;

  const response = await fetch(
    `http://localhost:8000/assignments/${assignmentId}/feedback`,
    {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    }
  );

  if (response.ok) return await response.json();
  return null;
}

// Usage — both feedback and rating
await submitFeedback(1, "Very helpful volunteer!", 4.5);

// Usage — rating only
await submitFeedback(1, null, 5.0);

// Usage — feedback only
await submitFeedback(1, "Great work, thank you!");
```

---

## 7. Error Reference

### Full error table

| Endpoint | HTTP Code | `detail` | Cause | Frontend Action |
|----------|-----------|----------|-------|-----------------|
| `POST /assignments` | `403` | `"Only owner or admin..."` | Wrong role | Show permission error |
| `POST /assignments` | `404` | `"Need not found"` | Invalid need | Show "not found" |
| `POST /assignments` | `404` | `"Organization not found"` | Invalid/inactive org | Show "not found" |
| `POST /assignments` | `404` | `"Volunteer not found"` | Invalid/inactive volunteer | Show "not found" |
| `POST /assignments` | `409` | `"Volunteer already has an active..."` | Duplicate | Show "already assigned" |
| `GET /assignments/{id}` | `404` | `"Assignment not found"` | Invalid id | Show "not found" |
| `PATCH /{id}/status` | `404` | `"Assignment not found"` | Invalid id | Show "not found" |
| `PATCH /{id}/status` | `422` | `"Cannot transition from..."` | Invalid transition | Show transition error |
| `PATCH /{id}/feedback` | `404` | `"Assignment not found"` | Invalid id | Show "not found" |
| `PATCH /{id}/feedback` | `422` | `"Provide at least feedback..."` | Empty body | Show validation msg |
| Any protected endpoint | `401` | `"Invalid or expired token"` | Auth issue | Redirect to login |

### Role permissions summary

| Action | `owner` | `admin` | `volunteer` |
|--------|---------|---------|-------------|
| Create assignment | ✅ | ✅ | ❌ |
| List assignments | ✅ | ✅ | ✅ |
| View assignment | ✅ | ✅ | ✅ |
| Update status | ✅ | ✅ | ✅ |
| Submit feedback | ✅ | ✅ | ✅ |

---

## 8. Frontend Flow Diagrams

### Assignment Lifecycle Flow
```
Admin/Owner creates assignment
    │
    POST /assignments
    │
    ├── 201 → status = "proposed"
    │         Volunteer sees it in their dashboard
    │
    Volunteer responds:
    │
    ├── PATCH /{id}/status { "status": "accepted" }
    │   └── accepted_at set → status = "accepted"
    │
    ├── PATCH /{id}/status { "status": "declined" }
    │   └── active_tasks decremented → status = "declined"
    │
    Volunteer starts work:
    │
    ├── PATCH /{id}/status { "status": "in_progress" }
    │   └── status = "in_progress"
    │
    Volunteer completes:
    │
    ├── PATCH /{id}/status { "status": "completed" }
    │   └── completed_at set, tasks_completed++, active_tasks--
    │
    Admin submits feedback:
    │
    └── PATCH /{id}/feedback { "feedback": "...", "rating": 4.5 }
        └── Volunteer average rating recalculated
```

### Admin Assignment Dashboard
```
Admin opens /assignments page
    │
    GET /assignments?organization_id=1
    │
    ├── Show table: Need title, Volunteer name, Status, Score
    │
    ├── Filter controls:
    │   - By need  → ?need_id=X
    │   - By volunteer → ?volunteer_id=X
    │   - By status → ?status=in_progress
    │
    ├── [+ New Assignment] button
    │       Show form: select need, select volunteer, match_score
    │       Submit → POST /assignments
    │       ├── 201 → Refresh list
    │       └── 409 → "Already assigned"
    │
    ├── Click row → Detail view
    │       Show full assignment info
    │       Status controls based on current status
    │       Feedback form (if completed)
    │
    └── [Cancel] on any active assignment
            → PATCH /{id}/status { "status": "cancelled" }
```

### Volunteer Assignment View
```
Volunteer opens /my-assignments
    │
    GET /assignments?volunteer_id={myVolunteerId}
    │
    ├── Proposed assignments → [Accept] [Decline] buttons
    │
    ├── Accepted → [Start Work] button
    │
    ├── In Progress → [Mark Complete] button
    │
    └── Completed → Show feedback/rating if any
```

### Status Badge Colors (UI suggestion)
```
proposed    → 🟡 Yellow / Orange
accepted    → 🔵 Blue
declined    → ⚪ Gray
in_progress → 🟢 Green
completed   → ✅ Dark Green / Success
cancelled   → 🔴 Red
```

### Recommended Assignment Card Layout
```
┌─────────────────────────────────────┐
│  📋 Assignment #1                   │
├─────────────────────────────────────┤
│                                     │
│  📌 Need:       Clean water Block C │
│  👤 Volunteer:  Ravi Kumar          │
│  🏢 Org:        Hope Foundation     │
│  📊 Score:      91.5                │
│  📅 Assigned:   2026-04-05          │
│  ✅ Status:     [in_progress] 🟢    │
│                                     │
├─────────────────────────────────────┤
│  Actions (based on current status): │
│                                     │
│  [Accept] [Decline]  ← proposed     │
│  [Start Work]        ← accepted     │
│  [Complete]          ← in_progress  │
│  [Cancel]            ← any active   │
│                                     │
├─────────────────────────────────────┤
│  💬 Feedback (after completion):    │
│                                     │
│  Rating: ⭐⭐⭐⭐☆ (4.5)          │
│  "Very responsive and helpful."     │
│                                     │
│  [Submit Feedback]                  │
└─────────────────────────────────────┘
```

---

## Quick Reference

```javascript
// Create assignment (owner/admin only)
POST   /assignments                          → Bearer token required

// List assignments (with filters)
GET    /assignments                          → Bearer token required

// Get single assignment
GET    /assignments/{id}                     → Bearer token required

// Update status (lifecycle transitions)
PATCH  /assignments/{id}/status              → Bearer token required

// Submit feedback and rating
PATCH  /assignments/{id}/feedback            → Bearer token required
```
