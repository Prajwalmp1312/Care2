from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from models import Base, Patient, Clinician, Admin
import bcrypt
import os
from dotenv import load_dotenv
import urllib.parse

# Load environment variables
load_dotenv()  # Load real .env file, not .env.example

# Get database credentials from environment
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = os.getenv("DB_PORT", "3306")
DB_USER = os.getenv("DB_USER", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")
DB_NAME = os.getenv("DB_NAME", "careconnect_pro")



# Build connection string
if DB_PASSWORD:
    safe_password = urllib.parse.quote_plus(DB_PASSWORD)
    DATABASE_URL = f"mysql+pymysql://{DB_USER}:{safe_password}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
else:
    DATABASE_URL = f"mysql+pymysql://{DB_USER}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

print(f"🔗 Connecting to: mysql+pymysql://{DB_USER}:***@{DB_HOST}:{DB_PORT}/{DB_NAME}")

# Create engine
engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def ensure_messages_is_edited_column():
    """Add messages.is_edited for existing MySQL databases (new installs get it from create_all)."""
    try:
        with engine.begin() as conn:
            row = conn.execute(
                text(
                    "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS "
                    "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'messages' "
                    "AND COLUMN_NAME = 'is_edited'"
                )
            ).fetchone()
            if row and row[0] == 0:
                conn.execute(
                    text(
                        "ALTER TABLE messages ADD COLUMN is_edited TINYINT(1) NOT NULL DEFAULT 0"
                    )
                )
                print("✅ Migration: added messages.is_edited")
    except Exception as e:
        err = str(e).lower()
        if "duplicate column" in err or "1060" in err:
            return
        print(f"⚠️ ensure_messages_is_edited_column: {e}")


def _column_exists(conn, table_name: str, column_name: str) -> bool:
    row = conn.execute(
        text(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS "
            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name "
            "AND COLUMN_NAME = :column_name"
        ),
        {"table_name": table_name, "column_name": column_name},
    ).fetchone()
    return bool(row and row[0] > 0)


def _add_column_if_missing(conn, table_name: str, column_name: str, ddl: str) -> None:
    if not _column_exists(conn, table_name, column_name):
        conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {ddl}"))
        print(f"✅ Migration: added {table_name}.{column_name}")


def _add_index_if_missing(conn, table_name: str, index_name: str, columns: str) -> None:
    row = conn.execute(
        text(
            "SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS "
            "WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table_name "
            "AND INDEX_NAME = :index_name"
        ),
        {"table_name": table_name, "index_name": index_name},
    ).fetchone()
    if not row or row[0] == 0:
        conn.execute(text(f"CREATE INDEX {index_name} ON {table_name} ({columns})"))
        print(f"Migration: added index {index_name}")


def ensure_existing_schema_columns():
    """Add columns that create_all() will not add to already-created MySQL tables."""
    try:
        with engine.begin() as conn:
            # Auth + reset columns for all account tables
            for table in ("patients", "clinicians", "admins"):
                _add_column_if_missing(conn, table, "email_verified", "email_verified TINYINT(1) NOT NULL DEFAULT 0")
                _add_column_if_missing(conn, table, "email_verification_code", "email_verification_code VARCHAR(10) NULL")
                _add_column_if_missing(conn, "patients", "gender", "gender VARCHAR(20) NULL")
                _add_column_if_missing(conn, "clinicians", "gender", "gender VARCHAR(20) NULL")
                _add_column_if_missing(conn, table, "email_verification_expires", "email_verification_expires DATETIME NULL")
                _add_column_if_missing(conn, table, "reset_password_token", "reset_password_token VARCHAR(255) NULL")
                _add_column_if_missing(conn, table, "reset_password_expires", "reset_password_expires DATETIME NULL")

            for column_name, ddl in (
                ("weight_kg", "weight_kg DOUBLE NULL"),
                ("height_cm", "height_cm DOUBLE NULL"),
                ("body_fat_percentage", "body_fat_percentage DOUBLE NULL"),
                ("muscle_mass_kg", "muscle_mass_kg DOUBLE NULL"),
                ("waist_cm", "waist_cm DOUBLE NULL"),
                ("systolic_bp", "systolic_bp INT NULL"),
                ("diastolic_bp", "diastolic_bp INT NULL"),
            ):
                _add_column_if_missing(conn, "patients", column_name, ddl)

            # Clinician approval columns
            _add_column_if_missing(conn, "clinicians", "approval_status", "approval_status VARCHAR(20) DEFAULT 'pending'")
            _add_column_if_missing(conn, "clinicians", "approved_by", "approved_by VARCHAR(100) NULL")
            _add_column_if_missing(conn, "clinicians", "approved_at", "approved_at DATETIME NULL")
            _add_column_if_missing(conn, "clinicians", "rejection_reason", "rejection_reason TEXT NULL")
            _add_column_if_missing(conn, "clinicians", "consultation_hours", "consultation_hours TEXT NULL")
            _add_column_if_missing(conn, "clinicians", "consultation_duration_minutes", "consultation_duration_minutes INT NOT NULL DEFAULT 15")

            # Message/file columns
            _add_column_if_missing(conn, "messages", "is_edited", "is_edited TINYINT(1) NOT NULL DEFAULT 0")
            _add_column_if_missing(conn, "messages", "prescription_id", "prescription_id INT NULL")
            _add_column_if_missing(conn, "chat_attachments", "message_id", "message_id INT NULL")

            # Appointment columns added after the initial schema release.
            # SQLAlchemy create_all() does not alter an existing table.
            _add_column_if_missing(conn, "appointments", "appointment_type", "appointment_type VARCHAR(50) NOT NULL DEFAULT 'phone_call'")
            _add_column_if_missing(conn, "appointments", "notes", "notes TEXT NULL")

            # Emergency-response operational ownership and escalation fields.
            for column_name, ddl in (
                ("escalation_level", "escalation_level INT NOT NULL DEFAULT 1"),
                ("owner_email", "owner_email VARCHAR(100) NULL"),
                ("owner_role", "owner_role VARCHAR(20) NULL"),
                ("ownership_assigned_at", "ownership_assigned_at DATETIME NULL"),
                ("operational_state", "operational_state VARCHAR(30) NOT NULL DEFAULT 'unassigned'"),
                ("last_monitored_at", "last_monitored_at DATETIME NULL"),
                ("next_review_at", "next_review_at DATETIME NULL"),
                ("escalation_deadline", "escalation_deadline DATETIME NULL"),
                ("consent_version", "consent_version VARCHAR(30) NULL"),
                ("consent_acknowledged", "consent_acknowledged TINYINT(1) NOT NULL DEFAULT 0"),
            ):
                _add_column_if_missing(conn, "emergency_alerts", column_name, ddl)
            _add_index_if_missing(conn, "emergency_alerts", "ix_emergency_alerts_owner_email", "owner_email")
            _add_index_if_missing(conn, "emergency_alerts", "ix_emergency_alerts_next_review_at", "next_review_at")
            _add_index_if_missing(conn, "emergency_alerts", "ix_emergency_alerts_escalation_deadline", "escalation_deadline")
            conn.execute(
                text(
                    "UPDATE emergency_alerts SET "
                    "operational_state = CASE "
                    "WHEN status = 'resolved' THEN 'resolved' "
                    "WHEN owner_email IS NOT NULL THEN 'owned' "
                    "ELSE 'unassigned' END, "
                    "last_monitored_at = COALESCE(last_monitored_at, updated_at, created_at, UTC_TIMESTAMP()), "
                    "next_review_at = CASE "
                    "WHEN status IN ('active', 'acknowledged') AND next_review_at IS NULL "
                    "THEN DATE_ADD(UTC_TIMESTAMP(), INTERVAL 5 MINUTE) "
                    "WHEN status = 'resolved' THEN NULL ELSE next_review_at END, "
                    "escalation_deadline = CASE "
                    "WHEN status IN ('active', 'acknowledged') AND escalation_deadline IS NULL "
                    "THEN DATE_ADD(UTC_TIMESTAMP(), INTERVAL 10 MINUTE) "
                    "ELSE escalation_deadline END"
                )
            )

            # Controlled clinical-document classification.
            _add_column_if_missing(conn, "medical_records", "category_code", "category_code VARCHAR(50) NOT NULL DEFAULT 'other'")
            _add_column_if_missing(conn, "medical_records", "tags", "tags TEXT NULL")
            _add_column_if_missing(conn, "medical_records", "source_date", "source_date VARCHAR(10) NULL")
            conn.execute(
                text(
                    "UPDATE medical_records SET category_code = CASE "
                    "WHEN LOWER(category) IN ('lab', 'lab results', 'laboratory', 'laboratory results') THEN 'laboratory' "
                    "WHEN LOWER(category) = 'imaging' THEN 'imaging' "
                    "WHEN LOWER(category) IN ('clinical notes', 'visit note') THEN 'visit_note' "
                    "WHEN LOWER(category) IN ('prescription', 'prescriptions') THEN 'prescription' "
                    "WHEN LOWER(category) IN ('vitals', 'vital signs') THEN 'vital_signs' "
                    "WHEN LOWER(category) IN ('discharge', 'discharge summary') THEN 'discharge_summary' "
                    "ELSE COALESCE(NULLIF(category_code, ''), 'other') END"
                )
            )
            _add_index_if_missing(conn, "medical_records", "ix_medical_records_category_code", "category_code")
            _add_index_if_missing(conn, "medical_records", "ix_medical_records_source_date", "source_date")
    except Exception as e:
        print(f"⚠️ ensure_existing_schema_columns: {e}")


def init_db():
    Base.metadata.create_all(bind=engine)
    ensure_messages_is_edited_column()
    ensure_existing_schema_columns()
    print("✅ Tables created/verified: patients, clinicians, admins, messages, medical_records")
    seed_default_admin()

def seed_default_admin():
    admin_email = os.getenv("DEFAULT_ADMIN_EMAIL", "").strip()
    admin_password = os.getenv("DEFAULT_ADMIN_PASSWORD", "").strip()
    admin_name = os.getenv("DEFAULT_ADMIN_NAME", "CareConnect Developer")

    if not admin_email or not admin_password:
        print("⚠️ Default admin seed skipped: missing DEFAULT_ADMIN_EMAIL or DEFAULT_ADMIN_PASSWORD")
        return

    db = SessionLocal()
    try:
        existing_admin = db.query(Admin).filter(Admin.email == admin_email).first()

        if existing_admin:
            updates_made = False

            if not existing_admin.email_verified:
                existing_admin.email_verified = True
                updates_made = True

            if not existing_admin.is_active:
                existing_admin.is_active = True
                updates_made = True

            if updates_made:
                db.commit()

            print(f"ℹ️ Default admin already exists: {admin_email}")
            return

        admin = Admin(
            name=admin_name,
            email=admin_email,
            hashed_password=bcrypt.hashpw(admin_password.encode("utf-8")[:72], bcrypt.gensalt()).decode("utf-8"),
            role="admin",
            is_active=True,
            email_verified=True,
            access_level="full"
        )

        db.add(admin)
        db.commit()
        print(f"✅ Default admin created: {admin_email}")
    finally:
        db.close()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Helper function to get user by email and role
def get_user_by_email_and_role(db, email: str, role: str):
    if role == "patient":
        return db.query(Patient).filter(Patient.email == email).first()
    elif role == "clinician":
        return db.query(Clinician).filter(Clinician.email == email).first()
    elif role == "admin":
        return db.query(Admin).filter(Admin.email == email).first()
    return None

# Helper function to check if email exists in any table
def email_exists(db, email: str):
    patient = db.query(Patient).filter(Patient.email == email).first()
    if patient:
        return True
    clinician = db.query(Clinician).filter(Clinician.email == email).first()
    if clinician:
        return True
    admin = db.query(Admin).filter(Admin.email == email).first()
    if admin:
        return True
    return False
