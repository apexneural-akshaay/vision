"""
Vision AI Platform  –  API v5.0  (Persistent Streaming)

Architecture:
  • SQLite (vision.db) via SQLAlchemy for persistent device / camera / model /
    deployment storage.
  • Persistent FrameGrabbers: on startup, a background RTSP thread is launched
    for EVERY camera already in the DB.  Streams are live before any browser
    connects — frontend refresh NEVER restarts or interrupts them.
  • Watchdog thread checks every 5 s and auto-restarts any dead grabber.
  • GET /stream/{camera_id}  →  attach any number of browser clients to the
    always-running grabber; no RTSP open on first request.
  • GET /devices/{id}/streams  →  full channel-scan (2–5 s); saves cameras to
    DB and (re-)starts their grabbers; returns proxy_url = /stream/{camera_id}.
  • GET /cameras?device_id=…   →  instant DB read; used by frontend for fast
    initial page load without any RTSP probing delay.
"""

import asyncio
import os
import subprocess
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from contextlib import asynccontextmanager
from typing import Optional

import cv2
import numpy as np
from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import (
    Camera as DBCamera,
    Deployment as DBDeployment,
    Device as DBDevice,
    MLModel as DBModel,
    SessionLocal,
    get_db,
    init_db,
)

# ── Directory setup ───────────────────────────────────────────────────────────
BASE_DIR      = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR    = os.path.join(BASE_DIR, "models")
INFERENCE_DIR = os.path.join(BASE_DIR, "inference")
os.makedirs(MODELS_DIR,    exist_ok=True)
os.makedirs(INFERENCE_DIR, exist_ok=True)

# ── Tuning ────────────────────────────────────────────────────────────────────
PROBE_TIMEOUT_S   = 2.5
CHECK_FRAMES      = 15
BLACK_THRESHOLD   = 10
MAX_AUTO_CHANNELS = 64
BATCH_SIZE        = 16
WORKER_THREADS    = 32
MJPEG_QUALITY     = 80
STREAM_FPS_CAP    = 15
GRABBER_SKIP_INIT = 15       # drain DVR buffer frames to avoid black start
GRABBER_MAX_BLACK = 80       # consecutive black frames before reconnect
GRABBER_RECONNECT = 3.0      # seconds between reconnect attempts
WATCHDOG_INTERVAL = 10       # seconds between watchdog health checks

# ── Runtime state ─────────────────────────────────────────────────────────────
devices_rt:      dict[str, dict]           = {}
camera_grabbers: dict[int, "FrameGrabber"] = {}  # keyed by camera DB id
grabber_configs: dict[int, tuple]          = {}  # cam_id -> (channel, cfg)
MAX_CONCURRENT_GRABBERS = 32                     # Adjust based on your DVR; most support 10-32+
executor = ThreadPoolExecutor(max_workers=WORKER_THREADS)

# ── Placeholder JPEG (sent when grabber has no frame yet) ─────────────────────
def _make_placeholder() -> bytes:
    """Dark grey 640×480 frame with 'Connecting…' text."""
    img = np.full((480, 640, 3), 20, dtype=np.uint8)
    cv2.putText(img, "Connecting...", (200, 245),
                cv2.FONT_HERSHEY_SIMPLEX, 1.0, (100, 100, 100), 2, cv2.LINE_AA)
    _, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 60])
    return buf.tobytes()

PLACEHOLDER_FRAME: bytes = _make_placeholder()


