import { useState, useEffect, useCallback } from "react";
import { useTheme } from "../../App.jsx";

const API = "http://localhost:8000";
const REFRESH_MS = 4000;

function fmtTime(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso.endsWith("Z") ? iso : iso + "Z");
    return d.toLocaleString(undefined, {
      month: "short", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  } catch { return iso; }
}

function prettyType(t) {
  return (t || "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function typeTone(t, dark) {
  const map = {
    person_detected:      dark ? "bg-emerald-500/15 text-emerald-400" : "bg-emerald-50 text-emerald-600",
    person_count_changed: dark ? "bg-amber-500/15 text-amber-400"     : "bg-amber-50 text-amber-600",
  };
  return map[t] || (dark ? "bg-blue-500/15 text-blue-400" : "bg-blue-50 text-blue-600");
}

export default function Events() {
  const { dark } = useTheme();

  const [events, setEvents]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [selected, setSelected] = useState(null);      // event for modal
  const [filterType, setFilterType]     = useState("");
  const [filterCamera, setFilterCamera] = useState("");

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set("limit", "200");
      if (filterType)   params.set("event_type", filterType);
      if (filterCamera) params.set("camera_id", filterCamera);
      const r = await fetch(`${API}/events?${params.toString()}`);
      if (!r.ok) throw new Error(`Server ${r.status}`);
      const data = await r.json();
      setEvents(Array.isArray(data) ? data : []);
      setError("");
    } catch (e) {
      setError(e.message || "Failed to load events");
    } finally {
      setLoading(false);
    }
  }, [filterType, filterCamera]);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    try {
      const r = await fetch(`${API}/events/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error(`Delete failed: ${r.status}`);
      setEvents(prev => prev.filter(ev => ev.id !== id));
      if (selected?.id === id) setSelected(null);
    } catch (err) {
      setError(err.message);
    }
  };

  // Unique type/camera sets for filters
  const types   = [...new Set(events.map(e => e.event_type).filter(Boolean))];
  const cameras = [...new Map(events.filter(e => e.camera_id).map(e => [e.camera_id, e])).values()];

  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className={`text-xl font-bold mb-1 ${dark ? "text-slate-100" : "text-slate-900"}`}>
            Events
          </h1>
          <p className={`text-sm ${dark ? "text-slate-400" : "text-slate-500"}`}>
            Real-time detections captured from deployed inference workers. Auto-refresh every {REFRESH_MS / 1000}s.
          </p>
        </div>
        <div className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border flex-shrink-0 ${
          dark ? "bg-slate-900 border-slate-800 text-slate-400" : "bg-white border-slate-200 text-slate-500"
        }`}>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-dot" />
          {events.length} event{events.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Filters */}
      <div className={`rounded-2xl border px-4 py-3 flex items-center gap-3 flex-wrap ${
        dark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
      }`}>
        <span className={`text-xs font-semibold ${dark ? "text-slate-500" : "text-slate-400"}`}>
          Filter
        </span>

        <select
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className={`text-xs px-2.5 py-1.5 rounded-lg border outline-none ${
            dark ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-white border-slate-200 text-slate-700"
          }`}
        >
          <option value="">All types</option>
          {types.map(t => <option key={t} value={t}>{prettyType(t)}</option>)}
        </select>

        <select
          value={filterCamera}
          onChange={e => setFilterCamera(e.target.value)}
          className={`text-xs px-2.5 py-1.5 rounded-lg border outline-none ${
            dark ? "bg-slate-800 border-slate-700 text-slate-200" : "bg-white border-slate-200 text-slate-700"
          }`}
        >
          <option value="">All cameras</option>
          {cameras.map(c => (
            <option key={c.camera_id} value={c.camera_id}>
              {c.camera_name || `Camera ${c.camera_id}`} (CH {c.channel})
            </option>
          ))}
        </select>

        {(filterType || filterCamera) && (
          <button
            onClick={() => { setFilterType(""); setFilterCamera(""); }}
            className={`text-xs px-2.5 py-1.5 rounded-lg ${
              dark ? "text-slate-400 hover:bg-slate-800" : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            Clear
          </button>
        )}

        <button
          onClick={load}
          className={`ml-auto text-xs px-2.5 py-1.5 rounded-lg ${
            dark ? "text-slate-300 hover:bg-slate-800" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          ↻ Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-sm ${
          dark ? "bg-red-500/10 border-red-900 text-red-400" : "bg-red-50 border-red-200 text-red-600"
        }`}>
          <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && events.length === 0 && !error && (
        <div className={`rounded-2xl border py-16 text-center ${
          dark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
        }`}>
          <div className={`w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center ${
            dark ? "bg-slate-800" : "bg-slate-100"
          }`}>
            <svg className={`w-6 h-6 ${dark ? "text-slate-600" : "text-slate-400"}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          <div className={`text-sm font-medium ${dark ? "text-slate-300" : "text-slate-700"}`}>
            No events yet
          </div>
          <div className={`text-xs mt-1 ${dark ? "text-slate-500" : "text-slate-400"}`}>
            Events will appear here when inference workers detect something.
          </div>
        </div>
      )}

      {/* Event grid */}
      {events.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {events.map(ev => (
            <div
              key={ev.id}
              onClick={() => setSelected(ev)}
              className={`group rounded-xl border overflow-hidden cursor-pointer transition-all ${
                dark
                  ? "bg-slate-900 border-slate-800 hover:border-slate-700"
                  : "bg-white border-slate-200 hover:border-slate-300"
              }`}
            >
              {/* Thumbnail */}
              <div className={`relative aspect-video w-full overflow-hidden ${dark ? "bg-slate-950" : "bg-slate-100"}`}>
                {ev.screenshot_url ? (
                  <img
                    src={`${API}${ev.screenshot_url}`}
                    alt={ev.event_type}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className={`text-xs ${dark ? "text-slate-600" : "text-slate-400"}`}>No screenshot</span>
                  </div>
                )}

                {/* Event-type pill */}
                <span className={`absolute top-2 left-2 text-xs px-2 py-0.5 rounded-full font-medium ${typeTone(ev.event_type, dark)}`}>
                  {prettyType(ev.event_type)}
                </span>

                {/* Delete btn */}
                <button
                  onClick={(e) => handleDelete(ev.id, e)}
                  className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-lg bg-black/60 text-white/80 opacity-0 group-hover:opacity-100 hover:bg-red-500/80 transition-all"
                  title="Delete event"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Meta */}
              <div className="px-3 py-2.5">
                <div className={`text-xs font-semibold truncate ${dark ? "text-slate-200" : "text-slate-800"}`}>
                  {ev.camera_name || `Camera ${ev.camera_id ?? "?"}`}
                </div>
                <div className={`text-xs truncate mt-0.5 ${dark ? "text-slate-500" : "text-slate-400"}`}>
                  {ev.device_name || "—"} · CH {ev.channel ?? 0}
                </div>
                <div className={`text-xs font-mono mt-1.5 ${dark ? "text-slate-500" : "text-slate-400"}`}>
                  {fmtTime(ev.timestamp)}
                </div>
                {ev.details && (
                  <div className={`text-xs truncate mt-1 ${dark ? "text-slate-600" : "text-slate-400"}`}>
                    {ev.details}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {selected && (
        <div
          onClick={() => setSelected(null)}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-6"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`max-w-4xl w-full rounded-2xl border overflow-hidden ${
              dark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
            }`}
          >
            <div className={`flex items-center justify-between px-5 py-3 border-b ${dark ? "border-slate-800" : "border-slate-200"}`}>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${typeTone(selected.event_type, dark)}`}>
                  {prettyType(selected.event_type)}
                </span>
                <span className={`text-sm font-semibold ${dark ? "text-slate-200" : "text-slate-800"}`}>
                  {selected.camera_name || `Camera ${selected.camera_id}`}
                </span>
              </div>
              <button
                onClick={() => setSelected(null)}
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  dark ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-100 text-slate-500"
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className={`w-full bg-black flex items-center justify-center`} style={{ maxHeight: "65vh" }}>
              {selected.screenshot_url ? (
                <img
                  src={`${API}${selected.screenshot_url}`}
                  alt={selected.event_type}
                  className="w-full h-auto object-contain"
                  style={{ maxHeight: "65vh" }}
                />
              ) : (
                <div className="py-20 text-slate-500 text-sm">No screenshot available</div>
              )}
            </div>

            <div className={`px-5 py-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm`}>
              {[
                ["Device",     selected.device_name || "—"],
                ["Camera",     selected.camera_name || "—"],
                ["Channel",    `CH ${selected.channel ?? 0}`],
                ["Timestamp",  fmtTime(selected.timestamp)],
              ].map(([k, v]) => (
                <div key={k}>
                  <div className={`text-xs ${dark ? "text-slate-500" : "text-slate-400"}`}>{k}</div>
                  <div className={`font-medium ${dark ? "text-slate-200" : "text-slate-800"}`}>{v}</div>
                </div>
              ))}
              {selected.details && (
                <div className="col-span-2 md:col-span-4">
                  <div className={`text-xs ${dark ? "text-slate-500" : "text-slate-400"}`}>Details</div>
                  <div className={`font-mono text-xs mt-0.5 ${dark ? "text-slate-300" : "text-slate-700"}`}>
                    {selected.details}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
