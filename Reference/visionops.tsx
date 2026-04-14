import { useState, useEffect, useRef } from "react";

const MODELS = [
  { id: 1, name: "Fire & Water Detection", version: "v2.1", tag: "AK", framework: "REELS", category: "base", accuracy: 94, size: "128MB" },
  { id: 2, name: "ANPR License Plate", version: "v3.0", tag: "AK", framework: "REELS", category: "base", accuracy: 97, size: "84MB" },
  { id: 3, name: "Crowd Detection", version: "v1.4", tag: "AN", framework: "YOLOv9", category: "base", accuracy: 88, size: "210MB" },
  { id: 4, name: "Face & Eye Tracking", version: "v1.0", tag: "AK", framework: "PRISM", category: "base", accuracy: 91, size: "156MB" },
  { id: 5, name: "Cheating Detection", version: "v0.9", tag: "HV", framework: "Mediapipe", category: "base", accuracy: 82, size: "98MB" },
  { id: 6, name: "Sports Analysis", version: "v0.5", tag: "AN", framework: "YOLOv5", category: "base", accuracy: 79, size: "175MB" },
  { id: 7, name: "Supermarket Behaviour", version: "v1.2", tag: "AN", framework: "OpenCV", category: "industry", accuracy: 86, size: "142MB" },
  { id: 8, name: "Tablet / Pill Counting", version: "v1.0", tag: "AK", framework: "YOLOv9", category: "industry", accuracy: 93, size: "67MB" },
  { id: 9, name: "Productivity Monitor", version: "v0.8", tag: "AK", framework: "REELS", category: "industry", accuracy: 81, size: "120MB" },
  { id: 10, name: "Threat Detection", version: "v1.1", tag: "AK", framework: "PRISM", category: "highseal", accuracy: 95, size: "320MB" },
  { id: 11, name: "Identity & Object ID", version: "v2.0", tag: "AN", framework: "REELS", category: "highseal", accuracy: 96, size: "280MB" },
];

const INIT_DEVICES = [
  { id: "mac-01", name: "MAC-Warehouse-01", location: "Ahmedabad Medical Warehouse", status: "online", cpu: 42, ram: 58, hw: "aIPU · GPU", deployedModels: [1, 8], cameras: [
    { id: "c1", name: "CAM-01", type: "DVR", status: "live" },
    { id: "c2", name: "CAM-02", type: "NVR", status: "live" },
    { id: "c3", name: "CAM-03", type: "DVR", status: "idle" },
  ]},
  { id: "mac-02", name: "MAC-Traffic-02", location: "Ring Road Junction", status: "online", cpu: 71, ram: 44, hw: "aIPU · GPU", deployedModels: [2], cameras: [
    { id: "c4", name: "CAM-01", type: "DVR", status: "live" },
    { id: "c5", name: "CAM-02", type: "NVR", status: "live" },
  ]},
  { id: "mac-03", name: "MAC-Retail-01", location: "Navrangpura Supermarket", status: "idle", cpu: 12, ram: 22, hw: "GPU", deployedModels: [], cameras: [
    { id: "c6", name: "CAM-01", type: "IP", status: "idle" },
  ]},
];

const ALERTS_DATA = [
  { id: 1, type: "fire", icon: "🔥", title: "Fire detected · Sector B", device: "MAC-Warehouse-01", cam: "CAM-01", model: "Fire & Water Detection", time: "10:24 AM", severity: "high", sent: "WhatsApp · 3 contacts" },
  { id: 2, type: "crowd", icon: "👥", title: "Crowd density exceeded", device: "MAC-Traffic-02", cam: "CAM-02", model: "Crowd Detection", time: "9:11 AM", severity: "medium", sent: "Dashboard" },
  { id: 3, type: "anpr", icon: "🚗", title: "Unregistered plate · MH12XX9900", device: "MAC-Traffic-02", cam: "CAM-01", model: "ANPR License Plate", time: "Yesterday 6:02 PM", severity: "info", sent: "WhatsApp" },
  { id: 4, type: "crowd", icon: "👥", title: "Low productivity zone detected", device: "MAC-Retail-01", cam: "CAM-01", model: "Productivity Monitor", time: "Yesterday 2:15 PM", severity: "medium", sent: "Dashboard" },
  { id: 5, type: "fire", icon: "💧", title: "Water leak near loading bay", device: "MAC-Warehouse-01", cam: "CAM-03", model: "Fire & Water Detection", time: "2 days ago", severity: "high", sent: "WhatsApp · Email" },
];

const DEPLOY_HISTORY = [
  { id: 1, model: "Fire & Water Detection v2.1", device: "MAC-Warehouse-01", cam: "CAM-01", time: "Today 10:00 AM", status: "live", alerts: ["WhatsApp", "Dashboard"] },
  { id: 2, model: "ANPR License Plate v3.0", device: "MAC-Traffic-02", cam: "CAM-01", time: "Today 8:30 AM", status: "live", alerts: ["WhatsApp"] },
  { id: 3, model: "Tablet / Pill Counting v1.0", device: "MAC-Warehouse-01", cam: "CAM-02", time: "Yesterday 5:00 PM", status: "live", alerts: ["Dashboard"] },
  { id: 4, model: "Crowd Detection v1.4", device: "MAC-Retail-01", cam: "CAM-01", time: "Yesterday 2:00 PM", status: "pending", alerts: ["WhatsApp", "Email"] },
];

