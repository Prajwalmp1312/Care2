"""Controlled medical-record vocabulary and clinical search helpers."""

from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Tuple
import json
import re

from fastapi import HTTPException


RECORD_CATEGORIES: List[Dict[str, str]] = [
    {"code": "laboratory", "label": "Laboratory", "description": "Lab panels and pathology results"},
    {"code": "imaging", "label": "Imaging", "description": "X-ray, CT, MRI, ultrasound, and imaging reports"},
    {"code": "visit_note", "label": "Visit Note", "description": "Consultation and progress notes"},
    {"code": "discharge_summary", "label": "Discharge Summary", "description": "Hospital discharge documentation"},
    {"code": "prescription", "label": "Prescription", "description": "Medication orders and prescription documents"},
    {"code": "immunization", "label": "Immunization", "description": "Vaccination history"},
    {"code": "allergy", "label": "Allergy", "description": "Allergy and intolerance documentation"},
    {"code": "vital_signs", "label": "Vital Signs", "description": "Blood pressure and other measurements"},
    {"code": "procedure", "label": "Procedure", "description": "Procedure and operative reports"},
    {"code": "referral", "label": "Referral", "description": "Referral letters and specialist requests"},
    {"code": "insurance", "label": "Insurance", "description": "Insurance and coverage documents"},
    {"code": "other", "label": "Other", "description": "Other clinical documents"},
]

CATEGORY_BY_CODE = {item["code"]: item for item in RECORD_CATEGORIES}
CATEGORY_ALIASES = {
    "lab": "laboratory",
    "lab results": "laboratory",
    "laboratory results": "laboratory",
    "clinical notes": "visit_note",
    "medical report": "other",
    "general": "other",
    "vitals": "vital_signs",
    "vital signs": "vital_signs",
    "discharge": "discharge_summary",
}


def normalize_category(value: str | None) -> Tuple[str, str]:
    raw = (value or "other").strip().lower()
    code = raw if raw in CATEGORY_BY_CODE else CATEGORY_ALIASES.get(raw)
    if not code:
        normalized = re.sub(r"[^a-z0-9]+", "_", raw).strip("_")
        code = normalized if normalized in CATEGORY_BY_CODE else None
    if not code:
        raise HTTPException(status_code=400, detail="Invalid medical record category")
    return code, CATEGORY_BY_CODE[code]["label"]


def normalize_tags(value: str | None, *, max_tags: int = 10) -> List[str]:
    if not value:
        return []
    try:
        raw_tags = json.loads(value) if value.lstrip().startswith("[") else value.split(",")
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Tags must be a JSON array or comma-separated list") from exc
    if not isinstance(raw_tags, list):
        raise HTTPException(status_code=400, detail="Tags must be a list")

    tags: List[str] = []
    for item in raw_tags:
        tag = re.sub(r"\s+", " ", str(item)).strip()
        if not tag:
            continue
        if len(tag) > 40:
            raise HTTPException(status_code=400, detail="Each tag must be 40 characters or fewer")
        if tag.lower() not in {existing.lower() for existing in tags}:
            tags.append(tag)
        if len(tags) > max_tags:
            raise HTTPException(status_code=400, detail=f"A maximum of {max_tags} tags is allowed")
    return tags


def parse_iso_date(value: str | None, field_name: str) -> str | None:
    if not value:
        return None
    try:
        parsed = datetime.strptime(value, "%Y-%m-%d")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"{field_name} must use YYYY-MM-DD") from exc
    return parsed.strftime("%Y-%m-%d")
