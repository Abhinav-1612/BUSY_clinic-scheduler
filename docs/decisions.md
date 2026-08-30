# Decisions

Five real decisions made during the build, including one that was later reversed.

---

## 1. FastAPI (Python) over Node.js/Express for the backend

**Chosen:** FastAPI  
**Rejected:** Node.js + Express + TypeScript

**Reasoning:**  
FastAPI gives automatic request/response validation via Pydantic, auto-generated interactive API docs at `/docs` (useful for manual testing during development), and async support out of the box. The tight integration between SQLModel (the ORM) and Pydantic means DB models and API schemas share a single class definition — less code to write and fewer places for the two to drift apart. Python is also the language I move fastest in for data-heavy backend work.

Express was rejected not because it is worse, but because the TypeScript overhead on a time-boxed project adds friction without adding proportional value. Python's Pydantic provides the same runtime type safety on the API surface where it matters.

**Trade-off accepted:** Python's async story is more complex than Node's (SQLModel's session is synchronous by default), and cold starts on Render's free tier are slightly slower for Python than for Node.

---

## 2. SQLModel over Prisma or raw SQLAlchemy

**Chosen:** SQLModel  
**Rejected:** Prisma, raw SQLAlchemy Core

**Reasoning:**  
SQLModel is built by the same author as FastAPI and is designed to work with it. A single class declaration serves as both the SQLAlchemy ORM model and the Pydantic validation schema. This eliminates the "DTO layer" — the separate schema classes that Prisma or raw SQLAlchemy would require just to serialize responses.

Prisma was considered and rejected because it is primarily a Node/TypeScript ORM — its Python support (Prisma Client Python) is experimental and not production-recommended.

Raw SQLAlchemy Core was rejected because the boilerplate for simple CRUD operations is significantly higher without the Pydantic integration.

---

## 3. ⚠ Reversed decision — Supabase Auth → Custom JWT

**Originally chosen:** Supabase Auth  
**Later reversed to:** Custom JWT with `python-jose` + `passlib`

**Why it was chosen initially:**  
Supabase Auth offers email/password authentication, session management, and JWT issuance out of the box. It seemed like a good fit given Supabase was already being used for the database.

**Why it was reversed:**  
Supabase Auth is designed to be used with the Supabase client libraries, which are JavaScript/TypeScript-first. Integrating it with a Python FastAPI backend requires manually verifying Supabase JWTs using the project's JWT secret — at which point you are essentially doing the same work as a custom JWT setup, but with an extra dependency and an external service in the critical auth path.

More importantly, Supabase Auth stores the `role` claim in a separate user metadata object, not directly in the JWT payload. This made the FastAPI `require_front_desk` / `require_provider` dependency injection pattern awkward. Custom JWT lets us put `role` directly in the token payload and read it with a single `payload.get("role")` call.

**Cost of reversal:** About 1 hour — rewriting `auth.py`, removing the Supabase client import, updating the login endpoint to use `OAuth2PasswordRequestForm`. No other files were affected.

---

## 4. Server-side filtering/sorting/pagination over client-side

**Chosen:** All filtering, sorting, and pagination done in SQL on the server  
**Rejected:** Load all appointments into the browser, filter with JavaScript

**Reasoning:**  
The brief explicitly states *"All of this must happen on the server — do not load every appointment into the browser and filter there."* But even without that requirement, client-side filtering is the wrong pattern for any dataset that grows beyond a few hundred rows. A clinic that books 20 appointments per day per provider will have tens of thousands of rows within a year.

The server-side implementation uses a single SQL query with `WHERE`, `ORDER BY`, and `LIMIT/OFFSET`, plus a separate `SELECT COUNT(*)` on the filtered result set for the total count. The React UI sends filter state as query parameters and lets TanStack Query manage caching — each unique combination of filters gets its own cache key.

**Trade-off accepted:** More complex server code and a loading state on every filter change, versus a simpler client that just filters an in-memory array. The loading state is handled by TanStack Query's `isLoading` / `keepPreviousData` flags.

---

## 5. On-read re-fire for alerts rather than a background cron job

**Chosen:** Check and reset dismissed alerts on every `GET /api/alerts/` request  
**Rejected:** A background scheduled job (APScheduler, Celery Beat) that resets dismissed alerts periodically

**Reasoning:**  
The re-fire requirement (dismissed alert reappears if still unconfirmed within 1 hour) needs to be implemented somewhere. A background job is the "correct" production approach — it would run every few minutes and reset `dismissed_at` for any qualifying alert. However, this requires either running APScheduler inside the FastAPI process (fragile on Render's free tier, which can have multiple restarts) or a separate worker process (adds deployment complexity).

On-read re-fire is simpler: every time front-desk staff open the Alerts page, the server checks and resets any qualifying dismissed alerts before returning the list. The behaviour is functionally identical from the user's perspective — they open the page, the re-fired alert appears.

**Trade-off accepted:** The alert only "reappears" when someone actively opens the Alerts page. If nobody opens the page in the hour before an appointment, the re-fire happens at the next page open. For a small clinic where the front desk actively monitors the system, this is acceptable. At scale, or for a system with push notifications, a proper background job would be necessary.