# ── FrameGrabber ──────────────────────────────────────────────────────────────
class FrameGrabber:
    """
    One persistent background thread per camera channel.

    • Drains GRABBER_SKIP_INIT frames on open to flush DVR buffer.
    • Caches latest valid JPEG; all browser clients share ONE RTSP connection.
    • Auto-reconnects on failure or persistent black frames.
    • skip_frame counter drops every 5th frame to stay ≤ STREAM_FPS_CAP.
    """

    def __init__(self, channel: int, cfg: dict):
        self.channel = channel
        self.cfg     = cfg
        self._frame: Optional[bytes] = None
        self._lock   = threading.Lock()
        self._stop   = threading.Event()
        self._thread = threading.Thread(
            target=self._loop, daemon=True,
            name=f"grabber-{cfg.get('device_id','?')}-ch{channel}",
        )

    def start(self) -> "FrameGrabber":
        self._thread.start()
        return self

    def stop(self):
        self._stop.set()

    def get_frame(self) -> Optional[bytes]:
        with self._lock:
            return self._frame

    def _open_cap(self) -> cv2.VideoCapture:
        cap = cv2.VideoCapture(_rtsp_url(self.channel, self.cfg), cv2.CAP_FFMPEG)
        cap.set(cv2.CAP_PROP_BUFFERSIZE,        1)
        cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 8_000)
        cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC, 6_000)
        return cap

    def _loop(self):
        skip = 0
        while not self._stop.is_set():
            cap = self._open_cap()
            if not cap.isOpened():
                time.sleep(GRABBER_RECONNECT)
                continue

            # Drain initial buffered / transitional black frames
            for _ in range(GRABBER_SKIP_INIT):
                if self._stop.is_set():
                    break
                cap.read()

            consecutive_black = 0
            while not self._stop.is_set():
                ok, frame = cap.read()
                if not ok:
                    break   # trigger reconnect

                # Drop every 5th frame to cap CPU/bandwidth
                skip += 1
                if skip % 5 == 0:
                    continue

                gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
                if float(np.mean(gray)) < BLACK_THRESHOLD:
                    consecutive_black += 1
                    if consecutive_black > GRABBER_MAX_BLACK:
                        break   # persistent black → reconnect
                    continue

                consecutive_black = 0
                frame = cv2.resize(frame, (640, 640))
                _, buf = cv2.imencode(
                    ".jpg", frame,
                    [cv2.IMWRITE_JPEG_QUALITY, MJPEG_QUALITY],
                )
                with self._lock:
                    self._frame = buf.tobytes()

            cap.release()
            if not self._stop.is_set():
                time.sleep(GRABBER_RECONNECT)


# ── Grabber management ────────────────────────────────────────────────────────
def _start_camera_grabber(cam_id: int, channel: int, cfg: dict) -> FrameGrabber:
    """Return existing live grabber or start a new one. Keeps grabbers running."""
    existing = camera_grabbers.get(cam_id)
    if existing and existing._thread.is_alive():
        return existing

    # Start new grabber (no aggressive stopping - DVR supports many connections)
    grabber = FrameGrabber(channel, cfg).start()
    camera_grabbers[cam_id] = grabber
    grabber_configs[cam_id] = (channel, cfg)
    return grabber


def _stop_device_grabbers(device_id: str):
    """Stop and remove all grabbers that belong to a given device."""
    to_stop = [
        cid for cid, (ch, cfg) in grabber_configs.items()
        if cfg.get("device_id") == device_id
    ]
    for cid in to_stop:
        camera_grabbers[cid].stop()
        camera_grabbers.pop(cid, None)
        grabber_configs.pop(cid, None)


def _grabber_watchdog():
    """Background thread: restart any dead grabber every WATCHDOG_INTERVAL s."""
    while True:
        time.sleep(WATCHDOG_INTERVAL)
        for cam_id in list(grabber_configs.keys()):
            grabber = camera_grabbers.get(cam_id)
            if grabber is None or not grabber._thread.is_alive():
                channel, cfg = grabber_configs[cam_id]
                new_grabber = FrameGrabber(channel, cfg).start()
                camera_grabbers[cam_id] = new_grabber


# ── RTSP URL builder ──────────────────────────────────────────────────────────
def _rtsp_url(channel: int, cfg: dict, subtype: int = 0) -> str:
    return (
        f"rtsp://{cfg['username']}:{cfg['password']}"
        f"@{cfg['dvr_ip']}:{cfg['rtsp_port']}"
        f"/cam/realmonitor?channel={channel}&subtype={subtype}"
    )


def _cfg_from_db(dev: DBDevice) -> dict:
    return {
        "device_id":    dev.device_id,
        "name":         dev.name,
        "device_type":  dev.device_type,
        "dvr_ip":       dev.ip,
        "rtsp_port":    dev.rtsp_port,
        "username":     dev.username,
        "password":     dev.password,
        "max_channels": None,
    }


