"""Security primitives shared by the CareConnect FastAPI routes.

The helpers in this module deliberately avoid application/database imports so
they can be tested independently and reused by upload routes.
"""

from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass
from pathlib import Path
from threading import Lock
from time import monotonic
from typing import Deque, Dict, Iterable, Tuple
from uuid import uuid4
import mimetypes
import os
import re
import zipfile

from fastapi import HTTPException, UploadFile, status


MEDICAL_UPLOAD_EXTENSIONS = {
    ".pdf",
    ".jpg",
    ".jpeg",
    ".png",
    ".doc",
    ".docx",
    ".txt",
    ".xls",
    ".xlsx",
}
CHAT_UPLOAD_EXTENSIONS = {
    ".pdf",
    ".jpg",
    ".jpeg",
    ".png",
    ".doc",
    ".docx",
    ".txt",
    ".xls",
    ".xlsx",
}

CANONICAL_MIME_TYPES = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".txt": "text/plain",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}


def _safe_original_filename(filename: str | None) -> Tuple[str, str]:
    original = Path(filename or "").name.strip()
    original = re.sub(r"[\x00-\x1f\x7f]", "", original)
    if not original or original in {".", ".."}:
        raise HTTPException(status_code=400, detail="A valid filename is required")
    if len(original) > 200:
        raise HTTPException(status_code=400, detail="Filename is too long")

    extension = Path(original).suffix.lower()
    return original, extension


def _validate_office_archive(content: bytes, extension: str) -> None:
    """Reject malformed or suspicious OOXML containers.

    This is not an antivirus replacement. It prevents path traversal and basic
    archive bombs, and verifies that DOCX/XLSX uploads contain the expected
    document tree.
    """

    try:
        from io import BytesIO

        with zipfile.ZipFile(BytesIO(content)) as archive:
            members = archive.infolist()
            if len(members) > 1000:
                raise ValueError("archive contains too many files")

            total_uncompressed = sum(member.file_size for member in members)
            if total_uncompressed > 100 * 1024 * 1024:
                raise ValueError("archive expands beyond the safe limit")

            names = {member.filename.replace("\\", "/") for member in members}
            if any(
                name.startswith("/")
                or name.startswith("../")
                or "/../" in f"/{name}"
                for name in names
            ):
                raise ValueError("archive contains an unsafe path")

            required_prefix = "word/" if extension == ".docx" else "xl/"
            if not any(name.startswith(required_prefix) for name in names):
                raise ValueError("archive content does not match its extension")
    except (zipfile.BadZipFile, ValueError) as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid {extension.lstrip('.').upper()} file",
        ) from exc


def validate_upload_content(
    *,
    filename: str | None,
    content: bytes,
    allowed_extensions: Iterable[str],
) -> Tuple[str, str, str]:
    """Validate extension and a conservative content signature."""

    original, extension = _safe_original_filename(filename)
    allowed = {item.lower() for item in allowed_extensions}
    if extension not in allowed:
        allowed_display = ", ".join(sorted(allowed))
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Allowed types: {allowed_display}",
        )
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty")

    signatures = {
        ".pdf": content.startswith(b"%PDF-"),
        ".jpg": content.startswith(b"\xff\xd8\xff"),
        ".jpeg": content.startswith(b"\xff\xd8\xff"),
        ".png": content.startswith(b"\x89PNG\r\n\x1a\n"),
        ".doc": content.startswith(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"),
        ".xls": content.startswith(b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"),
        ".docx": content.startswith(b"PK\x03\x04"),
        ".xlsx": content.startswith(b"PK\x03\x04"),
    }

    if extension == ".txt":
        if b"\x00" in content[:4096]:
            raise HTTPException(status_code=400, detail="Invalid text file")
        try:
            content.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise HTTPException(
                status_code=400,
                detail="Text uploads must use UTF-8 encoding",
            ) from exc
    elif not signatures.get(extension, False):
        raise HTTPException(
            status_code=400,
            detail="File content does not match its extension",
        )

    if extension in {".docx", ".xlsx"}:
        _validate_office_archive(content, extension)

    mime_type = CANONICAL_MIME_TYPES.get(
        extension,
        mimetypes.guess_type(original)[0] or "application/octet-stream",
    )
    return original, extension, mime_type


async def read_validated_upload(
    upload: UploadFile,
    *,
    allowed_extensions: Iterable[str],
    max_bytes: int,
) -> Tuple[str, str, str, bytes]:
    """Read at most max_bytes + 1 and return validated upload metadata."""

    content = await upload.read(max_bytes + 1)
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds the {max_bytes // (1024 * 1024)} MB upload limit",
        )

    original, extension, mime_type = validate_upload_content(
        filename=upload.filename,
        content=content,
        allowed_extensions=allowed_extensions,
    )
    return original, extension, mime_type, content


def store_upload(
    *,
    content: bytes,
    storage_root: Path,
    purpose: str,
    owner_key: str,
    extension: str,
) -> Path:
    """Store content under a generated name inside the configured upload root."""

    safe_owner = re.sub(r"[^A-Za-z0-9_.-]", "_", owner_key)[:120] or "unknown"
    root = storage_root.resolve()
    destination_dir = (root / purpose / safe_owner).resolve()
    if root != destination_dir and root not in destination_dir.parents:
        raise HTTPException(status_code=400, detail="Invalid upload destination")

    destination_dir.mkdir(parents=True, exist_ok=True)
    destination = (destination_dir / f"{uuid4().hex}{extension}").resolve()
    if destination_dir not in destination.parents:
        raise HTTPException(status_code=400, detail="Invalid upload destination")

    with destination.open("xb") as handle:
        handle.write(content)
    return destination


@dataclass(frozen=True)
class RateLimitRule:
    limit: int
    window_seconds: int = 60


class InMemoryRateLimiter:
    """Small, thread-safe limiter for a single API process.

    Deployments with multiple API workers should replace this store with a
    shared Redis-backed limiter while retaining the same endpoint policy.
    """

    def __init__(self) -> None:
        self._events: Dict[str, Deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def check(self, key: str, rule: RateLimitRule) -> Tuple[bool, int]:
        now = monotonic()
        cutoff = now - rule.window_seconds
        with self._lock:
            events = self._events[key]
            while events and events[0] <= cutoff:
                events.popleft()

            if len(events) >= rule.limit:
                retry_after = max(1, int(rule.window_seconds - (now - events[0])))
                return False, retry_after

            events.append(now)
            return True, 0


def configured_upload_root(module_file: str) -> Path:
    configured = os.getenv("UPLOAD_STORAGE_ROOT", "").strip()
    if configured:
        return Path(configured)
    return Path(module_file).resolve().parent / "uploads"
