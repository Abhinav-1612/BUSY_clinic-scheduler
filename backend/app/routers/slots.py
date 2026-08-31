from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import Optional
from datetime import date, time

from app.database import get_session
from app.models import (
    AppointmentSlot, Provider, User, UserRole,
    Appointment, AppointmentStatus
)
from app.auth import get_current_user, require_front_desk

router = APIRouter(prefix="/api/slots", tags=["slots"])


# ─── Schemas ──────────────────────────────────────────────────────────────────

class SlotCreate(BaseModel):
    provider_id: int
    slot_date: date
    start_time: time
    duration_minutes: int = 30


class SlotUpdate(BaseModel):
    slot_date: Optional[date] = None
    start_time: Optional[time] = None
    duration_minutes: Optional[int] = None


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _slot_to_dict(slot: AppointmentSlot) -> dict:
    return {
        "id": slot.id,
        "provider_id": slot.provider_id,
        "slot_date": str(slot.slot_date),
        "start_time": str(slot.start_time),
        "duration_minutes": slot.duration_minutes,
        "is_archived": slot.is_archived,
        "created_by": slot.created_by,
        "created_at": slot.created_at.isoformat(),
        "is_booked": slot.appointment is not None,
    }


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.get("/")
def list_slots(
    provider_id: Optional[int] = None,
    slot_date: Optional[date] = None,
    include_archived: bool = False,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """List slots. Providers only see their own slots."""
    query = select(AppointmentSlot)

    # Providers only see their own slots
    if current_user.role == UserRole.provider:
        provider = session.exec(
            select(Provider).where(Provider.user_id == current_user.id)
        ).first()
        if not provider:
            raise HTTPException(status_code=404, detail="Provider profile not found")
        query = query.where(AppointmentSlot.provider_id == provider.id)
    elif provider_id:
        query = query.where(AppointmentSlot.provider_id == provider_id)

    if slot_date:
        query = query.where(AppointmentSlot.slot_date == slot_date)

    if not include_archived:
        query = query.where(AppointmentSlot.is_archived == False)

    # Prevent massive payloads on initial load (2,700+ slots)
    if not slot_date:
        query = query.limit(100)

    slots = session.exec(query.order_by(AppointmentSlot.slot_date, AppointmentSlot.start_time)).all()
    return [_slot_to_dict(s) for s in slots]


@router.post("/", status_code=201)
def create_slot(
    body: SlotCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """
    Front desk can create slots for any provider.
    Providers can only create slots for themselves.
    """
    # Verify provider exists
    provider = session.get(Provider, body.provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    # Server-enforced: providers cannot create slots for other providers
    if current_user.role == UserRole.provider:
        my_provider = session.exec(
            select(Provider).where(Provider.user_id == current_user.id)
        ).first()
        if not my_provider or my_provider.id != body.provider_id:
            raise HTTPException(
                status_code=403,
                detail="Providers can only create slots for themselves",
            )

    # Check for collision: same provider, same date, overlapping time
    existing = session.exec(
        select(AppointmentSlot).where(
            AppointmentSlot.provider_id == body.provider_id,
            AppointmentSlot.slot_date == body.slot_date,
            AppointmentSlot.start_time == body.start_time,
            AppointmentSlot.is_archived == False,
        )
    ).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"A slot already exists for this provider at {body.start_time} on {body.slot_date}",
        )

    slot = AppointmentSlot(
        provider_id=body.provider_id,
        slot_date=body.slot_date,
        start_time=body.start_time,
        duration_minutes=body.duration_minutes,
        created_by=current_user.id,
    )
    session.add(slot)
    session.commit()
    session.refresh(slot)
    return _slot_to_dict(slot)


@router.put("/{slot_id}")
def update_slot(
    slot_id: int,
    body: SlotUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Edit a slot only if it has not been booked yet."""
    slot = session.get(AppointmentSlot, slot_id)
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")

    # Cannot edit a booked slot
    if slot.appointment:
        raise HTTPException(
            status_code=409,
            detail="Cannot edit a slot that has already been booked by a patient",
        )

    # Providers can only edit their own slots
    if current_user.role == UserRole.provider:
        my_provider = session.exec(
            select(Provider).where(Provider.user_id == current_user.id)
        ).first()
        if not my_provider or my_provider.id != slot.provider_id:
            raise HTTPException(status_code=403, detail="You can only edit your own slots")

    if body.slot_date is not None:
        slot.slot_date = body.slot_date
    if body.start_time is not None:
        slot.start_time = body.start_time
    if body.duration_minutes is not None:
        slot.duration_minutes = body.duration_minutes

    from datetime import datetime
    slot.updated_at = datetime.utcnow()
    session.add(slot)
    session.commit()
    session.refresh(slot)
    return _slot_to_dict(slot)


@router.patch("/{slot_id}/archive")
def archive_slot(
    slot_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_front_desk),
):
    slot = session.get(AppointmentSlot, slot_id)
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    slot.is_archived = True
    session.add(slot)
    session.commit()
    return {"message": "Slot archived", "slot_id": slot_id}


@router.patch("/{slot_id}/restore")
def restore_slot(
    slot_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_front_desk),
):
    slot = session.get(AppointmentSlot, slot_id)
    if not slot:
        raise HTTPException(status_code=404, detail="Slot not found")
    slot.is_archived = False
    session.add(slot)
    session.commit()
    return {"message": "Slot restored", "slot_id": slot_id}
