import os
import base64
from datetime import datetime

from cryptography.fernet import Fernet, InvalidToken


def _fernet():
    key = os.getenv("TOKEN_ENCRYPTION_KEY", "")
    return Fernet(key.encode()) if key else None

def _encrypt(text: str) -> str:
    f = _fernet()
    return f.encrypt(text.encode()).decode() if f else text

def _decrypt(text: str) -> str:
    f = _fernet()
    if not f:
        return text
    try:
        return f.decrypt(text.encode()).decode()
    except (InvalidToken, Exception):
        return text  # pre-encryption token; self-migrates on next save

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from google.auth.transport.requests import Request

from email_parser import extract_job_details

_STATUS_ORDER = ["applied", "in_review", "phone_screen", "interview_scheduled", "offer", "rejected"]

def _status_rank(status: str) -> int:
    try:
        return _STATUS_ORDER.index(status)
    except ValueError:
        return -1

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]

# Companies to ignore entirely — excluded at query level and as a post-parse check
EXCLUDED_COMPANIES = {"usertesting", "user testing"}

GMAIL_QUERY = (
    '(subject:application OR subject:interview OR subject:offer '
    'OR subject:"thank you for applying" OR subject:"application received" '
    'OR "your application" OR "regret to inform" OR "job offer" '
    'OR subject:"phone screen" OR subject:candidacy) '
    '-from:me -from:usertesting.com '
    '(in:inbox OR category:promotions OR category:updates)'
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


def _save_token(creds: Credentials) -> None:
    from database import SessionLocal
    from models import OAuthToken
    db = SessionLocal()
    try:
        token = db.query(OAuthToken).first()
        if token:
            token.token_json = _encrypt(creds.to_json())
        else:
            db.add(OAuthToken(token_json=_encrypt(creds.to_json())))
        db.commit()
    finally:
        db.close()


def _load_token_json() -> str | None:
    from database import SessionLocal
    from models import OAuthToken
    db = SessionLocal()
    try:
        token = db.query(OAuthToken).first()
        return _decrypt(token.token_json) if token else None
    finally:
        db.close()


def handle_callback(code: str):
    flow = _get_flow()
    flow.fetch_token(code=code)
    _save_token(flow.credentials)


def load_credentials() -> Credentials | None:
    token_json = _load_token_json()
    if not token_json:
        return None
    import json
    creds = Credentials.from_authorized_user_info(json.loads(token_json), SCOPES)
    if creds and creds.expired and creds.refresh_token:
        try:
            creds.refresh(Request())
            _save_token(creds)
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


def scan_emails(db, days_back: int = None) -> int:
    from models import JobApplication, ProcessedEmail

    creds = load_credentials()
    if not creds:
        return 0

    service = build("gmail", "v1", credentials=creds)
    processed_count = 0

    query = GMAIL_QUERY
    if days_back:
        from datetime import timedelta
        cutoff = (datetime.utcnow() - timedelta(days=days_back)).strftime("%Y/%m/%d")
        query += f" after:{cutoff}"

    try:
        result = service.users().messages().list(
            userId="me", q=query, maxResults=500
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

            company_raw = (details.get("company") or "").lower().strip()
            if any(excl in company_raw for excl in EXCLUDED_COMPANIES):
                db.commit()
                continue

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
                if _status_rank(status) > _status_rank(existing.status):
                    existing.status = status
                existing.email_date = email_date
                existing.snippet = snippet[:500]
                db.add(existing)
                db.flush()
                job_id = existing.id
            else:
                new_job = JobApplication(
                    company=company,
                    role=role,
                    status=status,
                    email_date=email_date,
                    snippet=snippet[:500],
                    sender_email=sender,
                )
                db.add(new_job)
                db.flush()
                job_id = new_job.id

            from models import JobEvent
            db.add(JobEvent(
                job_application_id=job_id,
                status=status,
                email_date=email_date,
                snippet=snippet[:500],
                email_id=msg_id,
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
