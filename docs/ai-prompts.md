# AI Prompts Used

I built the core structure of this application manually — setting up the FastAPI routes, the SQLModel database schema, the JWT authentication flow, and the baseline React/Vite frontend components. 

I strategically used the Antigravity IDE (Gemini/Claude models) to assist with complex database aggregations, algorithm design (like the bulk generator), and debugging edge cases. Below are the key prompts and interactions.

## 1. Complex Dashboard Aggregations
**Prompt:**
> "I've set up the basic SQLModel tables for Appointments and Slots. Now I need help writing the complex SQLAlchemy query for the Dashboard. I need to calculate total appointments for today vs yesterday (to show a trend), current check-ins, and a no-show rate grouped by week over the last 8 weeks. Please write the SQLModel query for this."
**Result:** 
The AI generated the `func.count` queries and the date-math logic using `timedelta` in `dashboard.py`. I reviewed and adjusted the queries to match my specific schema.

## 2. Bulk Availability Generator Logic
**Prompt:**
> "I have the basic Slots page working, but I need a Bulk Availability Generator. Write the backend FastAPI logic that takes a provider, date range, and weekly pattern (e.g., Mon/Wed at 9:00 AM), iterates through the dates, and creates slots. It MUST skip any slot that conflicts with an existing booking and return a summary report of what was created vs skipped."
**Result:** 
The AI provided a clean loop implementation using Python's `timedelta`. I integrated this into my `bulk.py` router.

## 3. Fixing Issues (Iterative Debugging - Bad Output)
**Prompt (Issue):** 
> "ok the csv downlaod button now working but on selecting specific date and when clicked on downlaod it not downlaoding full data when it sownlaods it only consist one person data fix it"
**Fix:** 
The AI initially wrote the CSV export query using an `inner join` between `AppointmentSlot` and `Appointment`, which completely filtered out any unbooked slots from the daily schedule. 

**Follow-up Prompt:** 
> "1--then plx recheck why it not downlaoding the full available sots data on specific date but on chossing specific date it downlaoding only specific data few rows only"
**Result:** 
The AI fixed it by switching to a `left outer join` (`.join(Appointment, Appointment.slot_id == AppointmentSlot.id, isouter=True)`), ensuring the whole day's schedule exported properly.

## 4. UI/UX and React Query Tweaks
**Prompt:**
> "in dasboard page on top right corner it not properly showing next appointment details when i just updated todays appointment but it not showing that name plz check the issue and fix it it should display latest upcoming appointment"
**Result:** 
The AI identified that React Query was serving stale cache data. It fixed the cache invalidation across the app so the dashboard updates instantly when an appointment status changes.

**Prompt (Refining bad output):**
> "ok but the issue 1 that u solved i want the previous approach only means it should show the appointments which are sceduled after current time on todays date if no appointment todays then it should tell next wahtever day with date also"
**Result:** 
The AI had originally removed the time filter entirely. Based on this prompt, it adjusted the SQL query to strictly check `start_time >= now_time` for today's date, and added the explicit date string to the frontend UI if it falls back to a future day.

## 5. Deployment Troubleshooting
**Prompt:**
> "while deployinh on render some error occurs The crash is caused by an incompatible C-extension in psycopg2: ImportError: .../psycopg2/_psycopg.cpython-314-x86_64-linux-gnu.so: undefined symbol: _PyInterpreterState_Get"
**Fix:** 
The AI recognized that Render was defaulting to a bleeding-edge Python 3.14 image which broke the `psycopg2-binary` wheel. It fixed this by generating a `render.yaml` file that explicitly pinned `PYTHON_VERSION: 3.12.3`.

**Prompt:**
> "ok my app deployed  also when i clicked it it showing my login page like this means the background image is not blurred why rest is ok"
**Fix:** 
Vercel's CSS minifier broke the `rgba(var(--bg-base-rgb), 0.6)` syntax on the `backdrop-filter` which worked fine locally. I used the AI to figure out why, and it suggested rewriting the CSS to use explicit hex/rgba values to bypass the minification bug.

## 6. UI/UX Global Restyling
**Prompt:**
> "can u make every page look beautifull with logos and colors , styled text liek dashboard page we did"
**Result:** 
I had built the basic functional layouts for all the secondary pages (Appointments, Slots, Bulk, Alerts) manually, but I used the AI to help me quickly generate a unified, premium CSS overlay. The AI helped implement CSS keyframe animations (fade-ins), soft-shadow lifted cards, and gradient text classes in `index.css` to elevate the aesthetics.
