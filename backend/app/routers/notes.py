from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import Optional

from app.database import get_session
from app.models import (
    VisitNote, Appointment, AppointmentProvider, Provider,
    User, UserRole, HistoryEventType, AppointmentHistory, AppointmentSlot
)
from app.auth import get_current_user, require_provider
from app.routers.appointments import _log_history

router = APIRouter(prefix="/api/notes", tags=["visit-notes"])


class NoteCreate(BaseModel):
    appointment_id: int
    content: str


class NoteUpdate(BaseModel):
    content: str


def _note_to_dict(note: VisitNote, session: Session) -> dict:
    provider = session.get(Provider, note.provider_id)
    return {
        "id": note.id,
        "appointment_id": note.appointment_id,
        "provider_id": note.provider_id,
        "provider_name": provider.display_name if provider else "Unknown",
        "content": note.content,
        "created_at": note.created_at.isoformat(),
        "updated_at": note.updated_at.isoformat(),
    }


@router.get("/appointment/{appointment_id}")
def get_notes_for_appointment(
    appointment_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(get_current_user),
):
    """Get all visit notes for an appointment, ordered by created_at."""
    appointment = session.get(Appointment, appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    notes = session.exec(
        select(VisitNote)
        .where(VisitNote.appointment_id == appointment_id)
        .order_by(VisitNote.created_at.asc())
    ).all()

    return [_note_to_dict(n, session) for n in notes]


@router.post("/", status_code=201)
def create_note(
    body: NoteCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_provider),
):
    """Providers only: add a visit note to an appointment."""
    appointment = session.get(Appointment, body.appointment_id)
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    # Get provider profile for this user
    my_provider = session.exec(
        select(Provider).where(Provider.user_id == current_user.id)
    ).first()
    if not my_provider:
        raise HTTPException(status_code=404, detail="Provider profile not found")

    note = VisitNote(
        appointment_id=body.appointment_id,
        provider_id=my_provider.id,
        content=body.content,
    )
    session.add(note)
    session.flush()

    # Log to immutable history
    _log_history(
        session, body.appointment_id, current_user.id,
        HistoryEventType.visit_note_added,
        new_value=str(note.id),
        description=f"Visit note added by {current_user.full_name}: {body.content[:80]}...",
    )

    session.commit()
    session.refresh(note)
    return _note_to_dict(note, session)


@router.put("/{note_id}")
def update_note(
    note_id: int,
    body: NoteUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_provider),
):
    """Only the provider who wrote the note can edit it."""
    note = session.get(VisitNote, note_id)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    my_provider = session.exec(
        select(Provider).where(Provider.user_id == current_user.id)
    ).first()
    if not my_provider or note.provider_id != my_provider.id:
        raise HTTPException(
            status_code=403,
            detail="You can only edit visit notes that you wrote",
        )

    note.content = body.content
    from datetime import datetime
    note.updated_at = datetime.utcnow()
    session.add(note)
    session.commit()
    session.refresh(note)
    return _note_to_dict(note, session)
