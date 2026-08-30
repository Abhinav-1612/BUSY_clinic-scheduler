# Architecture

## Overview

ClinicFlow is a three-tier web application: a React single-page app in the browser, a FastAPI REST API on the server, and a PostgreSQL database hosted on Supabase.

```
┌─────────────────────────────┐
│   Browser (Vercel)          │
│   React + Vite (plain JS)   │
│   TanStack Query, Recharts  │
└────────────┬────────────────┘
             │ HTTPS  JSON REST
             ▼
┌─────────────────────────────┐
│   API Server (Render)       │
│   FastAPI + Python          │
│   SQLModel ORM              │
│   JWT auth (python-jose)    │
└────────────┬────────────────┘
             │ TCP  psycopg2
             ▼
┌─────────────────────────────┐
│   Database (Supabase)       │
│   PostgreSQL 15             │
└─────────────────────────────┘
```

## Components

### Browser (Vercel)
- **React 19 + Vite 8** — no TypeScript, plain JavaScript throughout
- **React Router v6** — client-side routing with role-based `ProtectedRoute` wrappers
- **TanStack Query (React Query)** — server-state cache; all data fetching, invalidation, and optimistic UI go through query keys
- **Axios** — HTTP client with two interceptors: one that attaches the JWT from localStorage to every request, one that redirects to `/login` on any 401 response
- **Recharts** — dashboard charts (line, bar, pie)
- **react-hot-toast** — toast notifications for mutations
- **Lucide React** — icon set
- **Vanilla CSS** — custom design system via CSS custom properties (no Tailwind)

### API Server (Render)
- **FastAPI** — async Python web framework with automatic OpenAPI docs at `/docs`
- **SQLModel** — ORM built on SQLAlchemy + Pydantic; models are the single source of truth for both DB schema and request/response validation
- **python-jose + passlib[bcrypt]** — JWT creation/verification and password hashing
- **Uvicorn** — ASGI server
- Eight routers mounted under `/api/`:
  - `auth` — login, /me
  - `appointments` — CRUD, status transitions, CSV export, care team
  - `slots` — CRUD, archive/restore
  - `notes` — visit notes per appointment
  - `bulk` — recurring slot generation
  - `dashboard` — aggregate queries
  - `alerts` — unconfirmed alert list with re-fire logic
  - `providers` — provider list

### Database (Supabase — PostgreSQL 15)
Nine tables. See `docs/schema.md` for full detail. All relationships enforced by foreign keys. No row-level security used — access control is in FastAPI middleware.

## Request Path — End to End

**Example action: Front-desk staff confirms an appointment.**

1. Staff clicks "Confirm" in the appointment detail modal in the React UI.
2. React fires `useMutation` → `PATCH /api/appointments/{id}/status` with body `{"status": "confirmed"}` and `Authorization: Bearer <token>` header.
3. Axios request interceptor reads the token from `localStorage` and adds the header.
4. FastAPI receives the request. The route depends on `get_current_user`, which calls `decode_token` (python-jose), extracts `user_id` from the JWT `sub` claim, and loads the `User` row from the database.
5. The route handler loads the `Appointment` and its associated `AppointmentSlot`.
6. `validate_transition(from_status="requested", to_status="confirmed", slot_date=..., slot_time=...)` is called — a pure function that returns `(True, "")` for this legal move.
7. `appointment.status` is updated. An `AppointmentHistory` row is inserted in the same database session with `event_type="status_change"`, `old_value="requested"`, `new_value="confirmed"`, and `changed_by=user.id`.
8. `session.commit()` — both the update and the history insert happen atomically.
9. FastAPI returns 200 with the updated appointment as JSON.
10. TanStack Query's `onSuccess` callback invalidates the `['appointments']` and `['appointment', id]` query keys, triggering a re-fetch.
11. The UI updates to show the "Confirmed" badge. A green toast notification appears.

## What Was Not Built

The following items were deliberately excluded within the 12-hour budget:

- **Automated reminder messages** — would require a job queue (Celery, ARQ) or external email service (SendGrid). Out of scope.
- **Recurring appointments** — data model change (self-referential FK or recurrence rule table). Not attempted.
- **Patient-facing self-service booking** — would need a separate auth flow and public-facing UI. Skipped.
- **Waitlist** — would add complexity to the slot-booking flow. Not built.
- **Room/equipment assignment** — straightforward model addition but adds surface area. Cut for time.
- **TypeScript** — intentionally omitted per project preference. Python's Pydantic on the backend provides the type safety where it matters most.
- **WebSockets / real-time push** — polling (TanStack Query `refetchInterval`) is used instead. Simpler and sufficient for a small clinic.
- **Automated tests** — the state machine function is designed to be unit-testable, but no test suite was written within the time budget.
