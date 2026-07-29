from fastapi import FastAPI, HTTPException, Depends, status, UploadFile, File, Form, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, EmailStr
from typing import Optional, Dict, Any, List, Set
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
import asyncio
import bcrypt
from jose import JWTError, jwt
from dotenv import load_dotenv
load_dotenv()
from google.oauth2 import id_token
from google.auth.transport import requests
import secrets
import hashlib
import csv
import io
from urllib.parse import urlparse, urlunparse
# from email_service import send_reset_email, send_verification_code

from document_text_extractor import extract_text_from_path
from ai_summary_service import generate_document_summary
import traceback
import uvicorn
from sqlalchemy.orm import Session
import os
from fastapi.responses import JSONResponse, Response
import re
from sqlalchemy import or_, text
import fitz  # PyMuPDF for reading PDF text
from models import MessageRequest as MessageRequestModel
from database import SessionLocal
from database import get_db, init_db, get_user_by_email_and_role, email_exists
from models import Patient as PatientModel, Clinician as ClinicianModel, Admin as AdminModel, Appointment as AppointmentModel, Prescription as PrescriptionModel, Notification as NotificationModel, MedicalRecordVersion as RecordVersionModel, PatientProfileHistory as PatientProfileHistoryModel, EmergencyAlert as EmergencyAlertModel, EmergencyAlertEvent as EmergencyAlertEventModel, UserConsent as UserConsentModel, VideoConsultationEvent as VideoConsultationEventModel, UserSession as UserSessionModel, SecurityAuditEvent as SecurityAuditEventModel
from models import Message as MessageModel, MedicalRecord as RecordModel
import mimetypes
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from models import ChatAttachment as ChatAttachmentModel
from PIL import Image
import pytesseract
from medical_analysis import MedicalRecordAnalyzer, generate_health_summary
import json
import logging
from rag_service import index_record, retrieve_relevant_chunks, delete_record_chunks
from nutrition_integration import build_nutrition_router
from meal_planner import build_meal_planner_router, init_meal_planner_schema
from clinical_organization import (
    CATEGORY_BY_CODE,
    RECORD_CATEGORIES,
    normalize_category,
    normalize_tags,
    parse_iso_date,
)
from security_foundation import (
    CHAT_UPLOAD_EXTENSIONS,
    MEDICAL_UPLOAD_EXTENSIONS,
    InMemoryRateLimiter,
    RateLimitRule,
    configured_upload_root,
    read_validated_upload,
    store_upload,
)

try:
    import google.generativeai as genai
except (ImportError, TypeError) as exc:
    # Gemini is optional. Some dependency combinations (notably protobuf on
    # unsupported Python versions) can fail while the module is being imported.
    # Keep the API available and let the existing rule-based responses handle it.
    genai = None
    logging.getLogger(__name__).warning("Gemini support is unavailable: %s", exc)

def validate_password(password: str):
    if len(password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters"
        )

    if not re.search(r"[A-Z]", password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must contain an uppercase letter"
        )

    if not re.search(r"[a-z]", password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must contain a lowercase letter"
        )

    if not re.search(r"[0-9]", password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must contain a number"
        )

    if not re.search(r"[!@#$%^&*]", password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must contain a special character"
        )
    if len(password.encode("utf-8")) > 72:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password is too long",
        )

# Configuration
SECRET_KEY = os.getenv("SECRET_KEY", "your-super-secret-key-change-this")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development").strip().lower()
JWT_ISSUER = os.getenv("JWT_ISSUER", "careconnect-api")
JWT_AUDIENCE = os.getenv("JWT_AUDIENCE", "careconnect-web")
REQUIRE_EMAIL_VERIFICATION = os.getenv("REQUIRE_EMAIL_VERIFICATION", "false").lower() == "true"
TRUST_PROXY_HEADERS = os.getenv("TRUST_PROXY_HEADERS", "false").lower() == "true"
MEDICAL_UPLOAD_MAX_BYTES = int(os.getenv("MEDICAL_UPLOAD_MAX_MB", "20")) * 1024 * 1024
CHAT_UPLOAD_MAX_BYTES = int(os.getenv("CHAT_UPLOAD_MAX_MB", "10")) * 1024 * 1024
UPLOAD_STORAGE_ROOT = configured_upload_root(__file__)
APPOINTMENT_TIMEZONE_NAME = os.getenv(
    "APPOINTMENT_TIMEZONE",
    "America/Los_Angeles",
).strip()
try:
    APPOINTMENT_TIMEZONE = ZoneInfo(APPOINTMENT_TIMEZONE_NAME)
except ZoneInfoNotFoundError as exc:
    if ENVIRONMENT == "production":
        raise RuntimeError(
            f"Invalid APPOINTMENT_TIMEZONE: {APPOINTMENT_TIMEZONE_NAME}"
        ) from exc
    logging.getLogger(__name__).warning(
        "Unknown APPOINTMENT_TIMEZONE %s; falling back to UTC",
        APPOINTMENT_TIMEZONE_NAME,
    )
    APPOINTMENT_TIMEZONE_NAME = "UTC"
    APPOINTMENT_TIMEZONE = timezone.utc

def _configured_comm360_url() -> str:
    raw_url = os.getenv(
        "COMM360_BASE_URL",
        "https://comm360.feeltiptop.com/",
    ).strip()
    parsed = urlparse(raw_url)
    if (
        parsed.scheme not in {"http", "https"}
        or not parsed.netloc
        or parsed.username
        or parsed.password
        or parsed.params
        or parsed.query
        or parsed.fragment
    ):
        raise RuntimeError(
            "COMM360_BASE_URL must be an absolute root URL without credentials, "
            "query parameters, or a fragment"
        )
    if ENVIRONMENT == "production" and parsed.scheme != "https":
        raise RuntimeError("COMM360_BASE_URL must use HTTPS in production")
    normalized_path = f"{parsed.path.rstrip('/')}/"
    return urlunparse(
        (parsed.scheme, parsed.netloc, normalized_path, "", "", "")
    )


COMM360_BASE_URL = _configured_comm360_url()
CONSENT_DEFINITIONS = {
    "video_consultation": {
        "version": "2026-07",
        "title": "Video consultation consent",
        "disclosures": [
            "Comm360 is an external meeting provider with its own terms and privacy practices.",
            "CareConnect will not place medical details or patient identifiers in the launch URL.",
            "Camera and microphone permissions are controlled in Comm360.",
            "Video consultation is not an emergency service.",
        ],
    },
    "emergency_alert": {
        "version": "2026-07",
        "title": "SOS alert consent",
        "disclosures": [
            "SOS notifies connected CareConnect clinicians and administrators; it does not automatically dispatch emergency services.",
            "For an immediate or life-threatening emergency, contact local emergency services directly.",
            "Response times can vary and the alert remains monitored until a staff owner resolves it.",
        ],
    },
}

if SECRET_KEY == "your-super-secret-key-change-this":
    if ENVIRONMENT == "production":
        raise RuntimeError("SECRET_KEY must be configured before starting in production")
    logging.getLogger(__name__).warning(
        "Development SECRET_KEY is in use. Configure a random SECRET_KEY before deployment."
    )

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")
USE_GEMINI_HEALTH_TIPS = os.getenv("USE_GEMINI_HEALTH_TIPS", "false").lower() == "true"
# Initialize FastAPI app
app = FastAPI(title="CareConnect Pro API")
rate_limiter = InMemoryRateLimiter()

RATE_LIMIT_RULES = {
    ("POST", "/api/auth/login"): RateLimitRule(10, 60),
    ("POST", "/api/auth/google"): RateLimitRule(10, 60),
    ("POST", "/api/auth/forgot-password"): RateLimitRule(5, 300),
    ("POST", "/api/auth/reset-password"): RateLimitRule(10, 300),
    ("POST", "/api/records/upload"): RateLimitRule(20, 60),
    ("POST", "/api/chat/upload"): RateLimitRule(30, 60),
    ("POST", "/api/emergency-alerts"): RateLimitRule(6, 60),
}

AUDITED_READ_PREFIXES = (
    "/api/records",
    "/api/patients",
    "/api/profile",
    "/api/prescriptions",
    "/api/clinical/search",
    "/api/chat/download",
    "/api/exports",
)


def _request_ip(request: Request) -> str:
    if TRUST_PROXY_HEADERS:
        forwarded = request.headers.get("x-forwarded-for", "")
        if forwarded:
            return forwarded.split(",", 1)[0].strip()[:64]
    return (request.client.host if request.client else "unknown")[:64]


def _audit_actor_from_request(request: Request) -> tuple[Optional[str], Optional[str]]:
    authorization = request.headers.get("authorization", "")
    if not authorization.lower().startswith("bearer "):
        return None, None
    try:
        payload = jwt.decode(
            authorization.split(" ", 1)[1],
            SECRET_KEY,
            algorithms=[ALGORITHM],
            audience=JWT_AUDIENCE,
            issuer=JWT_ISSUER,
        )
        return payload.get("sub"), payload.get("role")
    except JWTError:
        return None, None


@app.middleware("http")
async def security_foundation_middleware(request: Request, call_next):
    """Rate-limit sensitive routes, attach hardening headers, and audit access."""

    request_id = request.headers.get("x-request-id") or secrets.token_hex(16)
    request.state.request_id = request_id
    client_ip = _request_ip(request)
    specific_rule = RATE_LIMIT_RULES.get((request.method.upper(), request.url.path))
    rule = specific_rule
    if not rule and request.url.path.startswith("/api/"):
        rule = RateLimitRule(240, 60)

    if rule:
        rate_scope = request.url.path if specific_rule else "api-global"
        allowed, retry_after = rate_limiter.check(
            f"{client_ip}:{request.method.upper()}:{rate_scope}",
            rule,
        )
        if not allowed:
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please try again shortly."},
                headers={"Retry-After": str(retry_after), "X-Request-ID": request_id},
            )

    response = None
    unexpected_error = None
    try:
        response = await call_next(request)
        return response
    except Exception as exc:
        unexpected_error = exc
        raise
    finally:
        status_code = response.status_code if response is not None else 500
        if response is not None:
            response.headers["X-Request-ID"] = request_id
            response.headers["X-Content-Type-Options"] = "nosniff"
            response.headers["X-Frame-Options"] = "DENY"
            response.headers["Referrer-Policy"] = "no-referrer"
            response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
            if request.url.path.startswith("/api/"):
                response.headers["Cache-Control"] = "no-store"
            if request.url.scheme == "https":
                response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        should_audit = (
            request.url.path.startswith("/api/")
            and (
                request.method.upper() in {"POST", "PUT", "PATCH", "DELETE"}
                or any(request.url.path.startswith(prefix) for prefix in AUDITED_READ_PREFIXES)
            )
        )
        if should_audit:
            actor_email, actor_role = _audit_actor_from_request(request)
            try:
                audit_db = SessionLocal()
                audit_db.add(
                    SecurityAuditEventModel(
                        request_id=request_id,
                        actor_email=actor_email,
                        actor_role=actor_role,
                        action=f"{request.method.upper()} {request.url.path}"[:120],
                        resource_type=(
                            request.url.path.strip("/").split("/")[1]
                            if len(request.url.path.strip("/").split("/")) > 1
                            else "api"
                        )[:80],
                        resource_id=request.url.path[:120],
                        outcome="success" if status_code < 400 else "denied" if status_code in {401, 403} else "failure",
                        ip_address=client_ip,
                        details=json.dumps(
                            {
                                "status_code": status_code,
                                "unexpected_error": type(unexpected_error).__name__ if unexpected_error else None,
                            }
                        ),
                    )
                )
                audit_db.commit()
            except Exception:
                logging.getLogger(__name__).exception("Failed to write security audit event")
            finally:
                if "audit_db" in locals():
                    audit_db.close()

medical_analyzer = MedicalRecordAnalyzer()

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

if GEMINI_API_KEY and genai is not None:
    genai.configure(api_key=GEMINI_API_KEY)
    gemini_model = genai.GenerativeModel('gemini-2.5-flash')
else:
    gemini_model = None
    if not GEMINI_API_KEY:
        logging.getLogger(__name__).warning(
            "GEMINI_API_KEY not found. Chatbot will use fallback responses."
        )

# Add CORS middleware BEFORE registering startup events / routes
allowed_origins = {
    FRONTEND_URL,
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
}
allowed_origins.update(
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=sorted(allowed_origins),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["*"],
    max_age=3600,
)

# Initialize the database and the in-process escalation monitor on startup.
emergency_monitor_task = None


async def emergency_monitor_loop():
    while True:
        await asyncio.sleep(15)
        monitor_db = SessionLocal()
        try:
            _apply_due_emergency_escalations(monitor_db)
        except asyncio.CancelledError:
            raise
        except Exception:
            monitor_db.rollback()
            logging.getLogger(__name__).exception(
                "Emergency escalation monitor failed"
            )
        finally:
            monitor_db.close()


@app.on_event("startup")
async def startup_event():
    global emergency_monitor_task
    init_db()
    ensure_prescription_multi_medicine_column()
    init_meal_planner_schema()
    emergency_monitor_task = asyncio.create_task(emergency_monitor_loop())


@app.on_event("shutdown")
async def shutdown_event():
    global emergency_monitor_task
    if emergency_monitor_task:
        emergency_monitor_task.cancel()
        try:
            await emergency_monitor_task
        except asyncio.CancelledError:
            pass
        emergency_monitor_task = None

# Pydantic Models
class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str
    gender: Optional[str] = None
    specialization:Optional[str] = None
    department:Optional[str] = None
    years_of_experience:Optional[int] = None

class UserLogin(BaseModel):
    email: str
    password: str

class VerifyEmailRequest(BaseModel):
    email: EmailStr
    code: str

