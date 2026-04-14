import { useTheme } from "../../App.jsx";

// ── Shared mini components ────────────────────────────────────────────────────
function Badge({ label, color }) {
  const variants = {
    green:  "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
    amber:  "bg-amber-100  text-amber-700  dark:bg-amber-500/15  dark:text-amber-400",
    red:    "bg-red-100    text-red-700    dark:bg-red-500/15    dark:text-red-400",
    blue:   "bg-blue-100   text-blue-700   dark:bg-blue-500/15   dark:text-blue-400",
    gray:   "bg-slate-100  text-slate-600  dark:bg-slate-700     dark:text-slate-400",
    violet: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-400",
  };
  return (
    <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${variants[color] ?? variants.gray}`}>
      {label}
    </span>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color, icon, onClick }) {
  const { dark } = useTheme();
  return (
    <div
      onClick={onClick}
      className={`
        relative overflow-hidden rounded-2xl border p-5
        ${onClick ? "cursor-pointer" : ""}
        ${dark
          ? "bg-slate-900 border-slate-800 hover:border-slate-700"
          : "bg-white border-slate-200 hover:border-slate-300"
        }
        transition-all
      `}
    >
      {/* Gradient background orb */}
      <div
        className="absolute -right-4 -top-4 w-20 h-20 rounded-full opacity-10 blur-xl"
        style={{ background: color }}
      />

      <div className="flex items-start justify-between mb-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center text-white"
          style={{ background: `${color}22`, color }}
        >
          {icon}
        </div>
        {onClick && (
          <svg className={`w-4 h-4 mt-0.5 ${dark ? "text-slate-600" : "text-slate-400"}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        )}
      </div>

      <div className="animate-count">
        <div className="text-2xl font-bold tracking-tight" style={{ color }}>{value}</div>
        <div className={`text-sm font-medium mt-0.5 ${dark ? "text-slate-300" : "text-slate-700"}`}>{label}</div>
        {sub && <div className={`text-xs mt-0.5 ${dark ? "text-slate-600" : "text-slate-400"}`}>{sub}</div>}
      </div>
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────
function Bar({ pct, color }) {
  return (
    <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
      <div
        className="h-full rounded-full progress-fill"
        style={{ width: `${Math.min(pct, 100)}%`, background: color }}
      />
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ title, action, onAction }) {
  const { dark } = useTheme();
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className={`text-sm font-semibold ${dark ? "text-slate-200" : "text-slate-800"}`}>{title}</h3>
      {action && (
        <button
          onClick={onAction}
          className={`text-xs font-medium ${dark ? "text-blue-400 hover:text-blue-300" : "text-blue-600 hover:text-blue-700"}`}
        >
          {action} →
        </button>
      )}
    </div>
  );
}

