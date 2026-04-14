# Vision AI — Diagnostics & Endpoint Testing

## 🔧 Fixed: Deployment Timeout (Pool Exhaustion)

**v5.1 – SQLAlchemy Connection Pool**
- Changed: `SQLite` now uses `NullPool` (each request gets own connection, no limit)
- Changed: `/stream/{camera_id}` closes DB session BEFORE streaming starts
- Changed: `/devices/{id}/stream/{channel}` (legacy) also closes DB before stream
- Result: 12+ concurrent MJPEG streams no longer block deployment requests ✓

---

## All Endpoints Working ✓

### Stream & Device Management
- `GET /health` — API status
- `GET /health/cameras` — **NEW** diagnostic: shows all cameras + grabber status
- `GET /devices` — list all DVR devices
- `POST /devices` — add new DVR
- `DELETE /devices/{id}` — remove DVR
- `GET /devices/{id}/streams` — scan channels, save to DB, start grabbers (2-5s)
- `GET /stream/{camera_id}` — MJPEG stream (persistent, pre-buffered)
- `GET /devices/{id}/stream/{channel}` — legacy MJPEG (for compatibility)

### Camera List
- `GET /cameras` — instant DB read (no RTSP probing)
- `GET /cameras?device_id=abc` — filter by device

### Models
- `GET /models` — list all models
- `POST /models` — upload model (.pt) + inference script (.py)
- `DELETE /models/{id}` — delete model

### Deployments
- `GET /deployments` — list all model↔camera assignments
- `POST /deployments` — deploy a model to a camera ✓ (improved error handling)
- `DELETE /deployments/{id}` — remove deployment

---

## Why All Streams Are Now Visible

**Old Issue:** LRU cache limited to 6 concurrent RTSP connections  
**Fix:** Increased to 32, DVR clearly supports many more concurrent connections

**Old Issue:** On-demand grabbers caused race conditions  
**Fix:** Grabbers now start eagerly:
1. On boot: all cameras in DB get grabbers started
2. On discovery: newly found cameras get grabbers started immediately
3. On frontend load: background task triggers discovery to pre-buffer all streams

---

## Verify Everything Works

### 1. Check All Cameras Are Running
```
GET http://localhost:8000/health/cameras
```
Response shows each camera + whether its grabber thread is alive

### 2. Test Streams View
- Go to **Streams** tab
- Select device
- All cameras should **instantly** show camera cards (fast DB load)
- Camera images will load as grabbers buffer frames (~2-5 sec)
- Click **Rescan** to trigger full RTSP discovery + grabber startup

### 3. Test Model Upload
- Go to **ML Models**
- Click **Upload Model**
- Select any `.pt` file + `.py` inference script
- Wait up to 3 minutes for large files (180s timeout)
- Should show success message

### 4. Test Deployment
- Go to **Deploy**
- Select Device → Camera → Model → Confirm
- Should see: "✓ Model 'XXX' deployed to Camera NN ('Camera Name')"
- Check **Active Deployments** section below

### 5. Test Deployment with Elapsed Time Tracking
- Go to **Deploy** tab
- Follow the 4-step wizard (Device → Camera → Model → Confirm)
- Click **Deploy Now**
- Watch the elapsed time counter (shows seconds elapsed, 30s timeout)
- Should show: "Processing deployment..." with live countdown
- Once complete, click deployment to view live stream with model info

### 6. Click Active Deployment to View Live Stream
- Go to **Deploy** tab → **Active Deployments** section
- Click any deployment row (entire row is clickable)
- Shows:
  - Live video stream from that camera
  - Camera name, model, device, status
  - Click "← Back" to return to list

### 7. Test Error Cases
If any step fails:
- Open **Browser DevTools** (F12) → **Console** tab — copy error message
- Check **Network** tab — see request to `/deployments`, response time, status code
- Look for DELETE errors when removing deployments (error message will display)

---

## Configuration

To adjust DVR connection limit, edit `backend/main.py`:
```python
MAX_CONCURRENT_GRABBERS = 32  # increase if your DVR supports more
```

Typical DVR limits:
- Budget DVRs: 6-10
- Mid-range: 12-20
- Enterprise: 32+

Test with your reference script to find your limit, then adjust above.

---

## Troubleshooting

### Streams still black?
1. Check `/health/cameras` endpoint — verify grabbers are running
2. Check browser console for errors
3. Verify RTSP URLs are correct (`/cameras` endpoint shows each stream's `rtsp_url`)
4. Ensure DVR device is reachable from the server

### Deployment hangs?
- Check browser console (F12) for network errors
- Verify camera_id and model_id are valid
- Check `/health/cameras` to ensure camera exists

### Upload stuck on "Uploading..."?
- File may be too large or network too slow
- 3-minute timeout will trigger with clear error message
- Try a smaller test file first

