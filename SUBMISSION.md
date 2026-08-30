# Submission

## Live Application

> **URL:** _(to be filled after deployment — see Session 4)_

> **Note on cold starts:** The API is hosted on Render's free tier, which spins down after 15 minutes of inactivity. The first request after a period of inactivity may take 30–60 seconds to respond. Subsequent requests are fast. If the login page appears stuck, wait ~60 seconds and try again.

---

## GitHub Repository

**URL:** https://github.com/Abhinav-1612/BUSY_clinic-scheduler

---

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Front Desk | `frontdesk@clinic.demo` | `Demo1234!` |
| Provider (Dr. Smith) | `dr.smith@clinic.demo` | `Demo1234!` |
| Provider (Dr. Jones) | `dr.jones@clinic.demo` | `Demo1234!` |
| Provider (Dr. Miller) | `dr.miller@clinic.demo` | `Demo1234!` |

**What to check with each role:**
- **Front Desk** → lands on Dashboard (charts, headline numbers), can see Appointments list with filters, Slots management, Bulk Generator, Alerts panel
- **Provider** → lands on Appointments (their own only), can open appointments and add visit notes, cannot access Dashboard / Alerts / Bulk

---

## Seeded Demo Data

The database is pre-populated with:
- 3 providers across two specialties (Physical Therapy, Dental)
- 60+ availability slots across 30 days (past 5 + next 25, weekdays only)
- 25+ appointments in mixed statuses:
  - Past: completed (with visit notes), no-shows, cancellations with reasons
  - Today: checked-in, confirmed, requested
  - Future: confirmed, requested (some triggering the unconfirmed alerts)
- Care team entries (Dr. Miller as supporting provider on a Dr. Smith appointment)
- Immutable history timelines on all appointments showing status progression

---

## Key Features to Demo

1. **Role enforcement** — log in as Dr. Smith, try opening `/dashboard` directly → redirected to `/appointments`. The API also returns 403 if you call front-desk endpoints with a provider token.

2. **State machine** — open any Confirmed appointment and try to mark it No Show while its time is in the future → red toast error with explanation.

3. **Alert re-fire** — dismiss an alert in the Alerts panel. If the appointment is within 1 hour, refresh the page → the alert reappears.

4. **Bulk generation** — go to Bulk Generator, create a 4-week pattern of Monday + Wednesday 9:00 AM slots for a provider → results show exact lists of created and skipped slots.

5. **Immutable history** — open any appointment detail → scroll to "Activity Timeline" → every status change, care team assignment, and note addition is listed with author and timestamp.

6. **CSV export** — on the Slots page, pick a date and click Export CSV → downloads a file of that day's schedule.

---

## What I Tried for Hosting / Where It Broke

_(Fill in if deployment did not complete — describe what was attempted and where it failed.)_

---

## Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Database | PostgreSQL on Supabase (free tier) |
| Backend API | FastAPI (Python) on Render (free tier) |
| Frontend | React + Vite (plain JS) on Vercel (free tier) |
| Auth | Custom JWT — python-jose + passlib[bcrypt] |
| ORM | SQLModel |
