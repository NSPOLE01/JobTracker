import os
import base64
from datetime import datetime

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from google.auth.transport.requests import Request

from email_parser import extract_job_details

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]
TOKEN_FILE = "token.json"

GMAIL_QUERY = (
    '(subject:application OR subject:interview OR subject:offer '
    'OR subject:"thank you for applying" OR subject:"application received" '
    'OR "your application" OR "regret to inform" OR "job offer" '
    'OR subject:"phone screen" OR subject:candidacy) -from:me'
)


def _get_flow() -> Flow:
    config = {
        "web": {
            "client_id": os.getenv("GOOGLE_CLIENT_ID"),
            "client_secret": os.getenv("GOOGLE_CLIENT_SECRET"),
            "redirect_uris": [os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/google/callback")],
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
        }
    }
    flow = Flow.from_client_config(config, scopes=SCOPES)
    flow.redirect_uri = os.getenv("GOOGLE_REDIRECT_URI", "http://localhost:8000/auth/google/callback")
    return flow


def get_auth_url() -> str:
    flow = _get_flow()
    url, _ = flow.authorization_url(access_type="offline", prompt="consent")
    return url


def handle_callback(code: str):
    flow = _get_flow()
    flow.fetch_token(code=code)
    with open(TOKEN_FILE, "w") as f:
        f.write(flow.credentials.to_json())


def load_credentials() -> Credentials | None:
    if not os.path.exists(TOKEN_FILE):
        return None
    creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)
    if creds and creds.expired and creds.refresh_token:
        try:
            creds.refresh(Request())
            with open(TOKEN_FILE, "w") as f:
                f.write(creds.to_json())
        except Exception:
            return None
    return creds if (creds and creds.valid) else None


def get_user_email() -> str | None:
    creds = load_credentials()
    if not creds:
        return None
    service = build("gmail", "v1", credentials=creds)
    profile = service.users().getProfile(userId="me").execute()
    return profile.get("emailAddress")


def scan_emails(db) -> int:
    from models import JobApplication, ProcessedEmail

    creds = load_credentials()
    if not creds:
        return 0

    service = build("gmail", "v1", credentials=creds)
    processed_count = 0

    try:
        result = service.users().messages().list(
            userId="me", q=GMAIL_QUERY, maxResults=200
        ).execute()
        messages = result.get("messages", [])

        for meta in messages:
            msg_id = meta["id"]

            if db.query(ProcessedEmail).filter_by(email_id=msg_id).first():
                continue

            msg = service.users().messages().get(
                userId="me", id=msg_id, format="full"
            ).execute()

            headers = {h["name"]: h["value"] for h in msg.get("payload", {}).get("headers", [])}
            subject = headers.get("Subject", "")
            sender = headers.get("From", "")
            date_str = headers.get("Date", "")
            snippet = msg.get("snippet", "")
            body = _extract_body(msg)

            details = extract_job_details(subject, body or snippet, sender)

            db.add(ProcessedEmail(email_id=msg_id))

            if not details.get("is_job_related"):
                db.commit()
                continue

            email_date = _parse_date(date_str)
            company = details.get("company")
            role = details.get("role")
            status = details.get("status") or "applied"

            existing = None
            if company:
                query = db.query(JobApplication).filter(
                    JobApplication.company.ilike(f"%{company}%")
                )
                if role:
                    existing = query.filter(JobApplication.role.ilike(f"%{role}%")).first()
                if not existing:
                    existing = query.order_by(JobApplication.email_date.desc()).first()

            if existing:
                existing.status = status
                existing.email_date = email_date
                existing.snippet = snippet[:500]
                db.add(existing)
            else:
                db.add(JobApplication(
                    company=company,
                    role=role,
                    status=status,
                    email_date=email_date,
                    snippet=snippet[:500],
                    sender_email=sender,
                ))

            db.commit()
            processed_count += 1

    except Exception as e:
        print(f"Scan error: {e}")
        db.rollback()

    return processed_count


def _extract_body(msg: dict) -> str:
    def recurse(payload):
        if payload.get("mimeType") == "text/plain":
            data = payload.get("body", {}).get("data", "")
            if data:
                return base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")
        for part in payload.get("parts", []):
            result = recurse(part)
            if result:
                return result
        return ""
    return recurse(msg.get("payload", {}))[:2000]


def _parse_date(date_str: str) -> datetime:
    try:
        from email.utils import parsedate_to_datetime
        return parsedate_to_datetime(date_str).replace(tzinfo=None)
    except Exception:
        return datetime.utcnow()
