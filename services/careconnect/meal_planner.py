from __future__ import annotations

import base64
import json
import logging
import re
import uuid
from collections import Counter
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any, Callable

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from database import engine, get_db

logger = logging.getLogger(__name__)
UPLOAD_DIR = Path(__file__).resolve().parent / "uploads" / "meal-planner" / "reviews"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def _json(value: Any, default: Any = None) -> Any:
    if value in (None, ""):
        return default
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return default


def _row(row: Any) -> dict[str, Any] | None:
    return dict(row) if row is not None else None


def init_meal_planner_schema() -> None:
    """Create the Meal Planner tables in the CareConnect database."""
    statements = [
        """
        CREATE TABLE IF NOT EXISTS meal_planner_profiles (
          patient_id INT PRIMARY KEY,
          username VARCHAR(255) UNIQUE NOT NULL,
          weight DECIMAL(6,2) NOT NULL DEFAULT 70,
          weight_unit VARCHAR(3) NOT NULL DEFAULT 'kg',
          purpose VARCHAR(255) NOT NULL DEFAULT 'Improve Health',
          profile_completed BOOLEAN NOT NULL DEFAULT FALSE,
          track_menstrual_cycle BOOLEAN NOT NULL DEFAULT FALSE,
          last_period_date DATE NULL,
          cycle_length INT NOT NULL DEFAULT 28,
          menstrual_preferences JSON NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          CONSTRAINT fk_meal_profile_patient FOREIGN KEY (patient_id)
            REFERENCES patients(id) ON DELETE CASCADE
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS saved_meal_plans (
          id INT AUTO_INCREMENT PRIMARY KEY,
          patient_id INT NOT NULL,
          meal_plan_name VARCHAR(255) DEFAULT 'My Meal Plan',
          mood_context VARCHAR(50) NOT NULL,
          breakfast_name VARCHAR(255) NOT NULL,
          breakfast_calories INT NOT NULL,
          lunch_name VARCHAR(255) NOT NULL,
          lunch_calories INT NOT NULL,
          dinner_name VARCHAR(255) NOT NULL,
          dinner_calories INT NOT NULL,
          snack_name VARCHAR(255) NOT NULL,
          snack_calories INT NOT NULL,
          total_calories INT NOT NULL,
          date_created TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_saved_plan_patient (patient_id),
          CONSTRAINT fk_saved_plan_patient FOREIGN KEY (patient_id)
            REFERENCES patients(id) ON DELETE CASCADE
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS meal_planner_reviews (
          id INT AUTO_INCREMENT PRIMARY KEY,
          patient_id INT NOT NULL,
          name VARCHAR(255) NOT NULL,
          content TEXT NOT NULL,
          rating INT NOT NULL,
          photo_url VARCHAR(500) NULL,
          photo_filename VARCHAR(255) NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_meal_review_patient FOREIGN KEY (patient_id)
            REFERENCES patients(id) ON DELETE CASCADE
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS menstrual_cycle_logs (
          id INT AUTO_INCREMENT PRIMARY KEY,
          patient_id INT NOT NULL,
          period_start_date DATE NULL,
          period_end_date DATE NULL,
          cravings JSON NULL,
          symptoms JSON NULL,
          notes TEXT NULL,
          log_date DATE NOT NULL,
          mood VARCHAR(50) NULL,
          energy_level VARCHAR(50) NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY unique_patient_log_date (patient_id, log_date),
          CONSTRAINT fk_cycle_log_patient FOREIGN KEY (patient_id)
            REFERENCES patients(id) ON DELETE CASCADE
        )
        """,
    ]
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    with engine.begin() as conn:
        for statement in statements:
            conn.execute(text(statement))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS app_migrations (
              migration_key VARCHAR(190) PRIMARY KEY,
              applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """))
        _migrate_legacy_meal_planner(conn)


def _migrate_legacy_meal_planner(conn: Any) -> None:
    """Copy legacy Express data once when meal_planner_db is still present."""
    migration_key = "merge_meal_planner_db_v1"
    if conn.execute(
        text("SELECT 1 FROM app_migrations WHERE migration_key=:key"),
        {"key": migration_key},
    ).first():
        return
    legacy_exists = conn.execute(text(
        "SELECT COUNT(*) FROM INFORMATION_SCHEMA.SCHEMATA "
        "WHERE SCHEMA_NAME='meal_planner_db'"
    )).scalar()
    if not legacy_exists:
        return
    savepoint = conn.begin_nested()
    try:
        conn.execute(text("""
            INSERT IGNORE INTO meal_planner_profiles
              (patient_id, username, weight, weight_unit, purpose,
               profile_completed, track_menstrual_cycle, last_period_date,
               cycle_length, menstrual_preferences)
            SELECT p.id, u.username, u.weight, u.weight_unit, u.purpose,
                   u.profile_completed, u.track_menstrual_cycle,
                   u.last_period_date, u.cycle_length, u.menstrual_preferences
              FROM meal_planner_db.users u
              JOIN patients p ON LOWER(p.email)=LOWER(u.email)
        """))
        conn.execute(text("""
            INSERT INTO saved_meal_plans
              (patient_id, meal_plan_name, mood_context,
               breakfast_name, breakfast_calories, lunch_name, lunch_calories,
               dinner_name, dinner_calories, snack_name, snack_calories,
               total_calories, date_created)
            SELECT p.id, s.meal_plan_name, s.mood_context,
                   s.breakfast_name, s.breakfast_calories,
                   s.lunch_name, s.lunch_calories,
                   s.dinner_name, s.dinner_calories,
                   s.snack_name, s.snack_calories,
                   s.total_calories, s.date_created
              FROM meal_planner_db.saved_meal_plans s
              JOIN patients p ON LOWER(p.email)=LOWER(s.user_email)
        """))
        conn.execute(text("""
            INSERT INTO meal_planner_reviews
              (patient_id, name, content, rating, photo_url, photo_filename, created_at)
            SELECT p.id, r.name, r.content, r.rating, NULL, NULL, r.created_at
              FROM meal_planner_db.reviews r
              JOIN meal_planner_db.users u ON u.id=r.user_id
              JOIN patients p ON LOWER(p.email)=LOWER(u.email)
        """))
        conn.execute(text("""
            INSERT IGNORE INTO menstrual_cycle_logs
              (patient_id, period_start_date, period_end_date, cravings,
               symptoms, notes, log_date, mood, energy_level, created_at, updated_at)
            SELECT p.id, l.period_start_date, l.period_end_date, l.cravings,
                   l.symptoms, l.notes, l.log_date, l.mood, l.energy_level,
                   l.created_at, l.updated_at
              FROM meal_planner_db.menstrual_cycle_logs l
              JOIN meal_planner_db.users u ON u.id=l.user_id
              JOIN patients p ON LOWER(p.email)=LOWER(u.email)
        """))
        conn.execute(
            text("INSERT INTO app_migrations (migration_key) VALUES (:key)"),
            {"key": migration_key},
        )
        savepoint.commit()
        logger.info("Migrated legacy meal_planner_db data into CareConnect")
    except Exception as exc:
        # New installations and partially initialized legacy databases should
        # still start; the migration remains unapplied and can retry next boot.
        savepoint.rollback()
        logger.warning("Legacy Meal Planner data migration skipped: %s", exc)


def _patient(current_user: Any) -> Any:
    if getattr(current_user, "role", None) != "patient":
        raise HTTPException(status_code=403, detail="Patient access required")
    return current_user


def _username(email: str) -> str:
    base = re.sub(r"[^a-zA-Z0-9_]", "_", email.split("@", 1)[0])[:40] or "patient"
    return f"cc_{base}"


def _ensure_profile(db: Session, patient: Any) -> dict[str, Any]:
    profile = db.execute(
        text("SELECT * FROM meal_planner_profiles WHERE patient_id = :id"),
        {"id": patient.id},
    ).mappings().first()
    if not profile:
        username = _username(patient.email)
        suffix = 1
        while db.execute(
            text("SELECT 1 FROM meal_planner_profiles WHERE username = :username"),
            {"username": username},
        ).first():
            username = f"{_username(patient.email)}_{suffix}"
            suffix += 1
        db.execute(
            text(
                "INSERT INTO meal_planner_profiles (patient_id, username) "
                "VALUES (:patient_id, :username)"
            ),
            {"patient_id": patient.id, "username": username},
        )
        db.commit()
        profile = db.execute(
            text("SELECT * FROM meal_planner_profiles WHERE patient_id = :id"),
            {"id": patient.id},
        ).mappings().first()
    return dict(profile)


def _user_payload(patient: Any, profile: dict[str, Any]) -> dict[str, Any]:
    sex = str(getattr(patient, "gender", "") or "Other").capitalize()
    if sex not in {"Male", "Female", "Other"}:
        sex = "Other"
    return {
        "id": patient.id,
        "username": profile["username"],
        "name": patient.name,
        "age": patient.age or 30,
        "email": patient.email,
        "sex": sex,
        "weight": float(profile["weight"]),
        "weight_unit": profile["weight_unit"],
        "purpose": profile["purpose"],
        "profile_completed": bool(profile["profile_completed"]),
        "auth_provider": "careconnect",
        "track_menstrual_cycle": bool(profile["track_menstrual_cycle"]),
        "last_period_date": profile["last_period_date"],
        "cycle_length": profile["cycle_length"],
    }


def _phase(last_period: date, cycle_length: int, on_date: date | None = None) -> tuple[str, int]:
    day = (((on_date or date.today()) - last_period).days % cycle_length) + 1
    if day <= 5:
        return "menstrual", day
    if day <= 13:
        return "follicular", day
    if day <= 16:
        return "ovulation", day
    return "luteal", day


PHASE_ADVICE = {
    "menstrual": ("Choose iron-rich foods, protein, and warm balanced meals.", ["iron", "vitamin C", "protein"]),
    "follicular": ("Favor fresh produce, whole grains, and lean proteins.", ["fiber", "B vitamins", "protein"]),
    "ovulation": ("Choose colorful produce, hydration, and balanced proteins.", ["antioxidants", "zinc", "omega-3"]),
    "luteal": ("Favor fiber-rich foods and regular balanced meals.", ["magnesium", "calcium", "fiber"]),
}


def _cycle_payload(profile: dict[str, Any]) -> dict[str, Any]:
    last = profile.get("last_period_date")
    if not profile.get("track_menstrual_cycle") or not last:
        return {"tracking": False, "tracking_enabled": False, "message": "Menstrual cycle tracking not enabled"}
    length = int(profile.get("cycle_length") or 28)
    phase, current_day = _phase(last, length)
    next_period = last + timedelta(days=length)
    days_until = (next_period - date.today()).days
    advice, nutrients = PHASE_ADVICE[phase]
    return {
        "tracking": True,
        "tracking_enabled": True,
        "currentPhase": phase,
        "current_phase": phase,
        "current_day": current_day,
        "cycle_length": length,
        "period_length": 5,
        "last_period_date": last,
        "nextPeriod": next_period,
        "predicted_next_period": next_period,
        "daysUntilPeriod": days_until,
        "days_until_period": days_until,
        "isApproachingPeriod": 0 < days_until <= 3,
        "is_approaching_period": 0 < days_until <= 3,
        "nutritionAdvice": advice,
        "nutrition_advice": advice,
        "keyNutrients": nutrients,
        "key_nutrients": nutrients,
        "preferences": _json(profile.get("menstrual_preferences"), None),
    }


def _fallback_plan(payload: dict[str, Any]) -> dict[str, Any]:
    mood = payload.get("mood") or "healthy"
    diet = str(payload.get("dietary") or "any").lower()
    allergies = " ".join(map(str, payload.get("allergies") or [])).lower()
    vegan = "vegan" in diet
    vegetarian = vegan or "vegetarian" in diet
    dairy_free = vegan or "dairy" in diet or any(x in allergies for x in ("milk", "dairy", "lactose"))
    gluten_free = "gluten" in diet or any(x in allergies for x in ("gluten", "wheat"))
    nut_free = any(x in allergies for x in ("peanut", "almond", "walnut", "cashew", "tree nut"))
    oats = "certified gluten-free oats" if gluten_free else "rolled oats"
    yogurt = "unsweetened coconut yogurt" if dairy_free else "plain Greek yogurt"
    seed = "pumpkin seeds" if nut_free else "almonds"
    lunch_protein = "roasted chickpeas" if vegetarian else "grilled chicken"
    dinner_protein = "lentils" if vegan else "tofu" if vegetarian else "baked salmon"
    meals = {
        "breakfast": {"name": "Berry Oats", "calories": 390, "prep_time": 10, "ingredients": [oats, yogurt, "berries", "chia seeds", seed], "instructions": "Combine and chill overnight, or cook the oats and add toppings."},
        "lunch": {"name": "Quinoa Bowl", "calories": 520, "prep_time": 20, "ingredients": [lunch_protein, "quinoa", "spinach", "tomato", "cucumber", "lemon"], "instructions": "Cook the quinoa and protein, then combine with vegetables and lemon."},
        "dinner": {"name": f"{dinner_protein.title()} and Roasted Vegetables", "calories": 570, "prep_time": 30, "ingredients": [dinner_protein, "sweet potato", "broccoli", "olive oil", "herbs"], "instructions": "Roast the vegetables, cook the protein thoroughly, and serve together."},
        "snack": {"name": "Seasonal Fruit Cup", "calories": 190, "prep_time": 5, "ingredients": [yogurt, "seasonal fruit", seed], "instructions": "Combine and serve chilled."},
    }
    extras = [str(x) for x in payload.get("available_ingredients") or [] if str(x).lower() not in allergies][:4]
    meals["lunch"]["ingredients"].extend(extras)
    return {
        "plan_id": f"{mood}_{int(datetime.now().timestamp())}",
        "mood_context": mood,
        **meals,
        "total_calories": sum(meal["calories"] for meal in meals.values()),
        "warnings": ["This plan is general wellness guidance and not a prescribed medical diet."],
        "context_used": {"careconnect": True, "fallback": True},
    }


def _parse_gemini_json(raw: str) -> dict[str, Any]:
    value = re.sub(r"^```(?:json)?\s*|\s*```$", "", raw.strip(), flags=re.I)
    start, end = value.find("{"), value.rfind("}")
    if start < 0 or end < start:
        raise ValueError("Gemini did not return a JSON object")
    plan = json.loads(value[start : end + 1])
    total = 0
    for key in ("breakfast", "lunch", "dinner", "snack"):
        meal = plan.get(key)
        if not isinstance(meal, dict) or not meal.get("name") or not isinstance(meal.get("ingredients"), list):
            raise ValueError(f"Gemini response is missing {key}")
        meal["calories"] = max(0, int(meal.get("calories") or 0))
        meal["prep_time"] = max(0, int(meal.get("prep_time") or 0))
        meal["instructions"] = " ".join(meal.get("instructions")) if isinstance(meal.get("instructions"), list) else str(meal.get("instructions") or "")
        total += meal["calories"]
    plan["total_calories"] = total
    plan["warnings"] = plan.get("warnings") if isinstance(plan.get("warnings"), list) else []
    return plan


class JsonBody(BaseModel):
    model_config = {"extra": "allow"}


def build_meal_planner_router(
    get_current_user: Callable[..., Any], gemini_model: Any = None
) -> APIRouter:
    router = APIRouter(prefix="/api/meal-planner", tags=["Meal Planner"])

    def current_patient(current_user=Depends(get_current_user)):
        return _patient(current_user)

    @router.post("/careconnect/session")
    def create_session(patient=Depends(current_patient), db: Session = Depends(get_db)):
        profile = _ensure_profile(db, patient)
        return {
            "token": None,
            "user": _user_payload(patient, profile),
            "care_context": {
                "health_status": patient.status,
                "blood_type": patient.blood_type,
                "active_prescription_count": db.execute(text("SELECT COUNT(*) FROM prescriptions WHERE patient_email=:email AND COALESCE(status, 'active')='active'"), {"email": patient.email}).scalar() or 0,
                "recent_record_count": db.execute(text("SELECT COUNT(*) FROM medical_records WHERE patient_email=:email"), {"email": patient.email}).scalar() or 0,
            },
        }

    @router.get("/users/{patient_id}")
    def get_profile(patient_id: int, patient=Depends(current_patient), db: Session = Depends(get_db)):
        if patient_id != patient.id:
            raise HTTPException(403, "You can only access your own profile")
        return _user_payload(patient, _ensure_profile(db, patient))

    @router.put("/users/{patient_id}")
    def update_profile(patient_id: int, body: JsonBody, patient=Depends(current_patient), db: Session = Depends(get_db)):
        if patient_id != patient.id:
            raise HTTPException(403, "You can only update your own profile")
        data = body.model_dump()
        profile = _ensure_profile(db, patient)
        unit = str(data.get("weight_unit", profile["weight_unit"])).lower()
        weight = float(data.get("weight", profile["weight"]))
        if unit not in {"kg", "lb"}:
            raise HTTPException(400, "weight_unit must be 'kg' or 'lb'")
        kg = weight * 0.45359237 if unit == "lb" else weight
        if not 20 <= kg <= 500:
            raise HTTPException(400, "Weight is outside the supported range")
        db.execute(text("UPDATE meal_planner_profiles SET username=:username, weight=:weight, weight_unit=:unit, purpose=:purpose, profile_completed=TRUE WHERE patient_id=:id"), {"username": str(data.get("username") or profile["username"]).strip(), "weight": kg, "unit": unit, "purpose": str(data.get("purpose") or profile["purpose"]).strip(), "id": patient.id})
        if data.get("name"):
            patient.name = str(data["name"]).strip()
        if data.get("age"):
            patient.age = int(data["age"])
        if data.get("sex"):
            patient.gender = str(data["sex"]).lower()
        db.commit()
        return {"message": "User updated successfully", "user": _user_payload(patient, _ensure_profile(db, patient))}

    @router.post("/generate-ai-meal")
    def generate_meal(body: JsonBody, patient=Depends(current_patient)):
        data = body.model_dump()
        fallback = _fallback_plan(data)
        if gemini_model is None:
            return fallback
        prompt = f"""You are the nutrition feature inside CareConnect. Create one practical day of meals for this request:
{json.dumps(data, default=str)}

Exclude every declared allergy, respect dietary preferences, and never diagnose or advise changing medication.
Return only valid JSON with keys mood_context, breakfast, lunch, dinner, snack, warnings. Each meal must contain name, calories, prep_time, ingredients (array), and instructions."""
        try:
            plan = _parse_gemini_json(gemini_model.generate_content(prompt).text)
            plan["mood_context"] = data.get("mood") or "healthy"
            plan["plan_id"] = f"{plan['mood_context']}_{int(datetime.now().timestamp())}"
            plan["context_used"] = {"careconnect": True, "fallback": False}
            return plan
        except Exception as exc:
            logger.warning("Gemini meal generation failed; using fallback: %s", exc)
            return fallback

    @router.post("/save-meal-plan", status_code=201)
    def save_plan(body: JsonBody, patient=Depends(current_patient), db: Session = Depends(get_db)):
        data = body.model_dump()
        required = ("moodContext", "breakfast", "lunch", "dinner", "snack")
        if any(not data.get(key) for key in required):
            raise HTTPException(400, "Mood context and all meal data are required")
        params = {"patient_id": patient.id, "name": data.get("mealPlanName") or "My Meal Plan", "mood": data["moodContext"], "total": int(data.get("totalCalories") or 0)}
        for key in ("breakfast", "lunch", "dinner", "snack"):
            params[f"{key}_name"] = data[key]["name"]
            params[f"{key}_calories"] = int(data[key].get("calories") or 0)
        result = db.execute(text("INSERT INTO saved_meal_plans (patient_id, meal_plan_name, mood_context, breakfast_name, breakfast_calories, lunch_name, lunch_calories, dinner_name, dinner_calories, snack_name, snack_calories, total_calories) VALUES (:patient_id,:name,:mood,:breakfast_name,:breakfast_calories,:lunch_name,:lunch_calories,:dinner_name,:dinner_calories,:snack_name,:snack_calories,:total)"), params)
        db.commit()
        saved = db.execute(text("SELECT * FROM saved_meal_plans WHERE id=:id"), {"id": result.lastrowid}).mappings().first()
        return {"message": "Meal plan saved successfully", "savedPlan": _row(saved)}

    @router.get("/saved-meal-plans/{email}")
    def saved_plans(email: str, patient=Depends(current_patient), db: Session = Depends(get_db)):
        if email.lower() != patient.email.lower():
            raise HTTPException(403, "You can only access your own meal plans")
        return [dict(row) for row in db.execute(text("SELECT * FROM saved_meal_plans WHERE patient_id=:id ORDER BY date_created DESC"), {"id": patient.id}).mappings()]

    @router.delete("/saved-meal-plans/{plan_id}")
    def delete_plan(plan_id: int, patient=Depends(current_patient), db: Session = Depends(get_db)):
        result = db.execute(text("DELETE FROM saved_meal_plans WHERE id=:plan_id AND patient_id=:patient_id"), {"plan_id": plan_id, "patient_id": patient.id})
        db.commit()
        if not result.rowcount:
            raise HTTPException(404, "Meal plan not found")
        return {"message": "Meal plan deleted successfully"}

    @router.get("/reviews")
    def reviews(db: Session = Depends(get_db)):
        return [dict(row) for row in db.execute(text("SELECT * FROM meal_planner_reviews ORDER BY created_at DESC")).mappings()]

    @router.post("/reviews", status_code=201)
    async def create_review(content: str = Form(...), rating: int = Form(...), photo: UploadFile | None = File(None), patient=Depends(current_patient), db: Session = Depends(get_db)):
        if not content.strip() or not 1 <= rating <= 5:
            raise HTTPException(400, "Content and a rating from 1 to 5 are required")
        photo_url = photo_filename = None
        if photo:
            if not (photo.content_type or "").startswith("image/"):
                raise HTTPException(400, "Review photo must be an image")
            extension = Path(photo.filename or "photo.jpg").suffix.lower() or ".jpg"
            photo_filename = f"{uuid.uuid4().hex}{extension}"
            data = await photo.read()
            if len(data) > 10 * 1024 * 1024:
                raise HTTPException(400, "Review photo must be 10MB or smaller")
            (UPLOAD_DIR / photo_filename).write_bytes(data)
            photo_url = f"/uploads/meal-planner/reviews/{photo_filename}"
        result = db.execute(text("INSERT INTO meal_planner_reviews (patient_id,name,content,rating,photo_url,photo_filename) VALUES (:id,:name,:content,:rating,:url,:filename)"), {"id": patient.id, "name": patient.name, "content": content.strip(), "rating": rating, "url": photo_url, "filename": photo_filename})
        db.commit()
        return _row(db.execute(text("SELECT * FROM meal_planner_reviews WHERE id=:id"), {"id": result.lastrowid}).mappings().first())

    @router.delete("/reviews/{review_id}")
    def delete_review(review_id: int, patient=Depends(current_patient), db: Session = Depends(get_db)):
        review = db.execute(text("SELECT photo_filename FROM meal_planner_reviews WHERE id=:id AND patient_id=:patient_id"), {"id": review_id, "patient_id": patient.id}).mappings().first()
        if not review:
            raise HTTPException(404, "Review not found")
        db.execute(text("DELETE FROM meal_planner_reviews WHERE id=:id"), {"id": review_id})
        db.commit()
        if review["photo_filename"]:
            (UPLOAD_DIR / review["photo_filename"]).unlink(missing_ok=True)
        return {"message": "Review deleted successfully"}

    @router.get("/users/cycle/{patient_id}")
    @router.get("/cycle-info/{patient_id}")
    def get_cycle(patient_id: int, patient=Depends(current_patient), db: Session = Depends(get_db)):
        if patient_id != patient.id:
            raise HTTPException(403, "You can only access your own cycle data")
        return _cycle_payload(_ensure_profile(db, patient))

    @router.put("/users/cycle/{patient_id}")
    def update_cycle(patient_id: int, body: JsonBody, patient=Depends(current_patient), db: Session = Depends(get_db)):
        if patient_id != patient.id:
            raise HTTPException(403, "You can only update your own cycle data")
        data = body.model_dump()
        length = int(data.get("cycle_length") or 28)
        if not 21 <= length <= 45:
            raise HTTPException(400, "Cycle length must be between 21 and 45 days")
        db.execute(text("UPDATE meal_planner_profiles SET last_period_date=COALESCE(:last,last_period_date), cycle_length=:length, track_menstrual_cycle=TRUE WHERE patient_id=:id"), {"last": data.get("last_period_date"), "length": length, "id": patient.id})
        db.commit()
        return {"message": "Cycle settings updated successfully", "cycleData": _cycle_payload(_ensure_profile(db, patient))}

    @router.get("/cycle-logs/{patient_id}")
    def cycle_logs(patient_id: int, limit: int = 10, patient=Depends(current_patient), db: Session = Depends(get_db)):
        if patient_id != patient.id:
            raise HTTPException(403, "You can only access your own cycle logs")
        rows = db.execute(text("SELECT * FROM menstrual_cycle_logs WHERE patient_id=:id ORDER BY log_date DESC LIMIT :limit"), {"id": patient.id, "limit": min(max(limit, 1), 100)}).mappings()
        return [dict(row) for row in rows]

    @router.post("/log-cycle-entry", status_code=201)
    def log_cycle(body: JsonBody, patient=Depends(current_patient), db: Session = Depends(get_db)):
        data = body.model_dump()
        if not data.get("log_date"):
            raise HTTPException(400, "log_date is required")
        params = {"id": patient.id, "date": data["log_date"], "cravings": json.dumps(data.get("cravings") or []), "symptoms": json.dumps(data.get("symptoms") or []), "mood": data.get("mood"), "energy": str(data.get("energy_level") or ""), "notes": data.get("notes")}
        db.execute(text("INSERT INTO menstrual_cycle_logs (patient_id,log_date,cravings,symptoms,mood,energy_level,notes) VALUES (:id,:date,:cravings,:symptoms,:mood,:energy,:notes) ON DUPLICATE KEY UPDATE cravings=:cravings,symptoms=:symptoms,mood=:mood,energy_level=:energy,notes=:notes"), params)
        db.commit()
        return {"message": "Entry logged successfully"}

    @router.get("/analyze-cycle-patterns/{patient_id}")
    def analyze_patterns(patient_id: int, patient=Depends(current_patient), db: Session = Depends(get_db)):
        if patient_id != patient.id:
            raise HTTPException(403, "You can only access your own cycle data")
        logs = list(db.execute(text("SELECT cravings,symptoms,mood FROM menstrual_cycle_logs WHERE patient_id=:id ORDER BY log_date DESC LIMIT 50"), {"id": patient.id}).mappings())
        cravings, symptoms, moods = Counter(), Counter(), Counter()
        for log in logs:
            cravings.update(_json(log["cravings"], [])); symptoms.update(_json(log["symptoms"], []))
            if log["mood"]: moods.update([log["mood"]])
        return {"totalLogs": len(logs), "topCravings": [{"name": k, "count": v} for k, v in cravings.most_common(5)], "topSymptoms": [{"name": k, "count": v} for k, v in symptoms.most_common(5)], "moodTrends": [{"mood": k, "count": v} for k, v in moods.most_common()], "phasePatterns": {}}

    @router.post("/generate-cycle-insights")
    def cycle_insights(body: JsonBody, patient=Depends(current_patient)):
        logs = body.model_dump().get("logs") or []
        if len(logs) < 5:
            return {"message": "Need at least 5 log entries for AI insights", "summary": "Keep logging your symptoms and cravings to get personalized insights!"}
        return {"summary": "Your recent entries can help reveal recurring patterns. Continue tracking and discuss persistent or severe symptoms with a clinician.", "recommendations": ["Eat regular balanced meals.", "Stay hydrated.", "Keep tracking cravings, mood, and symptoms."], "cravingAlternatives": {}, "symptomManagement": {}}

    @router.post("/speech-mood")
    def speech_mood(body: JsonBody):
        transcript = str(body.model_dump().get("transcript") or "").lower()
        if not transcript:
            raise HTTPException(400, "transcript is required")
        moods = {"energetic": ("energy", "active", "energetic"), "comfort": ("sad", "comfort", "tired"), "spicy": ("spicy", "hot"), "fresh": ("fresh", "light")}
        mood = next((name for name, words in moods.items() if any(word in transcript for word in words)), "healthy")
        return {"mood": mood, "confidence": 0.75 if len(transcript.split()) >= 4 else 0.55, "language": "en"}

    @router.post("/chat")
    def chat(body: JsonBody, patient=Depends(current_patient)):
        data = body.model_dump()
        message = str(data.get("message") or "").strip()
        if not message:
            raise HTTPException(400, "message is required")
        response = f"For {patient.name}, a balanced option is a meal with vegetables, whole grains, and a protein source that respects your allergies and preferences. Tell me which ingredients you have, and I can narrow it down."
        if gemini_model is not None:
            try:
                response = gemini_model.generate_content(
                    f"You are CareConnect's meal-planning assistant. Give general wellness guidance, respect stated allergies, do not diagnose, and do not change medication. Patient goal/context: {json.dumps(data.get('user') or {}, default=str)}. User: {message}"
                ).text
            except Exception as exc:
                logger.warning("Gemini meal chat failed; using fallback: %s", exc)
        return {"response": response, "mood": "healthy", "language": "en", "user_context": {"personalized": True, "careconnect_aware": True}}

    @router.post("/detect-ingredients")
    async def detect_ingredients(image: UploadFile = File(...), patient=Depends(current_patient)):
        if not (image.content_type or "").startswith("image/"):
            raise HTTPException(400, "File must be an image")
        data = await image.read()
        if len(data) > 40 * 1024 * 1024:
            raise HTTPException(400, "Image too large. Maximum size is 40MB.")
        ingredients: list[str] = []
        method, confidence = "Manual confirmation", "Manual"
        if gemini_model is not None:
            try:
                result = gemini_model.generate_content([
                    "Identify only visible food ingredients in this image. Return a JSON array of concise ingredient names and nothing else.",
                    {"mime_type": image.content_type, "data": data},
                ])
                raw = re.sub(r"^```(?:json)?\s*|\s*```$", "", result.text.strip(), flags=re.I)
                parsed = json.loads(raw)
                if isinstance(parsed, list):
                    ingredients = [str(item).strip() for item in parsed if str(item).strip()]
                    method, confidence = "Gemini image analysis", "AI"
            except Exception as exc:
                logger.warning("Gemini ingredient detection failed: %s", exc)
        return {"ingredients": ingredients, "total_detected": len(ingredients), "food_items_found": len(ingredients), "image_base64": f"data:{image.content_type};base64,{base64.b64encode(data).decode()}", "detection_methods": method, "success": True, "confidence": confidence}

    return router
