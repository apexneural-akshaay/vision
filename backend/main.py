"""
Vision AI Platform – API v8.0

Streaming:
  FrameGrabber   →  one dedicated thread per camera, reads RTSP at full speed,
                     caches latest JPEG. Shared by all viewers of that camera.
  _mjpeg()       →  async generator, reads cached frame, yields MJPEG boundary.
                     Completely non-blocking — the event loop never touches RTSP.

Inference:
  InferenceWorker → two-thread background worker per deployment.
      Reader thread  — opens its own RTSP, stores latest raw BGR.
      Infer thread   — picks latest BGR, runs model, caches annotated JPEG.
  Starts at backend boot. Runs 24/7. Watchdog auto-restarts dead workers.

  /stream_inference reads the cached annotated JPEG (same non-blocking pattern).
"""

import asyncio
import importlib.util
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
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import (
    Camera as DBCamera,
    Deployment as DBDeployment,
    Device as DBDevice,
    Event as DBEvent,
    MLModel as DBModel,
    SessionLocal,
    get_db,
    init_db,
)

# ── Directory setup ───────────────────────────────────────────────────────────
BASE_DIR        = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR      = os.path.join(BASE_DIR, "models")
INFERENCE_DIR   = os.path.join(BASE_DIR, "inference")
EVENTS_DIR      = os.path.join(BASE_DIR, "events", "screenshots")
os.makedirs(MODELS_DIR,    exist_ok=True)
os.makedirs(INFERENCE_DIR, exist_ok=True)
os.makedirs(EVENTS_DIR,    exist_ok=True)

BACKEND_URL = "http://127.0.0.1:8000"

# NOTE: no OPENCV_FFMPEG_CAPTURE_OPTIONS — the default FFMPEG settings handle
# LAN jitter correctly. Setting fflags=nobuffer causes constant frame drops
# and reconnect loops on real networks.

# ── Tuning ────────────────────────────────────────────────────────────────────
PROBE_TIMEOUT_S   = 2.5
CHECK_FRAMES      = 15
BLACK_THRESHOLD   = 10
MAX_AUTO_CHANNELS = 64
BATCH_SIZE        = 16
WORKER_THREADS    = 32
MJPEG_QUALITY     = 80
STREAM_FPS_CAP    = 15      # MJPEG output rate (matches old stable version)
GRABBER_RECONNECT = 3.0     # seconds between reconnect attempts
WATCHDOG_INTERVAL = 10      # seconds between watchdog health checks

# ── Runtime state ─────────────────────────────────────────────────────────────
devices_rt:        dict[str, dict]               = {}
camera_grabbers:   dict[int, "FrameGrabber"]     = {}  # cam_id → grabber
grabber_configs:   dict[int, tuple]              = {}  # cam_id → (channel, cfg)
inference_workers: dict[int, "InferenceWorker"]  = {}  # dep_id → worker
inference_configs: dict[int, tuple]              = {}  # dep_id → (cam_id, inf_path, model_path, rtsp_url)
executor = ThreadPoolExecutor(max_workers=WORKER_THREADS)

# ── Placeholder JPEG ──────────────────────────────────────────────────────────
def _make_placeholder() -> bytes:
    img = np.full((480, 640, 3), 20, dtype=np.uint8)
    cv2.putText(img, "Connecting...", (200, 245),
                cv2.FONT_HERSHEY_SIMPLEX, 1.0, (100, 100, 100), 2, cv2.LINE_AA)
    _, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 60])
    return buf.tobytes()

PLACEHOLDER_FRAME: bytes = _make_placeholder()


# ── RTSP helpers ──────────────────────────────────────────────────────────────
def _rtsp_url(channel: int, cfg: dict, subtype: int = 0) -> str:
    return (
        f"rtsp://{cfg['username']}:{cfg['password']}"
        f"@{cfg['dvr_ip']}:{cfg['rtsp_port']}"
        f"/cam/realmonitor?channel={channel}&subtype={subtype}"
    )

def _cfg_from_db(dev: DBDevice) -> dict:
    return {
        "device_id": dev.device_id, "name": dev.name,
        "device_type": dev.device_type, "dvr_ip": dev.ip,
        "rtsp_port": dev.rtsp_port, "username": dev.username,
        "password": dev.password, "max_channels": None,
    }

def _open_cap(rtsp_url: str) -> cv2.VideoCapture:
    """Exact same pattern as the working test script — nothing extra."""
    cap = cv2.VideoCapture(rtsp_url, cv2.CAP_FFMPEG)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
    return cap


