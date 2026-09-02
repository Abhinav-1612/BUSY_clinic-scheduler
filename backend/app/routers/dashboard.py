from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, func, case
from datetime import datetime, timedelta, date

from app.database import get_session
from app.models import (
    Appointment, AppointmentSlot, AppointmentStatus,
    Provider, User, AppointmentProvider
)
from app.auth import require_front_desk

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/")
def get_dashboard(
    session: Session = Depends(get_session),
    current_user: User = Depends(require_front_desk),
):
    """
    Returns all dashboard data in a single call:
    - Headline numbers
    - Breakdown by provider
    - Breakdown by status
    - No-show rate per week over last 8 weeks
    """
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    week_end = week_start + timedelta(days=6)

    # ── 1. Headline Numbers ──────────────────────────────────────────────────

    # Appointments today (any status)
    appointments_today = session.exec(
        select(func.count(Appointment.id))
        .join(AppointmentSlot, Appointment.slot_id == AppointmentSlot.id)
        .where(AppointmentSlot.slot_date == today)
    ).one()

    # Patients checked in right now
    checked_in_now = session.exec(
        select(func.count(Appointment.id))
        .join(AppointmentSlot, Appointment.slot_id == AppointmentSlot.id)
        .where(
            AppointmentSlot.slot_date == today,
            Appointment.status == AppointmentStatus.checked_in,
        )
    ).one()

    # No-shows this week
    no_shows_this_week = session.exec(
        select(func.count(Appointment.id))
        .join(AppointmentSlot, Appointment.slot_id == AppointmentSlot.id)
        .where(
            AppointmentSlot.slot_date >= week_start,
            AppointmentSlot.slot_date <= week_end,
            Appointment.status == AppointmentStatus.no_show,
        )
    ).one()

    # Confirmed upcoming (from today onwards)
    confirmed_upcoming = session.exec(
        select(func.count(Appointment.id))
        .join(AppointmentSlot, Appointment.slot_id == AppointmentSlot.id)
        .where(
            AppointmentSlot.slot_date >= today,
            Appointment.status == AppointmentStatus.confirmed,
        )
    ).one()

    # ── 2. Breakdown by Status ───────────────────────────────────────────────

    status_breakdown = session.exec(
        select(Appointment.status, func.count(Appointment.id))
        .group_by(Appointment.status)
    ).all()

    status_data = [
        {"status": status.value, "count": count}
        for status, count in status_breakdown
    ]

    # ── 3. Breakdown by Provider (All Time & Today) ──────────────────────────

    provider_breakdown_all = session.exec(
        select(Provider.id, Provider.display_name, func.count(Appointment.id))
        .join(AppointmentSlot, AppointmentSlot.provider_id == Provider.id)
        .join(Appointment, Appointment.slot_id == AppointmentSlot.id)
        .group_by(Provider.id, Provider.display_name)
    ).all()

    provider_data_all = [
        {"provider_id": pid, "provider": name, "count": count}
        for pid, name, count in provider_breakdown_all
    ]

    provider_breakdown_today = session.exec(
        select(Provider.id, Provider.display_name, func.count(Appointment.id))
        .join(AppointmentSlot, AppointmentSlot.provider_id == Provider.id)
        .join(Appointment, Appointment.slot_id == AppointmentSlot.id)
        .where(AppointmentSlot.slot_date == today)
        .group_by(Provider.id, Provider.display_name)
    ).all()

    provider_data_today = [
        {"provider_id": pid, "provider": name, "count": count}
        for pid, name, count in provider_breakdown_today
    ]

    # ── 4. No-Show Rate Per Week (last 8 weeks) ───────────────────────────────

    eight_weeks_ago = today - timedelta(weeks=8)
    weekly_data = []

    for i in range(8):
        w_start = eight_weeks_ago + timedelta(weeks=i)
        w_end = w_start + timedelta(days=6)

        total = session.exec(
            select(func.count(Appointment.id))
            .join(AppointmentSlot, Appointment.slot_id == AppointmentSlot.id)
            .where(
                AppointmentSlot.slot_date >= w_start,
                AppointmentSlot.slot_date <= w_end,
                Appointment.status.in_([
                    AppointmentStatus.completed,
                    AppointmentStatus.no_show,
                    AppointmentStatus.cancelled,
                ])
            )
        ).one()

        no_shows = session.exec(
            select(func.count(Appointment.id))
            .join(AppointmentSlot, Appointment.slot_id == AppointmentSlot.id)
            .where(
                AppointmentSlot.slot_date >= w_start,
                AppointmentSlot.slot_date <= w_end,
                Appointment.status == AppointmentStatus.no_show,
            )
        ).one()

        rate = round((no_shows / total * 100), 1) if total > 0 else 0.0

        weekly_data.append({
            "week_label": f"W{i + 1} ({w_start.strftime('%b %d')})",
            "week_start": str(w_start),
            "week_end": str(w_end),
            "total_appointments": total,
            "no_shows": no_shows,
            "no_show_rate": rate,
        })

    return {
        "headline": {
            "appointments_today": appointments_today,
            "checked_in_now": checked_in_now,
            "no_shows_this_week": no_shows_this_week,
            "confirmed_upcoming": confirmed_upcoming,
        },
        "by_status": status_data,
        "by_provider": provider_data_all,
        "by_provider_today": provider_data_today,
        "no_show_trend": weekly_data,
    }
