import { useState } from "react";
import { useTheme } from "../App.jsx";

// ── Navigation icon components ────────────────────────────────────────────────
const Icons = {
  overview: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  streams: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
    </svg>
  ),
  models: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
    </svg>
  ),
  deploy: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
  ),
  devices: () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9 3H5a2 2 0 00-2 2v14a2 2 0 002 2h4m6-18h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M9 3v18M9 12h6" />
    </svg>
  ),
  dvr: () => (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
      <rect x="2" y="7" width="20" height="10" rx="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12h6" />
    </svg>
  ),
  plus: () => (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  ),
  close: () => (
    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
};

// ── Nav item ──────────────────────────────────────────────────────────────────
function NavItem({ id, label, icon: Icon, badge, active, onClick }) {
  const { dark } = useTheme();

  return (
    <button
      onClick={() => onClick(id)}
      className={`
        relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm
        font-medium transition-all text-left outline-none group
        ${active
          ? dark
            ? "bg-blue-600/15 text-blue-400"
            : "bg-blue-50 text-blue-700"
          : dark
            ? "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        }
      `}
    >
      {/* Active indicator bar */}
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full bg-blue-500" />
      )}

      {/* Icon container */}
      <span className={`
        w-7 h-7 flex-shrink-0 flex items-center justify-center rounded-lg
        ${active
          ? dark ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-600"
          : dark ? "bg-slate-800 text-slate-500 group-hover:bg-slate-700 group-hover:text-slate-300"
                 : "bg-slate-100 text-slate-400 group-hover:bg-slate-200 group-hover:text-slate-600"
        }
      `}>
        <Icon />
      </span>

      <span className="flex-1 truncate">{label}</span>

      {badge != null && badge > 0 && (
        <span className={`
          text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0
          ${active
            ? dark ? "bg-blue-500/25 text-blue-300" : "bg-blue-100 text-blue-600"
            : dark ? "bg-slate-700 text-slate-400" : "bg-slate-200 text-slate-500"
          }
        `}>
          {badge}
        </span>
      )}
    </button>
  );
}

