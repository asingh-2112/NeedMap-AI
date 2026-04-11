# NeedMap AI — Organizations API Guide for Frontend

> This document explains how to use the Organization endpoints for registration,
> member management, listing, updating, and deactivating organizations.
> The registration endpoint is **public**. All other endpoints require a valid JWT token.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Register Organization (+ First Owner)](#2-register-organization--first-owner)
3. [Add Member to Organization](#3-add-member-to-organization)
4. [Create Organization (Existing User)](#4-create-organization-existing-user)
5. [List Organizations](#5-list-organizations)
6. [Get Single Organization](#6-get-single-organization)
7. [Update Organization](#7-update-organization)
8. [Deactivate Organization](#8-deactivate-organization)
9. [Error Reference](#9-error-reference)
10. [Frontend Flow Diagrams](#10-frontend-flow-diagrams)

---

## 1. Overview

Organizations are the top-level grouping in NeedMap AI. Needs, volunteers,
and assignments all belong to an organization.

### Key rules

- **Owners and admins cannot self-register.** The first owner is created via `POST /organizations/register`
- Additional admins are added via `POST /organizations/{id}/members`
- `POST /auth/register` only allows the `volunteer` role
- The user who creates an organization becomes its **owner** (`user_id` on the org)
- The **owner** and **admin** have the same org access, except only the owner can deactivate the organization
- Any authenticated user can **list** and **view** organizations
- Deletion is **soft** — `is_active` is set to `false`, data is preserved

### Essential frontend rules

- There should be a separate **Organization Signup** screen from the volunteer signup screen
- The first person creating an organization becomes the **owner** automatically
- The owner and admin can both manage organization details and members
- Only the owner should see the **Delete / Deactivate Organization** action in the UI
- Admins can be created only from inside an existing organization by owner/admin users
- Volunteers can either:
  - self-register through `POST /auth/register`, or
  - be added into an organization by owner/admin users
- Frontend should use both `role` and `organization_id` from `GET /auth/me` to decide:
  - whether to show organization dashboard
  - whether to show add-member UI
  - whether to show delete-organization UI

### Registration flow

```
Step 1:  POST /organizations/register   ← public, creates org + owner
         Owner receives a JWT token immediately (logged in)

Step 2:  POST /organizations/{id}/members  ← admin adds more users
         Can add only: admin, volunteer

Meanwhile: POST /auth/register  ← public, self-service
           Only volunteer can self-register
```

### Base pattern for all protected requests

```javascript
const token = localStorage.getItem("access_token");
const headers = {
  "Authorization": `Bearer ${token}`,
  "Content-Type": "application/json"
};
```

---

## 2. Register Organization (+ First Owner)

### Endpoint
```
POST /organizations/register
Content-Type: application/json
```

### Auth required?
**No** — this is a public endpoint. No token needed.

### What happens
1. Creates a new organization
2. Creates an owner user (role = `owner`) as the owner
3. Links the owner's `organization_id` to the new org
4. Returns a JWT token so the owner is **logged in immediately**

### What frontend should do right after success

1. Save `access_token`
2. Store `organization.id` if your app keeps org context in state
3. Redirect to organization dashboard / onboarding
4. Show owner-only actions such as adding admins/volunteers
5. Do **not** ask the user to log in again — they are already authenticated

### Request Body
```json
{
  "organization_name": "Hope Foundation",
  "address": "12 Main Street, Delhi",
  "phone": "+911234567890",
  "owner_name": "Abhishek Singh",
  "owner_email": "owner@hopefoundation.org",
  "owner_password": "StrongPass@123"
}
```

### Field Rules
| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `organization_name` | string | ✅ | 2–255 characters |
| `address` | string | ❌ | Max 500 characters |
| `phone` | string | ❌ | Max 20 characters |
| `owner_name` | string | ✅ | 2–255 characters |
| `owner_email` | string | ✅ | Valid email, must be unique |
| `owner_password` | string | ✅ | Min 8 characters |

### Success Response `201`
```json
{
  "organization": {
    "id": 1,
    "organization_name": "Hope Foundation",
    "address": "12 Main Street, Delhi",
    "phone": "+911234567890",
    "user_id": 1,
    "is_active": true,
    "created_at": "2026-04-05T12:00:00Z"
  },
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "expires_in": 3600
}
```

> 💡 **Save the `access_token` immediately** — the owner is now logged in
> and can start adding members right away.

### Error Responses
| Code | `detail` | What to show user |
|------|----------|-------------------|
| `409` | `"Email already registered"` | "This email is already in use" |
| `422` | Validation object | Show field-level errors |

### JavaScript Example
```javascript
async function registerOrganization(orgData) {
  const response = await fetch("http://localhost:8000/organizations/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(orgData)
  });

  if (response.ok) {
    const data = await response.json();

    // Save token — owner is now logged in
    localStorage.setItem("access_token", data.access_token);

    // data.organization has the new org info
    return data;
  }

  const error = await response.json();

  if (response.status === 409) {
    alert("This email is already in use.");
  } else if (response.status === 422) {
    console.error("Validation error:", error);
  }

  return null;
}

// Usage
await registerOrganization({
  organization_name: "Hope Foundation",
  address: "12 Main Street, Delhi",
  phone: "+911234567890",
  owner_name: "Abhishek Singh",
  owner_email: "owner@hopefoundation.org",
  owner_password: "StrongPass@123"
});
```

---

## 3. Add Member to Organization

### Endpoint
```
POST /organizations/{organization_id}/members
Authorization: Bearer <token>
Content-Type: application/json
```

### Who can call this?
Only the **owner** of the organization or an **admin**. Others get `403`.

### What happens
- Creates a new user with the given role
- Automatically links the user's `organization_id` to the org
- The new user can log in immediately with their email/password
- Added members can only be `admin` or `volunteer`

### Practical UI recommendations

- Use a role dropdown with only these values:
  - `admin`
  - `volunteer`
- Do not expose `owner` in the add-member UI
- Prefer labeling roles clearly in the frontend:
  - `owner` → Organization Owner
  - `admin` → Organization Admin
  - `volunteer` → Volunteer

### Request Body
```json
{
  "user_name": "Priya Sharma",
  "email": "priya@hopefoundation.org",
  "password": "SecurePass@456",
  "role": "admin",
  "phone": "+919876543210"
}
```

### Field Rules
| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `user_name` | string | ✅ | 2–255 characters |
| `email` | string | ✅ | Valid email, must be unique |
| `password` | string | ✅ | Min 8 characters |
| `role` | string | ✅ | Allowed values: `admin`, `volunteer` |
| `phone` | string | ❌ | Max 20 characters |

### Success Response `201`
```json
{
  "id": 2,
  "user_name": "Priya Sharma",
  "email": "priya@hopefoundation.org",
  "role": "admin",
  "phone": "+919876543210",
  "organization_id": 1,
  "latitude": null,
  "longitude": null,
  "radius_km": null,
  "is_active": true,
  "last_seen": null,
  "created_at": "2026-04-05T12:30:00Z"
}
```

### Error Responses
| Code | `detail` | What to show user |
|------|----------|-------------------|
| `401` | `"Invalid or expired token"` | Redirect to login |
| `403` | `"Not the owner or admin"` | "You don't have permission" |
| `404` | `"Organization not found"` | "Organization not found" |
| `409` | `"Email already registered"` | "This email is already in use" |
| `422` | Validation object | Show field-level errors |

### JavaScript Example
```javascript
async function addMember(orgId, memberData) {
  const token = localStorage.getItem("access_token");

  const response = await fetch(`http://localhost:8000/organizations/${orgId}/members`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(memberData)
  });

  if (response.ok) {
    const newUser = await response.json();
    alert(`${newUser.user_name} added as ${newUser.role}!`);
    return newUser;
  }

  const error = await response.json();

  if (response.status === 403) {
    alert("You don't have permission to add members.");
  } else if (response.status === 409) {
    alert("This email is already in use.");
  }

  return null;
}

// Usage — add an admin
await addMember(1, {
  user_name: "Priya Sharma",
  email: "priya@hopefoundation.org",
  password: "SecurePass@456",
  role: "admin",
  phone: "+919876543210"
});

// Usage — add a volunteer
await addMember(1, {
  user_name: "Ravi Kumar",
  email: "ravi@hopefoundation.org",
  password: "SecurePass@789",
  role: "volunteer"
});
```

---

## 4. Create Organization (Existing User)

### Endpoint
```
POST /organizations
Authorization: Bearer <token>
Content-Type: application/json
```

### Who can call this?
Only users with role `owner` or `admin`. All other roles get `403`.

> 💡 This endpoint is for users who **already have an account** and want to
> create a new organization. For first-time setup, use `POST /organizations/register` instead.

### Request Body
```json
{
  "organization_name": "Hope Foundation",
  "address": "12 Main Street, Delhi",
  "phone": "+911234567890"
}
```

### Field Rules
| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `organization_name` | string | ✅ | 2–255 characters |
| `address` | string | ❌ | Max 500 characters |
| `phone` | string | ❌ | Max 20 characters |

### Success Response `201`
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

> 💡 **After creating an org**, the creator's `organization_id` is automatically
> set to the new organization's `id`. You can verify this by calling `GET /auth/me`.

### Error Responses
| Code | `detail` | What to show user |
|------|----------|-------------------|
| `401` | `"Invalid or expired token"` | Redirect to login |
| `403` | `"Only owner or admin can create organization"` | "You don't have permission to create an organization" |
| `422` | Validation object | Show field-level errors |

### JavaScript Example
```javascript
async function createOrganization(orgData) {
  const token = localStorage.getItem("access_token");

  const response = await fetch("http://localhost:8000/organizations", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(orgData)
  });

  if (response.ok) {
    const newOrg = await response.json();
    return newOrg;
  }

  const error = await response.json();

  if (response.status === 403) {
    alert("You don't have permission to create an organization.");
  } else if (response.status === 422) {
    console.error("Validation error:", error);
  }

  return null;
}
```

---

## 5. List Organizations

### Endpoint
```
GET /organizations
Authorization: Bearer <token>
```

### Request Body
None.

### Success Response `200`
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
  },
  {
    "id": 2,
    "organization_name": "Relief Trust",
    "address": "45 Park Road, Mumbai",
    "phone": "+919876543210",
    "user_id": 3,
    "is_active": true,
    "created_at": "2026-04-06T09:00:00Z"
  }
]
```

> Only **active** organizations are returned. Deactivated ones are hidden.

### Error Responses
| Code | `detail` | What to show user |
|------|----------|-------------------|
| `401` | `"Invalid or expired token"` | Redirect to login |

### JavaScript Example
```javascript
async function listOrganizations() {
  const token = localStorage.getItem("access_token");

  const response = await fetch("http://localhost:8000/organizations", {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`
    }
  });

  if (response.ok) {
    const organizations = await response.json();
    return organizations; // Array of org objects
  }

  if (response.status === 401) {
    localStorage.removeItem("access_token");
    window.location.href = "/login";
  }

  return [];
}
```

---

## 6. Get Single Organization

### Endpoint
```
GET /organizations/{organization_id}
Authorization: Bearer <token>
```

### Request Body
None.

### Success Response `200`
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

### Error Responses
| Code | `detail` | What to show user |
|------|----------|-------------------|
| `401` | `"Invalid or expired token"` | Redirect to login |
| `404` | `"Organization not found"` | "Organization not found" or redirect to list |

### JavaScript Example
```javascript
async function getOrganization(orgId) {
  const token = localStorage.getItem("access_token");

  const response = await fetch(`http://localhost:8000/organizations/${orgId}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`
    }
  });

  if (response.ok) {
    return await response.json();
  }

  if (response.status === 404) {
    alert("Organization not found.");
    return null;
  }

  if (response.status === 401) {
    localStorage.removeItem("access_token");
    window.location.href = "/login";
  }

  return null;
}
```

---

## 7. Update Organization

### Endpoint
```
PATCH /organizations/{organization_id}
Authorization: Bearer <token>
Content-Type: application/json
```

### Who can call this?
Only the **owner** (the user who created the org) or an **admin**. Others get `403`.

### Request Body (at least one field required)
```json
{
  "organization_name": "Hope Foundation Updated",
  "address": "New Address",
  "phone": "+911234567891",
  "is_active": true
}
```

### Field Rules
| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `organization_name` | string | ❌ | 2–255 characters |
| `address` | string | ❌ | Max 500 characters |
| `phone` | string | ❌ | Max 20 characters |
| `is_active` | boolean | ❌ | `true` or `false` |

> ⚠️ **At least one field must be provided.** Sending `{}` returns `422`.

### Success Response `200`
```json
{
  "id": 1,
  "organization_name": "Hope Foundation Updated",
  "address": "New Address",
  "phone": "+911234567891",
  "user_id": 1,
  "is_active": true,
  "created_at": "2026-04-05T12:00:00Z"
}
```

### Error Responses
| Code | `detail` | What to show user |
|------|----------|-------------------|
| `401` | `"Invalid or expired token"` | Redirect to login |
| `403` | `"Not the owner or admin"` | "You don't have permission to edit this organization" |
| `404` | `"Organization not found"` | "Organization not found" |
| `422` | `"Provide at least one field to update"` | "Please fill at least one field" |
| `422` | Validation object | Show field-level errors |

### JavaScript Example
```javascript
async function updateOrganization(orgId, changes) {
  const token = localStorage.getItem("access_token");

  const response = await fetch(`http://localhost:8000/organizations/${orgId}`, {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(changes)
  });

  if (response.ok) {
    const updatedOrg = await response.json();
    // Update org state in your app
    return updatedOrg;
  }

  const error = await response.json();

  if (response.status === 403) {
    alert("You don't have permission to edit this organization.");
  } else if (response.status === 404) {
    alert("Organization not found.");
  } else if (response.status === 422) {
    console.error("Validation error:", error);
  }

  return null;
}

