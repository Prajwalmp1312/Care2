from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text, Float, UniqueConstraint
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime, timezone


def utc_now():
    return datetime.now(timezone.utc).replace(tzinfo=None)

Base = declarative_base()

class Patient(Base):
    __tablename__ = "patients"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), default="patient")
    gender = Column(String(20), nullable=True)
    is_active = Column(Boolean, default=True)
    email_verified = Column(Boolean, default=False)
    email_verification_code = Column(String(10), nullable=True)
    email_verification_expires = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utc_now)
    
    # Patient-specific fields
    age = Column(Integer)
    blood_type = Column(String(5))
    phone = Column(String(20))
    address = Column(Text)
    emergency_contact = Column(String(100))
    last_visit = Column(DateTime)
    status = Column(String(20), default="stable")  # stable, attention, critical
    alerts = Column(Integer, default=0)
    weight_kg = Column(Float, nullable=True)
    height_cm = Column(Float, nullable=True)
    body_fat_percentage = Column(Float, nullable=True)
    muscle_mass_kg = Column(Float, nullable=True)
    waist_cm = Column(Float, nullable=True)
    systolic_bp = Column(Integer, nullable=True)
    diastolic_bp = Column(Integer, nullable=True)
    reset_password_token = Column(String(255), nullable=True)
    reset_password_expires = Column(DateTime, nullable=True)


class Clinician(Base):
    __tablename__ = "clinicians"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), default="clinician")
    gender = Column(String(20), nullable=True)
    is_active = Column(Boolean, default=True)
    email_verified = Column(Boolean, default=False)
    email_verification_code = Column(String(10), nullable=True)
    email_verification_expires = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utc_now)
    
    # Clinician-specific fields
    specialization = Column(String(100))
    license_number = Column(String(50))
    phone = Column(String(20))
    department = Column(String(100))
    years_of_experience = Column(Integer)
    consultation_hours = Column(Text, nullable=True)
    consultation_breaks = Column(Text, nullable=True)
    consultation_duration_minutes = Column(Integer, default=15)
    
    # Approval system fields (ADDED)
    approval_status = Column(String(20), default="pending")  # pending, approved, rejected
    approved_by = Column(String(100))  # admin email who approved
    approved_at = Column(DateTime)
    rejection_reason = Column(Text)
    reset_password_token = Column(String(255), nullable=True)
    reset_password_expires = Column(DateTime, nullable=True)


class Admin(Base):
    __tablename__ = "admins"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), default="admin")
    is_active = Column(Boolean, default=True)
    email_verified = Column(Boolean, default=False)
    email_verification_code = Column(String(10), nullable=True)
    email_verification_expires = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utc_now)
    
    # Admin-specific fields
    access_level = Column(String(20), default="full")  # full, limited
    department = Column(String(100))
    phone = Column(String(20))
    reset_password_token = Column(String(255), nullable=True)
    reset_password_expires = Column(DateTime, nullable=True)


class Message(Base):
    __tablename__ = "messages"
    
    id = Column(Integer, primary_key=True, index=True)
    sender_email = Column(String(100), nullable=False)
    sender_role = Column(String(20), nullable=False)
    recipient_email = Column(String(100), nullable=False)
    recipient_role = Column(String(20), nullable=False)
    message = Column(Text, nullable=False)
    sent_at = Column(DateTime, default=utc_now)
    read = Column(Boolean, default=False)
    is_edited = Column(Boolean, default=False)  # True after text was edited
    prescription_id = Column(Integer, ForeignKey("prescriptions.id"), nullable=True)


class PatientProfileHistory(Base):
    __tablename__ = "patient_profile_history"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    age = Column(Integer, nullable=True)
    gender = Column(String(20), nullable=True)
    blood_type = Column(String(5), nullable=True)
    phone = Column(String(20), nullable=True)
    address = Column(Text, nullable=True)
    emergency_contact = Column(String(100), nullable=True)
    status = Column(String(20), nullable=True)
    alerts = Column(Integer, nullable=True)
    weight_kg = Column(Float, nullable=True)
    height_cm = Column(Float, nullable=True)
    body_fat_percentage = Column(Float, nullable=True)
    muscle_mass_kg = Column(Float, nullable=True)
    waist_cm = Column(Float, nullable=True)
    systolic_bp = Column(Integer, nullable=True)
    diastolic_bp = Column(Integer, nullable=True)
    change_reason = Column(String(255), nullable=True)
    recorded_by = Column(String(100), nullable=False)
    recorded_at = Column(DateTime, default=utc_now, nullable=False)