# ── Lifespan ──────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    db = SessionLocal()
    try:
        # Load all devices into runtime dict
        for dev in db.query(DBDevice).all():
            devices_rt[dev.device_id] = _cfg_from_db(dev)

        # Start grabbers for all known cameras immediately
        # Streams warm up in background; users see them instantly
        for cam in db.query(DBCamera).all():
            if cam.device and cam.device.device_id in devices_rt:
                cfg = devices_rt[cam.device.device_id]
                _start_camera_grabber(cam.id, cam.channel, cfg)
    finally:
        db.close()

    # Watchdog restarts any crashed grabbers every 5 seconds
    threading.Thread(
        target=_grabber_watchdog, daemon=True, name="grabber-watchdog"
    ).start()

    yield

    for g in list(camera_grabbers.values()):
        g.stop()


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(title="Vision AI Platform", version="5.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Pydantic schemas ──────────────────────────────────────────────────────────
class DeviceConfig(BaseModel):
    device_type:  str           = "DVR"
    name:         Optional[str] = None
    dvr_ip:       str
    rtsp_port:    int           = 554
    username:     str
    password:     str
    max_channels: Optional[int] = None


class DeploymentCreate(BaseModel):
    camera_id: int
    model_id:  int


# ── MJPEG generator ───────────────────────────────────────────────────────────
async def _mjpeg(grabber: FrameGrabber):
    """
    Stream MJPEG frames. Sends placeholder while grabber is still connecting
    so the browser keeps the connection open instead of showing broken image.
    """
    interval = 1.0 / STREAM_FPS_CAP
    while True:
        frame_bytes = grabber.get_frame() or PLACEHOLDER_FRAME
        yield (
            b"--frame\r\n"
            b"Content-Type: image/jpeg\r\n\r\n"
            + frame_bytes
            + b"\r\n"
        )
        await asyncio.sleep(interval)


# ── Channel probe (used only during discovery) ────────────────────────────────
def _probe(channel: int, cfg: dict) -> dict:
    """Synchronous – called inside thread pool during channel scan."""
    url = _rtsp_url(channel, cfg)
    cap = cv2.VideoCapture(url, cv2.CAP_FFMPEG)
    ms  = int(PROBE_TIMEOUT_S * 1_000)
    cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, ms)
    cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC, ms)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 2)

    ok, _ = cap.read()
    if not ok:
        cap.release()
        return {"alive": False, "black": True, "resolution": ""}

    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    best_lum = 0.0
    for _ in range(CHECK_FRAMES - 1):
        ok, frame = cap.read()
        if not ok or frame is None:
            break
        lum = float(np.mean(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)))
        if lum > best_lum:
            best_lum = lum
        if best_lum > BLACK_THRESHOLD:
            break

    cap.release()
    return {
        "alive":      True,
        "black":      best_lum < BLACK_THRESHOLD,
        "resolution": f"{w}×{h}" if w > 0 and h > 0 else "",
    }


# ── Auto-discovery ────────────────────────────────────────────────────────────
async def _discover(cfg: dict) -> list[dict]:
    loop    = asyncio.get_event_loop()
    ceiling = min(cfg.get("max_channels") or MAX_AUTO_CHANNELS, MAX_AUTO_CHANNELS)
    results: dict[int, dict] = {}

    ch = 1
    while ch <= ceiling:
        batch   = list(range(ch, min(ch + BATCH_SIZE, ceiling + 1)))
        futures = [loop.run_in_executor(executor, _probe, b, cfg) for b in batch]
        batch_r = await asyncio.gather(*futures)

        any_alive = False
        for channel, r in zip(batch, batch_r):
            results[channel] = r
            if r["alive"]:
                any_alive = True

        if not any_alive:
            break
        ch += BATCH_SIZE

    return [
        {
            "channel":    ch_num,
            "label":      f"Camera {ch_num:02d}",
            "rtsp_url":   _rtsp_url(ch_num, cfg),
            "status":     "live",
            "resolution": r["resolution"],
        }
        for ch_num, r in sorted(results.items())
        if r["alive"] and not r["black"]
    ]


# ═══════════════════════════════════════════════════════════════════════════════
#  API ROUTES
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/health")
async def health():
    active = sum(1 for g in camera_grabbers.values() if g._thread.is_alive())
    return {
        "status":           "ok",
        "devices":          len(devices_rt),
        "active_grabbers":  active,
        "total_grabbers":   len(camera_grabbers),
        "max_concurrent":   MAX_CONCURRENT_GRABBERS,
    }