# ══════════════════════════════════════════════════════════════════════════════
#  FrameGrabber — one dedicated thread per camera
# ══════════════════════════════════════════════════════════════════════════════

class FrameGrabber:
    """
    Persistent background thread per camera.
    Reads RTSP at full camera FPS and caches the latest JPEG.
    All browser viewers of this camera share ONE RTSP connection.
    The MJPEG endpoint just reads the cached frame — zero blocking.
    Auto-reconnects on RTSP failure.
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

    def _loop(self):
        """Same as the working test script: open → read → resize → encode."""
        while not self._stop.is_set():
            cap = _open_cap(_rtsp_url(self.channel, self.cfg))
            if not cap.isOpened():
                time.sleep(GRABBER_RECONNECT)
                continue

            while not self._stop.is_set():
                ret, frame = cap.read()
                if not ret:
                    break
                frame = cv2.resize(frame, (800, 450))
                _, buf = cv2.imencode(
                    ".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, MJPEG_QUALITY]
                )
                with self._lock:
                    self._frame = buf.tobytes()

            cap.release()
            if not self._stop.is_set():
                time.sleep(GRABBER_RECONNECT)


# ══════════════════════════════════════════════════════════════════════════════
#  InferenceWorker — your working RTSP code + model
# ══════════════════════════════════════════════════════════════════════════════

class InferenceWorker:
    """
    Uses your exact _open_cap code in a reader thread that runs at full camera
    speed — buffer never fills up. A second thread runs the model on the latest
    frame. This is needed because YOLO takes ~300ms/frame on CPU — if we read
    and infer in one thread, the buffer fills with 10 stale frames during each
    inference and the stream falls behind.

    Reader:  cap.read() → resize(800,450) → store in _raw   (runs at 30fps)
    Infer:   pick latest _raw → model.run() → encode JPEG    (runs at ~3fps)

    Runs 24/7 in background. Independent of browser.
    """

    def __init__(self, deployment_id: int, cam_id: int, rtsp_url: str, inference_module):
        self.deployment_id    = deployment_id
        self.cam_id           = cam_id
        self.rtsp_url         = rtsp_url
        self.inference_module = inference_module
        self._frame: Optional[bytes] = None
        self._raw:   Optional[np.ndarray] = None
        self._lock     = threading.Lock()
        self._raw_lock = threading.Lock()
        self._stop     = threading.Event()
        self._thread = threading.Thread(
            target=self._reader, daemon=True,
            name=f"infer-read-dep{deployment_id}",
        )
        self._infer_thread = threading.Thread(
            target=self._infer, daemon=True,
            name=f"infer-run-dep{deployment_id}",
        )

    def start(self) -> "InferenceWorker":
        self._thread.start()
        self._infer_thread.start()
        return self

    def stop(self):
        self._stop.set()

    def get_frame(self) -> Optional[bytes]:
        with self._lock:
            return self._frame

    def _reader(self):
        """
        Your exact working code — keeps the buffer drained at camera speed.
            cap = cv2.VideoCapture(rtsp_url, cv2.CAP_FFMPEG)
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            while True:
                ret, frame = cap.read()
                frame = cv2.resize(frame, (800, 450))
        """
        while not self._stop.is_set():
            cap = _open_cap(self.rtsp_url)
            if not cap.isOpened():
                time.sleep(GRABBER_RECONNECT)
                continue

            while not self._stop.is_set():
                ret, frame = cap.read()
                if not ret:
                    break
                frame = cv2.resize(frame, (800, 450))
                with self._raw_lock:
                    self._raw = frame

            cap.release()
            if not self._stop.is_set():
                time.sleep(GRABBER_RECONNECT)

    def _infer(self):
        """Picks up the latest frame from _reader, runs model, caches JPEG."""
        last = None
        while not self._stop.is_set():
            with self._raw_lock:
                frame = self._raw

            if frame is None or frame is last:
                self._stop.wait(0.005)
                continue

            last = frame
            try:
                if hasattr(self.inference_module, "run"):
                    frame = self.inference_module.run(frame)
            except Exception as exc:
                print(f"[dep-{self.deployment_id}] inference error: {exc}")
            _, buf = cv2.imencode(
                ".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, MJPEG_QUALITY]
            )
            with self._lock:
                self._frame = buf.tobytes()


# ══════════════════════════════════════════════════════════════════════════════
#  Management helpers
# ══════════════════════════════════════════════════════════════════════════════

def _start_camera_grabber(cam_id: int, channel: int, cfg: dict) -> FrameGrabber:
    existing = camera_grabbers.get(cam_id)
    if existing and existing._thread.is_alive():
        return existing
    grabber = FrameGrabber(channel, cfg).start()
    camera_grabbers[cam_id] = grabber
    grabber_configs[cam_id] = (channel, cfg)
    return grabber


def _stop_device_grabbers(device_id: str):
    to_stop = [
        cid for cid, (ch, cfg) in grabber_configs.items()
        if cfg.get("device_id") == device_id
    ]
    for cid in to_stop:
        camera_grabbers[cid].stop()
        camera_grabbers.pop(cid, None)
        grabber_configs.pop(cid, None)


def _load_inference_module(inference_path: str, model_path: str, context: Optional[dict] = None):
    spec = importlib.util.spec_from_file_location("inference_module", inference_path)
    mod  = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    if hasattr(mod, "set_model_path"):
        mod.set_model_path(model_path)
    if context and hasattr(mod, "set_context"):
        try:
            mod.set_context(context)
        except Exception as e:
            print(f"set_context failed: {e}")
    return mod


def _build_inference_context(dep_id: int, cam_id: int) -> dict:
    db = SessionLocal()
    try:
        cam = db.query(DBCamera).filter(DBCamera.id == cam_id).first()
        cam_name    = cam.name    if cam else ""
        channel     = cam.channel if cam else 0
        device_name = cam.device.name if cam and cam.device else ""
    finally:
        db.close()
    return {
        "deployment_id":   dep_id,
        "camera_id":       cam_id,
        "camera_name":     cam_name,
        "device_name":     device_name,
        "channel":         channel,
        "backend_url":     BACKEND_URL,
        "screenshots_dir": EVENTS_DIR,
    }


def _start_inference_worker(
    dep_id: int, cam_id: int, inference_path: str, model_path: str, rtsp_url: str
) -> Optional[InferenceWorker]:
    existing = inference_workers.get(dep_id)
    if existing and existing._thread.is_alive():
        return existing
    if not os.path.exists(model_path) or not os.path.exists(inference_path):
        print(f"[dep-{dep_id}] model or inference file missing")
        return None
    try:
        ctx    = _build_inference_context(dep_id, cam_id)
        mod    = _load_inference_module(inference_path, model_path, ctx)
        worker = InferenceWorker(dep_id, cam_id, rtsp_url, mod).start()
        inference_workers[dep_id] = worker
        inference_configs[dep_id] = (cam_id, inference_path, model_path, rtsp_url)
        print(f"[dep-{dep_id}] inference worker started for camera {cam_id}")
        return worker
    except Exception as exc:
        print(f"[dep-{dep_id}] failed to start: {exc}")
        return None


def _stop_inference_worker(dep_id: int):
    worker = inference_workers.pop(dep_id, None)
    if worker:
        worker.stop()
    inference_configs.pop(dep_id, None)


def _watchdog():
    """Auto-restart dead grabbers and inference workers."""
    while True:
        time.sleep(WATCHDOG_INTERVAL)
        for cam_id in list(grabber_configs.keys()):
            g = camera_grabbers.get(cam_id)
            if g is None or not g._thread.is_alive():
                channel, cfg = grabber_configs[cam_id]
                camera_grabbers[cam_id] = FrameGrabber(channel, cfg).start()
        for dep_id in list(inference_configs.keys()):
            w = inference_workers.get(dep_id)
            if w is None or not w._thread.is_alive():
                cam_id, inf_path, model_path, rtsp_url = inference_configs[dep_id]
                _start_inference_worker(dep_id, cam_id, inf_path, model_path, rtsp_url)


# ══════════════════════════════════════════════════════════════════════════════
#  MJPEG generators — completely non-blocking on the event loop
# ══════════════════════════════════════════════════════════════════════════════

async def _mjpeg(grabber: FrameGrabber):
    """
    Reads cached frame from FrameGrabber and yields MJPEG boundaries.
    get_frame() is a lock+return (microseconds). asyncio.sleep yields control.
    The event loop NEVER touches RTSP or cv2 — that all happens in the grabber thread.
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


