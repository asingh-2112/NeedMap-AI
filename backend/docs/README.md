# NeedMap AI — Docs Index

This folder contains backend API and frontend integration documentation.

## Files

- [api.md](api.md) — complete backend API specification (all endpoints, payloads, responses)
- [auth-guide.md](auth-guide.md) — frontend auth integration guide
- [users-guide.md](users-guide.md) — frontend user/profile integration guide
- [organizations-guide.md](organizations-guide.md) — frontend organization/role integration guide
- [needs-guide.md](needs-guide.md) — frontend needs and need-sources integration guide
- [volunteers-guide.md](volunteers-guide.md) — frontend volunteers and skills integration guide
- [assignments-guide.md](assignments-guide.md) — frontend assignments integration guide

## Implemented APIs

- Needs: `POST /needs`, `GET /needs`, `GET /needs/heatmap`, `GET /needs/{id}`, `PATCH /needs/{id}`, `DELETE /needs/{id}`
- Need Sources: `POST /needs/{id}/sources`, `GET /needs/{id}/sources`
- Volunteers: `POST /volunteers`, `GET /volunteers`, `GET /volunteers/{id}`, `PATCH /volunteers/{id}`
- Volunteer Skills: `POST /volunteers/{id}/skills`, `PATCH /volunteers/{id}/skills/{sid}`, `DELETE /volunteers/{id}/skills/{sid}`
- Assignments: `POST /assignments`, `GET /assignments`, `GET /assignments/{id}`, `PATCH /assignments/{id}/status`, `PATCH /assignments/{id}/feedback`

## Frontend Notes

- Protected routes require: `Authorization: Bearer <access_token>`
- User roles are: `owner`, `admin`, `volunteer`
- Use `GET /auth/me` as source of truth for current user role and organization context
