# NeedMap AI — Users API Guide for Frontend

> This document explains how to use the User endpoints for profile management,
> location updates, password changes, and account deactivation.
> All user endpoints require a valid JWT token.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Update Profile](#2-update-profile)
3. [Update Location](#3-update-location)
4. [Change Password](#4-change-password)
5. [Deactivate Account](#5-deactivate-account)
6. [Error Reference](#6-error-reference)
7. [Frontend Flow Diagrams](#7-frontend-flow-diagrams)

---

## 1. Overview

All user endpoints are under `/users/me` — they always operate on the **currently logged-in user**.

- No user can edit another user's profile
- Every request needs `Authorization: Bearer <token>` header
- If token is missing/expired, backend returns `401`

### Essential frontend rules

- `GET /auth/me` is the main source of truth for the logged-in user's `role` and `organization_id`
- Use `role` to decide what UI to show:
  - `volunteer` → volunteer features only
  - `admin` → organization management UI
  - `owner` → organization management UI + delete organization action
- Use `organization_id` to know whether the user already belongs to an organization
- User profile endpoints in this document **do not change role**
- User profile endpoints in this document **do not assign organization membership**
- Role changes and org membership are handled through organization APIs, not `/users/me`

### Base pattern for all requests

```javascript
const token = localStorage.getItem("access_token");
const headers = {
  "Authorization": `Bearer ${token}`,
  "Content-Type": "application/json"
};
```

---

## 2. Update Profile

### Endpoint
```
PATCH /users/me
Authorization: Bearer <token>
Content-Type: application/json
```

### Request Body (at least one field required)
```json
{
  "user_name": "Abhishek Kumar Singh",
  "phone": "+919608524613"
}
```

### Field Rules
| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `user_name` | string | ❌ | 2–255 characters |
| `phone` | string | ❌ | Max 20 characters |

> ⚠️ **At least one field must be provided.** Sending `{}` returns `422`.

### Success Response `200`
```json
{
  "id": 1,
  "user_name": "Abhishek Kumar Singh",
  "email": "aksingh@example.com",
  "role": "volunteer",
  "phone": "+919608524613",
  "organization_id": null,
  "latitude": 28.6139,
  "longitude": 77.2090,
  "radius_km": 5.0,
  "is_active": true,
  "last_seen": null,
  "created_at": "2026-04-05T12:34:56Z"
}
```

### Error Responses
| Code | `detail` | What to show user |
|------|----------|-------------------|
| `401` | `"Invalid or expired token"` | Redirect to login |
| `422` | `"Provide at least one field to update"` | "Please fill at least one field" |
| `422` | Validation object | Show field-level errors |

### JavaScript Example
```javascript
async function updateProfile(changes) {
  const token = localStorage.getItem("access_token");

  const response = await fetch("http://localhost:8000/users/me", {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(changes)
  });

  if (response.ok) {
    const updatedUser = await response.json();
    // Update user state in your app
    return updatedUser;
  }

  const error = await response.json();
  // Handle error
  throw new Error(error.detail);
}

// Usage
await updateProfile({ user_name: "New Name" });
await updateProfile({ phone: "+919608524613" });
await updateProfile({ user_name: "New Name", phone: "+919608524613" });
```

---

## 3. Update Location

### Endpoint
```
PATCH /users/me/location
Authorization: Bearer <token>
Content-Type: application/json
```

### Request Body
```json
{
  "latitude": 28.6139,
  "longitude": 77.2090,
  "radius_km": 5.0
}
```

### Field Rules
| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `latitude` | number | ❌ | -90 to 90; must come with `longitude` |
| `longitude` | number | ❌ | -180 to 180; must come with `latitude` |
| `radius_km` | number | ❌ | Must be > 0 |

### Validation Rules
- `latitude` and `longitude` **must be sent together** (or both omitted)
- You can update only `radius_km` without coordinates
- At least one thing must be provided (coords or radius)

### Success Response `200`
Same user object as Update Profile above, with updated coordinates.

### Error Responses
| Code | `detail` | What to show user |
|------|----------|-------------------|
| `401` | `"Invalid or expired token"` | Redirect to login |
| `422` | `"Both latitude and longitude are required together"` | "Please provide both coordinates" |
| `422` | `"Provide latitude/longitude or radius_km"` | "Please provide location or radius" |

### JavaScript Example (with browser geolocation)
```javascript
async function updateMyLocation() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const token = localStorage.getItem("access_token");

        const response = await fetch("http://localhost:8000/users/me/location", {
          method: "PATCH",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            radius_km: 5.0
          })
        });

        if (response.ok) {
          resolve(await response.json());
        } else {
          reject(await response.json());
        }
      },
      (error) => {
        // User denied location or browser doesn't support it
        reject({ detail: "Location permission denied" });
      }
    );
  });
}
```

### Update only radius (no coordinates)
```javascript
await fetch("http://localhost:8000/users/me/location", {
  method: "PATCH",
  headers: {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({ radius_km: 10.0 })
});
```

---

## 4. Change Password

### Endpoint
```
PUT /users/me/password
Authorization: Bearer <token>
Content-Type: application/json
```

### Request Body
```json
{
  "old_password": "OldPass@123",
  "new_password": "NewPass@456"
}
```

### Field Rules
| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `old_password` | string | ✅ | Min 8 chars; must match current password |
| `new_password` | string | ✅ | Min 8 chars; must differ from old password |

### Success Response `200`
```json
{ "message": "Password changed successfully" }
```

### Error Responses
| Code | `detail` | What to show user |
|------|----------|-------------------|
| `401` | `"Current password is incorrect"` | "Your current password is wrong" |
| `401` | `"Invalid or expired token"` | Redirect to login |
| `422` | `"New password must be different from old password"` | "Please choose a different password" |
| `422` | Validation object (short password) | "Password must be at least 8 characters" |

### JavaScript Example
```javascript
async function changePassword(oldPassword, newPassword) {
  const token = localStorage.getItem("access_token");

  const response = await fetch("http://localhost:8000/users/me/password", {
    method: "PUT",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      old_password: oldPassword,
      new_password: newPassword
    })
  });

  if (response.ok) {
    alert("Password changed successfully!");
    return true;
  }

  const error = await response.json();

  if (response.status === 401 && error.detail === "Current password is incorrect") {
    alert("Your current password is wrong.");
  } else if (response.status === 422) {
    alert("New password must be at least 8 characters and different from old.");
  }

  return false;
}
```

> 💡 **After changing password, the existing JWT token remains valid** until it expires.
> No need to re-login immediately.

---

## 5. Deactivate Account

### Endpoint
```
DELETE /users/me
Authorization: Bearer <token>
```

### Request Body
None.

### What happens
- User's `is_active` is set to `false` (soft delete)
- User **cannot login** after deactivation
- User data is **not deleted** — admin can reactivate later
- Current token still works until it expires, but any new login will get `403`

### Success Response `200`
```json
{ "message": "Account deactivated successfully" }
```

### Error Responses
| Code | `detail` | What to show user |
|------|----------|-------------------|
| `401` | `"Invalid or expired token"` | Redirect to login |

### JavaScript Example
```javascript
async function deactivateAccount() {
  const confirmed = confirm("Are you sure? Your account will be deactivated.");
  if (!confirmed) return;

  const token = localStorage.getItem("access_token");

  const response = await fetch("http://localhost:8000/users/me", {
    method: "DELETE",
    headers: {
      "Authorization": `Bearer ${token}`
    }
  });

  if (response.ok) {
    localStorage.removeItem("access_token");
    window.location.href = "/login";
    alert("Your account has been deactivated.");
  }
}
```

> ⚠️ **Always show a confirmation dialog** before calling this endpoint.

---

## 6. Error Reference

### Full error table for all user endpoints

| Endpoint | HTTP Code | `detail` | Cause | Frontend Action |
|----------|-----------|----------|-------|-----------------|
| `PATCH /users/me` | `401` | `"Invalid or expired token"` | Bad/expired token | Redirect to login |
| `PATCH /users/me` | `422` | `"Provide at least one field to update"` | Empty body | Show validation message |
| `PATCH /users/me/location` | `422` | `"Both latitude and longitude are required together"` | Only one coord sent | Show validation message |
| `PATCH /users/me/location` | `422` | `"Provide latitude/longitude or radius_km"` | Empty body | Show validation message |
| `PUT /users/me/password` | `401` | `"Current password is incorrect"` | Wrong old password | Show "wrong password" |
| `PUT /users/me/password` | `422` | `"New password must be different from old password"` | Same password | Show validation message |
| `DELETE /users/me` | `401` | `"Invalid or expired token"` | Bad/expired token | Redirect to login |
| Any user endpoint | `403` | `"Account is inactive"` | Deactivated account | Clear token, redirect to login |

---

## 7. Frontend Flow Diagrams

### Profile Settings Page
```
User opens Settings
    │
    ├── Show current name, phone (from GET /auth/me data)
    │
    ├── User edits name/phone → PATCH /users/me
    │       ├── 200 → Update local state → Show "Saved!"
    │       └── 422 → Show field errors
    │
    ├── User clicks "Update Location" → browser geolocation prompt
    │       ├── Allowed → PATCH /users/me/location → "Location updated!"
    │       └── Denied → Show "Enable location in browser settings"
    │
    ├── User clicks "Change Password"
    │       ├── Show old + new password form
    │       ├── Submit → PUT /users/me/password
    │       │       ├── 200 → "Password changed!"
    │       │       ├── 401 → "Current password is wrong"
    │       │       └── 422 → Show validation errors
    │
    └── User clicks "Deactivate Account"
            ├── Confirm dialog → "Are you sure?"
            ├── YES → DELETE /users/me
            │       ├── 200 → Clear token → Redirect to login
            └── NO → Do nothing
```

### Recommended Settings Page Layout
```
┌─────────────────────────────────────┐
│         Profile Settings            │
├─────────────────────────────────────┤
│                                     │
│  Name:  [Abhishek Singh      ] ✏️   │
│  Phone: [+919608524613       ] ✏️   │
│                     [Save Profile]  │
│                                     │
├─────────────────────────────────────┤
│  📍 Location                        │
│  Lat: 28.6139  Lng: 77.2090        │
│  Radius: 5.0 km                    │
│            [Update Location] 📍     │
│                                     │
├─────────────────────────────────────┤
│  🔒 Change Password                 │
│  Current: [••••••••]                │
│  New:     [••••••••]                │
│            [Change Password]        │
│                                     │
├─────────────────────────────────────┤
│  ⚠️ Danger Zone                     │
│  [Deactivate My Account]  🔴       │
│                                     │
└─────────────────────────────────────┘
```

---

## Quick Reference

```javascript
// Update profile (name/phone)
PATCH /users/me                → Bearer token required

// Update location
PATCH /users/me/location       → Bearer token required

// Change password
PUT  /users/me/password        → Bearer token required

// Deactivate account (soft delete)
DELETE /users/me               → Bearer token required

// All responses return user object except:
//   PUT /users/me/password → { "message": "..." }
//   DELETE /users/me       → { "message": "..." }
```