class MedicalRecord(Base):
    __tablename__ = "medical_records"
    
    id = Column(Integer, primary_key=True, index=True)
    patient_email = Column(String(100), ForeignKey("patients.email"), nullable=False)
    type = Column(String(50), nullable=False)  # Lab Results, Clinical Notes, etc.
    name = Column(String(200), nullable=False)
    category = Column(String(50), nullable=False)
    category_code = Column(String(50), nullable=False, default="other", index=True)
    tags = Column(Text, nullable=True)  # JSON array of user-confirmed tags
    source_date = Column(String(10), nullable=True, index=True)  # YYYY-MM-DD
    file_path = Column(String(500))
    uploaded_at = Column(DateTime, default=utc_now)
    uploaded_by = Column(String(100))  # clinician email
    
    # NEW FIELDS FOR AI ANALYSIS
    analysis_summary = Column(Text)  # AI-generated summary
    extracted_text = Column(Text)  # Extracted text from document
    metrics_data = Column(Text)  # JSON string of extracted metrics (BP, HR, etc.)
    key_findings = Column(Text)  # JSON array of key findings

class MedicalRecordVersion(Base):
    __tablename__ = "medical_record_versions"

    id = Column(Integer, primary_key=True, index=True)

    record_id = Column(Integer, ForeignKey("medical_records.id"), nullable=False)

    patient_email = Column(String(100), ForeignKey("patients.email"), nullable=False)
    uploaded_by = Column(String(100), nullable=False)

    version_number = Column(Integer, nullable=False)

    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_type = Column(String(50), nullable=True)
    file_size = Column(Integer, nullable=True)

    change_notes = Column(Text, nullable=True)

    analysis_summary = Column(Text, nullable=True)
    extracted_text = Column(Text, nullable=True)
    metrics_data = Column(Text, nullable=True)
    key_findings = Column(Text, nullable=True)

    is_latest = Column(Boolean, default=True)

    uploaded_at = Column(DateTime, default=utc_now)

class Prescription(Base):
    __tablename__ = "prescriptions"

    id = Column(Integer, primary_key=True, index=True)

    patient_email = Column(String(100), ForeignKey("patients.email"), nullable=False)
    clinician_email = Column(String(100), ForeignKey("clinicians.email"), nullable=False)

    medicine_name = Column(String(200), nullable=False)
    dosage = Column(String(100), nullable=False)
    frequency = Column(String(100), nullable=False)
    duration = Column(String(100), nullable=False)

    instructions = Column(Text, nullable=True)
    diagnosis = Column(Text, nullable=True)

    status = Column(String(20), default="active")

    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

class MessageRequest(Base):
    __tablename__ = "message_requests"
    
    id = Column(Integer, primary_key=True, index=True)
    patient_email = Column(String(100), ForeignKey("patients.email"), nullable=False)
    clinician_email = Column(String(100), ForeignKey("clinicians.email"), nullable=False)
    status = Column(String(20), default="pending")  # pending, accepted, rejected
    requested_at = Column(DateTime, default=utc_now)
    responded_at = Column(DateTime)

class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)

    patient_email = Column(String(100), ForeignKey("patients.email"), nullable=False)
    clinician_email = Column(String(100), ForeignKey("clinicians.email"), nullable=False)

    appointment_date = Column(String(20), nullable=False)   # YYYY-MM-DD
    appointment_time = Column(String(20), nullable=False)   # HH:MM
    reason = Column(Text, nullable=False)

    status = Column(String(20), default="pending")
    # pending, approved, rejected, completed, cancelled

    appointment_type = Column(String(50), default="phone_call")

    notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)


