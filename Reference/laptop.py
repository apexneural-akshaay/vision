import cv2
import os
from ultralytics import YOLO

# Global model variable — loaded once
_model = None
_model_path = None


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


def run(frame):
    """Run inference on frame and return annotated frame"""
    global _model

    if _model is None:
        return frame

    try:
        # Original frame size
        h, w = frame.shape[:2]

        # Resize with aspect ratio
        scale = 640 / max(h, w)
        new_h, new_w = int(h * scale), int(w * scale)

        resized = cv2.resize(frame, (new_w, new_h))

        # Padding to 640x640
        pad_top = (640 - new_h) // 2
        pad_bottom = 640 - new_h - pad_top
        pad_left = (640 - new_w) // 2
        pad_right = 640 - new_w - pad_left

        padded = cv2.copyMakeBorder(
            resized,
            pad_top,
            pad_bottom,
            pad_left,
            pad_right,
            cv2.BORDER_CONSTANT,
            value=(0, 0, 0)
        )

        # 🚀 Run inference (ONLY LAPTOP CLASS = 63)
        results = _model(padded, classes=[63], verbose=False)

        # Process detections
        for r in results:
            if r.boxes is None:
                continue

            for box in r.boxes:
                try:
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    conf = float(box.conf[0])

                    # Convert back to original frame scale
                    x1 = int((x1 - pad_left) / scale)
                    y1 = int((y1 - pad_top) / scale)
                    x2 = int((x2 - pad_left) / scale)
                    y2 = int((y2 - pad_top) / scale)

                    # Clamp to bounds
                    x1, y1 = max(0, x1), max(0, y1)
                    x2, y2 = min(w, x2), min(h, y2)

                    # Draw bounding box
                    cv2.rectangle(frame, (x1, y1), (x2, y2), (255, 0, 0), 2)

                    # Draw label
                    cv2.putText(
                        frame,
                        f"Laptop {conf:.2f}",
                        (x1, max(10, y1 - 5)),
                        cv2.FONT_HERSHEY_SIMPLEX,
                        0.6,
                        (255, 0, 0),
                        2
                    )

                except Exception as e:
                    print(f"Error drawing box: {e}")
                    continue

        return frame

    except Exception as e:
        print(f"Inference error: {e}")
        return frame