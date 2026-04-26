import os
from contextlib import asynccontextmanager
from datetime import timedelta

from fastapi import FastAPI, Depends, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from apscheduler.schedulers.background import BackgroundScheduler
from dotenv import load_dotenv

load_dotenv()

from database import engine, SessionLocal, get_db
import models
from gmail_service import get_auth_url, handle_callback, load_credentials, get_user_email, scan_emails

models.Base.metadata.create_all(bind=engine)

scheduler = BackgroundScheduler()


def _scheduled_scan():
    db = SessionLocal()
    try:
        n = scan_emails(db)
        if n:
            print(f"[scheduler] {n} new job(s) found")
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.add_job(_scheduled_scan, "interval", minutes=15, id="email_scan")
    scheduler.start()
    yield
    scheduler.shutdown()


app = FastAPI(lifespan=lifespan)

_raw_origins = os.getenv("FRONTEND_URL", "http://localhost:5173,http://127.0.0.1:5173")
_allowed_origins = [o.strip() for o in _raw_origins.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/auth/google")
def google_auth():
    return {"auth_url": get_auth_url()}


@app.get("/auth/google/callback")
def google_callback(code: str):
    handle_callback(code)
    frontend = os.getenv("FRONTEND_URL", "http://localhost:5173")
    return RedirectResponse(url=f"{frontend}?auth=success")


@app.get("/auth/status")
def auth_status():
    creds = load_credentials()
    if not creds:
        return {"authenticated": False, "email": None}
    try:
        return {"authenticated": True, "email": get_user_email()}
    except Exception:
        return {"authenticated": False, "email": None}


@app.get("/jobs")
def get_jobs(db: Session = Depends(get_db)):
    jobs = (
        db.query(models.JobApplication)
        .order_by(models.JobApplication.email_date.desc())
        .all()
    )
    return [
        {
            "id": j.id,
            "company": j.company,
            "role": j.role,
            "status": j.status,
            "email_date": j.email_date.isoformat() if j.email_date else None,
            "snippet": j.snippet,
            "created_at": j.created_at.isoformat() if j.created_at else None,
        }
        for j in jobs
    ]


@app.get("/stats")
def get_stats(db: Session = Depends(get_db)):
    jobs = db.query(models.JobApplication).all()

    total = len(jobs)
    interviews = sum(1 for j in jobs if j.status in ("interview_scheduled", "phone_screen"))
    offers = sum(1 for j in jobs if j.status == "offer")
    rejections = sum(1 for j in jobs if j.status == "rejected")

    week_counts: dict[str, int] = {}
    for j in jobs:
        if j.email_date:
            week_start = j.email_date - timedelta(days=j.email_date.weekday())
            key = week_start.strftime("%b %d")
            week_counts[key] = week_counts.get(key, 0) + 1

    by_week = [{"week": k, "count": v} for k, v in sorted(week_counts.items())]

    return {
        "total": total,
        "interviews": interviews,
        "offers": offers,
        "rejections": rejections,
        "by_week": by_week[-12:],
    }


@app.post("/scan")
def trigger_scan(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    if not load_credentials():
        raise HTTPException(status_code=401, detail="Not authenticated with Gmail")
    background_tasks.add_task(scan_emails, db)
    return {"message": "Scan started"}


@app.delete("/jobs/{job_id}")
def delete_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(models.JobApplication).filter(models.JobApplication.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(job)
    db.commit()
    return {"ok": True}