@app.get("/health/cameras")
async def health_cameras(db: Session = Depends(get_db)):
    """Diagnostic: check all cameras and their grabber status."""
    cameras = db.query(DBCamera).all()
    status = []
    for cam in cameras:
        grabber = camera_grabbers.get(cam.id)
        is_live = grabber and grabber._thread.is_alive()
        status.append({
            "id":      cam.id,
            "name":    cam.name,
            "channel": cam.channel,
            "device":  cam.device.name if cam.device else "unknown",
            "grabber_running": is_live,
            "frame_available": grabber and grabber.get_frame() is not None if grabber else False,
        })
    return {
        "total_cameras": len(cameras),
        "cameras": status,
    }


# ── Persistent MJPEG stream ───────────────────────────────────────────────────

@app.get("/stream/{camera_id}")
async def stream_camera(camera_id: int):
    """
    MJPEG stream for a camera. Grabs from the persistent FrameGrabber.
    DB session is opened and closed BEFORE streaming begins so it never
    blocks the connection pool during the (potentially infinite) stream.
    """
    db = SessionLocal()
    try:
        cam = db.query(DBCamera).filter(DBCamera.id == camera_id).first()
        if not cam:
            raise HTTPException(404, f"Camera {camera_id} not found")
        if not cam.device or cam.device.device_id not in devices_rt:
            raise HTTPException(503, "Device not available — check if it's connected")
        cfg     = devices_rt[cam.device.device_id]
        cam_id  = cam.id
        channel = cam.channel
    finally:
        db.close()   # CRITICAL: release before StreamingResponse is returned

    try:
        grabber = _start_camera_grabber(cam_id, channel, cfg)
        return StreamingResponse(
            _mjpeg(grabber),
            media_type="multipart/x-mixed-replace; boundary=frame",
        )
    except Exception as e:
        raise HTTPException(500, f"Stream error for camera {channel}: {str(e)}")


# ── Devices ───────────────────────────────────────────────────────────────────

@app.get("/devices")
async def list_devices(db: Session = Depends(get_db)):
    return [
        {
            "device_id":   d.device_id,
            "name":        d.name,
            "device_type": d.device_type,
            "dvr_ip":      d.ip,
            "rtsp_port":   d.rtsp_port,
        }
        for d in db.query(DBDevice).all()
    ]


@app.post("/devices", status_code=201)
async def add_device(config: DeviceConfig, db: Session = Depends(get_db)):
    device_id = uuid.uuid4().hex[:8]
    name      = (config.name or f"{config.device_type}-{config.dvr_ip}").strip()

    cfg = {
        "device_id":    device_id,
        "name":         name,
        "device_type":  config.device_type,
        "dvr_ip":       config.dvr_ip,
        "rtsp_port":    config.rtsp_port,
        "username":     config.username,
        "password":     config.password,
        "max_channels": config.max_channels,
    }

    loop  = asyncio.get_event_loop()
    probe = await loop.run_in_executor(executor, _probe, 1, cfg)

    db_dev = DBDevice(
        device_id   = device_id,
        name        = name,
        device_type = config.device_type,
        ip          = config.dvr_ip,
        rtsp_port   = config.rtsp_port,
        username    = config.username,
        password    = config.password,
    )
    db.add(db_dev)
    db.commit()
    db.refresh(db_dev)
    devices_rt[device_id] = cfg

    return {
        "device_id":   device_id,
        "name":        name,
        "device_type": config.device_type,
        "dvr_ip":      config.dvr_ip,
        "rtsp_port":   config.rtsp_port,
        "reachable":   probe["alive"],
        "message": (
            f"Connected to {name}."
            if probe["alive"]
            else "Device saved. Channel 1 did not respond — verify IP, port, and credentials."
        ),
    }


@app.delete("/devices/{device_id}")
async def remove_device(device_id: str, db: Session = Depends(get_db)):
    db_dev = db.query(DBDevice).filter(DBDevice.device_id == device_id).first()
    if not db_dev:
        raise HTTPException(404, "Device not found")
    _stop_device_grabbers(device_id)
    db.delete(db_dev)
    db.commit()
    devices_rt.pop(device_id, None)
    return {"status": "removed"}


# ── Stream discovery ──────────────────────────────────────────────────────────