const badge = (label, color) => {
  const map = { green: "bg-emerald-100 text-emerald-700", amber: "bg-amber-100 text-amber-700", red: "bg-red-100 text-red-700", blue: "bg-blue-100 text-blue-700", gray: "bg-gray-100 text-gray-500", purple: "bg-purple-100 text-purple-700" };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[color]}`}>{label}</span>;
};
const severityColor = (s) => ({ high: "red", medium: "amber", info: "blue" }[s]);

// ─── Animated camera feed ───────────────────────────────────────────────
function CamFeed({ cam, deviceName, modelName, large = false, alertFlash = false }) {
  const canvasRef = useRef(null);
  const frameRef = useRef(0);
  const boxesRef = useRef([]);

  useEffect(() => {
    if (cam.status !== "live") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height;

    // init detection boxes
    boxesRef.current = Array.from({ length: 3 }, (_, i) => ({
      x: 30 + i * (W / 3.5), y: 20 + i * 15,
      w: 60 + i * 10, h: 45 + i * 8,
      dx: (Math.random() - 0.5) * 0.6, dy: (Math.random() - 0.5) * 0.4,
      label: modelName ? modelName.split(" ")[0] : "Object",
      conf: 0.82 + Math.random() * 0.15,
      color: ["#22d3ee", "#f59e0b", "#34d399"][i],
    }));

    let raf;
    const draw = () => {
      frameRef.current++;
      ctx.clearRect(0, 0, W, H);

      // dark bg gradient
      const grd = ctx.createLinearGradient(0, 0, W, H);
      grd.addColorStop(0, "#0f172a");
      grd.addColorStop(1, "#1e293b");
      ctx.fillStyle = grd;
      ctx.fillRect(0, 0, W, H);

      // scanline
      ctx.fillStyle = "rgba(255,255,255,0.02)";
      for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1);

      // grid overlay
      ctx.strokeStyle = "rgba(255,255,255,0.04)";
      ctx.lineWidth = 0.5;
      for (let x = 0; x < W; x += 30) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      for (let y = 0; y < H; y += 30) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

      // noise
      for (let i = 0; i < 20; i++) {
        const nx = Math.random() * W, ny = Math.random() * H;
        ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.06})`;
        ctx.fillRect(nx, ny, 1, 1);
      }

      // move + bounce boxes
      boxesRef.current.forEach(b => {
        b.x += b.dx; b.y += b.dy;
        if (b.x < 0 || b.x + b.w > W) b.dx *= -1;
        if (b.y < 0 || b.y + b.h > H) b.dy *= -1;

        // draw detection box
        ctx.strokeStyle = b.color;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(b.x, b.y, b.w, b.h);

        // corner marks
        const cs = 10;
        ctx.lineWidth = 2.5;
        [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]].forEach(([cx, cy], ci) => {
          const sx = ci % 2 === 0 ? 1 : -1, sy = ci < 2 ? 1 : -1;
          ctx.beginPath(); ctx.moveTo(cx, cy + sy * cs); ctx.lineTo(cx, cy); ctx.lineTo(cx + sx * cs, cy); ctx.stroke();
        });

        // label
        ctx.fillStyle = b.color;
        ctx.font = "bold 9px monospace";
        ctx.fillText(`${b.label} ${(b.conf * 100).toFixed(0)}%`, b.x + 2, b.y - 3);
      });

      // timestamp
      const now = new Date();
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.font = "9px monospace";
      ctx.fillText(now.toLocaleTimeString(), 5, H - 5);
      ctx.fillText("REC ●", W - 38, 12);

      // alert flash border
      if (alertFlash && Math.floor(frameRef.current / 20) % 2 === 0) {
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, W - 4, H - 4);
      }

      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [cam.status, modelName, alertFlash]);

  if (cam.status !== "live") {
    return (
      <div className={`bg-gray-900 rounded-xl flex flex-col items-center justify-center text-gray-600 border border-gray-800 ${large ? "h-64" : "h-36"}`}>
        <span className="text-3xl mb-2">📷</span>
        <span className="text-xs">{cam.name} · Idle</span>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl overflow-hidden border border-gray-700">
      <canvas ref={canvasRef} width={large ? 640 : 320} height={large ? 360 : 180} className="w-full block" style={{ aspectRatio: "16/9" }} />
      <div className="absolute top-2 left-2 flex gap-1.5">
        <span className="bg-red-600 text-white text-xs px-1.5 py-0.5 rounded font-medium">LIVE</span>
        {modelName && <span className="bg-black/60 text-cyan-400 text-xs px-1.5 py-0.5 rounded font-mono">{modelName.split(" ").slice(0, 2).join(" ")}</span>}
      </div>
      <div className="absolute bottom-2 right-2 text-xs text-gray-400 bg-black/50 px-1.5 py-0.5 rounded">{cam.name} · {deviceName}</div>
    </div>
  );
}

