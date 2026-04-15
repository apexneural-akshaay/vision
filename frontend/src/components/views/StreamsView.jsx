import { useState, useEffect, useCallback } from "react";
import { useTheme } from "../../App.jsx";

// ── Stream card ───────────────────────────────────────────────────────────────
function StreamCard({ stream, onClick, modelName }) {
  const { dark }          = useTheme();
  const [errored, setErr] = useState(false);

  useEffect(() => { setErr(false); }, [stream.proxy_url]);

  return (
    <div
      onClick={() => onClick(stream)}
      className={`group relative rounded-2xl overflow-hidden cursor-pointer border transition-all hover:scale-[1.015] hover:shadow-lg ${
        dark
          ? "border-slate-700 hover:border-blue-500/50 hover:shadow-blue-500/10"
          : "border-slate-200 hover:border-blue-400/50 hover:shadow-blue-500/10"
      }`}
    >
      {/* Video / offline placeholder */}
      <div className="aspect-video bg-black relative overflow-hidden">
        {!errored ? (
          <img
            data-no-transition
            src={stream.proxy_url}
            alt={stream.label}
            className="w-full h-full object-cover"
            onError={() => setErr(true)}
          />
        ) : (
          <div
            className="w-full h-full flex flex-col items-center justify-center"
            style={{
              backgroundImage:
                "repeating-linear-gradient(0deg,transparent,transparent 31px,rgba(255,255,255,0.025) 32px)," +
                "repeating-linear-gradient(90deg,transparent,transparent 31px,rgba(255,255,255,0.025) 32px)",
            }}
          >
            <svg className="w-7 h-7 text-slate-700 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
            </svg>
            <span className="text-xs font-mono text-slate-600">Connecting…</span>
          </div>
        )}

        {/* LIVE badge */}
        <div className="absolute top-2 left-2 flex gap-1.5 items-center">
          <span className="flex items-center gap-1 bg-red-600 text-white text-xs px-1.5 py-0.5 rounded-md font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse-dot" />
            LIVE
          </span>
          {modelName && (
            <span className="bg-black/60 text-cyan-400 text-xs px-1.5 py-0.5 rounded-md font-mono backdrop-blur-sm">
              {modelName.split(" ").slice(0, 2).join(" ")}
            </span>
          )}
        </div>

        {/* Resolution */}
        {stream.resolution && (
          <div className="absolute top-2 right-2">
            <span className="bg-black/60 text-slate-300 text-xs px-1.5 py-0.5 rounded-md font-mono backdrop-blur-sm">
              {stream.resolution}
            </span>
          </div>
        )}

        {/* Expand overlay on hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/25">
          <div className="bg-black/60 text-white rounded-xl p-2.5 backdrop-blur-sm">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M4 8V4m0 0h4M4 4l5 5m11-5h-4m4 0v4m0-4l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </div>
        </div>
      </div>

      {/* Label row */}
      <div className={`px-3 py-2.5 flex items-center justify-between ${dark ? "bg-slate-900" : "bg-white"}`}>
        <span className={`text-xs font-semibold ${dark ? "text-slate-200" : "text-slate-700"}`}>
          {stream.label}
        </span>
        <span className={`text-xs font-mono ${dark ? "text-slate-600" : "text-slate-400"}`}>
          CH {stream.channel}
        </span>
      </div>
    </div>
  );
}