@app.get("/devices/{device_id}/streams")
async def get_device_streams(device_id: str, db: Session = Depends(get_db)):
    """
    Full channel scan (parallel RTSP probes, ~2–5 s).
    Saves discovered cameras to DB and immediately starts their grabbers.
    Returns proxy_url = /stream/{camera_id} for each live stream.
    """
    if device_id not in devices_rt:
        raise HTTPException(404, "Device not found")

    cfg     = devices_rt[device_id]
    streams = await _discover(cfg)

    db_dev = db.query(DBDevice).filter(DBDevice.device_id == device_id).first()
    if db_dev:
        # Update cameras in-place to keep DB IDs stable.
        # Stable IDs mean frontend stream URLs stay valid across rescans.
        existing = {
            cam.channel: cam
            for cam in db.query(DBCamera).filter(DBCamera.device_id == db_dev.id).all()
        }
        live_channels = {s["channel"] for s in streams}

        for s in streams:
            if s["channel"] in existing:
                # Update existing record (keep same DB id)
                cam = existing[s["channel"]]
                cam.name       = s["label"]
                cam.rtsp_url   = s["rtsp_url"]
                cam.status     = s["status"]
                cam.resolution = s.get("resolution", "")
            else:
                # New channel found — add it
                db.add(DBCamera(
                    device_id  = db_dev.id,
                    name       = s["label"],
                    channel    = s["channel"],
                    rtsp_url   = s["rtsp_url"],
                    status     = s["status"],
                    resolution = s.get("resolution", ""),
                ))

        # Remove cameras for channels that disappeared (stop their grabbers first)
        for ch, cam in existing.items():
            if ch not in live_channels:
                # Stop grabber before removing from DB
                if cam.id in camera_grabbers:
                    camera_grabbers[cam.id].stop()
                    camera_grabbers.pop(cam.id, None)
                    grabber_configs.pop(cam.id, None)
                db.delete(cam)

        db.commit()

        # Re-query to get final DB ids, start/refresh grabbers
        cam_map = {
            cam.channel: cam
            for cam in db.query(DBCamera).filter(DBCamera.device_id == db_dev.id).all()
        }
        for s in streams:
            db_cam = cam_map.get(s["channel"])
            if db_cam:
                s["camera_id"] = db_cam.id
                s["proxy_url"] = f"/stream/{db_cam.id}"
                _start_camera_grabber(db_cam.id, db_cam.channel, cfg)

    return {
        "device_id":  device_id,
        "live_count": len(streams),
        "streams":    streams,
    }


# ── Cameras (fast DB read, no RTSP) ──────────────────────────────────────────

@app.get("/cameras")
async def list_cameras(device_id: Optional[str] = None, db: Session = Depends(get_db)):
    """
    Return cameras from DB instantly.  Accepts optional device_id query param.
    Each camera includes proxy_url = /stream/{id} for direct MJPEG access.
    """
    q = db.query(DBCamera)
    if device_id:
        dev = db.query(DBDevice).filter(DBDevice.device_id == device_id).first()
        if not dev:
            return []
        q = q.filter(DBCamera.device_id == dev.id)
    return [
        {
            "id":          c.id,
            "camera_id":   c.id,
            "device_id":   c.device.device_id if c.device else None,
            "device_name": c.device.name      if c.device else None,
            "name":        c.name,
            "channel":     c.channel,
            "rtsp_url":    c.rtsp_url,
            "status":      c.status,
            "resolution":  c.resolution,
            "proxy_url":   f"/stream/{c.id}",
        }
        for c in q.all()
    ]


# ── Legacy stream endpoint ────────────────────────────────────────────────────

