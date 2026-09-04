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

    # ── 1. Headline Numbers & Trends ─────────────────────────────────────────

    yesterday = today - timedelta(days=1)
    last_week_start = week_start - timedelta(days=7)
    last_week_end = week_end - timedelta(days=7)

    def calc_trend(curr: int, prev: int) -> int:
        if prev == 0:
            return 100 if curr > 0 else 0
        return round(((curr - prev) / prev) * 100)

    # Appointments today (and yesterday)
    appointments_today = session.exec(
        select(func.count(Appointment.id))
        .join(AppointmentSlot, Appointment.slot_id == AppointmentSlot.id)
        .where(AppointmentSlot.slot_date == today)
    ).one()
    
    appointments_yesterday = session.exec(
        select(func.count(Appointment.id))
        .join(AppointmentSlot, Appointment.slot_id == AppointmentSlot.id)
        .where(AppointmentSlot.slot_date == yesterday)
    ).one()
    appointments_trend = calc_trend(appointments_today, appointments_yesterday)

    # Patients checked in right now
    checked_in_now = session.exec(
        select(func.count(Appointment.id))
        .join(AppointmentSlot, Appointment.slot_id == AppointmentSlot.id)
        .where(
            AppointmentSlot.slot_date == today,
            Appointment.status == AppointmentStatus.checked_in,
        )
    ).one()
    
    checked_in_yesterday = session.exec(
        select(func.count(Appointment.id))
        .join(AppointmentSlot, Appointment.slot_id == AppointmentSlot.id)
        .where(
            AppointmentSlot.slot_date == yesterday,
            Appointment.status == AppointmentStatus.checked_in,
        )
    ).one()
    checked_in_trend = calc_trend(checked_in_now, checked_in_yesterday)

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
    
    no_shows_last_week = session.exec(
        select(func.count(Appointment.id))
        .join(AppointmentSlot, Appointment.slot_id == AppointmentSlot.id)
        .where(
            AppointmentSlot.slot_date >= last_week_start,
            AppointmentSlot.slot_date <= last_week_end,
            Appointment.status == AppointmentStatus.no_show,
        )
    ).one()
    no_shows_trend = calc_trend(no_shows_this_week, no_shows_last_week)

    # Confirmed upcoming (from today onwards)
    confirmed_upcoming = session.exec(
        select(func.count(Appointment.id))
        .join(AppointmentSlot, Appointment.slot_id == AppointmentSlot.id)
        .where(
            AppointmentSlot.slot_date >= today,
            Appointment.status == AppointmentStatus.confirmed,
        )
    ).one()
    
    confirmed_upcoming_yesterday = session.exec(
        select(func.count(Appointment.id))
        .join(AppointmentSlot, Appointment.slot_id == AppointmentSlot.id)
        .where(
            AppointmentSlot.slot_date >= yesterday,
            Appointment.status == AppointmentStatus.confirmed,
        )
    ).one()
    confirmed_trend = calc_trend(confirmed_upcoming, confirmed_upcoming_yesterday)

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

    # Calculate total appointments trend (this week vs last week)
    total_this_week = session.exec(
        select(func.count(Appointment.id))
        .join(AppointmentSlot, Appointment.slot_id == AppointmentSlot.id)
        .where(
            AppointmentSlot.slot_date >= week_start,
            AppointmentSlot.slot_date <= week_end
        )
    ).one()

    total_last_week = session.exec(
        select(func.count(Appointment.id))
        .join(AppointmentSlot, Appointment.slot_id == AppointmentSlot.id)
        .where(
            AppointmentSlot.slot_date >= last_week_start,
            AppointmentSlot.slot_date <= last_week_end
        )
    ).one()
    
    total_trend = calc_trend(total_this_week, total_last_week)

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

    # ── 5. Next Appointment ──────────────────────────────────────────────────
    
    from sqlmodel import or_, and_
    
    now_time = datetime.now().time()
    next_appt_record = session.exec(
        select(AppointmentSlot, Provider, Appointment)
        .join(Provider, AppointmentSlot.provider_id == Provider.id)
        .join(Appointment, Appointment.slot_id == AppointmentSlot.id)
        .where(
            or_(
                and_(AppointmentSlot.slot_date == today, AppointmentSlot.start_time >= now_time),
                AppointmentSlot.slot_date > today
            ),
            Appointment.status.in_([AppointmentStatus.confirmed, AppointmentStatus.requested])
        )
        .order_by(AppointmentSlot.slot_date, AppointmentSlot.start_time)
        .limit(1)
    ).first()

    next_appt = None
    if next_appt_record:
        slot, prov, appt = next_appt_record
        next_appt = {
            "id": appt.id,
            "time": slot.start_time.strftime("%I:%M %p").lstrip('0'),
            "date": str(slot.slot_date),
            "patient_name": appt.patient_name,
            "provider": f"{prov.display_name} ({prov.specialty})"
        }

    return {
        "headline": {
            "appointments_today": {
                "value": appointments_today,
                "trend": appointments_trend,
                "trend_text": "vs. yesterday"
            },
            "checked_in_now": {
                "value": checked_in_now,
                "trend": checked_in_trend,
                "trend_text": "vs. yesterday"
            },
            "no_shows_this_week": {
                "value": no_shows_this_week,
                "trend": no_shows_trend,
                "trend_text": "vs. last week"
            },
            "confirmed_upcoming": {
                "value": confirmed_upcoming,
                "trend": confirmed_trend,
                "trend_text": "vs. yesterday"
            },
        },
        "by_status": status_data,
        "by_provider": provider_data_all,
        "by_provider_today": provider_data_today,
        "total_appointments_trend": total_trend,
        "no_show_trend": weekly_data,
        "next_appointment": next_appt,
    }