class AppointmentReminder(Base):
    __tablename__ = "appointment_reminders"
    __table_args__ = (
        UniqueConstraint(
            "appointment_id",
            "reminder_type",
            name="uq_appointment_reminder_type",
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    appointment_id = Column(
        Integer,
        ForeignKey("appointments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    patient_email = Column(String(100), nullable=False, index=True)
    reminder_type = Column(String(20), nullable=False)
    scheduled_for = Column(DateTime, nullable=False, index=True)
    status = Column(String(20), nullable=False, default="scheduled", index=True)
    sent_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(
        DateTime,
        default=utc_now,
        onupdate=utc_now,
        nullable=False,
    )


class ChatAttachment(Base):
    __tablename__ = "chat_attachments"
    
    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("messages.id"), nullable=True)
    sender_email = Column(String(100), nullable=False)
    recipient_email = Column(String(100), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_type = Column(String(50))  # image, pdf, document, etc.
    file_size = Column(Integer)  # in bytes
    uploaded_at = Column(DateTime, default=utc_now)

class CrossConsultation(Base):
    __tablename__ = "cross_consultations"

    id = Column(Integer, primary_key=True, index=True)

    patient_email = Column(String(100), ForeignKey("patients.email"), nullable=False)
    requested_by_clinician_email = Column(String(100), ForeignKey("clinicians.email"), nullable=False)
    requested_to_clinician_email = Column(String(100), ForeignKey("clinicians.email"), nullable=False)

    reason = Column(Text, nullable=False)
    case_summary = Column(Text, nullable=True)

    # NEW: selected medical record ids attached to consult
    attached_record_ids = Column(Text, nullable=True)

    priority = Column(String(30), default="normal")
    status = Column(String(30), default="pending")

    response_notes = Column(Text, nullable=True)
    recommendation = Column(Text, nullable=True)

    # NEW: specialist final notes
    specialist_notes = Column(Text, nullable=True)

    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)
    completed_at = Column(DateTime, nullable=True)

class ClinicianJoinRequest(Base):
    __tablename__ = "clinician_join_requests"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(100), nullable=False)
    phone = Column(String(20))
    specialization = Column(String(100))
    license_number = Column(String(50))
    department = Column(String(100))
    years_of_experience = Column(Integer)
    
    # Request details
    message = Column(Text)  # Why they want to join
    resume_path = Column(String(500))  # Optional resume upload
    
    status = Column(String(20), default="pending")  # pending, approved, rejected
    requested_at = Column(DateTime, default=utc_now)
    reviewed_by = Column(String(100))  # admin email
    reviewed_at = Column(DateTime)
    rejection_reason = Column(Text)

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)

    user_email = Column(String(100), nullable=False, index=True)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)

    type = Column(String(50), default="info")
    # info, appointment, prescription, message, admin, alert

    is_read = Column(Boolean, default=False)

    created_at = Column(DateTime, default=utc_now)

class EmergencyAlert(Base):
    __tablename__ = "emergency_alerts"

    id = Column(Integer, primary_key=True, index=True)

    patient_email = Column(String(100), ForeignKey("patients.email"), nullable=False)
    patient_name = Column(String(150), nullable=True)

    alert_type = Column(String(50), default="medical_emergency")
    severity = Column(String(30), default="high")

    message = Column(Text, nullable=False)

    status = Column(String(30), default="active")
    acknowledged_by = Column(String(100), nullable=True)
    acknowledged_at = Column(DateTime, nullable=True)

    resolved_by = Column(String(100), nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    escalation_level = Column(Integer, default=1, nullable=False)
    owner_email = Column(String(100), nullable=True, index=True)
    owner_role = Column(String(20), nullable=True)
    ownership_assigned_at = Column(DateTime, nullable=True)
    operational_state = Column(String(30), default="unassigned", nullable=False)
    last_monitored_at = Column(DateTime, nullable=True)
    next_review_at = Column(DateTime, nullable=True, index=True)
    escalation_deadline = Column(DateTime, nullable=True, index=True)
    consent_version = Column(String(30), nullable=True)
    consent_acknowledged = Column(Boolean, default=False, nullable=False)

    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)


