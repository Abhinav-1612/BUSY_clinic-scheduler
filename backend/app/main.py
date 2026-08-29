from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv

from app.database import create_db_and_tables
from app.routers import auth, appointments, slots, notes, bulk, dashboard, alerts, providers

load_dotenv()

app = FastAPI(
    title="Clinic Appointment Scheduling API",
    description="Backend API for the clinic scheduling system — manages providers, slots, appointments, visit notes, and alerts.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
# In production, restrict to your Vercel frontend URL via ALLOWED_ORIGINS env var
allowed_origins_str = os.getenv("ALLOWED_ORIGINS", "*")
allowed_origins = [o.strip() for o in allowed_origins_str.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Startup ───────────────────────────────────────────────────────────────────
@app.on_event("startup")
def on_startup():
    create_db_and_tables()


# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(appointments.router)
app.include_router(slots.router)
app.include_router(notes.router)
app.include_router(bulk.router)
app.include_router(dashboard.router)
app.include_router(alerts.router)
app.include_router(providers.router)


# ── Health Check ──────────────────────────────────────────────────────────────
@app.get("/health")
def health_check():
    return {"status": "ok", "service": "clinic-scheduler-api"}
