import { useState } from "react";
import { useTheme } from "../../App.jsx";
import AddDeviceForm from "../AddDeviceForm.jsx";

// ── DVR icon ──────────────────────────────────────────────────────────────────
const DvrIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
    <rect x="2" y="7" width="20" height="10" rx="2" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12h6" />
  </svg>
);

// ── Badge ─────────────────────────────────────────────────────────────────────
function Badge({ label, color }) {
  const map = {
    green:  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
    amber:  "bg-amber-100  text-amber-700  dark:bg-amber-500/15  dark:text-amber-400",
    gray:   "bg-slate-100  text-slate-600  dark:bg-slate-700     dark:text-slate-400",
    blue:   "bg-blue-100   text-blue-700   dark:bg-blue-500/15   dark:text-blue-400",
    violet: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400",
  };
  return (
    <span className={`inline-flex text-xs px-2 py-0.5 rounded-full font-medium ${map[color] ?? map.gray}`}>
      {label}
    </span>
  );
}

// ── Device card ───────────────────────────────────────────────────────────────
function DeviceCard({ device, liveCount, deploymentCount, onRemove }) {
  const { dark } = useTheme();
  const [confirmRemove, setConfirm] = useState(false);

  return (
    <div className={`rounded-2xl border p-5 flex flex-col gap-4 ${
      dark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
    }`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            dark ? "bg-blue-500/15 text-blue-400" : "bg-blue-50 text-blue-600"
          }`}>
            <DvrIcon />
          </div>
          <div>
            <div className={`font-semibold text-sm ${dark ? "text-slate-100" : "text-slate-900"}`}>
              {device.name}
            </div>
            <code className={`text-xs font-mono ${dark ? "text-slate-500" : "text-slate-400"}`}>
              {device.dvr_ip}:{device.rtsp_port ?? 554}
            </code>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge label={device.device_type ?? "DVR"} color="blue" />
          {liveCount > 0
            ? <Badge label={`${liveCount} live`} color="green" />
            : <Badge label="Idle" color="gray" />
          }
        </div>
      </div>

      {/* Stats row */}
      <div className={`grid grid-cols-3 gap-3 text-center rounded-xl p-3 ${
        dark ? "bg-slate-800/50" : "bg-slate-50"
      }`}>
        {[
          ["Channels", liveCount, "#10b981"],
          ["Deployments", deploymentCount, "#8b5cf6"],
          ["RTSP Port", device.rtsp_port ?? 554, "#3b82f6"],
        ].map(([label, val, color]) => (
          <div key={label}>
            <div className="text-base font-bold" style={{ color }}>{val}</div>
            <div className={`text-xs mt-0.5 ${dark ? "text-slate-500" : "text-slate-400"}`}>{label}</div>
          </div>
        ))}
      </div>

      {/* Footer actions */}
      <div className="flex items-center gap-2">
        {!confirmRemove ? (
          <button
            onClick={() => setConfirm(true)}
            className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-colors ${
              dark
                ? "border-red-900/50 text-red-400 hover:bg-red-500/10 hover:border-red-800"
                : "border-red-200 text-red-500 hover:bg-red-50 hover:border-red-300"
            }`}
          >
            Remove Device
          </button>
        ) : (
          <div className="flex-1 flex gap-2">
            <button
              onClick={() => onRemove(device.device_id)}
              className="flex-1 py-2 rounded-xl text-xs font-medium bg-red-600 hover:bg-red-500 text-white transition-colors"
            >
              Confirm Remove
            </button>
            <button
              onClick={() => setConfirm(false)}
              className={`flex-1 py-2 rounded-xl text-xs font-medium border transition-colors ${
                dark ? "border-slate-700 text-slate-400 hover:bg-slate-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyDevices({ onAdd }) {
  const { dark } = useTheme();
  return (
    <div className={`flex flex-col items-center justify-center py-20 rounded-2xl border border-dashed ${
      dark ? "border-slate-800 text-slate-600" : "border-slate-200 text-slate-400"
    }`}>
      <div className={`w-14 h-14 rounded-2xl mb-4 flex items-center justify-center ${
        dark ? "bg-slate-800" : "bg-slate-100"
      }`}>
        <DvrIcon className="w-7 h-7" />
      </div>
      <p className={`text-sm font-medium mb-1 ${dark ? "text-slate-400" : "text-slate-600"}`}>
        No devices registered
      </p>
      <p className={`text-xs mb-5 ${dark ? "text-slate-600" : "text-slate-400"}`}>
        Connect your first DVR to start monitoring cameras.
      </p>
      <button
        onClick={onAdd}
        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors"
      >
        Register Device
      </button>
    </div>
  );
}

// ── Devices view ──────────────────────────────────────────────────────────────
export default function Devices({ devices, onAdded, onRemoved, streamsCache, deployments }) {
  const { dark } = useTheme();
  const [showForm, setShowForm] = useState(false);

  const handleConnected = (device) => {
    onAdded(device);
    setShowForm(false);
  };

  return (
    <div className="space-y-6 max-w-5xl">

      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className={`text-xl font-bold mb-1 ${dark ? "text-slate-100" : "text-slate-900"}`}>
            Devices
          </h1>
          <p className={`text-sm ${dark ? "text-slate-400" : "text-slate-500"}`}>
            {devices.length > 0
              ? `${devices.length} device${devices.length !== 1 ? "s" : ""} registered`
              : "Register DVR devices to start monitoring camera streams."
            }
          </p>
        </div>
        <button
          onClick={() => setShowForm(s => !s)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
            showForm
              ? dark
                ? "bg-slate-800 text-slate-300 border border-slate-700"
                : "bg-slate-100 text-slate-600 border border-slate-200"
              : "bg-blue-600 hover:bg-blue-500 text-white"
          }`}
        >
          {showForm ? (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cancel
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Register Device
            </>
          )}
        </button>
      </div>

      {/* Add device form */}
      {showForm && (
        <div className={`rounded-2xl border ${dark ? "border-slate-800 bg-slate-900/50" : "border-slate-200 bg-white"} p-6 animate-fade-in`}>
          <AddDeviceForm onConnected={handleConnected} />
        </div>
      )}

      {/* Device grid */}
      {devices.length === 0 && !showForm ? (
        <EmptyDevices onAdd={() => setShowForm(true)} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {devices.map(device => {
            const liveCount = streamsCache[device.device_id]?.data?.length ?? 0;
            const depCount  = deployments.filter(d => d.device_name === device.name).length;
            return (
              <DeviceCard
                key={device.device_id}
                device={device}
                liveCount={liveCount}
                deploymentCount={depCount}
                onRemove={onRemoved}
              />
            );
          })}
        </div>
      )}

    </div>
  );
}