async def _mjpeg_inference(dep_id: int):
    """
    Same pattern as _mjpeg but reads from InferenceWorker's cached annotated JPEG.
    Falls back to the camera's FrameGrabber if the worker has no output yet.
    """
    interval = 1.0 / STREAM_FPS_CAP
    while True:
        w = inference_workers.get(dep_id)
        frame_bytes = (w.get_frame() if w else None) or PLACEHOLDER_FRAME
        yield (
            b"--frame\r\n"
            b"Content-Type: image/jpeg\r\n\r\n"
            + frame_bytes
            + b"\r\n"
        )
        await asyncio.sleep(interval)


# ══════════════════════════════════════════════════════════════════════════════
#  Lifespan — warm start everything before any request arrives
# ══════════════════════════════════════════════════════════════════════════════

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    db = SessionLocal()
    try:
        # Load all device configs
        for dev in db.query(DBDevice).all():
            devices_rt[dev.device_id] = _cfg_from_db(dev)

        # Start grabbers for every camera — streams are live before any browser connects
        for cam in db.query(DBCamera).all():
            if cam.device and cam.device.device_id in devices_rt:
                _start_camera_grabber(
                    cam.id, cam.channel, devices_rt[cam.device.device_id]
                )

        # Start inference workers for all active deployments
        for dep in db.query(DBDeployment).filter(DBDeployment.status == "active").all():
            if dep.model and dep.camera:
                _start_inference_worker(
                    dep.id, dep.camera_id,
                    dep.model.inference_path, dep.model.file_path,
                    dep.camera.rtsp_url,
                )
    finally:
        db.close()

    threading.Thread(target=_watchdog, daemon=True, name="watchdog").start()

    yield

    for w in list(inference_workers.values()):
        w.stop()
    for g in list(camera_grabbers.values()):
        g.stop()


