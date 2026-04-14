import { useState, useEffect, useCallback, createContext, useContext } from "react";
import Sidebar     from "./components/Sidebar.jsx";
import Overview    from "./components/views/Overview.jsx";
import StreamsView from "./components/views/StreamsView.jsx";
import MLModels    from "./components/views/MLModels.jsx";
import Deploy      from "./components/views/Deploy.jsx";
import Devices     from "./components/views/Devices.jsx";

// ── Theme context ─────────────────────────────────────────────────────────────
export const ThemeCtx = createContext({ dark: true, toggle: () => {} });
export const useTheme = () => useContext(ThemeCtx);

// ── Header icons ──────────────────────────────────────────────────────────────
const SunIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);
const MoonIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round"
      d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
  </svg>
);

// ── Top header bar ────────────────────────────────────────────────────────────
function Header({ view, selectedDevice }) {
  const { dark, toggle } = useTheme();
  const labels = {
    overview: "Overview",
    streams: "Live Streams",
    models: "ML Models",
    deploy: "Deploy",
    devices: "Devices",
  };

  return (
    <header className={`
      h-12 flex items-center justify-between px-6 border-b flex-shrink-0 glass
      ${dark ? "bg-slate-950/80 border-slate-800" : "bg-white/80 border-slate-200"}
    `}>
      <div className="flex items-center gap-2 text-sm">
        <span className={`font-semibold tracking-tight ${dark ? "text-slate-100" : "text-slate-900"}`}>
          Vision AI
        </span>
        <svg className={`w-3.5 h-3.5 flex-shrink-0 ${dark ? "text-slate-600" : "text-slate-400"}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        <span className={dark ? "text-slate-400" : "text-slate-500"}>{labels[view] ?? view}</span>
        {selectedDevice && view === "streams" && (
          <>
            <svg className={`w-3.5 h-3.5 flex-shrink-0 ${dark ? "text-slate-600" : "text-slate-400"}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <span className={`font-medium ${dark ? "text-slate-200" : "text-slate-700"}`}>
              {selectedDevice.name}
            </span>
            <code className={`text-xs px-1.5 py-0.5 rounded-md font-mono ${
              dark ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500"
            }`}>{selectedDevice.dvr_ip}</code>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
          dark
            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
            : "bg-emerald-50 border-emerald-200 text-emerald-600"
        }`}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-dot" />
          API Online
        </div>
        <button
          onClick={toggle}
          aria-label="Toggle theme"
          className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            dark
              ? "bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200"
              : "bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700"
          }`}
        >
          {dark ? <SunIcon /> : <MoonIcon />}
        </button>
      </div>
    </header>
  );
}

// ── Root App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [dark,         setDark]         = useState(true);
  const [view,         setView]         = useState("overview");
  const [devices,      setDevices]      = useState([]);
  const [selected,     setSelected]     = useState(null);   // device_id
  const [streamsCache, setStreamsCache] = useState({});
  const [models,       setModels]       = useState([]);
  const [deployments,  setDeployments]  = useState([]);

  const toggle = useCallback(() => setDark(d => !d), []);

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      fetch("http://localhost:8000/devices").then(r => r.json()).catch(() => []),
      fetch("http://localhost:8000/models").then(r => r.json()).catch(() => []),
      fetch("http://localhost:8000/deployments").then(r => r.json()).catch(() => []),
    ]).then(([dr, mr, depr]) => {
      if (Array.isArray(dr))   setDevices(dr);
      if (Array.isArray(mr))   setModels(mr);
      if (Array.isArray(depr)) setDeployments(depr);
    });
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────
  const selectedDevice = devices.find(d => d.device_id === selected) ?? null;
  const totalLive      = Object.values(streamsCache)
    .reduce((n, c) => n + (c?.data?.length ?? 0), 0);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleDeviceAdded = useCallback((device) => {
    setDevices(prev => [...prev, device]);
    setSelected(device.device_id);
    setView("streams");
  }, []);

  const handleRemoveDevice = useCallback(async (deviceId) => {
    setDevices(prev => prev.filter(d => d.device_id !== deviceId));
    setStreamsCache(prev => { const n = { ...prev }; delete n[deviceId]; return n; });
    if (selected === deviceId) setSelected(null);
    try { await fetch(`/devices/${deviceId}`, { method: "DELETE" }); } catch {}
  }, [selected]);

  const handleSelectDevice = useCallback((deviceId) => {
    setSelected(deviceId);
    setView("streams");
  }, []);

  const updateCache = useCallback((deviceId, patch) => {
    setStreamsCache(prev => ({
      ...prev,
      [deviceId]: { ...(prev[deviceId] ?? {}), ...patch },
    }));
  }, []);

  const handleModelAdded   = useCallback(m  => setModels(p => [...p, m]),  []);
  const handleModelDeleted = useCallback(id => {
    setModels(p => p.filter(m => m.id !== id));
    // Also remove deployments that used this model (they were cascade-deleted on backend)
    setDeployments(p => p.filter(d => d.model_id !== id));
  }, []);
  const handleDepAdded     = useCallback(d  => setDeployments(p => [...p, d]),  []);
  const handleDepDeleted   = useCallback(id => setDeployments(p => p.filter(d => d.id !== id)), []);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <ThemeCtx.Provider value={{ dark, toggle }}>
      <div className={dark ? "dark" : ""}>
        <div className={`flex h-screen overflow-hidden ${
          dark ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"
        }`}>

          <Sidebar
            view={view}
            setView={setView}
            devices={devices}
            selectedId={selected}
            onSelect={handleSelectDevice}
            onRemove={handleRemoveDevice}
            streamsCache={streamsCache}
            modelCount={models.length}
            liveStreams={totalLive}
          />

          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <Header view={view} selectedDevice={selectedDevice} />

            <main className="flex-1 overflow-y-auto">
              <div className="p-6 animate-fade-in" key={view + (selected ?? "")}>

                {view === "overview" && (
                  <Overview
                    devices={devices}
                    models={models}
                    deployments={deployments}
                    streamsCache={streamsCache}
                    onNavigate={setView}
                    onSelectDevice={(id) => { setSelected(id); setView("streams"); }}
                  />
                )}

                {view === "streams" && (
                  <StreamsView
                    devices={devices}
                    selected={selected}
                    onSelectDevice={handleSelectDevice}
                    streamsCache={streamsCache}
                    updateCache={updateCache}
                    models={models}
                    deployments={deployments}
                  />
                )}

                {view === "models" && (
                  <MLModels
                    models={models}
                    onAdded={handleModelAdded}
                    onDeleted={handleModelDeleted}
                  />
                )}

                {view === "deploy" && (
                  <Deploy
                    devices={devices}
                    models={models}
                    deployments={deployments}
                    streamsCache={streamsCache}
                    onDeployed={handleDepAdded}
                    onRemoved={handleDepDeleted}
                  />
                )}

                {view === "devices" && (
                  <Devices
                    devices={devices}
                    onAdded={handleDeviceAdded}
                    onRemoved={handleRemoveDevice}
                    streamsCache={streamsCache}
                    deployments={deployments}
                  />
                )}

              </div>
            </main>
          </div>

        </div>
      </div>
    </ThemeCtx.Provider>
  );
}
