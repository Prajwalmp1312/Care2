from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any, Callable

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from database import get_db
from models import MedicalRecord as MedicalRecordModel


def _json(value: Any, default: Any) -> Any:
    if value in (None, ""):
        return default
    if isinstance(value, (list, dict)):
        return value
    try:
        return json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return default


def _iso(value: Any) -> str | None:
    if value is None:
        return None
    return value.isoformat() if hasattr(value, "isoformat") else str(value)


def _medicines(row: dict[str, Any]) -> list[dict[str, str]]:
    parsed = _json(row.get("medicines_json"), [])
    if isinstance(parsed, list) and parsed:
        return [
            {
                "medicine_name": str(item.get("medicine_name") or ""),
                "dosage": str(item.get("dosage") or ""),
                "frequency": str(item.get("frequency") or ""),
                "duration": str(item.get("duration") or ""),
                "instructions": str(item.get("instructions") or ""),
            }
            for item in parsed
            if isinstance(item, dict) and item.get("medicine_name")
        ]

    if row.get("medicine_name"):
        return [
            {
                "medicine_name": str(row.get("medicine_name") or ""),
                "dosage": str(row.get("dosage") or ""),
                "frequency": str(row.get("frequency") or ""),
                "duration": str(row.get("duration") or ""),
                "instructions": str(row.get("instructions") or ""),
            }
        ]
    return []


def build_nutrition_router(get_current_user: Callable[..., Any]) -> APIRouter:
    """Expose a small patient-owned health context to the Meal Planner service."""
    router = APIRouter(prefix="/api/integrations/meal-planner", tags=["Meal Planner"])

    @router.get("/context")
    async def patient_context(
        current_user=Depends(get_current_user),
        db: Session = Depends(get_db),
    ):
        if getattr(current_user, "role", None) != "patient":
            raise HTTPException(status_code=403, detail="Patient access required")

        prescription_rows = db.execute(
            text(
                """
                SELECT *
                FROM prescriptions
                WHERE patient_email = :email
                  AND COALESCE(status, 'active') = 'active'
                ORDER BY created_at DESC
                LIMIT 20
                """
            ),
            {"email": current_user.email},
        ).mappings().all()

        prescriptions: list[dict[str, Any]] = []
        for row in prescription_rows:
            data = dict(row)
            prescriptions.append(
                {
                    "id": data.get("id"),
                    "diagnosis": data.get("diagnosis"),
                    "instructions": data.get("instructions"),
                    "status": data.get("status") or "active",
                    "medicines": _medicines(data),
                    "created_at": _iso(data.get("created_at")),
                }
            )

        records = (
            db.query(MedicalRecordModel)
            .filter(MedicalRecordModel.patient_email == current_user.email)
            .order_by(MedicalRecordModel.uploaded_at.desc())
            .limit(5)
            .all()
        )

        recent_records = [
            {
                "id": record.id,
                "name": record.name,
                "type": record.type,
                "category": record.category,
                "uploaded_at": _iso(record.uploaded_at),
                "analysis_summary": (record.analysis_summary or "")[:1500],
                "key_findings": _json(record.key_findings, [])[:10],
                "metrics": _json(record.metrics_data, {}),
            }
            for record in records
        ]

        return {
            "context_version": "1.0",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "patient": {
                "id": current_user.id,
                "name": current_user.name,
                "email": current_user.email,
                "age": current_user.age,
                "gender": current_user.gender,
                "blood_type": current_user.blood_type,
                "health_status": current_user.status,
            },
            "active_prescriptions": prescriptions,
            "recent_records": recent_records,
            "safety": {
                "medical_advice": False,
                "rules": [
                    "Do not diagnose from record summaries.",
                    "Do not change or replace prescribed medication.",
                    "Do not claim a medication-food interaction is safe.",
                    "Direct condition-specific diet questions to a clinician or dietitian.",
                ],
            },
        }

    return router