# ══════════════════════════════════════════════════════════════════════════════
#  App
# ══════════════════════════════════════════════════════════════════════════════

app = FastAPI(title="Vision AI Platform", version="8.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)


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


class EventCreate(BaseModel):
    deployment_id:   Optional[int] = None
    camera_id:       Optional[int] = None
    camera_name:     Optional[str] = ""
    device_name:     Optional[str] = ""
    channel:         Optional[int] = 0
    event_type:      str
    screenshot_path: Optional[str] = ""   # filename only, already saved in EVENTS_DIR
    details:         Optional[str] = ""


# ── Channel probe (discovery) ─────────────────────────────────────────────────
def _probe(channel: int, cfg: dict) -> dict:
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

# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "devices":         len(devices_rt),
        "active_grabbers": sum(1 for g in camera_grabbers.values() if g._thread.is_alive()),
        "active_workers":  sum(1 for w in inference_workers.values() if w._thread.is_alive()),
    }


@app.get("/health/cameras")
async def health_cameras(db: Session = Depends(get_db)):
    cameras = db.query(DBCamera).all()
    return {
        "total_cameras": len(cameras),
        "cameras": [
            {
                "id":              c.id,
                "name":            c.name,
                "channel":         c.channel,
                "device":          c.device.name if c.device else "unknown",
                "grabber_running": bool(
                    camera_grabbers.get(c.id)
                    and camera_grabbers[c.id]._thread.is_alive()
                ),
            }
            for c in cameras
        ],
    }


# ── Live MJPEG stream — from FrameGrabber, fully non-blocking ────────────────

