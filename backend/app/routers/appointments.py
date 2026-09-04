from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select, func, or_, and_
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, date
import csv
import io

from app.database import get_session
from app.models import (
    Appointment, AppointmentSlot, AppointmentStatus, AppointmentHistory,
    AppointmentProvider, Provider, User, UserRole, CareTeamRole,
    HistoryEventType, UnconfirmedAlert,
)
from app.auth import get_current_user, require_front_desk
from app.utils.state_machine import validate_transition

router = APIRouter(prefix="/api/appointments", tags=["appointments"])


# ─── Schemas ──────────────────────────────────────────────────────────────────

class AppointmentCreate(BaseModel):
    slot_id: int
    patient_name: str
    patient_email: str
    patient_phone: Optional[str] = None


class StatusUpdate(BaseModel):
    status: AppointmentStatus
    cancel_reason: Optional[str] = None


class ProviderReassign(BaseModel):
    new_provider_id: int


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _appointment_to_dict(appt: Appointment, session: Session) -> dict:
    slot = session.get(AppointmentSlot, appt.slot_id)
    provider = session.get(Provider, slot.provider_id) if slot else None
    care_team = session.exec(
        select(AppointmentProvider, Provider)
        .join(Provider, AppointmentProvider.provider_id == Provider.id)
        .where(AppointmentProvider.appointment_id == appt.id)
    ).all()

    return {
        "id": appt.id,
        "slot_id": appt.slot_id,
        "patient_name": appt.patient_name,
        "patient_email": appt.patient_email,
        "patient_phone": appt.patient_phone,
        "status": appt.status,
        "cancel_reason": appt.cancel_reason,
        "created_at": appt.created_at.isoformat(),
        "updated_at": appt.updated_at.isoformat(),
        "slot": {
            "date": str(slot.slot_date) if slot else None,
            "start_time": str(slot.start_time) if slot else None,
            "duration_minutes": slot.duration_minutes if slot else None,
            "provider_id": slot.provider_id if slot else None,
            "provider_name": provider.display_name if provider else None,
        },
        "care_team": [
            {"provider_id": ap.provider_id, "provider_name": p.display_name, "role": ap.role}
            for ap, p in care_team
        ],
    }


