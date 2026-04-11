# NeedMap AI — Authentication Guide for Frontend

> This document explains how authentication works, how to use JWT tokens,
> and how to handle every error case. Read this before implementing any auth flow.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Register](#2-register)
3. [Login](#3-login)
4. [Using the Token on Protected Routes](#4-using-the-token-on-protected-routes)
5. [Get Current User](#5-get-current-user)
6. [Where to Store the Token](#6-where-to-store-the-token)
7. [Token Expiry and What to Do](#7-token-expiry-and-what-to-do)
8. [Error Reference](#8-error-reference)
9. [Full Frontend Flow Diagram](#9-full-frontend-flow-diagram)

---

## 1. Overview

NeedMap AI uses **JWT (JSON Web Token)** based authentication.

- There is **no session stored on the server**
- After login, the server gives you a **token**
- You must send this token in the **header of every protected request**
- The token **expires after 60 minutes** — after that you must login again

---

## 2. Register

### Endpoint
```
POST /auth/register
Content-Type: application/json
```

### Request Body
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

### Field Rules
| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `user_name` | string | ✅ | 2–255 characters |
| `email` | string | ✅ | Valid email format, must be unique |
| `password` | string | ✅ | Min 8 characters |
| `role` | string | ✅ | Must be `volunteer` for self-registration |
| `phone` | string | ❌ | Optional |
| `latitude` | number | ❌ | -90 to 90 (must be sent with `longitude`) |
| `longitude` | number | ❌ | -180 to 180 (must be sent with `latitude`) |
| `radius_km` | number | ❌ | Must be > 0 |

> ⚠️ `owner` and `admin` accounts cannot self-register.
> They must be created through organization flows.

### How frontend should collect location

- Do **not** ask user to type latitude/longitude manually.
- Use browser geolocation and send those values in register payload.
- If user clicks **Deny** or skips, register without coordinates and update later.

Example:
```javascript
navigator.geolocation.getCurrentPosition(
  async (position) => {
    const payload = {
      user_name: "Abhishek Singh",
      email: "aksingh@example.com",
      password: "StrongPass@123",
      role: "volunteer",
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      radius_km: 5
    };

    await fetch("http://localhost:8000/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  },
  async () => {
    // fallback: register without location
  }
);
```

### Success Response `201`
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

> ⚠️ **Password is never returned in any response.**

### Error Responses
| Code | `detail` | What to show user |
|------|----------|-------------------|
| `409` | `"Email already registered"` | "This email is already in use" |
| `422` | Validation details | Show field-level errors |

---

## 3. Login

### Endpoint
```
POST /auth/login
Content-Type: application/json
```

### Request Body
```json
{
  "email": "aksingh@example.com",
  "password": "StrongPass@123"
}
```

### Success Response `200`
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 3600
}
```

- `access_token` — the JWT string, send this on every protected request
- `token_type` — always `"bearer"`
- `expires_in` — seconds until expiry (3600 = 1 hour)

> 💡 **Save `access_token` immediately after login.** See [Where to Store the Token](#6-where-to-store-the-token).

### Error Responses
| Code | `detail` | What to show user |
|------|----------|-------------------|
| `401` | `"Invalid email or password"` | "Incorrect email or password" |
| `403` | `"Account is inactive"` | "Your account has been disabled" |

---

## 4. Using the Token on Protected Routes

Every request to a protected endpoint **must include the token** in the `Authorization` header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Example (JavaScript fetch)
```javascript
const token = localStorage.getItem("access_token");

const response = await fetch("http://localhost:8000/auth/me", {
  method: "GET",
  headers: {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json"
  }
});
```

### Example (Axios)
```javascript
axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
// or per-request:
axios.get("/auth/me", {
  headers: { Authorization: `Bearer ${token}` }
});
```

> ⚠️ If you forget the header entirely, you get `403 Forbidden` (not `401`).

---

## 5. Get Current User

### Endpoint
```
GET /auth/me
Authorization: Bearer <token>
```

### Success Response `200`
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

Use this to:
- Show the logged-in user's name/role in the navbar
- Check the user's role before rendering role-specific UI
- Refresh user data after profile updates

### Update location later (recommended fallback)

If user skipped location during registration, call:

```
PATCH /users/me/location
Authorization: Bearer <token>
Content-Type: application/json
```

Request body example:
```json
{
  "latitude": 28.6139,
  "longitude": 77.2090,
  "radius_km": 5.0
}
```

Rules:
- Send `latitude` and `longitude` together.
- You can send only `radius_km` to update matching radius.
- If both coordinate fields are missing and `radius_km` is missing, backend returns `422`.

---

## 6. Where to Store the Token

### Option A — `localStorage` (recommended for MVP)
```javascript
// After login
localStorage.setItem("access_token", data.access_token);

// On every request
const token = localStorage.getItem("access_token");

// On logout
localStorage.removeItem("access_token");
```

✅ Simple, survives page refresh  
⚠️ Vulnerable to XSS — fine for MVP, harden later

### Option B — `httpOnly` Cookie (more secure, more setup)
- Server sets the cookie, JavaScript cannot read it
- Requires CORS and cookie configuration on the backend
- Use this for production hardening later

---

## 7. Token Expiry and What to Do

The token expires **60 minutes** after login.

### How to detect expiry
Any protected route will return `401` with this body:
```json
{ "detail": "Invalid or expired token" }
```

### What to do on the frontend
```javascript
async function apiRequest(url, options = {}) {
  const token = localStorage.getItem("access_token");

  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    }
  });

  if (response.status === 401) {
    const body = await response.json();

    if (body.detail === "Invalid or expired token" ||
        body.detail === "User not found") {
      // Token is dead — clear it and send user to login
      localStorage.removeItem("access_token");
      window.location.href = "/login";
      return;
    }
  }

  return response;
}
```

> 💡 Wrap all API calls in a function like this so expiry is handled globally.

---

## 8. Error Reference

### Full error table for all auth endpoints

| Endpoint | HTTP Code | `detail` | Cause | Frontend Action |
|----------|-----------|----------|-------|-----------------|
| `POST /auth/register` | `409` | `"Email already registered"` | Duplicate email | Show "email taken" message |
| `POST /auth/register` | `422` | Validation object | Missing/invalid fields | Show field errors |
| `POST /auth/login` | `401` | `"Invalid email or password"` | Wrong credentials | Show login error |
| `POST /auth/login` | `403` | `"Account is inactive"` | User deactivated | Show "account disabled" |
| Any protected route | `401` | `"Invalid or expired token"` | Token expired or tampered | Clear token, redirect to login |
| Any protected route | `401` | `"User not found"` | Token valid but user deleted | Clear token, redirect to login |
| Any protected route | `403` | `"Account is inactive"` | User deactivated mid-session | Clear token, redirect to login |

### How 401 on login vs 401 on protected route differ

Both return `401` but they are completely distinguishable:

```
POST /auth/login  →  401  =  wrong credentials  (user typed wrong email/password)
GET  /auth/me     →  401  =  token problem       (expired, tampered, or missing)
GET  /needs       →  401  =  token problem       (same)
```

The **endpoint you called** tells you which case it is.  
The **`detail` field** gives you the exact reason.

---

## 9. Full Frontend Flow Diagram

```
App Starts
    │
    ├── Token in localStorage?
    │       │
    │      YES → Call GET /auth/me
    │               │
    │              200 → Store user in state → Show app
    │               │
    │              401 → Clear token → Redirect to login
    │
    └── NO → Show login screen


Login Screen
    │
    User submits email + password
    │
    POST /auth/login
    │
    ├── 200 → Save token → Call GET /auth/me → Show app
    │
    ├── 401 → Show "Incorrect email or password"
    │
    └── 403 → Show "Account is inactive"


Any API call (protected route)
    │
    Attach: Authorization: Bearer <token>
    │
    ├── 200/201 → Handle success
    │
    ├── 401 → Clear token → Redirect to login
    │
    ├── 403 → Show "Not authorized" message
    │
    └── 422 → Show field validation errors


Logout
    │
    localStorage.removeItem("access_token")
    │
    Redirect to login screen
    (no server call needed — token just gets abandoned)
```

---

## Quick Reference

```javascript
// Register
POST /auth/register        → no token needed

// Login
POST /auth/login           → no token needed → get token

// All other endpoints
Authorization: Bearer <token>   ← required in header

// Token lifetime
60 minutes → then 401 → login again

// Logout
delete token from localStorage → done
```