@app.get("/stream/{camera_id}")
async def stream_camera(camera_id: int):
    """
    MJPEG stream from the persistent FrameGrabber.
    DB session is opened and CLOSED before streaming begins so it never
    blocks the connection pool during the (potentially infinite) stream.
    """
    db = SessionLocal()
    try:
        cam = db.query(DBCamera).filter(DBCamera.id == camera_id).first()
        if not cam:
            raise HTTPException(404, "Camera not found")
        if not cam.device or cam.device.device_id not in devices_rt:
            raise HTTPException(503, "Device not available")
        cfg     = devices_rt[cam.device.device_id]
        cam_id  = cam.id
        channel = cam.channel
    finally:
        db.close()

    grabber = _start_camera_grabber(cam_id, channel, cfg)
    return StreamingResponse(
        _mjpeg(grabber),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


@app.get("/snapshot/{camera_id}")
async def snapshot_camera(camera_id: int):
    """Single JPEG from FrameGrabber (grid view polling)."""
    grabber = camera_grabbers.get(camera_id)
    frame   = (grabber.get_frame() if grabber else None) or PLACEHOLDER_FRAME
    return Response(content=frame, media_type="image/jpeg")


# ── Inference MJPEG stream — from 24/7 InferenceWorker ────────────────────────

@app.get("/stream_inference/{deployment_id}")
async def stream_with_inference(deployment_id: int):
    """
    MJPEG stream with inference annotations from the always-running worker.
    The InferenceWorker runs 24/7 on its own RTSP — this endpoint just reads
    its cached annotated JPEG. Fully non-blocking.
    """
    db = SessionLocal()
    try:
        dep = db.query(DBDeployment).filter(DBDeployment.id == deployment_id).first()
        if not dep:
            raise HTTPException(404, "Deployment not found")
        # Ensure worker is running (idempotent)
        if dep.model and dep.camera and deployment_id not in inference_workers:
            _start_inference_worker(
                dep.id, dep.camera_id,
                dep.model.inference_path, dep.model.file_path,
                dep.camera.rtsp_url,
            )
    finally:
        db.close()

    return StreamingResponse(
        _mjpeg_inference(deployment_id),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


@app.get("/snapshot_inference/{deployment_id}")
async def snapshot_inference(deployment_id: int):
    """Single annotated JPEG from the running InferenceWorker."""
    w = inference_workers.get(deployment_id)
    frame = (w.get_frame() if w else None) or PLACEHOLDER_FRAME
    return Response(content=frame, media_type="image/jpeg")


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
        device_id=device_id, name=name, device_type=config.device_type,
        ip=config.dvr_ip, rtsp_port=config.rtsp_port,
        username=config.username, password=config.password,
    )
    db.add(db_dev)
    db.commit()
    db.refresh(db_dev)
    devices_rt[device_id] = cfg

    return {
        "device_id": device_id, "name": name,
        "device_type": config.device_type,
        "dvr_ip": config.dvr_ip, "rtsp_port": config.rtsp_port,
        "reachable": probe["alive"],
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
    Saves discovered cameras to DB and starts their FrameGrabbers.
    """
    if device_id not in devices_rt:
        raise HTTPException(404, "Device not found")

    cfg     = devices_rt[device_id]
    streams = await _discover(cfg)

    db_dev = db.query(DBDevice).filter(DBDevice.device_id == device_id).first()
    if db_dev:
        existing = {
            cam.channel: cam
            for cam in db.query(DBCamera).filter(DBCamera.device_id == db_dev.id).all()
        }
        live_channels = {s["channel"] for s in streams}

        for s in streams:
            if s["channel"] in existing:
                cam = existing[s["channel"]]
                cam.name       = s["label"]
                cam.rtsp_url   = s["rtsp_url"]
                cam.status     = s["status"]
                cam.resolution = s.get("resolution", "")
            else:
                db.add(DBCamera(
                    device_id=db_dev.id, name=s["label"], channel=s["channel"],
                    rtsp_url=s["rtsp_url"], status=s["status"],
                    resolution=s.get("resolution", ""),
                ))

        for ch, cam in existing.items():
            if ch not in live_channels:
                if cam.id in camera_grabbers:
                    camera_grabbers[cam.id].stop()
                    camera_grabbers.pop(cam.id, None)
                    grabber_configs.pop(cam.id, None)
                db.delete(cam)

        db.commit()

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

    return {"device_id": device_id, "live_count": len(streams), "streams": streams}


# ── Cameras (fast DB read) ────────────────────────────────────────────────────

@app.get("/cameras")
async def list_cameras(device_id: Optional[str] = None, db: Session = Depends(get_db)):
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
    """Legacy — use /stream/{camera_id} instead."""
    if device_id not in devices_rt:
        raise HTTPException(404, "Device not found")
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
        db.close()

    cfg     = devices_rt[device_id]
    grabber = _start_camera_grabber(cam_id, channel, cfg)
    return StreamingResponse(
        _mjpeg(grabber),
        media_type="multipart/x-mixed-replace; boundary=frame",
    )


# ── Models ────────────────────────────────────────────────────────────────────

@app.get("/models")
async def list_models(db: Session = Depends(get_db)):
    return [
        {
            "id": m.id, "name": m.name, "version": m.version,
            "framework": m.framework, "size": m.size, "accuracy": m.accuracy,
            "file_path": m.file_path, "inference_path": m.inference_path,
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
        name=name, version=version, framework=framework,
        accuracy=accuracy, size=size_mb,
        file_path=model_path, inference_path=inf_path,
    )
    db.add(db_model)
    db.commit()
    db.refresh(db_model)

    return {
        "id": db_model.id, "name": db_model.name, "version": db_model.version,
        "framework": db_model.framework, "size": db_model.size,
        "accuracy": db_model.accuracy,
        "file_path": model_path, "inference_path": inf_path,
    }


@app.delete("/models/{model_id}")
async def delete_model(model_id: int, db: Session = Depends(get_db)):
    m = db.query(DBModel).filter(DBModel.id == model_id).first()
    if not m:
        raise HTTPException(404, "Model not found")

    file_path      = m.file_path
    inference_path = m.inference_path

    db.query(DBDeployment).filter(DBDeployment.model_id == model_id).delete()
    db.delete(m)
    db.commit()

    def cleanup():
        time.sleep(1)
        for path in [file_path, inference_path]:
            try:
                if path and os.path.exists(path):
                    if os.name == "nt":
                        subprocess.Popen(
                            ["del", "/Q", path], shell=True,
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                        )
                    else:
                        subprocess.Popen(
                            ["rm", "-f", path],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                        )
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
            "camera_name":   d.camera.name                         if d.camera              else None,
            "device_name":   d.camera.device.name                  if d.camera and d.camera.device else None,
            "model_id":      d.model_id,
            "model_name":    d.model.name                          if d.model               else None,
            "model_version": d.model.version                       if d.model               else None,
            "status":        d.status,
        }
        for d in db.query(DBDeployment).all()
    ]


@app.post("/deployments", status_code=201)
async def create_deployment(dep: DeploymentCreate, db: Session = Depends(get_db)):
    """Deploy model to camera. Inference worker starts immediately and runs 24/7."""
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
            camera_id=dep.camera_id, model_id=dep.model_id, status="active",
        )
        db.add(db_dep)
        db.commit()
        db.refresh(db_dep)
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Deployment failed: {str(e)}")

    # Start inference worker immediately — runs 24/7 on its own RTSP connection
    _start_inference_worker(
        db_dep.id, db_dep.camera_id,
        model.inference_path, model.file_path, cam.rtsp_url,
    )

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
    _stop_inference_worker(dep_id)
    db.delete(dep)
    db.commit()
    return {"status": "removed"}


# ── Events ────────────────────────────────────────────────────────────────────

@app.post("/events", status_code=201)
async def create_event(evt: EventCreate, db: Session = Depends(get_db)):
    """
    Called by inference scripts when they detect something.
    Screenshot should already be written to EVENTS_DIR (shared path on same host).
    Only the filename (basename) is stored in DB.
    """
    filename = os.path.basename(evt.screenshot_path or "")
    row = DBEvent(
        deployment_id   = evt.deployment_id,
        camera_id       = evt.camera_id,
        camera_name     = evt.camera_name or "",
        device_name     = evt.device_name or "",
        channel         = evt.channel or 0,
        event_type      = evt.event_type,
        screenshot_path = filename,
        details         = evt.details or "",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"id": row.id, "status": "saved"}


@app.get("/events")
async def list_events(
    limit: int = 100,
    camera_id: Optional[int] = None,
    event_type: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(DBEvent).order_by(DBEvent.timestamp.desc())
    if camera_id is not None:
        q = q.filter(DBEvent.camera_id == camera_id)
    if event_type:
        q = q.filter(DBEvent.event_type == event_type)
    rows = q.limit(max(1, min(limit, 1000))).all()
    return [
        {
            "id":              r.id,
            "deployment_id":   r.deployment_id,
            "camera_id":       r.camera_id,
            "camera_name":     r.camera_name,
            "device_name":     r.device_name,
            "channel":         r.channel,
            "event_type":      r.event_type,
            "screenshot_url":  f"/events/image/{r.screenshot_path}" if r.screenshot_path else None,
            "details":         r.details,
            "timestamp":       r.timestamp.isoformat() if r.timestamp else None,
        }
        for r in rows
    ]


@app.get("/events/image/{filename}")
async def get_event_image(filename: str):
    safe = os.path.basename(filename)
    path = os.path.join(EVENTS_DIR, safe)
    if not os.path.exists(path):
        raise HTTPException(404, "Screenshot not found")
    with open(path, "rb") as fh:
        return Response(content=fh.read(), media_type="image/jpeg")


@app.delete("/events/{event_id}")
async def delete_event(event_id: int, db: Session = Depends(get_db)):
    row = db.query(DBEvent).filter(DBEvent.id == event_id).first()
    if not row:
        raise HTTPException(404, "Event not found")
    if row.screenshot_path:
        try:
            p = os.path.join(EVENTS_DIR, os.path.basename(row.screenshot_path))
            if os.path.exists(p):
                os.remove(p)
        except Exception as e:
            print(f"event image delete failed: {e}")
    db.delete(row)
    db.commit()
    return {"status": "removed"}


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000)
