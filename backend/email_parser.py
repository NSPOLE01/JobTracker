import os
import re
import json

# Used as a cheap pre-filter before calling Claude
JOB_KEYWORDS = [
    "application received", "thank you for applying", "application submitted",
    "your application", "applied for", "job application",
    "interview", "phone screen", "technical interview", "onsite interview",
    "offer letter", "job offer", "pleased to offer",
    "regret to inform", "not moving forward", "unfortunately",
    "under review", "reviewing your application",
    "hiring process", "recruitment", "candidacy",
]

# Cached at the API level — only sent once per session
_SYSTEM_PROMPT = """You are an expert at identifying and extracting structured data from job application emails.

Determine whether an email is part of a job application process and extract key details.

Mark as job-related ONLY for emails that are specifically about a job application:
✓ Application confirmation or receipt
✓ Interview invitation or scheduling (any round)
✓ Offer letter or verbal offer
✓ Rejection or "not moving forward" notice
✓ Application status update from a company
✓ Recruiter outreach about a specific named role

NOT job-related:
✗ Generic LinkedIn notifications or connection requests
✗ Job alert digest emails (lists of jobs, not a single application)
✗ Newsletter or marketing emails
✗ Mass recruiter outreach with no specific role mentioned
✗ Password reset, account, or billing emails

Status definitions:
- applied: Application was received or confirmed by the company
- in_review: Application is actively being reviewed
- phone_screen: Initial phone or recruiter screen scheduled or completed
- interview_scheduled: Technical, behavioral, or panel interview scheduled or completed
- offer: Job offer has been extended to the candidate
- rejected: Application was not selected / not moving forward

Respond with ONLY valid JSON, no markdown, no explanation."""

SKIP_DOMAINS = {
    "gmail", "yahoo", "hotmail", "outlook", "icloud", "me",
    "noreply", "no-reply", "notifications", "mailer", "bounce",
    "lever", "greenhouse", "workday", "taleo", "icims",
    "smartrecruiters", "jobvite", "ashbyhq", "myworkdayjobs",
}


def is_job_related(subject: str, snippet: str) -> bool:
    text = f"{subject} {snippet}".lower()
    return any(kw in text for kw in JOB_KEYWORDS)


def extract_job_details(subject: str, body: str, sender: str) -> dict:
    # Pre-filter with keywords to avoid paying for obvious non-job emails
    if not is_job_related(subject, body[:600]):
        return {"is_job_related": False, "company": None, "role": None, "status": None}

    if os.getenv("ANTHROPIC_API_KEY"):
        try:
            return _extract_with_claude(subject, body, sender)
        except Exception as e:
            print(f"Claude parsing failed: {e}, falling back to keywords")
    return _extract_with_keywords(subject, body, sender)


def _extract_with_claude(subject: str, body: str, sender: str) -> dict:
    from anthropic import Anthropic
    client = Anthropic()

    user_message = f"""Email:
From: {sender}
Subject: {subject}
Body: {body[:2000]}

Respond with JSON only:
{{"is_job_related": true/false, "company": "Company Name or null", "role": "Job Title or null", "status": "applied|in_review|phone_screen|interview_scheduled|offer|rejected|null"}}"""

    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=300,
        system=[{
            "type": "text",
            "text": _SYSTEM_PROMPT,
            "cache_control": {"type": "ephemeral"},
        }],
        messages=[{"role": "user", "content": user_message}],
    )

    text = message.content[0].text.strip()
    # Strip markdown code fences if present
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.MULTILINE).strip()
    return json.loads(text)


def _extract_with_keywords(subject: str, body: str, sender: str) -> dict:
    text = f"{subject} {body}".lower()
    status = "applied"

    STATUS_KEYWORDS = {
        "offer":                ["offer letter", "pleased to offer", "job offer", "extend an offer", "offer of employment"],
        "rejected":             ["regret to inform", "not moving forward", "unfortunately we", "unable to move forward", "not selected", "other candidates", "will not be moving"],
        "interview_scheduled":  ["interview", "schedule a time", "calendar invite", "technical screen", "onsite", "virtual interview", "coding interview"],
        "phone_screen":         ["phone screen", "phone call", "recruiter call", "initial call", "quick call", "brief call"],
        "in_review":            ["under review", "reviewing your", "being reviewed", "actively reviewing"],
        "applied":              ["application received", "thank you for applying", "application submitted", "received your application"],
    }
    for s, keywords in STATUS_KEYWORDS.items():
        if any(kw in text for kw in keywords):
            status = s
            break

    company = _extract_company(subject, sender)
    role = _extract_role(subject)
    return {"is_job_related": True, "company": company, "role": role, "status": status}


def _extract_company(subject: str, sender: str) -> str | None:
    if "@" in sender:
        domain = sender.split("@")[-1].split(".")[0].lower()
        if domain not in SKIP_DOMAINS and len(domain) > 2:
            return domain.replace("-", " ").title()
    patterns = [
        r"(?:at|from|with)\s+([A-Z][A-Za-z0-9\s&,\.]+?)(?:\s+(?:for|re:|-|\(|Team|Recruiting)|\.|$)",
        r"([A-Z][A-Za-z0-9\s&]+?)\s+(?:Application|Interview|Offer|Recruiting|Talent)",
    ]
    for pattern in patterns:
        m = re.search(pattern, subject)
        if m:
            c = m.group(1).strip().rstrip(",.")
            if 2 < len(c) < 50:
                return c
    return None


def _extract_role(subject: str) -> str | None:
    patterns = [
        r"(?:for|position:|role:)\s+([A-Z][A-Za-z\s\-/]+?)(?:\s+at|\s+position|\s+-|\.|,|$)",
        r"(?:Application|Interview)(?:\s+for)?\s+[-–:]?\s*([A-Z][A-Za-z\s\-/]+?)(?:\s+at|\s+@|\.|,|$)",
    ]
    for pattern in patterns:
        m = re.search(pattern, subject)
        if m:
            r = m.group(1).strip().rstrip(".,")
            if 3 < len(r) < 80:
                return r
    return None