// Usage
await updateOrganization(1, { organization_name: "Hope Foundation Updated" });
await updateOrganization(1, { address: "New Address", phone: "+911234567891" });
```

---

## 8. Deactivate Organization

### Endpoint
```
DELETE /organizations/{organization_id}
Authorization: Bearer <token>
```

### Who can call this?
Only the **owner**. Admins cannot delete the organization.

### Request Body
None.

### What happens
- Organization's `is_active` is set to `false` (soft delete)
- Organization **no longer appears** in `GET /organizations` list
- Organization data is **not deleted** — owner or admin can reactivate later via `PATCH`
- Needs, volunteers, and assignments under this org remain in the database

### Success Response `200`
```json
{ "message": "Organization deactivated successfully" }
```

### Error Responses
| Code | `detail` | What to show user |
|------|----------|-------------------|
| `401` | `"Invalid or expired token"` | Redirect to login |
| `403` | `"Only the owner can deactivate this organization"` | "Only the owner can deactivate this organization" |
| `404` | `"Organization not found"` | "Organization not found" |

### JavaScript Example
```javascript
async function deactivateOrganization(orgId) {
  const confirmed = confirm(
    "Are you sure? This organization will be deactivated. " +
    "All associated needs and volunteers will remain but the org won't be listed."
  );
  if (!confirmed) return;

  const token = localStorage.getItem("access_token");

  const response = await fetch(`http://localhost:8000/organizations/${orgId}`, {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${token}`
    }
  });

  if (response.ok) {
    alert("Organization deactivated.");
    window.location.href = "/organizations";
    return true;
  }

  const error = await response.json();

  if (response.status === 403) {
    alert("You don't have permission to deactivate this organization.");
  } else if (response.status === 404) {
    alert("Organization not found.");
  }

  return false;
}
```

> ⚠️ **Always show a confirmation dialog** before calling this endpoint.

> 💡 **To reactivate**, the owner or admin can call
> `PATCH /organizations/{id}` with `{ "is_active": true }`.

---

## 9. Error Reference

### Full error table for all organization endpoints

| Endpoint | HTTP Code | `detail` | Cause | Frontend Action |
|----------|-----------|----------|-------|-----------------|
| `POST /organizations` | `403` | `"Only owner or admin can create organization"` | Wrong role | Show permission error |
| `POST /organizations` | `422` | Validation object | Missing/invalid fields | Show field errors |
| `GET /organizations` | `401` | `"Invalid or expired token"` | Bad/expired token | Redirect to login |
| `GET /organizations/{id}` | `404` | `"Organization not found"` | Org doesn't exist or deactivated | Show "not found" |
| `PATCH /organizations/{id}` | `403` | `"Not the owner or admin"` | Not authorized | Show permission error |
| `PATCH /organizations/{id}` | `404` | `"Organization not found"` | Org doesn't exist | Show "not found" |
| `PATCH /organizations/{id}` | `422` | `"Provide at least one field to update"` | Empty body | Show validation message |
| `DELETE /organizations/{id}` | `403` | `"Only the owner can deactivate this organization"` | Admin tried to delete org | Show owner-only error |
| `DELETE /organizations/{id}` | `404` | `"Organization not found"` | Org doesn't exist | Show "not found" |
| Any org endpoint | `401` | `"Invalid or expired token"` | Bad/expired token | Clear token, redirect to login |
| Any org endpoint | `403` | `"Account is inactive"` | Deactivated user | Clear token, redirect to login |

### Role permissions summary

| Action | `owner` | `admin` | `volunteer` |
|--------|---------|---------|-------------|
| Register org | ✅ | ❌ | ❌ |
| Add members | ✅ | ✅ (same org) | ❌ |
| Create org (existing user) | ✅ | ✅ | ❌ |
| List orgs | ✅ | ✅ | ✅ |
| View org | ✅ | ✅ | ✅ |
| Update org | ✅ | ✅ (same org) | ❌ |
| Deactivate org | ✅ | ❌ | ❌ |

---

## 10. Frontend Flow Diagrams

### Organization Registration Flow (First Time)
```
Landing page → "Register your Organization"
    │
    Show form: org name, address, phone, owner name, owner email, owner password
    │
    POST /organizations/register
    │
    ├── 201 → Save access_token → Redirect to org dashboard
    │         Owner is now logged in, can add members
    │
    ├── 409 → Show "Email already in use"
    │
    └── 422 → Show field validation errors
```

### Adding Members Flow
```
Admin opens /organizations/{id}/members
    │
    ├── Show "Add Member" form
    │       Name, Email, Password, Role (dropdown), Phone
    │
    ├── Submit → POST /organizations/{id}/members
    │       │
    │       ├── 201 → Show "Member added!" → Refresh member list
    │       │
    │       ├── 403 → Show "No permission"
    │       │
    │       ├── 409 → Show "Email already in use"
    │       │
    │       └── 422 → Show field errors
```

### Volunteer/Reporter Self-Registration
```
Landing page → "Sign up as Volunteer"
    │
    POST /auth/register (role: volunteer)
    │
    ├── 201 → Redirect to login page
    │
    ├── 403 → Show "Owners and admins must be created by an organization"
    │         (user tried role=owner or admin)
    │
    └── 409 → Show "Email already in use"
```

### Organization List Page
```
User navigates to /organizations
    │
    GET /organizations
    │
    ├── 200 → Render org cards/table
    │       │
    │       ├── Each card shows: name, address, phone
    │       │
    │       └── Click card → GET /organizations/{id} → Show detail page
    │
    └── 401 → Redirect to login
```

### Organization Detail / Edit Page
```
User opens /organizations/{id}
    │
    GET /organizations/{id}
    │
    ├── 200 → Show org details
    │       │
    │       ├── Is user owner or same-org admin?
    │       │       │
    │       │      YES → Show "Edit", "Add Member", "Deactivate" buttons
    │       │       │
    │       │       NO → Read-only view only
    │       │
    │       ├── User clicks "Edit"
    │       │       ├── Show edit form (pre-filled)
    │       │       ├── Submit → PATCH /organizations/{id}
    │       │       │       ├── 200 → Update view → "Saved!"
    │       │       │       ├── 403 → "No permission"
    │       │       │       └── 422 → Show field errors
    │       │
    │       ├── User clicks "Add Member"
    │       │       └── → Navigate to add member form
    │       │
    │       └── User clicks "Deactivate"
    │               ├── Confirm dialog
    │               ├── YES → DELETE /organizations/{id}
    │               │       ├── 200 → Redirect to org list
    │               │       └── 403 → "No permission"
    │               └── NO → Do nothing
    │
    └── 404 → Show "Organization not found"
```

### How to check if user is org owner
```javascript
// After fetching org and user data
const user = await (await fetch("/auth/me", { headers })).json();
const org  = await (await fetch(`/organizations/${orgId}`, { headers })).json();

const isOwner = org.user_id === user.id;
const isAdmin = user.role === "admin";
const canEdit = isOwner || isAdmin;

if (canEdit) {
  // Show edit / add member / deactivate buttons
}
```

### Recommended Organization Detail Layout
```
┌─────────────────────────────────────┐
│      Hope Foundation                │
├─────────────────────────────────────┤
│                                     │
│  📛 Name:    Hope Foundation        │
│  📍 Address: 12 Main Street, Delhi  │
│  📞 Phone:   +911234567890          │
│  👤 Owner:   User #1                │
│  📅 Created: 2026-04-05             │
│  ✅ Status:  Active                 │
│                                     │
├─────────────────────────────────────┤
│  (visible only to owner / admin)    │
│                                     │
│  Name:    [Hope Foundation    ] ✏️   │
│  Address: [12 Main Street     ] ✏️   │
│  Phone:   [+911234567890      ] ✏️   │
│                  [Save Changes]     │
│                                     │
├─────────────────────────────────────┤
│  👥 Members                         │
│  [Add Member]                       │
│  ┌─────────────────────────────┐    │
│  │ Priya Sharma  │ coordinator │    │
│  │ Ravi Kumar    │ admin       │    │
│  └─────────────────────────────┘    │
│                                     │
├─────────────────────────────────────┤
│  ⚠️ Danger Zone                     │
│  [Deactivate Organization]  🔴     │
│                                     │
└─────────────────────────────────────┘
```

---

## Quick Reference

```javascript
// Register org + first owner (public, no token)
POST   /organizations/register         → no token needed → returns token

// Add member to org (owner / admin only)
POST   /organizations/{id}/members     → Bearer token required

// Create organization (existing owner / admin)
POST   /organizations                  → Bearer token required

// List all active organizations
GET    /organizations                  → Bearer token required

// Get single organization
GET    /organizations/{id}             → Bearer token required

// Update organization (owner / admin only)
PATCH  /organizations/{id}             → Bearer token required

// Deactivate organization (owner only)
DELETE /organizations/{id}             → Bearer token required

// Self-register (volunteer only)
POST   /auth/register                  → no token needed
//   ⚠️ owner & admin → 403 (must use org registration)

// Reactivate a deactivated org:
//   PATCH /organizations/{id}  → { "is_active": true }
```
