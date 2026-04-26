import os
import re
import json

JOB_KEYWORDS = [
    "application received", "thank you for applying", "application submitted",
    "your application", "applied for", "job application",
    "interview", "phone screen", "technical interview", "onsite interview",
    "offer letter", "job offer", "pleased to offer",
    "regret to inform", "not moving forward", "unfortunately",
    "under review", "reviewing your application",
    "hiring process", "recruitment", "candidacy",
]

STATUS_KEYWORDS = {
    "offer": [
        "offer letter", "pleased to offer", "job offer", "extend an offer",
        "offer of employment", "we are offering",
    ],
    "rejected": [
        "regret to inform", "not moving forward", "unfortunately we",
        "unable to move forward", "not selected", "other candidates",
        "will not be moving", "decided to move forward with other",
    ],
    "interview_scheduled": [
        "interview", "schedule a time", "calendar invite", "technical screen",
        "onsite", "virtual interview", "coding interview",
    ],
    "phone_screen": [
        "phone screen", "phone call", "recruiter call", "initial call",
        "quick call", "brief call", "phone interview",
    ],
    "in_review": [
        "under review", "reviewing your", "being reviewed",
        "actively reviewing", "considered for",
    ],
    "applied": [
        "application received", "thank you for applying", "application submitted",
        "received your application", "successfully applied",
    ],
}

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
    if os.getenv("ANTHROPIC_API_KEY"):
        try:
            return _extract_with_claude(subject, body, sender)
        except Exception as e:
            print(f"Claude parsing failed: {e}, falling back to keywords")
    return _extract_with_keywords(subject, body, sender)


def _extract_with_claude(subject: str, body: str, sender: str) -> dict:
    from anthropic import Anthropic
    client = Anthropic()

    prompt = f"""Analyze this email and determine if it's related to a job application.

Email:
- From: {sender}
- Subject: {subject}
- Body: {body[:1500]}

Respond with ONLY valid JSON (no markdown, no explanation):
{{
  "is_job_related": true or false,
  "company": "Company Name or null",
  "role": "Job Title or null",
  "status": "applied | in_review | phone_screen | interview_scheduled | offer | rejected | null"
}}

Status guide:
- applied: application confirmed/received
- in_review: application being reviewed
- phone_screen: phone/recruiter screen scheduled or completed
- interview_scheduled: technical, behavioral, or onsite interview
- offer: job offer extended
- rejected: not moving forward"""

    message = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=256,
        messages=[{"role": "user", "content": prompt}],
    )
    return json.loads(message.content[0].text.strip())


def _extract_with_keywords(subject: str, body: str, sender: str) -> dict:
    text = f"{subject} {body}".lower()

    if not is_job_related(subject, body[:500]):
        return {"is_job_related": False, "company": None, "role": None, "status": None}

    status = "applied"
    for s, keywords in STATUS_KEYWORDS.items():
        if any(kw in text for kw in keywords):
            status = s
            break

    company = _extract_company(subject, sender)
    role = _extract_role(subject)

    return {"is_job_related": True, "company": company, "role": role, "status": status}


def _extract_company(subject: str, sender: str) -> str | None:
    if "@" in sender:
        raw = sender.split("@")[-1]
        domain = raw.split(".")[0].lower()
        if domain not in SKIP_DOMAINS and len(domain) > 2:
            return domain.replace("-", " ").title()

    patterns = [
        r"(?:at|from|with)\s+([A-Z][A-Za-z0-9\s&,\.]+?)(?:\s+(?:for|re:|-|\(|Team|Recruiting)|\.|$)",
        r"([A-Z][A-Za-z0-9\s&]+?)\s+(?:Application|Interview|Offer|Recruiting|Talent)",
    ]
    for pattern in patterns:
        match = re.search(pattern, subject)
        if match:
            candidate = match.group(1).strip().rstrip(",.")
            if 2 < len(candidate) < 50:
                return candidate
    return None


def _extract_role(subject: str) -> str | None:
    patterns = [
        r"(?:for|position:|role:)\s+([A-Z][A-Za-z\s\-/]+?)(?:\s+at|\s+position|\s+-|\.|,|$)",
        r"(?:Application|Interview)(?:\s+for)?\s+[-–:]?\s*([A-Z][A-Za-z\s\-/]+?)(?:\s+at|\s+@|\.|,|$)",
    ]
    for pattern in patterns:
        match = re.search(pattern, subject)
        if match:
            candidate = match.group(1).strip().rstrip(".,")
            if 3 < len(candidate) < 80:
                return candidate
    return None
