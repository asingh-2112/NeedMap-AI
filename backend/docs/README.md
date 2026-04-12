# NeedMap AI — Docs Index

This folder contains backend API and frontend integration documentation.

## Files

- [api.md](api.md) — complete backend API specification (all endpoints, payloads, responses)
- [auth-guide.md](auth-guide.md) — frontend auth integration guide
- [users-guide.md](users-guide.md) — frontend user/profile integration guide
- [organizations-guide.md](organizations-guide.md) — frontend organization/role integration guide
- [needs-guide.md](needs-guide.md) — frontend needs and need-sources integration guide

## Newly implemented APIs

As of the latest update, backend now includes:

- Needs APIs
  - `POST /needs`
  - `GET /needs`
  - `GET /needs/heatmap`
  - `GET /needs/{need_id}`
  - `PATCH /needs/{need_id}`
  - `DELETE /needs/{need_id}`

- Need Sources APIs
  - `POST /needs/{need_id}/sources`
  - `GET /needs/{need_id}/sources`

## Frontend Notes

- Protected routes require: `Authorization: Bearer <access_token>`
- User roles are: `owner`, `admin`, `volunteer`
- Use `GET /auth/me` as source of truth for current user role and organization context
