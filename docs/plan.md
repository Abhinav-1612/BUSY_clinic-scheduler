# Plan

## How the work was split

The 12-hour budget was divided into four working sessions across two days, with documentation written during and after coding rather than from memory at the end.

---

## Session Breakdown

### Session 1 — Backend Foundation (~2.5 hours)
**Goal:** Working API with auth and all 10 feature areas stubbed or complete.

**What was built:**
- Git repository, folder structure (`backend/`, `frontend/`, `docs/`)
- `.gitignore`, `README.md`, `SUBMISSION.md` stubs
- `requirements.txt` with all Python dependencies
- SQLModel DB models: all 9 tables with relationships, enums, and constraints
- `database.py` — engine setup, `get_session` dependency
- `auth.py` — bcrypt hashing, JWT creation/verification, `require_front_desk` / `require_provider` dependency functions
- `utils/state_machine.py` — pure `validate_transition` function encoding all exact rules from Goal 4
- All 8 routers: `auth`, `appointments` (full state machine, history, care team, CSV), `slots`, `notes`, `bulk`, `dashboard`, `alerts` (with re-fire logic), `providers`
- `seed.py` — rich demo data (4 users, 3 providers, 60+ slots, 25+ appointments in mixed statuses)

**Estimated:** 2 hours  
**Actual:** 2.5 hours (state machine edge cases and alert re-fire logic took longer to think through carefully)

**Commit:** `feat: backend foundation — FastAPI app, SQLModel models, JWT auth, all 10 feature routers`

---

### Session 2 — Frontend (~3 hours)
**Goal:** React + Vite UI covering all 10 goals, role-aware, connected to the backend data model.

**What was built:**
- Vite + React scaffold (plain JavaScript)
- Package installation: react-router-dom, @tanstack/react-query, axios, recharts, react-hot-toast, lucide-react
- `index.css` — full dark-theme design system with CSS custom properties, sidebar layout, tables, badges, modals, timeline, stat cards
- `api/client.js` — Axios instance with JWT interceptor and 401 auto-logout
- `context/AuthContext.jsx` — login/logout, localStorage persistence, role helpers
- `components/Sidebar.jsx` — role-aware navigation, live alert badge
- `components/ui.jsx` — shared: StatusBadge, Spinner, EmptyState, Modal, date/time formatters
- `pages/LoginPage.jsx` — login form with demo credential fill buttons
- `pages/DashboardPage.jsx` — 4 stat cards, LineChart (no-show trend), PieChart (status), BarChart (provider), weekly detail table
- `pages/AppointmentsPage.jsx` — server-side filtered/sorted/paginated table, full detail modal with status actions, cancel reason input, reassign, care team, visit notes, immutable history timeline
- `pages/SlotsPage.jsx` — slot list, archive/restore, CSV export
- `pages/BulkPage.jsx` — weekly block form, created/skipped results
- `pages/AlertsPage.jsx` — active/dismissed alerts, urgency indicator, dismiss action
- `App.jsx` — routing with ProtectedRoute guards

**Estimated:** 3 hours  
**Actual:** 3 hours

**Build verified:** `npm run build` — 2510 modules, 0 errors  
**Commit:** `feat: frontend — React+Vite app, all pages, design system, auth flow`

---

### Session 3 — Documentation (~1 hour)
**Goal:** All 5 required docs files written with real content, not placeholder text.

**What was written:**
- `docs/architecture.md` — three-tier diagram, component descriptions, end-to-end request path, what was not built
- `docs/schema.md` — all 9 tables, relationship types, DB vs application constraints, denormalization rationale, 100x scale analysis
- `docs/decisions.md` — 5 decisions including the Supabase Auth reversal
- `docs/plan.md` — this file
- `docs/ai-prompts.md` — actual prompts used, including a bad output and what changed
- `SUBMISSION.md` — live URL, demo credentials, deployment notes

**Estimated:** 1 hour  
**Actual:** ~1 hour

---

### Session 4 — Deployment (~1.5 hours)
**Goal:** Live, seeded deployment on free-tier hosting.

**Steps:**
1. Create Supabase project → copy `DATABASE_URL`
2. Create backend `.env` → `pip install` → test locally with `uvicorn`
3. Run `python seed.py` against Supabase DB
4. Deploy FastAPI to Render (set `DATABASE_URL`, `SECRET_KEY`, `ALLOWED_ORIGINS` env vars)
5. Deploy React to Vercel (set `VITE_API_URL` to Render URL)
6. Verify live login with demo credentials
7. Final commit and push

---

## Build Order Rationale

**Backend before frontend** — API routes define the data contract. Building them first meant the frontend could be written against a known shape rather than guessing at response structure and refactoring later.

**State machine before routes** — `validate_transition` was written as a pure function before the appointment router, so the routing code just calls it and handles the return value. This made the logic easy to reason about and easy to explain.

**Full design system before components** — writing `index.css` first with all CSS custom properties meant every component could just use class names like `card`, `badge-confirmed`, `btn-primary` without ad-hoc inline styles scattered through the codebase.

---

## What Was Cut

- **Automated tests** — the state machine is structured to be unit-testable, but no test suite was written. Time was prioritised toward hitting all 10 goals correctly.
- **Code splitting** — the Vite build warned about a large bundle (771 KB unminified). In production, Recharts and React Router would be split into separate chunks. Not done in this submission.
- **Per-visit-type default durations** — stretch feature, not attempted.
- **Printable day sheet** — stretch feature, not attempted.