class User(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: str
    is_active: bool = True

class Token(BaseModel):
    access_token: str
    token_type: str
    user: dict
    expires_at: Optional[str] = None
    session_id: Optional[int] = None

class RegisterResponse(BaseModel):
    message: str
    email: EmailStr
    role: str

class GoogleAuthRequest(BaseModel):
    token: str
    role: str
class AppointmentCreate(BaseModel):
    clinician_email: EmailStr
    appointment_date: str
    appointment_time: str
    appointment_type:str="phone_call"
    reason: str


class AppointmentStatusUpdate(BaseModel):
    status: str
    notes: Optional[str] = None


class AppointmentNotesUpdate(BaseModel):
    notes: str


class ClinicianAvailabilityUpdate(BaseModel):
    consultation_hours: Dict[str, List[Dict[str, str]]]
    consultation_duration_minutes: int = 15

class PrescriptionMedicine(BaseModel):
    medicine_name: str
    dosage: str
    frequency: str
    duration: str
    instructions: Optional[str] = ""

class PrescriptionCreate(BaseModel):
    patient_email: EmailStr

    # New multi-medicine payload from Prescriptions.jsx
    medicines: Optional[List[PrescriptionMedicine]] = None

    # Backward-compatible single-medicine fields
    medicine_name: Optional[str] = None
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    duration: Optional[str] = None

    diagnosis: Optional[str] = ""
    instructions: Optional[str] = ""

class PrescriptionStatusUpdate(BaseModel):
    status: str

class NotificationCreate(BaseModel):
    user_email: EmailStr
    title: str
    message: str
    type: Optional[str] = "info"
    
class NotificationReadUpdate(BaseModel):
    is_read: bool = True

class RecordVersionCreate(BaseModel):
    change_notes:Optional[str]=None

class RecordVersionResponse(BaseModel):
    id: int
    record_id:int
    version_number:int
    file_name:str
    file_type:Optional[str]=None
    file_size:Optional[str]=None
    change_notes:Optional[str]=None
    is_latest:bool
    uploaded_by:str
    uploaded_at:Optional[str]=None

class ReportComparisonRequest(BaseModel):
    first_record_id: int
    second_record_id: int

class EmergencyAlertCreate(BaseModel):
    alert_type: Optional[str] = "medical_emergency"
    severity: Optional[str] = "high"
    message: str


class EmergencyAlertStatusUpdate(BaseModel):
    status: str


class ConsentAcceptRequest(BaseModel):
    accepted: bool
    consent_version: Optional[str] = None


class EmergencyAlertNoteRequest(BaseModel):
    notes: str


class EmergencyAlertEscalationRequest(BaseModel):
    reason: str

# Helper Functions
def _password_bytes(password: str) -> bytes:
    # bcrypt only uses the first 72 bytes. passlib truncated silently,
    # so we do the same to stay compatible with existing stored hashes.
    return password.encode("utf-8")[:72]

def verify_password(plain_password, hashed_password):
    if not plain_password or not hashed_password:
        # e.g. Google OAuth accounts with no local password set
        return False
    try:
        return bcrypt.checkpw(_password_bytes(plain_password), hashed_password.encode("utf-8"))
    except (ValueError, TypeError):
        # Malformed/legacy hash in the DB -> failed login, not a 500
        return False

def get_password_hash(password):
    return bcrypt.hashpw(_password_bytes(password), bcrypt.gensalt()).decode("utf-8")

def create_access_token(data: dict, *, jti: str, expires_at: datetime):
    to_encode = data.copy()
    now = datetime.utcnow()
    to_encode.update(
        {
            "exp": expires_at,
            "iat": now,
            "nbf": now,
            "jti": jti,
            "iss": JWT_ISSUER,
            "aud": JWT_AUDIENCE,
        }
    )
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_user_session_token(user, db: Session, request: Request) -> tuple[str, UserSessionModel]:
    expires_at = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    jti = secrets.token_urlsafe(32)
    now = datetime.utcnow()

    # Keep the active-session set bounded per account. Expired rows remain as
    # audit history; the oldest live session is revoked when the cap is reached.
    active_sessions = db.query(UserSessionModel).filter(
        UserSessionModel.user_email == user.email,
        UserSessionModel.user_role == user.role,
        UserSessionModel.revoked_at.is_(None),
        UserSessionModel.expires_at > now,
    ).order_by(UserSessionModel.last_seen_at.asc()).all()
    for stale_session in active_sessions[: max(0, len(active_sessions) - 9)]:
        stale_session.revoked_at = now
        stale_session.revoke_reason = "session_limit"

    session = UserSessionModel(
        jti=jti,
        user_email=user.email,
        user_role=user.role,
        user_agent=(request.headers.get("user-agent") or "Unknown device")[:500],
        ip_address=_request_ip(request),
        expires_at=expires_at,
        last_seen_at=now,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    token = create_access_token(
        {"sub": user.email, "role": user.role, "sid": session.id},
        jti=jti,
        expires_at=expires_at,
    )
    return token, session


def revoke_all_user_sessions(
    db: Session,
    *,
    user_email: str,
    user_role: str,
    reason: str,
) -> int:
    return db.query(UserSessionModel).filter(
        UserSessionModel.user_email == user_email,
        UserSessionModel.user_role == user_role,
        UserSessionModel.revoked_at.is_(None),
    ).update(
        {
            UserSessionModel.revoked_at: datetime.utcnow(),
            UserSessionModel.revoke_reason: reason[:255],
        },
        synchronize_session=False,
    )

# def generate_verification_code() -> str:
#     return f"{secrets.randbelow(1000000):06d}"

async def get_current_user(
    request: Request,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
            audience=JWT_AUDIENCE,
            issuer=JWT_ISSUER,
        )
        email: str = payload.get("sub")
        role: str = payload.get("role")
        jti: str = payload.get("jti")
        if email is None or role is None or jti is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    session = db.query(UserSessionModel).filter(
        UserSessionModel.jti == jti,
        UserSessionModel.user_email == email,
        UserSessionModel.user_role == role,
    ).first()
    now = datetime.utcnow()
    if (
        session is None
        or session.revoked_at is not None
        or session.expires_at <= now
    ):
        raise credentials_exception

    user = get_user_by_email_and_role(db, email, role)
    if user is None or not getattr(user, "is_active", True):
        raise credentials_exception
    if REQUIRE_EMAIL_VERIFICATION and not getattr(user, "email_verified", False):
        raise HTTPException(status_code=403, detail="Email verification is required")
    if role == "clinician" and getattr(user, "approval_status", None) != "approved":
        raise HTTPException(status_code=403, detail="Clinician account is not approved")

    if not session.last_seen_at or session.last_seen_at < now - timedelta(minutes=5):
        session.last_seen_at = now
        db.commit()

    request.state.session_jti = jti
    request.state.session_id = session.id
    request.state.current_user_email = email
    request.state.current_user_role = role
    return user


def connected_patient_emails(db: Session, clinician_email: str) -> Set[str]:
    rows = db.query(MessageRequestModel.patient_email).filter(
        MessageRequestModel.clinician_email == clinician_email,
        MessageRequestModel.status == "accepted",
    ).all()
    return {row[0] for row in rows}


def accessible_patient_emails(db: Session, current_user) -> Optional[Set[str]]:
    if current_user.role == "patient":
        return {current_user.email}
    if current_user.role == "clinician":
        return connected_patient_emails(db, current_user.email)
    if current_user.role == "admin":
        return None
    return set()


def require_patient_access(db: Session, current_user, patient_email: str) -> None:
    allowed = accessible_patient_emails(db, current_user)
    if allowed is not None and patient_email not in allowed:
        raise HTTPException(status_code=403, detail="You do not have access to this patient")


app.include_router(build_nutrition_router(get_current_user))
app.include_router(build_meal_planner_router(get_current_user, gemini_model))
app.mount(
    "/uploads/meal-planner",
    StaticFiles(directory=os.path.join(os.path.dirname(__file__), "uploads", "meal-planner")),
    name="meal-planner-uploads",
)

def create_notification(
    db: Session,
    user_email: str,
    title: str,
    message: str,
    notification_type: str = "info"
):
    notification = NotificationModel(
        user_email=user_email,
        title=title,
        message=message,
        type=notification_type,
        is_read=False
    )

    db.add(notification)
    db.commit()
    db.refresh(notification)

    return notification


def _active_consent(
    db: Session,
    *,
    user_email: str,
    consent_type: str,
) -> Optional[UserConsentModel]:
    definition = CONSENT_DEFINITIONS.get(consent_type)
    if not definition:
        return None
    return db.query(UserConsentModel).filter(
        UserConsentModel.user_email == user_email,
        UserConsentModel.consent_type == consent_type,
        UserConsentModel.status == "accepted",
        UserConsentModel.consent_version == definition["version"],
        UserConsentModel.revoked_at.is_(None),
    ).first()


def _consent_response(
    db: Session,
    *,
    current_user,
    consent_type: str,
) -> dict:
    definition = CONSENT_DEFINITIONS.get(consent_type)
    if not definition:
        raise HTTPException(status_code=404, detail="Consent type not found")
    consent = _active_consent(
        db,
        user_email=current_user.email,
        consent_type=consent_type,
    )
    return {
        "consent_type": consent_type,
        "title": definition["title"],
        "version": definition["version"],
        "disclosures": definition["disclosures"],
        "accepted": bool(consent),
        "accepted_at": (
            consent.accepted_at.isoformat() if consent and consent.accepted_at else None
        ),
    }


@app.get("/api/consents/{consent_type}")
async def get_consent_status(
    consent_type: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if consent_type == "emergency_alert" and current_user.role != "patient":
        raise HTTPException(
            status_code=403,
            detail="SOS consent is available only to patients",
        )
    if consent_type == "video_consultation" and current_user.role not in [
        "patient",
        "clinician",
    ]:
        raise HTTPException(
            status_code=403,
            detail="Video consent is available to consultation participants",
        )
    return _consent_response(
        db,
        current_user=current_user,
        consent_type=consent_type,
    )


@app.post("/api/consents/{consent_type}")
async def accept_consent(
    consent_type: str,
    consent_data: ConsentAcceptRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    definition = CONSENT_DEFINITIONS.get(consent_type)
    if not definition:
        raise HTTPException(status_code=404, detail="Consent type not found")
    if not consent_data.accepted:
        raise HTTPException(
            status_code=400,
            detail="Consent must be explicitly accepted",
        )
    if consent_data.consent_version not in [None, definition["version"]]:
        raise HTTPException(
            status_code=409,
            detail="The consent disclosure has changed. Review the current version.",
        )
    if consent_type == "emergency_alert" and current_user.role != "patient":
        raise HTTPException(status_code=403, detail="Only patients can accept SOS consent")
    if consent_type == "video_consultation" and current_user.role not in [
        "patient",
        "clinician",
    ]:
        raise HTTPException(status_code=403, detail="Not a consultation participant")

    now = datetime.utcnow()
    consent = db.query(UserConsentModel).filter(
        UserConsentModel.user_email == current_user.email,
        UserConsentModel.consent_type == consent_type,
    ).first()
    if consent:
        consent.user_role = current_user.role
        consent.consent_version = definition["version"]
        consent.status = "accepted"
        consent.accepted_at = now
        consent.revoked_at = None
        consent.updated_at = now
    else:
        consent = UserConsentModel(
            user_email=current_user.email,
            user_role=current_user.role,
            consent_type=consent_type,
            consent_version=definition["version"],
            status="accepted",
            accepted_at=now,
        )
        db.add(consent)
    db.commit()
    return _consent_response(
        db,
        current_user=current_user,
        consent_type=consent_type,
    )


@app.delete("/api/consents/{consent_type}")
async def revoke_consent(
    consent_type: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    consent = db.query(UserConsentModel).filter(
        UserConsentModel.user_email == current_user.email,
        UserConsentModel.consent_type == consent_type,
        UserConsentModel.status == "accepted",
    ).first()
    if not consent:
        return {"message": "No active consent was found"}
    consent.status = "revoked"
    consent.revoked_at = datetime.utcnow()
    db.commit()
    return {"message": "Consent revoked", "consent_type": consent_type}

def get_connected_clinician_emails_for_patient(db: Session, patient_email: str):
    connections = db.query(MessageRequestModel).filter(
        MessageRequestModel.patient_email == patient_email,
        MessageRequestModel.status == "accepted"
    ).all()

    clinician_emails = []

    for connection in connections:
        if connection.clinician_email:
            clinician_emails.append(connection.clinician_email)

    return clinician_emails


def notify_emergency_alert_receivers(db: Session, alert: EmergencyAlertModel):
    # Confirm the SOS in the patient's dashboard notification stream. Patients
    # do not need the staff-facing emergency alert management screen.
    create_notification(
        db=db,
        user_email=alert.patient_email,
        title="SOS sent",
        message="Your SOS was sent to your connected care team and administrators.",
        notification_type="emergency"
    )

    # Notify connected clinicians
    clinician_emails = get_connected_clinician_emails_for_patient(
        db=db,
        patient_email=alert.patient_email
    )

    for clinician_email in clinician_emails:
        create_notification(
            db=db,
            user_email=clinician_email,
            title="Emergency Alert",
            message=f"{alert.patient_name or alert.patient_email} triggered an emergency alert: {alert.message}",
            notification_type="emergency"
        )

    # Notify all admins
    admins = db.query(AdminModel).all()

    for admin in admins:
        create_notification(
            db=db,
            user_email=admin.email,
            title="Emergency Alert",
            message=f"{alert.patient_name or alert.patient_email} triggered an emergency alert: {alert.message}",
            notification_type="emergency"
        )

PATIENT_MEASUREMENT_FIELDS = (
    "weight_kg", "height_cm", "body_fat_percentage", "muscle_mass_kg",
    "waist_cm", "systolic_bp", "diastolic_bp",
)

def _patient_profile_payload(patient) -> dict:
    payload = {
        "id": patient.id,
        "name": patient.name,
        "email": patient.email,
        "age": patient.age,
        "gender": patient.gender,
        "blood_type": patient.blood_type,
        "phone": patient.phone,
        "address": patient.address,
        "emergency_contact": patient.emergency_contact,
        "status": patient.status,
        "alerts": patient.alerts,
        "last_visit": patient.last_visit.isoformat() if patient.last_visit else None,
        "created_at": patient.created_at.isoformat() if patient.created_at else None,
        "is_active": patient.is_active,
    }
    payload.update({field: getattr(patient, field, None) for field in PATIENT_MEASUREMENT_FIELDS})
    height_m = (patient.height_cm or 0) / 100
    payload["bmi"] = round(patient.weight_kg / (height_m * height_m), 1) if patient.weight_kg and height_m else None
    return payload

def _snapshot_patient_profile(db: Session, patient, recorded_by: str, reason: str = "Profile updated"):
    snapshot = PatientProfileHistoryModel(
        patient_id=patient.id,
        name=patient.name,
        age=patient.age,
        gender=patient.gender,
        blood_type=patient.blood_type,
        phone=patient.phone,
        address=patient.address,
        emergency_contact=patient.emergency_contact,
        status=patient.status,
        alerts=patient.alerts,
        weight_kg=patient.weight_kg,
        height_cm=patient.height_cm,
        body_fat_percentage=patient.body_fat_percentage,
        muscle_mass_kg=patient.muscle_mass_kg,
        waist_cm=patient.waist_cm,
        systolic_bp=patient.systolic_bp,
        diastolic_bp=patient.diastolic_bp,
        change_reason=reason,
        recorded_by=recorded_by,
    )
    db.add(snapshot)

def _history_payload(entry) -> dict:
    data = {field: getattr(entry, field, None) for field in PATIENT_MEASUREMENT_FIELDS}
    height_m = (entry.height_cm or 0) / 100
    data.update({
        "id": entry.id,
        "name": entry.name,
        "age": entry.age,
        "gender": entry.gender,
        "blood_type": entry.blood_type,
        "status": entry.status,
        "alerts": entry.alerts,
        "bmi": round(entry.weight_kg / (height_m * height_m), 1) if entry.weight_kg and height_m else None,
        "change_reason": entry.change_reason,
        "recorded_by": entry.recorded_by,
        "recorded_at": entry.recorded_at.isoformat() if entry.recorded_at else None,
    })
    return data

def create_record_version(
        db:Session,
        record_id:int,
        patient_email:str,
        uploaded_by:str,
        file_name:str,
        file_path:str,
        file_type:Optional[str]=None,
        file_size:Optional[str]=None,
        change_notes:Optional[str]=None,
        analysis_summary:Optional[str]=None,
        extracted_text:Optional[str]=None,
        metrics_data:Optional[str]=None,
        key_findings:Optional[str]=None
):
    latest_version=db.query(RecordVersionModel).filter(
        RecordVersionModel.record_id == record_id
    ).order_by(RecordVersionModel.version_number.desc()).first()

    next_version_number=1
    if latest_version:
        next_version_number = latest_version.version_number + 1

    db.query(RecordVersionModel).filter(
        RecordVersionModel.record_id == record_id,
        RecordVersionModel.is_latest == True
    ).update({"is_latest": False})

    version= RecordVersionModel(
        record_id=record_id,
        patient_email=patient_email,
        uploaded_by=uploaded_by,
        version_number=next_version_number,
        file_name=file_name,
        file_path=file_path,
        file_type=file_type,
        file_size=file_size,
        change_notes=change_notes,
        analysis_summary=analysis_summary,
        extracted_text=extracted_text,
        metrics_data=metrics_data,
        key_findings=key_findings,
        is_latest=True
    )

    db.add(version)
    db.commit()
    db.refresh(version)

    return version

def safe_json_loads(value, fallback):
    if not value:
        return fallback

    try:
        return json.loads(value)
    except Exception:
        return fallback


def normalize_metric_value(value):
    try:
        if isinstance(value, dict):
            value = value.get("value", value)

        value_str = str(value).strip()
        number_match = re.search(r"-?\d+(\.\d+)?", value_str)

        if number_match:
            return float(number_match.group())

        return None
    except Exception:
        return None


def compare_metrics(first_metrics, second_metrics):
    comparison = []

    first_metrics = first_metrics or {}
    second_metrics = second_metrics or {}

    all_keys = sorted(set(first_metrics.keys()) | set(second_metrics.keys()))

    for key in all_keys:
        old_value = first_metrics.get(key)
        new_value = second_metrics.get(key)

        old_number = normalize_metric_value(old_value)
        new_number = normalize_metric_value(new_value)

        status = "unchanged"
        difference = None

        if old_value is None:
            status = "new"
        elif new_value is None:
            status = "removed"
        elif old_number is not None and new_number is not None:
            difference = round(new_number - old_number, 2)

            if difference > 0:
                status = "increased"
            elif difference < 0:
                status = "decreased"
            else:
                status = "unchanged"
        elif str(old_value).strip().lower() != str(new_value).strip().lower():
            status = "changed"

        comparison.append({
            "metric": key,
            "first_value": old_value,
            "second_value": new_value,
            "difference": difference,
            "status": status
        })

    return comparison


def build_rule_based_report_comparison(first_record, second_record):
    first_key_findings = safe_json_loads(first_record.key_findings, [])
    second_key_findings = safe_json_loads(second_record.key_findings, [])

    first_metrics = safe_json_loads(first_record.metrics_data, {})
    second_metrics = safe_json_loads(second_record.metrics_data, {})

    metric_comparison = compare_metrics(first_metrics, second_metrics)

    first_findings_set = set([str(item).strip() for item in first_key_findings if str(item).strip()])
    second_findings_set = set([str(item).strip() for item in second_key_findings if str(item).strip()])

    new_findings = sorted(list(second_findings_set - first_findings_set))
    resolved_findings = sorted(list(first_findings_set - second_findings_set))
    common_findings = sorted(list(first_findings_set & second_findings_set))

    increased_metrics = [m for m in metric_comparison if m["status"] == "increased"]
    decreased_metrics = [m for m in metric_comparison if m["status"] == "decreased"]
    new_metrics = [m for m in metric_comparison if m["status"] == "new"]
    removed_metrics = [m for m in metric_comparison if m["status"] == "removed"]

    return {
        "summary": (
            f"Compared '{first_record.name}' with '{second_record.name}'. "
            f"{len(metric_comparison)} metric(s) were checked, "
            f"{len(new_findings)} new finding(s) appeared, and "
            f"{len(resolved_findings)} previous finding(s) were no longer present."
        ),
        "first_record": {
            "id": first_record.id,
            "name": first_record.name,
            "category": first_record.category,
            "type": first_record.type,
            "uploaded_at": first_record.uploaded_at.isoformat() if first_record.uploaded_at else None,
            "summary": first_record.analysis_summary
        },
        "second_record": {
            "id": second_record.id,
            "name": second_record.name,
            "category": second_record.category,
            "type": second_record.type,
            "uploaded_at": second_record.uploaded_at.isoformat() if second_record.uploaded_at else None,
            "summary": second_record.analysis_summary
        },
        "metric_comparison": metric_comparison,
        "new_findings": new_findings,
        "resolved_findings": resolved_findings,
        "common_findings": common_findings,
        "increased_metrics": increased_metrics,
        "decreased_metrics": decreased_metrics,
        "new_metrics": new_metrics,
        "removed_metrics": removed_metrics,
        "ai_recommendation": (
            "This comparison is generated from extracted report text and AI-detected metrics. "
            "Please review the changes with a qualified healthcare professional before making medical decisions."
        )
    }

def ensure_prescription_multi_medicine_column():
    """Add medicines_json column if the existing prescriptions table is old.

    This lets the app store multiple medicines in one prescription without
    forcing you to manually recreate the MySQL table.
    """
    db = SessionLocal()
    try:
        column_exists = db.execute(
            text("""
                SELECT COUNT(*)
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                  AND TABLE_NAME = 'prescriptions'
                  AND COLUMN_NAME = 'medicines_json'
            """)
        ).scalar()

        if not column_exists:
            db.execute(text("ALTER TABLE prescriptions ADD COLUMN medicines_json LONGTEXT NULL"))
            db.commit()
            print("✅ Added prescriptions.medicines_json column")
    except Exception as e:
        db.rollback()
        # Keep startup non-blocking so existing single-medicine prescriptions still work.
        print(f"⚠️ Could not verify/add prescriptions.medicines_json column: {e}")
    finally:
        db.close()


def _normalise_medicines_from_payload(prescription_data: PrescriptionCreate) -> List[dict]:
    """Validate and normalize medicine rows from new or old request payloads."""
    medicines = []

    if prescription_data.medicines:
        for item in prescription_data.medicines:
            item_dict = item.dict() if hasattr(item, "dict") else dict(item)
            medicines.append({
                "medicine_name": (item_dict.get("medicine_name") or "").strip(),
                "dosage": (item_dict.get("dosage") or "").strip(),
                "frequency": (item_dict.get("frequency") or "").strip(),
                "duration": (item_dict.get("duration") or "").strip(),
                "instructions": (item_dict.get("instructions") or "").strip(),
            })
    else:
        medicines.append({
            "medicine_name": (prescription_data.medicine_name or "").strip(),
            "dosage": (prescription_data.dosage or "").strip(),
            "frequency": (prescription_data.frequency or "").strip(),
            "duration": (prescription_data.duration or "").strip(),
            "instructions": "",
        })

    cleaned = []
    for med in medicines:
        if not med["medicine_name"]:
            continue

        missing = [
            label for label in ["dosage", "frequency", "duration"]
            if not med.get(label)
        ]
        if missing:
            raise HTTPException(
                status_code=400,
                detail=f"Medicine '{med['medicine_name']}' is missing: {', '.join(missing)}"
            )

        cleaned.append(med)

    if not cleaned:
        raise HTTPException(status_code=400, detail="At least one medicine is required")

    return cleaned


def _safe_json_loads(value, default):
    try:
        if not value:
            return default
        parsed = json.loads(value)
        return parsed if parsed is not None else default
    except Exception:
        return default


def _normalise_medicines_from_row(row: dict) -> List[dict]:
    """Return medicines list from a DB row, supporting old single-medicine rows."""
    medicines = _safe_json_loads(row.get("medicines_json"), [])

    if isinstance(medicines, list) and medicines:
        return [
            {
                "medicine_name": str(m.get("medicine_name") or ""),
                "dosage": str(m.get("dosage") or ""),
                "frequency": str(m.get("frequency") or ""),
                "duration": str(m.get("duration") or ""),
                "instructions": str(m.get("instructions") or ""),
            }
            for m in medicines
            if isinstance(m, dict)
        ]

    if row.get("medicine_name"):
        return [{
            "medicine_name": row.get("medicine_name") or "",
            "dosage": row.get("dosage") or "",
            "frequency": row.get("frequency") or "",
            "duration": row.get("duration") or "",
            "instructions": "",
        }]

    return []


def _row_to_prescription_response(row: dict, db: Session) -> dict:
    patient = db.query(PatientModel).filter(
        PatientModel.email == row.get("patient_email")
    ).first()

    clinician = db.query(ClinicianModel).filter(
        ClinicianModel.email == row.get("clinician_email")
    ).first()

    medicines = _normalise_medicines_from_row(row)
    first_medicine = medicines[0] if medicines else {}

    created_at = row.get("created_at")
    updated_at = row.get("updated_at")

    return {
        "id": row.get("id"),
        "patient_email": row.get("patient_email"),
        "patient_name": patient.name if patient else "Unknown Patient",
        "patient_age": patient.age if patient else None,
        "patient_gender": patient.gender if patient else None,
        "patient_blood_type": patient.blood_type if patient else None,

        "clinician_email": row.get("clinician_email"),
        "clinician_name": clinician.name if clinician else "Unknown Clinician",
        "clinician_specialization": clinician.specialization if clinician else "",
        "clinician_department": clinician.department if clinician else "",

        # Backward-compatible top-level medicine fields used by old UI rows
        "medicine_name": first_medicine.get("medicine_name", row.get("medicine_name") or ""),
        "dosage": first_medicine.get("dosage", row.get("dosage") or ""),
        "frequency": first_medicine.get("frequency", row.get("frequency") or ""),
        "duration": first_medicine.get("duration", row.get("duration") or ""),

        # New multi-medicine response used by updated Prescriptions.jsx
        "medicines": medicines,
        "medicine_count": len(medicines),

        "instructions": row.get("instructions"),
        "diagnosis": row.get("diagnosis"),
        "status": row.get("status"),
        "created_at": created_at.isoformat() if hasattr(created_at, "isoformat") else created_at,
        "updated_at": updated_at.isoformat() if hasattr(updated_at, "isoformat") else updated_at,
    }


def _get_prescription_row(db: Session, prescription_id: int) -> Optional[dict]:
    return db.execute(
        text("SELECT * FROM prescriptions WHERE id = :id"),
        {"id": prescription_id}
    ).mappings().first()

def _message_prescription_payload(db: Session, prescription_id: Optional[int]):
    if not prescription_id:
        return None
    row = _get_prescription_row(db, prescription_id)
    return _row_to_prescription_response(dict(row), db) if row else None

def _timeline_datetime_to_iso(value):
    if not value:
        return None

    try:
        return value.isoformat()
    except Exception:
        return str(value)


def _timeline_date_from_appointment(appointment):
    try:
        return datetime.strptime(
            f"{appointment.appointment_date} {appointment.appointment_time}",
            "%Y-%m-%d %H:%M"
        ).isoformat()
    except Exception:
        return appointment.created_at.isoformat() if appointment.created_at else None


def build_patient_health_timeline(
    patient_email: str,
    db: Session,
    include_notifications: bool = True
):
    timeline_items = []

    patient = db.query(PatientModel).filter(
        PatientModel.email == patient_email
    ).first()

    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    # 1. Medical records uploaded
    records = db.query(RecordModel).filter(
        RecordModel.patient_email == patient_email
    ).all()

    for record in records:
        timeline_items.append({
            "id": f"record-{record.id}",
            "event_type": "medical_record",
            "title": "Medical Record Uploaded",
            "description": record.name,
            "category": record.category,
            "status": "completed",
            "icon": "fa-file-medical",
            "color": "blue",
            "date": (
                f"{record.source_date}T00:00:00"
                if getattr(record, "source_date", None)
                else _timeline_datetime_to_iso(record.uploaded_at)
            ),
            "metadata": {
                "record_id": record.id,
                "record_type": record.type,
                "record_category": record.category,
                "category_code": getattr(record, "category_code", "other") or "other",
                "tags": _safe_json_loads(getattr(record, "tags", None), []),
                "source_date": getattr(record, "source_date", None),
                "has_ai_summary": bool(record.analysis_summary),
                "has_metrics": bool(record.metrics_data),
                "findings_count": len(_safe_json_loads(record.key_findings, []))
            }
        })

    # 2. Medical record versions
    record_versions = db.query(RecordVersionModel).filter(
        RecordVersionModel.patient_email == patient_email
    ).all()

    for version in record_versions:
        timeline_items.append({
            "id": f"record-version-{version.id}",
            "event_type": "record_version",
            "title": f"Record Version {version.version_number} Uploaded",
            "description": version.file_name,
            "category": "Record Version",
            "status": "latest" if version.is_latest else "archived",
            "icon": "fa-code-branch",
            "color": "indigo",
            "date": _timeline_datetime_to_iso(version.uploaded_at),
            "metadata": {
                "version_id": version.id,
                "record_id": version.record_id,
                "version_number": version.version_number,
                "is_latest": version.is_latest,
                "change_notes": version.change_notes,
                "file_type": version.file_type,
                "file_size": version.file_size
            }
        })

    # 3. Appointments
    appointments = db.query(AppointmentModel).filter(
        AppointmentModel.patient_email == patient_email
    ).all()

    for appointment in appointments:
        clinician = db.query(ClinicianModel).filter(
            ClinicianModel.email == appointment.clinician_email
        ).first()

        timeline_items.append({
            "id": f"appointment-{appointment.id}",
            "event_type": "appointment",
            "title": "Appointment",
            "description": appointment.reason,
            "category": appointment.appointment_type.replace("_", " ").title()
                if appointment.appointment_type else "Appointment",
            "status": appointment.status,
            "icon": "fa-calendar-check",
            "color": (
                "green" if appointment.status in ["approved", "completed"]
                else "yellow" if appointment.status == "pending"
                else "red" if appointment.status in ["rejected", "cancelled"]
                else "gray"
            ),
            "date": _timeline_date_from_appointment(appointment),
            "metadata": {
                "appointment_id": appointment.id,
                "clinician_email": appointment.clinician_email,
                "clinician_name": clinician.name if clinician else "Unknown Clinician",
                "appointment_date": appointment.appointment_date,
                "appointment_time": appointment.appointment_time,
                "appointment_type": appointment.appointment_type,
                "notes": appointment.notes
            }
        })

    # 4. Prescriptions
    prescriptions = db.query(PrescriptionModel).filter(
        PrescriptionModel.patient_email == patient_email
    ).all()

    for prescription in prescriptions:
        clinician = db.query(ClinicianModel).filter(
            ClinicianModel.email == prescription.clinician_email
        ).first()

        timeline_items.append({
            "id": f"prescription-{prescription.id}",
            "event_type": "prescription",
            "title": "Prescription Created",
            "description": prescription.medicine_name,
            "category": "Prescription",
            "status": prescription.status,
            "icon": "fa-prescription-bottle-medical",
            "color": (
                "green" if prescription.status == "active"
                else "blue" if prescription.status == "completed"
                else "red" if prescription.status == "cancelled"
                else "gray"
            ),
            "date": _timeline_datetime_to_iso(prescription.created_at),
            "metadata": {
                "prescription_id": prescription.id,
                "medicine_name": prescription.medicine_name,
                "dosage": prescription.dosage,
                "frequency": prescription.frequency,
                "duration": prescription.duration,
                "diagnosis": prescription.diagnosis,
                "instructions": prescription.instructions,
                "clinician_email": prescription.clinician_email,
                "clinician_name": clinician.name if clinician else "Unknown Clinician"
            }
        })

    # 5. Patient profile updates
    profile_history = db.query(PatientProfileHistoryModel).filter(
        PatientProfileHistoryModel.patient_id == patient.id
    ).all()

    for history in profile_history:
        timeline_items.append({
            "id": f"profile-history-{history.id}",
            "event_type": "profile_update",
            "title": "Clinical Profile Updated",
            "description": history.change_reason or "Patient profile information was updated",
            "category": "Profile",
            "status": "completed",
            "icon": "fa-user-pen",
            "color": "purple",
            "date": _timeline_datetime_to_iso(history.recorded_at),
            "metadata": {
                "history_id": history.id,
                "recorded_by": history.recorded_by,
                "age": history.age,
                "blood_type": history.blood_type,
                "weight_kg": history.weight_kg,
                "height_cm": history.height_cm,
                "systolic_bp": history.systolic_bp,
                "diastolic_bp": history.diastolic_bp,
                "status": history.status,
                "alerts": history.alerts
            }
        })

    # 6. Notifications
    if include_notifications:
        notifications = db.query(NotificationModel).filter(
            NotificationModel.user_email == patient_email
        ).all()

        for notification in notifications:
            timeline_items.append({
                "id": f"notification-{notification.id}",
                "event_type": "notification",
                "title": notification.title,
                "description": notification.message,
                "category": notification.type,
                "status": "read" if notification.is_read else "unread",
                "icon": "fa-bell",
                "color": "orange",
                "date": _timeline_datetime_to_iso(notification.created_at),
                "metadata": {
                    "notification_id": notification.id,
                    "notification_type": notification.type,
                    "is_read": notification.is_read
                }
            })

        # 7. Emergency alerts
    emergency_alerts = db.query(EmergencyAlertModel).filter(
        EmergencyAlertModel.patient_email == patient_email
    ).all()

    for alert in emergency_alerts:
        timeline_items.append({
            "id": f"emergency-alert-{alert.id}",
            "event_type": "emergency_alert",
            "title": "Emergency Alert Triggered",
            "description": alert.message,
            "category": alert.alert_type,
            "status": alert.status,
            "icon": "fa-triangle-exclamation",
            "color": "red",
            "date": _timeline_datetime_to_iso(alert.created_at),
            "metadata": {
                "alert_id": alert.id,
                "severity": alert.severity,
                "acknowledged_by": alert.acknowledged_by,
                "acknowledged_at": alert.acknowledged_at.isoformat() if alert.acknowledged_at else None,
                "resolved_by": alert.resolved_by,
                "resolved_at": alert.resolved_at.isoformat() if alert.resolved_at else None
            }
        })
     # Sort latest first
    timeline_items = sorted(
        timeline_items,
        key=lambda item: item["date"] or "",
        reverse=True
    )

    summary = {
        "total_events": len(timeline_items),
        "records_count": len([i for i in timeline_items if i["event_type"] == "medical_record"]),
        "appointments_count": len([i for i in timeline_items if i["event_type"] == "appointment"]),
        "prescriptions_count": len([i for i in timeline_items if i["event_type"] == "prescription"]),
        "profile_updates_count": len([i for i in timeline_items if i["event_type"] == "profile_update"]),
        "record_versions_count": len([i for i in timeline_items if i["event_type"] == "record_version"]),
        "unread_notifications_count": len([
            i for i in timeline_items
            if i["event_type"] == "notification" and i["status"] == "unread"
        ])
    }

    return {
        "patient": {
            "email": patient.email,
            "name": patient.name,
            "age": patient.age,
            "gender": patient.gender,
            "blood_type": patient.blood_type,
            "status": patient.status,
            "alerts": patient.alerts
        },
        "summary": summary,
        "timeline": timeline_items
    }  

# API Endpoints
@app.get("/")
async def root():
    return {"message": "CareConnect Pro API", "version": "2.0", "status": "active"}

# ================== CHAT ATTACHMENTS ==================

# Upload file in chat
@app.post("/api/chat/upload")
async def upload_chat_file(
    file: UploadFile = File(...),
    recipient_email: str = Form(...),
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Verify conversation exists
    if current_user.role == "patient":
        connection = db.query(MessageRequestModel).filter(
            MessageRequestModel.patient_email == current_user.email,
            MessageRequestModel.clinician_email == recipient_email,
            MessageRequestModel.status == "accepted"
        ).first()
    elif current_user.role == "clinician":
        connection = db.query(MessageRequestModel).filter(
            MessageRequestModel.clinician_email == current_user.email,
            MessageRequestModel.patient_email == recipient_email,
            MessageRequestModel.status == "accepted"
        ).first()
    else:
        connection = None
    
    if not connection:
        raise HTTPException(status_code=403, detail="No active conversation with this user")
    
    original_name, extension, mime_type, content = await read_validated_upload(
        file,
        allowed_extensions=CHAT_UPLOAD_EXTENSIONS,
        max_bytes=CHAT_UPLOAD_MAX_BYTES,
    )
    file_path = store_upload(
        content=content,
        storage_root=UPLOAD_STORAGE_ROOT,
        purpose="chat",
        owner_key=current_user.email,
        extension=extension,
    )
    
    # Determine file type
    file_type = "document"
    if mime_type:
        if mime_type.startswith("image/"):
            file_type = "image"
        elif mime_type == "application/pdf":
            file_type = "pdf"
    
    # Save to database
    from models import ChatAttachment as ChatAttachmentModel
    
    attachment = ChatAttachmentModel(
        sender_email=current_user.email,
        recipient_email=recipient_email,
        file_name=original_name,
        file_path=str(file_path),
        file_type=file_type,
        file_size=len(content)
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    
    return {
        "id": attachment.id,
        "file_name": attachment.file_name,
        "file_type": attachment.file_type,
        "file_size": attachment.file_size,
        "uploaded_at": attachment.uploaded_at.isoformat()
    }

# Get chat attachments
@app.get("/api/chat/attachments/{other_user_email}")
async def get_chat_attachments(
    other_user_email: str,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from models import ChatAttachment as ChatAttachmentModel
    
    attachments = db.query(ChatAttachmentModel).filter(
        or_(
            (ChatAttachmentModel.sender_email == current_user.email) & 
            (ChatAttachmentModel.recipient_email == other_user_email),
            (ChatAttachmentModel.sender_email == other_user_email) & 
            (ChatAttachmentModel.recipient_email == current_user.email)
        )
    ).order_by(ChatAttachmentModel.uploaded_at.asc()).all()
    
    return {
        "attachments": [
            {
                "id": att.id,
                "file_name": att.file_name,
                "file_type": att.file_type,
                "file_size": att.file_size,
                "uploaded_at": att.uploaded_at.isoformat(),
                "is_mine": att.sender_email == current_user.email
            }
            for att in attachments
        ]
    }

@app.get("/api/health")
def get_health_status():
    return {'status' : 'alive'}

# Download/view attachment
@app.get("/api/chat/download/{attachment_id}")
async def download_attachment(
    attachment_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    from models import ChatAttachment as ChatAttachmentModel
    
    attachment = db.query(ChatAttachmentModel).filter(
        ChatAttachmentModel.id == attachment_id
    ).first()
    
    if not attachment:
        raise HTTPException(status_code=404, detail="Attachment not found")
    
    # Check authorization
    if attachment.sender_email != current_user.email and attachment.recipient_email != current_user.email:
        raise HTTPException(status_code=403, detail="Not authorized to access this file")
    
    if not os.path.exists(attachment.file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(
        path=attachment.file_path,
        filename=attachment.file_name,
        media_type=mimetypes.guess_type(attachment.file_name)[0] or "application/octet-stream"
    )

# ================== CLINICIAN JOIN REQUEST (PUBLIC) ==================
@app.post("/api/public/clinician-request")
async def submit_clinician_request(
    request_data: dict,
    db: Session = Depends(get_db)
):
    """Public endpoint for clinicians to request joining the network"""
    from models import ClinicianJoinRequest as JoinRequestModel
    
    # Check if email already exists
    if email_exists(db, request_data["email"]):
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Check if request already exists
    existing = db.query(JoinRequestModel).filter(
        JoinRequestModel.email == request_data["email"],
        JoinRequestModel.status == "pending"
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Request already submitted and pending review")
    
    new_request = JoinRequestModel(
        name=request_data["name"],
        email=request_data["email"],
        phone=request_data.get("phone"),
        specialization=request_data["specialization"],
        license_number=request_data["license_number"],
        department=request_data.get("department"),
        years_of_experience=request_data.get("years_of_experience"),
        message=request_data.get("message", "")
    )
    
    db.add(new_request)
    db.commit()
    db.refresh(new_request)
    
    return {
        "message": "Request submitted successfully! You will receive an email once reviewed.",
        "request_id": new_request.id
    }

# ================== ADMIN - CLINICIAN MANAGEMENT ==================
@app.get("/api/admin/clinician-requests")
async def get_clinician_requests(
    status: Optional[str] = None,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all clinician join requests"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    from models import ClinicianJoinRequest as JoinRequestModel
    
    query = db.query(JoinRequestModel)
    if status:
        query = query.filter(JoinRequestModel.status == status)
    
    requests = query.order_by(JoinRequestModel.requested_at.desc()).all()
    
    return {
        "requests": [
            {
                "id": req.id,
                "name": req.name,
                "email": req.email,
                "phone": req.phone,
                "specialization": req.specialization,
                "license_number": req.license_number,
                "department": req.department,
                "years_of_experience": req.years_of_experience,
                "message": req.message,
                "status": req.status,
                "requested_at": req.requested_at.isoformat() if req.requested_at else None,
                "reviewed_by": req.reviewed_by,
                "reviewed_at": req.reviewed_at.isoformat() if req.reviewed_at else None,
                "rejection_reason": req.rejection_reason
            }
            for req in requests
        ]
    }
@app.post("/api/admin/approve-clinician-request/{request_id}")
async def approve_clinician_request(
    request_id: int,
    approval_data: dict,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    from models import ClinicianJoinRequest as JoinRequestModel
    from models import AdminAuditLog as AuditLogModel

    request = db.query(JoinRequestModel).filter(
        JoinRequestModel.id == request_id
    ).first()

    if not request:
        raise HTTPException(status_code=404, detail="Request not found")

    if request.status != "pending":
        raise HTTPException(status_code=400, detail="Request already processed")

    existing_clinician = db.query(ClinicianModel).filter(
        ClinicianModel.email == request.email
    ).first()

    # ✅ CASE 1 — clinician already registered
    if existing_clinician:

        existing_clinician.approval_status = "approved"
        existing_clinician.is_active = True            # ✅ IMPORTANT
        existing_clinician.approved_by = current_user.email
        existing_clinician.approved_at = datetime.utcnow()

        temp_password = None
        message = "Existing clinician approved and activated"

    # ✅ CASE 2 — create new clinician
    else:
        temp_password = approval_data.get("temporary_password", "ChangeMe123!")
        hashed_password = get_password_hash(temp_password)

        new_clinician = ClinicianModel(
            name=request.name,
            email=request.email,
            hashed_password=hashed_password,
            role="clinician",
            phone=request.phone,
            specialization=request.specialization,
            license_number=request.license_number,
            department=request.department,
            years_of_experience=request.years_of_experience,
            approval_status="approved",
            is_active=True,                             # ✅ IMPORTANT
            approved_by=current_user.email,
            approved_at=datetime.utcnow()
        )

        db.add(new_clinician)
        message = "New clinician account created, approved and activated"

    # ✅ update join request
    request.status = "approved"
    request.reviewed_by = current_user.email
    request.reviewed_at = datetime.utcnow()

    # ✅ audit log
    audit_log = AuditLogModel(
        admin_email=current_user.email,
        action="approved_clinician_request",
        target_email=request.email,
        details=f"Approved clinician: {request.name}"
    )

    db.add(audit_log)

    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

    response = {
        "message": message,
        "clinician_email": request.email
    }

    if temp_password:
        response["temporary_password"] = temp_password

    return response



@app.post("/api/admin/reject-clinician-request/{request_id}")
async def reject_clinician_request(
    request_id: int,
    rejection_data: dict,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Reject clinician request"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    from models import ClinicianJoinRequest as JoinRequestModel
    from models import AdminAuditLog as AuditLogModel
    
    request = db.query(JoinRequestModel).filter(JoinRequestModel.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    request.status = "rejected"
    request.reviewed_by = current_user.email
    request.reviewed_at = datetime.utcnow()
    request.rejection_reason = rejection_data.get("reason", "")
    
    # Create audit log
    audit_log = AuditLogModel(
        admin_email=current_user.email,
        action="rejected_clinician_request",
        target_email=request.email,
        details=f"Rejected clinician: {request.name}. Reason: {request.rejection_reason}"
    )
    db.add(audit_log)
    
    db.commit()
    
    return {"message": "Request rejected"}

@app.get("/api/admin/clinicians")
async def get_all_clinicians_admin(
    approval_status: Optional[str] = None,
    search: Optional[str] = None,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all clinicians with optional specialization search"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    query = db.query(ClinicianModel)

    if approval_status:
        query = query.filter(ClinicianModel.approval_status == approval_status)

    # Search mainly by specialization
    if search:
        search_term = f"%{search.strip()}%"
        query = query.filter(
            ClinicianModel.specialization.ilike(search_term)
        )

    clinicians = query.all()

    return {
        "clinicians": [
            {
                "id": c.id,
                "name": c.name,
                "email": c.email,
                "gender": c.gender,
                "specialization": c.specialization,
                "department": c.department,
                "years_of_experience": c.years_of_experience,
                "approval_status": c.approval_status,
                "approved_by": c.approved_by,
                "approved_at": c.approved_at.isoformat() if c.approved_at else None,
                "is_active": c.is_active,
                "created_at": c.created_at.isoformat() if c.created_at else None
            }
            for c in clinicians
        ]
    }

@app.put("/api/admin/clinician/{clinician_id}/toggle-status")
async def toggle_clinician_status(
    clinician_id: int,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    from models import AdminAuditLog as AuditLogModel

    clinician = db.query(ClinicianModel).filter(
        ClinicianModel.id == clinician_id
    ).first()

    if not clinician:
        raise HTTPException(status_code=404, detail="Clinician not found")

    # toggle active
    clinician.is_active = not clinician.is_active
    if not clinician.is_active:
        revoke_all_user_sessions(
            db,
            user_email=clinician.email,
            user_role="clinician",
            reason="account_deactivated",
        )

    # ✅ AUTO-APPROVE when activating
    if clinician.is_active and clinician.approval_status != "approved":
        clinician.approval_status = "approved"
        clinician.approved_by = current_user.email
        clinician.approved_at = datetime.utcnow()

    action = "activated_clinician" if clinician.is_active else "deactivated_clinician"

    audit_log = AuditLogModel(
        admin_email=current_user.email,
        action=action,
        target_email=clinician.email,
        details=f"{'Activated' if clinician.is_active else 'Deactivated'} clinician: {clinician.name}"
    )

    db.add(audit_log)
    db.commit()
    db.refresh(clinician)

    return {
        "message": action,
        "is_active": clinician.is_active,
        "approval_status": clinician.approval_status
    }

    

@app.get("/api/admin/audit-logs")
async def get_audit_logs(
    limit: int = 50,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get admin action audit logs"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    from models import AdminAuditLog as AuditLogModel
    
    logs = db.query(AuditLogModel).order_by(
        AuditLogModel.timestamp.desc()
    ).limit(limit).all()
    
    return {
        "logs": [
            {
                "id": log.id,
                "admin_email": log.admin_email,
                "action": log.action,
                "target_email": log.target_email,
                "details": log.details,
                "timestamp": log.timestamp.isoformat() if log.timestamp else None
            }
            for log in logs
        ]
    }


@app.get("/api/admin/security-audit")
async def get_security_audit_events(
    actor_email: Optional[str] = Query(None, max_length=100),
    action: Optional[str] = Query(None, max_length=100),
    outcome: Optional[str] = Query(None, max_length=20),
    limit: int = Query(100, ge=1, le=500),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    query = db.query(SecurityAuditEventModel)
    if actor_email:
        query = query.filter(SecurityAuditEventModel.actor_email == actor_email)
    if action:
        query = query.filter(SecurityAuditEventModel.action.ilike(f"%{action.strip()}%"))
    if outcome:
        if outcome not in {"success", "denied", "failure"}:
            raise HTTPException(status_code=400, detail="Invalid audit outcome")
        query = query.filter(SecurityAuditEventModel.outcome == outcome)

    events = query.order_by(SecurityAuditEventModel.created_at.desc()).limit(limit).all()
    return {
        "events": [
            {
                "id": event.id,
                "request_id": event.request_id,
                "actor_email": event.actor_email,
                "actor_role": event.actor_role,
                "action": event.action,
                "resource_type": event.resource_type,
                "resource_id": event.resource_id,
                "patient_email": event.patient_email,
                "outcome": event.outcome,
                "ip_address": event.ip_address,
                "details": _safe_json_loads(event.details, {}),
                "created_at": event.created_at.isoformat() if event.created_at else None,
            }
            for event in events
        ]
    }
    
@app.get("/api/admin/patients")
async def get_all_patients_admin(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    patients = db.query(PatientModel).all()

    return {
        "patients": [
            {
                **_patient_profile_payload(p),
                "records_count": db.query(RecordModel).filter(RecordModel.patient_email == p.email).count(),
                "prescriptions_count": db.query(PrescriptionModel).filter(PrescriptionModel.patient_email == p.email).count(),
                "history_count": db.query(PatientProfileHistoryModel).filter(PatientProfileHistoryModel.patient_id == p.id).count(),
                "connected_clinicians": db.query(MessageRequestModel).filter(
                    MessageRequestModel.patient_email == p.email,
                    MessageRequestModel.status == "accepted"
                ).count()
            }
            for p in patients
        ]
    }

@app.put("/api/admin/patients/{patient_id}")
async def admin_update_patient_profile(
    patient_id: int,
    profile_data: dict,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    patient = db.query(PatientModel).filter(PatientModel.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    numeric_ranges = {
        "age": (0, 130), "alerts": (0, 100000), "weight_kg": (1, 500),
        "height_cm": (30, 275), "body_fat_percentage": (0, 100),
        "muscle_mass_kg": (0, 300), "waist_cm": (20, 300),
        "systolic_bp": (40, 300), "diastolic_bp": (20, 200),
    }
    parsed = {}
    for field, (minimum, maximum) in numeric_ranges.items():
        if field not in profile_data:
            continue
        raw = profile_data[field]
        if raw in (None, ""):
            parsed[field] = None
            continue
        try:
            value = int(raw) if field in {"age", "alerts", "systolic_bp", "diastolic_bp"} else float(raw)
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail=f"{field.replace('_', ' ').title()} must be numeric")
        if not minimum <= value <= maximum:
            raise HTTPException(status_code=400, detail=f"{field.replace('_', ' ').title()} must be between {minimum} and {maximum}")
        parsed[field] = value
    if profile_data.get("status") and profile_data["status"] not in {"stable", "attention", "critical"}:
        raise HTTPException(status_code=400, detail="Status must be stable, attention, or critical")

    _snapshot_patient_profile(
        db, patient, current_user.email,
        str(profile_data.get("change_reason") or "Administrative profile update")[:255],
    )
    for field in ("name", "gender", "blood_type", "phone", "address", "emergency_contact", "status"):
        if field in profile_data:
            setattr(patient, field, profile_data[field] or None)
    for field, value in parsed.items():
        setattr(patient, field, value)
    db.commit()
    db.refresh(patient)
    return {"message": "Patient profile updated and previous values archived", "patient": _patient_profile_payload(patient)}

@app.delete("/api/admin/users/{role}/{user_id}")
async def admin_delete_user(
    role: str,
    user_id: int,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    if role not in {"patient", "clinician"}:
        raise HTTPException(status_code=400, detail="Only patient and clinician accounts can be deleted here")

    from models import AdminAuditLog as AuditLogModel

    model = PatientModel if role == "patient" else ClinicianModel
    target_user = db.query(model).filter(model.id == user_id).first()

    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    if not target_user.is_active:
        raise HTTPException(status_code=400, detail=f"{role.capitalize()} account is already deactivated")

    target_email = target_user.email
    target_name = target_user.name

    target_user.is_active = False
    revoke_all_user_sessions(
        db,
        user_email=target_email,
        user_role=role,
        reason="account_deactivated",
    )

    audit_log = AuditLogModel(
        admin_email=current_user.email,
        action=f"deactivated_{role}_account",
        target_email=target_email,
        details=f"Deactivated {role} account for {target_name}"
    )
    db.add(audit_log)
    db.commit()

    return {"message": f"{role.capitalize()} account deactivated successfully"}

@app.put("/api/admin/users/{role}/{user_id}/restore")
async def admin_restore_user(
    role: str,
    user_id: int,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    if role not in {"patient", "clinician"}:
        raise HTTPException(status_code=400, detail="Only patient and clinician accounts can be restored here")

    from models import AdminAuditLog as AuditLogModel

    model = PatientModel if role == "patient" else ClinicianModel
    target_user = db.query(model).filter(model.id == user_id).first()

    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    if target_user.is_active:
        raise HTTPException(status_code=400, detail=f"{role.capitalize()} account is already active")

    target_user.is_active = True

    audit_log = AuditLogModel(
        admin_email=current_user.email,
        action=f"restored_{role}_account",
        target_email=target_user.email,
        details=f"Restored {role} account for {target_user.name}"
    )
    db.add(audit_log)
    db.commit()

    return {"message": f"{role.capitalize()} account restored successfully"}

@app.delete("/api/admin/users/{role}/{user_id}/permanent")
async def admin_permanently_delete_user(
    role: str,
    user_id: int,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    if role not in {"patient", "clinician"}:
        raise HTTPException(status_code=400, detail="Only patient and clinician accounts can be permanently deleted here")

    from models import AdminAuditLog as AuditLogModel
    from models import ClinicianJoinRequest as JoinRequestModel

    model = PatientModel if role == "patient" else ClinicianModel
    target_user = db.query(model).filter(model.id == user_id).first()

    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    target_email = target_user.email
    target_name = target_user.name

    try:
        # Remove uploaded medical files and records for patient accounts
        if role == "patient":
            records = db.query(RecordModel).filter(RecordModel.patient_email == target_email).all()
            for record in records:
                if record.file_path and os.path.exists(record.file_path):
                    try:
                        os.remove(record.file_path)
                    except Exception:
                        pass

            db.query(RecordModel).filter(
                RecordModel.patient_email == target_email
            ).delete(synchronize_session=False)

            db.query(MessageRequestModel).filter(
                MessageRequestModel.patient_email == target_email
            ).delete(synchronize_session=False)
        else:
            db.query(MessageRequestModel).filter(
                MessageRequestModel.clinician_email == target_email
            ).delete(synchronize_session=False)

            db.query(JoinRequestModel).filter(
                JoinRequestModel.email == target_email
            ).delete(synchronize_session=False)

        # Remove chat attachments and physical files
        related_attachments = db.query(ChatAttachmentModel).filter(
            or_(
                ChatAttachmentModel.sender_email == target_email,
                ChatAttachmentModel.recipient_email == target_email,
            )
        ).all()

        for attachment in related_attachments:
            if attachment.file_path and os.path.exists(attachment.file_path):
                try:
                    os.remove(attachment.file_path)
                except Exception:
                    pass

        db.query(ChatAttachmentModel).filter(
            or_(
                ChatAttachmentModel.sender_email == target_email,
                ChatAttachmentModel.recipient_email == target_email,
            )
        ).delete(synchronize_session=False)

        # Remove direct messages
        db.query(MessageModel).filter(
            or_(
                MessageModel.sender_email == target_email,
                MessageModel.recipient_email == target_email,
            )
        ).delete(synchronize_session=False)

        db.delete(target_user)

        audit_log = AuditLogModel(
            admin_email=current_user.email,
            action=f"permanently_deleted_{role}_account",
            target_email=target_email,
            details=f"Permanently deleted {role} account for {target_name}"
        )
        db.add(audit_log)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to permanently delete account: {str(e)}")

    return {"message": f"{role.capitalize()} account permanently deleted"}

    

@app.get("/api/admin/dashboard-stats")
async def get_admin_dashboard_stats(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get comprehensive admin dashboard statistics"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    from models import ClinicianJoinRequest as JoinRequestModel
    
    total_patients = db.query(PatientModel).count()
    total_clinicians = db.query(ClinicianModel).count()
    approved_clinicians = db.query(ClinicianModel).filter(
        ClinicianModel.approval_status == "approved"
    ).count()
    pending_clinicians = db.query(ClinicianModel).filter(
        ClinicianModel.approval_status == "pending"
    ).count()
    total_admins = db.query(AdminModel).count()
    
    pending_requests = db.query(JoinRequestModel).filter(
        JoinRequestModel.status == "pending"
    ).count()
    
    total_messages = db.query(MessageModel).count()
    total_records = db.query(RecordModel).count()
    
    # Active conversations (accepted message requests)
    active_conversations = db.query(MessageRequestModel).filter(
        MessageRequestModel.status == "accepted"
    ).count()
    active_sessions = db.query(UserSessionModel).filter(
        UserSessionModel.revoked_at.is_(None),
        UserSessionModel.expires_at > datetime.utcnow(),
    ).count()
    
    return {
        "total_users": total_patients + total_clinicians + total_admins,
        "total_patients": total_patients,
        "total_clinicians": total_clinicians,
        "approved_clinicians": approved_clinicians,
        "pending_clinicians": pending_clinicians,
        "total_admins": total_admins,
        "pending_join_requests": pending_requests,
        "total_messages": total_messages,
        "total_records": total_records,
        "active_conversations": active_conversations,
        "active_sessions": active_sessions,
    }


@app.get("/api/dashboard/widgets")
async def get_role_dashboard_widgets(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return a compact, actionable queue tailored to the signed-in role."""
    today = datetime.utcnow().date().isoformat()
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)

    if current_user.role == "patient":
        upcoming = db.query(AppointmentModel).filter(
            AppointmentModel.patient_email == current_user.email,
            AppointmentModel.appointment_date >= today,
            AppointmentModel.status.in_(["pending", "approved"]),
        ).order_by(
            AppointmentModel.appointment_date.asc(),
            AppointmentModel.appointment_time.asc(),
        ).all()
        active_prescriptions = db.query(PrescriptionModel).filter(
            PrescriptionModel.patient_email == current_user.email,
            PrescriptionModel.status == "active",
        ).count()
        unread_messages = db.query(MessageModel).filter(
            MessageModel.recipient_email == current_user.email,
            MessageModel.read.is_(False),
        ).count()
        recent_records = db.query(RecordModel).filter(
            RecordModel.patient_email == current_user.email,
            RecordModel.uploaded_at >= thirty_days_ago,
        ).count()
        next_appointment = upcoming[0] if upcoming else None
        return {
            "title": "Your care at a glance",
            "cards": [
                {
                    "label": "Upcoming visits",
                    "value": len(upcoming),
                    "hint": (
                        f"Next: {next_appointment.appointment_date} at "
                        f"{next_appointment.appointment_time}"
                        if next_appointment
                        else "No visit currently scheduled"
                    ),
                    "icon": "fa-calendar-check",
                    "tone": "blue",
                },
                {
                    "label": "Active prescriptions",
                    "value": active_prescriptions,
                    "hint": "Current medication plans",
                    "icon": "fa-prescription-bottle-medical",
                    "tone": "emerald",
                },
                {
                    "label": "Unread care messages",
                    "value": unread_messages,
                    "hint": "Messages awaiting review",
                    "icon": "fa-envelope",
                    "tone": "violet",
                },
                {
                    "label": "New records",
                    "value": recent_records,
                    "hint": "Uploaded in the last 30 days",
                    "icon": "fa-file-medical",
                    "tone": "amber",
                },
            ],
        }

    if current_user.role == "clinician":
        connected = connected_patient_emails(db, current_user.email)
        today_appointments = db.query(AppointmentModel).filter(
            AppointmentModel.clinician_email == current_user.email,
            AppointmentModel.appointment_date == today,
            AppointmentModel.status.in_(["pending", "approved"]),
        ).count()
        pending_appointments = db.query(AppointmentModel).filter(
            AppointmentModel.clinician_email == current_user.email,
            AppointmentModel.status == "pending",
        ).count()
        unread_messages = db.query(MessageModel).filter(
            MessageModel.recipient_email == current_user.email,
            MessageModel.read.is_(False),
        ).count()
        critical_patients = (
            db.query(PatientModel).filter(
                PatientModel.email.in_(connected),
                PatientModel.status == "critical",
            ).count()
            if connected
            else 0
        )
        return {
            "title": "Clinical work queue",
            "cards": [
                {
                    "label": "Today's consultations",
                    "value": today_appointments,
                    "hint": "Pending and approved appointments",
                    "icon": "fa-calendar-day",
                    "tone": "blue",
                },
                {
                    "label": "Pending approvals",
                    "value": pending_appointments,
                    "hint": "Appointment requests to review",
                    "icon": "fa-clock",
                    "tone": "amber",
                },
                {
                    "label": "Unread patient messages",
                    "value": unread_messages,
                    "hint": "Messages awaiting a response",
                    "icon": "fa-comments",
                    "tone": "violet",
                },
                {
                    "label": "Critical connected patients",
                    "value": critical_patients,
                    "hint": f"Across {len(connected)} connected patients",
                    "icon": "fa-triangle-exclamation",
                    "tone": "rose",
                },
            ],
        }

    if current_user.role == "admin":
        from models import ClinicianJoinRequest as JoinRequestModel

        active_alerts = db.query(EmergencyAlertModel).filter(
            EmergencyAlertModel.status.in_(["active", "acknowledged"]),
        ).count()
        active_sessions = db.query(UserSessionModel).filter(
            UserSessionModel.revoked_at.is_(None),
            UserSessionModel.expires_at > datetime.utcnow(),
        ).count()
        pending_requests = db.query(JoinRequestModel).filter(
            JoinRequestModel.status == "pending",
        ).count()
        recent_records = db.query(RecordModel).filter(
            RecordModel.uploaded_at >= thirty_days_ago,
        ).count()
        return {
            "title": "Operations watchlist",
            "cards": [
                {
                    "label": "Open SOS alerts",
                    "value": active_alerts,
                    "hint": "Active or acknowledged",
                    "icon": "fa-triangle-exclamation",
                    "tone": "rose",
                },
                {
                    "label": "Active sessions",
                    "value": active_sessions,
                    "hint": "Currently valid user sessions",
                    "icon": "fa-shield-halved",
                    "tone": "blue",
                },
                {
                    "label": "Clinician approvals",
                    "value": pending_requests,
                    "hint": "Join requests awaiting review",
                    "icon": "fa-user-check",
                    "tone": "amber",
                },
                {
                    "label": "Records added",
                    "value": recent_records,
                    "hint": "Across the last 30 days",
                    "icon": "fa-file-circle-plus",
                    "tone": "emerald",
                },
            ],
        }

    raise HTTPException(status_code=403, detail="Unsupported dashboard role")


@app.get("/api/admin/analytics")
async def get_admin_analytics(
    range_days: int = Query(30, ge=7, le=365),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Server-calculated operational and clinical analytics for administrators."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    start = datetime.utcnow() - timedelta(days=range_days - 1)
    bucket_size = 1 if range_days <= 31 else 7 if range_days <= 180 else 30
    bucket_count = (range_days + bucket_size - 1) // bucket_size
    trends = []
    for index in range(bucket_count):
        bucket_date = (start + timedelta(days=index * bucket_size)).date()
        trends.append(
            {
                "label": bucket_date.strftime("%b %d"),
                "registrations": 0,
                "records": 0,
                "messages": 0,
                "appointments": 0,
                "prescriptions": 0,
            }
        )

    def add_to_trend(rows, date_getter, key):
        for row in rows:
            value = date_getter(row)
            if not value or value < start:
                continue
            index = min(
                max((value.date() - start.date()).days // bucket_size, 0),
                bucket_count - 1,
            )
            trends[index][key] += 1

    new_patients = db.query(PatientModel).filter(
        PatientModel.created_at >= start
    ).all()
    new_clinicians = db.query(ClinicianModel).filter(
        ClinicianModel.created_at >= start
    ).all()
    records = db.query(RecordModel).filter(RecordModel.uploaded_at >= start).all()
    messages = db.query(MessageModel).filter(MessageModel.sent_at >= start).all()
    appointments = db.query(AppointmentModel).filter(
        AppointmentModel.created_at >= start
    ).all()
    prescriptions = db.query(PrescriptionModel).filter(
        PrescriptionModel.created_at >= start
    ).all()
    alerts = db.query(EmergencyAlertModel).filter(
        EmergencyAlertModel.created_at >= start
    ).all()

    add_to_trend(new_patients, lambda item: item.created_at, "registrations")
    add_to_trend(new_clinicians, lambda item: item.created_at, "registrations")
    add_to_trend(records, lambda item: item.uploaded_at, "records")
    add_to_trend(messages, lambda item: item.sent_at, "messages")
    add_to_trend(appointments, lambda item: item.created_at, "appointments")
    add_to_trend(prescriptions, lambda item: item.created_at, "prescriptions")

    patient_status = {"stable": 0, "attention": 0, "critical": 0}
    for patient in db.query(PatientModel).all():
        status_value = patient.status or "stable"
        patient_status[status_value] = patient_status.get(status_value, 0) + 1

    completed_appointments = sum(
        1 for item in appointments if item.status == "completed"
    )
    actionable_alerts = sum(
        1 for item in alerts if item.status in ["active", "acknowledged"]
    )
    unread_messages = db.query(MessageModel).filter(
        MessageModel.read.is_(False)
    ).count()
    active_connections = db.query(MessageRequestModel).filter(
        MessageRequestModel.status == "accepted"
    ).count()

    return {
        "range_days": range_days,
        "generated_at": datetime.utcnow().isoformat(),
        "totals": {
            "new_users": len(new_patients) + len(new_clinicians),
            "records": len(records),
            "messages": len(messages),
            "appointments": len(appointments),
            "prescriptions": len(prescriptions),
            "emergency_alerts": len(alerts),
        },
        "operations": {
            "unread_messages": unread_messages,
            "active_connections": active_connections,
            "appointment_completion_rate": (
                round(completed_appointments / len(appointments) * 100, 1)
                if appointments
                else 0
            ),
            "actionable_alerts": actionable_alerts,
        },
        "patient_status": patient_status,
        "trends": trends,
    }

WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

def _consultation_hours(clinician) -> Dict[str, List[Dict[str, str]]]:
    try:
        value = json.loads(getattr(clinician, "consultation_hours", "") or "{}")
        return {day: value.get(day, []) for day in WEEKDAYS}
    except (TypeError, json.JSONDecodeError):
        return {day: [] for day in WEEKDAYS}

def _validate_consultation_hours(hours: Dict[str, List[Dict[str, str]]]):
    unknown_days = set(hours) - set(WEEKDAYS)
    if unknown_days:
        raise HTTPException(status_code=400, detail=f"Invalid weekday: {sorted(unknown_days)[0]}")
    normalized = {day: [] for day in WEEKDAYS}
    for day in WEEKDAYS:
        intervals = hours.get(day, [])
        if not isinstance(intervals, list):
            raise HTTPException(status_code=400, detail=f"Availability for {day} must be a list")
        previous_end = None
        for interval in sorted(intervals, key=lambda item: item.get("start", "")):
            start, end = interval.get("start", ""), interval.get("end", "")
            try:
                start_time = datetime.strptime(start, "%H:%M").time()
                end_time = datetime.strptime(end, "%H:%M").time()
            except (TypeError, ValueError):
                raise HTTPException(status_code=400, detail=f"Use HH:MM times for {day}")
            if start_time >= end_time:
                raise HTTPException(status_code=400, detail=f"Start time must be before end time for {day}")
            if previous_end and start_time < previous_end:
                raise HTTPException(status_code=400, detail=f"Consultation intervals overlap on {day}")
            normalized[day].append({"start": start, "end": end})
            previous_end = end_time
    return normalized

@app.get("/api/clinician/availability")
async def get_clinician_availability(current_user=Depends(get_current_user)):
    if current_user.role != "clinician":
        raise HTTPException(status_code=403, detail="Only clinicians can manage consultation hours")
    return {
        "consultation_hours": _consultation_hours(current_user),
        "consultation_duration_minutes": getattr(current_user, "consultation_duration_minutes", 15) or 15,
    }

@app.put("/api/clinician/availability")
async def update_clinician_availability(
    availability: ClinicianAvailabilityUpdate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role != "clinician":
        raise HTTPException(status_code=403, detail="Only clinicians can manage consultation hours")
    if availability.consultation_duration_minutes not in {15, 30, 45, 60}:
        raise HTTPException(status_code=400, detail="Consultation duration must be 15, 30, 45, or 60 minutes")
    normalized = _validate_consultation_hours(availability.consultation_hours)
    current_user.consultation_hours = json.dumps(normalized)
    current_user.consultation_duration_minutes = availability.consultation_duration_minutes
    db.commit()
    return {
        "message": "Consultation hours updated successfully",
        "consultation_hours": normalized,
        "consultation_duration_minutes": availability.consultation_duration_minutes,
    }

# Update the existing get_all_clinicians endpoint to only show approved clinicians
@app.get("/api/clinicians")
async def get_all_clinicians(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    """Get only APPROVED clinicians for patients to browse"""
    clinicians = db.query(ClinicianModel).filter(
        ClinicianModel.is_active == True,
        ClinicianModel.approval_status == "approved"  # NEW: Only show approved
    ).all()
    return {
        "clinicians": [
            {
                "id": c.id,
                "name": c.name,
                "email": c.email,
                "gender":c.gender,
                "specialization": c.specialization,
                "department": c.department,
                "years_of_experience": c.years_of_experience,
                "consultation_hours": _consultation_hours(c),
                "consultation_duration_minutes": getattr(c, "consultation_duration_minutes", 15) or 15,
            }
            for c in clinicians
        ]
    }

@app.get("/api/clinicians/{clinician_email}/available-slots")
async def get_available_consultation_slots(
    clinician_email: str,
    date: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    clinician = db.query(ClinicianModel).filter(
        ClinicianModel.email == clinician_email,
        ClinicianModel.is_active == True,
        ClinicianModel.approval_status == "approved",
    ).first()
    if not clinician:
        raise HTTPException(status_code=404, detail="Clinician not found")
    try:
        selected_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Use YYYY-MM-DD for date")
    duration = getattr(clinician, "consultation_duration_minutes", 15) or 15
    day_name = WEEKDAYS[selected_date.weekday()]
    booked = {
        appointment.appointment_time[:5]
        for appointment in db.query(AppointmentModel).filter(
            AppointmentModel.clinician_email == clinician_email,
            AppointmentModel.appointment_date == date,
            AppointmentModel.status.in_(["pending", "approved"]),
        ).all()
    }
    slots = []
    for interval in _consultation_hours(clinician).get(day_name, []):
        cursor = datetime.combine(selected_date, datetime.strptime(interval["start"], "%H:%M").time())
        end = datetime.combine(selected_date, datetime.strptime(interval["end"], "%H:%M").time())
        while cursor + timedelta(minutes=duration) <= end:
            value = cursor.strftime("%H:%M")
            if value not in booked and cursor > datetime.now():
                slots.append(value)
            cursor += timedelta(minutes=duration)
    return {"date": date, "duration_minutes": duration, "slots": slots}

# ================== CLINICIAN - REQUEST APPROVAL ==================
# ================== CLINICIAN - REQUEST APPROVAL ==================
@app.post("/api/clinician/request-approval")
async def clinician_request_approval(
    request_data: dict,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Clinician requests approval from admin"""
    if current_user.role != "clinician":
        raise HTTPException(status_code=403, detail="Only clinicians can request approval")
    
    # Check if already approved
    if current_user.approval_status == "approved":
        raise HTTPException(status_code=400, detail="You are already approved")
    
    from models import ClinicianJoinRequest as JoinRequestModel
    
    # Check if request already exists
    existing = db.query(JoinRequestModel).filter(
        JoinRequestModel.email == current_user.email,
        JoinRequestModel.status == "pending"
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Your approval request is already pending")
    
    # Use provided data or fallback to existing profile data
    new_request = JoinRequestModel(
        name=current_user.name,
        email=current_user.email,
        phone=request_data.get("phone") or current_user.phone,
        specialization=request_data.get("specialization") or current_user.specialization,
        license_number=request_data.get("license_number") or current_user.license_number,
        department=request_data.get("department") or current_user.department,
        years_of_experience=request_data.get("years_of_experience") or current_user.years_of_experience,
        message=request_data.get("message", "")
    )
    
    # Update current user's profile with new data if provided
    if request_data.get("specialization"):
        current_user.specialization = request_data.get("specialization")
    if request_data.get("license_number"):
        current_user.license_number = request_data.get("license_number")
    if request_data.get("department"):
        current_user.department = request_data.get("department")
    if request_data.get("years_of_experience"):
        current_user.years_of_experience = request_data.get("years_of_experience")
    if request_data.get("phone"):
        current_user.phone = request_data.get("phone")
    
    db.add(new_request)
    db.commit()
    db.refresh(new_request)
    
    return {
        "message": "Approval request submitted successfully! Admin will review your request.",
        "request_id": new_request.id
    }

@app.get("/api/clinician/approval-status")
async def get_clinician_approval_status(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get clinician's approval status and pending request"""
    if current_user.role != "clinician":
        raise HTTPException(status_code=403, detail="Only clinicians can check approval status")
    
    from models import ClinicianJoinRequest as JoinRequestModel
    
    # Get pending request if any
    pending_request = db.query(JoinRequestModel).filter(
        JoinRequestModel.email == current_user.email,
        JoinRequestModel.status == "pending"
    ).first()
    
    return {
        "approval_status": current_user.approval_status,
        "approved_by": current_user.approved_by,
        "approved_at": current_user.approved_at.isoformat() if current_user.approved_at else None,
        "rejection_reason": current_user.rejection_reason,
        "has_pending_request": pending_request is not None,
        "pending_request": {
            "id": pending_request.id,
            "requested_at": pending_request.requested_at.isoformat(),
            "message": pending_request.message
        } if pending_request else None
    }

# Update the approve endpoint to also update the clinician's approval status


# ================== USER PROFILE ==================
@app.get("/api/profile")
async def get_profile(current_user = Depends(get_current_user)):
    """Get current user's profile details.

    Admin, Patient, and Clinician are stored in different tables, so not every
    model has the same columns. Use getattr() for optional fields to avoid
    500 errors when an admin opens the portal.
    """
    profile_data = {
        "id": getattr(current_user, "id", None),
        "name": getattr(current_user, "name", None),
        "email": getattr(current_user, "email", None),
        "role": getattr(current_user, "role", None),
        "is_active": getattr(current_user, "is_active", True),
        "created_at": (
            current_user.created_at.isoformat()
            if getattr(current_user, "created_at", None)
            else None
        ),
    }

    if current_user.role == "patient":
        profile_data.update({
            "gender": getattr(current_user, "gender", None),
            "age": getattr(current_user, "age", None),
            "blood_type": getattr(current_user, "blood_type", None),
            "phone": getattr(current_user, "phone", None),
            "address": getattr(current_user, "address", None),
            "emergency_contact": getattr(current_user, "emergency_contact", None),
            "last_visit": (
                current_user.last_visit.isoformat()
                if getattr(current_user, "last_visit", None)
                else None
            ),
            "status": getattr(current_user, "status", None),
            **{field: getattr(current_user, field, None) for field in PATIENT_MEASUREMENT_FIELDS},
        })

    elif current_user.role == "clinician":
        profile_data.update({
            "gender": getattr(current_user, "gender", None),
            "specialization": getattr(current_user, "specialization", None),
            "license_number": getattr(current_user, "license_number", None),
            "phone": getattr(current_user, "phone", None),
            "department": getattr(current_user, "department", None),
            "years_of_experience": getattr(current_user, "years_of_experience", None),
            "approval_status": getattr(current_user, "approval_status", None),
        })

    elif current_user.role == "admin":
        # Admin table does not have patient/clinician fields like gender, age,
        # specialization, etc. Return only admin-safe profile fields.
        profile_data.update({
            "gender": None,
            "phone": getattr(current_user, "phone", None),
        })

    return profile_data

@app.put("/api/profile")
async def update_profile(
    profile_data: dict,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update current user's profile details"""
    
    if current_user.role == "patient":
        _snapshot_patient_profile(db, current_user, current_user.email, "Patient profile update")

    # Update common fields
    if "name" in profile_data:
        current_user.name = profile_data["name"]
    
    # Update role-specific fields
    if current_user.role == "patient":
        if "age" in profile_data:
            raw_age = profile_data["age"]
            if raw_age in (None, ""):
                current_user.age = None
            else:
                try:
                    parsed_age = int(raw_age)
                except (TypeError, ValueError):
                    raise HTTPException(status_code=400, detail="Age must be a valid number")

                if parsed_age < 0:
                    raise HTTPException(status_code=400, detail="Age cannot be negative")

                current_user.age = parsed_age
        if "blood_type" in profile_data:
            current_user.blood_type = profile_data["blood_type"]
        if "phone" in profile_data:
            current_user.phone = profile_data["phone"]
        if "address" in profile_data:
            current_user.address = profile_data["address"]
        if "emergency_contact" in profile_data:
            current_user.emergency_contact = profile_data["emergency_contact"]
        for field in PATIENT_MEASUREMENT_FIELDS:
            if field in profile_data:
                raw = profile_data[field]
                setattr(current_user, field, None if raw in (None, "") else float(raw))
    
    elif current_user.role == "clinician":
        if "specialization" in profile_data:
            current_user.specialization = profile_data["specialization"]
        if "license_number" in profile_data:
            current_user.license_number = profile_data["license_number"]
        if "phone" in profile_data:
            current_user.phone = profile_data["phone"]
        if "department" in profile_data:
            current_user.department = profile_data["department"]
        if "years_of_experience" in profile_data:
            current_user.years_of_experience = profile_data["years_of_experience"]
    
    db.commit()
    db.refresh(current_user)
    
    return {"message": "Profile updated successfully"}

# ================== MESSAGE REQUEST SYSTEM ==================

# Create message request
@app.post("/api/message-requests")
async def create_message_request(
    request_data: dict,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "patient":
        raise HTTPException(status_code=403, detail="Only patients can send requests")
    
    # Check if request already exists
    existing = db.query(MessageRequestModel).filter(
        MessageRequestModel.patient_email == current_user.email,
        MessageRequestModel.clinician_email == request_data["clinician_email"],
        MessageRequestModel.status == "pending"
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Request already sent")
    
    # Check if already accepted
    accepted = db.query(MessageRequestModel).filter(
        MessageRequestModel.patient_email == current_user.email,
        MessageRequestModel.clinician_email == request_data["clinician_email"],
        MessageRequestModel.status == "accepted"
    ).first()
    
    if accepted:
        raise HTTPException(status_code=400, detail="Already connected with this clinician")
    
    new_request = MessageRequestModel(
        patient_email=current_user.email,
        clinician_email=request_data["clinician_email"],
        status="pending"
    )
    db.add(new_request)
    db.commit()
    db.refresh(new_request)
    
    return {"message": "Request sent successfully", "request_id": new_request.id}

# ================== ADMIN - GET ALL USERS FOR MESSAGING ==================
@app.get("/api/admin/users-for-messaging")
async def get_users_for_messaging(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all users (patients and clinicians) for admin messaging"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get all patients
    patients = db.query(PatientModel).filter(PatientModel.is_active == True).all()
    
    # Get all clinicians (including pending ones for admin)
    clinicians = db.query(ClinicianModel).filter(ClinicianModel.is_active == True).all()
    
    users = []
    
    for p in patients:
        users.append({
            "id": p.id,
            "name": p.name,
            "email": p.email,
            "role": "patient",
            "status": p.status,
            "gender":p.gender,
            "additional_info": f"Age: {p.age or 'N/A'}"
        })
    
    for c in clinicians:
        users.append({
            "id": c.id,
            "name": c.name,
            "email": c.email,
            "role": "clinician",
            "gender":c.gender,
            "status": c.approval_status,
            "additional_info": f"{c.specialization or 'N/A'} - {c.department or 'N/A'}"
        })
    
    return {"users": users}

# ================== ADMIN - SEND MESSAGE TO ANY USER ==================
@app.post("/api/admin/send-message")
async def admin_send_message(
    message_data: dict,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Admin can send message to any user"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    new_message = MessageModel(
        sender_email=current_user.email,
        sender_role="admin",
        recipient_email=message_data["recipient_email"],
        recipient_role=message_data["recipient_role"],
        message=message_data["message"]
    )
    db.add(new_message)
    db.commit()
    
    return {"message": "Message sent successfully"}

# ================== ADMIN - GET CONVERSATIONS ==================
@app.get("/api/admin/conversations")
async def get_admin_conversations(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all admin conversations"""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get all unique users admin has messaged or received messages from
    messages = db.query(MessageModel).filter(
        or_(
            MessageModel.sender_email == current_user.email,
            MessageModel.recipient_email == current_user.email
        )
    ).all()
    
    # Group by other user
    conversations = {}
    for msg in messages:
        other_email = msg.recipient_email if msg.sender_email == current_user.email else msg.sender_email
        if other_email not in conversations:
            # Get user details
            user = get_user_by_email_and_role(db, other_email, msg.recipient_role if msg.sender_email == current_user.email else msg.sender_role)
            if user:
                conversations[other_email] = {
                    "other_user_email": other_email,
                    "other_user_name": user.name,
                    "other_user_role": user.role,
                    "last_message": msg.message,
                    "last_message_time": msg.sent_at
                }
    
    # Convert to list and sort by most recent
    result = sorted(conversations.values(), key=lambda x: x["last_message_time"], reverse=True)
    
    return {
        "conversations": [
            {
                **conv,
                "last_message_time": conv["last_message_time"].isoformat()
            }
            for conv in result
        ]
    }

# Get message requests
@app.get("/api/message-requests")
async def get_message_requests(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role == "patient":
        # Get patient's sent requests
        requests = db.query(MessageRequestModel).filter(
            MessageRequestModel.patient_email == current_user.email
        ).all()
        
        result = []
        for req in requests:
            clinician = db.query(ClinicianModel).filter(ClinicianModel.email == req.clinician_email).first()
            result.append({
                "id": req.id,
                "clinician_name": clinician.name if clinician else "Unknown",
                "clinician_email": req.clinician_email,
                "clinician_specialization": clinician.specialization if clinician else "",
                "status": req.status,
                "requested_at": req.requested_at.isoformat(),
                "responded_at": req.responded_at.isoformat() if req.responded_at else None
            })
        return {"requests": result}
    
    elif current_user.role == "clinician":
        # Get clinician's received requests
        requests = db.query(MessageRequestModel).filter(
            MessageRequestModel.clinician_email == current_user.email,
            MessageRequestModel.status == "pending"
        ).all()
        
        result = []
        for req in requests:
            patient = db.query(PatientModel).filter(PatientModel.email == req.patient_email).first()
            result.append({
                "id": req.id,
                "patient_name": patient.name if patient else "Unknown",
                "patient_email": req.patient_email,
                "requested_at": req.requested_at.isoformat()
            })
        return {"requests": result}
    
    return {"requests": []}

# Accept message request
@app.put("/api/message-requests/{request_id}/accept")
async def accept_message_request(
    request_id: int,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "clinician":
        raise HTTPException(status_code=403, detail="Only clinicians can accept requests")
    
    request = db.query(MessageRequestModel).filter(
        MessageRequestModel.id == request_id,
        MessageRequestModel.clinician_email == current_user.email
    ).first()
    
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    request.status = "accepted"
    request.responded_at = datetime.utcnow()
    db.commit()
    
    return {"message": "Request accepted"}

# Reject message request
@app.put("/api/message-requests/{request_id}/reject")
async def reject_message_request(
    request_id: int,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "clinician":
        raise HTTPException(status_code=403, detail="Only clinicians can reject requests")
    
    request = db.query(MessageRequestModel).filter(
        MessageRequestModel.id == request_id,
        MessageRequestModel.clinician_email == current_user.email
    ).first()
    
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    request.status = "rejected"
    request.responded_at = datetime.utcnow()
    db.commit()
    
    return {"message": "Request rejected"}

# Get active conversations
@app.get("/api/conversations")
async def get_conversations(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role == "patient":
        # Get accepted requests for patient
        requests = db.query(MessageRequestModel).filter(
            MessageRequestModel.patient_email == current_user.email,
            MessageRequestModel.status == "accepted"
        ).all()
        
        result = []
        for req in requests:
            clinician = db.query(ClinicianModel).filter(ClinicianModel.email == req.clinician_email).first()
            # Get last message
            last_msg = db.query(MessageModel).filter(
                or_(
                    (MessageModel.sender_email == current_user.email) & (MessageModel.recipient_email == req.clinician_email),
                    (MessageModel.sender_email == req.clinician_email) & (MessageModel.recipient_email == current_user.email)
                )
            ).order_by(MessageModel.sent_at.desc()).first()
            
            unread_count = db.query(MessageModel).filter(
                MessageModel.sender_email == req.clinician_email,
                MessageModel.recipient_email == current_user.email,
                MessageModel.read == False
            ).count()

            result.append({
                "conversation_id": req.id,
                "other_user_name": clinician.name if clinician else "Unknown",
                "other_user_email": req.clinician_email,
                "other_user_role": "clinician",
                "last_message": last_msg.message if last_msg else "No messages yet",
                "last_message_time": last_msg.sent_at.isoformat() if last_msg else req.responded_at.isoformat(),
                "unread_count": unread_count
            })
        return {"conversations": result}
    
    elif current_user.role == "clinician":
        # Get accepted requests for clinician
        requests = db.query(MessageRequestModel).filter(
            MessageRequestModel.clinician_email == current_user.email,
            MessageRequestModel.status == "accepted"
        ).all()
        
        result = []
        for req in requests:
            patient = db.query(PatientModel).filter(PatientModel.email == req.patient_email).first()
            # Get last message
            last_msg = db.query(MessageModel).filter(
                or_(
                    (MessageModel.sender_email == current_user.email) & (MessageModel.recipient_email == req.patient_email),
                    (MessageModel.sender_email == req.patient_email) & (MessageModel.recipient_email == current_user.email)
                )
            ).order_by(MessageModel.sent_at.desc()).first()
            
            unread_count = db.query(MessageModel).filter(
                MessageModel.sender_email == req.patient_email,
                MessageModel.recipient_email == current_user.email,
                MessageModel.read == False
            ).count()
            
            result.append({
                "conversation_id": req.id,
                "other_user_name": patient.name if patient else "Unknown",
                "other_user_email": req.patient_email,
                "other_user_role": "patient",
                "last_message": last_msg.message if last_msg else "No messages yet",
                "last_message_time": last_msg.sent_at.isoformat() if last_msg else req.responded_at.isoformat(),
                "unread_count": unread_count
            })
        return {"conversations": result}
    
    return {"conversations": []}

# Send message (modified to check connection)
@app.post("/api/messages/send")
async def send_message(
    message_data: dict,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    recipient_email = message_data["recipient_email"]
    
    # Check if conversation is accepted
    if current_user.role == "patient":
        connection = db.query(MessageRequestModel).filter(
            MessageRequestModel.patient_email == current_user.email,
            MessageRequestModel.clinician_email == recipient_email,
            MessageRequestModel.status == "accepted"
        ).first()
    elif current_user.role == "clinician":
        connection = db.query(MessageRequestModel).filter(
            MessageRequestModel.clinician_email == current_user.email,
            MessageRequestModel.patient_email == recipient_email,
            MessageRequestModel.status == "accepted"
        ).first()
    else:
        connection = None
    
    if not connection:
        raise HTTPException(status_code=403, detail="No active conversation with this user")
    
    new_message = MessageModel(
        sender_email=current_user.email,
        sender_role=current_user.role,
        recipient_email=recipient_email,
        recipient_role=message_data["recipient_role"],
        message=message_data["message"]
    )
    db.add(new_message)
    db.commit()
    
    return {"message": "Message sent successfully"}


# Edit a message (only by sender) — use /edit path to avoid route conflicts
@app.put("/api/messages/{message_id}/edit")
async def edit_message(
    message_id: int,
    data: Dict[str, str],
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    new_text = (data.get("message") or "").strip()

    if not new_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Message cannot be empty"
        )

    message = db.query(MessageModel).filter(MessageModel.id == message_id).first()

    if not message:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")

    if message.sender_email != current_user.email:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only edit your own messages"
        )

    message.message = new_text
    message.is_edited = True
    db.commit()

    return {"message": "Message updated successfully"}


def _delete_attachments_for_message_record(db: Session, message: MessageModel) -> None:
    """Remove chat attachment rows and disk files for this message.

    Attachments may be linked via message_id, or stored without FK (upload then separate
    send) — in that case we match by 'Sent a file: <name>' text and time proximity.
    """
    ids_seen = set()
    attachments = []

    for att in (
        db.query(ChatAttachmentModel)
        .filter(ChatAttachmentModel.message_id == message.id)
        .all()
    ):
        if att.id not in ids_seen:
            attachments.append(att)
            ids_seen.add(att.id)

    body = (message.message or "").strip()
    if body:
        match = re.search(r"Sent a file:\s*(.+)$", body, re.IGNORECASE | re.DOTALL)
        if match:
            fname = match.group(1).strip()
            orphans = (
                db.query(ChatAttachmentModel)
                .filter(
                    ChatAttachmentModel.sender_email == message.sender_email,
                    ChatAttachmentModel.recipient_email == message.recipient_email,
                    ChatAttachmentModel.file_name == fname,
                    ChatAttachmentModel.message_id.is_(None),
                )
                .all()
            )
            if orphans:
                best = min(
                    orphans,
                    key=lambda a: abs((a.uploaded_at - message.sent_at).total_seconds()),
                )
                if (
                    abs((best.uploaded_at - message.sent_at).total_seconds()) <= 120
                    and best.id not in ids_seen
                ):
                    attachments.append(best)
                    ids_seen.add(best.id)

    for att in attachments:
        if att.file_path and os.path.exists(att.file_path):
            try:
                os.remove(att.file_path)
            except Exception:
                pass
        db.delete(att)


# Delete a message (only by sender)
@app.delete("/api/messages/{message_id}/delete")
async def delete_message(
    message_id: int,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    message = db.query(MessageModel).filter(MessageModel.id == message_id).first()

    if not message:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")

    if message.sender_email != current_user.email:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own messages"
        )

    _delete_attachments_for_message_record(db, message)
    db.delete(message)
    db.commit()

    return {"message": "Message deleted successfully"}


# Get conversation messages
@app.get("/api/messages/conversation/{other_user_email}")
async def get_conversation_messages(
    other_user_email: str,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    messages = db.query(MessageModel).filter(
        or_(
            (MessageModel.sender_email == current_user.email) & (MessageModel.recipient_email == other_user_email),
            (MessageModel.sender_email == other_user_email) & (MessageModel.recipient_email == current_user.email)
        )
    ).order_by(MessageModel.sent_at.asc()).all()
    
    # Mark messages as read
    db.query(MessageModel).filter(
        MessageModel.sender_email == other_user_email,
        MessageModel.recipient_email == current_user.email,
        MessageModel.read == False
    ).update({MessageModel.read: True})
    db.commit()
    
    return {
        "messages": [
            {
                "id": m.id,
                "sender_email": m.sender_email,
                "message": m.message,
                "sent_at": m.sent_at.isoformat(),
                "is_mine": m.sender_email == current_user.email,
                "is_edited": bool(getattr(m, "is_edited", False)),
                "prescription": _message_prescription_payload(
                    db, getattr(m, "prescription_id", None)
                ),
            }
            for m in messages
        ]
    }
# ================== APPOINTMENT BOOKING SYSTEM ==================

@app.post("/api/appointments")
async def create_appointment(
    appointment_data: AppointmentCreate,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Patient creates an appointment request with a clinician.
    """
    if current_user.role != "patient":
        raise HTTPException(
            status_code=403,
            detail="Only patients can book appointments"
        )

    clinician = db.query(ClinicianModel).filter(
        ClinicianModel.email == appointment_data.clinician_email,
        ClinicianModel.is_active == True,
        ClinicianModel.approval_status == "approved"
    ).first()

    if not clinician:
        raise HTTPException(
            status_code=404,
            detail="Clinician not found or not approved"
        )

    if not appointment_data.reason.strip():
        raise HTTPException(
            status_code=400,
            detail="Appointment reason is required"
        )

    allowed_appointment_types = ["phone_call", "video_call", "in_person"]

    if appointment_data.appointment_type not in allowed_appointment_types:
        raise HTTPException(
        status_code=400,
        detail="Invalid appointment type"
    )
    
    try:
        requested_start = datetime.strptime(
            f"{appointment_data.appointment_date} {appointment_data.appointment_time}",
            "%Y-%m-%d %H:%M"
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Use YYYY-MM-DD for date and HH:MM for time")
    if requested_start <= datetime.now():
        raise HTTPException(status_code=400, detail="Appointment must be scheduled in the future")

    duration = getattr(clinician, "consultation_duration_minutes", 15) or 15
    requested_end = requested_start + timedelta(minutes=duration)
    day_name = WEEKDAYS[requested_start.weekday()]
    intervals = _consultation_hours(clinician).get(day_name, [])
    inside_consultation_hours = any(
        requested_start.time() >= datetime.strptime(interval["start"], "%H:%M").time()
        and requested_end.time() <= datetime.strptime(interval["end"], "%H:%M").time()
        for interval in intervals
    )
    if not inside_consultation_hours:
        raise HTTPException(
            status_code=400,
            detail="The selected time is outside this clinician's consultation hours"
        )

    existing_appointments = db.query(AppointmentModel).filter(
        AppointmentModel.clinician_email == appointment_data.clinician_email,
        AppointmentModel.appointment_date == appointment_data.appointment_date,
        AppointmentModel.status.in_(["pending", "approved"])
    ).all()

    for existing_appointment in existing_appointments:
        existing_start = datetime.strptime(
            f"{existing_appointment.appointment_date} {existing_appointment.appointment_time}",
            "%Y-%m-%d %H:%M"
        )

        existing_end = existing_start + timedelta(minutes=duration)

        if requested_start < existing_end and requested_end > existing_start:
            raise HTTPException(
                status_code=400,
                detail="This consultation slot is already booked"
            )

    appointment = AppointmentModel(
        patient_email=current_user.email,
        clinician_email=appointment_data.clinician_email,
        appointment_date=appointment_data.appointment_date,
        appointment_time=appointment_data.appointment_time,
        appointment_type=appointment_data.appointment_type,
        reason=appointment_data.reason,
        status="pending"
    )

    db.add(appointment)
    db.commit()
    db.refresh(appointment)

    create_notification(
        db=db,
        user_email=appointment_data.clinician_email,
        title="New Appointment Request",
        message=f"{current_user.name} requested an appointment on {appointment_data.appointment_date} at {appointment_data.appointment_time}.",
        notification_type="appointment"
    )

    return {
        "message": "Appointment request submitted successfully",
        "appointment_id": appointment.id,
        "status": appointment.status
    }


@app.get("/api/appointments")
async def get_appointments(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Role based appointment list:
    - Patient sees own appointments
    - Clinician sees appointment requests sent to them
    - Admin sees all appointments
    """
    if current_user.role == "patient":
        appointments = db.query(AppointmentModel).filter(
            AppointmentModel.patient_email == current_user.email
        ).order_by(AppointmentModel.created_at.desc()).all()

    elif current_user.role == "clinician":
        appointments = db.query(AppointmentModel).filter(
            AppointmentModel.clinician_email == current_user.email
        ).order_by(AppointmentModel.created_at.desc()).all()

    elif current_user.role == "admin":
        appointments = db.query(AppointmentModel).order_by(
            AppointmentModel.created_at.desc()
        ).all()

    else:
        appointments = []

    result = []

    for appointment in appointments:
        patient = db.query(PatientModel).filter(
            PatientModel.email == appointment.patient_email
        ).first()

        clinician = db.query(ClinicianModel).filter(
            ClinicianModel.email == appointment.clinician_email
        ).first()

        launch_opens_at = None
        launch_closes_at = None
        launch_available = False
        if appointment.appointment_type == "video_call":
            try:
                scheduled_at = datetime.strptime(
                    f"{appointment.appointment_date} {appointment.appointment_time}",
                    "%Y-%m-%d %H:%M",
                ).replace(tzinfo=APPOINTMENT_TIMEZONE)
                duration_minutes = (
                    getattr(clinician, "consultation_duration_minutes", 15) or 15
                    if clinician
                    else 15
                )
                launch_opens = scheduled_at - timedelta(minutes=15)
                launch_closes = scheduled_at + timedelta(
                    minutes=duration_minutes + 30
                )
                launch_opens_at = launch_opens.isoformat()
                launch_closes_at = launch_closes.isoformat()
                launch_available = (
                    appointment.status == "approved"
                    and launch_opens
                    <= datetime.now(APPOINTMENT_TIMEZONE)
                    <= launch_closes
                )
            except ValueError:
                pass

        result.append({
            "id": appointment.id,
            "patient_email": appointment.patient_email,
            "patient_name": patient.name if patient else "Unknown Patient",
            "clinician_email": appointment.clinician_email,
            "clinician_name": clinician.name if clinician else "Unknown Clinician",
            "clinician_specialization": clinician.specialization if clinician else "",
            "consultation_duration_minutes": (
                getattr(clinician, "consultation_duration_minutes", 15) or 15
                if clinician else 15
            ),
            "appointment_date": appointment.appointment_date,
            "appointment_time": appointment.appointment_time,
            "appointment_type": appointment.appointment_type,
            "reason": appointment.reason,
            "status": appointment.status,
            "notes": appointment.notes,
            "created_at": appointment.created_at.isoformat() if appointment.created_at else None,
            "updated_at": appointment.updated_at.isoformat() if appointment.updated_at else None,
            "video_launch_opens_at": launch_opens_at,
            "video_launch_closes_at": launch_closes_at,
            "video_launch_available": launch_available,
        })

    return {"appointments": result}


@app.post("/api/video-consultations/appointments/{appointment_id}/launch")
async def launch_video_consultation(
    appointment_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    appointment = db.query(AppointmentModel).filter(
        AppointmentModel.id == appointment_id
    ).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    if current_user.role not in ["patient", "clinician"]:
        raise HTTPException(
            status_code=403,
            detail="Only consultation participants can launch a video visit",
        )
    participant_email = (
        appointment.patient_email
        if current_user.role == "patient"
        else appointment.clinician_email
    )
    if participant_email != current_user.email:
        raise HTTPException(
            status_code=403,
            detail="You are not a participant in this appointment",
        )
    if appointment.appointment_type != "video_call":
        raise HTTPException(
            status_code=400,
            detail="This appointment is not configured for video consultation",
        )
    if appointment.status != "approved":
        raise HTTPException(
            status_code=409,
            detail="The video consultation must be approved before launch",
        )
    if not _active_consent(
        db,
        user_email=current_user.email,
        consent_type="video_consultation",
    ):
        raise HTTPException(
            status_code=428,
            detail="Video consultation consent is required before launch",
        )

    try:
        scheduled_at = datetime.strptime(
            f"{appointment.appointment_date} {appointment.appointment_time}",
            "%Y-%m-%d %H:%M",
        ).replace(tzinfo=APPOINTMENT_TIMEZONE)
    except ValueError as exc:
        raise HTTPException(
            status_code=500,
            detail="Appointment time is not valid",
        ) from exc
    clinician = db.query(ClinicianModel).filter(
        ClinicianModel.email == appointment.clinician_email
    ).first()
    duration_minutes = (
        getattr(clinician, "consultation_duration_minutes", 15) or 15
        if clinician
        else 15
    )
    opens_at = scheduled_at - timedelta(minutes=15)
    closes_at = scheduled_at + timedelta(minutes=duration_minutes + 30)
    now = datetime.now(APPOINTMENT_TIMEZONE)
    if now < opens_at:
        raise HTTPException(
            status_code=409,
            detail=(
                "Video access opens at "
                f"{opens_at.strftime('%Y-%m-%d %H:%M %Z')}"
            ),
        )
    if now > closes_at:
        raise HTTPException(
            status_code=410,
            detail="The video consultation access window has closed",
        )

    db.add(
        VideoConsultationEventModel(
            appointment_id=appointment.id,
            actor_email=current_user.email,
            actor_role=current_user.role,
            event_type="launch_authorized",
            provider="comm360",
        )
    )
    db.commit()
    return {
        "provider": "Comm360",
        "launch_url": COMM360_BASE_URL,
        "appointment_id": appointment.id,
        "opens_at": opens_at.isoformat(),
        "closes_at": closes_at.isoformat(),
        "appointment_timezone": APPOINTMENT_TIMEZONE_NAME,
        "notice": (
            "Comm360 is an external service. Sign in there to continue. "
            "No patient details are included in the launch URL."
        ),
    }


@app.put("/api/appointments/{appointment_id}/status")
async def update_appointment_status(
    appointment_id: int,
    status_data: AppointmentStatusUpdate,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update appointment status.
    Clinician can approve/reject/complete appointments assigned to them.
    Patient can cancel their own appointment.
    Admin can update any appointment.
    """
    allowed_statuses = ["pending", "approved", "rejected", "completed", "cancelled"]

    if status_data.status not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Allowed values: {', '.join(allowed_statuses)}"
        )

    appointment = db.query(AppointmentModel).filter(
        AppointmentModel.id == appointment_id
    ).first()

    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    if current_user.role == "clinician":
        if appointment.clinician_email != current_user.email:
            raise HTTPException(
                status_code=403,
                detail="You can update only your own appointment requests"
            )

        if status_data.status not in ["approved", "rejected", "completed"]:
            raise HTTPException(
                status_code=400,
                detail="Clinician can only approve, reject, or complete appointments"
            )

    elif current_user.role == "patient":
        if appointment.patient_email != current_user.email:
            raise HTTPException(
                status_code=403,
                detail="You can cancel only your own appointments"
            )

        if status_data.status != "cancelled":
            raise HTTPException(
                status_code=400,
                detail="Patient can only cancel appointments"
            )

    elif current_user.role == "admin":
        pass

    else:
        raise HTTPException(status_code=403, detail="Not authorized")

    appointment.status = status_data.status

    if status_data.notes is not None:
        appointment.notes = status_data.notes

    appointment.updated_at = datetime.utcnow()

    db.commit()
    db.refresh(appointment)

    if status_data.status in ["approved", "rejected", "completed"]:
        create_notification(
        db=db,
        user_email=appointment.patient_email,
        title=f"Appointment {status_data.status.capitalize()}",
        message=f"Your appointment on {appointment.appointment_date} at {appointment.appointment_time} was {status_data.status}.",
        notification_type="appointment"
    )

    if status_data.status == "cancelled":
        create_notification(
        db=db,
        user_email=appointment.clinician_email,
        title="Appointment Cancelled",
        message=f"Patient cancelled the appointment on {appointment.appointment_date} at {appointment.appointment_time}.",
        notification_type="appointment"
    )
    return {
        "message": f"Appointment {status_data.status} successfully",
        "appointment_id": appointment.id,
        "status": appointment.status
    }


@app.put("/api/appointments/{appointment_id}/notes")
async def update_appointment_notes(
    appointment_id: int,
    notes_data: AppointmentNotesUpdate,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    appointment = db.query(AppointmentModel).filter(
        AppointmentModel.id == appointment_id
    ).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    if current_user.role == "clinician":
        if appointment.clinician_email != current_user.email:
            raise HTTPException(
                status_code=403,
                detail="You can update notes only for your own appointments",
            )
    elif current_user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Only the assigned clinician or an administrator can update notes",
        )

    appointment.notes = notes_data.notes.strip()
    appointment.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(appointment)
    return {
        "message": "Appointment notes saved successfully",
        "appointment_id": appointment.id,
        "notes": appointment.notes,
        "updated_at": (
            appointment.updated_at.isoformat() if appointment.updated_at else None
        ),
    }


@app.delete("/api/appointments/{appointment_id}")
async def delete_appointment(
    appointment_id: int,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Admin can delete any appointment.
    Patient can delete only cancelled/rejected appointment.
    """
    appointment = db.query(AppointmentModel).filter(
        AppointmentModel.id == appointment_id
    ).first()

    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    if current_user.role == "admin":
        pass
    elif current_user.role == "patient":
        if appointment.patient_email != current_user.email:
            raise HTTPException(
                status_code=403,
                detail="You can delete only your own appointments"
            )

        if appointment.status not in ["cancelled", "rejected"]:
            raise HTTPException(
                status_code=400,
                detail="Only cancelled or rejected appointments can be deleted"
            )
    else:
        raise HTTPException(
            status_code=403,
            detail="Only admin or appointment owner can delete appointments"
        )

    db.delete(appointment)
    db.commit()

    return {"message": "Appointment deleted successfully"}


# ================== PRESCRIPTION MANAGEMENT SYSTEM ==================

@app.post("/api/prescriptions/parse-dictation")
async def parse_prescription_dictation(
    payload: dict,
    current_user=Depends(get_current_user),
):
    if current_user.role != "clinician":
        raise HTTPException(status_code=403, detail="Only clinicians can dictate prescriptions")
    transcript = str(payload.get("transcript") or "").strip()
    if not transcript:
        raise HTTPException(status_code=400, detail="Dictation transcript is required")
    if gemini_model is None:
        return {"diagnosis": "", "instructions": transcript, "medicines": []}
    prompt = f"""Convert this clinician dictation into a structured prescription draft.
Do not invent or correct medical facts. Copy only details explicitly dictated.
Return only JSON in this format:
{{"diagnosis":"","instructions":"","medicines":[{{"medicine_name":"","dosage":"","frequency":"","duration":"","instructions":""}}]}}

DICTATION:
{transcript}"""
    try:
        response_text = gemini_model.generate_content(prompt).text.strip()
        response_text = re.sub(r"^```(?:json)?\s*|\s*```$", "", response_text, flags=re.I)
        start, end = response_text.find("{"), response_text.rfind("}")
        draft = json.loads(response_text[start:end + 1])
        medicines = draft.get("medicines") if isinstance(draft.get("medicines"), list) else []
        return {
            "diagnosis": str(draft.get("diagnosis") or ""),
            "instructions": str(draft.get("instructions") or transcript),
            "medicines": [
                {
                    "medicine_name": str(item.get("medicine_name") or ""),
                    "dosage": str(item.get("dosage") or ""),
                    "frequency": str(item.get("frequency") or ""),
                    "duration": str(item.get("duration") or ""),
                    "instructions": str(item.get("instructions") or ""),
                }
                for item in medicines if isinstance(item, dict) and item.get("medicine_name")
            ],
        }
    except Exception as exc:
        logging.warning("Prescription dictation parsing failed: %s", exc)
        return {"diagnosis": "", "instructions": transcript, "medicines": []}

@app.post("/api/prescriptions")
async def create_prescription(
    prescription_data: PrescriptionCreate,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Clinician creates one prescription that can contain multiple medicines.
    """
    if current_user.role != "clinician":
        raise HTTPException(
            status_code=403,
            detail="Only clinicians can create prescriptions"
        )

    patient = db.query(PatientModel).filter(
        PatientModel.email == prescription_data.patient_email,
        PatientModel.is_active == True
    ).first()

    if not patient:
        raise HTTPException(
            status_code=404,
            detail="Patient not found or inactive"
        )

    connection = db.query(MessageRequestModel).filter(
        MessageRequestModel.patient_email == prescription_data.patient_email,
        MessageRequestModel.clinician_email == current_user.email,
        MessageRequestModel.status == "accepted"
    ).first()

    if not connection:
        raise HTTPException(
            status_code=403,
            detail="You can create prescriptions only for connected patients"
        )

    medicines = _normalise_medicines_from_payload(prescription_data)
    first_medicine = medicines[0]

    try:
        result = db.execute(
            text("""
                INSERT INTO prescriptions (
                    patient_email,
                    clinician_email,
                    medicine_name,
                    dosage,
                    frequency,
                    duration,
                    diagnosis,
                    instructions,
                    medicines_json,
                    status,
                    created_at,
                    updated_at
                ) VALUES (
                    :patient_email,
                    :clinician_email,
                    :medicine_name,
                    :dosage,
                    :frequency,
                    :duration,
                    :diagnosis,
                    :instructions,
                    :medicines_json,
                    'active',
                    :created_at,
                    :updated_at
                )
            """),
            {
                "patient_email": prescription_data.patient_email,
                "clinician_email": current_user.email,
                "medicine_name": first_medicine["medicine_name"],
                "dosage": first_medicine["dosage"],
                "frequency": first_medicine["frequency"],
                "duration": first_medicine["duration"],
                "diagnosis": prescription_data.diagnosis,
                "instructions": prescription_data.instructions,
                "medicines_json": json.dumps(medicines),
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }
        )
        prescription_id = getattr(result, "lastrowid", None)
        medicine_names = ", ".join([m["medicine_name"] for m in medicines[:3]])
        if len(medicines) > 3:
            medicine_names += f" + {len(medicines) - 3} more"
        db.add(MessageModel(
            sender_email=current_user.email,
            sender_role="clinician",
            recipient_email=prescription_data.patient_email,
            recipient_role="patient",
            message=f"New prescription: {medicine_names}",
            prescription_id=prescription_id,
        ))
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create prescription: {str(e)}")

    try:
        create_notification(
            db=db,
            user_email=prescription_data.patient_email,
            title="New Prescription Added",
            message=f"Dr. {current_user.name} added a prescription with {len(medicines)} medicine(s): {medicine_names}.",
            notification_type="prescription"
        )
    except Exception as e:
        print(f"⚠️ Prescription created but notification failed: {e}")

    return {
        "message": "Prescription created successfully",
        "prescription_id": prescription_id,
        "status": "active",
        "medicine_count": len(medicines),
        "medicines": medicines
    }


@app.get("/api/prescriptions")
async def get_prescriptions(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Role based prescriptions:
    - Patient sees own prescriptions
    - Clinician sees prescriptions created by them
    - Admin sees all prescriptions
    """
    if current_user.role == "patient":
        rows = db.execute(
            text("""
                SELECT * FROM prescriptions
                WHERE patient_email = :email
                ORDER BY created_at DESC
            """),
            {"email": current_user.email}
        ).mappings().all()

    elif current_user.role == "clinician":
        rows = db.execute(
            text("""
                SELECT * FROM prescriptions
                WHERE clinician_email = :email
                ORDER BY created_at DESC
            """),
            {"email": current_user.email}
        ).mappings().all()

    elif current_user.role == "admin":
        rows = db.execute(
            text("SELECT * FROM prescriptions ORDER BY created_at DESC")
        ).mappings().all()

    else:
        rows = []

    return {
        "prescriptions": [
            _row_to_prescription_response(dict(row), db)
            for row in rows
        ]
    }


@app.get("/api/prescriptions/{prescription_id}")
async def get_prescription_by_id(
    prescription_id: int,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    row = _get_prescription_row(db, prescription_id)

    if not row:
        raise HTTPException(status_code=404, detail="Prescription not found")

    row_dict = dict(row)

    if current_user.role == "patient" and row_dict.get("patient_email") != current_user.email:
        raise HTTPException(status_code=403, detail="Not authorized")

    if current_user.role == "clinician" and row_dict.get("clinician_email") != current_user.email:
        raise HTTPException(status_code=403, detail="Not authorized")

    if current_user.role not in ["patient", "clinician", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    return _row_to_prescription_response(row_dict, db)


@app.put("/api/prescriptions/{prescription_id}/status")
async def update_prescription_status(
    prescription_id: int,
    status_data: PrescriptionStatusUpdate,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    allowed_statuses = ["active", "completed", "cancelled"]

    if status_data.status not in allowed_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Allowed values: {', '.join(allowed_statuses)}"
        )

    row = _get_prescription_row(db, prescription_id)

    if not row:
        raise HTTPException(status_code=404, detail="Prescription not found")

    row_dict = dict(row)

    if current_user.role == "clinician":
        if row_dict.get("clinician_email") != current_user.email:
            raise HTTPException(
                status_code=403,
                detail="You can update only your own prescriptions"
            )
    elif current_user.role == "admin":
        pass
    else:
        raise HTTPException(
            status_code=403,
            detail="Only clinician or admin can update prescription status"
        )

    db.execute(
        text("""
            UPDATE prescriptions
            SET status = :status, updated_at = :updated_at
            WHERE id = :id
        """),
        {
            "status": status_data.status,
            "updated_at": datetime.utcnow(),
            "id": prescription_id,
        }
    )
    db.commit()

    return {
        "message": f"Prescription marked as {status_data.status}",
        "prescription_id": prescription_id,
        "status": status_data.status
    }


@app.delete("/api/prescriptions/{prescription_id}")
async def delete_prescription(
    prescription_id: int,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    row = _get_prescription_row(db, prescription_id)

    if not row:
        raise HTTPException(status_code=404, detail="Prescription not found")

    row_dict = dict(row)

    if current_user.role == "clinician":
        if row_dict.get("clinician_email") != current_user.email:
            raise HTTPException(
                status_code=403,
                detail="You can delete only your own prescriptions"
            )
    elif current_user.role == "admin":
        pass
    else:
        raise HTTPException(
            status_code=403,
            detail="Only clinician or admin can delete prescriptions"
        )

    db.execute(
        text("DELETE FROM prescriptions WHERE id = :id"),
        {"id": prescription_id}
    )
    db.commit()

    return {"message": "Prescription deleted successfully"}

#====================Emergency alert system=================

EMERGENCY_REVIEW_MINUTES = 5
EMERGENCY_MAX_ESCALATION_LEVEL = 3


def _record_emergency_event(
    db: Session,
    alert: EmergencyAlertModel,
    event_type: str,
    *,
    actor_email: Optional[str] = None,
    actor_role: Optional[str] = None,
    notes: Optional[str] = None,
) -> None:
    db.add(
        EmergencyAlertEventModel(
            alert_id=alert.id,
            event_type=event_type,
            actor_email=actor_email,
            actor_role=actor_role,
            escalation_level=alert.escalation_level or 1,
            notes=(notes or "").strip() or None,
        )
    )


def _require_emergency_staff_access(
    db: Session,
    alert: EmergencyAlertModel,
    current_user,
) -> None:
    if current_user.role == "admin":
        return
    if current_user.role != "clinician":
        raise HTTPException(
            status_code=403,
            detail="Only clinicians or administrators can manage emergency alerts",
        )
    connection = db.query(MessageRequestModel).filter(
        MessageRequestModel.patient_email == alert.patient_email,
        MessageRequestModel.clinician_email == current_user.email,
        MessageRequestModel.status == "accepted",
    ).first()
    if not connection:
        raise HTTPException(
            status_code=403,
            detail="You can manage alerts only for connected patients",
        )


def _require_owner_or_admin(alert: EmergencyAlertModel, current_user) -> None:
    if current_user.role == "admin":
        return
    if alert.owner_email != current_user.email:
        raise HTTPException(
            status_code=409,
            detail="Claim this alert before performing this action",
        )


def _assign_emergency_owner(
    alert: EmergencyAlertModel,
    current_user,
    *,
    now: datetime,
) -> None:
    alert.owner_email = current_user.email
    alert.owner_role = current_user.role
    alert.ownership_assigned_at = now
    alert.operational_state = "owned"
    alert.last_monitored_at = now
    alert.next_review_at = now + timedelta(minutes=EMERGENCY_REVIEW_MINUTES)


def _queue_notification(
    db: Session,
    *,
    user_email: str,
    title: str,
    message: str,
    notification_type: str = "emergency",
) -> None:
    db.add(
        NotificationModel(
            user_email=user_email,
            title=title,
            message=message,
            type=notification_type,
            is_read=False,
        )
    )


def _apply_due_emergency_escalations(db: Session) -> None:
    """Apply the escalation policy whenever a staff monitoring view polls."""
    now = datetime.utcnow()
    due_alerts = db.query(EmergencyAlertModel).filter(
        EmergencyAlertModel.status.in_(["active", "acknowledged"]),
        EmergencyAlertModel.next_review_at.isnot(None),
        EmergencyAlertModel.next_review_at <= now,
    ).with_for_update(skip_locked=True).all()
    if not due_alerts:
        return

    admin_emails = [row[0] for row in db.query(AdminModel.email).all()]
    for alert in due_alerts:
        previous_level = alert.escalation_level or 1
        alert.escalation_level = min(
            previous_level + 1,
            EMERGENCY_MAX_ESCALATION_LEVEL,
        )
        alert.operational_state = "escalated"
        alert.last_monitored_at = now
        alert.next_review_at = now + timedelta(
            minutes=(
                EMERGENCY_REVIEW_MINUTES
                if alert.escalation_level < EMERGENCY_MAX_ESCALATION_LEVEL
                else EMERGENCY_REVIEW_MINUTES * 3
            )
        )
        event_type = (
            "auto_escalated"
            if alert.escalation_level > previous_level
            else "review_overdue"
        )
        _record_emergency_event(
            db,
            alert,
            event_type,
            notes=(
                "The operational review deadline elapsed without a recorded "
                "staff check-in."
            ),
        )

        recipients = set(admin_emails)
        recipients.update(
            get_connected_clinician_emails_for_patient(db, alert.patient_email)
        )
        if alert.owner_email:
            recipients.add(alert.owner_email)
        for recipient in recipients:
            _queue_notification(
                db,
                user_email=recipient,
                title=f"SOS escalation level {alert.escalation_level}",
                message=(
                    f"The alert from {alert.patient_name or alert.patient_email} "
                    "passed its review deadline and needs staff attention."
                ),
            )
    db.commit()


def _emergency_alert_payload(db: Session, alert: EmergencyAlertModel) -> dict:
    patient = db.query(PatientModel).filter(
        PatientModel.email == alert.patient_email
    ).first()
    events = db.query(EmergencyAlertEventModel).filter(
        EmergencyAlertEventModel.alert_id == alert.id
    ).order_by(EmergencyAlertEventModel.created_at.desc()).limit(10).all()
    return {
        "id": alert.id,
        "patient_email": alert.patient_email,
        "patient_name": alert.patient_name,
        "alert_type": alert.alert_type,
        "severity": alert.severity,
        "message": alert.message,
        "status": alert.status,
        "acknowledged_by": alert.acknowledged_by,
        "acknowledged_at": (
            alert.acknowledged_at.isoformat() if alert.acknowledged_at else None
        ),
        "resolved_by": alert.resolved_by,
        "resolved_at": alert.resolved_at.isoformat() if alert.resolved_at else None,
        "escalation_level": alert.escalation_level or 1,
        "owner_email": alert.owner_email,
        "owner_role": alert.owner_role,
        "ownership_assigned_at": (
            alert.ownership_assigned_at.isoformat()
            if alert.ownership_assigned_at else None
        ),
        "operational_state": alert.operational_state or "unassigned",
        "last_monitored_at": (
            alert.last_monitored_at.isoformat() if alert.last_monitored_at else None
        ),
        "next_review_at": (
            alert.next_review_at.isoformat() if alert.next_review_at else None
        ),
        "escalation_deadline": (
            alert.escalation_deadline.isoformat()
            if alert.escalation_deadline else None
        ),
        "consent_version": alert.consent_version,
        "consent_acknowledged": bool(alert.consent_acknowledged),
        "created_at": alert.created_at.isoformat() if alert.created_at else None,
        "updated_at": alert.updated_at.isoformat() if alert.updated_at else None,
        "events": [
            {
                "id": event.id,
                "event_type": event.event_type,
                "actor_email": event.actor_email,
                "actor_role": event.actor_role,
                "escalation_level": event.escalation_level,
                "notes": event.notes,
                "created_at": (
                    event.created_at.isoformat() if event.created_at else None
                ),
            }
            for event in events
        ],
        "patient_details": {
            "name": patient.name if patient else alert.patient_name,
            "email": patient.email if patient else alert.patient_email,
            "age": patient.age if patient else None,
            "gender": patient.gender if patient else None,
            "blood_type": patient.blood_type if patient else None,
            "emergency_contact": patient.emergency_contact if patient else None,
            "status": patient.status if patient else None,
            "alerts": patient.alerts if patient else None,
        },
    }


@app.post("/api/emergency-alerts")
async def create_emergency_alert(
    alert_data: EmergencyAlertCreate,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "patient":
        raise HTTPException(
            status_code=403,
            detail="Only patients can trigger emergency alerts"
        )

    if not alert_data.message or not alert_data.message.strip():
        raise HTTPException(
            status_code=400,
            detail="Emergency message is required"
        )

    allowed_alert_types = [
        "medical_emergency",
        "severe_pain",
        "breathing_issue",
        "accident",
        "medication_reaction",
        "other"
    ]

    allowed_severities = ["medium", "high", "critical"]

    if alert_data.alert_type not in allowed_alert_types:
        raise HTTPException(
            status_code=400,
            detail="Invalid emergency alert type"
        )

    if alert_data.severity not in allowed_severities:
        raise HTTPException(
            status_code=400,
            detail="Invalid emergency severity"
        )

    patient = db.query(PatientModel).filter(
        PatientModel.email == current_user.email
    ).first()

    if not patient:
        raise HTTPException(
            status_code=404,
            detail="Patient profile not found"
        )

    consent = _active_consent(
        db,
        user_email=current_user.email,
        consent_type="emergency_alert",
    )
    if not consent:
        raise HTTPException(
            status_code=428,
            detail="Review and accept the SOS safety disclosure before using SOS",
        )

    now = datetime.utcnow()
    existing_alert = db.query(EmergencyAlertModel).filter(
        EmergencyAlertModel.patient_email == current_user.email,
        EmergencyAlertModel.status.in_(["active", "acknowledged"]),
    ).order_by(EmergencyAlertModel.created_at.desc()).first()
    if existing_alert:
        existing_alert.status = "active"
        existing_alert.acknowledged_by = None
        existing_alert.acknowledged_at = None
        existing_alert.escalation_level = min(
            (existing_alert.escalation_level or 1) + 1,
            EMERGENCY_MAX_ESCALATION_LEVEL,
        )
        existing_alert.operational_state = "escalated"
        existing_alert.next_review_at = now + timedelta(
            minutes=EMERGENCY_REVIEW_MINUTES
        )
        existing_alert.escalation_deadline = now + timedelta(
            minutes=EMERGENCY_REVIEW_MINUTES
        )
        existing_alert.consent_version = consent.consent_version
        existing_alert.consent_acknowledged = True
        _record_emergency_event(
            db,
            existing_alert,
            "patient_reactivated",
            actor_email=current_user.email,
            actor_role=current_user.role,
            notes="Patient activated SOS again while a response remained open.",
        )
        db.commit()
        db.refresh(existing_alert)
        notify_emergency_alert_receivers(db=db, alert=existing_alert)
        return {
            "message": "Existing emergency response escalated successfully",
            "alert_id": existing_alert.id,
            "status": existing_alert.status,
            "reactivated": True,
            "escalation_level": existing_alert.escalation_level,
            "next_review_at": existing_alert.next_review_at.isoformat(),
            "notice": (
                "CareConnect re-notified the configured care team. This does "
                "not automatically dispatch emergency services."
            ),
        }

    alert = EmergencyAlertModel(
        patient_email=current_user.email,
        patient_name=current_user.name,
        alert_type=alert_data.alert_type,
        severity=alert_data.severity,
        message=alert_data.message.strip(),
        status="active",
        escalation_level=1,
        operational_state="unassigned",
        last_monitored_at=now,
        next_review_at=now + timedelta(minutes=EMERGENCY_REVIEW_MINUTES),
        escalation_deadline=now + timedelta(minutes=EMERGENCY_REVIEW_MINUTES * 2),
        consent_version=consent.consent_version,
        consent_acknowledged=True,
    )

    db.add(alert)
    db.flush()
    _record_emergency_event(
        db,
        alert,
        "created",
        actor_email=current_user.email,
        actor_role=current_user.role,
        notes="Patient activated the one-tap SOS control.",
    )
    db.commit()
    db.refresh(alert)

    notify_emergency_alert_receivers(db=db, alert=alert)

    return {
        "message": "Emergency alert triggered successfully",
        "alert_id": alert.id,
        "status": alert.status,
        "next_review_at": alert.next_review_at.isoformat(),
        "notice": (
            "CareConnect notified the configured care team. This does not "
            "automatically dispatch emergency services."
        ),
    }


@app.get("/api/emergency-alerts")
async def get_emergency_alerts(
    status: Optional[str] = None,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(EmergencyAlertModel)

    if current_user.role == "patient":
        raise HTTPException(
            status_code=403,
            detail="SOS updates are available through patient notifications"
        )

    elif current_user.role == "clinician":
        connected_patient_emails = db.query(MessageRequestModel.patient_email).filter(
            MessageRequestModel.clinician_email == current_user.email,
            MessageRequestModel.status == "accepted"
        ).all()

        patient_emails = [item[0] for item in connected_patient_emails]

        if not patient_emails:
            return []

        query = query.filter(
            EmergencyAlertModel.patient_email.in_(patient_emails)
        )

    elif current_user.role == "admin":
        pass

    else:
        raise HTTPException(
            status_code=403,
            detail="Not authorized to view emergency alerts"
        )

    _apply_due_emergency_escalations(db)

    if status:
        query = query.filter(EmergencyAlertModel.status == status)

    alerts = query.order_by(
        EmergencyAlertModel.created_at.desc()
    ).all()

    return [_emergency_alert_payload(db, alert) for alert in alerts]


@app.get("/api/emergency-alerts/monitoring")
async def get_emergency_alert_monitoring(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role not in ["clinician", "admin"]:
        raise HTTPException(status_code=403, detail="Staff access is required")
    _apply_due_emergency_escalations(db)

    query = db.query(EmergencyAlertModel).filter(
        EmergencyAlertModel.status.in_(["active", "acknowledged"])
    )
    if current_user.role == "clinician":
        patient_emails = connected_patient_emails(db, current_user.email)
        if not patient_emails:
            return {
                "active": 0,
                "unassigned": 0,
                "overdue": 0,
                "escalated": 0,
                "level_three": 0,
                "response_target_minutes": EMERGENCY_REVIEW_MINUTES,
                "monitoring_mode": "backend-monitor-with-dashboard-polling",
            }
        query = query.filter(EmergencyAlertModel.patient_email.in_(patient_emails))

    now = datetime.utcnow()
    scoped_alerts = query.all()
    return {
        "active": len(scoped_alerts),
        "unassigned": sum(1 for item in scoped_alerts if not item.owner_email),
        "overdue": sum(
            1
            for item in scoped_alerts
            if item.next_review_at and item.next_review_at <= now
        ),
        "escalated": sum(
            1 for item in scoped_alerts if (item.escalation_level or 1) >= 2
        ),
        "level_three": sum(
            1 for item in scoped_alerts if (item.escalation_level or 1) >= 3
        ),
        "response_target_minutes": EMERGENCY_REVIEW_MINUTES,
        "monitoring_mode": "backend-monitor-with-dashboard-polling",
    }


@app.put("/api/emergency-alerts/{alert_id}/claim")
async def claim_emergency_alert(
    alert_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    alert = db.query(EmergencyAlertModel).filter(
        EmergencyAlertModel.id == alert_id
    ).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Emergency alert not found")
    _require_emergency_staff_access(db, alert, current_user)
    if alert.status == "resolved":
        raise HTTPException(status_code=409, detail="Resolved alerts cannot be claimed")
    if alert.owner_email and alert.owner_email != current_user.email:
        raise HTTPException(
            status_code=409,
            detail=f"This alert is already owned by {alert.owner_email}",
        )

    now = datetime.utcnow()
    newly_claimed = not alert.owner_email
    _assign_emergency_owner(alert, current_user, now=now)
    _record_emergency_event(
        db,
        alert,
        "claimed" if newly_claimed else "owner_check_in",
        actor_email=current_user.email,
        actor_role=current_user.role,
        notes="Staff ownership confirmed.",
    )
    db.commit()
    _queue_notification(
        db,
        user_email=alert.patient_email,
        title="SOS response assigned",
        message=f"{current_user.name} is now monitoring your SOS alert.",
    )
    db.commit()
    return _emergency_alert_payload(db, alert)


@app.put("/api/emergency-alerts/{alert_id}/acknowledge")
async def acknowledge_emergency_alert(
    alert_id: int,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role not in ["clinician", "admin"]:
        raise HTTPException(
            status_code=403,
            detail="Only clinicians or admins can acknowledge emergency alerts"
        )

    alert = db.query(EmergencyAlertModel).filter(
        EmergencyAlertModel.id == alert_id
    ).first()

    if not alert:
        raise HTTPException(status_code=404, detail="Emergency alert not found")

    _require_emergency_staff_access(db, alert, current_user)
    if alert.status == "resolved":
        raise HTTPException(status_code=409, detail="This alert is already resolved")

    now = datetime.utcnow()
    if not alert.owner_email:
        _assign_emergency_owner(alert, current_user, now=now)
    else:
        _require_owner_or_admin(alert, current_user)
    alert.status = "acknowledged"
    alert.acknowledged_by = current_user.email
    alert.acknowledged_at = now
    alert.last_monitored_at = now
    alert.next_review_at = now + timedelta(minutes=EMERGENCY_REVIEW_MINUTES)
    if alert.operational_state != "escalated":
        alert.operational_state = "owned"
    _record_emergency_event(
        db,
        alert,
        "acknowledged",
        actor_email=current_user.email,
        actor_role=current_user.role,
        notes="Staff acknowledged the SOS and confirmed operational review.",
    )

    db.commit()
    db.refresh(alert)

    create_notification(
        db=db,
        user_email=alert.patient_email,
        title="Emergency Alert Acknowledged",
        message=f"Your emergency alert was acknowledged by {current_user.name}.",
        notification_type="emergency"
    )

    return {
        "message": "Emergency alert acknowledged successfully",
        "alert_id": alert.id,
        "status": alert.status
    }


@app.put("/api/emergency-alerts/{alert_id}/check-in")
async def check_in_emergency_alert(
    alert_id: int,
    note_data: EmergencyAlertNoteRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not note_data.notes or not note_data.notes.strip():
        raise HTTPException(status_code=400, detail="A check-in note is required")
    alert = db.query(EmergencyAlertModel).filter(
        EmergencyAlertModel.id == alert_id
    ).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Emergency alert not found")
    _require_emergency_staff_access(db, alert, current_user)
    _require_owner_or_admin(alert, current_user)
    if alert.status == "resolved":
        raise HTTPException(status_code=409, detail="This alert is already resolved")

    now = datetime.utcnow()
    alert.last_monitored_at = now
    alert.next_review_at = now + timedelta(minutes=EMERGENCY_REVIEW_MINUTES)
    _record_emergency_event(
        db,
        alert,
        "staff_check_in",
        actor_email=current_user.email,
        actor_role=current_user.role,
        notes=note_data.notes,
    )
    db.commit()
    return _emergency_alert_payload(db, alert)


@app.put("/api/emergency-alerts/{alert_id}/escalate")
async def escalate_emergency_alert(
    alert_id: int,
    escalation_data: EmergencyAlertEscalationRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not escalation_data.reason or not escalation_data.reason.strip():
        raise HTTPException(status_code=400, detail="An escalation reason is required")
    alert = db.query(EmergencyAlertModel).filter(
        EmergencyAlertModel.id == alert_id
    ).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Emergency alert not found")
    _require_emergency_staff_access(db, alert, current_user)
    _require_owner_or_admin(alert, current_user)
    if alert.status == "resolved":
        raise HTTPException(status_code=409, detail="This alert is already resolved")
    if (alert.escalation_level or 1) >= EMERGENCY_MAX_ESCALATION_LEVEL:
        raise HTTPException(status_code=409, detail="Alert is already at level 3")

    now = datetime.utcnow()
    alert.escalation_level = (alert.escalation_level or 1) + 1
    alert.operational_state = "escalated"
    alert.last_monitored_at = now
    alert.next_review_at = now + timedelta(minutes=EMERGENCY_REVIEW_MINUTES)
    _record_emergency_event(
        db,
        alert,
        "manually_escalated",
        actor_email=current_user.email,
        actor_role=current_user.role,
        notes=escalation_data.reason,
    )
    admin_emails = [row[0] for row in db.query(AdminModel.email).all()]
    for admin_email in admin_emails:
        _queue_notification(
            db,
            user_email=admin_email,
            title=f"SOS escalated to level {alert.escalation_level}",
            message=(
                f"{current_user.name} escalated the alert from "
                f"{alert.patient_name or alert.patient_email}."
            ),
        )
    db.commit()
    return _emergency_alert_payload(db, alert)


@app.put("/api/emergency-alerts/{alert_id}/resolve")
async def resolve_emergency_alert(
    alert_id: int,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role not in ["clinician", "admin"]:
        raise HTTPException(
            status_code=403,
            detail="Only clinicians or admins can resolve emergency alerts"
        )

    alert = db.query(EmergencyAlertModel).filter(
        EmergencyAlertModel.id == alert_id
    ).first()

    if not alert:
        raise HTTPException(status_code=404, detail="Emergency alert not found")

    _require_emergency_staff_access(db, alert, current_user)
    if alert.status == "resolved":
        return {
            "message": "Emergency alert is already resolved",
            "alert_id": alert.id,
            "status": alert.status,
        }

    now = datetime.utcnow()
    if not alert.owner_email:
        _assign_emergency_owner(alert, current_user, now=now)
    else:
        _require_owner_or_admin(alert, current_user)
    alert.status = "resolved"
    alert.resolved_by = current_user.email
    alert.resolved_at = now
    alert.operational_state = "resolved"
    alert.last_monitored_at = now
    alert.next_review_at = None
    _record_emergency_event(
        db,
        alert,
        "resolved",
        actor_email=current_user.email,
        actor_role=current_user.role,
        notes="Staff marked the SOS response workflow as resolved.",
    )

    db.commit()
    db.refresh(alert)

    create_notification(
        db=db,
        user_email=alert.patient_email,
        title="Emergency Alert Resolved",
        message=f"Your emergency alert was resolved by {current_user.name}.",
        notification_type="emergency"
    )

    return {
        "message": "Emergency alert resolved successfully",
        "alert_id": alert.id,
        "status": alert.status
    }


@app.delete("/api/emergency-alerts/{alert_id}")
async def delete_emergency_alert(
    alert_id: int,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    alert = db.query(EmergencyAlertModel).filter(
        EmergencyAlertModel.id == alert_id
    ).first()

    if not alert:
        raise HTTPException(
            status_code=404,
            detail="Emergency alert not found"
        )

    if current_user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Only administrators can delete emergency alert records"
        )
    raise HTTPException(
        status_code=409,
        detail=(
            "SOS records are retained with their response history. "
            "Resolve the alert instead of deleting it."
        ),
    )


# ================== NOTIFICATION SYSTEM ==================

@app.get("/api/notifications")
async def get_notifications(
    unread_only: Optional[bool] = False,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    query = db.query(NotificationModel).filter(
        NotificationModel.user_email == current_user.email
    )

    if unread_only:
        query = query.filter(NotificationModel.is_read == False)

    notifications = query.order_by(
        NotificationModel.created_at.desc()
    ).all()

    return {
        "notifications": [
            {
                "id": n.id,
                "user_email": n.user_email,
                "title": n.title,
                "message": n.message,
                "type": n.type,
                "is_read": n.is_read,
                "created_at": n.created_at.isoformat() if n.created_at else None
            }
            for n in notifications
        ]
    }


@app.get("/api/notifications/unread-count")
async def get_unread_notification_count(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    count = db.query(NotificationModel).filter(
        NotificationModel.user_email == current_user.email,
        NotificationModel.is_read == False
    ).count()

    return {"unread_count": count}


@app.put("/api/notifications/{notification_id}/read")
async def mark_notification_as_read(
    notification_id: int,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    notification = db.query(NotificationModel).filter(
        NotificationModel.id == notification_id,
        NotificationModel.user_email == current_user.email
    ).first()

    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    notification.is_read = True
    db.commit()
    db.refresh(notification)

    return {"message": "Notification marked as read"}


@app.put("/api/notifications/read-all")
async def mark_all_notifications_as_read(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    db.query(NotificationModel).filter(
        NotificationModel.user_email == current_user.email,
        NotificationModel.is_read == False
    ).update({"is_read": True})

    db.commit()

    return {"message": "All notifications marked as read"}


@app.delete("/api/notifications/{notification_id}")
async def delete_notification(
    notification_id: int,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    notification = db.query(NotificationModel).filter(
        NotificationModel.id == notification_id,
        NotificationModel.user_email == current_user.email
    ).first()

    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    db.delete(notification)
    db.commit()

    return {"message": "Notification deleted successfully"}


@app.post("/api/admin/notifications")
async def admin_create_notification(
    notification_data: NotificationCreate,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can create notifications")

    notification = create_notification(
        db=db,
        user_email=notification_data.user_email,
        title=notification_data.title,
        message=notification_data.message,
        notification_type=notification_data.type or "admin"
    )

    return {
        "message": "Notification created successfully",
        "notification_id": notification.id
    }

# ================== MEDICAL RECORD VERSION HISTORY ==================

@app.get("/api/records/{record_id}/versions")
async def get_record_versions(
    record_id: int,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    record = db.query(RecordModel).filter(RecordModel.id == record_id).first()

    if not record:
        raise HTTPException(status_code=404, detail="Medical record not found")

    if current_user.role == "patient":
        if record.patient_email != current_user.email:
            raise HTTPException(status_code=403, detail="You can view only your own record versions")

    elif current_user.role == "clinician":
        connection = db.query(MessageRequestModel).filter(
            MessageRequestModel.patient_email == record.patient_email,
            MessageRequestModel.clinician_email == current_user.email,
            MessageRequestModel.status == "accepted"
        ).first()

        if not connection:
            raise HTTPException(status_code=403, detail="You can view versions only for connected patients")

    elif current_user.role == "admin":
        pass

    else:
        raise HTTPException(status_code=403, detail="Not authorized")

    versions = db.query(RecordVersionModel).filter(
        RecordVersionModel.record_id == record_id
    ).order_by(RecordVersionModel.version_number.desc()).all()

    return {
        "record": {
            "id": record.id,
            "name": record.name,
            "type": record.type,
            "category": record.category,
            "patient_email": record.patient_email,
            "uploaded_at": record.uploaded_at.isoformat() if record.uploaded_at else None
        },
        "versions": [
            {
                "id": version.id,
                "record_id": version.record_id,
                "version_number": version.version_number,
                "file_name": version.file_name,
                "file_type": version.file_type,
                "file_size": version.file_size,
                "change_notes": version.change_notes,
                "analysis_summary": version.analysis_summary,
                "key_findings": version.key_findings,
                "is_latest": version.is_latest,
                "uploaded_by": version.uploaded_by,
                "uploaded_at": version.uploaded_at.isoformat() if version.uploaded_at else None
            }
            for version in versions
        ]
    }


@app.post("/api/records/{record_id}/versions")
async def upload_record_version(
    record_id: int,
    file: UploadFile = File(...),
    change_notes: Optional[str] = Form(None),
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    record = db.query(RecordModel).filter(RecordModel.id == record_id).first()

    if not record:
        raise HTTPException(status_code=404, detail="Medical record not found")

    if current_user.role != "patient":
        raise HTTPException(status_code=403, detail="Only patients can upload new record versions")

    if record.patient_email != current_user.email:
        raise HTTPException(status_code=403, detail="You can upload versions only for your own records")

    original_name, extension, file_type, content = await read_validated_upload(
        file,
        allowed_extensions=MEDICAL_UPLOAD_EXTENSIONS,
        max_bytes=MEDICAL_UPLOAD_MAX_BYTES,
    )
    file_path = store_upload(
        content=content,
        storage_root=UPLOAD_STORAGE_ROOT,
        purpose=f"medical-records/{record_id}/versions",
        owner_key=current_user.email,
        extension=extension,
    )

    extracted_text = None
    analysis_summary = None
    metrics_data = None
    key_findings = None

    try:
        extracted_text = extract_text_from_path(str(file_path))

        if extracted_text:
            try:
                analysis_result = generate_document_summary(extracted_text)

                if isinstance(analysis_result, dict):
                    analysis_summary = analysis_result.get("summary")
                    metrics_data = json.dumps(analysis_result.get("metrics", {}))
                    key_findings = json.dumps(analysis_result.get("key_findings", []))
                else:
                    analysis_summary = str(analysis_result)

            except Exception as analysis_error:
                print("Version AI analysis failed:", analysis_error)

    except Exception as extract_error:
        print("Version text extraction failed:", extract_error)

    version = create_record_version(
        db=db,
        record_id=record.id,
        patient_email=record.patient_email,
        uploaded_by=current_user.email,
        file_name=original_name,
        file_path=str(file_path),
        file_type=file_type,
        file_size=len(content),
        change_notes=change_notes,
        analysis_summary=analysis_summary,
        extracted_text=extracted_text,
        metrics_data=metrics_data,
        key_findings=key_findings
    )

    record.file_path = str(file_path)
    record.uploaded_at = datetime.utcnow()

    if analysis_summary:
        record.analysis_summary = analysis_summary
    if extracted_text:
        record.extracted_text = extracted_text
    if metrics_data:
        record.metrics_data = metrics_data
    if key_findings:
        record.key_findings = key_findings

    db.commit()
    db.refresh(record)

    return {
        "message": "New record version uploaded successfully",
        "record_id": record.id,
        "version_id": version.id,
        "version_number": version.version_number
    }


@app.get("/api/records/versions/{version_id}/download")
async def download_record_version(
    version_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    version = db.query(RecordVersionModel).filter(
        RecordVersionModel.id == version_id
    ).first()

    if not version:
        raise HTTPException(status_code=404, detail="Version not found")

    if current_user.role == "patient":
        if version.patient_email != current_user.email:
            raise HTTPException(status_code=403, detail="Not authorized")

    elif current_user.role == "clinician":
        connection = db.query(MessageRequestModel).filter(
            MessageRequestModel.patient_email == version.patient_email,
            MessageRequestModel.clinician_email == current_user.email,
            MessageRequestModel.status == "accepted"
        ).first()

        if not connection:
            raise HTTPException(status_code=403, detail="Not authorized")

    elif current_user.role == "admin":
        pass

    else:
        raise HTTPException(status_code=403, detail="Not authorized")

    if not os.path.exists(version.file_path):
        raise HTTPException(status_code=404, detail="File not found on server")

    return FileResponse(
        path=version.file_path,
        filename=version.file_name,
        media_type=version.file_type or "application/octet-stream"
    )

@app.delete("/api/records/{record_id}")
async def delete_record(
    record_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    record = db.query(RecordModel).filter(
        RecordModel.id == record_id
    ).first()

    if not record:
        raise HTTPException(status_code=404, detail="Record not found")

    if current_user.role == "patient":
        if record.patient_email != current_user.email:
            raise HTTPException(
                status_code=403,
                detail="Not authorized to delete this record"
            )
    elif current_user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Only patient or admin can delete records"
        )

    try:
        # Delete RAG chunks first
        try:
            delete_record_chunks(record.patient_email, record.id)
        except Exception as rag_error:
            print("RAG delete failed:", rag_error)

        # Delete all version rows first
        versions = db.query(RecordVersionModel).filter(
            RecordVersionModel.record_id == record_id
        ).all()

        for version in versions:
            if version.file_path and os.path.exists(version.file_path):
                try:
                    os.remove(version.file_path)
                except Exception as file_error:
                    print("Version file delete failed:", file_error)

            db.delete(version)

        db.flush()

        # Delete main record file
        if record.file_path and os.path.exists(record.file_path):
            try:
                os.remove(record.file_path)
            except Exception as file_error:
                print("Main record file delete failed:", file_error)

        # Delete main record row last
        db.delete(record)
        db.commit()

        return {
            "message": "Record and version history deleted successfully"
        }

    except Exception as e:
        db.rollback()
        print("Delete record error:", e)
        raise HTTPException(
            status_code=500,
            detail="Failed to delete record"
        )

# ================== AUTH ==================
class ForgotPasswordRequest(BaseModel):
    email: EmailStr


@app.post("/api/auth/forgot-password")
async def forgot_password(
    data: ForgotPasswordRequest,
    db: Session = Depends(get_db)
):
    # Always return same message (security)
    response_msg = {
        "message": "If the email exists, a reset link has been sent."
    }

    email = data.email

    # Check if email exists in any role
    if not email_exists(db, email):
        return response_msg

    # Find user (patient / clinician / admin)
    user = (
        db.query(PatientModel).filter(PatientModel.email == email).first()
        or db.query(ClinicianModel).filter(ClinicianModel.email == email).first()
        or db.query(AdminModel).filter(AdminModel.email == email).first()
    )

    if not user:
        return response_msg

    # Generate secure token
    token = secrets.token_urlsafe(32)
    expiry = datetime.utcnow() + timedelta(minutes=15)

    user.reset_password_token = hashlib.sha256(token.encode("utf-8")).hexdigest()
    user.reset_password_expires = expiry
    db.commit()

    # Reset link (frontend)
    reset_link = f"{FRONTEND_URL}/reset-password?token={token}"

    # TEMP: print instead of email
    # print("🔐 RESET LINK:", reset_link)
    # send_reset_email(email, reset_link)


    return response_msg
class ResetPasswordRequest(BaseModel):
    token: str
    password: str


@app.post("/api/auth/reset-password")
async def reset_password(
    data: ResetPasswordRequest,
    db: Session = Depends(get_db)
):
    # Validate new password using your existing logic
    validate_password(data.password)

    token_digest = hashlib.sha256(data.token.encode("utf-8")).hexdigest()

    # Find user with a valid hashed token
    user = (
        db.query(PatientModel).filter(
            PatientModel.reset_password_token == token_digest,
            PatientModel.reset_password_expires > datetime.utcnow()
        ).first()
        or db.query(ClinicianModel).filter(
            ClinicianModel.reset_password_token == token_digest,
            ClinicianModel.reset_password_expires > datetime.utcnow()
        ).first()
        or db.query(AdminModel).filter(
            AdminModel.reset_password_token == token_digest,
            AdminModel.reset_password_expires > datetime.utcnow()
        ).first()
    )

    if not user:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired reset token"
        )

    # Update password
    user.hashed_password = get_password_hash(data.password)
    user.reset_password_token = None
    user.reset_password_expires = None

    db.query(UserSessionModel).filter(
        UserSessionModel.user_email == user.email,
        UserSessionModel.user_role == user.role,
        UserSessionModel.revoked_at.is_(None),
    ).update(
        {
            UserSessionModel.revoked_at: datetime.utcnow(),
            UserSessionModel.revoke_reason: "password_reset",
        },
        synchronize_session=False,
    )
    db.commit()

    return {"message": "Password reset successful. You can now login."}


@app.post("/api/auth/register", response_model=RegisterResponse)
async def register(user_data: UserRegister, db: Session = Depends(get_db)):
    if user_data.role not in {"patient", "clinician"}:
        raise HTTPException(status_code=403, detail="Admin registration is not available from this portal")

    validate_password(user_data.password)
    if email_exists(db, user_data.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    hashed_password = get_password_hash(user_data.password)
    # verification_code = generate_verification_code()
    # verification_expires = datetime.utcnow() + timedelta(minutes=10)
    if user_data.role == "patient":
        new_user = PatientModel(name=user_data.name, email=user_data.email,
                                hashed_password=hashed_password, role="patient",
                                email_verified=True,
                                gender=user_data.gender,
                                # email_verification_code=verification_code,
                                # email_verification_expires=verification_expires
                                )
    elif user_data.role == "clinician":
        new_user = ClinicianModel(
            name=user_data.name, 
            email=user_data.email,
            hashed_password=hashed_password, 
            role="clinician",
            gender=user_data.gender,
            specialization=user_data.specialization,
            department=user_data.department,
            years_of_experience=user_data.years_of_experience,
            approval_status="pending",  # Set to pending by default
            email_verified=True,
            # email_verification_code=verification_code,
            # email_verification_expires=verification_expires
        )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    from models import ClinicianJoinRequest

    if user_data.role == "clinician":
        join_request = ClinicianJoinRequest(
            name=user_data.name,
            email=user_data.email,
            specialization=user_data.specialization,
            department=user_data.department,
            years_of_experience=user_data.years_of_experience,
            status="pending"
    )

        db.add(join_request)
        db.commit()
    return {
        "message": "User registered successfully",
        "email": new_user.email,
        "role": new_user.role
    }

# @app.post("/api/auth/verify-email")
# async def verify_email(data: VerifyEmailRequest, db: Session = Depends(get_db)):
#     user = (
#         db.query(PatientModel).filter(PatientModel.email == data.email).first()
#         or db.query(ClinicianModel).filter(ClinicianModel.email == data.email).first()
#         or db.query(AdminModel).filter(AdminModel.email == data.email).first()
#     )

#     if not user:
#         raise HTTPException(status_code=404, detail="User not found")

#     if user.email_verified:
#         return {"message": "Email already verified. Please login."}

#     if not user.email_verification_code or not user.email_verification_expires:
#         raise HTTPException(status_code=400, detail="Verification code not found. Please register again.")

#     if user.email_verification_expires < datetime.utcnow():
#         raise HTTPException(status_code=400, detail="Verification code expired. Please register again.")

#     if user.email_verification_code != data.code:
#         raise HTTPException(status_code=400, detail="Invalid verification code")

#     user.email_verified = True
#     user.email_verification_code = None
#     user.email_verification_expires = None
#     db.commit()

#     return {"message": "Email verified successfully. Please login."}

@app.post("/api/auth/login", response_model=Token)
async def login(
    user_data: UserLogin,
    request: Request,
    db: Session = Depends(get_db),
):
    identifier = user_data.email.strip()
    default_admin_username = os.getenv("DEFAULT_ADMIN_USERNAME", "").strip()
    default_admin_email = os.getenv("DEFAULT_ADMIN_EMAIL", "").strip()

    if default_admin_username and identifier == default_admin_username:
        identifier = default_admin_email

    # find user in all three tables
    user = None

    # Check patient table
    user = db.query(PatientModel).filter(PatientModel.email == identifier).first()
    if not user:
        # Check clinician table
        user = db.query(ClinicianModel).filter(ClinicianModel.email == identifier).first()
    if not user:
        # Check admin table
        user = db.query(AdminModel).filter(AdminModel.email == identifier).first()
    
    if not user or not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    if not getattr(user, "is_active", True):
        raise HTTPException(status_code=403, detail="This account is inactive")

    if REQUIRE_EMAIL_VERIFICATION and not getattr(user, "email_verified", False):
        raise HTTPException(status_code=403, detail="Email not verified")

    if getattr(user, "role", None) == "clinician":
        approval_status = getattr(user, "approval_status", "approved")
        if approval_status != "approved":
            raise HTTPException(
                status_code=403,
                detail="Clinician account pending approval. Please wait for admin approval."
            )
    
    access_token, session = create_user_session_token(user, db, request)
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_at": session.expires_at.isoformat(),
        "session_id": session.id,
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role
        }
    }
@app.post("/api/auth/google", response_model=Token)
async def google_auth(
    auth_data: GoogleAuthRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    try:
        # ✅ VERIFY GOOGLE ID TOKEN
        idinfo = id_token.verify_oauth2_token(
            auth_data.token,
            requests.Request(),
            os.getenv("GOOGLE_CLIENT_ID")
        )

        google_email = idinfo.get("email")
        if not google_email:
            raise HTTPException(status_code=400, detail="Google email not found")
        google_name = idinfo.get("name") or google_email.split("@")[0]

    except Exception as e:
        print("❌ GOOGLE TOKEN ERROR:", e)
        raise HTTPException(status_code=401, detail="Invalid Google token")

    # ✅ Check if user exists
    user = get_user_by_email_and_role(db, google_email, auth_data.role)

    if not user and email_exists(db, google_email):
        raise HTTPException(
            status_code=409,
            detail="This email is already registered with a different role. Please sign in with the original account type."
        )

    if auth_data.role == "admin" and not user:
        raise HTTPException(status_code=403, detail="Admin sign-up is not available from Google sign-in")

    if not user:
        hashed_password = get_password_hash("google_auth_no_password")

        if auth_data.role == "patient":
            user = PatientModel(
                name=google_name,
                email=google_email,
                hashed_password=hashed_password,
                role="patient",
                email_verified=True
            )
        elif auth_data.role == "clinician":
            user = ClinicianModel(
                name=google_name,
                email=google_email,
                hashed_password=hashed_password,
                role="clinician",
                email_verified=True
            )
        else:
            raise HTTPException(status_code=400, detail="Invalid role")

        db.add(user)
        db.commit()
        db.refresh(user)

    if not getattr(user, "email_verified", True):
        user.email_verified = True
        user.email_verification_code = None
        user.email_verification_expires = None
        db.commit()

    if not getattr(user, "is_active", True):
        raise HTTPException(status_code=403, detail="This account is inactive")
    if user.role == "clinician" and getattr(user, "approval_status", None) != "approved":
        raise HTTPException(
            status_code=403,
            detail="Clinician account pending approval. Please wait for admin approval.",
        )

    access_token, session = create_user_session_token(user, db, request)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "expires_at": session.expires_at.isoformat(),
        "session_id": session.id,
        "user": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "role": user.role
        }
    }


@app.get("/api/auth/me")
async def get_current_user_info(current_user = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "role": current_user.role
    }


@app.post("/api/auth/logout")
async def logout_current_session(
    request: Request,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session_id = getattr(request.state, "session_id", None)
    session = db.query(UserSessionModel).filter(
        UserSessionModel.id == session_id,
        UserSessionModel.user_email == current_user.email,
        UserSessionModel.user_role == current_user.role,
    ).first()
    if session and session.revoked_at is None:
        session.revoked_at = datetime.utcnow()
        session.revoke_reason = "user_logout"
        db.commit()
    return {"message": "Session ended"}


@app.get("/api/auth/sessions")
async def list_user_sessions(
    request: Request,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    now = datetime.utcnow()
    sessions = db.query(UserSessionModel).filter(
        UserSessionModel.user_email == current_user.email,
        UserSessionModel.user_role == current_user.role,
        UserSessionModel.expires_at > now,
    ).order_by(UserSessionModel.last_seen_at.desc()).all()
    current_session_id = getattr(request.state, "session_id", None)
    return {
        "sessions": [
            {
                "id": item.id,
                "user_agent": item.user_agent or "Unknown device",
                "ip_address": item.ip_address,
                "created_at": item.created_at.isoformat() if item.created_at else None,
                "last_seen_at": item.last_seen_at.isoformat() if item.last_seen_at else None,
                "expires_at": item.expires_at.isoformat() if item.expires_at else None,
                "revoked": item.revoked_at is not None,
                "current": item.id == current_session_id,
            }
            for item in sessions
        ]
    }


@app.delete("/api/auth/sessions/{session_id}")
async def revoke_user_session(
    session_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = db.query(UserSessionModel).filter(
        UserSessionModel.id == session_id,
        UserSessionModel.user_email == current_user.email,
        UserSessionModel.user_role == current_user.role,
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.revoked_at is None:
        session.revoked_at = datetime.utcnow()
        session.revoke_reason = "user_revoked"
        db.commit()
    return {"message": "Session revoked"}

@app.get("/api/messages")
async def get_messages(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    messages = db.query(MessageModel).filter(
        (MessageModel.recipient_email == current_user.email) | 
        (MessageModel.sender_email == current_user.email)
    ).order_by(MessageModel.sent_at.desc()).all()
    
    return {
        "messages": [
            {
                "id": msg.id,
                "from_user": msg.sender_email,
                "message": msg.message,
                "time": str(msg.sent_at),
                "unread": not msg.read
            }
            for msg in messages
        ]
    }

class DeleteAccountResponse(BaseModel):
    message: str

@app.delete("/api/auth/delete-account")
async def delete_account(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    logging.info("DELETE request received for user: %s", current_user.email)

    try:
        user_model_map = {
            "patient": PatientModel,
            "clinician": ClinicianModel,
            "admin": AdminModel
        }
        user_model = user_model_map.get(current_user.role)
        if not user_model:
            raise HTTPException(status_code=400, detail="Invalid user role")
        
        user = db.query(user_model).filter(user_model.email == current_user.email).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Delete messages
        db.query(MessageModel).filter(
    (MessageModel.sender_email == current_user.email) | 
    (MessageModel.recipient_email == current_user.email)
).delete(synchronize_session=False)

        
        # Delete patient records if user is a patient
        if current_user.role == "patient":
            db.query(RecordModel).filter(RecordModel.patient_email == current_user.email).delete(synchronize_session=False)
        
        # Delete the user
        db.delete(user)
        db.commit()
        
        return {"message": "Account deleted successfully"}

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error deleting account: {str(e)}")

@app.get("/api/records")
async def get_records(
    q: Optional[str] = Query(None, max_length=100),
    category_code: Optional[str] = Query(None, max_length=50),
    record_type: Optional[str] = Query(None, max_length=100),
    patient_email: Optional[str] = Query(None, max_length=100),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    allowed_patients = accessible_patient_emails(db, current_user)
    query = db.query(RecordModel)
    if allowed_patients is not None:
        if not allowed_patients:
            return {"records": [], "total": 0, "page": page, "page_size": page_size}
        query = query.filter(RecordModel.patient_email.in_(allowed_patients))

    if patient_email:
        require_patient_access(db, current_user, patient_email)
        query = query.filter(RecordModel.patient_email == patient_email)
    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.filter(
            or_(
                RecordModel.name.ilike(term),
                RecordModel.type.ilike(term),
                RecordModel.category.ilike(term),
                RecordModel.tags.ilike(term),
                RecordModel.analysis_summary.ilike(term),
            )
        )
    if category_code:
        normalized_code, _ = normalize_category(category_code)
        query = query.filter(RecordModel.category_code == normalized_code)
    if record_type:
        query = query.filter(RecordModel.type == record_type.strip())

    normalized_from = parse_iso_date(date_from, "date_from")
    normalized_to = parse_iso_date(date_to, "date_to")
    if normalized_from:
        query = query.filter(RecordModel.uploaded_at >= datetime.strptime(normalized_from, "%Y-%m-%d"))
    if normalized_to:
        query = query.filter(
            RecordModel.uploaded_at < datetime.strptime(normalized_to, "%Y-%m-%d") + timedelta(days=1)
        )

    total = query.count()
    records = query.order_by(RecordModel.uploaded_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size).all()

    return {
        "records": [
            {
                "id": rec.id,
                "patient_email": rec.patient_email if current_user.role != "patient" else None,
                "type": rec.type,
                "name": rec.name,
                "date": str(rec.uploaded_at.date()),
                "category": rec.category,
                "category_code": getattr(rec, "category_code", "other") or "other",
                "tags": _safe_json_loads(getattr(rec, "tags", None), []),
                "source_date": getattr(rec, "source_date", None),
                "analysis_summary": rec.analysis_summary or "No analysis available",
                "has_metrics": bool(rec.metrics_data),
                "findings_count": len(_safe_json_loads(rec.key_findings, []))
            }
            for rec in records
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@app.get("/api/records/categories")
async def get_record_categories(current_user=Depends(get_current_user)):
    return {"categories": RECORD_CATEGORIES}


@app.patch("/api/records/{record_id}/classification")
async def update_record_classification(
    record_id: int,
    classification: dict,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    record = db.query(RecordModel).filter(RecordModel.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    require_patient_access(db, current_user, record.patient_email)

    code, label = normalize_category(
        classification.get("category_code") or classification.get("category")
    )
    tags = normalize_tags(
        json.dumps(classification.get("tags", []))
        if isinstance(classification.get("tags"), list)
        else classification.get("tags")
    )
    source_date = parse_iso_date(classification.get("source_date"), "source_date")
    record.category_code = code
    record.category = label
    record.tags = json.dumps(tags)
    record.source_date = source_date
    db.commit()
    return {
        "message": "Record classification updated",
        "record": {
            "id": record.id,
            "category": record.category,
            "category_code": record.category_code,
            "tags": tags,
            "source_date": record.source_date,
        },
    }


@app.get("/api/clinical/search")
async def search_clinical_data(
    q: Optional[str] = Query(None, max_length=100),
    resource_types: str = Query("records,prescriptions,appointments,patients", max_length=120),
    patient_email: Optional[str] = Query(None, max_length=100),
    category_code: Optional[str] = Query(None, max_length=50),
    status_filter: Optional[str] = Query(None, alias="status", max_length=30),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Role-scoped search across the main clinical resources."""

    requested_types = {
        item.strip().lower()
        for item in resource_types.split(",")
        if item.strip()
    }
    allowed_types = {"records", "prescriptions", "appointments", "patients"}
    if not requested_types or not requested_types.issubset(allowed_types):
        raise HTTPException(status_code=400, detail="Invalid resource_types value")

    normalized_from = parse_iso_date(date_from, "date_from")
    normalized_to = parse_iso_date(date_to, "date_to")
    allowed_patients = accessible_patient_emails(db, current_user)
    if patient_email:
        require_patient_access(db, current_user, patient_email)
        scoped_patients: Optional[Set[str]] = {patient_email}
    else:
        scoped_patients = allowed_patients
    if scoped_patients is not None and not scoped_patients:
        return {
            "results": [],
            "facets": {"resource_types": {}, "categories": {}},
            "total": 0,
            "page": page,
            "page_size": page_size,
        }

    text_query = (q or "").strip()
    text_term = f"%{text_query}%" if text_query else None
    results = []

    if "records" in requested_types:
        record_query = db.query(RecordModel)
        if scoped_patients is not None:
            record_query = record_query.filter(RecordModel.patient_email.in_(scoped_patients))
        if text_term:
            record_query = record_query.filter(
                or_(
                    RecordModel.name.ilike(text_term),
                    RecordModel.type.ilike(text_term),
                    RecordModel.category.ilike(text_term),
                    RecordModel.tags.ilike(text_term),
                    RecordModel.analysis_summary.ilike(text_term),
                )
            )
        if category_code:
            normalized_code, _ = normalize_category(category_code)
            record_query = record_query.filter(RecordModel.category_code == normalized_code)
        if normalized_from:
            record_query = record_query.filter(
                RecordModel.uploaded_at >= datetime.strptime(normalized_from, "%Y-%m-%d")
            )
        if normalized_to:
            record_query = record_query.filter(
                RecordModel.uploaded_at < datetime.strptime(normalized_to, "%Y-%m-%d") + timedelta(days=1)
            )
        for record in record_query.order_by(RecordModel.uploaded_at.desc()).limit(250).all():
            results.append(
                {
                    "resource_type": "record",
                    "id": record.id,
                    "patient_email": record.patient_email,
                    "title": record.name,
                    "subtitle": record.analysis_summary or record.type,
                    "category": record.category,
                    "category_code": getattr(record, "category_code", "other") or "other",
                    "status": None,
                    "date": (
                        getattr(record, "source_date", None)
                        or (record.uploaded_at.isoformat() if record.uploaded_at else None)
                    ),
                    "tags": _safe_json_loads(getattr(record, "tags", None), []),
                }
            )

    if "prescriptions" in requested_types:
        prescription_query = db.query(PrescriptionModel)
        if scoped_patients is not None:
            prescription_query = prescription_query.filter(
                PrescriptionModel.patient_email.in_(scoped_patients)
            )
        if text_term:
            prescription_query = prescription_query.filter(
                or_(
                    PrescriptionModel.medicine_name.ilike(text_term),
                    PrescriptionModel.diagnosis.ilike(text_term),
                    PrescriptionModel.instructions.ilike(text_term),
                )
            )
        if status_filter:
            prescription_query = prescription_query.filter(
                PrescriptionModel.status == status_filter
            )
        if normalized_from:
            prescription_query = prescription_query.filter(
                PrescriptionModel.created_at >= datetime.strptime(normalized_from, "%Y-%m-%d")
            )
        if normalized_to:
            prescription_query = prescription_query.filter(
                PrescriptionModel.created_at < datetime.strptime(normalized_to, "%Y-%m-%d") + timedelta(days=1)
            )
        for prescription in prescription_query.order_by(PrescriptionModel.created_at.desc()).limit(250).all():
            results.append(
                {
                    "resource_type": "prescription",
                    "id": prescription.id,
                    "patient_email": prescription.patient_email,
                    "title": prescription.medicine_name,
                    "subtitle": prescription.diagnosis or prescription.instructions or "Prescription",
                    "category": "Prescription",
                    "category_code": "prescription",
                    "status": prescription.status,
                    "date": prescription.created_at.isoformat() if prescription.created_at else None,
                    "tags": [],
                }
            )

    if "appointments" in requested_types:
        appointment_query = db.query(AppointmentModel)
        if scoped_patients is not None:
            appointment_query = appointment_query.filter(
                AppointmentModel.patient_email.in_(scoped_patients)
            )
        if text_term:
            appointment_query = appointment_query.filter(
                or_(
                    AppointmentModel.reason.ilike(text_term),
                    AppointmentModel.notes.ilike(text_term),
                    AppointmentModel.clinician_email.ilike(text_term),
                )
            )
        if status_filter:
            appointment_query = appointment_query.filter(
                AppointmentModel.status == status_filter
            )
        if normalized_from:
            appointment_query = appointment_query.filter(
                AppointmentModel.appointment_date >= normalized_from
            )
        if normalized_to:
            appointment_query = appointment_query.filter(
                AppointmentModel.appointment_date <= normalized_to
            )
        for appointment in appointment_query.order_by(
            AppointmentModel.appointment_date.desc(),
            AppointmentModel.appointment_time.desc(),
        ).limit(250).all():
            results.append(
                {
                    "resource_type": "appointment",
                    "id": appointment.id,
                    "patient_email": appointment.patient_email,
                    "title": f"Appointment with {appointment.clinician_email}",
                    "subtitle": appointment.reason,
                    "category": appointment.appointment_type,
                    "category_code": None,
                    "status": appointment.status,
                    "date": f"{appointment.appointment_date}T{appointment.appointment_time}",
                    "tags": [],
                }
            )

    if "patients" in requested_types:
        patient_query = db.query(PatientModel)
        if scoped_patients is not None:
            patient_query = patient_query.filter(PatientModel.email.in_(scoped_patients))
        if text_term:
            patient_query = patient_query.filter(
                or_(PatientModel.name.ilike(text_term), PatientModel.email.ilike(text_term))
            )
        for patient in patient_query.order_by(PatientModel.name.asc()).limit(250).all():
            results.append(
                {
                    "resource_type": "patient",
                    "id": patient.id,
                    "patient_email": patient.email,
                    "title": patient.name,
                    "subtitle": f"Patient profile · {patient.status or 'unknown'}",
                    "category": "Patient",
                    "category_code": None,
                    "status": patient.status,
                    "date": patient.created_at.isoformat() if patient.created_at else None,
                    "tags": [],
                }
            )

    results.sort(key=lambda item: item.get("date") or "", reverse=True)
    resource_facets: Dict[str, int] = {}
    category_facets: Dict[str, int] = {}
    for item in results:
        resource_facets[item["resource_type"]] = resource_facets.get(item["resource_type"], 0) + 1
        if item.get("category"):
            category_facets[item["category"]] = category_facets.get(item["category"], 0) + 1

    total = len(results)
    offset = (page - 1) * page_size
    return {
        "results": results[offset:offset + page_size],
        "facets": {"resource_types": resource_facets, "categories": category_facets},
        "total": total,
        "page": page,
        "page_size": page_size,
    }

@app.get("/api/patients/me/timeline")
async def get_my_health_timeline(
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role != "patient":
        raise HTTPException(
            status_code=403,
            detail="Only patients can access their own health timeline"
        )

    return build_patient_health_timeline(
        patient_email=current_user.email,
        db=db,
        include_notifications=True
    )

@app.get("/api/patients/{patient_email}/timeline")
async def get_patient_health_timeline(
    patient_email: str,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    patient = db.query(PatientModel).filter(
        PatientModel.email == patient_email
    ).first()

    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    if current_user.role == "patient":
        if current_user.email != patient_email:
            raise HTTPException(
                status_code=403,
                detail="You can access only your own timeline"
            )

    elif current_user.role == "clinician":
        connection = db.query(MessageRequestModel).filter(
            MessageRequestModel.patient_email == patient_email,
            MessageRequestModel.clinician_email == current_user.email,
            MessageRequestModel.status == "accepted"
        ).first()

        if not connection:
            raise HTTPException(
                status_code=403,
                detail="You can view timeline only for connected patients"
            )

    elif current_user.role == "admin":
        pass

    else:
        raise HTTPException(status_code=403, detail="Not authorized")

    return build_patient_health_timeline(
        patient_email=patient_email,
        db=db,
        include_notifications=current_user.role == "patient"
    )

@app.get("/api/patients")
async def get_patients(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    if current_user.role not in ["clinician", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")

    query = db.query(PatientModel)
    if current_user.role == "clinician":
        allowed = connected_patient_emails(db, current_user.email)
        if not allowed:
            return {"patients": []}
        query = query.filter(PatientModel.email.in_(allowed))
    patients = query.order_by(PatientModel.name.asc()).all()
    
    return {
        "patients": [
            {
                "id": p.id,
                "email": p.email,
                "name": p.name,
                "age": p.age or 0,
                "lastVisit": str(p.last_visit) if p.last_visit else "Never",
                "status": p.status,
                "alerts": p.alerts,
                "gender":p.gender
            }
            for p in patients
        ]
    }

@app.get("/api/patients/{patient_email}/clinical-profile")
async def get_patient_clinical_profile(
    patient_email: str,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role == "clinician":
        connection = db.query(MessageRequestModel).filter(
            MessageRequestModel.patient_email == patient_email,
            MessageRequestModel.clinician_email == current_user.email,
            MessageRequestModel.status == "accepted",
        ).first()
        care_appointment = db.query(AppointmentModel).filter(
            AppointmentModel.patient_email == patient_email,
            AppointmentModel.clinician_email == current_user.email,
            AppointmentModel.status.in_(["approved", "completed"]),
        ).first()
        if not connection and not care_appointment:
            raise HTTPException(
                status_code=403,
                detail=(
                    "A messaging connection or approved appointment is required "
                    "to open the full patient profile"
                ),
            )
    elif current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Clinician or admin access required")

    patient = db.query(PatientModel).filter(PatientModel.email == patient_email).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    records = db.query(RecordModel).filter(
        RecordModel.patient_email == patient.email
    ).order_by(RecordModel.uploaded_at.desc()).all()
    prescription_rows = db.execute(
        text("SELECT * FROM prescriptions WHERE patient_email=:email ORDER BY created_at DESC"),
        {"email": patient.email},
    ).mappings().all()
    history = db.query(PatientProfileHistoryModel).filter(
        PatientProfileHistoryModel.patient_id == patient.id
    ).order_by(PatientProfileHistoryModel.recorded_at.desc()).all()
    appointments = db.query(AppointmentModel).filter(
        AppointmentModel.patient_email == patient.email
    ).order_by(AppointmentModel.appointment_date.desc(), AppointmentModel.appointment_time.desc()).limit(25).all()

    findings = []
    for record in records:
        findings.extend(_safe_json_loads(record.key_findings, []))
    summaries = [record.analysis_summary for record in records if record.analysis_summary]
    return {
        "patient": _patient_profile_payload(patient),
        "summary": {
            "overview": summaries[0][:1000] if summaries else "No analyzed medical records are available yet.",
            "record_count": len(records),
            "prescription_count": len(prescription_rows),
            "active_prescription_count": sum(1 for row in prescription_rows if (row.get("status") or "active") == "active"),
            "key_findings": findings[:10],
        },
        "records": [
            {
                "id": record.id, "name": record.name, "type": record.type,
                "category": record.category,
                "category_code": getattr(record, "category_code", "other") or "other",
                "tags": _safe_json_loads(getattr(record, "tags", None), []),
                "source_date": getattr(record, "source_date", None),
                "uploaded_at": record.uploaded_at.isoformat() if record.uploaded_at else None,
                "analysis_summary": record.analysis_summary,
                "key_findings": _safe_json_loads(record.key_findings, []),
                "metrics": _safe_json_loads(record.metrics_data, {}),
            }
            for record in records
        ],
        "prescriptions": [_row_to_prescription_response(dict(row), db) for row in prescription_rows],
        "profile_history": [_history_payload(entry) for entry in history],
        "appointments": [
            {
                "id": item.id, "appointment_date": item.appointment_date,
                "appointment_time": item.appointment_time, "appointment_type": item.appointment_type,
                "reason": item.reason, "status": item.status, "notes": item.notes,
            }
            for item in appointments
        ],
    }


@app.get("/api/patients/{patient_email}/appointment-summary")
async def get_patient_appointment_summary(
    patient_email: str,
    appointment_id: int = Query(..., gt=0),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    appointment = db.query(AppointmentModel).filter(
        AppointmentModel.id == appointment_id,
        AppointmentModel.patient_email == patient_email,
    ).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    if current_user.role == "clinician":
        if appointment.clinician_email != current_user.email:
            raise HTTPException(
                status_code=403,
                detail="You can view summaries only for your own appointments",
            )
    elif current_user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Clinician or administrator access is required",
        )

    patient = db.query(PatientModel).filter(
        PatientModel.email == patient_email
    ).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    connection = db.query(MessageRequestModel).filter(
        MessageRequestModel.patient_email == patient_email,
        MessageRequestModel.clinician_email == current_user.email,
        MessageRequestModel.status == "accepted",
    ).first() if current_user.role == "clinician" else None
    if (
        current_user.role == "clinician"
        and not connection
        and appointment.status not in ["pending", "approved", "completed"]
    ):
        raise HTTPException(
            status_code=403,
            detail="This appointment no longer grants access to a patient summary",
        )
    can_open_profile = (
        current_user.role == "admin"
        or bool(connection)
        or appointment.status in ["approved", "completed"]
    )
    can_message = current_user.role == "clinician" and bool(connection)

    record_count = None
    latest_record = None
    prescription_stats = {}
    if can_open_profile:
        record_count = db.query(RecordModel).filter(
            RecordModel.patient_email == patient_email
        ).count()
        latest_record = db.query(RecordModel).filter(
            RecordModel.patient_email == patient_email,
            RecordModel.analysis_summary.isnot(None),
        ).order_by(RecordModel.uploaded_at.desc()).first()
        prescription_stats = db.execute(
            text(
                "SELECT COUNT(*) AS total, "
                "SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active "
                "FROM prescriptions WHERE patient_email = :email"
            ),
            {"email": patient_email},
        ).mappings().first()

    recent_appointment_query = db.query(AppointmentModel).filter(
        AppointmentModel.patient_email == patient_email,
        AppointmentModel.id != appointment.id,
    )
    if current_user.role == "clinician" and not can_open_profile:
        recent_appointment_query = recent_appointment_query.filter(
            AppointmentModel.clinician_email == current_user.email
        )
    recent_appointments = recent_appointment_query.order_by(
        AppointmentModel.appointment_date.desc(),
        AppointmentModel.appointment_time.desc(),
    ).limit(3).all()

    blood_pressure = None
    if patient.systolic_bp and patient.diastolic_bp:
        blood_pressure = f"{patient.systolic_bp}/{patient.diastolic_bp}"

    return {
        "patient": {
            "id": patient.id,
            "name": patient.name,
            "email": patient.email,
            "age": patient.age,
            "gender": patient.gender,
            "blood_type": patient.blood_type,
            "status": patient.status,
            "alerts": patient.alerts,
            "last_visit": (
                patient.last_visit.isoformat() if patient.last_visit else None
            ),
            "weight_kg": patient.weight_kg,
            "bmi": _patient_profile_payload(patient).get("bmi"),
            "blood_pressure": blood_pressure,
        },
        "clinical_overview": (
            latest_record.analysis_summary[:500]
            if latest_record and latest_record.analysis_summary
            else (
                "No analyzed clinical summary is available yet."
                if can_open_profile
                else "Clinical details become available after appointment approval."
            )
        ),
        "record_count": record_count,
        "prescription_count": (
            int((prescription_stats or {}).get("total") or 0)
            if can_open_profile else None
        ),
        "active_prescription_count": (
            int((prescription_stats or {}).get("active") or 0)
            if can_open_profile else None
        ),
        "recent_appointments": [
            {
                "id": item.id,
                "appointment_date": item.appointment_date,
                "appointment_time": item.appointment_time,
                "appointment_type": item.appointment_type,
                "reason": item.reason,
                "status": item.status,
            }
            for item in recent_appointments
        ],
        "can_open_profile": can_open_profile,
        "can_message": can_message,
    }


@app.get("/api/exports/patients/{patient_email}/summary")
async def export_patient_clinical_summary(
    patient_email: str,
    export_format: str = Query("csv", pattern="^(csv|json)$"),
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Export a minimum-necessary longitudinal summary after role authorization."""
    if current_user.role == "patient":
        if patient_email != current_user.email:
            raise HTTPException(status_code=403, detail="You can export only your own summary")
    elif current_user.role == "clinician":
        connection = db.query(MessageRequestModel).filter(
            MessageRequestModel.patient_email == patient_email,
            MessageRequestModel.clinician_email == current_user.email,
            MessageRequestModel.status == "accepted",
        ).first()
        if not connection:
            raise HTTPException(
                status_code=403,
                detail="You can export summaries only for connected patients",
            )
    elif current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to export clinical data")

    patient = db.query(PatientModel).filter(
        PatientModel.email == patient_email
    ).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    records = db.query(RecordModel).filter(
        RecordModel.patient_email == patient_email
    ).order_by(RecordModel.uploaded_at.desc()).all()
    prescription_rows = db.execute(
        text(
            "SELECT * FROM prescriptions "
            "WHERE patient_email=:email ORDER BY created_at DESC"
        ),
        {"email": patient_email},
    ).mappings().all()
    prescriptions = [
        _row_to_prescription_response(dict(row), db) for row in prescription_rows
    ]
    appointments = db.query(AppointmentModel).filter(
        AppointmentModel.patient_email == patient_email
    ).order_by(
        AppointmentModel.appointment_date.desc(),
        AppointmentModel.appointment_time.desc(),
    ).all()
    history = db.query(PatientProfileHistoryModel).filter(
        PatientProfileHistoryModel.patient_id == patient.id
    ).order_by(PatientProfileHistoryModel.recorded_at.desc()).all()

    payload = {
        "exported_at": datetime.utcnow().isoformat(),
        "exported_by": current_user.email,
        "patient": _patient_profile_payload(patient),
        "records": [
            {
                "id": item.id,
                "name": item.name,
                "type": item.type,
                "category": item.category,
                "source_date": getattr(item, "source_date", None),
                "uploaded_at": item.uploaded_at.isoformat() if item.uploaded_at else None,
                "analysis_summary": item.analysis_summary,
                "key_findings": _safe_json_loads(item.key_findings, []),
            }
            for item in records
        ],
        "prescriptions": prescriptions,
        "appointments": [
            {
                "id": item.id,
                "date": item.appointment_date,
                "time": item.appointment_time,
                "clinician_email": item.clinician_email,
                "type": item.appointment_type,
                "reason": item.reason,
                "status": item.status,
                "notes": item.notes,
            }
            for item in appointments
        ],
        "measurement_history": [_history_payload(item) for item in history],
        "disclaimer": (
            "This export is a clinical summary and may not represent the complete "
            "legal medical record."
        ),
    }

    safe_name = re.sub(r"[^a-zA-Z0-9_-]+", "_", patient_email).strip("_")
    if export_format == "json":
        return Response(
            content=json.dumps(payload, ensure_ascii=False, indent=2),
            media_type="application/json",
            headers={
                "Content-Disposition": (
                    f'attachment; filename="{safe_name}_clinical_summary.json"'
                )
            },
        )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["CareConnect Clinical Summary"])
    writer.writerow(["Patient", patient.name])
    writer.writerow(["Email", patient.email])
    writer.writerow(["Exported at", payload["exported_at"]])
    writer.writerow([])
    writer.writerow(["Section", "Date", "Item", "Status", "Details"])
    for record in payload["records"]:
        writer.writerow(
            [
                "Medical Record",
                record["source_date"] or record["uploaded_at"] or "",
                record["name"],
                record["category"],
                record["analysis_summary"] or "",
            ]
        )
    for prescription in prescriptions:
        medicine_names = ", ".join(
            item.get("medicine_name", "")
            for item in prescription.get("medicines", [])
        )
        writer.writerow(
            [
                "Prescription",
                prescription.get("created_at") or "",
                medicine_names,
                prescription.get("status") or "",
                prescription.get("diagnosis") or "",
            ]
        )
    for appointment in payload["appointments"]:
        writer.writerow(
            [
                "Appointment",
                f'{appointment["date"]} {appointment["time"]}',
                appointment["type"],
                appointment["status"],
                appointment["reason"],
            ]
        )
    for measurement in payload["measurement_history"]:
        writer.writerow(
            [
                "Measurement",
                measurement.get("recorded_at") or "",
                "Body composition and vitals",
                measurement.get("status") or "",
                (
                    f'Weight {measurement.get("weight_kg") or "N/A"} kg; '
                    f'BMI {measurement.get("bmi") or "N/A"}; '
                    f'BP {measurement.get("systolic_bp") or "N/A"}/'
                    f'{measurement.get("diastolic_bp") or "N/A"}'
                ),
            ]
        )

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={
            "Content-Disposition": (
                f'attachment; filename="{safe_name}_clinical_summary.csv"'
            )
        },
    )


@app.get("/api/stats")
async def get_stats(db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    total_patients = db.query(PatientModel).count()
    total_clinicians = db.query(ClinicianModel).count()
    total_admins = db.query(AdminModel).count()
    total_users = total_patients + total_clinicians + total_admins
    active_sessions = db.query(UserSessionModel).filter(
        UserSessionModel.revoked_at.is_(None),
        UserSessionModel.expires_at > datetime.utcnow(),
    ).count()
    
    return {
        "total_users": total_users,
        "total_patients": total_patients,
        "total_clinicians": total_clinicians,
        "active_sessions": active_sessions
    }

# ================== RECORD UPLOAD & ANALYSIS ==================
@app.post("/api/records/upload")
async def upload_record(
    file: UploadFile = File(...),
    category: str = Form(...),
    record_type: str = Form(...),
    category_code: Optional[str] = Form(None),
    tags: Optional[str] = Form(None),
    source_date: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user)
):
    if current_user.role != "patient":
        raise HTTPException(status_code=403, detail="Only patients can upload medical records")

    stored_path = None
    try:
        normalized_code, normalized_label = normalize_category(category_code or category)
        normalized_tags = normalize_tags(tags)
        normalized_source_date = parse_iso_date(source_date, "Source date")
        clean_record_type = re.sub(r"\s+", " ", record_type or "").strip()
        if not clean_record_type or len(clean_record_type) > 100:
            raise HTTPException(
                status_code=400,
                detail="Record type is required and must be 100 characters or fewer",
            )

        original_name, extension, mime_type, content = await read_validated_upload(
            file,
            allowed_extensions=MEDICAL_UPLOAD_EXTENSIONS,
            max_bytes=MEDICAL_UPLOAD_MAX_BYTES,
        )
        stored_path = store_upload(
            content=content,
            storage_root=UPLOAD_STORAGE_ROOT,
            purpose="medical-records",
            owner_key=current_user.email,
            extension=extension,
        )

        # ✅ THIS IS THE MOST IMPORTANT LINE
        analysis = medical_analyzer.analyze_record(
            str(stored_path),
            extension,
        )

        new_record = RecordModel(
            patient_email=current_user.email,
            type=clean_record_type,
            name=original_name,
            category=normalized_label,
            category_code=normalized_code,
            tags=json.dumps(normalized_tags),
            source_date=normalized_source_date,
            file_path=str(stored_path),
            uploaded_by=current_user.email,
            analysis_summary=analysis["summary"],
            extracted_text=analysis["text_extracted"][:5000],
            metrics_data=json.dumps(analysis["metrics"]),
            key_findings=json.dumps(analysis["key_findings"])
        )

        db.add(new_record)
        db.flush()
        db.refresh(new_record)

        create_record_version(
            db=db,
            record_id=new_record.id,
            patient_email=new_record.patient_email,
            uploaded_by=current_user.email,
            file_name=original_name,
            file_path=new_record.file_path,
            file_type=mime_type,
            file_size=len(content),
            change_notes="Initial upload",
            analysis_summary=new_record.analysis_summary,
            extracted_text=new_record.extracted_text,
            metrics_data=new_record.metrics_data,
            key_findings=new_record.key_findings
        )

        # ── RAG: index the extracted text so the chatbot can retrieve it ──
        if analysis.get("text_extracted"):
            try:
                index_record(
                    patient_email=current_user.email,
                    record_id=new_record.id,
                    record_name=new_record.name,
                    record_type=new_record.type,
                    record_date=new_record.uploaded_at.strftime("%Y-%m-%d"),
                    text=analysis["text_extracted"],
                )
            except Exception:
                logging.getLogger(__name__).exception(
                    "Record %s was saved but RAG indexing failed",
                    new_record.id,
                )

        return {
            "id": new_record.id,
            "name": new_record.name,
            "category": new_record.category,
            "category_code": new_record.category_code,
            "tags": normalized_tags,
            "summary": analysis["summary"]
        }

    except HTTPException:
        if stored_path and os.path.exists(stored_path):
            os.remove(stored_path)
        raise
    except Exception as e:
        db.rollback()
        if stored_path and os.path.exists(stored_path):
            os.remove(stored_path)
        logging.getLogger(__name__).exception("Medical record upload failed")
        raise HTTPException(status_code=500, detail="Medical record upload failed") from e


@app.post("/api/records/analyze")
async def analyze_records(current_user=Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role != "patient":
        raise HTTPException(status_code=403, detail="Only patients can analyze records")
    records = db.query(RecordModel).filter(RecordModel.patient_email == current_user.email).all()
    if not records:
        return {"summary": "No records found. Please upload your medical documents."}
    record_names = ", ".join([r.name for r in records])
    return {"summary": f"AI Health Summary for {current_user.name}: {len(records)} records found ({record_names})."}

@app.post("/api/records/compare")
async def compare_medical_reports(
    comparison_data: ReportComparisonRequest,
    current_user = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if comparison_data.first_record_id == comparison_data.second_record_id:
        raise HTTPException(
            status_code=400,
            detail="Please select two different medical records for comparison"
        )

    first_record = db.query(RecordModel).filter(
        RecordModel.id == comparison_data.first_record_id
    ).first()

    second_record = db.query(RecordModel).filter(
        RecordModel.id == comparison_data.second_record_id
    ).first()

    if not first_record or not second_record:
        raise HTTPException(status_code=404, detail="One or both records were not found")

    # Authorization
    if current_user.role == "patient":
        if first_record.patient_email != current_user.email or second_record.patient_email != current_user.email:
            raise HTTPException(
                status_code=403,
                detail="You can compare only your own medical records"
            )

    elif current_user.role == "clinician":
        first_connection = db.query(MessageRequestModel).filter(
            MessageRequestModel.patient_email == first_record.patient_email,
            MessageRequestModel.clinician_email == current_user.email,
            MessageRequestModel.status == "accepted"
        ).first()

        second_connection = db.query(MessageRequestModel).filter(
            MessageRequestModel.patient_email == second_record.patient_email,
            MessageRequestModel.clinician_email == current_user.email,
            MessageRequestModel.status == "accepted"
        ).first()

        if not first_connection or not second_connection:
            raise HTTPException(
                status_code=403,
                detail="You can compare only records of connected patients"
            )

        if first_record.patient_email != second_record.patient_email:
            raise HTTPException(
                status_code=400,
                detail="Please compare records belonging to the same patient"
            )

    elif current_user.role == "admin":
        if first_record.patient_email != second_record.patient_email:
            raise HTTPException(
                status_code=400,
                detail="Please compare records belonging to the same patient"
            )

    else:
        raise HTTPException(status_code=403, detail="Not authorized")

    comparison = build_rule_based_report_comparison(first_record, second_record)

    first_text = first_record.extracted_text or first_record.analysis_summary or ""
    second_text = second_record.extracted_text or second_record.analysis_summary or ""

    # Optional Gemini enhancement
    if gemini_model and (first_text or second_text):
        try:
            prompt = f"""
You are a healthcare report comparison assistant.

Compare the two medical reports below.
Do not diagnose. Do not prescribe medication.
Give a structured comparison in JSON only.

Return JSON with these exact keys:
summary, improved_items, worsened_items, new_concerns, stable_items, patient_friendly_explanation, recommended_next_steps.

Report A:
Name: {first_record.name}
Date: {first_record.uploaded_at}
Summary: {first_record.analysis_summary}
Text:
{first_text[:6000]}

Report B:
Name: {second_record.name}
Date: {second_record.uploaded_at}
Summary: {second_record.analysis_summary}
Text:
{second_text[:6000]}
"""

            response = gemini_model.generate_content(prompt)
            response_text = response.text.strip()

            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0].strip()
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0].strip()

            ai_result = json.loads(response_text)

            comparison["ai_summary"] = ai_result.get("summary")
            comparison["improved_items"] = ai_result.get("improved_items", [])
            comparison["worsened_items"] = ai_result.get("worsened_items", [])
            comparison["new_concerns"] = ai_result.get("new_concerns", [])
            comparison["stable_items"] = ai_result.get("stable_items", [])
            comparison["patient_friendly_explanation"] = ai_result.get("patient_friendly_explanation")
            comparison["recommended_next_steps"] = ai_result.get("recommended_next_steps", [])

        except Exception as ai_error:
            print("AI report comparison failed, using rule-based comparison:", ai_error)
            comparison["ai_summary"] = comparison["summary"]
            comparison["improved_items"] = []
            comparison["worsened_items"] = []
            comparison["new_concerns"] = comparison["new_findings"]
            comparison["stable_items"] = comparison["common_findings"]
            comparison["patient_friendly_explanation"] = comparison["summary"]
            comparison["recommended_next_steps"] = [
                "Review the comparison with your clinician.",
                "Upload newer reports when available.",
                "Do not make treatment changes based only on this comparison."
            ]
    else:
        comparison["ai_summary"] = comparison["summary"]
        comparison["improved_items"] = []
        comparison["worsened_items"] = []
        comparison["new_concerns"] = comparison["new_findings"]
        comparison["stable_items"] = comparison["common_findings"]
        comparison["patient_friendly_explanation"] = comparison["summary"]
        comparison["recommended_next_steps"] = [
            "Review the comparison with your clinician.",
            "Upload newer reports when available.",
            "Do not make treatment changes based only on this comparison."
        ]

    return comparison

# ================== AI HEALTH TIPS ==================

# Curated pool of daily wellness tips (used as fallback when Gemini is unavailable)
DAILY_HEALTH_TIPS = [
    # Hydration
    {"tip": "Drink at least 3 litres of water daily to keep your body well-hydrated and your energy levels high.", "category": "Hydration", "icon": "fa-tint"},
    {"tip": "Start your morning with a glass of warm lemon water — it aids digestion and boosts your metabolism.", "category": "Hydration", "icon": "fa-tint"},
    {"tip": "Carry a reusable water bottle with you everywhere to remind yourself to stay hydrated throughout the day.", "category": "Hydration", "icon": "fa-tint"},
    {"tip": "Drink a glass of water 30 minutes before each meal — it helps with portion control and digestion.", "category": "Hydration", "icon": "fa-tint"},
    {"tip": "Replace sugary beverages with infused water — add cucumber, mint, or berries for a refreshing twist.", "category": "Hydration", "icon": "fa-tint"},

    # Exercise & Fitness
    {"tip": "Exercise or work out at least 5–6 times a week — even a 30-minute walk counts as a great start.", "category": "Exercise", "icon": "fa-running"},
    {"tip": "Take a 10-minute stretch break every hour if you sit for long periods — your body will thank you.", "category": "Exercise", "icon": "fa-running"},
    {"tip": "Try incorporating strength training at least 2–3 times a week to build muscle and boost metabolism.", "category": "Exercise", "icon": "fa-running"},
    {"tip": "Walking 10,000 steps daily reduces the risk of heart disease and improves overall cardiovascular health.", "category": "Exercise", "icon": "fa-running"},
    {"tip": "Practice yoga or Pilates for flexibility and stress relief — even 15 minutes a day makes a difference.", "category": "Exercise", "icon": "fa-running"},
    {"tip": "Take the stairs instead of the elevator whenever possible — it's a simple way to stay active.", "category": "Exercise", "icon": "fa-running"},
    {"tip": "Do a quick morning workout routine to kickstart your day with energy and focus.", "category": "Exercise", "icon": "fa-running"},

    # Sleep
    {"tip": "Wake up early in the morning — a consistent sleep-wake cycle greatly improves your overall health.", "category": "Sleep", "icon": "fa-moon"},
    {"tip": "Aim for 7–8 hours of quality sleep every night to support immune function and mental clarity.", "category": "Sleep", "icon": "fa-moon"},
    {"tip": "Avoid screens at least 30 minutes before bedtime — blue light disrupts your natural sleep cycle.", "category": "Sleep", "icon": "fa-moon"},
    {"tip": "Create a relaxing bedtime routine — reading, light stretching, or meditation can improve sleep quality.", "category": "Sleep", "icon": "fa-moon"},
    {"tip": "Keep your bedroom cool and dark for optimal sleep conditions — aim for 18–20°C.", "category": "Sleep", "icon": "fa-moon"},
    {"tip": "Avoid caffeine after 2 PM to ensure it doesn't interfere with your sleep later in the evening.", "category": "Sleep", "icon": "fa-moon"},

    # Nutrition & Diet
    {"tip": "Maintain a proper balanced diet with adequate proteins, carbs, healthy fats, and fresh vegetables.", "category": "Nutrition", "icon": "fa-apple-alt"},
    {"tip": "Eat at least 5 servings of fruits and vegetables daily for essential vitamins and minerals.", "category": "Nutrition", "icon": "fa-apple-alt"},
    {"tip": "Reduce processed food intake — whole, natural foods provide better nutrition and energy.", "category": "Nutrition", "icon": "fa-apple-alt"},
    {"tip": "Include omega-3 rich foods like fish, walnuts, and flaxseeds to support brain and heart health.", "category": "Nutrition", "icon": "fa-apple-alt"},
    {"tip": "Practice mindful eating — chew your food slowly and enjoy each bite for better digestion.", "category": "Nutrition", "icon": "fa-apple-alt"},
    {"tip": "Don't skip breakfast — it provides the fuel your body needs to start the day right.", "category": "Nutrition", "icon": "fa-apple-alt"},
    {"tip": "Limit your sugar intake — excess sugar leads to energy crashes and long-term health issues.", "category": "Nutrition", "icon": "fa-apple-alt"},
    {"tip": "Add probiotics like yogurt, kimchi, or kefir to your diet for a healthy gut microbiome.", "category": "Nutrition", "icon": "fa-apple-alt"},
    {"tip": "Eat a handful of nuts daily — almonds, walnuts, and cashews are packed with healthy fats and protein.", "category": "Nutrition", "icon": "fa-apple-alt"},

    # Mental Health
    {"tip": "Practice 10 minutes of daily meditation or deep breathing — it reduces stress and improves focus.", "category": "Mental Health", "icon": "fa-brain"},
    {"tip": "Take short breaks during work to relax your mind — a 5-minute walk or breathing exercise helps.", "category": "Mental Health", "icon": "fa-brain"},
    {"tip": "Journaling for a few minutes daily can help organize your thoughts and reduce anxiety.", "category": "Mental Health", "icon": "fa-brain"},
    {"tip": "Spend time in nature — even 20 minutes outdoors can reduce stress hormones and boost your mood.", "category": "Mental Health", "icon": "fa-brain"},
    {"tip": "Practice gratitude — write down 3 things you're grateful for each day to improve your outlook on life.", "category": "Mental Health", "icon": "fa-brain"},
    {"tip": "Limit social media usage to reduce comparison anxiety and free up time for meaningful activities.", "category": "Mental Health", "icon": "fa-brain"},
    {"tip": "Talk to someone you trust when you feel overwhelmed — sharing your thoughts lightens the burden.", "category": "Mental Health", "icon": "fa-brain"},

    # Hygiene & Prevention
    {"tip": "Wash your hands thoroughly for at least 20 seconds to prevent the spread of infections.", "category": "Hygiene", "icon": "fa-hand-sparkles"},
    {"tip": "Brush your teeth twice a day and floss daily — oral hygiene is linked to overall heart health.", "category": "Hygiene", "icon": "fa-hand-sparkles"},
    {"tip": "Apply sunscreen (SPF 30+) daily, even on cloudy days, to protect your skin from UV damage.", "category": "Hygiene", "icon": "fa-hand-sparkles"},
    {"tip": "Schedule regular health check-ups — early detection is key to preventing serious conditions.", "category": "Hygiene", "icon": "fa-hand-sparkles"},

    # Posture & Ergonomics
    {"tip": "Maintain good posture while sitting — keep your back straight and shoulders relaxed to avoid back pain.", "category": "Posture", "icon": "fa-chair"},
    {"tip": "Follow the 20-20-20 rule: every 20 minutes, look at something 20 feet away for 20 seconds to reduce eye strain.", "category": "Posture", "icon": "fa-chair"},
    {"tip": "Adjust your screen to eye level and keep your keyboard at elbow height for ergonomic comfort.", "category": "Posture", "icon": "fa-chair"},

    # Social & Emotional Wellbeing
    {"tip": "Spend quality time with family and friends — social connections are vital for emotional wellbeing.", "category": "Social", "icon": "fa-heart"},
    {"tip": "Laugh often — laughter releases endorphins and is a natural stress reliever.", "category": "Social", "icon": "fa-heart"},
    {"tip": "Learn something new regularly — it keeps your mind sharp and gives you a sense of accomplishment.", "category": "Social", "icon": "fa-heart"},
    {"tip": "Volunteer or help others — acts of kindness boost your own happiness and sense of purpose.", "category": "Social", "icon": "fa-heart"},

    # Lifestyle
    {"tip": "Limit alcohol consumption and avoid smoking — both significantly increase health risks.", "category": "Lifestyle", "icon": "fa-leaf"},
    {"tip": "Set realistic health goals and track your progress — small wins lead to big transformations.", "category": "Lifestyle", "icon": "fa-leaf"},
    {"tip": "Spend the first 30 minutes of your morning without your phone — it sets a calm tone for the day.", "category": "Lifestyle", "icon": "fa-leaf"},
    {"tip": "Cook meals at home more often — it gives you control over ingredients and portion sizes.", "category": "Lifestyle", "icon": "fa-leaf"},
    {"tip": "Practice deep breathing exercises when you feel stressed — inhale for 4 counts, hold for 4, exhale for 6.", "category": "Lifestyle", "icon": "fa-leaf"},
    {"tip": "Declutter your living space — a tidy environment promotes a calmer and more focused mind.", "category": "Lifestyle", "icon": "fa-leaf"},
    {"tip": "Read for at least 15–20 minutes daily — it reduces stress, improves focus, and expands knowledge.", "category": "Lifestyle", "icon": "fa-leaf"},

    # Vitamins & Supplements
    {"tip": "Get 15–20 minutes of natural sunlight daily for adequate Vitamin D — it supports bone health and immunity.", "category": "Vitamins", "icon": "fa-sun"},
    {"tip": "Include iron-rich foods like spinach, lentils, and red meat to prevent fatigue and anemia.", "category": "Vitamins", "icon": "fa-sun"},
    {"tip": "Consume calcium-rich foods like milk, cheese, and leafy greens for strong bones and teeth.", "category": "Vitamins", "icon": "fa-sun"},
]

import random

@app.get("/api/health-tips")
async def get_health_tips(count: int = 5):
    """
    Returns randomized daily wellness tips.
    Uses Gemini AI when available, otherwise selects from curated pool.
    These are general lifestyle suggestions, NOT medical treatment advice.
    """
    tip_count = min(max(count, 1), 10)  # Clamp between 1 and 10

    # Try Gemini AI first for dynamic tips
    if USE_GEMINI_HEALTH_TIPS and gemini_model:
        try:
            prompt = f"""Generate exactly {tip_count} unique daily health and wellness tips for a healthy lifestyle.

Rules:
- These are general daily wellness suggestions, NOT medical treatment or prescriptions
- Cover topics like: hydration, exercise, sleep, nutrition, mental health, hygiene, posture, lifestyle habits
- Each tip should be 1-2 sentences, practical and actionable
- Make them feel fresh and varied — don't repeat common generic advice
- Be specific with numbers where possible (e.g., "3 litres of water", "7-8 hours of sleep")

Return ONLY a valid JSON array with objects containing "tip", "category", and "icon" fields.
Categories: Hydration, Exercise, Sleep, Nutrition, Mental Health, Hygiene, Posture, Social, Lifestyle, Vitamins
Icons (FontAwesome): fa-tint, fa-running, fa-moon, fa-apple-alt, fa-brain, fa-hand-sparkles, fa-chair, fa-heart, fa-leaf, fa-sun

Example format:
[{{"tip": "Drink 3 litres of water daily...", "category": "Hydration", "icon": "fa-tint"}}]"""

            response = gemini_model.generate_content(prompt)
            response_text = response.text.strip()

            # Extract JSON from response (handle markdown code blocks)
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0].strip()
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0].strip()

            tips = json.loads(response_text)

            if isinstance(tips, list) and len(tips) > 0:
                return {
                    "tips": tips[:tip_count],
                    "source": "ai",
                    "message": "AI-generated wellness tips for your daily routine"
                }
        except Exception as e:
            print(f"⚠️ Gemini health tips failed, using curated pool: {e}")

    # Fallback: select random tips from curated pool
    selected = random.sample(DAILY_HEALTH_TIPS, min(tip_count, len(DAILY_HEALTH_TIPS)))
    return {
        "tips": selected,
        "source": "curated",
        "message": "Daily wellness tips for a healthier lifestyle"
    }


# ================== CLINICIAN SEARCH ==================
@app.get("/api/clinicians/search")
async def search_clinicians(
    specialization: Optional[str] = None,
    location: Optional[str] = None,
    experience: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    query = db.query(ClinicianModel).filter(
        ClinicianModel.is_active == True,
        ClinicianModel.approval_status == "approved",
    )
    if specialization:
        query = query.filter(ClinicianModel.specialization.ilike(f"%{specialization}%"))
    if location:
        query = query.filter(ClinicianModel.department.ilike(f"%{location}%"))
    if experience:
        query = query.filter(ClinicianModel.years_of_experience >= experience)
    clinicians = query.all()
    return {"clinicians": [
        {"id": c.id, "name": c.name, "email": c.email,"gender":c.gender,
         "specialization": c.specialization, "department": c.department,
         "years_of_experience": c.years_of_experience}
        for c in clinicians
    ]}

@app.get("/api/records/health-summary")
async def get_health_summary(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate comprehensive health summary from all records"""
    if current_user.role != "patient":
        raise HTTPException(status_code=403, detail="Only patients can access health summary")
    
    # Get all patient records
    records = db.query(RecordModel).filter(
        RecordModel.patient_email == current_user.email
    ).order_by(RecordModel.uploaded_at.desc()).all()
    
    if not records:
        return {
            "summary": "No medical records found. Upload your first record to get started.",
            "overall_status": "Unknown",
            "total_records": 0,
            "recent_findings": [],
            "vital_trends": {},
            "recommendations": ["Upload your medical records to get personalized health insights."]
        }
    
    # Compile analysis from all records
    records_analysis = []
    for record in records:
        analysis = {
            "summary": record.analysis_summary or "",
            "metrics": json.loads(record.metrics_data) if record.metrics_data else {},
            "key_findings": json.loads(record.key_findings) if record.key_findings else []
        }
        records_analysis.append(analysis)
    
    # Generate comprehensive summary
    patient_info = {
        "name": current_user.name,
        "age": current_user.age,
        "blood_type": current_user.blood_type
    }
    
    health_summary = generate_health_summary(records_analysis, patient_info)
    
    # Add patient-specific info
    health_summary["patient_info"] = {
        "name": current_user.name,
        "age": current_user.age or "Not specified",
        "blood_type": current_user.blood_type or "Not specified"
    }
    
    return health_summary


@app.get("/api/records/{record_id}/details")
async def get_record_details(
    record_id: int,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get detailed analysis of a specific record"""
    record = db.query(RecordModel).filter(RecordModel.id == record_id).first()
    
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    
    # Check authorization
    require_patient_access(db, current_user, record.patient_email)
    
    return {
        "id": record.id,
        "name": record.name,
        "type": record.type,
        "category": record.category,
        "category_code": getattr(record, "category_code", "other") or "other",
        "tags": _safe_json_loads(getattr(record, "tags", None), []),
        "source_date": getattr(record, "source_date", None),
        "uploaded_at": record.uploaded_at.isoformat(),
        "analysis": {
            "summary": record.analysis_summary or "No analysis available",
            "metrics": json.loads(record.metrics_data) if record.metrics_data else {},
            "key_findings": json.loads(record.key_findings) if record.key_findings else [],
            "extracted_text_preview": record.extracted_text[:500] if record.extracted_text else ""
        }
    }

# ================== HEALTH CHATBOT (RAG-powered) ==================

def extract_text_from_medical_record(file_path: str) -> str:
    """Extract text content from medical records (used for context building)."""
    try:
        if not os.path.exists(file_path):
            return ""
        text_content = ""
        file_extension = os.path.splitext(file_path)[1].lower()
        if file_extension == '.pdf':
            try:
                doc = fitz.open(file_path)
                for page in doc:
                    text_content += page.get_text()
                doc.close()
            except Exception as e:
                print(f"Error extracting PDF: {e}")
        elif file_extension in ['.txt', '.md']:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    text_content = f.read()
            except Exception as e:
                print(f"Error reading text file: {e}")
        elif file_extension in ['.docx', '.doc']:
            try:
                from docx import Document
                doc = Document(file_path)
                text_content = '\n'.join([para.text for para in doc.paragraphs])
            except Exception as e:
                print(f"Error extracting DOCX: {e}")
        return text_content[:5000]
    except Exception as e:
        print(f"Error in extract_text_from_medical_record: {e}")
        return ""


def build_patient_context(patient, records: List) -> Dict:
    """Build patient profile context (used for prompt header and rule-based fallback)."""
    records_analysis = []
    for record in records[:10]:
        try:
            metrics = json.loads(record.metrics_data) if record.metrics_data else {}
        except Exception:
            metrics = {}
        try:
            key_findings = json.loads(record.key_findings) if record.key_findings else []
        except Exception:
            key_findings = []
        records_analysis.append({
            "summary": record.analysis_summary or "",
            "metrics": metrics,
            "key_findings": key_findings,
        })

    derived_summary = generate_health_summary(records_analysis, {
        "name": patient.name,
        "age": patient.age,
        "blood_type": patient.blood_type,
    }) if records_analysis else None

    derived_health_status = derived_summary.get("overall_status") if derived_summary else None

    context = {
        "patient_info": {
            "name": patient.name,
            "age": patient.age if patient.age else "Not specified",
            "blood_type": patient.blood_type if patient.blood_type else "Not specified",
            "health_status": derived_health_status or (patient.status if patient.status else "Not specified"),
            "emergency_contact": patient.emergency_contact if patient.emergency_contact else "Not specified",
        },
        "medical_records": [],
        "health_summary": "",
        "derived_summary": derived_summary,
    }

    for record in records[:10]:
        try:
            parsed_findings = json.loads(record.key_findings) if record.key_findings else []
        except Exception:
            parsed_findings = []

        context["medical_records"].append({
            "type": record.type,
            "name": record.name,
            "date": record.uploaded_at.strftime('%Y-%m-%d'),
            "category": record.category,
            "analysis_summary": record.analysis_summary or "",
            "key_findings": parsed_findings[:5],
        })

    if context["medical_records"]:
        record_types = list(set([r["type"] for r in context["medical_records"]]))
        context["health_summary"] = (
            f"Patient has {len(context['medical_records'])} medical records including "
            + ", ".join(record_types[:3])
        )
        if derived_summary and derived_summary.get("overall_status"):
            context["health_summary"] += f". Current derived status: {derived_summary['overall_status']}."
    else:
        context["health_summary"] = "No medical records uploaded yet."

    return context


def create_rag_prompt(user_message: str, patient_context: Dict, relevant_chunks: List[Dict]) -> str:
    """
    Build the Gemini prompt using only semantically retrieved record chunks
    (true RAG) rather than blindly dumping all records.
    """
    pi = patient_context["patient_info"]
    prompt = f"""You are a helpful, empathetic healthcare assistant for CareConnect Pro.
Provide personalised, accurate health guidance based on the patient's actual medical records shown below.

CRITICAL SAFETY RULES:
1. You are NOT a replacement for professional medical advice, diagnosis, or treatment.
2. Always encourage the patient to consult their healthcare provider for personalised advice.
3. For emergencies (chest pain, difficulty breathing, severe bleeding, stroke symptoms) — direct to emergency services IMMEDIATELY.
4. Never diagnose conditions or prescribe/recommend specific treatments or dosages.
5. Keep responses concise and clear (100-300 words, 2-4 paragraphs).
6. End EVERY response with: ⚠️ This is general guidance only. Please consult your healthcare provider for medical advice tailored to your situation.

PATIENT PROFILE:
===============
Name        : {pi['name']}
Age         : {pi['age']}
Blood Type  : {pi['blood_type']}
Health Status: {pi['health_status']}
"""

    if relevant_chunks:
        prompt += "\nRELEVANT SECTIONS FROM YOUR MEDICAL RECORDS (retrieved for this question):\n"
        prompt += "=" * 60 + "\n"
        for i, chunk in enumerate(relevant_chunks, 1):
            prompt += (
                f"\n[{i}] {chunk['record_type']} — {chunk['record_name']} "
                f"(Date: {chunk['record_date']}, Relevance: {chunk['similarity']:.0%})\n"
                f"{chunk['text']}\n"
            )
        prompt += "=" * 60 + "\n"
    else:
        prompt += "\n[No relevant records found for this question — respond with general health information.]\n"

    prompt += f"""
PATIENT QUESTION:
=================
{user_message}

RESPONSE INSTRUCTIONS:
=======================
• If relevant records are shown above, answer using ONLY the values present in those records.
• If the exact value is present, quote it exactly as written.
• If the exact value is not present in the retrieved records, say: "I could not find that exact value in the uploaded records."
• Do not guess, estimate, or use general medical knowledge when the user asks about their uploaded record data.
• If no records are relevant, give helpful general health information.
• Maintain a warm, professional, and empathetic tone.
• Format with short paragraphs. Use bullet points sparingly.
• End with the mandatory disclaimer above.

YOUR RESPONSE:
"""
    return prompt


def generate_gemini_response(user_message: str, patient_context: Dict, relevant_chunks: List[Dict]) -> str:
    """Call Gemini with the RAG-enhanced prompt."""
    prompt = create_rag_prompt(user_message, patient_context, relevant_chunks)
    response = gemini_model.generate_content(prompt)
    return response.text


def generate_rule_based_response(message: str, context_dict: Dict) -> str:
    """
    Keyword-based fallback used when Gemini is unavailable.
    Uses patient context for personalised responses where possible.
    """
    message_lower = message.lower()
    patient_name = context_dict["patient_info"]["name"]
    has_records   = bool(context_dict["medical_records"])

    # Greeting
    if any(w in message_lower for w in ['hello', 'hi', 'hey', 'greetings']):
        greeting = f"Hello {patient_name}! 👋 I'm your CareConnect health assistant powered by AI.\n\n"
        if has_records:
            greeting += (
                f"I have access to your {len(context_dict['medical_records'])} medical records "
                "and can provide personalised health guidance based on your medical history.\n\n"
            )
        greeting += (
            "I can help you with:\n"
            "• Understanding your medical records and test results\n"
            "• General health information tailored to your profile\n"
            "• Platform navigation and scheduling\n\n"
            "How can I assist you today?\n\n"
            "⚠️ **Reminder:** I provide general information only. Always consult your healthcare provider for medical advice."
        )
        return greeting

    # Records
    if any(w in message_lower for w in ['record', 'document', 'report', 'test result', 'lab result']):
        if has_records:
            response = f"I have access to {len(context_dict['medical_records'])} of your medical records:\n\n"
            for i, rec in enumerate(context_dict['medical_records'][:5], 1):
                response += f"{i}. **{rec['type']}** — {rec['name']} (uploaded {rec['date']})\n"
                if rec.get('analysis_summary'):
                    response += f"   • AI summary: {rec['analysis_summary'][:200]}\n"
                if rec.get('key_findings'):
                    response += f"   • Key findings: {', '.join(rec['key_findings'][:2])}\n"
            response += "\nYou can view detailed reports in the 'Records' tab.\n\n"
        else:
            response = "I don't see any medical records in your profile yet. You can upload documents in the 'Records' tab.\n\n"
        response += "⚠️ **Note:** For detailed interpretation, please consult your clinician."
        return response

    # Health status
    if any(w in message_lower for w in ['health', 'status', 'condition', 'how am i', 'my health']):
        status = context_dict['patient_info']['health_status']
        response = f"According to your profile, your current health status is: **{status}**\n\n"
        if context_dict['patient_info']['age'] != 'Not specified':
            response += f"• Age: {context_dict['patient_info']['age']}\n"
        if context_dict['patient_info']['blood_type'] != 'Not specified':
            response += f"• Blood Type: {context_dict['patient_info']['blood_type']}\n"
        if has_records:
            response += f"• Medical Records: {len(context_dict['medical_records'])} documents on file\n"
        response += (
            "\nFor a comprehensive health assessment, please schedule a consultation with your "
            "healthcare provider.\n\n"
            "⚠️ **Note:** This is based on your profile data and should not replace regular medical check-ups."
        )
        return response

    # Symptoms
    if any(w in message_lower for w in ['symptom', 'pain', 'hurt', 'sick', 'ill', 'fever', 'headache', 'cough', 'dizzy']):
        response = (
            f"I understand you're experiencing symptoms, {patient_name}. "
            "While I have access to your medical history, I cannot diagnose conditions.\n\n"
            "**Here's what I recommend:**\n\n"
            "1. 🚨 **URGENT symptoms** (chest pain, difficulty breathing, severe bleeding): "
            "Seek immediate medical attention or call emergency services\n\n"
            "2. 📅 **Non-urgent concerns:** Contact your clinician through our messaging system\n\n"
            "3. 📋 **Document your symptoms:** Note when they started, severity (1-10), and any triggers\n\n"
        )
        if has_records:
            response += (
                f"Your healthcare provider can review your {len(context_dict['medical_records'])} "
                "records on file when assessing your symptoms.\n\n"
            )
        response += "⚠️ **Important:** Do not delay seeking professional medical care for concerning symptoms."
        return response

    # Medication
    if any(w in message_lower for w in ['medicine', 'medication', 'drug', 'pill', 'prescription', 'dose']):
        return (
            f"Medication questions require professional medical guidance, {patient_name}.\n\n"
            "**For medication-related concerns:**\n\n"
            "1. Contact your prescribing physician or pharmacist\n"
            "2. Use our secure messaging to reach your healthcare provider\n"
            "3. Never adjust medication doses without professional guidance\n"
            "4. Keep a list of all medications you're taking\n\n"
            "**Emergency:** If you've taken too much medication or are having a severe reaction, "
            "call emergency services immediately.\n\n"
            "⚠️ **Safety First:** Only take medications as prescribed by your healthcare provider."
        )

    # Appointment
    if any(w in message_lower for w in ['appointment', 'schedule', 'book', 'meeting']):
        return (
            f"To schedule an appointment with your healthcare provider:\n\n"
            "1. Go to the 'Messages' tab\n"
            "2. Select your clinician from your conversations\n"
            "3. Click the 'Schedule Meeting' button in the chat header\n\n"
            "You can also send a direct message to your clinician to request an appointment.\n\n"
            "💡 **Tip:** Use our video conferencing feature for virtual consultations!"
        )

    # Blood pressure / vitals
    if any(w in message_lower for w in ['blood pressure', 'bp', 'vital', 'heart rate', 'temperature']):
        return (
            "Tracking vital signs is important for your health. Here's what you can do:\n\n"
            "1. **Upload your readings** — Use the Records tab to upload vital sign measurements\n"
            "2. **Share with your doctor** — Your clinician can review trends and provide guidance\n"
            "3. **Regular monitoring** — Keep track as recommended by your healthcare provider\n\n"
            "⚠️ **Emergency:** If you experience extremely high/low blood pressure or other "
            "concerning vitals, seek immediate medical attention."
        )

    # Diet / nutrition
    if any(w in message_lower for w in ['diet', 'food', 'nutrition', 'eat', 'meal']):
        return (
            "Nutrition plays a vital role in your health! General tips:\n\n"
            "1. **Balanced diet** — Include fruits, vegetables, whole grains, and lean proteins\n"
            "2. **Hydration** — Drink adequate water throughout the day\n"
            "3. **Portion control** — Be mindful of serving sizes\n\n"
            "For personalised dietary advice, please consult your healthcare provider or a "
            "registered dietitian through our platform.\n\n"
            "⚠️ **Note:** Dietary recommendations should be tailored to your individual health needs."
        )

    # Exercise
    if any(w in message_lower for w in ['exercise', 'workout', 'fitness', 'activity', 'gym']):
        return (
            "Regular physical activity is excellent for your health! General guidelines:\n\n"
            "1. **Adults:** 150 minutes of moderate activity per week\n"
            "2. **Start slow:** If new to exercise, begin gradually\n"
            "3. **Consistency:** Regular activity is more important than intensity\n\n"
            "Before starting any new exercise program, consult with your healthcare provider.\n\n"
            "⚠️ **Safety:** Always get medical clearance before starting intensive exercise programs."
        )

    # Mental health
    if any(w in message_lower for w in ['stress', 'anxiety', 'depression', 'mental health', 'worried', 'sad']):
        return (
            "Your mental health is just as important as your physical health.\n\n"
            "**Support options:**\n"
            "1. Talk to your healthcare provider through our messaging system\n"
            "2. Consider professional mental health support\n"
            "3. **Crisis support:** If you're in crisis, contact a crisis helpline immediately\n\n"
            "**General wellness tips:**\n"
            "• Practice self-care\n"
            "• Stay connected with loved ones\n"
            "• Maintain a routine\n"
            "• Get adequate sleep\n\n"
            "⚠️ **Important:** If you're experiencing thoughts of self-harm, please seek "
            "immediate help from a mental health professional or crisis hotline."
        )

    # Sleep
    if any(w in message_lower for w in ['sleep', 'insomnia', 'tired', 'fatigue']):
        return (
            "Quality sleep is essential for health. General tips:\n\n"
            "**Sleep hygiene:**\n"
            "1. Maintain a regular sleep schedule\n"
            "2. Create a relaxing bedtime routine\n"
            "3. Limit screen time before bed\n"
            "4. Keep your bedroom cool and dark\n"
            "5. Avoid caffeine late in the day\n\n"
            "If sleep problems persist, please discuss with your healthcare provider as there "
            "may be underlying causes that need attention.\n\n"
            "⚠️ **Note:** Chronic sleep issues should be evaluated by a healthcare professional."
        )

    # Default
    response = f"Thank you for your question, {patient_name}. "
    if has_records:
        response += (
            f"I have access to your {len(context_dict['medical_records'])} medical records "
            "and your health profile. "
        )
    response += (
        "I'm here to help with general health information and guide you through our platform.\n\n"
        "**I can assist with:**\n"
        "• Understanding your medical records and test results\n"
        "• General health information based on your profile\n"
        "• Platform navigation and features\n"
        "• Connecting you with healthcare providers\n"
        "• Scheduling appointments\n\n"
        "For specific medical advice, please use our secure messaging system to contact your clinician.\n\n"
        "⚠️ **Disclaimer:** I provide general information only. Always consult healthcare "
        "professionals for medical advice tailored to your specific situation."
    )
    return response


@app.post("/api/patient/chatbot")
async def patient_chatbot(
    chat_data: dict,
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    RAG-powered health chatbot.

    Flow:
      1. Retrieve the top-5 most relevant record chunks via ChromaDB vector search.
      2. Build patient profile context (name, age, blood type, health status).
      3. Send retrieved chunks + profile to Gemini for a grounded, personalised response.
      4. Fall back to keyword-based rule engine if Gemini is unavailable.
    """
    if current_user.role != "patient":
        raise HTTPException(status_code=403, detail="Only patients can use the chatbot")

    try:
        user_message = chat_data.get("message", "").strip()
        if not user_message:
            raise HTTPException(status_code=400, detail="Message cannot be empty")

        # 1. Load patient profile
        patient = db.query(PatientModel).filter(
            PatientModel.email == current_user.email
        ).first()

        if not patient:
            raise HTTPException(status_code=404, detail="Patient profile not found")

        # 2. Load all records for metadata (needed for rule-based fallback + context header)
        records = db.query(RecordModel).filter(
            RecordModel.patient_email == current_user.email
        ).order_by(RecordModel.uploaded_at.desc()).all()

        # 3. Build lightweight patient context (profile + record metadata)
        patient_context = build_patient_context(patient, records)

        # 4. RAG: retrieve only the chunks most relevant to this specific question
        relevant_chunks = retrieve_relevant_chunks(
            patient_email=current_user.email,
            query=user_message,
            top_k=5,
        )

        # 5. Generate response
        try:
            if gemini_model and GEMINI_API_KEY:
                bot_response = generate_gemini_response(
                    user_message, patient_context, relevant_chunks
                )
                response_source = "gemini-rag" if relevant_chunks else "gemini"
            else:
                bot_response = generate_rule_based_response(user_message, patient_context)
                response_source = "rule-based"
        except Exception as gemini_error:
            print(f"Gemini API failed: {gemini_error}, using rule-based fallback")
            bot_response = generate_rule_based_response(user_message, patient_context)
            response_source = "rule-based (fallback)"

        return {
            "response": bot_response,
            "context_used": bool(records),
            "records_count": len(records),
            "rag_chunks_used": len(relevant_chunks),
            "patient_age": patient.age,
            "patient_blood_type": patient.blood_type,
            "health_status": patient_context.get("patient_info", {}).get("health_status"),
            "response_source": response_source,
            "timestamp": datetime.utcnow().isoformat(),
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Chatbot error: {e}")
        raise HTTPException(status_code=500, detail=f"Chatbot error: {str(e)}")


# ================== ADMIN: RAG REINDEX ==================
@app.post("/api/admin/rag/reindex")
async def rag_reindex_all(
    current_user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Admin-only: rebuild the entire RAG vector store from all records in the DB.
    Useful on first deployment or after a vector store reset.
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    from rag_service import reindex_all_records
    result = reindex_all_records(db, RecordModel)
    return {"message": "RAG reindex complete", "result": result}

if __name__ == "__main__":
    print("🏥 Starting CareConnect Pro Server with MySQL...")
    print("🗄️  Database: MySQL (careconnect_pro)")
    print("📊 Tables: patients, clinicians, admins, messages, medical_records")
    uvicorn.run(app, host="0.0.0.0", port=8000)