class EmergencyAlertEvent(Base):
    __tablename__ = "emergency_alert_events"

    id = Column(Integer, primary_key=True, index=True)
    alert_id = Column(
        Integer,
        ForeignKey("emergency_alerts.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    event_type = Column(String(40), nullable=False, index=True)
    actor_email = Column(String(100), nullable=True)
    actor_role = Column(String(20), nullable=True)
    escalation_level = Column(Integer, nullable=False, default=1)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False, index=True)


class UserConsent(Base):
    __tablename__ = "user_consents"
    __table_args__ = (
        UniqueConstraint("user_email", "consent_type", name="uq_user_consent_type"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_email = Column(String(100), nullable=False, index=True)
    user_role = Column(String(20), nullable=False)
    consent_type = Column(String(40), nullable=False, index=True)
    consent_version = Column(String(30), nullable=False)
    status = Column(String(20), nullable=False, default="accepted")
    accepted_at = Column(DateTime, nullable=False, default=utc_now)
    revoked_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, nullable=False, default=utc_now, onupdate=utc_now)


class VideoConsultationEvent(Base):
    __tablename__ = "video_consultation_events"

    id = Column(Integer, primary_key=True, index=True)
    appointment_id = Column(
        Integer,
        ForeignKey("appointments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    actor_email = Column(String(100), nullable=False, index=True)
    actor_role = Column(String(20), nullable=False)
    event_type = Column(String(40), nullable=False, index=True)
    provider = Column(String(50), nullable=False, default="comm360")
    created_at = Column(DateTime, default=utc_now, nullable=False, index=True)

class AdminAuditLog(Base):
    __tablename__ = "admin_audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    admin_email = Column(String(100), nullable=False)
    action = Column(String(100), nullable=False)  # e.g., "approved_clinician", "rejected_request"
    target_email = Column(String(100))  # Email of affected user
    details = Column(Text)  # JSON string with additional details
    timestamp = Column(DateTime, default=utc_now)


class UserSession(Base):
    """Revocable server-side session backing each access token."""

    __tablename__ = "user_sessions"

    id = Column(Integer, primary_key=True, index=True)
    jti = Column(String(64), unique=True, nullable=False, index=True)
    user_email = Column(String(100), nullable=False, index=True)
    user_role = Column(String(20), nullable=False, index=True)
    user_agent = Column(String(500), nullable=True)
    ip_address = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)
    expires_at = Column(DateTime, nullable=False, index=True)
    last_seen_at = Column(DateTime, default=utc_now, nullable=False)
    revoked_at = Column(DateTime, nullable=True, index=True)
    revoke_reason = Column(String(255), nullable=True)


class AccountDeletionRequest(Base):
    """Auditable privacy request separated from legally retained care records."""

    __tablename__ = "account_deletion_requests"

    id = Column(Integer, primary_key=True, index=True)
    user_email = Column(String(100), nullable=False, index=True)
    user_role = Column(String(20), nullable=False, index=True)
    status = Column(String(30), nullable=False, default="pending", index=True)
    requested_at = Column(DateTime, default=utc_now, nullable=False, index=True)
    scheduled_for = Column(DateTime, nullable=False, index=True)
    completed_at = Column(DateTime, nullable=True)
    retention_notice = Column(Text, nullable=False)
    request_ip = Column(String(64), nullable=True)


class SecurityAuditEvent(Base):
    """General, append-oriented security and clinical access audit stream."""

    __tablename__ = "security_audit_events"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(String(64), nullable=True, index=True)
    actor_email = Column(String(100), nullable=True, index=True)
    actor_role = Column(String(20), nullable=True, index=True)
    action = Column(String(120), nullable=False, index=True)
    resource_type = Column(String(80), nullable=True, index=True)
    resource_id = Column(String(120), nullable=True)
    patient_email = Column(String(100), nullable=True, index=True)
    outcome = Column(String(20), nullable=False, default="success", index=True)
    ip_address = Column(String(64), nullable=True)
    details = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False, index=True)
