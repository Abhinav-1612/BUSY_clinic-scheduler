from fastapi import APIRouter, Depends
from sqlmodel import Session, select, func
from datetime import date, datetime, time, timedelta

from app.database import get_session
from app.models import Provider, User, AppointmentSlot, Appointment, AppointmentStatus
from app.auth import get_current_user, require_front_desk

router = APIRouter(prefix="/api/providers", tags=["providers"])


@router.get("/")
def list_providers(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """List all active providers (used in dropdowns, care team, etc.)"""
    providers = session.exec(
        select(Provider, User)
        .join(User, Provider.user_id == User.id)
        .where(Provider.is_active == True)
        .order_by(Provider.display_name)
    ).all()

    return [
        {
            "id": p.id,
            "user_id": p.user_id,
            "display_name": p.display_name,
            "specialty": p.specialty,
            "email": u.email,
        }
        for p, u in providers
    ]


@router.get("/{provider_id}/detail")
def get_provider_detail(
    provider_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_front_desk),
):
    """Get rich detail about a provider including today's schedule and free slots."""
    row = session.exec(
        select(Provider, User)
        .join(User, Provider.user_id == User.id)
        .where(Provider.id == provider_id)
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Provider not found")

    p, u = row
    today = date.today()
    now_time = datetime.now().time()

    # Find the "active" day: today if it has slots, otherwise next day that does
    display_date = today
    for offset in range(0, 8):  # look up to 7 days ahead
        candidate = today + timedelta(days=offset)
        count = session.exec(
            select(func.count(AppointmentSlot.id)).where(
                AppointmentSlot.provider_id == provider_id,
                AppointmentSlot.slot_date == candidate,
                AppointmentSlot.is_archived == False,
            )
        ).one()
        if count > 0:
            display_date = candidate
            break

    is_today = (display_date == today)
    effective_now = now_time if is_today else time(0, 0)

    # All slots for the display_date — join with Appointment (outer) to know if booked
    today_slot_rows = session.exec(
        select(AppointmentSlot, Appointment)
        .join(Appointment, Appointment.slot_id == AppointmentSlot.id, isouter=True)
        .where(
            AppointmentSlot.provider_id == provider_id,
            AppointmentSlot.slot_date == display_date,
            AppointmentSlot.is_archived == False,
        )
        .order_by(AppointmentSlot.start_time)
    ).all()

    total_slots = len(today_slot_rows)
    booked_slots = [(s, a) for s, a in today_slot_rows if a is not None]
    free_slots_ahead = [
        (s, a) for s, a in today_slot_rows
        if a is None and s.start_time >= effective_now
    ]

    today_appointments = []
    for slot, appt in booked_slots:
        if appt:
            today_appointments.append({
                "appointment_id": appt.id,
                "patient_name": appt.patient_name,
                "patient_email": appt.patient_email,
                "patient_phone": appt.patient_phone,
                "status": appt.status.value,
                "start_time": str(slot.start_time),
                "duration_minutes": slot.duration_minutes,
            })

    today_schedule = []
    for slot, appt in today_slot_rows:
        today_schedule.append({
            "start_time": str(slot.start_time),
            "duration_minutes": slot.duration_minutes,
            "is_booked": appt is not None,
            "is_future": slot.start_time >= effective_now,
        })

    # Upcoming 7 days count
    next_week = today + timedelta(days=7)
    upcoming_count = session.exec(
        select(func.count(Appointment.id))
        .join(AppointmentSlot, Appointment.slot_id == AppointmentSlot.id)
        .where(
            AppointmentSlot.provider_id == provider_id,
            AppointmentSlot.slot_date > today,
            AppointmentSlot.slot_date <= next_week,
            Appointment.status != AppointmentStatus.cancelled,
        )
    ).one()

    return {
        "id": p.id,
        "display_name": p.display_name,
        "specialty": p.specialty,
        "email": u.email,
        "is_active": p.is_active,
        "schedule_date": str(display_date),
        "is_weekend_fallback": not is_today,
        "today_total_slots": total_slots,
        "today_free_slots": len(free_slots_ahead),
        "today_booked_slots": len(booked_slots),
        "today_schedule": today_schedule,
        "today_appointments": today_appointments,
        "upcoming_7day_count": upcoming_count,
    }


@router.get("/me")
def get_my_provider_profile(
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get the provider profile for the logged-in user (if they are a provider)."""
    provider = session.exec(
        select(Provider).where(Provider.user_id == current_user.id)
    ).first()
    if not provider:
        return {"provider": None}

    return {
        "id": provider.id,
        "user_id": provider.user_id,
        "display_name": provider.display_name,
        "specialty": provider.specialty,
    }