// ── Fullscreen modal ──────────────────────────────────────────────────────────
function StreamModal({ stream, onClose, modelName }) {
  const { dark } = useTheme();

  useEffect(() => {
    const onKey = e => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-5xl rounded-2xl overflow-hidden border shadow-2xl ${
          dark ? "border-slate-700 bg-slate-950" : "border-slate-200 bg-white"
        }`}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className={`flex items-center justify-between px-5 py-3.5 border-b ${dark ? "border-slate-800" : "border-slate-200"}`}>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 bg-red-600 text-white text-xs px-2 py-1 rounded-md font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse-dot" />
              LIVE
            </span>
            <span className={`font-semibold text-sm ${dark ? "text-slate-100" : "text-slate-900"}`}>
              {stream.label}
            </span>
            {stream.resolution && (
              <code className={`text-xs px-1.5 py-0.5 rounded-md font-mono ${
                dark ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500"
              }`}>{stream.resolution}</code>
            )}
            {modelName && (
              <span className={`text-xs px-2 py-0.5 rounded-md font-mono ${
                dark ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/20" : "bg-cyan-50 text-cyan-600 border border-cyan-200"
              }`}>{modelName}</span>
            )}
          </div>
          <button
            onClick={onClose}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${
              dark ? "hover:bg-slate-800 text-slate-400 hover:text-slate-200" : "hover:bg-slate-100 text-slate-500"
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Video */}
        <div className="aspect-video bg-black">
          <img
            data-no-transition
            src={stream.proxy_url}
            alt={stream.label}
            className="w-full h-full object-contain"
          />
        </div>

        {/* Footer */}
        <div className={`px-5 py-3 border-t ${dark ? "border-slate-800" : "border-slate-100"}`}>
          <code className={`text-xs font-mono truncate block ${dark ? "text-slate-600" : "text-slate-400"}`}>
            {stream.rtsp_url}
          </code>
        </div>
      </div>
    </div>
  );
}

// ── Skeleton grid ─────────────────────────────────────────────────────────────
function SkeletonGrid({ count = 8 }) {
  const { dark } = useTheme();
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`rounded-2xl overflow-hidden border ${dark ? "border-slate-800" : "border-slate-200"}`}>
          <div className={`aspect-video skeleton`} />
          <div className={`px-3 py-2.5 ${dark ? "bg-slate-900" : "bg-white"}`}>
            <div className={`h-3 w-20 rounded skeleton`} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Stat pill ─────────────────────────────────────────────────────────────────
function StatPill({ value, label, color }) {
  const { dark } = useTheme();
  return (
    <div className={`rounded-xl border px-4 py-3 flex-1 ${dark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-white"}`}>
      <div className="text-xl font-bold" style={{ color }}>{value}</div>
      <div className={`text-xs mt-0.5 ${dark ? "text-slate-500" : "text-slate-400"}`}>{label}</div>
    </div>
  );
}

// ── Device selector tabs ──────────────────────────────────────────────────────
function DeviceTabs({ devices, selected, onSelect, streamsCache }) {
  const { dark } = useTheme();

  if (devices.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
      {devices.map(d => {
        const live = streamsCache[d.device_id]?.data?.length ?? 0;
        const active = d.device_id === selected;
        return (
          <button
            key={d.device_id}
            onClick={() => onSelect(d.device_id)}
            className={`flex-shrink-0 flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-medium transition-all ${
              active
                ? "bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/20"
                : dark
                  ? "bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                  : "bg-white border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${live > 0 ? "bg-emerald-400" : "bg-slate-500"}`} />
            <span className="truncate max-w-[120px]">{d.name}</span>
            {live > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${
                active ? "bg-white/20 text-white" : dark ? "bg-emerald-500/15 text-emerald-400" : "bg-emerald-50 text-emerald-600"
              }`}>{live}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ── Streams view ──────────────────────────────────────────────────────────────
export default function StreamsView({
  devices, selected, onSelectDevice,
  streamsCache, updateCache,
  models, deployments,
}) {
  const { dark }          = useTheme();
  const [focusStream, setFocus] = useState(null);
  const [layout,      setLayout] = useState("grid");   // "grid" | "list"
  const [filter,      setFilter] = useState("all");    // "all" | "live" | "offline"

  const selectedDevice = devices.find(d => d.device_id === selected) ?? null;
  const cache = selectedDevice ? (streamsCache[selected] ?? {}) : {};
  const { loading = false, error = null, data: streams = [] } = cache;

  // Auto-select first device if none selected
  useEffect(() => {
    if (!selected && devices.length > 0) {
      onSelectDevice(devices[0].device_id);
    }
  }, [devices]);

  // Fast initial load: read known cameras from DB (no RTSP probing)
  const loadCameraList = useCallback(async () => {
    if (!selected) return;
    try {
      const res = await fetch(`/cameras?device_id=${selected}`);
      if (!res.ok) return;
      const cams = await res.json();
      if (cams.length === 0) return;
      // Map camera DB records to stream format with camera_id
      const streams = cams.map(c => ({
        camera_id:  c.id,
        channel:    c.channel,
        label:      c.name,
        rtsp_url:   c.rtsp_url,
        proxy_url:  c.proxy_url,  // /stream/{id}
        status:     c.status ?? "live",
        resolution: c.resolution ?? "",
      }));
      updateCache(selected, { loading: false, error: null, data: streams });
    } catch {}
  }, [selected, updateCache]);

  // Full discovery: scan all channels (2-5 s RTSP probing), save to DB, start grabbers
  const fetchStreams = useCallback(async () => {
    if (!selected) return;
    updateCache(selected, { loading: true, error: null });
    try {
      const res  = await fetch(`/devices/${selected}/streams`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.detail ?? "Failed to fetch streams");
      updateCache(selected, { loading: false, data: body.streams });
    } catch (err) {
      updateCache(selected, { loading: false, error: err.message });
    }
  }, [selected, updateCache]);

  // Auto-load on first visit: fast DB read (no RTSP probing).
  // Grabbers already running from backend boot or previous scan.
  // Use "Rescan" button if no cameras appear (first time for a new device).
  useEffect(() => {
    if (selected && !cache.data && !cache.loading) {
      loadCameraList();
    }
  }, [selected, loadCameraList, cache.data, cache.loading]);

  // Derived
  const liveStreams    = streams.filter(s => s.status === "live");
  const offlineStreams = streams.filter(s => s.status !== "live");
  const visible = filter === "live" ? liveStreams : filter === "offline" ? offlineStreams : streams;

  // Get model name for a stream
  const getModelName = (stream) => {
    const dep = deployments.find(d => d.camera_name === stream.label);
    if (!dep) return null;
    return dep.model_name ?? null;
  };

  // ── No devices state ──────────────────────────────────────────────────────
  if (devices.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center py-24 rounded-2xl border border-dashed ${
        dark ? "border-slate-800 text-slate-600" : "border-slate-200 text-slate-400"
      }`}>
        <svg className="w-10 h-10 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
        </svg>
        <p className="text-sm mb-1">No devices registered</p>
        <p className={`text-xs ${dark ? "text-slate-700" : "text-slate-400"}`}>
          Add a DVR device first to see live streams.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* Device selector */}
      <DeviceTabs
        devices={devices}
        selected={selected}
        onSelect={onSelectDevice}
        streamsCache={streamsCache}
      />

      {/* Header row */}
      {selectedDevice && (
        <div className="flex items-start justify-between">
          <div>
            <h1 className={`text-lg font-bold mb-0.5 ${dark ? "text-slate-100" : "text-slate-900"}`}>
              {selectedDevice.name}
            </h1>
            <p className={`text-sm ${dark ? "text-slate-400" : "text-slate-500"}`}>
              <code className="font-mono">{selectedDevice.dvr_ip}:{selectedDevice.rtsp_port ?? 554}</code>
              {" · "}
              {loading
                ? "Scanning channels…"
                : streams.length > 0
                  ? `${liveStreams.length} live stream${liveStreams.length !== 1 ? "s" : ""}`
                  : "No streams found"
              }
            </p>
          </div>

          <button
            onClick={fetchStreams}
            disabled={loading}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-colors disabled:opacity-50 ${
              dark
                ? "border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600 hover:bg-slate-700"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <svg className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {loading ? "Scanning…" : "Rescan"}
          </button>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className={`px-4 py-3 rounded-xl border text-sm ${
          dark ? "bg-red-500/10 border-red-900 text-red-400" : "bg-red-50 border-red-200 text-red-600"
        }`}>
          {error}
        </div>
      )}

      {/* Loading banner */}
      {loading && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
          dark ? "bg-blue-500/8 border-blue-900 text-blue-400" : "bg-blue-50 border-blue-200 text-blue-600"
        }`}>
          <svg className="w-4 h-4 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span className="text-sm">
            Probing channels in parallel — only live, non-black streams shown. Usually 2–5 s.
          </span>
        </div>
      )}

      {/* Stats row */}
      {!loading && streams.length > 0 && (
        <div className="flex gap-3">
          <StatPill value={streams.length}       label="Detected"       color="#3b82f6" />
          <StatPill value={liveStreams.length}    label="Live"           color="#10b981" />
          <StatPill value={offlineStreams.length} label="Filtered out"   color="#64748b" />
        </div>
      )}

      {/* Skeleton */}
      {loading && !streams.length && <SkeletonGrid count={8} />}

      {/* Filter + layout controls */}
      {!loading && streams.length > 0 && (
        <div className="flex items-center justify-between">
          {/* Filter tabs */}
          <div className={`flex gap-0.5 p-1 rounded-xl border ${dark ? "bg-slate-900 border-slate-800" : "bg-slate-100 border-slate-200"}`}>
            {[
              { id: "all",     label: `All · ${streams.length}` },
              { id: "live",    label: `Live · ${liveStreams.length}` },
              { id: "offline", label: `Filtered · ${offlineStreams.length}` },
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filter === f.id
                    ? dark ? "bg-slate-700 text-slate-100" : "bg-white text-slate-800 shadow-sm"
                    : dark ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-slate-600"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Layout toggle */}
          <div className={`flex gap-0.5 p-1 rounded-xl border ${dark ? "bg-slate-900 border-slate-800" : "bg-slate-100 border-slate-200"}`}>
            {[
              { id: "grid", icon: (
                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M1 2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 01-1 1H2a1 1 0 01-1-1V2zm5 0a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 01-1 1H7a1 1 0 01-1-1V2zm5 0a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 01-1 1h-2a1 1 0 01-1-1V2zM1 7a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 01-1 1H2a1 1 0 01-1-1V7zm5 0a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 01-1 1H7a1 1 0 01-1-1V7zm5 0a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 01-1 1h-2a1 1 0 01-1-1V7z" />
                </svg>
              )},
              { id: "list", icon: (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )},
            ].map(l => (
              <button
                key={l.id}
                onClick={() => setLayout(l.id)}
                className={`p-1.5 rounded-lg transition-colors ${
                  layout === l.id
                    ? dark ? "bg-slate-700 text-slate-100" : "bg-white text-slate-800 shadow-sm"
                    : dark ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-slate-600"
                }`}
              >
                {l.icon}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Grid view */}
      {!loading && visible.length > 0 && layout === "grid" && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {visible.map(stream => (
            <StreamCard
              key={stream.channel}
              stream={stream}
              onClick={setFocus}
              modelName={getModelName(stream)}
            />
          ))}
        </div>
      )}

      {/* List view */}
      {!loading && visible.length > 0 && layout === "list" && (
        <div className="space-y-2">
          {visible.map(stream => (
            <div
              key={stream.channel}
              onClick={() => setFocus(stream)}
              className={`flex items-center gap-4 px-4 py-3 rounded-xl border cursor-pointer transition-colors ${
                dark
                  ? "bg-slate-900 border-slate-800 hover:border-slate-700"
                  : "bg-white border-slate-200 hover:border-slate-300"
              }`}
            >
              <div className="w-28 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-black relative">
                <img data-no-transition src={stream.proxy_url} alt={stream.label}
                  className="w-full h-full object-cover" onError={() => {}} />
                <span className="absolute top-1 left-1 bg-red-600 text-white text-xs px-1 py-0.5 rounded flex items-center gap-0.5 font-medium">
                  <span className="w-1 h-1 rounded-full bg-white animate-pulse-dot" />LIVE
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-semibold ${dark ? "text-slate-200" : "text-slate-800"}`}>
                  {stream.label}
                </div>
                <code className={`text-xs font-mono truncate block mt-0.5 ${dark ? "text-slate-600" : "text-slate-400"}`}>
                  {stream.rtsp_url}
                </code>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {stream.resolution && (
                  <code className={`text-xs font-mono ${dark ? "text-slate-500" : "text-slate-400"}`}>
                    {stream.resolution}
                  </code>
                )}
                {getModelName(stream) && (
                  <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                    dark ? "bg-cyan-500/15 text-cyan-400" : "bg-cyan-50 text-cyan-600"
                  }`}>
                    {getModelName(stream)?.split(" ")[0]}
                  </span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  dark ? "bg-emerald-500/15 text-emerald-400" : "bg-emerald-50 text-emerald-600"
                }`}>Live</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && streams.length === 0 && selected && (
        <div className={`flex flex-col items-center justify-center py-20 rounded-2xl border border-dashed ${
          dark ? "border-slate-800 text-slate-600" : "border-slate-200 text-slate-400"
        }`}>
          <svg className="w-10 h-10 mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round"
              d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
          </svg>
          <p className="text-sm mb-1">No live streams found</p>
          <p className={`text-xs mb-4 max-w-xs text-center ${dark ? "text-slate-700" : "text-slate-400"}`}>
            All channels returned black frames or timed out. Check the DVR is reachable and cameras are powered on.
          </p>
          <button onClick={fetchStreams} className="text-sm text-blue-500 hover:text-blue-400">
            Try scanning again →
          </button>
        </div>
      )}

      {/* Fullscreen modal */}
      {focusStream && (
        <StreamModal
          stream={focusStream}
          onClose={() => setFocus(null)}
          modelName={getModelName(focusStream)}
        />
      )}

    </div>
  );
}