def _log_history(
    session: Session,
    appointment_id: int,
    changed_by: int,
    event_type: HistoryEventType,
    old_value: str = None,
    new_value: str = None,
    description: str = None,
):
    history = AppointmentHistory(
        appointment_id=appointment_id,
        changed_by=changed_by,
        event_type=event_type,
        old_value=old_value,
        new_value=new_value,
        description=description,
    )
    session.add(history)


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.get("/")
def list_appointments(
    patient_name: Optional[str] = Query(None),
    provider_id: Optional[int] = Query(None),
    status: Optional[AppointmentStatus] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    sort_by: Optional[str] = Query("date", regex="^(date|status|provider)$"),
    sort_order: Optional[str] = Query("asc", regex="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Server-side filtered, sorted, paginated appointment list.
    Providers only see their own appointments (as scheduling or supporting provider).
    """
    query = (
        select(Appointment)
        .join(AppointmentSlot, Appointment.slot_id == AppointmentSlot.id)
    )

    # Provider restriction: only their appointments
    if current_user.role == UserRole.provider:
        my_provider = session.exec(
            select(Provider).where(Provider.user_id == current_user.id)
        ).first()
        if not my_provider:
            raise HTTPException(status_code=404, detail="Provider profile not found")

        # Include appointments where they are scheduling or supporting provider
        supporting_ids = session.exec(
            select(AppointmentProvider.appointment_id).where(
                AppointmentProvider.provider_id == my_provider.id
            )
        ).all()
        scheduling_ids = session.exec(
            select(Appointment.id).join(AppointmentSlot).where(
                AppointmentSlot.provider_id == my_provider.id
            )
        ).all()
        all_ids = list(set(list(supporting_ids) + list(scheduling_ids)))
        if not all_ids:
            return {"data": [], "total": 0, "page": page, "page_size": page_size}
        query = query.where(Appointment.id.in_(all_ids))

    # Filters (server-side, never client-side)
    if patient_name:
        query = query.where(Appointment.patient_name.ilike(f"%{patient_name}%"))
    if provider_id:
        query = query.where(AppointmentSlot.provider_id == provider_id)
    if status:
        query = query.where(Appointment.status == status)
    if date_from:
        query = query.where(AppointmentSlot.slot_date >= date_from)
    if date_to:
        query = query.where(AppointmentSlot.slot_date <= date_to)

    # Count total (before pagination)
    count_query = select(func.count()).select_from(query.subquery())
    total = session.exec(count_query).one()

    # Sorting
    if sort_by == "date":
        order_col = AppointmentSlot.slot_date
    elif sort_by == "status":
        order_col = Appointment.status
    else:  # provider
        order_col = AppointmentSlot.provider_id

    if sort_order == "desc":
        query = query.order_by(order_col.desc(), AppointmentSlot.start_time)
    else:
        query = query.order_by(order_col.asc(), AppointmentSlot.start_time)

    # Pagination
    offset = (page - 1) * page_size
    appointments = session.exec(query.offset(offset).limit(page_size)).all()

    return {
        "data": [_appointment_to_dict(a, session) for a in appointments],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
    }


@router.post("/", status_code=201)
def create_appointment(
    body: AppointmentCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Patient requests a slot — creates appointment in 'requested' status."""
    slot = session.get(AppointmentSlot, body.slot_id)
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    if slot.is_archived:
        raise HTTPException(status_code=409, detail="Cannot book an archived slot")
    if slot.appointment:
        raise HTTPException(status_code=409, detail="This slot is already booked")

    appointment = Appointment(
        slot_id=body.slot_id,
        patient_name=body.patient_name,
        patient_email=body.patient_email,
        patient_phone=body.patient_phone,
        status=AppointmentStatus.requested,
    )
    session.add(appointment)
    session.flush()  # get appointment.id

    # Add scheduling provider to care team
    care_entry = AppointmentProvider(
        appointment_id=appointment.id,
        provider_id=slot.provider_id,
        role=CareTeamRole.scheduling,
        assigned_by=current_user.id,
    )
    session.add(care_entry)

    # Log history
    _log_history(
        session, appointment.id, current_user.id,
        HistoryEventType.status_change,
        old_value=None,
        new_value=AppointmentStatus.requested.value,
        description=f"Appointment requested by {current_user.full_name}",
    )

    # Create unconfirmed alert trigger record
    alert = UnconfirmedAlert(appointment_id=appointment.id)
    session.add(alert)

    session.commit()
    session.refresh(appointment)
    return _appointment_to_dict(appointment, session)


@router.get("/{appointment_id}")
def get_appointment(
    appointment_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    appointment = session.get(Appointment, appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    _assert_can_view(appointment, current_user, session)
    return _appointment_to_dict(appointment, session)


@router.patch("/{appointment_id}/status")
def update_status(
    appointment_id: int,
    body: StatusUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Update appointment status through the state machine.
    All transition rules enforced server-side.
    """
    appointment = session.get(Appointment, appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    _assert_can_view(appointment, current_user, session)

    slot = session.get(AppointmentSlot, appointment.slot_id)

    is_valid, error_msg = validate_transition(
        from_status=appointment.status,
        to_status=body.status,
        slot_date=slot.slot_date,
        slot_time=slot.start_time,
        cancel_reason=body.cancel_reason,
    )
    if not is_valid:
        raise HTTPException(status_code=422, detail=error_msg)

    # Front desk reassignment check: providers cannot change scheduling assignments
    if body.status == AppointmentStatus.confirmed and current_user.role == UserRole.provider:
        my_provider = session.exec(
            select(Provider).where(Provider.user_id == current_user.id)
        ).first()
        scheduling_entry = session.exec(
            select(AppointmentProvider).where(
                AppointmentProvider.appointment_id == appointment_id,
                AppointmentProvider.role == CareTeamRole.scheduling,
            )
        ).first()
        if not my_provider or not scheduling_entry or scheduling_entry.provider_id != my_provider.id:
            raise HTTPException(status_code=403, detail="Only the scheduling provider can confirm this appointment")

    old_status = appointment.status.value
    appointment.status = body.status
    if body.cancel_reason:
        appointment.cancel_reason = body.cancel_reason
    appointment.updated_at = datetime.utcnow()

    # Determine event type and description
    event_type = HistoryEventType.status_change
    description = None
    if body.status == AppointmentStatus.cancelled:
        event_type = HistoryEventType.cancellation
        description = f"Cancelled by {current_user.full_name}. Reason: {body.cancel_reason}"

    _log_history(
        session, appointment.id, current_user.id,
        event_type,
        old_value=old_status,
        new_value=body.status.value,
        description=description,
    )

    session.add(appointment)
    session.commit()
    session.refresh(appointment)
    return _appointment_to_dict(appointment, session)


@router.patch("/{appointment_id}/reassign")
def reassign_appointment(
    appointment_id: int,
    body: ProviderReassign,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_front_desk),
):
    """Front desk only: reassign scheduling provider."""
    appointment = session.get(Appointment, appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    new_provider = session.get(Provider, body.new_provider_id)
    if not new_provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    # Update slot's provider
    slot = session.get(AppointmentSlot, appointment.slot_id)
    old_provider_id = slot.provider_id
    slot.provider_id = body.new_provider_id

    # Update care team scheduling entry
    old_entry = session.exec(
        select(AppointmentProvider).where(
            AppointmentProvider.appointment_id == appointment_id,
            AppointmentProvider.role == CareTeamRole.scheduling,
        )
    ).first()
    if old_entry:
        session.delete(old_entry)

    new_entry = AppointmentProvider(
        appointment_id=appointment_id,
        provider_id=body.new_provider_id,
        role=CareTeamRole.scheduling,
        assigned_by=current_user.id,
    )
    session.add(new_entry)

    _log_history(
        session, appointment_id, current_user.id,
        HistoryEventType.supporting_provider_added,
        old_value=str(old_provider_id),
        new_value=str(body.new_provider_id),
        description=f"Reassigned to {new_provider.display_name} by {current_user.full_name}",
    )

    session.add(slot)
    session.commit()
    session.refresh(appointment)
    return _appointment_to_dict(appointment, session)


@router.get("/{appointment_id}/history")
def get_appointment_history(
    appointment_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Immutable timeline — every event in order."""
    appointment = session.get(Appointment, appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    _assert_can_view(appointment, current_user, session)

    history = session.exec(
        select(AppointmentHistory)
        .where(AppointmentHistory.appointment_id == appointment_id)
        .order_by(AppointmentHistory.created_at.asc())
    ).all()

    result = []
    for h in history:
        actor = session.get(User, h.changed_by)
        result.append({
            "id": h.id,
            "event_type": h.event_type,
            "old_value": h.old_value,
            "new_value": h.new_value,
            "description": h.description,
            "changed_by": actor.full_name if actor else "Unknown",
            "changed_by_role": actor.role if actor else None,
            "created_at": h.created_at.isoformat(),
        })
    return result


@router.get("/export/day-csv")
def export_day_csv(
    provider_id: Optional[int] = None,
    export_date: date = Query(...),
    token: Optional[str] = Query(None),
    session: Session = Depends(get_session),
):
    from app.auth import decode_token
    if not token:
        raise HTTPException(status_code=401, detail="Missing token in query parameter")
    try:
        payload = decode_token(token)
        if payload.get("role") != UserRole.front_desk.value:
            raise HTTPException(status_code=403, detail="Front desk only")
    except Exception as e:
        raise HTTPException(status_code=401, detail="Unauthorized")
    """Export a single day's schedule as a CSV file."""
    query = (
        select(AppointmentSlot, Provider, Appointment)
        .join(Provider, AppointmentSlot.provider_id == Provider.id)
        .join(Appointment, Appointment.slot_id == AppointmentSlot.id, isouter=True)
        .where(AppointmentSlot.slot_date == export_date)
        .order_by(AppointmentSlot.start_time)
    )
    if provider_id:
        query = query.where(AppointmentSlot.provider_id == provider_id)

    rows = session.exec(query).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Time", "Duration (min)", "Provider", "Patient Name",
        "Patient Email", "Patient Phone", "Status", "Cancel Reason"
    ])
    for slot, prov, appt in rows:
        writer.writerow([
            str(slot.start_time),
            slot.duration_minutes,
            prov.display_name,
            appt.patient_name if appt else "",
            appt.patient_email if appt else "",
            appt.patient_phone if appt else "",
            appt.status.value if appt else "Available",
            appt.cancel_reason if appt else "",
        ])

    output.seek(0)
    filename = f"schedule_{export_date}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ─── Care Team ────────────────────────────────────────────────────────────────

@router.post("/{appointment_id}/care-team/{provider_id}")
def add_supporting_provider(
    appointment_id: int,
    provider_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Add a supporting provider to the care team."""
    appointment = session.get(Appointment, appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    provider = session.get(Provider, provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    # Check not already in care team
    existing = session.exec(
        select(AppointmentProvider).where(
            AppointmentProvider.appointment_id == appointment_id,
            AppointmentProvider.provider_id == provider_id,
        )
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Provider is already in the care team")

    entry = AppointmentProvider(
        appointment_id=appointment_id,
        provider_id=provider_id,
        role=CareTeamRole.supporting,
        assigned_by=current_user.id,
    )
    session.add(entry)

    _log_history(
        session, appointment_id, current_user.id,
        HistoryEventType.supporting_provider_added,
        new_value=str(provider_id),
        description=f"{provider.display_name} added to care team by {current_user.full_name}",
    )

    session.commit()
    return {"message": f"{provider.display_name} added as supporting provider"}


@router.delete("/{appointment_id}/care-team/{provider_id}")
def remove_supporting_provider(
    appointment_id: int,
    provider_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Remove a supporting provider from the care team."""
    entry = session.exec(
        select(AppointmentProvider).where(
            AppointmentProvider.appointment_id == appointment_id,
            AppointmentProvider.provider_id == provider_id,
            AppointmentProvider.role == CareTeamRole.supporting,
        )
    ).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Supporting provider not found in care team")

    provider = session.get(Provider, provider_id)
    session.delete(entry)

    _log_history(
        session, appointment_id, current_user.id,
        HistoryEventType.supporting_provider_removed,
        old_value=str(provider_id),
        description=f"{provider.display_name if provider else provider_id} removed from care team",
    )

    session.commit()
    return {"message": "Supporting provider removed"}


# ─── Private Helper ───────────────────────────────────────────────────────────

def _assert_can_view(appointment: Appointment, current_user: User, session: Session):
    """Providers can only view their own appointments."""
    if current_user.role == UserRole.provider:
        my_provider = session.exec(
            select(Provider).where(Provider.user_id == current_user.id)
        ).first()
        if not my_provider:
            raise HTTPException(status_code=403, detail="Provider profile not found")

        in_care_team = session.exec(
            select(AppointmentProvider).where(
                AppointmentProvider.appointment_id == appointment.id,
                AppointmentProvider.provider_id == my_provider.id,
            )
        ).first()

        slot = session.get(AppointmentSlot, appointment.slot_id)
        is_scheduling = slot and slot.provider_id == my_provider.id

        if not in_care_team and not is_scheduling:
            raise HTTPException(
                status_code=403,
                detail="You can only view appointments you are assigned to",
            )