// ─── Overview ──────────────────────────────────────────────────────────
function Overview({ devices, alerts }) {
  const online = devices.filter(d => d.status === "online").length;
  const totalModels = [...new Set(devices.flatMap(d => d.deployedModels))].length;
  const todayAlerts = alerts.filter(a => a.time.includes("AM") || a.time.includes("PM")).length;
  return (
    <div className="space-y-5">
      <div><h2 className="text-base font-semibold mb-1">Overview</h2><p className="text-sm text-gray-400 mb-4">Platform health at a glance</p>
        <div className="grid grid-cols-4 gap-3">
          {[["Edge Devices", devices.length, "total", "#3b82f6"], ["Online", online, "devices", "#10b981"], ["Active Models", totalModels, "deployed", "#8b5cf6"], ["Alerts Today", todayAlerts, "events", "#ef4444"]].map(([l, v, s, c]) => (
            <div key={l} className="bg-gray-900 rounded-xl p-4 border border-gray-800">
              <div className="text-xs text-gray-500 mb-1">{l}</div>
              <div className="text-2xl font-bold" style={{ color: c }}>{v}</div>
              <div className="text-xs text-gray-600 mt-0.5">{s}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="border border-gray-800 rounded-xl p-4 bg-gray-900">
          <div className="text-sm font-medium text-gray-200 mb-3">Device health</div>
          {devices.map(d => (
            <div key={d.id} className="flex items-center gap-3 py-2.5 border-b border-gray-800 last:border-none">
              <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center text-sm">🖥</div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-200 truncate">{d.name}</div>
                <div className="flex gap-1 mt-1.5">
                  <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${d.cpu}%`, background: d.cpu > 60 ? "#f59e0b" : "#10b981" }} />
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-0.5">CPU {d.cpu}% · {d.deployedModels.length} models · {d.cameras.length} cams</div>
              </div>
              {badge(d.status === "online" ? "Online" : "Idle", d.status === "online" ? "green" : "gray")}
            </div>
          ))}
        </div>
        <div className="border border-gray-800 rounded-xl p-4 bg-gray-900">
          <div className="text-sm font-medium text-gray-200 mb-3">Recent alerts</div>
          {alerts.slice(0, 4).map(a => (
            <div key={a.id} className="flex items-start gap-2 py-2.5 border-b border-gray-800 last:border-none">
              <div className="text-base mt-0.5">{a.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-200 truncate">{a.title}</div>
                <div className="text-xs text-gray-500">{a.device} · {a.time}</div>
              </div>
              {badge(a.severity, severityColor(a.severity))}
            </div>
          ))}
        </div>
      </div>
      <div className="border border-gray-800 rounded-xl p-4 bg-gray-900">
        <div className="text-sm font-medium text-gray-200 mb-3">Available models</div>
        <div className="grid grid-cols-3 gap-3">
          {MODELS.slice(0, 6).map(m => (
            <div key={m.id} className="flex items-center gap-2 p-2.5 bg-gray-800 rounded-lg border border-gray-700">
              <div className="w-7 h-7 rounded-md bg-blue-900 flex items-center justify-center text-xs font-bold text-blue-300">{m.tag}</div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-200 truncate">{m.name}</div>
                <div className="text-xs text-gray-500">{m.version} · {m.accuracy}%</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── ML Models ─────────────────────────────────────────────────────────
function MLModels() {
  const [cat, setCat] = useState("base");
  const [selected, setSelected] = useState(null);
  const cats = { base: "Base Layer", industry: "Industry Layer", highseal: "High-Seal Algo" };
  const filtered = MODELS.filter(m => m.category === cat);
  return (
    <div className="space-y-4">
      <div><h2 className="text-base font-semibold text-gray-100 mb-1">ML Models</h2><p className="text-sm text-gray-500 mb-4">All trained models available for deployment</p>
        <div className="flex gap-1 border-b border-gray-800 mb-4">
          {Object.entries(cats).map(([k, v]) => (
            <button key={k} onClick={() => setCat(k)} className={`px-3 py-2 text-sm border-b-2 transition-all -mb-px ${cat === k ? "border-blue-500 text-blue-400 font-medium" : "border-transparent text-gray-500 hover:text-gray-300"}`}>{v}</button>
          ))}
        </div>
      </div>
      {cat === "highseal" ? (
        <div className="text-center py-16 text-gray-600 text-sm border border-dashed border-gray-700 rounded-xl">🔒 High-seal algorithms require authorisation before listing</div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map(m => (
            <div key={m.id} onClick={() => setSelected(selected?.id === m.id ? null : m)} className={`border rounded-xl p-4 cursor-pointer transition-all ${selected?.id === m.id ? "border-blue-500 bg-blue-950/40" : "border-gray-800 bg-gray-900 hover:border-gray-600"}`}>
              <div className="flex items-start justify-between mb-2">
                <div className="font-medium text-sm text-gray-100">{m.name}</div>
                {badge(m.version, "blue")}
              </div>
              <div className="flex gap-1.5 flex-wrap mb-3">
                {[m.framework, m.tag, m.size].map(t => <span key={t} className="text-xs bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">{t}</span>)}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${m.accuracy}%` }} />
                </div>
                <span className="text-xs text-gray-400">{m.accuracy}%</span>
              </div>
              {selected?.id === m.id && (
                <div className="mt-3 pt-3 border-t border-blue-800/50 space-y-1 text-xs text-gray-400">
                  <div>Framework: <span className="text-gray-200">{m.framework}</span></div>
                  <div>Team tag: <span className="text-gray-200">{m.tag}</span> · Size: <span className="text-gray-200">{m.size}</span></div>
                  <div>Accuracy: <span className="text-emerald-400">{m.accuracy}%</span></div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Deploy ────────────────────────────────────────────────────────────
function Deploy({ devices, setDevices }) {
  const [step, setStep] = useState(1);
  const [selDevice, setSelDevice] = useState("");
  const [selModel, setSelModel] = useState("");
  const [selCam, setSelCam] = useState("all");
  const [alertChs, setAlertChs] = useState({ WhatsApp: true, Email: false, Dashboard: true });
  const [deploying, setDeploying] = useState(false);
  const [deployDone, setDeployDone] = useState(false);
  const [history, setHistory] = useState(DEPLOY_HISTORY);
  const [progressStep, setProgressStep] = useState(0);

  const dev = devices.find(d => d.id === selDevice);
  const model = MODELS.find(m => m.id === parseInt(selModel));

  const PIPELINE_STEPS = ["Packaging model", "Uploading to device", "Loading on hardware", "Linking camera stream", "Activating alerts"];

  const startDeploy = () => {
    if (!selDevice || !selModel) return;
    setDeploying(true);
    setProgressStep(0);
    let s = 0;
    const iv = setInterval(() => {
      s++;
      setProgressStep(s);
      if (s >= PIPELINE_STEPS.length) {
        clearInterval(iv);
        const mid = parseInt(selModel);
        setDevices(prev => prev.map(d => d.id === selDevice ? { ...d, deployedModels: [...new Set([...d.deployedModels, mid])] } : d));
        setHistory(prev => [{
          id: Date.now(), model: `${model?.name} ${model?.version}`, device: dev?.name,
          cam: selCam === "all" ? "All cameras" : selCam, time: "Just now",
          status: "live", alerts: Object.keys(alertChs).filter(k => alertChs[k])
        }, ...prev]);
        setDeploying(false);
        setDeployDone(true);
      }
    }, 700);
  };

  const reset = () => { setStep(1); setSelDevice(""); setSelModel(""); setSelCam("all"); setAlertChs({ WhatsApp: true, Email: false, Dashboard: true }); setDeployDone(false); setProgressStep(0); };

  return (
    <div className="space-y-6">
      <div><h2 className="text-base font-semibold text-gray-100 mb-1">Deploy</h2><p className="text-sm text-gray-500">Push ML models from cloud to edge devices</p></div>

      <div className="grid grid-cols-5 gap-2 mb-2">
        {["Select Device", "Select Model", "Camera & Stream", "Alert Config", "Deploy"].map((s, i) => (
          <div key={s} className="flex flex-col items-center gap-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step > i + 1 || deployDone ? "bg-emerald-500 text-white" : step === i + 1 ? "bg-blue-500 text-white" : "bg-gray-800 text-gray-500"}`}>
              {step > i + 1 || deployDone ? "✓" : i + 1}
            </div>
            <div className={`text-xs text-center ${step === i + 1 ? "text-blue-400" : "text-gray-600"}`}>{s}</div>
          </div>
        ))}
      </div>

      {deployDone ? (
        <div className="border border-emerald-700 bg-emerald-950/40 rounded-xl p-8 flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-emerald-900 flex items-center justify-center text-3xl">✓</div>
          <div className="text-lg font-semibold text-emerald-400">Deployed successfully!</div>
          <div className="text-sm text-gray-400 text-center">{model?.name} is now live on {dev?.name}</div>
          <button onClick={reset} className="mt-2 px-6 py-2 bg-gray-800 text-gray-200 rounded-lg text-sm hover:bg-gray-700">Deploy another</button>
        </div>
      ) : deploying ? (
        <div className="border border-gray-800 bg-gray-900 rounded-xl p-8">
          <div className="text-sm font-medium text-gray-200 mb-6 text-center">Deploying {model?.name} → {dev?.name}</div>
          <div className="space-y-3">
            {PIPELINE_STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-3">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-all ${progressStep > i ? "bg-emerald-500 text-white" : progressStep === i ? "bg-blue-500 text-white" : "bg-gray-700 text-gray-500"}`}>
                  {progressStep > i ? "✓" : progressStep === i ? <span className="animate-pulse">●</span> : i + 1}
                </div>
                <div className={`text-sm transition-all ${progressStep >= i ? "text-gray-200" : "text-gray-600"}`}>{s}</div>
                {progressStep === i && <div className="ml-auto w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="border border-gray-800 bg-gray-900 rounded-xl p-5">
          {step === 1 && (
            <div className="space-y-3">
              <div className="text-sm font-medium text-gray-200 mb-3">Select edge device</div>
              <div className="grid grid-cols-3 gap-3">
                {devices.map(d => (
                  <div key={d.id} onClick={() => { setSelDevice(d.id); setStep(2); }} className={`p-3 border rounded-xl cursor-pointer transition-all ${selDevice === d.id ? "border-blue-500 bg-blue-950/40" : "border-gray-700 hover:border-gray-500"}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-2 h-2 rounded-full ${d.status === "online" ? "bg-emerald-500" : "bg-gray-600"}`} />
                      <span className="text-xs font-medium text-gray-200">{d.name}</span>
                    </div>
                    <div className="text-xs text-gray-500">{d.location}</div>
                    <div className="text-xs text-gray-600 mt-1">{d.hw}</div>
                    <div className="flex items-center gap-1 mt-2">
                      <div className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${d.cpu}%`, background: d.cpu > 60 ? "#f59e0b" : "#10b981" }} />
                      </div>
                      <span className="text-xs text-gray-500">CPU {d.cpu}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-3">
              <div className="text-sm font-medium text-gray-200 mb-3">Select ML model</div>
              <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
                {MODELS.filter(m => !dev?.deployedModels.includes(m.id)).map(m => (
                  <div key={m.id} onClick={() => { setSelModel(String(m.id)); setStep(3); }} className={`p-3 border rounded-xl cursor-pointer transition-all ${selModel === String(m.id) ? "border-blue-500 bg-blue-950/40" : "border-gray-700 hover:border-gray-500"}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-gray-200">{m.name}</span>
                      {badge(m.version, "blue")}
                    </div>
                    <div className="flex gap-1">
                      {[m.framework, m.tag].map(t => <span key={t} className="text-xs bg-gray-800 text-gray-400 px-1 py-0.5 rounded">{t}</span>)}
                    </div>
                    <div className="flex items-center gap-1 mt-2">
                      <div className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${m.accuracy}%` }} />
                      </div>
                      <span className="text-xs text-gray-500">{m.accuracy}%</span>
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={() => setStep(1)} className="text-xs text-gray-500 hover:text-gray-300">← Back</button>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-4">
              <div className="text-sm font-medium text-gray-200 mb-1">Camera & stream selection</div>
              <div>
                <div className="text-xs text-gray-500 mb-2">Select camera</div>
                <div className="grid grid-cols-4 gap-2">
                  <div onClick={() => setSelCam("all")} className={`p-2.5 border rounded-xl cursor-pointer text-center transition-all ${selCam === "all" ? "border-blue-500 bg-blue-950/40" : "border-gray-700 hover:border-gray-500"}`}>
                    <div className="text-lg mb-0.5">🎥</div>
                    <div className="text-xs text-gray-300">All cameras</div>
                  </div>
                  {dev?.cameras.map(c => (
                    <div key={c.id} onClick={() => setSelCam(c.name)} className={`p-2.5 border rounded-xl cursor-pointer text-center transition-all ${selCam === c.name ? "border-blue-500 bg-blue-950/40" : "border-gray-700 hover:border-gray-500"}`}>
                      <div className="text-lg mb-0.5">📷</div>
                      <div className="text-xs text-gray-300">{c.name}</div>
                      <div className="text-xs text-gray-600">{c.type}</div>
                      {badge(c.status, c.status === "live" ? "green" : "gray")}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-2">Stream type</div>
                <div className="flex gap-2">
                  {["Real-time live", "Recorded video", "Both"].map(s => (
                    <label key={s} className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer">
                      <input type="radio" name="streamtype" defaultChecked={s === "Real-time live"} /> {s}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStep(2)} className="text-xs text-gray-500 hover:text-gray-300">← Back</button>
                <button onClick={() => setStep(4)} className="ml-auto px-4 py-2 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700">Next →</button>
              </div>
            </div>
          )}
          {step === 4 && (
            <div className="space-y-4">
              <div className="text-sm font-medium text-gray-200 mb-1">Alert configuration</div>
              <div className="grid grid-cols-3 gap-3">
                {Object.keys(alertChs).map(ch => (
                  <div key={ch} onClick={() => setAlertChs(p => ({ ...p, [ch]: !p[ch] }))} className={`p-3 border rounded-xl cursor-pointer transition-all ${alertChs[ch] ? "border-blue-500 bg-blue-950/40" : "border-gray-700 hover:border-gray-500"}`}>
                    <div className="text-xl mb-1">{ch === "WhatsApp" ? "💬" : ch === "Email" ? "📧" : "🖥"}</div>
                    <div className="text-xs font-medium text-gray-200">{ch}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{alertChs[ch] ? "Enabled" : "Disabled"}</div>
                  </div>
                ))}
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-2">Alert sensitivity</div>
                <div className="flex gap-2">
                  {["High only", "High + Medium", "All"].map(s => (
                    <label key={s} className="flex items-center gap-1.5 text-xs text-gray-300 cursor-pointer">
                      <input type="radio" name="sensitivity" defaultChecked={s === "High + Medium"} /> {s}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStep(3)} className="text-xs text-gray-500 hover:text-gray-300">← Back</button>
                <button onClick={() => setStep(5)} className="ml-auto px-4 py-2 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700">Next →</button>
              </div>
            </div>
          )}
          {step === 5 && (
            <div className="space-y-4">
              <div className="text-sm font-medium text-gray-200 mb-1">Review & deploy</div>
              <div className="bg-gray-800 rounded-xl p-4 space-y-2 border border-gray-700">
                {[["Device", dev?.name], ["Location", dev?.location], ["Model", `${model?.name} ${model?.version}`], ["Camera", selCam === "all" ? "All cameras" : selCam], ["Alerts", Object.keys(alertChs).filter(k => alertChs[k]).join(", ")]].map(([k, v]) => (
                  <div key={k} className="flex gap-3 text-sm">
                    <span className="text-gray-500 w-20 flex-shrink-0">{k}</span>
                    <span className="text-gray-200">{v}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStep(4)} className="text-xs text-gray-500 hover:text-gray-300">← Back</button>
                <button onClick={startDeploy} className="ml-auto px-6 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700">Deploy now →</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Deployment history */}
      <div>
        <div className="text-sm font-medium text-gray-200 mb-3">Deployment history</div>
        <div className="space-y-2">
          {history.map(h => (
            <div key={h.id} className="border border-gray-800 bg-gray-900 rounded-xl p-3 flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${h.status === "live" ? "bg-emerald-500" : "bg-amber-500"}`} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-200">{h.model}</div>
                <div className="text-xs text-gray-500">{h.device} · {h.cam} · {h.time}</div>
              </div>
              <div className="flex gap-1 flex-wrap justify-end">
                {h.alerts.map(a => <span key={a} className="text-xs bg-gray-800 text-gray-400 px-1.5 py-0.5 rounded">{a}</span>)}
                {badge(h.status, h.status === "live" ? "green" : "amber")}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Video Streams ─────────────────────────────────────────────────────
function VideoStreams({ devices, alerts }) {
  const [selectedDevice, setSelectedDevice] = useState(devices[0]?.id);
  const [selectedCam, setSelectedCam] = useState(null);
  const [layout, setLayout] = useState("grid");
  const allCams = devices.flatMap(d => d.cameras.map(c => ({ ...c, deviceId: d.id, deviceName: d.name, deployedModels: d.deployedModels })));
  const devCams = devices.find(d => d.id === selectedDevice)?.cameras.map(c => {
    const d = devices.find(x => x.id === selectedDevice);
    return { ...c, deviceName: d.name, deployedModels: d.deployedModels };
  }) || [];
  const focusCam = selectedCam ? allCams.find(c => c.id === selectedCam) : null;
  const camAlerts = (camName, devName) => alerts.filter(a => a.cam === camName && a.device === devName);

  const RECORDINGS = [
    { id: 1, cam: "CAM-01", device: "MAC-Warehouse-01", duration: "5:00", time: "10:20 AM", size: "124MB", hasAlert: true },
    { id: 2, cam: "CAM-02", device: "MAC-Traffic-02", duration: "5:00", time: "9:05 AM", size: "98MB", hasAlert: false },
    { id: 3, cam: "CAM-01", device: "MAC-Traffic-02", duration: "5:00", time: "8:55 AM", size: "112MB", hasAlert: true },
    { id: 4, cam: "CAM-02", device: "MAC-Warehouse-01", duration: "5:00", time: "Yesterday 6:00 PM", size: "101MB", hasAlert: false },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div><h2 className="text-base font-semibold text-gray-100 mb-1">Video Streams</h2><p className="text-sm text-gray-500">Live feeds, stream assignment and recordings</p></div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-gray-800 rounded-lg p-0.5">
            {[["grid","⊞"],["focus","⬜"]].map(([v, ic]) => (
              <button key={v} onClick={() => { setLayout(v); setSelectedCam(null); }} className={`px-2 py-1 rounded text-sm transition-all ${layout === v ? "bg-gray-600 text-white" : "text-gray-500"}`}>{ic}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Device filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button onClick={() => setSelectedDevice("all")} className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${selectedDevice === "all" ? "bg-blue-600 text-white border-blue-600" : "border-gray-700 text-gray-400 hover:border-gray-500"}`}>All devices</button>
        {devices.map(d => (
          <button key={d.id} onClick={() => setSelectedDevice(d.id)} className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${selectedDevice === d.id ? "bg-blue-600 text-white border-blue-600" : "border-gray-700 text-gray-400 hover:border-gray-500"}`}>
            <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${d.status === "online" ? "bg-emerald-400" : "bg-gray-500"}`} />{d.name}
          </button>
        ))}
      </div>

      {/* Focus view */}
      {focusCam && (
        <div className="border border-gray-700 rounded-2xl overflow-hidden bg-gray-900">
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
            <div className="text-sm font-medium text-gray-200">{focusCam.name} · {focusCam.deviceName}</div>
            <button onClick={() => setSelectedCam(null)} className="text-xs text-gray-500 hover:text-gray-300">✕ Close</button>
          </div>
          <div className="p-4">
            <CamFeed cam={focusCam} deviceName={focusCam.deviceName} modelName={focusCam.deployedModels[0] ? MODELS.find(m => m.id === focusCam.deployedModels[0])?.name : null} large alertFlash={camAlerts(focusCam.name, focusCam.deviceName).some(a => a.severity === "high")} />
          </div>
          <div className="px-4 pb-4 grid grid-cols-3 gap-3">
            <div className="bg-gray-800 rounded-xl p-3">
              <div className="text-xs text-gray-500 mb-1">Type</div>
              <div className="text-sm text-gray-200">{focusCam.type}</div>
            </div>
            <div className="bg-gray-800 rounded-xl p-3">
              <div className="text-xs text-gray-500 mb-1">Status</div>
              {badge(focusCam.status, focusCam.status === "live" ? "green" : "gray")}
            </div>
            <div className="bg-gray-800 rounded-xl p-3">
              <div className="text-xs text-gray-500 mb-1">Alerts</div>
              <div className="text-sm text-gray-200">{camAlerts(focusCam.name, focusCam.deviceName).length} today</div>
            </div>
          </div>
          <div className="px-4 pb-4">
            <div className="text-xs text-gray-500 mb-2">Assign ML model to this camera</div>
            <div className="flex gap-2">
              <select className="flex-1 bg-gray-800 border border-gray-700 rounded-lg text-xs text-gray-300 px-3 py-2">
                <option>Select model…</option>
                {MODELS.map(m => <option key={m.id}>{m.name} {m.version}</option>)}
              </select>
              <button className="px-3 py-2 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700">Assign</button>
            </div>
          </div>
        </div>
      )}

      {/* Camera grid */}
      <div>
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Live feeds</div>
        <div className="grid grid-cols-2 gap-3">
          {(selectedDevice === "all" ? allCams : devCams).map(cam => {
            const mId = cam.deployedModels?.[0];
            const mName = mId ? MODELS.find(m => m.id === mId)?.name : null;
            const hasAlert = camAlerts(cam.name, cam.deviceName).some(a => a.severity === "high");
            return (
              <div key={cam.id} onClick={() => { setSelectedCam(cam.id); setLayout("focus"); }} className="cursor-pointer group">
                <CamFeed cam={cam} deviceName={cam.deviceName} modelName={mName} alertFlash={hasAlert} />
                <div className="flex items-center justify-between mt-1.5 px-1">
                  <div>
                    <span className="text-xs text-gray-300 font-medium">{cam.name}</span>
                    <span className="text-xs text-gray-600 ml-1.5">{cam.deviceName}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    {hasAlert && <span className="text-xs text-red-400">⚠ Alert</span>}
                    {mName && <span className="text-xs bg-gray-800 text-cyan-400 px-1.5 py-0.5 rounded font-mono">{mName.split(" ")[0]}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Stream assignment table */}
      <div>
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Stream & model assignment</div>
        <div className="border border-gray-800 rounded-xl overflow-hidden bg-gray-900">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800">
                {["Camera", "Device", "Type", "Status", "Assigned model", "Action"].map(h => (
                  <th key={h} className="text-left text-gray-500 font-medium px-3 py-2.5">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allCams.map(cam => {
                const mId = cam.deployedModels?.[0];
                const mName = mId ? MODELS.find(m => m.id === mId)?.name : null;
                return (
                  <tr key={cam.id} className="border-b border-gray-800/50 last:border-none hover:bg-gray-800/50 transition-all">
                    <td className="px-3 py-2.5 text-gray-200 font-medium">{cam.name}</td>
                    <td className="px-3 py-2.5 text-gray-400">{cam.deviceName}</td>
                    <td className="px-3 py-2.5 text-gray-500">{cam.type}</td>
                    <td className="px-3 py-2.5">{badge(cam.status, cam.status === "live" ? "green" : "gray")}</td>
                    <td className="px-3 py-2.5">
                      <select className="bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-gray-300 text-xs">
                        <option value="">{mName || "No model"}</option>
                        {MODELS.map(m => <option key={m.id}>{m.name}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2.5">
                      <button onClick={() => { setSelectedCam(cam.id); setLayout("focus"); }} className="text-blue-400 hover:text-blue-300 text-xs">View →</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recordings */}
      <div>
        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Recent recordings (5 min clips)</div>
        <div className="grid grid-cols-2 gap-3">
          {RECORDINGS.map(r => (
            <div key={r.id} className="border border-gray-800 bg-gray-900 rounded-xl p-3 flex gap-3">
              <div className="w-24 h-16 bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0 relative overflow-hidden border border-gray-700">
                <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-900" />
                <span className="relative text-gray-500 text-lg">▶</span>
                {r.hasAlert && <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-200">{r.cam} · {r.device}</div>
                <div className="text-xs text-gray-500 mt-0.5">{r.time} · {r.duration} · {r.size}</div>
                {r.hasAlert && <div className="text-xs text-red-400 mt-0.5">⚠ Contains alert event</div>}
                <div className="flex gap-2 mt-2">
                  <button className="text-xs text-blue-400 hover:text-blue-300">Download</button>
                  <button className="text-xs text-gray-500 hover:text-gray-300">Label</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Edge Devices ──────────────────────────────────────────────────────
function EdgeDevices({ devices, setDevices, alerts }) {
  const [selected, setSelected] = useState(devices[0]);
  const [tab, setTab] = useState("overview");
  const [showRegister, setShowRegister] = useState(false);
  const [showDeploy, setShowDeploy] = useState(false);
  const [deployModel, setDeployModel] = useState("");
  const [deployCam, setDeployCam] = useState("");
  const [newDevice, setNewDevice] = useState({ name: "", location: "", hw: "GPU" });
  const [deployStatus, setDeployStatus] = useState(null);
  const dev = devices.find(d => d.id === selected?.id) || devices[0];
  const removeModel = (mid) => setDevices(prev => prev.map(d => d.id === dev.id ? { ...d, deployedModels: d.deployedModels.filter(m => m !== mid) } : d));
  const doDeploy = () => {
    if (!deployModel) return;
    setDeployStatus("deploying");
    setTimeout(() => {
      setDevices(prev => prev.map(d => d.id === dev.id ? { ...d, deployedModels: [...new Set([...d.deployedModels, parseInt(deployModel)])] } : d));
      setDeployStatus("done");
      setTimeout(() => { setShowDeploy(false); setDeployStatus(null); setDeployModel(""); setDeployCam(""); }, 1200);
    }, 1800);
  };
  const registerDevice = () => {
    if (!newDevice.name) return;
    setDevices(prev => [...prev, { id: `mac-${Date.now()}`, name: newDevice.name, location: newDevice.location, status: "idle", cpu: 0, ram: 0, hw: newDevice.hw, deployedModels: [], cameras: [] }]);
    setShowRegister(false);
    setNewDevice({ name: "", location: "", hw: "GPU" });
  };
  const devAlerts = alerts.filter(a => a.device === dev.name);

  return (
    <div className="flex gap-4 h-full">
      <div className="w-52 flex-shrink-0 space-y-2">
        <button onClick={() => setShowRegister(true)} className="w-full text-xs py-2 px-3 border border-dashed border-gray-700 rounded-lg text-gray-500 hover:border-blue-500 hover:text-blue-400 transition-all">+ Register device</button>
        {devices.map(d => (
          <div key={d.id} onClick={() => { setSelected(d); setTab("overview"); }} className={`p-3 border rounded-xl cursor-pointer transition-all ${dev.id === d.id ? "border-blue-500 bg-blue-950/30" : "border-gray-800 bg-gray-900 hover:border-gray-600"}`}>
            <div className="flex items-center gap-2 mb-1"><div className={`w-2 h-2 rounded-full ${d.status === "online" ? "bg-emerald-500" : "bg-gray-600"}`} /><span className="text-xs font-medium text-gray-200 truncate">{d.name}</span></div>
            <div className="text-xs text-gray-500 truncate">{d.location}</div>
            <div className="text-xs text-gray-600 mt-1">{d.deployedModels.length} models · {d.cameras.length} cams</div>
          </div>
        ))}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-3">
          <div><h3 className="text-sm font-medium text-gray-100">{dev.name}</h3><p className="text-xs text-gray-500">{dev.location} · {dev.hw}</p></div>
          <div className="flex gap-2">
            <button onClick={() => setShowDeploy(true)} className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700">+ Deploy model</button>
            {badge(dev.status === "online" ? "Online" : "Idle", dev.status === "online" ? "green" : "gray")}
          </div>
        </div>
        <div className="flex gap-1 border-b border-gray-800 mb-4">
          {["overview", "streams", "models", "alerts"].map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-3 py-2 text-xs capitalize border-b-2 -mb-px transition-all ${tab === t ? "border-blue-500 text-blue-400 font-medium" : "border-transparent text-gray-500 hover:text-gray-300"}`}>{t}</button>
          ))}
        </div>
        {tab === "overview" && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              {[["CPU", dev.cpu + "%", dev.cpu > 60 ? "#f59e0b" : "#10b981"], ["RAM", dev.ram + "%", "#3b82f6"], ["Models", dev.deployedModels.length, "#8b5cf6"]].map(([l, v, c]) => (
                <div key={l} className="bg-gray-900 rounded-xl p-3 border border-gray-800"><div className="text-xs text-gray-500">{l}</div><div className="text-xl font-bold mt-1" style={{ color: c }}>{v}</div></div>
              ))}
            </div>
            <div className="border border-gray-800 rounded-xl p-3 bg-gray-900">
              <div className="text-xs font-medium text-gray-300 mb-2">Cameras</div>
              <div className="grid grid-cols-3 gap-2">
                {dev.cameras.map(c => (
                  <div key={c.id} className="bg-gray-800 rounded-lg p-2 text-center">
                    <div className="text-lg mb-1">📷</div>
                    <div className="text-xs font-medium text-gray-200">{c.name}</div>
                    <div className="text-xs text-gray-500">{c.type}</div>
                    <div className="mt-1">{badge(c.status, c.status === "live" ? "green" : "gray")}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="border border-gray-800 rounded-xl p-3 bg-gray-900">
              <div className="text-xs font-medium text-gray-300 mb-2">Deployed models</div>
              {dev.deployedModels.length === 0 ? <div className="text-xs text-gray-600 py-2">No models deployed</div> : dev.deployedModels.map(mid => {
                const m = MODELS.find(x => x.id === mid);
                return m ? (
                  <div key={mid} className="flex items-center gap-2 py-1.5 border-b border-gray-800 last:border-none">
                    <div className="w-6 h-6 rounded bg-blue-900 flex items-center justify-center text-xs font-medium text-blue-300">{m.tag}</div>
                    <div className="flex-1 text-xs text-gray-200">{m.name} <span className="text-gray-500">{m.version}</span></div>
                    <button onClick={() => removeModel(mid)} className="text-xs text-red-400 hover:text-red-300 px-2 py-0.5 border border-red-900 rounded hover:border-red-600 transition-all">Remove</button>
                  </div>
                ) : null;
              })}
            </div>
          </div>
        )}
        {tab === "streams" && (
          <div className="space-y-3">
            {dev.cameras.length === 0 ? <div className="text-xs text-gray-600 py-8 text-center border border-dashed border-gray-800 rounded-xl">No cameras connected</div> : (
              <>
                <div className={`grid gap-3 ${dev.cameras.length >= 2 ? "grid-cols-2" : "grid-cols-1"}`}>
                  {dev.cameras.map(cam => {
                    const mId = dev.deployedModels[0];
                    const mName = mId ? MODELS.find(m => m.id === mId)?.name : null;
                    return (
                      <div key={cam.id}>
                        <CamFeed cam={cam} deviceName={dev.name} modelName={mName} alertFlash={devAlerts.some(a => a.cam === cam.name && a.severity === "high")} />
                        <div className="flex items-center justify-between mt-1 px-1">
                          <span className="text-xs text-gray-400">{cam.name} · {cam.type}</span>
                          <div className="flex gap-2">
                            <button className="text-xs text-gray-500 hover:text-gray-300">Assign model</button>
                            <button className="text-xs text-gray-500 hover:text-gray-300">Recording</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="border border-gray-800 rounded-xl p-3 bg-gray-900">
                  <div className="text-xs font-medium text-gray-300 mb-2">Camera config</div>
                  {dev.cameras.map(cam => (
                    <div key={cam.id} className="flex items-center gap-2 py-1.5 border-b border-gray-800 last:border-none">
                      <span className="text-xs w-14 font-medium text-gray-300">{cam.name}</span>
                      <span className="text-xs text-gray-600 w-10">{cam.type}</span>
                      {badge(cam.status, cam.status === "live" ? "green" : "gray")}
                      <div className="flex-1" />
                      <select className="text-xs bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-gray-400">
                        <option value="">No model</option>
                        {dev.deployedModels.map(mid => { const m = MODELS.find(x => x.id === mid); return m ? <option key={mid}>{m.name}</option> : null; })}
                      </select>
                    </div>
                  ))}
                </div>
                <div className="border border-gray-800 rounded-xl p-3 bg-gray-900">
                  <div className="text-xs font-medium text-gray-300 mb-2">Recent recordings</div>
                  {dev.cameras.filter(c => c.status === "live").map(cam => (
                    <div key={cam.id} className="flex items-center gap-3 py-2 border-b border-gray-800 last:border-none">
                      <div className="w-16 h-10 bg-gray-700 rounded text-xs text-gray-500 flex items-center justify-center">▶</div>
                      <div><div className="text-xs font-medium text-gray-200">{cam.name} · 5min clip</div><div className="text-xs text-gray-500">Just now · MP4</div></div>
                      <div className="flex-1" />
                      <button className="text-xs text-blue-400 hover:text-blue-300">Download</button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        {tab === "models" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">{dev.deployedModels.length} models on this device</span>
              <button onClick={() => setShowDeploy(true)} className="text-xs px-2.5 py-1 border border-gray-700 rounded-lg hover:border-gray-500 text-gray-400 transition-all">+ Deploy new</button>
            </div>
            {dev.deployedModels.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-gray-800 rounded-xl text-gray-600 text-sm">No models deployed<br /><button onClick={() => setShowDeploy(true)} className="mt-2 text-xs text-blue-400">Deploy now →</button></div>
            ) : dev.deployedModels.map(mid => {
              const m = MODELS.find(x => x.id === mid);
              return m ? (
                <div key={mid} className="border border-gray-800 rounded-xl p-3 bg-gray-900">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-900 flex items-center justify-center text-xs font-bold text-blue-300">{m.tag}</div>
                      <div><div className="text-sm font-medium text-gray-200">{m.name}</div><div className="text-xs text-gray-500">{m.framework} · {m.version} · {m.size}</div></div>
                    </div>
                    <button onClick={() => removeModel(mid)} className="text-xs text-red-400 hover:text-red-300 px-2.5 py-1 border border-red-900 rounded-lg hover:border-red-600 hover:bg-red-950/40 transition-all">Remove</button>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${m.accuracy}%` }} /></div>
                    <span className="text-xs text-gray-500">{m.accuracy}%</span>
                    {badge("Running", "green")}
                  </div>
                  <div className="mt-2">
                    <select className="text-xs bg-gray-800 border border-gray-700 rounded-lg px-2 py-1 text-gray-400">
                      <option>Assign to camera…</option>
                      {dev.cameras.map(c => <option key={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
              ) : null;
            })}
          </div>
        )}
        {tab === "alerts" && (
          <div className="space-y-2">
            {devAlerts.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-gray-800 rounded-xl text-gray-600 text-sm">No alerts for this device</div>
            ) : devAlerts.map(a => (
              <div key={a.id} className="border border-gray-800 rounded-xl p-3 bg-gray-900 flex items-start gap-3">
                <div className="text-xl">{a.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5"><span className="text-sm font-medium text-gray-200">{a.title}</span>{badge(a.severity, severityColor(a.severity))}</div>
                  <div className="text-xs text-gray-500">{a.cam} · {a.model}</div>
                  <div className="text-xs text-gray-600">{a.time} · {a.sent}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {showRegister && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-80 shadow-2xl">
            <div className="font-medium text-gray-100 mb-4">Register edge device</div>
            <div className="space-y-3">
              <div><div className="text-xs text-gray-500 mb-1">Device name</div><input className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-blue-500" placeholder="MAC-Location-01" value={newDevice.name} onChange={e => setNewDevice(p => ({ ...p, name: e.target.value }))} /></div>
              <div><div className="text-xs text-gray-500 mb-1">Location</div><input className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-blue-500" placeholder="Site or building name" value={newDevice.location} onChange={e => setNewDevice(p => ({ ...p, location: e.target.value }))} /></div>
              <div><div className="text-xs text-gray-500 mb-1">Hardware</div>
                <select className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200" value={newDevice.hw} onChange={e => setNewDevice(p => ({ ...p, hw: e.target.value }))}>
                  <option>GPU</option><option>aIPU · GPU</option><option>aIPU · GPU · NPU</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowRegister(false)} className="flex-1 py-2 text-sm border border-gray-700 rounded-lg text-gray-400 hover:bg-gray-800">Cancel</button>
              <button onClick={registerDevice} className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Register</button>
            </div>
          </div>
        </div>
      )}
      {showDeploy && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-96 shadow-2xl">
            <div className="font-medium text-gray-100 mb-1">Deploy model</div>
            <div className="text-xs text-gray-500 mb-4">Push ML model to {dev.name}</div>
            {deployStatus === "deploying" ? (
              <div className="py-8 flex flex-col items-center gap-3"><div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /><div className="text-sm text-gray-400">Deploying to device…</div></div>
            ) : deployStatus === "done" ? (
              <div className="py-8 flex flex-col items-center gap-3"><div className="w-10 h-10 rounded-full bg-emerald-900 flex items-center justify-center text-emerald-400 text-xl">✓</div><div className="text-sm text-gray-300">Deployed successfully!</div></div>
            ) : (
              <div className="space-y-3">
                <div><div className="text-xs text-gray-500 mb-1">Select model</div>
                  <select className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200" value={deployModel} onChange={e => setDeployModel(e.target.value)}>
                    <option value="">Choose a model…</option>
                    {MODELS.filter(m => !dev.deployedModels.includes(m.id)).map(m => <option key={m.id} value={m.id}>{m.name} {m.version}</option>)}
                  </select>
                </div>
                <div><div className="text-xs text-gray-500 mb-1">Assign to camera</div>
                  <select className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200" value={deployCam} onChange={e => setDeployCam(e.target.value)}>
                    <option value="">All cameras</option>
                    {dev.cameras.map(c => <option key={c.id} value={c.id}>{c.name} · {c.type}</option>)}
                  </select>
                </div>
                <div><div className="text-xs text-gray-500 mb-1">Alert channels</div>
                  <div className="flex gap-3">{["WhatsApp", "Email", "Dashboard"].map(ch => <label key={ch} className="flex items-center gap-1.5 text-sm text-gray-300 cursor-pointer"><input type="checkbox" defaultChecked={ch !== "Email"} />{ch}</label>)}</div>
                </div>
                <div className="flex gap-2 mt-2">
                  <button onClick={() => setShowDeploy(false)} className="flex-1 py-2 text-sm border border-gray-700 rounded-lg text-gray-400 hover:bg-gray-800">Cancel</button>
                  <button onClick={doDeploy} disabled={!deployModel} className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40">Deploy →</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Alerts ────────────────────────────────────────────────────────────
function Alerts({ alerts }) {
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? alerts : alerts.filter(a => a.severity === filter);
  return (
    <div className="space-y-4">
      <div><h2 className="text-base font-semibold text-gray-100 mb-1">Alerts</h2><p className="text-sm text-gray-500 mb-4">GenAI-powered alerts via WhatsApp and dashboard</p>
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[["Today", alerts.filter(a => a.time.includes("AM") || a.time.includes("PM")).length, "#ef4444"], ["This week", alerts.length, "#f59e0b"], ["WhatsApp sent", alerts.filter(a => a.sent.includes("WhatsApp")).length, "#10b981"]].map(([l, v, c]) => (
            <div key={l} className="bg-gray-900 rounded-xl p-3 border border-gray-800"><div className="text-xs text-gray-500">{l}</div><div className="text-2xl font-bold mt-1" style={{ color: c }}>{v}</div></div>
          ))}
        </div>
        <div className="flex gap-2 mb-4">
          {["all", "high", "medium", "info"].map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`text-xs px-3 py-1.5 rounded-lg capitalize border transition-all ${filter === f ? "bg-blue-600 text-white border-blue-600" : "border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300"}`}>{f}</button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        {filtered.map(a => (
          <div key={a.id} className="border border-gray-800 rounded-xl p-4 bg-gray-900 flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ background: a.severity === "high" ? "#450a0a" : a.severity === "medium" ? "#451a03" : "#0c1a2e" }}>{a.icon}</div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1"><span className="text-sm font-medium text-gray-200">{a.title}</span>{badge(a.severity, severityColor(a.severity))}</div>
              <div className="text-xs text-gray-500">{a.device} · {a.cam} · {a.model}</div>
              <div className="flex items-center gap-3 mt-1"><span className="text-xs text-gray-600">{a.time}</span><span className="text-xs text-gray-600">· {a.sent}</span></div>
            </div>
            <button className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 border border-gray-700 rounded-lg hover:border-blue-700">View clip</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── App shell ─────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("overview");
  const [devices, setDevices] = useState(INIT_DEVICES);
  const [alerts] = useState(ALERTS_DATA);

  const tabs = [
    { id: "overview", label: "Overview", icon: "◉" },
    { id: "models", label: "ML Models", icon: "⬡" },
    { id: "devices", label: "Edge Devices", icon: "🖥" },
    { id: "deploy", label: "Deploy", icon: "🚀" },
    { id: "streams", label: "Video Streams", icon: "📹" },
    { id: "alerts", label: "Alerts", icon: "🔔" },
  ];

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden text-gray-100" style={{ fontFamily: "system-ui, sans-serif" }}>
      <div className="w-48 flex-shrink-0 border-r border-gray-800 flex flex-col py-4 px-3 bg-gray-900">
        <div className="px-2 pb-4 mb-2 border-b border-gray-800">
          <div className="text-sm font-bold text-white tracking-tight">VisionOps</div>
          <div className="text-xs text-gray-500">Cloud Platform</div>
        </div>
        <div className="space-y-0.5 flex-1">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm transition-all text-left ${tab === t.id ? "bg-gray-800 text-white font-medium" : "text-gray-500 hover:bg-gray-800/50 hover:text-gray-300"}`}>
              <span className="text-base leading-none">{t.icon}</span>{t.label}
            </button>
          ))}
        </div>
        <div className="mt-auto pt-3 border-t border-gray-800 px-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-blue-900 flex items-center justify-center text-xs text-blue-300 font-bold">A</div>
            <div className="text-xs text-gray-500">Admin</div>
            <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-500" />
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        {tab === "overview" && <Overview devices={devices} alerts={alerts} />}
        {tab === "models" && <MLModels />}
        {tab === "devices" && <EdgeDevices devices={devices} setDevices={setDevices} alerts={alerts} />}
        {tab === "deploy" && <Deploy devices={devices} setDevices={setDevices} />}
        {tab === "streams" && <VideoStreams devices={devices} alerts={alerts} />}
        {tab === "alerts" && <Alerts alerts={alerts} />}
      </div>
    </div>
  );
}