// ── Device list item ──────────────────────────────────────────────────────────
function DeviceItem({ device, isSelected, onSelect, onRemove, liveCount }) {
  const { dark }           = useTheme();
  const [hovered, setHov]  = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(device.device_id)}
      onKeyDown={e => e.key === "Enter" && onSelect(device.device_id)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      className={`
        group relative flex items-center gap-2.5 px-3 py-2 rounded-xl cursor-pointer
        select-none outline-none text-sm transition-colors
        ${isSelected
          ? dark ? "bg-blue-600/12 text-blue-300" : "bg-blue-50 text-blue-700"
          : dark ? "hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                 : "hover:bg-slate-100 text-slate-500 hover:text-slate-700"
        }
      `}
    >
      {/* Device type icon */}
      <span className={`
        w-7 h-7 flex-shrink-0 rounded-lg flex items-center justify-center
        ${isSelected
          ? dark ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-600"
          : dark ? "bg-slate-800 text-slate-500" : "bg-slate-100 text-slate-400"
        }
      `}>
        <Icons.dvr />
      </span>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className={`text-xs font-semibold truncate ${
          isSelected
            ? dark ? "text-blue-300" : "text-blue-700"
            : dark ? "text-slate-200" : "text-slate-700"
        }`}>
          {device.name}
        </div>
        <div className={`text-xs font-mono truncate mt-0.5 ${dark ? "text-slate-600" : "text-slate-400"}`}>
          {device.dvr_ip}
        </div>
      </div>

      {/* Live badge / remove btn */}
      {hovered ? (
        <button
          onClick={e => { e.stopPropagation(); onRemove(device.device_id); }}
          className={`
            w-5 h-5 flex-shrink-0 rounded flex items-center justify-center
            ${dark ? "bg-red-500/15 hover:bg-red-500/30 text-red-400" : "bg-red-50 hover:bg-red-100 text-red-500"}
          `}
        >
          <Icons.close />
        </button>
      ) : liveCount != null && liveCount > 0 ? (
        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
          dark ? "bg-emerald-500/15 text-emerald-400" : "bg-emerald-50 text-emerald-600"
        }`}>
          {liveCount}
        </span>
      ) : null}
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
const NAV = [
  { id: "overview", label: "Overview",    icon: Icons.overview },
  { id: "streams",  label: "Streams",     icon: Icons.streams  },
  { id: "models",   label: "ML Models",   icon: Icons.models   },
  { id: "deploy",   label: "Deploy",      icon: Icons.deploy   },
  { id: "devices",  label: "Devices",     icon: Icons.devices  },
];

export default function Sidebar({
  view, setView,
  devices, selectedId, onSelect, onRemove,
  streamsCache, modelCount, liveStreams,
}) {
  const { dark } = useTheme();

  const badges = {
    streams: liveStreams > 0 ? liveStreams : null,
    models:  modelCount  > 0 ? modelCount  : null,
    devices: devices.length > 0 ? devices.length : null,
  };

  return (
    <aside className={`
      w-60 flex-shrink-0 flex flex-col overflow-hidden border-r
      ${dark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"}
    `}>
      {/* Brand */}
      <div className={`h-12 flex items-center gap-3 px-4 border-b flex-shrink-0 ${
        dark ? "border-slate-800" : "border-slate-200"
      }`}>
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/20">
          <svg className="w-4.5 h-4.5 text-white" fill="currentColor" viewBox="0 0 20 20" style={{width:"18px",height:"18px"}}>
            <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
            <path fillRule="evenodd"
              d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z"
              clipRule="evenodd" />
          </svg>
        </div>
        <div>
          <div className={`text-sm font-bold leading-none tracking-tight ${dark ? "text-slate-100" : "text-slate-900"}`}>
            Vision AI
          </div>
          <div className={`text-xs leading-none mt-0.5 ${dark ? "text-slate-500" : "text-slate-400"}`}>
            Platform
          </div>
        </div>
      </div>

      {/* Main navigation */}
      <div className="px-2 pt-3 pb-2 flex-shrink-0 space-y-0.5">
        {NAV.map(item => (
          <NavItem
            key={item.id}
            {...item}
            badge={badges[item.id]}
            active={view === item.id}
            onClick={setView}
          />
        ))}
      </div>

      {/* Divider */}
      <div className={`mx-4 my-1 h-px ${dark ? "bg-slate-800" : "bg-slate-100"}`} />

      {/* Devices section */}
      <div className="flex-shrink-0 px-4 pt-3 pb-1 flex items-center justify-between">
        <span className={`text-xs font-semibold uppercase tracking-wider ${
          dark ? "text-slate-600" : "text-slate-400"
        }`}>
          Connected
        </span>
        <button
          onClick={() => setView("devices")}
          title="Add device"
          className={`w-5 h-5 rounded flex items-center justify-center ${
            dark ? "text-slate-500 hover:text-slate-300 hover:bg-slate-700" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Icons.plus />
        </button>
      </div>

      {/* Device list */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {devices.length === 0 ? (
          <div className={`px-3 py-4 text-center ${dark ? "text-slate-700" : "text-slate-300"}`}>
            <div className={`w-8 h-8 rounded-lg mx-auto mb-2 flex items-center justify-center ${
              dark ? "bg-slate-800" : "bg-slate-100"
            }`}>
              <Icons.dvr />
            </div>
            <p className={`text-xs ${dark ? "text-slate-600" : "text-slate-400"}`}>No devices</p>
            <button
              onClick={() => setView("devices")}
              className={`text-xs mt-1 ${dark ? "text-blue-400 hover:text-blue-300" : "text-blue-500 hover:text-blue-600"}`}
            >
              Add one →
            </button>
          </div>
        ) : (
          <div className="space-y-0.5">
            {devices.map(device => (
              <DeviceItem
                key={device.device_id}
                device={device}
                isSelected={device.device_id === selectedId}
                onSelect={onSelect}
                onRemove={onRemove}
                liveCount={streamsCache[device.device_id]?.data?.length ?? null}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={`px-4 py-3 border-t flex items-center gap-2 flex-shrink-0 ${
        dark ? "border-slate-800" : "border-slate-200"
      }`}>
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
          A
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-xs font-medium truncate ${dark ? "text-slate-300" : "text-slate-700"}`}>
            Admin
          </div>
        </div>
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
      </div>
    </aside>
  );
}
