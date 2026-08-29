from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from datetime import datetime, timedelta

from app.database import get_session
from app.models import (
    UnconfirmedAlert, Appointment, AppointmentSlot, AppointmentStatus, User
)
from app.auth import get_current_user, require_front_desk

router = APIRouter(prefix="/api/alerts", tags=["alerts"])


def _refire_check(alert: UnconfirmedAlert, slot: AppointmentSlot) -> UnconfirmedAlert:
    """
    Core re-fire logic (Goal 10):
    If an alert was dismissed but the appointment is now within 1 hour of its
    scheduled time AND still unconfirmed, reset the dismissal so it reappears.
    """
    if alert.dismissed_at is None:
        return alert  # Already active, no action needed

    slot_datetime = datetime.combine(slot.slot_date, slot.start_time)
    time_until = slot_datetime - datetime.utcnow()

    # Re-fire condition: within 1 hour of scheduled time
    if time_until <= timedelta(hours=1) and time_until > timedelta(0):
        alert.dismissed_at = None
        alert.dismissed_by = None

    return alert


def _alert_to_dict(alert: UnconfirmedAlert, session: Session) -> dict:
    appt = session.get(Appointment, alert.appointment_id)
    slot = session.get(AppointmentSlot, appt.slot_id) if appt else None
    from app.models import Provider
    provider = session.get(Provider, slot.provider_id) if slot else None

    return {
        "id": alert.id,
        "appointment_id": alert.appointment_id,
        "patient_name": appt.patient_name if appt else None,
        "provider_name": provider.display_name if provider else None,
        "slot_date": str(slot.slot_date) if slot else None,
        "slot_time": str(slot.start_time) if slot else None,
        "dismissed_at": alert.dismissed_at.isoformat() if alert.dismissed_at else None,
        "is_dismissed": alert.dismissed_at is not None,
    }


@router.get("/")
def get_alerts(
    session: Session = Depends(get_session),
    current_user: User = Depends(require_front_desk),
):
    """
    Returns all unconfirmed alerts.
    Also applies re-fire logic: dismissed alerts that are now within 1 hour
    of their appointment time are automatically un-dismissed.
    Returns count badge separately.
    """
    # Find all appointments in 'requested' status within next 24 hours
    now = datetime.utcnow()
    window_end = now + timedelta(hours=24)

    # Get all requested appointments within 24h window
    requested_appts = session.exec(
        select(Appointment, AppointmentSlot)
        .join(AppointmentSlot, Appointment.slot_id == AppointmentSlot.id)
        .where(Appointment.status == AppointmentStatus.requested)
    ).all()

    alerts_to_show = []
    for appt, slot in requested_appts:
        slot_dt = datetime.combine(slot.slot_date, slot.start_time)
        if slot_dt > now and slot_dt <= window_end:
            # Get or create alert record
            alert = session.exec(
                select(UnconfirmedAlert).where(
                    UnconfirmedAlert.appointment_id == appt.id
                )
            ).first()

            if not alert:
                alert = UnconfirmedAlert(appointment_id=appt.id)
                session.add(alert)
                session.flush()

            # Apply re-fire check and save if changed
            updated = _refire_check(alert, slot)
            session.add(updated)
            alerts_to_show.append((updated, appt, slot))

    session.commit()

    result = []
    for alert, appt, slot in alerts_to_show:
        from app.models import Provider
        provider = session.get(Provider, slot.provider_id)
        result.append({
            "id": alert.id,
            "appointment_id": alert.appointment_id,
            "patient_name": appt.patient_name,
            "provider_name": provider.display_name if provider else None,
            "slot_date": str(slot.slot_date),
            "slot_time": str(slot.start_time),
            "dismissed_at": alert.dismissed_at.isoformat() if alert.dismissed_at else None,
            "is_dismissed": alert.dismissed_at is not None,
        })

    active_count = sum(1 for a in result if not a["is_dismissed"])

    return {
        "alerts": result,
        "active_count": active_count,
        "total_count": len(result),
    }


@router.patch("/{alert_id}/dismiss")
def dismiss_alert(
    alert_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_front_desk),
):
    """Front desk dismisses an alert. May reappear if within 1 hour at next fetch."""
    alert = session.get(UnconfirmedAlert, alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.dismissed_at = datetime.utcnow()
    alert.dismissed_by = current_user.id
    session.add(alert)
    session.commit()

    return {"message": "Alert dismissed", "alert_id": alert_id}
