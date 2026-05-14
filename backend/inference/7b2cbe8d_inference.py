import cv2
import os
import time
import json
import threading
import urllib.request
from datetime import datetime
from ultralytics import YOLO

# Global model variable — loaded once
_model = None
_model_path = None

# Deployment context (injected by backend on load)
_ctx = {
    "deployment_id":   None,
    "camera_id":       None,
    "camera_name":     "",
    "device_name":     "",
    "channel":         0,
    "backend_url":     "http://127.0.0.1:8000",
    "screenshots_dir": None,
}

# Event tracking state
_last_person_count  = 0
_last_event_ts      = 0.0
EVENT_COOLDOWN_S    = 5.0   # don't spam the same event more than once per 5s


def set_model_path(path):
    """Set the model path (called by backend before running inference)"""
    global _model, _model_path

    _model_path = path

    if os.path.exists(path):
        try:
            _model = YOLO(path)
            print(f"✅ Model loaded: {path}")
        except Exception as e:
            print(f"❌ Error loading model {path}: {e}")
            _model = None
    else:
        print(f"❌ Model path does not exist: {path}")
        _model = None


def set_context(ctx):
    """Called by backend after load — wires deployment/camera metadata."""
    global _ctx
    if isinstance(ctx, dict):
        _ctx.update(ctx)
        print(
            f"📡 Context set: dep={_ctx['deployment_id']} "
            f"cam={_ctx['camera_name']} ch={_ctx['channel']} "
            f"device={_ctx['device_name']}"
        )


def _post_event_async(payload: dict):
    """POST JSON to backend /events in a background thread (non-blocking)."""
    def _send():
        try:
            url  = _ctx["backend_url"].rstrip("/") + "/events"
            data = json.dumps(payload).encode("utf-8")
            req  = urllib.request.Request(
                url, data=data, method="POST",
                headers={"Content-Type": "application/json"},
            )
            urllib.request.urlopen(req, timeout=3).read()
        except Exception as e:
            print(f"event POST failed: {e}")
    threading.Thread(target=_send, daemon=True).start()


def fire_event(frame, event_type: str, details: str = ""):
    """
    Save annotated frame to screenshots dir and POST metadata to backend.
    Call this from run() whenever you detect something worth logging.
    """
    global _last_event_ts

    now = time.time()
    if now - _last_event_ts < EVENT_COOLDOWN_S:
        return
    _last_event_ts = now

    sc_dir = _ctx.get("screenshots_dir")
    if not sc_dir:
        print("fire_event: no screenshots_dir in context — skipping")
        return
    try:
        os.makedirs(sc_dir, exist_ok=True)
    except Exception:
        pass

    ts_str   = datetime.utcnow().strftime("%Y%m%d_%H%M%S_%f")[:-3]
    dep_id   = _ctx.get("deployment_id") or 0
    filename = f"dep{dep_id}_{event_type}_{ts_str}.jpg"
    path     = os.path.join(sc_dir, filename)

    try:
        cv2.imwrite(path, frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
    except Exception as e:
        print(f"fire_event: failed to write screenshot: {e}")
        return

    payload = {
        "deployment_id":   _ctx.get("deployment_id"),
        "camera_id":       _ctx.get("camera_id"),
        "camera_name":     _ctx.get("camera_name", ""),
        "device_name":     _ctx.get("device_name", ""),
        "channel":         _ctx.get("channel", 0),
        "event_type":      event_type,
        "screenshot_path": filename,
        "details":         details,
    }
    _post_event_async(payload)


def run(frame):
    """Run inference on frame and return annotated frame"""
    global _model, _last_person_count

    if _model is None:
        return frame

    try:
        results     = _model(frame, classes=[0], verbose=False)
        person_count = 0

        for r in results:
            if r.boxes is None:
                continue
            for box in r.boxes:
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                conf = float(box.conf[0])
                person_count += 1
                cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                cv2.putText(
                    frame,
                    f"Person {conf:.2f}",
                    (x1, max(10, y1 - 5)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.6,
                    (0, 255, 0),
                    2,
                )

        cv2.putText(
            frame, f"Persons: {person_count}", (10, 30),
            cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2,
        )

        # Event triggers
        if _last_person_count == 0 and person_count > 0:
            fire_event(frame, "person_detected",
                       details=f"count={person_count}")
        elif person_count > 0 and person_count != _last_person_count:
            fire_event(frame, "person_count_changed",
                       details=f"prev={_last_person_count} now={person_count}")

        _last_person_count = person_count

        return frame

    except Exception as e:
        print(f"Inference error: {e}")
        return frame
