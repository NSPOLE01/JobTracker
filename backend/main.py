import asyncio
import os
from contextlib import asynccontextmanager
from datetime import timedelta

from fastapi import FastAPI, Depends, BackgroundTasks, HTTPException, WebSocket, WebSocketDisconnect
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
_loop: asyncio.AbstractEventLoop | None = None


class ConnectionManager:
    def __init__(self):
        self.active: list[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, data: dict):
        dead = []
        for ws in self.active:
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


manager = ConnectionManager()


def _notify(new_jobs: int):
    if _loop and not _loop.is_closed():
        asyncio.run_coroutine_threadsafe(
            manager.broadcast({"type": "scan_complete", "new_jobs": new_jobs}),
            _loop,
        )


def _scheduled_scan():
    db = SessionLocal()
    try:
        n = scan_emails(db)
        print(f"[scheduler] {n} new job(s) found")
        _notify(n)
    finally:
        db.close()


async def _run_scan():
    db = SessionLocal()
    try:
        loop = asyncio.get_event_loop()
        n = await loop.run_in_executor(None, scan_emails, db)
        await manager.broadcast({"type": "scan_complete", "new_jobs": n})
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _loop
    _loop = asyncio.get_running_loop()
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


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(ws)


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

    from datetime import date as date_type
    week_counts: dict[date_type, int] = {}
    for j in jobs:
        if j.email_date:
            week_start = (j.email_date - timedelta(days=j.email_date.weekday())).date()
            week_counts[week_start] = week_counts.get(week_start, 0) + 1

    by_week = [
        {"week": k.strftime("%b %d"), "count": v}
        for k, v in sorted(week_counts.items())
    ]

    return {
        "total": total,
        "interviews": interviews,
        "offers": offers,
        "rejections": rejections,
        "by_week": by_week[-12:],
    }


@app.post("/scan")
async def trigger_scan(background_tasks: BackgroundTasks):
    if not load_credentials():
        raise HTTPException(status_code=401, detail="Not authenticated with Gmail")
    background_tasks.add_task(_run_scan)
    return {"message": "Scan started"}


@app.post("/admin/reset-and-seed")
async def reset_and_seed(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    if not load_credentials():
        raise HTTPException(status_code=401, detail="Not authenticated with Gmail")
    db.execute(models.JobApplication.__table__.delete())
    db.execute(models.ProcessedEmail.__table__.delete())
    db.commit()

    async def _seed():
        seed_db = SessionLocal()
        try:
            loop = asyncio.get_event_loop()
            n = await loop.run_in_executor(None, lambda: scan_emails(seed_db, days_back=30))
            await manager.broadcast({"type": "scan_complete", "new_jobs": n})
        finally:
            seed_db.close()

    background_tasks.add_task(_seed)
    return {"message": "Database cleared. Seeding last 30 days of emails in background."}


@app.delete("/jobs/{job_id}")
def delete_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(models.JobApplication).filter(models.JobApplication.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(job)
    db.commit()
    return {"ok": True}
