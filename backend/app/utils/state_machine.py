"""
State machine for appointment status transitions.

Valid transitions:
  requested   → confirmed        (by front_desk or scheduling provider)
  requested   → cancelled        (must include cancel_reason)
  confirmed   → checked_in       (by front_desk)
  confirmed   → no_show          (only after scheduled time has passed)
  confirmed   → cancelled        (must include cancel_reason)
  checked_in  → completed        (by front_desk or provider)
  checked_in  → CANNOT CANCEL    (reject with message)

Everything else is rejected with a clear reason.
"""

from datetime import datetime, date, time
from app.models import AppointmentStatus


# Map of (from_status → set of allowed to_statuses)
VALID_TRANSITIONS = {
    AppointmentStatus.requested: {
        AppointmentStatus.confirmed,
        AppointmentStatus.cancelled,
    },
    AppointmentStatus.confirmed: {
        AppointmentStatus.checked_in,
        AppointmentStatus.no_show,
        AppointmentStatus.cancelled,
    },
    AppointmentStatus.checked_in: {
        AppointmentStatus.completed,
        # cancelled is explicitly disallowed — handled below
    },
    AppointmentStatus.completed: set(),
    AppointmentStatus.no_show: set(),
    AppointmentStatus.cancelled: set(),
}


def validate_transition(
    from_status: AppointmentStatus,
    to_status: AppointmentStatus,
    slot_date: date,
    slot_time: time,
    cancel_reason: str = None,
) -> tuple[bool, str]:
    """
    Returns (is_valid: bool, error_message: str).
    error_message is empty string if valid.
    """

    # Special case: trying to cancel after check-in
    if from_status == AppointmentStatus.checked_in and to_status == AppointmentStatus.cancelled:
        return False, "Cannot cancel an appointment after the patient has already checked in."

    # Check general transition validity
    allowed = VALID_TRANSITIONS.get(from_status, set())
    if to_status not in allowed:
        return False, (
            f"Cannot move appointment from '{from_status.value}' to '{to_status.value}'. "
            f"Allowed transitions from '{from_status.value}': "
            f"{[s.value for s in allowed] if allowed else 'none (terminal state)'}."
        )

    # No Show: only allowed after scheduled time has passed
    if to_status == AppointmentStatus.no_show:
        slot_datetime = datetime.combine(slot_date, slot_time)
        if datetime.utcnow() <= slot_datetime:
            return False, (
                "Cannot mark as No Show before the appointment's scheduled time has passed."
            )

    # Cancellation requires a reason
    if to_status == AppointmentStatus.cancelled:
        if not cancel_reason or not cancel_reason.strip():
            return False, "A cancellation reason is required."

    return True, ""
