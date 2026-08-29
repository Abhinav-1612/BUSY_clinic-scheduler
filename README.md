# Clinic Appointment Scheduling System

A full-stack clinic scheduling web application built for the Busy Infotech assignment.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI (Python) |
| ORM | SQLModel |
| Database | PostgreSQL (Supabase) |
| Frontend | React + Vite (JavaScript) |
| Auth | Custom JWT (python-jose + passlib) |
| Hosting | Render (API) + Vercel (UI) |

## Project Structure

```
├── backend/          FastAPI application
│   ├── app/
│   │   ├── models.py       SQLModel DB models
│   │   ├── database.py     DB engine + session
│   │   ├── auth.py         JWT + role guards
│   │   ├── routers/        API route handlers
│   │   └── utils/          State machine, helpers
│   ├── seed.py             Demo data seeder
│   └── requirements.txt
├── frontend/         React + Vite app
│   └── src/
├── docs/             Architecture, schema, decisions
└── SUBMISSION.md
```

## Local Development

### Backend
```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
cp .env.example .env         # Fill in your Supabase DATABASE_URL + SECRET_KEY
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env.local   # Set VITE_API_URL=http://localhost:8000
npm run dev
```

## Demo Credentials

See `SUBMISSION.md` for live URL and demo credentials.

## Docs

- [Architecture](docs/architecture.md)
- [Schema](docs/schema.md)
- [Plan](docs/plan.md)
- [Decisions](docs/decisions.md)
- [AI Prompts](docs/ai-prompts.md)
