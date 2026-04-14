import { useState } from "react";
import { useTheme } from "../App.jsx";

// ── Device type registry ──────────────────────────────────────────────────────
const DEVICE_TYPES = [
  {
    value:     "DVR",
    label:     "DVR",
    desc:      "Digital Video Recorder",
    available: true,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <rect x="2" y="7" width="20" height="10" rx="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12h6" />
      </svg>
    ),
  },
  {
    value:     "NVR",
    label:     "NVR",
    desc:      "Network Video Recorder",
    available: false,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
      </svg>
    ),
  },
  {
    value:     "IP",
    label:     "IP Camera",
    desc:      "Direct IP camera",
    available: false,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.723v6.554a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
  },
];

// ── Input field ───────────────────────────────────────────────────────────────
function Field({ label, required, hint, children }) {
  const { dark } = useTheme();
  return (
    <div>
      <label className={`block text-xs font-medium mb-1.5 ${dark ? "text-gray-400" : "text-gray-600"}`}>
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {hint && (
        <p className={`text-xs mt-1 ${dark ? "text-gray-600" : "text-gray-400"}`}>{hint}</p>
      )}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, type = "text", mono = false, right = null }) {
  const { dark } = useTheme();
  return (
    <div className="relative">
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`
          w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none
          placeholder:text-gray-400 transition-[border-color,box-shadow]
          ${mono ? "font-mono" : ""}
          ${right ? "pr-10" : ""}
          ${dark
            ? "bg-gray-800 border-gray-700 text-gray-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/25"
            : "bg-white border-gray-300 text-gray-900 focus:border-blue-400 focus:ring-1 focus:ring-blue-400/25"
          }
        `}
      />
      {right && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">{right}</div>
      )}
    </div>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────
