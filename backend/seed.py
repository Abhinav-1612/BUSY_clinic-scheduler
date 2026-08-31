"""
Seed script — populates the database with rich demo data.
Run: python seed.py  (from the backend/ directory)

Creates:
  - 1 front-desk user
  - 10 providers across 7 specialties
  - 800+ appointment slots across 30 days
  - 35+ appointments in mixed statuses
  - Visit notes, care team entries, history events
  - Unconfirmed alerts
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

        # 10 provider user accounts
        provider_user_data = [
            ("dr.smith@clinic.demo",   "Dr. James Smith"),
            ("dr.jones@clinic.demo",   "Dr. Priya Jones"),
            ("dr.miller@clinic.demo",  "Dr. Alex Miller"),
            ("dr.patel@clinic.demo",   "Dr. Ananya Patel"),
            ("dr.nguyen@clinic.demo",  "Dr. Kevin Nguyen"),
            ("dr.okafor@clinic.demo",  "Dr. Chidi Okafor"),
            ("dr.russo@clinic.demo",   "Dr. Elena Russo"),
            ("dr.kim@clinic.demo",     "Dr. Soo-Yeon Kim"),
            ("dr.hassan@clinic.demo",  "Dr. Tariq Hassan"),
            ("dr.roberts@clinic.demo", "Dr. Lisa Roberts"),
        ]

        provider_users = []
        for email, name in provider_user_data:
            u = User(
                email=email,
                hashed_password=hash_password("Demo1234!"),
                full_name=name,
                role=UserRole.provider,
            )
            provider_users.append(u)

        session.add(front_desk)
        for u in provider_users:
            session.add(u)
        session.flush()

        print(f"✓ Created {1 + len(provider_users)} users")

        # ── Providers ─────────────────────────────────────────────────────────
        # 10 providers across 7 distinct specialties
        provider_meta = [
            ("Physical Therapy",       "Dr. Smith (PT)"),
            ("Dental",                 "Dr. Jones (Dental)"),
            ("Physical Therapy",       "Dr. Miller (PT)"),
            ("Cardiology",             "Dr. Patel (Cardiology)"),
            ("Orthopedics",            "Dr. Nguyen (Ortho)"),
            ("General Medicine",       "Dr. Okafor (General)"),
            ("Dermatology",            "Dr. Russo (Derma)"),
            ("Pediatrics",             "Dr. Kim (Pediatrics)"),
            ("Neurology",              "Dr. Hassan (Neuro)"),
            ("Sports Medicine",        "Dr. Roberts (Sports Med)"),
        ]

        providers = []
        for user_obj, (specialty, display_name) in zip(provider_users, provider_meta):
            p = Provider(
                user_id=user_obj.id,
                specialty=specialty,
                display_name=display_name,
            )
            providers.append(p)
            session.add(p)
        session.flush()

        print(f"✓ Created {len(providers)} providers")

        # Convenience aliases
        (dr_smith, dr_jones, dr_miller, dr_patel, dr_nguyen,
         dr_okafor, dr_russo, dr_kim, dr_hassan, dr_roberts) = providers

        (dr_smith_user, dr_jones_user, dr_miller_user, dr_patel_user,
         dr_nguyen_user, dr_okafor_user, dr_russo_user, dr_kim_user,
         dr_hassan_user, dr_roberts_user) = provider_users

        # ── Appointment Slots ─────────────────────────────────────────────────
        slots_created = []
        slot_times = [
            time(8, 0), time(8, 30), time(9, 0), time(9, 30),
            time(10, 0), time(10, 30), time(11, 0), time(11, 30),
            time(14, 0), time(14, 30), time(15, 0), time(15, 30),
            time(16, 0), time(16, 30),
        ]

        for day_offset in range(-5, 26):  # Past 5 days + next 25 days
            slot_date = today + timedelta(days=day_offset)
            if slot_date.weekday() >= 5:  # Skip weekends
                continue

            for prov in providers:
                # Not every doctor works every time slot — vary hours by specialty
                if prov.specialty in ("Cardiology", "Neurology"):
                    times_today = slot_times[2:10]   # 9am–3:30pm
                elif prov.specialty == "Pediatrics":
                    times_today = slot_times[0:8]    # 8am–11:30am
                elif prov.specialty == "Dental":
                    times_today = slot_times[2:12]   # 9am–4pm
                else:
                    times_today = slot_times          # Full day

                for t in times_today:
                    duration = 45 if prov.specialty in ("Cardiology", "Neurology") else 30
                    slot = AppointmentSlot(
                        provider_id=prov.id,
                        slot_date=slot_date,
                        start_time=t,
                        duration_minutes=duration,
                        created_by=front_desk.id,
                    )
                    session.add(slot)
                    slots_created.append((slot, prov, slot_date))

        session.flush()
        print(f"✓ Created {len(slots_created)} appointment slots")

        # ── Appointments (mixed statuses) ─────────────────────────────────────
        patients = [
            ("Alice Johnson",   "alice@example.com",   "555-0101"),
            ("Bob Martinez",    "bob@example.com",     "555-0102"),
            ("Carol White",     "carol@example.com",   "555-0103"),
            ("David Lee",       "david@example.com",   "555-0104"),
            ("Emma Davis",      "emma@example.com",    "555-0105"),
            ("Frank Wilson",    "frank@example.com",   "555-0106"),
            ("Grace Kim",       "grace@example.com",   "555-0107"),
            ("Henry Brown",     "henry@example.com",   "555-0108"),
            ("Iris Chen",       "iris@example.com",    "555-0109"),
            ("Jack Taylor",     "jack@example.com",    "555-0110"),
            ("Karen Moore",     "karen@example.com",   "555-0111"),
            ("Liam Anderson",   "liam@example.com",    "555-0112"),
            ("Maya Patel",      "maya@example.com",    "555-0113"),
            ("Noah Williams",   "noah@example.com",    "555-0114"),
            ("Olivia Garcia",   "olivia@example.com",  "555-0115"),
            ("Peter Scott",     "peter@example.com",   "555-0116"),
            ("Quinn Thomas",    "quinn@example.com",   "555-0117"),
            ("Rachel Evans",    "rachel@example.com",  "555-0118"),
        ]

        appointments_made = []
        used_slots = set()

        def make_appointment(slot, patient, status, history_events=None, cancel_reason=None):
            if slot is None or slot.id in used_slots:
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

            care = AppointmentProvider(
                appointment_id=appt.id,
                provider_id=slot.provider_id,
                role=CareTeamRole.scheduling,
                assigned_by=front_desk.id,
            )
            session.add(care)

            session.add(AppointmentHistory(
                appointment_id=appt.id,
                changed_by=front_desk.id,
                event_type=HistoryEventType.status_change,
                old_value=None,
                new_value=AppointmentStatus.requested.value,
                description=f"Appointment requested for {patient[0]}",
                created_at=appt.created_at,
            ))

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

        def get_slot(provider, day_offset, time_idx):
            target_date = today + timedelta(days=day_offset)
            while target_date.weekday() >= 5:
                target_date += timedelta(days=1)
            # Use modulo to safely index into varying slot arrays
            if provider.specialty in ("Cardiology", "Neurology"):
                avail_times = slot_times[2:10]
            elif provider.specialty == "Pediatrics":
                avail_times = slot_times[0:8]
            elif provider.specialty == "Dental":
                avail_times = slot_times[2:12]
            else:
                avail_times = slot_times
            t = avail_times[time_idx % len(avail_times)]
            return session.exec(
                select(AppointmentSlot).where(
                    AppointmentSlot.provider_id == provider.id,
                    AppointmentSlot.slot_date == target_date,
                    AppointmentSlot.start_time == t,
                )
            ).first()

        # ── Past completed appointments (with visit notes)
        completed_history = [
            {"type": HistoryEventType.status_change, "old": "requested",  "new": "confirmed",  "desc": "Confirmed by front desk"},
            {"type": HistoryEventType.status_change, "old": "confirmed",  "new": "checked_in", "desc": "Patient checked in"},
            {"type": HistoryEventType.status_change, "old": "checked_in", "new": "completed",  "desc": "Visit completed"},
        ]
        past_completed = [
            (dr_smith,   -4, 0, patients[0]),
            (dr_smith,   -3, 1, patients[1]),
            (dr_jones,   -4, 2, patients[2]),
            (dr_jones,   -2, 0, patients[3]),
            (dr_miller,  -4, 3, patients[4]),
            (dr_patel,   -3, 0, patients[5]),
            (dr_nguyen,  -4, 1, patients[6]),
            (dr_okafor,  -2, 2, patients[7]),
            (dr_russo,   -3, 0, patients[8]),
            (dr_kim,     -4, 0, patients[9]),
            (dr_hassan,  -2, 1, patients[10]),
            (dr_roberts, -3, 2, patients[11]),
        ]
        for prov, day_off, time_idx, patient in past_completed:
            make_appointment(get_slot(prov, day_off, time_idx), patient, AppointmentStatus.completed, history_events=completed_history)

        # ── Past no-shows
        noshow_history = [
            {"type": HistoryEventType.status_change, "old": "requested", "new": "confirmed",  "desc": "Confirmed by front desk"},
            {"type": HistoryEventType.status_change, "old": "confirmed", "new": "no_show",    "desc": "Patient did not arrive"},
        ]
        past_noshows = [
            (dr_smith,   -3, 4, patients[12]),
            (dr_jones,   -2, 1, patients[13]),
            (dr_miller,  -3, 2, patients[14]),
            (dr_patel,   -2, 3, patients[15]),
            (dr_nguyen,  -1, 0, patients[16]),
        ]
        for prov, day_off, time_idx, patient in past_noshows:
            make_appointment(get_slot(prov, day_off, time_idx), patient, AppointmentStatus.no_show, history_events=noshow_history)

        # ── Past cancellations
        cancel_history = [
            {"type": HistoryEventType.status_change, "old": "requested",  "new": "confirmed",  "desc": "Confirmed by front desk"},
            {"type": HistoryEventType.cancellation,  "old": "confirmed",  "new": "cancelled",  "desc": "Cancelled - patient called to reschedule"},
        ]
        past_cancels = [
            (dr_smith,   -1, 5, patients[17]),
            (dr_jones,   -1, 3, patients[0]),
            (dr_okafor,  -2, 4, patients[1]),
            (dr_russo,   -1, 2, patients[2]),
        ]
        for prov, day_off, time_idx, patient in past_cancels:
            make_appointment(get_slot(prov, day_off, time_idx), patient,
                AppointmentStatus.cancelled,
                cancel_reason="Patient called to reschedule",
                history_events=cancel_history)

        # ── Today's appointments (varied states)
        today_appts = [
            (dr_smith,   0, 0, patients[3],  AppointmentStatus.checked_in),
            (dr_smith,   0, 1, patients[4],  AppointmentStatus.confirmed),
            (dr_jones,   0, 0, patients[5],  AppointmentStatus.checked_in),
            (dr_jones,   0, 2, patients[6],  AppointmentStatus.confirmed),
            (dr_miller,  0, 0, patients[7],  AppointmentStatus.requested),
            (dr_miller,  0, 1, patients[8],  AppointmentStatus.confirmed),
            (dr_patel,   0, 0, patients[9],  AppointmentStatus.checked_in),
            (dr_nguyen,  0, 0, patients[10], AppointmentStatus.confirmed),
            (dr_okafor,  0, 1, patients[11], AppointmentStatus.requested),
            (dr_russo,   0, 0, patients[12], AppointmentStatus.confirmed),
            (dr_kim,     0, 0, patients[13], AppointmentStatus.checked_in),
            (dr_hassan,  0, 1, patients[14], AppointmentStatus.confirmed),
            (dr_roberts, 0, 0, patients[15], AppointmentStatus.requested),
        ]
        for prov, day_off, time_idx, patient, status in today_appts:
            hist = [{"type": HistoryEventType.status_change, "old": "requested", "new": "confirmed", "desc": "Confirmed"}]
            if status == AppointmentStatus.checked_in:
                hist.append({"type": HistoryEventType.status_change, "old": "confirmed", "new": "checked_in", "desc": "Checked in at reception"})
            make_appointment(get_slot(prov, day_off, time_idx), patient, status,
                             history_events=hist if status != AppointmentStatus.requested else None)

        # ── Future appointments (mix of requested/confirmed across all 10 doctors)
        future_appts = [
            (dr_smith,   1, 0, patients[16], AppointmentStatus.confirmed),
            (dr_smith,   2, 2, patients[17], AppointmentStatus.requested),
            (dr_jones,   1, 0, patients[0],  AppointmentStatus.confirmed),
            (dr_jones,   3, 1, patients[1],  AppointmentStatus.requested),
            (dr_miller,  1, 0, patients[2],  AppointmentStatus.confirmed),
            (dr_miller,  2, 3, patients[3],  AppointmentStatus.requested),
            (dr_patel,   1, 0, patients[4],  AppointmentStatus.confirmed),
            (dr_patel,   4, 1, patients[5],  AppointmentStatus.requested),
            (dr_nguyen,  1, 0, patients[6],  AppointmentStatus.confirmed),
            (dr_nguyen,  3, 2, patients[7],  AppointmentStatus.requested),
            (dr_okafor,  1, 1, patients[8],  AppointmentStatus.confirmed),
            (dr_russo,   2, 0, patients[9],  AppointmentStatus.requested),
            (dr_kim,     1, 0, patients[10], AppointmentStatus.confirmed),
            (dr_hassan,  2, 1, patients[11], AppointmentStatus.requested),
            (dr_roberts, 1, 0, patients[12], AppointmentStatus.confirmed),
            (dr_roberts, 3, 2, patients[13], AppointmentStatus.requested),
        ]
        for prov, day_off, time_idx, patient, status in future_appts:
            hist = [{"type": HistoryEventType.status_change, "old": "requested", "new": "confirmed", "desc": "Confirmed"}] \
                if status == AppointmentStatus.confirmed else None
            make_appointment(get_slot(prov, day_off, time_idx), patient, status, history_events=hist)

        session.flush()
        print(f"✓ Created {len(appointments_made)} appointments")

        # ── Visit Notes ───────────────────────────────────────────────────────
        notes_by_specialty = {
            "Physical Therapy":  [
                "Patient presented with lower back pain (L4-L5). ROM limited. Started heat therapy and gentle stretching. Patient tolerated well.",
                "Follow-up: significant improvement in lumbar flexion. Introduced resistance band exercises. Patient reports 30% pain reduction.",
                "Knee strengthening session. Quad sets and straight-leg raises completed. Patient showing good progress post-ACL repair.",
            ],
            "Dental": [
                "Routine cleaning completed. No cavities found. Minor tartar buildup on lower molars — recommended nightly flossing.",
                "Patient reports jaw pain during chewing. Assessment indicates possible TMJ involvement. Referred to specialist for X-ray.",
                "Cavity filled on lower right molar (#30). Local anesthetic administered. Patient tolerated procedure without complications.",
            ],
            "Cardiology": [
                "Routine ECG shows normal sinus rhythm. BP: 128/82. Prescribed low-dose aspirin, advised 30-min daily cardio.",
                "Follow-up post-stent procedure. Patient asymptomatic. Echo shows EF of 58%. Continue current medication regimen.",
            ],
            "Orthopedics": [
                "Post-op review — knee replacement recovery day 14. Walking with reduced limp. Home exercise compliance: 80%.",
                "Right shoulder impingement confirmed by MRI. Corticosteroid injection administered. Physiotherapy referral issued.",
            ],
            "General Medicine": [
                "Annual check-up. BP 120/78, BMI 24. Blood panel ordered. Patient advised to reduce sodium intake.",
                "Patient presents with persistent cough (2 weeks). Chest clear on auscultation. Prescribed cough suppressant, follow-up in 1 week.",
            ],
            "Dermatology": [
                "Acne vulgaris, moderate severity. Topical retinoid prescribed. SPF 50 sunscreen recommended daily.",
                "Suspicious mole on left forearm (6mm, irregular border). Biopsy taken. Results expected in 5–7 days.",
            ],
            "Pediatrics": [
                "6-year routine wellness visit. Height/weight at 60th percentile. Vaccinations up to date. No developmental concerns.",
                "Child presented with ear pain and mild fever (38.1°C). Right ear otitis media diagnosed. Amoxicillin prescribed for 10 days.",
            ],
            "Neurology": [
                "Migraine management review. Patient experiencing 3–4 episodes/month. Topiramate dose increased to 100mg. Sleep hygiene counselled.",
                "EEG review for suspected absence seizures. Results consistent with childhood absence epilepsy. Ethosuximide initiated.",
            ],
            "Sports Medicine": [
                "Hamstring Grade II strain, right leg. RICE protocol reviewed. Return to sport estimated 4–6 weeks.",
                "Runner's knee (PFPS) assessment. Hip strengthening program prescribed. Advised to reduce mileage by 40% for 3 weeks.",
            ],
        }

        # User/provider lookup maps
        user_by_provider_id = {
            dr_smith.id:   dr_smith_user,
            dr_jones.id:   dr_jones_user,
            dr_miller.id:  dr_miller_user,
            dr_patel.id:   dr_patel_user,
            dr_nguyen.id:  dr_nguyen_user,
            dr_okafor.id:  dr_okafor_user,
            dr_russo.id:   dr_russo_user,
            dr_kim.id:     dr_kim_user,
            dr_hassan.id:  dr_hassan_user,
            dr_roberts.id: dr_roberts_user,
        }
        provider_by_user_id = {v.id: k for k, v in user_by_provider_id.items()}
        specialty_by_provider_id = {p.id: p.specialty for p in providers}

        notes_indices = {}  # track per-specialty note rotation
        completed_appts = [a for a in appointments_made if a.status == AppointmentStatus.completed]
        for appt in completed_appts:
            slot = session.get(AppointmentSlot, appt.slot_id)
            specialty = specialty_by_provider_id.get(slot.provider_id, "General Medicine")
            note_list = notes_by_specialty.get(specialty, ["Visit completed. No further notes."])
            idx = notes_indices.get(specialty, 0)
            note = VisitNote(
                appointment_id=appt.id,
                provider_id=slot.provider_id,
                content=note_list[idx % len(note_list)],
            )
            notes_indices[specialty] = idx + 1
            session.add(note)

        session.flush()
        print(f"✓ Created visit notes for {len(completed_appts)} completed appointments")

        # ── Supporting Providers (Care Team) ──────────────────────────────────
        # Add cross-specialty supporting providers to a few appointments
        care_team_pairs = [
            (AppointmentStatus.confirmed,  dr_miller.id,  "Dr. Miller added as supporting PT"),
            (AppointmentStatus.confirmed,  dr_roberts.id, "Dr. Roberts added as supporting Sports Med"),
        ]
        confirmed_appts = [a for a in appointments_made if a.status == AppointmentStatus.confirmed]
        for i, (_, supp_prov_id, desc) in enumerate(care_team_pairs):
            if i < len(confirmed_appts):
                target = confirmed_appts[i]
                # Don't add same provider as both scheduling and supporting
                if target:
                    slot = session.get(AppointmentSlot, target.slot_id)
                    if slot and slot.provider_id != supp_prov_id:
                        session.add(AppointmentProvider(
                            appointment_id=target.id,
                            provider_id=supp_prov_id,
                            role=CareTeamRole.supporting,
                            assigned_by=front_desk.id,
                        ))
                        session.add(AppointmentHistory(
                            appointment_id=target.id,
                            changed_by=front_desk.id,
                            event_type=HistoryEventType.supporting_provider_added,
                            new_value=str(supp_prov_id),
                            description=desc,
                        ))

        print(f"✓ Created care team entries")

        # ── Unconfirmed Alerts ────────────────────────────────────────────────
        requested_appts = [a for a in appointments_made if a.status == AppointmentStatus.requested]
        for appt in requested_appts:
            session.add(UnconfirmedAlert(appointment_id=appt.id))

        session.commit()
        print(f"✓ Created {len(requested_appts)} unconfirmed alerts")

        print("\n✅ Seed complete!")
        print("─" * 40)
        print("Demo credentials:")
        print("  Front Desk:  frontdesk@clinic.demo  / Demo1234!")
        print("  Dr. Smith:   dr.smith@clinic.demo   / Demo1234!  (Physical Therapy)")
        print("  Dr. Jones:   dr.jones@clinic.demo   / Demo1234!  (Dental)")
        print("  Dr. Miller:  dr.miller@clinic.demo  / Demo1234!  (Physical Therapy)")
        print("  Dr. Patel:   dr.patel@clinic.demo   / Demo1234!  (Cardiology)")
        print("  Dr. Nguyen:  dr.nguyen@clinic.demo  / Demo1234!  (Orthopedics)")
        print("  Dr. Okafor:  dr.okafor@clinic.demo  / Demo1234!  (General Medicine)")
        print("  Dr. Russo:   dr.russo@clinic.demo   / Demo1234!  (Dermatology)")
        print("  Dr. Kim:     dr.kim@clinic.demo     / Demo1234!  (Pediatrics)")
        print("  Dr. Hassan:  dr.hassan@clinic.demo  / Demo1234!  (Neurology)")
        print("  Dr. Roberts: dr.roberts@clinic.demo / Demo1234!  (Sports Medicine)")
        print(f"\n  Slots created:        {len(slots_created)}")
        print(f"  Appointments created: {len(appointments_made)}")


if __name__ == "__main__":
    seed()
