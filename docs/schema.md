# Schema

## Tables

### `users`
| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER | Primary key, auto-increment |
| `email` | VARCHAR | Unique, indexed — login identifier |
| `hashed_password` | VARCHAR | bcrypt hash — never stored plain |
| `full_name` | VARCHAR | Display name throughout the UI |
| `role` | VARCHAR | Enum: `front_desk` \| `provider` — checked server-side on every request |
| `is_active` | BOOLEAN | Default true; inactive users cannot log in |
| `created_at` | TIMESTAMP | UTC, set on insert |

### `providers`
| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER | Primary key |
| `user_id` | INTEGER | FK → `users.id`, UNIQUE — one provider profile per user account |
| `specialty` | VARCHAR | e.g. "Physical Therapy", "Dental" |
| `display_name` | VARCHAR | Shown in dropdowns and schedule views |
| `is_active` | BOOLEAN | Soft-delete flag |

### `appointment_slots`
| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER | Primary key |
| `provider_id` | INTEGER | FK → `providers.id` |
| `slot_date` | DATE | The calendar date |
| `start_time` | TIME | Wall-clock time of the slot |
| `duration_minutes` | INTEGER | Default 30 |
| `is_archived` | BOOLEAN | Archived slots disappear from schedule but are not deleted |
| `created_by` | INTEGER | FK → `users.id` — who created the slot |
| `created_at` | TIMESTAMP | UTC |
| `updated_at` | TIMESTAMP | UTC, updated on edits |

### `appointments`
| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER | Primary key |
| `slot_id` | INTEGER | FK → `appointment_slots.id`, UNIQUE — one appointment per slot |
| `patient_name` | VARCHAR | Indexed for text search |
| `patient_email` | VARCHAR | |
| `patient_phone` | VARCHAR | Nullable |
| `status` | VARCHAR | Enum: `requested` \| `confirmed` \| `checked_in` \| `completed` \| `no_show` \| `cancelled` |
| `cancel_reason` | VARCHAR | Nullable — required when status = `cancelled` |
| `created_at` | TIMESTAMP | UTC |
| `updated_at` | TIMESTAMP | UTC, touched on every status change |

### `appointment_providers` (join table — many-to-many)
| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER | Primary key |
| `appointment_id` | INTEGER | FK → `appointments.id` |
| `provider_id` | INTEGER | FK → `providers.id` |
| `role` | VARCHAR | Enum: `scheduling` \| `supporting` |
| `assigned_at` | TIMESTAMP | UTC |
| `assigned_by` | INTEGER | FK → `users.id` |

**Unique constraint:** `(appointment_id, provider_id)` — a provider cannot appear twice on the same appointment's care team.

### `visit_notes`
| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER | Primary key |
| `appointment_id` | INTEGER | FK → `appointments.id` |
| `provider_id` | INTEGER | FK → `providers.id` — who wrote it |
| `content` | TEXT | Free-text clinical observations |
| `created_at` | TIMESTAMP | UTC |
| `updated_at` | TIMESTAMP | UTC — only the authoring provider can update |

### `appointment_history` (immutable audit log)
| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER | Primary key |
| `appointment_id` | INTEGER | FK → `appointments.id` |
| `changed_by` | INTEGER | FK → `users.id` |
| `event_type` | VARCHAR | Enum: `status_change` \| `supporting_provider_added` \| `supporting_provider_removed` \| `cancellation` \| `visit_note_added` |
| `old_value` | VARCHAR | Nullable — previous status or provider ID |
| `new_value` | VARCHAR | Nullable — new status or provider ID |
| `description` | TEXT | Human-readable summary of what happened |
| `created_at` | TIMESTAMP | UTC — set on insert, never changed |

**Immutability:** The application never issues an UPDATE or DELETE against this table. No endpoint exists for either operation. The only write is INSERT, done transactionally with the action that caused the event.

### `unconfirmed_alerts`
| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER | Primary key |
| `appointment_id` | INTEGER | FK → `appointments.id`, UNIQUE — one alert record per appointment |
| `dismissed_at` | TIMESTAMP | Nullable — set when front-desk dismisses; NULL = active alert |
| `dismissed_by` | INTEGER | Nullable, FK → `users.id` |
| `refire_after` | TIMESTAMP | Nullable — reserved for future use |

**Re-fire logic:** Every time `GET /api/alerts/` is called, the server checks each dismissed alert. If `dismissed_at IS NOT NULL` and the slot's scheduled time is within 1 hour, `dismissed_at` is reset to NULL — the alert becomes active again regardless of the earlier dismissal.

---

## Relationships

| Relationship | Type | Description |
|-------------|------|-------------|
| `users` → `providers` | One-to-one | One user account, one provider profile |
| `providers` → `appointment_slots` | One-to-many | A provider has many slots |
| `appointment_slots` → `appointments` | One-to-one | One slot can become one appointment |
| `appointments` ↔ `providers` | Many-to-many | Via `appointment_providers` join table |
| `appointments` → `visit_notes` | One-to-many | An appointment has many notes |
| `appointments` → `appointment_history` | One-to-many | An appointment has many history events |
| `appointments` → `unconfirmed_alerts` | One-to-one | One alert record per appointment |

---

## Constraints in the Database vs Application

| Constraint | Where enforced | Detail |
|-----------|---------------|--------|
| Unique email | Database (`UNIQUE`) | psycopg2 raises IntegrityError on duplicate |
| One appointment per slot | Database (`UNIQUE` on `slot_id`) | Prevents double-booking at DB level |
| One provider profile per user | Database (`UNIQUE` on `user_id`) | |
| One care team entry per provider per appointment | Database (`UNIQUE` on `(appointment_id, provider_id)`) | |
| Status transition rules | Application (state machine) | DB only stores the final value |
| Cancel reason required | Application (route handler) | DB column is nullable |
| No-show timing (after slot time) | Application (state machine) | DB has no temporal constraints |
| Role enforcement | Application (FastAPI dependency) | JWT role claim checked on every request |

---

## Deliberate Denormalization

- **`appointment_slots.provider_id`** — the scheduling provider is stored directly on the slot rather than only on the `appointment_providers` join table. This makes the common query ("what are this provider's available slots?") a simple filter with no join. The trade-off is that reassigning a provider requires updating both the slot row and the join table, which is handled in a single transaction in the reassign endpoint.

---

## What Would Break First at 100× the Data

At roughly 100× current load (say, 500 providers, 50 000 patients, 1 million appointment rows):

1. **`GET /api/appointments/` pagination** — the `SELECT COUNT(*)` over the full filtered dataset becomes expensive. Fix: use keyset pagination (cursor-based) instead of `LIMIT/OFFSET`.
2. **Dashboard aggregates** — the 8-week no-show trend runs 16 separate aggregate queries per page load. Fix: materialise into a summary table refreshed by a scheduled job.
3. **Alert re-fire logic** — on every `GET /api/alerts/`, the server loads and re-checks all requested appointments within 24 hours. Fix: move re-fire to a background task (APScheduler or a cron job) that updates `dismissed_at` in batch, rather than doing it per-request.
4. **Text search on `patient_name`** — `ILIKE '%term%'` is a full-table scan. Fix: add a `GIN` index with `pg_trgm` for trigram-based text search.
