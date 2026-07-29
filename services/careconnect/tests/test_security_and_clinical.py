import io
import json
import tempfile
import unittest
import zipfile
from pathlib import Path
import sys
import types

try:
    from fastapi import HTTPException
except ModuleNotFoundError:
    # The repository's checked-in venv can point at another workstation. Keep
    # these pure helper tests runnable with a bare Python installation.
    fastapi_stub = types.ModuleType("fastapi")

    class HTTPException(Exception):
        def __init__(self, status_code, detail):
            super().__init__(detail)
            self.status_code = status_code
            self.detail = detail

    class Status:
        HTTP_413_REQUEST_ENTITY_TOO_LARGE = 413

    fastapi_stub.HTTPException = HTTPException
    fastapi_stub.UploadFile = object
    fastapi_stub.status = Status()
    sys.modules["fastapi"] = fastapi_stub

from clinical_organization import normalize_category, normalize_tags, parse_iso_date
from security_foundation import (
    InMemoryRateLimiter,
    RateLimitRule,
    store_upload,
    validate_upload_content,
)


def office_archive(prefix: str) -> bytes:
    output = io.BytesIO()
    with zipfile.ZipFile(output, "w") as archive:
        archive.writestr("[Content_Types].xml", "<Types />")
        archive.writestr(f"{prefix}/document.xml", "<document />")
    return output.getvalue()


class UploadValidationTests(unittest.TestCase):
    def test_pdf_signature_is_accepted(self):
        name, extension, mime = validate_upload_content(
            filename="../../report.pdf",
            content=b"%PDF-1.7\nexample",
            allowed_extensions={".pdf"},
        )
        self.assertEqual(name, "report.pdf")
        self.assertEqual(extension, ".pdf")
        self.assertEqual(mime, "application/pdf")

    def test_mismatched_content_is_rejected(self):
        with self.assertRaises(HTTPException) as raised:
            validate_upload_content(
                filename="report.pdf",
                content=b"not a pdf",
                allowed_extensions={".pdf"},
            )
        self.assertEqual(raised.exception.status_code, 400)

    def test_office_archive_must_match_extension(self):
        validate_upload_content(
            filename="report.docx",
            content=office_archive("word"),
            allowed_extensions={".docx"},
        )
        with self.assertRaises(HTTPException):
            validate_upload_content(
                filename="report.docx",
                content=office_archive("xl"),
                allowed_extensions={".docx"},
            )

    def test_storage_uses_generated_name_inside_root(self):
        with tempfile.TemporaryDirectory() as directory:
            stored = store_upload(
                content=b"%PDF-1.7",
                storage_root=Path(directory),
                purpose="medical-records",
                owner_key="person@example.com",
                extension=".pdf",
            )
            self.assertTrue(stored.exists())
            self.assertEqual(stored.read_bytes(), b"%PDF-1.7")
            self.assertIn(Path(directory).resolve(), stored.parents)
            self.assertNotIn("person@example.com", stored.name)


class RateLimiterTests(unittest.TestCase):
    def test_limit_is_enforced(self):
        limiter = InMemoryRateLimiter()
        rule = RateLimitRule(limit=2, window_seconds=60)
        self.assertEqual(limiter.check("login:test", rule), (True, 0))
        self.assertEqual(limiter.check("login:test", rule), (True, 0))
        allowed, retry_after = limiter.check("login:test", rule)
        self.assertFalse(allowed)
        self.assertGreaterEqual(retry_after, 1)


class ClinicalOrganizationTests(unittest.TestCase):
    def test_category_aliases_are_canonical(self):
        self.assertEqual(normalize_category("Lab Results"), ("laboratory", "Laboratory"))
        self.assertEqual(normalize_category("visit_note"), ("visit_note", "Visit Note"))

    def test_tags_are_trimmed_and_deduplicated(self):
        tags = normalize_tags(json.dumps([" Cardiology ", "annual", "cardiology"]))
        self.assertEqual(tags, ["Cardiology", "annual"])

    def test_date_format_is_validated(self):
        self.assertEqual(parse_iso_date("2026-07-28", "date"), "2026-07-28")
        with self.assertRaises(HTTPException):
            parse_iso_date("07/28/2026", "date")


if __name__ == "__main__":
    unittest.main()
