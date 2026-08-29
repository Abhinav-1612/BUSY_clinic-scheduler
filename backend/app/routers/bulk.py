from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select, func, and_
from pydantic import BaseModel
from typing import List
from datetime import date, timedelta, datetime

from app.database import get_session
from app.models import (
    AppointmentSlot, Appointment, AppointmentStatus,
    AppointmentProvider, CareTeamRole, UnconfirmedAlert,
    Provider, User
)
from app.auth import get_current_user, require_front_desk

router = APIRouter(prefix="/api/bulk", tags=["bulk"])


class WeeklyBlock(BaseModel):
    day_of_week: int      # 0=Monday, 6=Sunday
    start_time: str       # "HH:MM"
    duration_minutes: int = 30


class BulkGenerateRequest(BaseModel):
    provider_id: int
    date_from: date
    date_to: date
    weekly_blocks: List[WeeklyBlock]


@router.post("/generate-slots")
def bulk_generate_slots(
    body: BulkGenerateRequest,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_front_desk),
):
    """
    Generate recurring availability slots for a provider across a date range.
    Returns exact lists of created slots and skipped slots (with collision reason).
    """
    from datetime import time as time_type
    import re

    provider = session.get(Provider, body.provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    if body.date_to < body.date_from:
        raise HTTPException(status_code=400, detail="date_to must be after date_from")

    if (body.date_to - body.date_from).days > 365:
        raise HTTPException(status_code=400, detail="Date range cannot exceed 1 year")

    created = []
    skipped = []

    # Parse all time strings once
    parsed_blocks = []
    for block in body.weekly_blocks:
        match = re.match(r"^(\d{1,2}):(\d{2})$", block.start_time)
        if not match:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid time format: {block.start_time}. Use HH:MM",
            )
        h, m = int(match.group(1)), int(match.group(2))
        parsed_blocks.append((block.day_of_week, time_type(h, m), block.duration_minutes))

    # Iterate each day in range
    current_date = body.date_from
    while current_date <= body.date_to:
        for day_of_week, start_time, duration in parsed_blocks:
            if current_date.weekday() == day_of_week:
                # Check for collision: same provider + date + time + not archived
                existing = session.exec(
                    select(AppointmentSlot).where(
                        AppointmentSlot.provider_id == body.provider_id,
                        AppointmentSlot.slot_date == current_date,
                        AppointmentSlot.start_time == start_time,
                        AppointmentSlot.is_archived == False,
                    )
                ).first()

                slot_info = {
                    "date": str(current_date),
                    "start_time": str(start_time),
                    "provider_id": body.provider_id,
                    "duration_minutes": duration,
                }

                if existing:
                    skipped.append({
                        **slot_info,
                        "reason": "Slot already exists at this time",
                        "existing_slot_id": existing.id,
                    })
                else:
                    new_slot = AppointmentSlot(
                        provider_id=body.provider_id,
                        slot_date=current_date,
                        start_time=start_time,
                        duration_minutes=duration,
                        created_by=current_user.id,
                    )
                    session.add(new_slot)
                    session.flush()
                    created.append({**slot_info, "slot_id": new_slot.id})

        current_date += timedelta(days=1)

    session.commit()

    return {
        "summary": {
            "total_attempted": len(created) + len(skipped),
            "created_count": len(created),
            "skipped_count": len(skipped),
        },
        "created": created,
        "skipped": skipped,
    }
