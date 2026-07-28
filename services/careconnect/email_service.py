import smtplib
from email.message import EmailMessage
import os
from dotenv import load_dotenv
load_dotenv()
import json
import base64
import urllib.request
import urllib.error

MAILJET_API_URL = "https://api.mailjet.com/v3.1/send"

PLACEHOLDER_VALUES = {
    "", None, "your_email@example.com", "your_email_app_password",
    "your_mailjet_api_key", "your_mailjet_secret", "your_verified_mailjet_from_email"
}

def _is_real_value(value: str) -> bool:
    return value is not None and value.strip() not in PLACEHOLDER_VALUES and not value.strip().startswith("your_")

def _get_mailjet_config():
    api_key = os.getenv("MAILJET_API_KEY")
    api_secret = os.getenv("MAILJET_SECRET")
    from_email = os.getenv("MAILJET_FROM_EMAIL")
    from_name = os.getenv("MAILJET_FROM_NAME", "CareConnect Pro")
    if _is_real_value(api_key) and _is_real_value(api_secret) and _is_real_value(from_email):
        return api_key, api_secret, from_email, from_name
    return None

def _send_via_mailjet(to_email: str, subject: str, text: str):
    config = _get_mailjet_config()
    if not config:
        raise RuntimeError("Mailjet not configured")

    api_key, api_secret, from_email, from_name = config
    payload = {
        "Messages": [
            {
                "From": {"Email": from_email, "Name": from_name},
                "To": [{"Email": to_email}],
                "Subject": subject,
                "TextPart": text
            }
        ]
    }

    auth = f"{api_key}:{api_secret}".encode("utf-8")
    headers = {
        "Content-Type": "application/json",
        "Authorization": "Basic " + base64.b64encode(auth).decode("utf-8")
    }

    req = urllib.request.Request(
        MAILJET_API_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            if resp.status >= 400:
                raise RuntimeError(f"Mailjet error: {resp.status}")
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"Mailjet error: {e.code}")

def _send_via_smtp(to_email: str, subject: str, text: str):
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = os.getenv("SMTP_PORT")
    smtp_email = os.getenv("SMTP_EMAIL")
    smtp_password = os.getenv("SMTP_PASSWORD")

    if not all(_is_real_value(v) for v in [smtp_host, smtp_port, smtp_email, smtp_password]):
        raise RuntimeError("SMTP is not configured with real credentials")

    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = smtp_email
    msg["To"] = to_email
    msg.set_content(text)

    with smtplib.SMTP(smtp_host, int(smtp_port), timeout=10) as server:
        server.starttls()
        server.login(smtp_email, smtp_password)
        server.send_message(msg)

def _send_email(to_email: str, subject: str, text: str):
    if _get_mailjet_config():
        _send_via_mailjet(to_email, subject, text)
    else:
        _send_via_smtp(to_email, subject, text)

def send_reset_email(to_email: str, reset_link: str):
    subject = "CareConnect Pro – Reset Your Password"
    text = f"""
Hello,

You requested to reset your CareConnect Pro password.

Click the link below to reset your password:
{reset_link}

This link is valid for 15 minutes.

If you did not request this, please ignore this email.

Thanks,
CareConnect Pro Team
"""

    _send_email(to_email, subject, text)


def send_verification_code(to_email: str, code: str):
    subject = "CareConnect Pro – Verify Your Email"
    text = f"""
Hello,

Use the verification code below to confirm your CareConnect Pro account:

Verification Code: {code}

This code is valid for 10 minutes.

If you did not create an account, please ignore this email.

Thanks,
CareConnect Pro Team
"""

    _send_email(to_email, subject, text)
