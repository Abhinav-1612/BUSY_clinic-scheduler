# AI Prompts

All prompts used during this project, in chronological order, grouped by task. Includes prompts that produced bad output and what was done about them.

---

## 1. Initial Planning

**Prompt:**
> "Analyse this assignment README and make a unique plan covering tech stack, architecture, database schema, session breakdown, and what makes a submission stand out. Focus on the non-obvious requirements — the exact rules in Goal 4 (state machine), Goal 10 (alert re-fire), and the server-enforced auth in Goal 1."

**Output:** A structured implementation plan covering stack rationale, schema design, a 7-session build order, and explicit notes on the tricky requirements. Also flagged the `decisions.md` reversal requirement as something most candidates miss.

**Quality:** Good. Used as the foundation for the entire project.

---

## 2. Database Schema Design

**Prompt:**
> "Design the SQLModel models for a clinic scheduling system. Tables needed: users (with role enum), providers (one-to-one with users), appointment_slots, appointments (one-to-one with slot), appointment_providers join table (many-to-many care team), visit_notes, appointment_history (immutable audit log), unconfirmed_alerts. Include all relationships, FKs, enums, and constraints."

**Output:** Complete `models.py` with all 9 tables, correct relationship declarations, and enums.

**Quality:** Good. One small issue — the initial output used `Optional[List[...]]` for relationship fields where SQLModel expects just `List[...]`. Fixed immediately by removing the `Optional` wrapper on list relationships.

---

## 3. State Machine — First Attempt (Bad Output)

**Prompt:**
> "Write a Python function that validates appointment status transitions. States: requested, confirmed, checked_in, completed, no_show, cancelled."

**Output:**
```python
def validate_transition(from_status, to_status):
    valid = {
        "requested": ["confirmed", "cancelled"],
        "confirmed": ["checked_in", "cancelled", "no_show"],
        ...
    }
    return to_status in valid.get(from_status, [])
```

**What was wrong:** This returned a simple boolean with no error message. The brief requires the server to return *"a message explaining why"* on an illegal move. Also completely missed the two critical rules: (a) No Show is only valid after the slot's scheduled time has passed, and (b) cancellation after check-in must be explicitly rejected with a different message from other illegal transitions.

**What I changed:**
- Changed return type to `tuple[bool, str]`
- Added `slot_date` and `slot_time` parameters
- Added the `datetime.utcnow() <= slot_datetime` check for No Show
- Added explicit handling for the `checked_in → cancelled` case with its own specific message
- Added `cancel_reason` parameter with the not-empty check

**Revised prompt:**
> "Rewrite the function to return (bool, error_message_str). Add parameters for slot_date, slot_time (for No Show timing check) and cancel_reason (required for cancellation). Handle the edge case where checked_in → cancelled must return a specific rejection message separate from general invalid transitions."

**Revised output:** The final `utils/state_machine.py` — used without further changes.

---

## 4. Alert Re-fire Logic

**Prompt:**
> "Implement the unconfirmed alert re-fire logic from the brief: an alert dismissed by front-desk staff reappears if the appointment is still unconfirmed within 1 hour of its scheduled time. The check should run on every GET /api/alerts/ request, not as a background job."

**Output:** The `_refire_check` function in `routers/alerts.py`. Correct logic: check if `dismissed_at IS NOT NULL` and `slot_datetime - utcnow() <= 1 hour`, then reset `dismissed_at = None`.

**Quality:** Good first output. One clarification prompt was needed:

**Follow-up prompt:**
> "The refire check currently runs in a loop but the session.add() call inside the loop might not flush between iterations. Make sure the alert changes are persisted correctly — all dismissal resets should happen before the final response is built."

**Result:** Added `session.flush()` after each alert reset inside the loop, then a single `session.commit()` at the end before building the response.

---

## 5. Bulk Slot Generation

**Prompt:**
> "Write the bulk slot generation endpoint. Input: provider_id, date_from, date_to, weekly_blocks (list of {day_of_week, start_time, duration_minutes}). Output must include exact lists of created slots and skipped slots (with collision reason and the existing_slot_id), not just counts. Front-desk only."

**Output:** `routers/bulk.py` — correct structure with `created[]` and `skipped[]` arrays.

**Quality:** Good. The collision check initially used `==` on `start_time` which works for exact time matches but would miss overlapping slots (e.g., a 60-minute slot and a 30-minute slot starting at the same time). For this project, slots are always created with exact start times, so exact equality is sufficient. Noted as a known limitation.

---

## 6. Dashboard Aggregate Queries

**Prompt:**
> "Write a FastAPI endpoint that returns dashboard data in a single call: (1) headline numbers (appointments today, checked-in now, no-shows this week, confirmed upcoming), (2) breakdown by status using GROUP BY, (3) breakdown by provider using a JOIN + GROUP BY, (4) no-show rate per week for the last 8 weeks expressed as a percentage."

**Output:** `routers/dashboard.py` — all four sections in one response.

**Quality:** The weekly no-show rate calculation initially computed `total` as all appointments in the week regardless of status, which made the rate meaningless (e.g., 1 no-show / 100 total including future requested = 1%, but that 1% includes appointments that haven't happened yet). 

**What I changed:** Changed the `total` denominator to only count appointments in terminal states (`completed`, `no_show`, `cancelled`) — i.e., appointments that have resolved. This gives a meaningful rate: "of appointments that finished, what percentage were no-shows?"

---

## 7. Frontend Design System

**Prompt:**
> "Write a complete dark-theme CSS design system using vanilla CSS custom properties. Needs: sidebar layout, stat cards, tables with sticky headers, status badges (one per appointment status), modal overlay, timeline component, filter bar, pagination, empty state, loading spinner. Colors should feel premium — not generic red/blue/green. Use a dark background around #0d0f14 with an indigo/blue accent."

**Output:** The full `index.css` — 500+ lines. Used directly.

**Quality:** Good. The sidebar `position: fixed` with `margin-left: var(--sidebar-w)` on the main content was the correct approach and generated correctly on the first try.

---

## 8. Appointments Page — Detail Modal

**Prompt:**
> "Write a React appointment detail modal that shows: patient info, slot info, current status badge, action buttons for legal next statuses (front-desk and provider see different options), cancellation reason text input that appears only when Cancel is clicked, reassign provider section (front-desk only), care team management (add/remove supporting providers), visit notes list with add form (provider only), and an immutable history timeline with colored dots per event type."

**Output:** `AppointmentsPage.jsx` — the `AppointmentModal` component.

**Quality:** Good structure. Initial output had a bug: the `nextStatuses` array for action buttons was computed from a static map in the React component, duplicating the state machine logic from the backend. This is fine for UX (pre-emptively hiding buttons that would fail), but the comment added to the code makes clear that the server is the authoritative source and will reject illegal transitions regardless of what the UI shows.

---

## 9. Seed Script

**Prompt:**
> "Write a seed script that creates: 1 front-desk user, 3 provider users with provider profiles, 60+ appointment slots across 30 days (weekdays only), and 25+ appointments in mixed statuses (completed with history, no-shows, cancellations with reasons, today's appointments in various states, future appointments). Also create visit notes for completed appointments and at least one supporting provider assignment. Make it safely re-runnable by clearing tables first."

**Output:** `seed.py` — used with minor adjustments.

**Quality:** Good. The initial output had a dependency ordering issue in `clear_tables` — it tried to delete `appointments` before `appointment_providers`, which violated FK constraints. Fixed by reordering the delete sequence to respect dependencies (join tables and leaf tables first, then parent tables).