@app.get("/devices/{device_id}/stream/{channel}")
async def stream_channel_legacy(device_id: str, channel: int):
    """Legacy – use /stream/{camera_id} instead."""
    if device_id not in devices_rt:
        raise HTTPException(404, "Device not found")
    # Open and close DB session BEFORE streaming to avoid pool exhaustion
    db = SessionLocal()
    try:
        db_dev = db.query(DBDevice).filter(DBDevice.device_id == device_id).first()
        if not db_dev:
            raise HTTPException(404, "Device not in DB")
        cam = db.query(DBCamera).filter(
            DBCamera.device_id == db_dev.id, DBCamera.channel == channel
        ).first()
        if not cam:
            raise HTTPException(404, "Camera not found — run discovery first")
        cam_id = cam.id
    finally:
        db.close()   # release before streaming

    cfg     = devices_rt[device_id]
    grabber = _start_camera_grabber(cam_id, channel, cfg)
    return StreamingResponse(
        _mjpeg(grabber),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


# ── Inference streaming (deployment with model output) ────────────────────────
@app.get("/stream_inference/{deployment_id}")
async def stream_with_inference(deployment_id: int):
    """Stream with real-time inference (bounding boxes, labels, etc)"""
    db = SessionLocal()
    try:
        # Get deployment with all linked data
        dep = db.query(DBDeployment).filter(DBDeployment.id == deployment_id).first()
        if not dep:
            raise HTTPException(404, "Deployment not found")

        cam = db.query(DBCamera).filter(DBCamera.id == dep.camera_id).first()
        if not cam:
            raise HTTPException(404, "Camera not found")

        model = db.query(DBModel).filter(DBModel.id == dep.model_id).first()
        if not model:
            raise HTTPException(404, "Model not found")

        if not cam.device or cam.device.device_id not in devices_rt:
            raise HTTPException(503, "Device not available")

        # Ensure model files exist
        if not os.path.exists(model.file_path):
            raise HTTPException(500, f"Model file not found: {model.file_path}")
        if not os.path.exists(model.inference_path):
            raise HTTPException(500, f"Inference script not found: {model.inference_path}")

        cfg = devices_rt[cam.device.device_id]
        cam_id = cam.id
        channel = cam.channel
        model_file = model.file_path
        inference_file = model.inference_path
    finally:
        db.close()

    # Start grabber for this camera
    grabber = _start_camera_grabber(cam_id, channel, cfg)

    # Load inference module
    import importlib.util
    spec = importlib.util.spec_from_file_location("inference_module", inference_file)
    inference_module = importlib.util.module_from_spec(spec)
    try:
        spec.loader.exec_module(inference_module)
        # Set model path if function exists
        if hasattr(inference_module, 'set_model_path'):
            inference_module.set_model_path(model_file)
    except Exception as e:
        raise HTTPException(500, f"Failed to load inference: {str(e)}")

    async def _mjpeg_with_inference():
        interval = 1.0 / STREAM_FPS_CAP
        while True:
            frame_bytes = grabber.get_frame()
            if not frame_bytes:
                frame_bytes = PLACEHOLDER_FRAME
            else:
                # Decode JPEG
                try:
                    frame = cv2.imdecode(np.frombuffer(frame_bytes, np.uint8), cv2.IMREAD_COLOR)
                    if frame is not None and hasattr(inference_module, 'run'):
                        # Run inference on frame
                        frame = inference_module.run(frame)
                        # Re-encode to JPEG
                        _, frame_bytes = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, MJPEG_QUALITY])
                        frame_bytes = frame_bytes.tobytes()
                except Exception as e:
                    print(f"Inference error: {e}")
                    # Fall back to original frame on inference error

            yield (
                b"--frame\r\n"
                b"Content-Type: image/jpeg\r\n\r\n"
                + frame_bytes
                + b"\r\n"
            )
            await asyncio.sleep(interval)

    return StreamingResponse(
        _mjpeg_with_inference(),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


# ── Models ────────────────────────────────────────────────────────────────────

@app.get("/models")
async def list_models(db: Session = Depends(get_db)):
    return [
        {
            "id":             m.id,
            "name":           m.name,
            "version":        m.version,
            "framework":      m.framework,
            "size":           m.size,
            "accuracy":       m.accuracy,
            "file_path":      m.file_path,
            "inference_path": m.inference_path,
        }
        for m in db.query(DBModel).all()
    ]


@app.post("/models", status_code=201)
async def upload_model(
    name:           str        = Form(...),
    version:        str        = Form("v1.0"),
    framework:      str        = Form("YOLOv8"),
    accuracy:       int        = Form(0),
    model_file:     UploadFile = File(...),
    inference_file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    uid = uuid.uuid4().hex[:8]

    model_fname = f"{uid}_{model_file.filename}"
    model_path  = os.path.join(MODELS_DIR, model_fname)
    content     = await model_file.read()
    with open(model_path, "wb") as fh:
        fh.write(content)
    size_mb = f"{len(content) / (1024 * 1024):.1f} MB"

    inf_fname = f"{uid}_inference.py"
    inf_path  = os.path.join(INFERENCE_DIR, inf_fname)
    with open(inf_path, "wb") as fh:
        fh.write(await inference_file.read())

    db_model = DBModel(
        name           = name,
        version        = version,
        framework      = framework,
        accuracy       = accuracy,
        size           = size_mb,
        file_path      = model_path,
        inference_path = inf_path,
    )
    db.add(db_model)
    db.commit()
    db.refresh(db_model)

    return {
        "id":             db_model.id,
        "name":           db_model.name,
        "version":        db_model.version,
        "framework":      db_model.framework,
        "size":           db_model.size,
        "accuracy":       db_model.accuracy,
        "file_path":      model_path,
        "inference_path": inf_path,
    }


@app.delete("/models/{model_id}")
async def delete_model(model_id: int, db: Session = Depends(get_db)):
    m = db.query(DBModel).filter(DBModel.id == model_id).first()
    if not m:
        raise HTTPException(404, "Model not found")

    # Store file paths to delete
    file_path = m.file_path
    inference_path = m.inference_path

    # Delete related deployments first (FK NOT NULL constraint prevents model deletion otherwise)
    db.query(DBDeployment).filter(DBDeployment.model_id == model_id).delete()

    # Delete the model
    db.delete(m)
    db.commit()

    # Delete files in separate subprocess (completely outside uvicorn's file watcher)
    # This prevents WatchFiles from detecting the file deletion and triggering reload
    def cleanup():
        import time
        time.sleep(1)  # Brief delay to ensure response is fully sent
        for path in [file_path, inference_path]:
            try:
                if path and os.path.exists(path):
                    # Use subprocess to delete (isolated from uvicorn's file watcher)
                    if os.name == 'nt':  # Windows
                        subprocess.Popen(['del', '/Q', path], shell=True,
                                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                    else:  # Unix/Linux/Mac
                        subprocess.Popen(['rm', '-f', path],
                                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            except Exception as e:
                print(f"Cleanup: Failed to delete {path}: {e}")

    threading.Thread(target=cleanup, daemon=True).start()
    return {"status": "deleted"}


# ── Deployments ───────────────────────────────────────────────────────────────

@app.get("/deployments")
async def list_deployments(db: Session = Depends(get_db)):
    return [
        {
            "id":            d.id,
            "camera_id":     d.camera_id,
            "camera_name":   d.camera.name                    if d.camera              else None,
            "device_name":   d.camera.device.name             if d.camera and d.camera.device else None,
            "model_id":      d.model_id,
            "model_name":    d.model.name                     if d.model               else None,
            "model_version": d.model.version                  if d.model               else None,
            "status":        d.status,
        }
        for d in db.query(DBDeployment).all()
    ]


@app.post("/deployments", status_code=201)
async def create_deployment(dep: DeploymentCreate, db: Session = Depends(get_db)):
    """Deploy an ML model to a camera stream."""
    if not isinstance(dep.camera_id, int) or not isinstance(dep.model_id, int):
        raise HTTPException(400, "camera_id and model_id must be integers")

    cam = db.query(DBCamera).filter(DBCamera.id == dep.camera_id).first()
    if not cam:
        raise HTTPException(404, f"Camera {dep.camera_id} not found — run stream discovery first")

    model = db.query(DBModel).filter(DBModel.id == dep.model_id).first()
    if not model:
        raise HTTPException(404, f"Model {dep.model_id} not found")

    try:
        db_dep = DBDeployment(
            camera_id = dep.camera_id,
            model_id  = dep.model_id,
            status    = "active",
        )
        db.add(db_dep)
        db.commit()
        db.refresh(db_dep)
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Deployment failed: {str(e)}")

    return {
        "id":        db_dep.id,
        "camera_id": db_dep.camera_id,
        "model_id":  db_dep.model_id,
        "status":    db_dep.status,
        "message":   f"Model '{model.name}' deployed to Camera {cam.channel} ('{cam.name}')",
    }


@app.delete("/deployments/{dep_id}")
async def delete_deployment(dep_id: int, db: Session = Depends(get_db)):
    dep = db.query(DBDeployment).filter(DBDeployment.id == dep_id).first()
    if not dep:
        raise HTTPException(404, "Deployment not found")
    db.delete(dep)
    db.commit()
    return {"status": "removed"}


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        # Exclude model/inference dirs from file watcher
        # so uploading/deleting .pt or .py files won't restart the server
        reload_excludes=[
            "models/*",
            "inference/*",
            "*.pt",
            "*.db",
            "*.db-shm",
            "*.db-wal",
        ],
    )
