import { useState, useEffect } from "react";
import { useTheme } from "../../App.jsx";

// ── Step indicator ────────────────────────────────────────────────────────────
function StepBar({ steps, current, done }) {
  const { dark } = useTheme();
  return (
    <div className="flex items-center gap-1 mb-6">
      {steps.map((s, i) => {
        const completed = done || i < current;
        const active    = !done && i === current;
        return (
          <div key={s} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div className={`
                w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                transition-all
                ${completed
                  ? "bg-emerald-500 text-white"
                  : active
                    ? "bg-blue-500 text-white ring-4 ring-blue-500/20"
                    : dark ? "bg-slate-800 text-slate-500" : "bg-slate-100 text-slate-400"
                }
              `}>
                {completed ? (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : active ? (
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse-dot" />
                ) : (
                  i + 1
                )}
              </div>
              <span className={`text-xs text-center leading-tight w-16 ${
                active
                  ? dark ? "text-blue-400" : "text-blue-600"
                  : completed
                    ? dark ? "text-emerald-400" : "text-emerald-600"
                    : dark ? "text-slate-600" : "text-slate-400"
              }`}>{s}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-px mx-2 mb-5 ${
                i < current || done
                  ? "bg-emerald-500"
                  : dark ? "bg-slate-700" : "bg-slate-200"
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Selectable card ───────────────────────────────────────────────────────────
function SelectCard({ selected, onClick, children }) {
  const { dark } = useTheme();
  return (
    <div
      onClick={onClick}
      className={`
        border rounded-xl p-3.5 cursor-pointer transition-all
        ${selected
          ? dark
            ? "border-blue-500 bg-blue-600/10 ring-1 ring-blue-500/20"
            : "border-blue-400 bg-blue-50"
          : dark
            ? "border-slate-700 hover:border-slate-600 bg-slate-900/50"
            : "border-slate-200 hover:border-slate-300 bg-white"
        }
      `}
    >
      {children}
    </div>
  );
}

// ── Deploy view ───────────────────────────────────────────────────────────────
export default function Deploy({ devices, models, deployments, streamsCache = {}, onDeployed, onRemoved }) {
  const { dark } = useTheme();

  const [step,        setStep]        = useState(0);   // 0..3
  const [selDev,      setSelDev]      = useState("");
  const [selCam,      setSelCam]      = useState("");   // channel number as string
  const [selModel,    setSelModel]    = useState("");
  const [deploying,   setDeploying]   = useState(false);
  const [done,        setDone]        = useState(false);
  const [deployErr,   setDeployErr]   = useState("");
  const [elapsed,     setElapsed]     = useState(0);   // elapsed time in seconds
  const [startTime,   setStartTime]   = useState(null);
  const [selectedDep, setSelectedDep] = useState(null); // for viewing deployment details

  const selectedDevice = devices.find(d => d.device_id === selDev);
  const selectedModel  = models.find(m => m.id === parseInt(selModel));

  // Cameras come directly from the streams cache — no API call needed
  const cachedStreams = streamsCache[selDev]?.data ?? [];
  const selectedCamera = cachedStreams.find(s => String(s.channel) === selCam);

  const STEPS = ["Select Device", "Select Camera", "Select Model", "Confirm"];

  // Track elapsed time while deploying
  useEffect(() => {
    if (!deploying) return;
    const interval = setInterval(() => {
      if (startTime) {
        setElapsed(Math.round((Date.now() - startTime) / 1000));
      }
    }, 100);
    return () => clearInterval(interval);
  }, [deploying, startTime]);

  const reset = () => {
    setStep(0); setSelDev(""); setSelCam(""); setSelModel("");
    setDeploying(false); setDone(false); setDeployErr("");
    setElapsed(0); setStartTime(null); setSelectedDep(null);
  };

  const handleDeploy = async () => {
    setDeployErr("");
    setDeploying(true);
    setStartTime(Date.now());
    setElapsed(0);

    try {
      // Resolve camera DB id from cache first
      let cameraDbId = selectedCamera?.camera_id ?? selectedCamera?.id ?? null;

      // Fallback: fetch /cameras if not in cache (direct to backend to avoid proxy stall)
      if (!cameraDbId && selDev && selCam) {
        const r = await fetch(`http://localhost:8000/cameras?device_id=${selDev}`);
        const cams = await r.json();
        const match = cams.find(c => String(c.channel) === selCam);
        cameraDbId = match?.id ?? null;
      }

      if (!cameraDbId) throw new Error("Camera not found — go to Streams tab and scan first");
      if (!selModel)   throw new Error("No model selected");

      // 30-second timeout for slower networks
      const ctrl    = new AbortController();
      const timeout = setTimeout(() => ctrl.abort(), 30_000);

      // Bypass vite proxy — call backend directly (vite proxy stalls for 30s+)
      const res = await fetch("http://localhost:8000/deployments", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ camera_id: Number(cameraDbId), model_id: Number(selModel) }),
        signal:  ctrl.signal,
      });
      clearTimeout(timeout);

      let data;
      try { data = await res.json(); } catch { data = {}; }
      if (!res.ok) throw new Error(data?.detail ?? `Server error ${res.status}`);

      onDeployed(data);
      setDone(true);
    } catch (err) {
      const msg = err.name === "AbortError"
        ? `Request timed out (${Math.round(elapsed)}s) — backend may be slow or unreachable`
        : err.message || "Deployment failed";
      setDeployErr(msg);
    } finally {
      setDeploying(false);
      setStartTime(null);
    }
  };

  const handleRemove = async (id) => {
    try {
      // Direct to backend to avoid proxy stall
      const res = await fetch(`http://localhost:8000/deployments/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
      onRemoved(id);
    } catch (err) {
      setDeployErr(`Failed to delete: ${err.message}`);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-5xl">

      {/* Header */}
      <div>
        <h1 className={`text-xl font-bold mb-1 ${dark ? "text-slate-100" : "text-slate-900"}`}>
          Deploy
        </h1>
        <p className={`text-sm ${dark ? "text-slate-400" : "text-slate-500"}`}>
          Assign ML models to camera streams for real-time inference.
        </p>
      </div>

      {/* Wizard card */}
      <div className={`rounded-2xl border p-6 ${dark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"}`}>

        <StepBar steps={STEPS} current={step} done={done} />

        {/* ── Error banner ── */}
        {deployErr && !deploying && !done && (
          <div className={`mb-4 flex items-start gap-3 px-4 py-3 rounded-xl border text-sm ${
            dark ? "bg-red-500/10 border-red-900 text-red-400" : "bg-red-50 border-red-200 text-red-600"
          }`}>
            <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" />
            </svg>
            <span>{deployErr}</span>
          </div>
        )}

        {/* ── Done state ── */}
        {done ? (
          <div className={`flex flex-col items-center py-10 gap-4 rounded-xl border ${
            dark ? "border-emerald-800 bg-emerald-500/5" : "border-emerald-200 bg-emerald-50"
          }`}>
            <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
              dark ? "bg-emerald-500/20" : "bg-emerald-100"
            }`}>
              <svg className="w-7 h-7 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="text-center">
              <div className={`text-base font-semibold mb-1 ${dark ? "text-emerald-400" : "text-emerald-700"}`}>
                Deployed Successfully!
              </div>
              <div className={`text-sm ${dark ? "text-slate-400" : "text-slate-600"}`}>
                {selectedModel?.name} is now running on {selectedCamera?.label ?? `Channel ${selCam}`}
              </div>
            </div>
            <button
              onClick={reset}
              className={`mt-2 px-5 py-2 rounded-xl text-sm font-medium border ${
                dark ? "border-slate-700 text-slate-300 hover:bg-slate-800" : "border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              Deploy Another
            </button>
          </div>
        ) : deploying ? (
          /* ── Deploying spinner with elapsed time ── */
          <div className={`flex flex-col items-center py-12 gap-4 rounded-xl border ${
            dark ? "border-slate-800 bg-slate-800/30" : "border-slate-200 bg-slate-50"
          }`}>
            <div className={`w-12 h-12 rounded-full border-2 border-blue-500 border-t-transparent animate-spin`} />
            <div className="text-center">
              <div className={`text-sm font-medium ${dark ? "text-slate-200" : "text-slate-800"}`}>
                Processing deployment…
              </div>
              <div className={`text-xs mt-1.5 ${dark ? "text-slate-400" : "text-slate-500"}`}>
                {selectedModel?.name} → {selectedCamera?.label}
              </div>
              <div className={`text-xs mt-2 font-mono ${dark ? "text-slate-500" : "text-slate-400"}`}>
                Elapsed: {elapsed}s (timeout: 30s)
              </div>
            </div>
          </div>
        ) : (
          /* ── Step content ── */
          <div className="space-y-4">

            {/* Step 0: Select device */}
            {step === 0 && (
              <>
                <p className={`text-xs font-medium mb-3 ${dark ? "text-slate-400" : "text-slate-600"}`}>
                  Choose an edge device
                </p>
                {devices.length === 0 ? (
                  <div className={`py-8 text-center text-sm ${dark ? "text-slate-600" : "text-slate-400"}`}>
                    No devices registered. Add one in the Devices section.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {devices.map(d => (
                      <SelectCard
                        key={d.device_id}
                        selected={selDev === d.device_id}
                        onClick={() => { setSelDev(d.device_id); setSelCam(""); setStep(1); }}
                      >
                        <div className={`flex items-center gap-2 mb-2`}>
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dark ? "bg-emerald-500" : "bg-emerald-400"}`} />
                          <span className={`text-xs font-semibold truncate ${dark ? "text-slate-200" : "text-slate-800"}`}>
                            {d.name}
                          </span>
                        </div>
                        <code className={`text-xs font-mono ${dark ? "text-slate-500" : "text-slate-400"}`}>
                          {d.dvr_ip}
                        </code>
                      </SelectCard>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Step 1: Select camera */}
            {step === 1 && (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <button
                    onClick={() => setStep(0)}
                    className={`text-xs ${dark ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-slate-600"}`}
                  >
                    ← Back
                  </button>
                  <span className={`text-xs font-medium ${dark ? "text-slate-400" : "text-slate-600"}`}>
                    Device: {selectedDevice?.name}
                  </span>
                </div>
                {cachedStreams.length === 0 ? (
                  <div className={`py-8 text-center text-sm ${dark ? "text-slate-600" : "text-slate-400"}`}>
                    No cameras found. Go to{" "}
                    <span className={dark ? "text-blue-400" : "text-blue-600"}>Streams</span>{" "}
                    and scan this device first.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {cachedStreams.map(s => (
                      <SelectCard
                        key={`ch-${s.channel}`}
                        selected={selCam === String(s.channel)}
                        onClick={() => { setSelCam(String(s.channel)); setDeployErr(""); setStep(2); }}
                      >
                        <div className="text-center">
                          <svg className={`w-5 h-5 mx-auto mb-1.5 ${dark ? "text-slate-400" : "text-slate-500"}`}
                            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                            <path strokeLinecap="round" strokeLinejoin="round"
                              d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                          </svg>
                          <div className={`text-xs font-semibold ${dark ? "text-slate-200" : "text-slate-800"}`}>
                            {s.label}
                          </div>
                          <div className={`text-xs mt-0.5 ${dark ? "text-slate-500" : "text-slate-400"}`}>
                            CH {s.channel}
                          </div>
                          <div className={`text-xs mt-1 px-1.5 py-0.5 rounded-full inline-block ${
                            dark ? "bg-emerald-500/15 text-emerald-400" : "bg-emerald-50 text-emerald-600"
                          }`}>
                            live
                          </div>
                        </div>
                      </SelectCard>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Step 2: Select model */}
            {step === 2 && (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <button
                    onClick={() => setStep(1)}
                    className={`text-xs ${dark ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-slate-600"}`}
                  >
                    ← Back
                  </button>
                  <span className={`text-xs font-medium ${dark ? "text-slate-400" : "text-slate-600"}`}>
                    Camera: {selectedCamera?.label}
                  </span>
                </div>
                {models.length === 0 ? (
                  <div className={`py-8 text-center text-sm ${dark ? "text-slate-600" : "text-slate-400"}`}>
                    No models uploaded yet. Go to ML Models to upload one.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-1">
                    {models.map(m => (
                      <SelectCard
                        key={m.id}
                        selected={selModel === String(m.id)}
                        onClick={() => { setSelModel(String(m.id)); setStep(3); }}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className={`text-xs font-semibold ${dark ? "text-slate-200" : "text-slate-800"}`}>
                            {m.name}
                          </div>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                            dark ? "bg-blue-500/15 text-blue-400" : "bg-blue-50 text-blue-600"
                          }`}>{m.version}</span>
                        </div>
                        <div className={`flex items-center gap-1 text-xs ${dark ? "text-slate-500" : "text-slate-400"}`}>
                          <span>{m.framework}</span>
                          <span>·</span>
                          <span>{m.size}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <div className={`flex-1 h-1 rounded-full ${dark ? "bg-slate-700" : "bg-slate-200"}`}>
                            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${m.accuracy}%` }} />
                          </div>
                          <span className={`text-xs ${dark ? "text-slate-500" : "text-slate-400"}`}>{m.accuracy}%</span>
                        </div>
                      </SelectCard>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Step 3: Confirm */}
            {step === 3 && (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <button
                    onClick={() => setStep(2)}
                    className={`text-xs ${dark ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-slate-600"}`}
                  >
                    ← Back
                  </button>
                  <span className={`text-xs font-medium ${dark ? "text-slate-400" : "text-slate-600"}`}>
                    Review configuration
                  </span>
                </div>
                <div className={`rounded-xl p-4 space-y-3 border ${dark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
                  {[
                    ["Device",  selectedDevice?.name],
                    ["Camera",  selectedCamera ? `${selectedCamera.label} (CH ${selectedCamera.channel})` : "—"],
                    ["Model",   selectedModel ? `${selectedModel.name} ${selectedModel.version}` : "—"],
                    ["Framework", selectedModel?.framework],
                    ["Accuracy", selectedModel ? `${selectedModel.accuracy}%` : "—"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-center gap-3 text-sm">
                      <span className={`w-24 flex-shrink-0 text-xs ${dark ? "text-slate-500" : "text-slate-400"}`}>{k}</span>
                      <span className={`font-medium ${dark ? "text-slate-200" : "text-slate-800"}`}>{v ?? "—"}</span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleDeploy}
                  disabled={!selCam || !selModel}
                  className="w-full mt-3 py-3 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Deploy Now →
                </button>
              </>
            )}

          </div>
        )}
      </div>

      {/* Deployment history / detail view */}
      {deployments.length > 0 && !selectedDep && (
        <div>
          <h2 className={`text-sm font-semibold mb-3 ${dark ? "text-slate-200" : "text-slate-800"}`}>
            Active Deployments
          </h2>
          <div className="space-y-2">
            {deployments.map(dep => (
              <div
                key={dep.id}
                onClick={() => setSelectedDep(dep)}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border cursor-pointer transition-all ${
                  dark ? "bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50" : "bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  dep.status === "active" ? "bg-emerald-500" : "bg-amber-500"
                }`} />
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium truncate ${dark ? "text-slate-200" : "text-slate-800"}`}>
                    {dep.model_name}
                    <span className={`ml-1.5 text-xs font-normal ${dark ? "text-slate-500" : "text-slate-400"}`}>
                      {dep.model_version}
                    </span>
                  </div>
                  <div className={`text-xs mt-0.5 truncate ${dark ? "text-slate-500" : "text-slate-400"}`}>
                    {dep.device_name} · {dep.camera_name}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    dep.status === "active"
                      ? dark ? "bg-emerald-500/15 text-emerald-400" : "bg-emerald-50 text-emerald-600"
                      : dark ? "bg-amber-500/15 text-amber-400" : "bg-amber-50 text-amber-600"
                  }`}>{dep.status}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(dep.id);
                    }}
                    className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${
                      dark
                        ? "text-slate-600 hover:text-red-400 hover:bg-red-500/10"
                        : "text-slate-400 hover:text-red-500 hover:bg-red-50"
                    }`}
                    title="Remove deployment"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Deployment detail view with live stream */}
      {selectedDep && (
        <div className={`rounded-2xl border p-6 ${dark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"}`}>
          <div className="flex items-center gap-2 mb-4">
            <button
              onClick={() => setSelectedDep(null)}
              className={`text-xs ${dark ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-slate-600"}`}
            >
              ← Back
            </button>
            <h2 className={`text-sm font-semibold ${dark ? "text-slate-200" : "text-slate-800"}`}>
              Deployment: {selectedDep.model_name}
            </h2>
          </div>

          <div className={`rounded-xl overflow-hidden border ${dark ? "border-slate-800 bg-slate-800/20" : "border-slate-200 bg-slate-50"}`}>
            {selectedDep.camera_id && (
              <>
                <div className="relative w-full bg-black aspect-video flex items-center justify-center">
                  <img
                    src={`http://localhost:8000/stream_inference/${selectedDep.id}`}
                    alt={selectedDep.camera_name}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50" style={{display: 'none'}}>
                    <span className={`text-sm ${dark ? "text-slate-300" : "text-slate-600"}`}>
                      Stream loading...
                    </span>
                  </div>
                </div>
                <div className={`p-4 border-t ${dark ? "border-slate-800" : "border-slate-200"}`}>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className={`text-xs ${dark ? "text-slate-500" : "text-slate-400"}`}>Camera</div>
                      <div className={`text-sm font-medium ${dark ? "text-slate-200" : "text-slate-800"}`}>
                        {selectedDep.camera_name}
                      </div>
                    </div>
                    <div>
                      <div className={`text-xs ${dark ? "text-slate-500" : "text-slate-400"}`}>Status</div>
                      <div className={`text-sm font-medium ${selectedDep.status === 'active' ? 'text-emerald-500' : 'text-amber-500'}`}>
                        {selectedDep.status}
                      </div>
                    </div>
                    <div>
                      <div className={`text-xs ${dark ? "text-slate-500" : "text-slate-400"}`}>Model</div>
                      <div className={`text-sm font-medium ${dark ? "text-slate-200" : "text-slate-800"}`}>
                        {selectedDep.model_name}
                      </div>
                    </div>
                    <div>
                      <div className={`text-xs ${dark ? "text-slate-500" : "text-slate-400"}`}>Device</div>
                      <div className={`text-sm font-medium ${dark ? "text-slate-200" : "text-slate-800"}`}>
                        {selectedDep.device_name}
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
