"""
Seed script — populates the database with rich demo data.
Run: python seed.py  (from the backend/ directory)

Creates:
  - 1 front-desk user
  - 3 providers
  - 60+ appointment slots across 30 days
  - 25+ appointments in mixed statuses
  - Visit notes, care team entries, history events
  - Unconfirmed alerts (some near the 1-hour re-fire threshold)
"""

import os
import sys
from datetime import date, time, datetime, timedelta
from dotenv import load_dotenv

load_dotenv()

from sqlmodel import Session, select, SQLModel
from app.database import engine, create_db_and_tables
from app.models import (
    User, Provider, AppointmentSlot, Appointment, AppointmentStatus,
    AppointmentProvider, CareTeamRole, VisitNote, AppointmentHistory,
    HistoryEventType, UnconfirmedAlert, UserRole
)
from app.auth import hash_password


def clear_tables(session: Session):
    """Clear all data in dependency order."""
    for table in [
        UnconfirmedAlert, AppointmentHistory, VisitNote,
        AppointmentProvider, Appointment, AppointmentSlot,
        Provider, User
    ]:
        session.exec(table.__table__.delete())
    session.commit()
    print("✓ Cleared existing data")


def seed():
    create_db_and_tables()
    today = date.today()

    with Session(engine) as session:
        clear_tables(session)

        # ── Users ────────────────────────────────────────────────────────────
        front_desk = User(
            email="frontdesk@clinic.demo",
            hashed_password=hash_password("Demo1234!"),
            full_name="Sarah Chen",
            role=UserRole.front_desk,
        )
        dr_smith_user = User(
            email="dr.smith@clinic.demo",
            hashed_password=hash_password("Demo1234!"),
            full_name="Dr. James Smith",
            role=UserRole.provider,
        )
        dr_jones_user = User(
            email="dr.jones@clinic.demo",
            hashed_password=hash_password("Demo1234!"),
            full_name="Dr. Priya Jones",
            role=UserRole.provider,
        )
        dr_miller_user = User(
            email="dr.miller@clinic.demo",
            hashed_password=hash_password("Demo1234!"),
            full_name="Dr. Alex Miller",
            role=UserRole.provider,
        )

        for u in [front_desk, dr_smith_user, dr_jones_user, dr_miller_user]:
            session.add(u)
        session.flush()

        print(f"✓ Created 4 users")

        # ── Providers ─────────────────────────────────────────────────────────
        dr_smith = Provider(
            user_id=dr_smith_user.id,
            specialty="Physical Therapy",
            display_name="Dr. Smith (PT)",
        )
        dr_jones = Provider(
            user_id=dr_jones_user.id,
            specialty="Dental",
            display_name="Dr. Jones (Dental)",
        )
        dr_miller = Provider(
            user_id=dr_miller_user.id,
            specialty="Physical Therapy",
            display_name="Dr. Miller (PT)",
        )
        for p in [dr_smith, dr_jones, dr_miller]:
            session.add(p)
        session.flush()

        print(f"✓ Created 3 providers")

        # ── Appointment Slots ─────────────────────────────────────────────────
        slots_created = []
        providers_list = [dr_smith, dr_jones, dr_miller]
        slot_times = [time(9, 0), time(9, 30), time(10, 0), time(10, 30),
                      time(11, 0), time(14, 0), time(14, 30), time(15, 0)]

        for day_offset in range(-5, 25):  # Past 5 days + next 25 days
            slot_date = today + timedelta(days=day_offset)
            if slot_date.weekday() >= 5:  # Skip weekends
                continue

            for prov in providers_list:
                for t in slot_times:
                    slot = AppointmentSlot(
                        provider_id=prov.id,
                        slot_date=slot_date,
                        start_time=t,
                        duration_minutes=30,
                        created_by=front_desk.id,
                    )
                    session.add(slot)
                    slots_created.append((slot, prov, slot_date))

        session.flush()
        print(f"✓ Created {len(slots_created)} appointment slots")

        # ── Appointments (mixed statuses) ─────────────────────────────────────
        patients = [
            ("Alice Johnson", "alice@example.com", "555-0101"),
            ("Bob Martinez", "bob@example.com", "555-0102"),
            ("Carol White", "carol@example.com", "555-0103"),
            ("David Lee", "david@example.com", "555-0104"),
            ("Emma Davis", "emma@example.com", "555-0105"),
            ("Frank Wilson", "frank@example.com", "555-0106"),
            ("Grace Kim", "grace@example.com", "555-0107"),
            ("Henry Brown", "henry@example.com", "555-0108"),
            ("Iris Chen", "iris@example.com", "555-0109"),
            ("Jack Taylor", "jack@example.com", "555-0110"),
            ("Karen Moore", "karen@example.com", "555-0111"),
            ("Liam Anderson", "liam@example.com", "555-0112"),
        ]

        appointments_made = []
        used_slots = set()

        def make_appointment(slot, patient, status, history_events=None, cancel_reason=None):
            if slot.id in used_slots:
                return None
            used_slots.add(slot.id)

            appt = Appointment(
                slot_id=slot.id,
                patient_name=patient[0],
                patient_email=patient[1],
                patient_phone=patient[2],
                status=status,
                cancel_reason=cancel_reason,
            )
            session.add(appt)
            session.flush()

            # Add scheduling provider to care team
            care = AppointmentProvider(
                appointment_id=appt.id,
                provider_id=slot.provider_id,
                role=CareTeamRole.scheduling,
                assigned_by=front_desk.id,
            )
            session.add(care)

            # History: requested event
            session.add(AppointmentHistory(
                appointment_id=appt.id,
                changed_by=front_desk.id,
                event_type=HistoryEventType.status_change,
                old_value=None,
                new_value=AppointmentStatus.requested.value,
                description=f"Appointment requested for {patient[0]}",
                created_at=appt.created_at,
            ))

            # Additional history events
            if history_events:
                for evt in history_events:
                    session.add(AppointmentHistory(
                        appointment_id=appt.id,
                        changed_by=evt.get("by", front_desk.id),
                        event_type=evt["type"],
                        old_value=evt.get("old"),
                        new_value=evt.get("new"),
                        description=evt.get("desc"),
                    ))

            appointments_made.append(appt)
            return appt

        # Get slots by date offset for controlled seeding
        def get_slot(provider, day_offset, time_idx):
            target_date = today + timedelta(days=day_offset)
            # Skip weekends
            while target_date.weekday() >= 5:
                target_date += timedelta(days=1)

            slot = session.exec(
                select(AppointmentSlot).where(
                    AppointmentSlot.provider_id == provider.id,
                    AppointmentSlot.slot_date == target_date,
                    AppointmentSlot.start_time == slot_times[time_idx],
                )
            ).first()
            return slot

        # Past completed appointments (with notes)
        past_slots = [
            (get_slot(dr_smith, -4, 0), patients[0], AppointmentStatus.completed),
            (get_slot(dr_smith, -3, 1), patients[1], AppointmentStatus.completed),
            (get_slot(dr_jones, -4, 2), patients[2], AppointmentStatus.completed),
            (get_slot(dr_jones, -2, 0), patients[3], AppointmentStatus.completed),
            (get_slot(dr_miller, -4, 3), patients[4], AppointmentStatus.completed),
        ]
        for slot, patient, status in past_slots:
            if slot:
                make_appointment(slot, patient, status, history_events=[
                    {"type": HistoryEventType.status_change, "old": "requested", "new": "confirmed", "desc": "Confirmed by front desk"},
                    {"type": HistoryEventType.status_change, "old": "confirmed", "new": "checked_in", "desc": "Patient checked in"},
                    {"type": HistoryEventType.status_change, "old": "checked_in", "new": "completed", "desc": "Visit completed"},
                ])

        # Past no-shows
        noshow_slots = [
            (get_slot(dr_smith, -3, 4), patients[5]),
            (get_slot(dr_jones, -2, 1), patients[6]),
            (get_slot(dr_miller, -3, 2), patients[7]),
        ]
        for slot, patient in noshow_slots:
            if slot:
                make_appointment(slot, patient, AppointmentStatus.no_show, history_events=[
                    {"type": HistoryEventType.status_change, "old": "requested", "new": "confirmed", "desc": "Confirmed by front desk"},
                    {"type": HistoryEventType.status_change, "old": "confirmed", "new": "no_show", "desc": "Patient did not arrive"},
                ])

        # Past cancellations
        cancel_slots = [
            (get_slot(dr_smith, -1, 5), patients[8]),
            (get_slot(dr_jones, -1, 3), patients[9]),
        ]
        for slot, patient in cancel_slots:
            if slot:
                make_appointment(slot, patient, AppointmentStatus.cancelled,
                    cancel_reason="Patient called to reschedule",
                    history_events=[
                        {"type": HistoryEventType.status_change, "old": "requested", "new": "confirmed", "desc": "Confirmed by front desk"},
                        {"type": HistoryEventType.cancellation, "old": "confirmed", "new": "cancelled", "desc": "Cancelled - patient called to reschedule"},
                    ])

        # Today's appointments — various states
        today_appts = [
            (get_slot(dr_smith, 0, 0), patients[0], AppointmentStatus.checked_in),
            (get_slot(dr_smith, 0, 1), patients[1], AppointmentStatus.confirmed),
            (get_slot(dr_jones, 0, 0), patients[2], AppointmentStatus.checked_in),
            (get_slot(dr_jones, 0, 2), patients[3], AppointmentStatus.confirmed),
            (get_slot(dr_miller, 0, 0), patients[4], AppointmentStatus.requested),
            (get_slot(dr_miller, 0, 1), patients[5], AppointmentStatus.confirmed),
        ]
        today_appt_objects = []
        for slot, patient, status in today_appts:
            if slot:
                hist = [{"type": HistoryEventType.status_change, "old": "requested", "new": "confirmed", "desc": "Confirmed"}]
                if status == AppointmentStatus.checked_in:
                    hist.append({"type": HistoryEventType.status_change, "old": "confirmed", "new": "checked_in", "desc": "Checked in at reception"})
                appt = make_appointment(slot, patient, status, history_events=hist if status != AppointmentStatus.requested else None)
                today_appt_objects.append(appt)

        # Future appointments — mostly requested and confirmed
        for i, (prov, day_offset, time_idx, patient_idx, status) in enumerate([
            (dr_smith, 1, 0, 6, AppointmentStatus.confirmed),
            (dr_smith, 1, 2, 7, AppointmentStatus.requested),
            (dr_jones, 1, 0, 8, AppointmentStatus.confirmed),
            (dr_jones, 2, 1, 9, AppointmentStatus.requested),
            (dr_miller, 1, 0, 10, AppointmentStatus.confirmed),
            (dr_miller, 2, 2, 11, AppointmentStatus.requested),
            (dr_smith, 3, 0, 0, AppointmentStatus.requested),
            (dr_jones, 3, 1, 1, AppointmentStatus.confirmed),
            (dr_miller, 4, 0, 2, AppointmentStatus.requested),
        ]):
            slot = get_slot(prov, day_offset, time_idx)
            if slot:
                hist = [{"type": HistoryEventType.status_change, "old": "requested", "new": "confirmed", "desc": "Confirmed"}] \
                    if status == AppointmentStatus.confirmed else None
                make_appointment(slot, patients[patient_idx % len(patients)], status, history_events=hist)

        session.flush()
        print(f"✓ Created {len(appointments_made)} appointments")

        # ── Visit Notes ───────────────────────────────────────────────────────
        notes_data = [
            "Patient presented with lower back pain (L4-L5). Range of motion limited. Started with heat therapy and gentle stretching exercises. Patient tolerated well.",
            "Follow-up session. Significant improvement in lumbar flexion. Introduced resistance band exercises. Patient reports 30% reduction in pain.",
            "Routine dental cleaning completed. No cavities found. Minor tartar buildup on lower molars — recommended nightly flossing.",
            "Patient reports jaw pain during chewing. Assessment indicates possible TMJ involvement. Referred to specialist for X-ray.",
            "Post-op physical therapy — knee replacement recovery. Day 14. Walking with reduced limp. Home exercise compliance reported as 80%.",
        ]

        completed_appts = [a for a in appointments_made if a.status == AppointmentStatus.completed]
        for i, appt in enumerate(completed_appts[:5]):
            slot = session.get(AppointmentSlot, appt.slot_id)
            prov_map = {dr_smith.id: dr_smith_user, dr_jones.id: dr_jones_user, dr_miller.id: dr_miller_user}
            author_user = prov_map.get(slot.provider_id, dr_smith_user)
            prov_profile = {dr_smith_user.id: dr_smith, dr_jones_user.id: dr_jones, dr_miller_user.id: dr_miller}
            author_prov = prov_profile.get(author_user.id, dr_smith)

            note = VisitNote(
                appointment_id=appt.id,
                provider_id=author_prov.id,
                content=notes_data[i % len(notes_data)],
            )
            session.add(note)

        session.flush()
        print(f"✓ Created visit notes for completed appointments")

        # ── Supporting Providers (Care Team) ──────────────────────────────────
        if len(appointments_made) > 5:
            # Add Dr. Miller as supporting provider to Dr. Smith's appointment
            target_appt = next((a for a in appointments_made if a.status == AppointmentStatus.confirmed), None)
            if target_appt:
                supporting = AppointmentProvider(
                    appointment_id=target_appt.id,
                    provider_id=dr_miller.id,
                    role=CareTeamRole.supporting,
                    assigned_by=front_desk.id,
                )
                session.add(supporting)
                session.add(AppointmentHistory(
                    appointment_id=target_appt.id,
                    changed_by=front_desk.id,
                    event_type=HistoryEventType.supporting_provider_added,
                    new_value=str(dr_miller.id),
                    description=f"Dr. Miller added as supporting provider by Sarah Chen",
                ))

        print(f"✓ Created care team entries")

        # ── Unconfirmed Alerts ────────────────────────────────────────────────
        requested_appts = [a for a in appointments_made if a.status == AppointmentStatus.requested]
        for appt in requested_appts:
            alert = UnconfirmedAlert(appointment_id=appt.id)
            session.add(alert)

        session.commit()
        print(f"✓ Created {len(requested_appts)} unconfirmed alerts")

        print("\n✅ Seed complete!")
        print("─" * 40)
        print("Demo credentials:")
        print("  Front Desk: frontdesk@clinic.demo / Demo1234!")
        print("  Provider 1: dr.smith@clinic.demo  / Demo1234!")
        print("  Provider 2: dr.jones@clinic.demo  / Demo1234!")
        print("  Provider 3: dr.miller@clinic.demo / Demo1234!")
        print(f"\n  Slots created:        {len(slots_created)}")
        print(f"  Appointments created: {len(appointments_made)}")


if __name__ == "__main__":
    seed()
