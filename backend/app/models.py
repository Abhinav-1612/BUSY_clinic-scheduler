from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List
from datetime import datetime, date, time
from enum import Enum
import uuid


# ─── Enums ───────────────────────────────────────────────────────────────────

class UserRole(str, Enum):
    front_desk = "front_desk"
    provider = "provider"


class AppointmentStatus(str, Enum):
    requested = "requested"
    confirmed = "confirmed"
    checked_in = "checked_in"
    completed = "completed"
    no_show = "no_show"
    cancelled = "cancelled"


class HistoryEventType(str, Enum):
    status_change = "status_change"
    supporting_provider_added = "supporting_provider_added"
    supporting_provider_removed = "supporting_provider_removed"
    cancellation = "cancellation"
    visit_note_added = "visit_note_added"


class CareTeamRole(str, Enum):
    scheduling = "scheduling"
    supporting = "supporting"


# ─── User ────────────────────────────────────────────────────────────────────

class User(SQLModel, table=True):
    __tablename__ = "users"

    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(unique=True, index=True, nullable=False)
    hashed_password: str = Field(nullable=False)
    full_name: str = Field(nullable=False)
    role: UserRole = Field(default=UserRole.front_desk, nullable=False)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    provider_profile: Optional["Provider"] = Relationship(back_populates="user")


# ─── Provider ────────────────────────────────────────────────────────────────

class Provider(SQLModel, table=True):
    __tablename__ = "providers"

    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", unique=True, nullable=False)
    specialty: str = Field(nullable=False)
    display_name: str = Field(nullable=False)
    is_active: bool = Field(default=True)

    # Relationships
    user: Optional[User] = Relationship(back_populates="provider_profile")
    slots: List["AppointmentSlot"] = Relationship(back_populates="provider")
    care_team_entries: List["AppointmentProvider"] = Relationship(back_populates="provider")
    visit_notes: List["VisitNote"] = Relationship(back_populates="provider")


# ─── Appointment Slot ─────────────────────────────────────────────────────────

class AppointmentSlot(SQLModel, table=True):
    __tablename__ = "appointment_slots"

    id: Optional[int] = Field(default=None, primary_key=True)
    provider_id: int = Field(foreign_key="providers.id", nullable=False, index=True)
    slot_date: date = Field(nullable=False, index=True)
    start_time: time = Field(nullable=False)
    duration_minutes: int = Field(nullable=False, default=30)
    is_archived: bool = Field(default=False)
    created_by: int = Field(foreign_key="users.id", nullable=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    provider: Optional[Provider] = Relationship(back_populates="slots")
    appointment: Optional["Appointment"] = Relationship(back_populates="slot")


# ─── Appointment ──────────────────────────────────────────────────────────────

class Appointment(SQLModel, table=True):
    __tablename__ = "appointments"

    id: Optional[int] = Field(default=None, primary_key=True)
    slot_id: int = Field(foreign_key="appointment_slots.id", unique=True, nullable=False, index=True)
    patient_name: str = Field(nullable=False, index=True)
    patient_email: str = Field(nullable=False)
    patient_phone: Optional[str] = Field(default=None)
    status: AppointmentStatus = Field(default=AppointmentStatus.requested, nullable=False, index=True)
    cancel_reason: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    slot: Optional[AppointmentSlot] = Relationship(back_populates="appointment")
    care_team: List["AppointmentProvider"] = Relationship(back_populates="appointment")
    history: List["AppointmentHistory"] = Relationship(back_populates="appointment")
    visit_notes: List["VisitNote"] = Relationship(back_populates="appointment")
    unconfirmed_alert: Optional["UnconfirmedAlert"] = Relationship(back_populates="appointment")


# ─── Appointment Care Team (M:M) ─────────────────────────────────────────────

class AppointmentProvider(SQLModel, table=True):
    __tablename__ = "appointment_providers"

    id: Optional[int] = Field(default=None, primary_key=True)
    appointment_id: int = Field(foreign_key="appointments.id", nullable=False, index=True)
    provider_id: int = Field(foreign_key="providers.id", nullable=False, index=True)
    role: CareTeamRole = Field(nullable=False)
    assigned_at: datetime = Field(default_factory=datetime.utcnow)
    assigned_by: int = Field(foreign_key="users.id", nullable=False)

    # Relationships
    appointment: Optional[Appointment] = Relationship(back_populates="care_team")
    provider: Optional[Provider] = Relationship(back_populates="care_team_entries")


# ─── Visit Note ───────────────────────────────────────────────────────────────

class VisitNote(SQLModel, table=True):
    __tablename__ = "visit_notes"

    id: Optional[int] = Field(default=None, primary_key=True)
    appointment_id: int = Field(foreign_key="appointments.id", nullable=False, index=True)
    provider_id: int = Field(foreign_key="providers.id", nullable=False)
    content: str = Field(nullable=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    appointment: Optional[Appointment] = Relationship(back_populates="visit_notes")
    provider: Optional[Provider] = Relationship(back_populates="visit_notes")


# ─── Appointment History (Immutable Audit Log) ────────────────────────────────

class AppointmentHistory(SQLModel, table=True):
    __tablename__ = "appointment_history"

    id: Optional[int] = Field(default=None, primary_key=True)
    appointment_id: int = Field(foreign_key="appointments.id", nullable=False, index=True)
    changed_by: int = Field(foreign_key="users.id", nullable=False)
    event_type: HistoryEventType = Field(nullable=False)
    old_value: Optional[str] = Field(default=None)
    new_value: Optional[str] = Field(default=None)
    description: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)

    # Relationships
    appointment: Optional[Appointment] = Relationship(back_populates="history")


# ─── Unconfirmed Alert ────────────────────────────────────────────────────────

class UnconfirmedAlert(SQLModel, table=True):
    __tablename__ = "unconfirmed_alerts"

    id: Optional[int] = Field(default=None, primary_key=True)
    appointment_id: int = Field(foreign_key="appointments.id", unique=True, nullable=False, index=True)
    dismissed_at: Optional[datetime] = Field(default=None)
    dismissed_by: Optional[int] = Field(default=None, foreign_key="users.id")
    # Refire: if dismissed_at is set but slot is now within 1 hour, reset dismissed_at to NULL
    refire_after: Optional[datetime] = Field(default=None)

    # Relationships
    appointment: Optional[Appointment] = Relationship(back_populates="unconfirmed_alert")