// ── Card wrapper ──────────────────────────────────────────────────────────────
function Card({ children, className = "" }) {
  const { dark } = useTheme();
  return (
    <div className={`rounded-2xl border p-4 ${
      dark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
    } ${className}`}>
      {children}
    </div>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────────
export default function Overview({ devices, models, deployments, streamsCache, onNavigate, onSelectDevice }) {
  const { dark } = useTheme();

  const totalCameras   = Object.values(streamsCache).reduce((n, c) => n + (c?.data?.length ?? 0), 0);
  const liveStreams     = totalCameras;
  const activeDepCount = deployments.filter(d => d.status === "active").length;

  // ── Stat icons ───────────────────────────────────────────────────────────
  const DevIcon = () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9 3H5a2 2 0 00-2 2v14a2 2 0 002 2h4m6-18h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M9 3v18M9 12h6" />
    </svg>
  );
  const CamIcon = () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
    </svg>
  );
  const ModelIcon = () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
    </svg>
  );
  const DeployIcon = () => (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
  );

  return (
    <div className="space-y-6 max-w-6xl">

      {/* Page title */}
      <div>
        <h1 className={`text-xl font-bold mb-1 ${dark ? "text-slate-100" : "text-slate-900"}`}>
          Platform Overview
        </h1>
        <p className={`text-sm ${dark ? "text-slate-400" : "text-slate-500"}`}>
          Real-time health across all devices, streams and deployed models.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Edge Devices"
          value={devices.length}
          sub="registered"
          color="#3b82f6"
          icon={<DevIcon />}
          onClick={() => onNavigate("devices")}
        />
        <StatCard
          label="Live Streams"
          value={liveStreams}
          sub="active channels"
          color="#10b981"
          icon={<CamIcon />}
          onClick={() => onNavigate("streams")}
        />
        <StatCard
          label="ML Models"
          value={models.length}
          sub="uploaded"
          color="#8b5cf6"
          icon={<ModelIcon />}
          onClick={() => onNavigate("models")}
        />
        <StatCard
          label="Deployments"
          value={activeDepCount}
          sub="active"
          color="#f59e0b"
          icon={<DeployIcon />}
          onClick={() => onNavigate("deploy")}
        />
      </div>

      {/* Two-col layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Device health */}
        <Card>
          <SectionHeader
            title="Device Health"
            action={devices.length > 0 ? "Manage" : null}
            onAction={() => onNavigate("devices")}
          />
          {devices.length === 0 ? (
            <div className={`py-8 text-center ${dark ? "text-slate-600" : "text-slate-400"}`}>
              <div className={`w-10 h-10 rounded-xl mx-auto mb-2 flex items-center justify-center ${
                dark ? "bg-slate-800" : "bg-slate-100"
              }`}>
                <DevIcon />
              </div>
              <p className="text-sm">No devices registered</p>
              <button
                onClick={() => onNavigate("devices")}
                className={`text-xs mt-1 ${dark ? "text-blue-400" : "text-blue-600"}`}
              >
                Add a device →
              </button>
            </div>
          ) : (
            <div className="space-y-0">
              {devices.map(d => {
                const live = streamsCache[d.device_id]?.data?.length ?? 0;
                const devDeps = deployments.filter(dep =>
                  dep.device_name === d.name
                ).length;
                return (
                  <div
                    key={d.device_id}
                    onClick={() => onSelectDevice(d.device_id)}
                    className={`flex items-center gap-3 py-3 border-b last:border-b-0 cursor-pointer rounded-lg px-1 ${
                      dark
                        ? "border-slate-800 hover:bg-slate-800/50"
                        : "border-slate-100 hover:bg-slate-50"
                    } transition-colors`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      dark ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500"
                    }`}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                        <rect x="2" y="7" width="20" height="10" rx="2" strokeLinecap="round" strokeLinejoin="round" />
                        <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12h6" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-xs font-semibold truncate ${dark ? "text-slate-200" : "text-slate-800"}`}>
                        {d.name}
                      </div>
                      <div className={`text-xs font-mono truncate ${dark ? "text-slate-600" : "text-slate-400"}`}>
                        {d.dvr_ip}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {live > 0
                        ? <Badge label={`${live} live`} color="green" />
                        : <Badge label="Idle" color="gray" />
                      }
                      {devDeps > 0 && <Badge label={`${devDeps} models`} color="violet" />}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Recent deployments */}
        <Card>
          <SectionHeader
            title="Recent Deployments"
            action={deployments.length > 0 ? "View all" : null}
            onAction={() => onNavigate("deploy")}
          />
          {deployments.length === 0 ? (
            <div className={`py-8 text-center ${dark ? "text-slate-600" : "text-slate-400"}`}>
              <div className={`w-10 h-10 rounded-xl mx-auto mb-2 flex items-center justify-center ${
                dark ? "bg-slate-800" : "bg-slate-100"
              }`}>
                <DeployIcon />
              </div>
              <p className="text-sm">No deployments yet</p>
              <button
                onClick={() => onNavigate("deploy")}
                className={`text-xs mt-1 ${dark ? "text-blue-400" : "text-blue-600"}`}
              >
                Deploy a model →
              </button>
            </div>
          ) : (
            <div className="space-y-0">
              {deployments.slice(0, 6).map(dep => (
                <div key={dep.id} className={`flex items-center gap-3 py-3 border-b last:border-b-0 ${
                  dark ? "border-slate-800" : "border-slate-100"
                }`}>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    dep.status === "active" ? "bg-emerald-500" : "bg-amber-500"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className={`text-xs font-medium truncate ${dark ? "text-slate-200" : "text-slate-800"}`}>
                      {dep.model_name} <span className={dark ? "text-slate-500" : "text-slate-400"}>{dep.model_version}</span>
                    </div>
                    <div className={`text-xs truncate mt-0.5 ${dark ? "text-slate-500" : "text-slate-400"}`}>
                      {dep.device_name} · {dep.camera_name}
                    </div>
                  </div>
                  <Badge label={dep.status} color={dep.status === "active" ? "green" : "amber"} />
                </div>
              ))}
            </div>
          )}
        </Card>

      </div>

      {/* Models quick view */}
      {models.length > 0 && (
        <Card>
          <SectionHeader
            title="Uploaded Models"
            action="Manage"
            onAction={() => onNavigate("models")}
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {models.slice(0, 8).map(m => (
              <div
                key={m.id}
                className={`flex items-center gap-2.5 p-3 rounded-xl border ${
                  dark ? "bg-slate-800/50 border-slate-700 hover:border-slate-600" : "bg-slate-50 border-slate-200 hover:border-slate-300"
                } transition-colors`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  dark ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-600"
                }`}>
                  {m.framework?.slice(0, 2) ?? "AI"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-xs font-medium truncate ${dark ? "text-slate-200" : "text-slate-800"}`}>
                    {m.name}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <div className={`flex-1 h-1 rounded-full overflow-hidden ${dark ? "bg-slate-700" : "bg-slate-200"}`}>
                      <div
                        className="h-full rounded-full bg-emerald-500 progress-fill"
                        style={{ width: `${m.accuracy}%` }}
                      />
                    </div>
                    <span className={`text-xs ${dark ? "text-slate-500" : "text-slate-400"}`}>
                      {m.accuracy}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Empty state — no devices */}
      {devices.length === 0 && models.length === 0 && (
        <div className={`flex flex-col items-center justify-center py-20 rounded-2xl border border-dashed ${
          dark ? "border-slate-800 text-slate-600" : "border-slate-200 text-slate-400"
        }`}>
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728M9 12a3 3 0 116 0 3 3 0 01-6 0z" />
            </svg>
          </div>
          <h2 className={`text-base font-semibold mb-1 ${dark ? "text-slate-300" : "text-slate-700"}`}>
            Welcome to Vision AI
          </h2>
          <p className={`text-sm text-center max-w-sm mb-6 ${dark ? "text-slate-500" : "text-slate-400"}`}>
            Start by registering a DVR device. Then scan for camera streams and deploy ML models for real-time inference.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => onNavigate("devices")}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors"
            >
              Register Device
            </button>
            <button
              onClick={() => onNavigate("models")}
              className={`px-5 py-2.5 border text-sm font-medium rounded-xl transition-colors ${
                dark
                  ? "border-slate-700 text-slate-300 hover:bg-slate-800"
                  : "border-slate-300 text-slate-700 hover:bg-slate-50"
              }`}
            >
              Upload Model
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
