"""
routers/dashboard.py — SSE Live Dashboard + KPIs for Retail AI
Pushes live store metrics every 5 seconds via Server-Sent Events.
"""
import asyncio
import json
import random
import datetime
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from app.database.db import SessionLocal
from app.database.models import AnalyticsJob, JobStatus, AlertLog

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _get_live_kpis() -> dict:
    """Pull real data from DB + add simulated live metrics."""
    db = SessionLocal()
    try:
        jobs       = db.query(AnalyticsJob).all()
        completed  = [j for j in jobs if j.status == JobStatus.COMPLETED]
        processing = [j for j in jobs if j.status == JobStatus.PROCESSING]
        alerts_all = db.query(AlertLog).all()

        total_entries = 0
        total_exits   = 0
        shelf_empties = 0
        peak_crowd    = 0

        for j in completed:
            r = j.result or {}
            total_entries += r.get("entries", 0)
            total_exits   += r.get("exits", 0)
            pc = r.get("peak_crowd", {})
            if isinstance(pc, dict):
                peak_crowd = max(peak_crowd, pc.get("count", 0))
            if r.get("shelf_status") in ("EMPTY", "LOW STOCK"):
                shelf_empties += 1

        return {
            "ts":             datetime.datetime.utcnow().isoformat(),
            "total_jobs":     len(jobs),
            "completed_jobs": len(completed),
            "active_jobs":    len(processing),
            "total_entries":  total_entries,
            "total_exits":    total_exits,
            "peak_crowd":     peak_crowd,
            "shelf_alerts":   shelf_empties,
            "total_alerts":   len(alerts_all),
            "unread_alerts":  len([a for a in alerts_all]),
            # Simulated live metrics
            "live_crowd":     random.randint(8, 45),
            "conversion_rate": round(random.uniform(12, 28), 1),
            "avg_dwell_min":  round(random.uniform(4, 18), 1),
            "zone_heatmap": {
                "Entrance":    random.randint(20, 60),
                "Electronics": random.randint(10, 40),
                "Grocery":     random.randint(30, 80),
                "Checkout":    random.randint(15, 50),
                "Apparel":     random.randint(5, 35),
            },
        }
    finally:
        db.close()


@router.get("/stream")
async def sse_stream():
    """SSE endpoint — pushes KPIs every 5 seconds."""
    async def generator():
        while True:
            try:
                data = _get_live_kpis()
                yield f"data: {json.dumps(data)}\n\n"
            except Exception:
                yield f"data: {json.dumps({'error': 'fetch_failed'})}\n\n"
            await asyncio.sleep(5)

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control":               "no-cache",
            "X-Accel-Buffering":           "no",
            "Access-Control-Allow-Origin": "*",
        },
    )


@router.get("/kpis")
def get_kpis():
    return _get_live_kpis()


@router.get("/notifications")
def get_notifications():
    db = SessionLocal()
    try:
        alerts = db.query(AlertLog).order_by(AlertLog.wall_time.desc()).limit(20).all()
        notifs = [
            {
                "id":      a.id,
                "type":    a.severity,
                "title":   f"{a.severity} Alert",
                "message": a.message,
                "time":    str(a.wall_time),
                "read":    False,
            }
            for a in alerts
        ]
        return {"notifications": notifs, "unread": len(notifs)}
    finally:
        db.close()


@router.get("/recent-jobs")
def recent_jobs():
    db = SessionLocal()
    try:
        jobs = db.query(AnalyticsJob).order_by(AnalyticsJob.created_at.desc()).limit(5).all()
        return [
            {
                "job_id":   j.job_id,
                "filename": j.filename,
                "status":   j.status,
                "progress": j.progress,
                "entries":  (j.result or {}).get("entries", 0),
                "exits":    (j.result or {}).get("exits", 0),
                "created_at": str(j.created_at),
            }
            for j in jobs
        ]
    finally:
        db.close()