export default function AddDeviceForm({ onConnected }) {
  const { dark } = useTheme();

  const [deviceType,    setDeviceType]    = useState("DVR");
  const [name,          setName]          = useState("");
  const [ip,            setIp]            = useState("");
  const [port,          setPort]          = useState("554");
  const [username,      setUsername]      = useState("");
  const [password,      setPassword]      = useState("");
  const [showPass,      setShowPass]      = useState(false);
  const [maxChannels,   setMaxChannels]   = useState("");

  const [status,  setStatus]  = useState(null);   // null | "loading" | "ok" | "err"
  const [message, setMessage] = useState("");

  const valid = ip.trim() && username.trim() && password;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/devices", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device_type:  deviceType,
          name:         name.trim() || undefined,
          dvr_ip:       ip.trim(),
          rtsp_port:    parseInt(port) || 554,
          username:     username.trim(),
          password,
          max_channels: maxChannels ? parseInt(maxChannels) : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Connection failed");

      setStatus("ok");
      setMessage(data.message);

      setTimeout(() => onConnected(data), 700);
    } catch (err) {
      setStatus("err");
      setMessage(err.message || "Could not reach the backend. Is it running on port 8000?");
    }
  };

  const selectedType = DEVICE_TYPES.find((t) => t.value === deviceType);
  const rtspPreview  = ip && username
    ? `rtsp://${username}:${password ? "••••••" : "<password>"}@${ip}:${port || 554}/cam/realmonitor?channel=1&subtype=0`
    : null;

  return (
    <div className="max-w-xl mx-auto">
      {/* Page title */}
      <div className="mb-7">
        <h1 className={`text-xl font-semibold mb-1 ${dark ? "text-gray-100" : "text-gray-900"}`}>
          Connect Edge Device
        </h1>
        <p className={`text-sm ${dark ? "text-gray-400" : "text-gray-500"}`}>
          Enter your device credentials. Channels are auto-discovered — no manual count needed.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Device type selector */}
        <div>
          <label className={`block text-xs font-medium mb-2 ${dark ? "text-gray-400" : "text-gray-600"}`}>
            Device Type <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {DEVICE_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                disabled={!t.available}
                onClick={() => t.available && setDeviceType(t.value)}
                className={`
                  relative flex flex-col items-center gap-2 p-3 rounded-xl border text-center
                  transition-all
                  ${!t.available ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}
                  ${deviceType === t.value && t.available
                    ? dark
                      ? "border-blue-500 bg-blue-500/10 text-blue-400"
                      : "border-blue-400 bg-blue-50 text-blue-600"
                    : dark
                      ? "border-gray-700 text-gray-400 hover:border-gray-600"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  }
                `}
              >
                {!t.available && (
                  <span className={`absolute top-1.5 right-2 text-xs ${dark ? "text-gray-600" : "text-gray-400"}`}>
                    Soon
                  </span>
                )}
                {t.icon}
                <div>
                  <div className="text-xs font-semibold">{t.label}</div>
                  <div className={`text-xs mt-0.5 ${dark ? "text-gray-600" : "text-gray-400"}`}>{t.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Card container */}
        <div className={`rounded-2xl border ${dark ? "border-gray-800 bg-gray-900" : "border-gray-200 bg-gray-50"}`}>
          <div className={`px-5 py-3.5 border-b flex items-center gap-2 ${dark ? "border-gray-800" : "border-gray-200"}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${dark ? "bg-blue-500" : "bg-blue-600"}`} />
            <span className={`text-sm font-medium ${dark ? "text-gray-200" : "text-gray-700"}`}>
              {selectedType?.label ?? "Device"} Credentials
            </span>
          </div>

          <div className="p-5 space-y-4">
            {/* Name (optional) */}
            <Field label="Device Name" hint="Optional — auto-generated from IP if blank">
              <TextInput
                value={name}
                onChange={setName}
                placeholder={`My ${deviceType}-01`}
              />
            </Field>

            {/* IP + Port row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Field label="IP Address" required hint="Local network IP of your DVR">
                  <TextInput
                    value={ip}
                    onChange={setIp}
                    placeholder="192.168.0.4"
                    mono
                  />
                </Field>
              </div>
              <Field label="RTSP Port" hint="Default: 554">
                <TextInput
                  value={port}
                  onChange={setPort}
                  placeholder="554"
                  type="number"
                  mono
                />
              </Field>
            </div>

            {/* Username */}
            <Field label="Username" required hint="DVR login username">
              <TextInput
                value={username}
                onChange={setUsername}
                placeholder="admin"
              />
            </Field>

            {/* Password */}
            <Field label="Password" required hint="DVR login password">
              <TextInput
                value={password}
                onChange={setPassword}
                placeholder="••••••••"
                type={showPass ? "text" : "password"}
                right={
                  <button
                    type="button"
                    onClick={() => setShowPass((p) => !p)}
                    className={`${dark ? "text-gray-500 hover:text-gray-300" : "text-gray-400 hover:text-gray-600"}`}
                  >
                    {showPass ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                }
              />
            </Field>

            {/* Max channels (advanced / optional) */}
            <details className="group">
              <summary className={`text-xs cursor-pointer list-none flex items-center gap-1.5 ${dark ? "text-gray-500 hover:text-gray-400" : "text-gray-400 hover:text-gray-600"}`}>
                <svg className="w-3 h-3 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                Advanced options
              </summary>
              <div className="mt-3">
                <Field label="Max Channels to Scan" hint="Leave blank to auto-detect (up to 64). Set lower for faster scans.">
                  <TextInput
                    value={maxChannels}
                    onChange={setMaxChannels}
                    placeholder="Auto (up to 64)"
                    type="number"
                    mono
                  />
                </Field>
              </div>
            </details>
          </div>

          {/* RTSP preview */}
          {rtspPreview && (
            <div className={`mx-5 mb-4 px-4 py-3 rounded-xl border ${dark ? "bg-gray-800/60 border-gray-700" : "bg-white border-gray-200"}`}>
              <div className={`text-xs mb-1 ${dark ? "text-gray-500" : "text-gray-400"}`}>
                Sample RTSP URL — Channel 1
              </div>
              <code className={`text-xs font-mono break-all ${dark ? "text-cyan-400" : "text-blue-600"}`}>
                {rtspPreview}
              </code>
            </div>
          )}

          {/* Status banner */}
          {status && status !== "loading" && (
            <div className={`mx-5 mb-4 px-4 py-3 rounded-xl border text-sm flex items-start gap-2.5 ${
              status === "ok"
                ? dark ? "bg-emerald-500/10 border-emerald-700 text-emerald-400" : "bg-emerald-50 border-emerald-200 text-emerald-700"
                : dark ? "bg-red-500/10 border-red-800 text-red-400" : "bg-red-50 border-red-200 text-red-600"
            }`}>
              <span className="text-base leading-none mt-0.5">{status === "ok" ? "✓" : "✕"}</span>
              <span>{message}</span>
            </div>
          )}

          {/* Submit */}
          <div className="px-5 pb-5">
            <button
              type="submit"
              disabled={!valid || status === "loading"}
              className={`
                w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2
                transition-colors
                ${valid && status !== "loading"
                  ? "bg-blue-600 hover:bg-blue-500 text-white"
                  : dark
                    ? "bg-gray-800 text-gray-600 cursor-not-allowed"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                }
              `}
            >
              {status === "loading" ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Connecting…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Connect Device
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
