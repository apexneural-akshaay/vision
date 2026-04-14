import { useState, useRef } from "react";
import { useTheme } from "../../App.jsx";

// ── Framework badge colors ────────────────────────────────────────────────────
const FW_COLOR = {
  YOLOv8:     { bg: "bg-orange-500/15", text: "text-orange-400", lbg: "bg-orange-50", ltxt: "text-orange-600" },
  YOLOv9:     { bg: "bg-red-500/15",    text: "text-red-400",    lbg: "bg-red-50",    ltxt: "text-red-600" },
  YOLOv5:     { bg: "bg-yellow-500/15", text: "text-yellow-400", lbg: "bg-yellow-50", ltxt: "text-yellow-600" },
  Mediapipe:  { bg: "bg-green-500/15",  text: "text-green-400",  lbg: "bg-green-50",  ltxt: "text-green-600" },
  OpenCV:     { bg: "bg-cyan-500/15",   text: "text-cyan-400",   lbg: "bg-cyan-50",   ltxt: "text-cyan-600" },
  default:    { bg: "bg-blue-500/15",   text: "text-blue-400",   lbg: "bg-blue-50",   ltxt: "text-blue-600" },
};

function fwColor(fw) {
  return FW_COLOR[fw] ?? FW_COLOR.default;
}

// ── Badge ─────────────────────────────────────────────────────────────────────
function Badge({ label, dark, fw }) {
  const c = fwColor(fw ?? "");
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
      dark ? `${c.bg} ${c.text}` : `${c.lbg} ${c.ltxt}`
    }`}>
      {label}
    </span>
  );
}

// ── Model card ────────────────────────────────────────────────────────────────
function ModelCard({ model, onDelete }) {
  const { dark }          = useTheme();
  const [expanded, setEx] = useState(false);
  const [confirm,  setCf] = useState(false);
  const c = fwColor(model.framework);

  return (
    <div
      className={`rounded-2xl border transition-all ${
        expanded
          ? dark ? "border-blue-700/50 bg-slate-900" : "border-blue-300/50 bg-white"
          : dark ? "border-slate-800 bg-slate-900 hover:border-slate-700" : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      {/* Card header — click to expand */}
      <div
        className="p-4 cursor-pointer"
        onClick={() => setEx(v => !v)}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          {/* Model icon */}
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${
              dark ? `${c.bg} ${c.text}` : `${c.lbg} ${c.ltxt}`
            }`}>
              {model.framework?.slice(0, 2) ?? "AI"}
            </div>
            <div>
              <div className={`text-sm font-semibold ${dark ? "text-slate-100" : "text-slate-900"}`}>
                {model.name}
              </div>
              <div className={`text-xs mt-0.5 ${dark ? "text-slate-500" : "text-slate-400"}`}>
                {model.version}
              </div>
            </div>
          </div>

          {/* Expand chevron */}
          <svg
            className={`w-4 h-4 flex-shrink-0 mt-0.5 transition-transform ${expanded ? "rotate-180" : ""} ${
              dark ? "text-slate-600" : "text-slate-400"
            }`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        {/* Tags row */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <Badge label={model.framework} dark={dark} fw={model.framework} />
          {model.size && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              dark ? "bg-slate-700 text-slate-400" : "bg-slate-100 text-slate-500"
            }`}>{model.size}</span>
          )}
        </div>

        {/* Accuracy bar */}
        <div className="flex items-center gap-2">
          <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${dark ? "bg-slate-700" : "bg-slate-200"}`}>
            <div
              className="h-full rounded-full bg-emerald-500 progress-fill"
              style={{ width: `${model.accuracy}%` }}
            />
          </div>
          <span className={`text-xs font-medium flex-shrink-0 ${dark ? "text-slate-400" : "text-slate-600"}`}>
            {model.accuracy}%
          </span>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className={`px-4 pb-4 pt-0 border-t space-y-3 ${dark ? "border-slate-800" : "border-slate-100"}`}>
          <div className={`grid grid-cols-2 gap-3 pt-3 text-xs ${dark ? "text-slate-400" : "text-slate-600"}`}>
            <div>
              <span className={dark ? "text-slate-600" : "text-slate-400"}>Framework</span>
              <div className={`font-medium mt-0.5 ${dark ? "text-slate-200" : "text-slate-800"}`}>{model.framework}</div>
            </div>
            <div>
              <span className={dark ? "text-slate-600" : "text-slate-400"}>Version</span>
              <div className={`font-medium mt-0.5 ${dark ? "text-slate-200" : "text-slate-800"}`}>{model.version}</div>
            </div>
            <div>
              <span className={dark ? "text-slate-600" : "text-slate-400"}>Size</span>
              <div className={`font-medium mt-0.5 ${dark ? "text-slate-200" : "text-slate-800"}`}>{model.size || "—"}</div>
            </div>
            <div>
              <span className={dark ? "text-slate-600" : "text-slate-400"}>Accuracy</span>
              <div className="font-medium mt-0.5 text-emerald-500">{model.accuracy}%</div>
            </div>
          </div>

          {!confirm ? (
            <button
              onClick={(e) => { e.stopPropagation(); setCf(true); }}
              className={`w-full py-2 rounded-xl text-xs font-medium border transition-colors ${
                dark
                  ? "border-red-900/50 text-red-400 hover:bg-red-500/10"
                  : "border-red-200 text-red-500 hover:bg-red-50"
              }`}
            >
              Delete Model
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(model.id); }}
                className="flex-1 py-2 rounded-xl text-xs font-medium bg-red-600 hover:bg-red-500 text-white"
              >
                Confirm Delete
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setCf(false); }}
                className={`flex-1 py-2 rounded-xl text-xs font-medium border ${
                  dark ? "border-slate-700 text-slate-400 hover:bg-slate-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Upload form ───────────────────────────────────────────────────────────────
function UploadForm({ onAdded }) {
  const { dark } = useTheme();
  const modelFileRef = useRef(null);
  const infFileRef   = useRef(null);

  const [name,      setName]      = useState("");
  const [version,   setVersion]   = useState("v1.0");
  const [framework, setFramework] = useState("YOLOv8");
  const [accuracy,  setAccuracy]  = useState("0");
  const [modelFile, setModelFile] = useState(null);
  const [infFile,   setInfFile]   = useState(null);
  const [status,    setStatus]    = useState(null);   // null | "loading" | "ok" | "err"
  const [msg,       setMsg]       = useState("");

  const valid = name.trim() && modelFile && infFile;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!valid) return;
    setStatus("loading");

    const fd = new FormData();
    fd.append("name",           name.trim());
    fd.append("version",        version);
    fd.append("framework",      framework);
    fd.append("accuracy",       parseInt(accuracy) || 0);
    fd.append("model_file",     modelFile);
    fd.append("inference_file", infFile);

    try {
      // Use longer timeout (180s) for large file uploads
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 180_000);

      // Direct to backend to avoid proxy stall (vite proxy stalls on large uploads)
      const res = await fetch("http://localhost:8000/models", {
        method: "POST",
        body: fd,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Upload failed");
      setStatus("ok");
      setMsg("Model uploaded successfully!");
      onAdded(data);
      // Reset
      setTimeout(() => {
        setName(""); setVersion("v1.0"); setFramework("YOLOv8");
        setAccuracy("0"); setModelFile(null); setInfFile(null);
        if (modelFileRef.current) modelFileRef.current.value = "";
        if (infFileRef.current)   infFileRef.current.value   = "";
        setStatus(null); setMsg("");
      }, 2500);
    } catch (err) {
      setStatus("err");
      if (err.name === "AbortError") {
        setMsg("Upload timed out (3 min max). File may be too large or connection too slow.");
      } else {
        setMsg(err.message || "Upload failed");
      }
    }
  };

  const inp = `w-full px-3.5 py-2.5 rounded-xl border text-sm outline-none transition-all ${
    dark
      ? "bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/25"
      : "bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-blue-400 focus:ring-1 focus:ring-blue-400/25"
  }`;

  const label = `block text-xs font-medium mb-1.5 ${dark ? "text-slate-400" : "text-slate-600"}`;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name + version row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <label className={label}>Model Name <span className="text-red-500">*</span></label>
          <input className={inp} value={name} onChange={e => setName(e.target.value)} placeholder="My YOLOv8 Model" />
        </div>
        <div>
          <label className={label}>Version</label>
          <input className={inp} value={version} onChange={e => setVersion(e.target.value)} placeholder="v1.0" />
        </div>
      </div>

      {/* Framework + accuracy row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label}>Framework</label>
          <select
            className={inp}
            value={framework}
            onChange={e => setFramework(e.target.value)}
          >
            {["YOLOv8","YOLOv9","YOLOv5","Mediapipe","OpenCV","Custom"].map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label}>Accuracy %</label>
          <input
            type="number" min="0" max="100"
            className={inp}
            value={accuracy}
            onChange={e => setAccuracy(e.target.value)}
            placeholder="0–100"
          />
        </div>
      </div>

      {/* File uploads */}
      <div className="grid grid-cols-2 gap-3">
        {/* Model .pt */}
        <div>
          <label className={label}>Model File (.pt) <span className="text-red-500">*</span></label>
          <div
            className={`drop-zone rounded-xl px-4 py-5 text-center cursor-pointer ${
              modelFile
                ? dark ? "border-emerald-700 bg-emerald-500/5" : "border-emerald-300 bg-emerald-50"
                : dark ? "" : ""
            }`}
            onClick={() => modelFileRef.current?.click()}
          >
            <input
              ref={modelFileRef}
              type="file"
              accept=".pt,.pth,.onnx,.bin"
              className="hidden"
              onChange={e => setModelFile(e.target.files?.[0] ?? null)}
            />
            {modelFile ? (
              <div className="text-emerald-500 text-xs font-medium">
                <div className="text-lg mb-1">✓</div>
                {modelFile.name}
              </div>
            ) : (
              <>
                <svg className={`w-6 h-6 mx-auto mb-1 ${dark ? "text-slate-600" : "text-slate-400"}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className={`text-xs ${dark ? "text-slate-500" : "text-slate-400"}`}>
                  Click to upload .pt / .onnx
                </p>
              </>
            )}
          </div>
        </div>

        {/* Inference .py */}
        <div>
          <label className={label}>Inference Script (.py) <span className="text-red-500">*</span></label>
          <div
            className={`drop-zone rounded-xl px-4 py-5 text-center cursor-pointer ${
              infFile
                ? dark ? "border-emerald-700 bg-emerald-500/5" : "border-emerald-300 bg-emerald-50"
                : dark ? "" : ""
            }`}
            onClick={() => infFileRef.current?.click()}
          >
            <input
              ref={infFileRef}
              type="file"
              accept=".py"
              className="hidden"
              onChange={e => setInfFile(e.target.files?.[0] ?? null)}
            />
            {infFile ? (
              <div className="text-emerald-500 text-xs font-medium">
                <div className="text-lg mb-1">✓</div>
                {infFile.name}
              </div>
            ) : (
              <>
                <svg className={`w-6 h-6 mx-auto mb-1 ${dark ? "text-slate-600" : "text-slate-400"}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                </svg>
                <p className={`text-xs ${dark ? "text-slate-500" : "text-slate-400"}`}>
                  Click to upload inference.py
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Status banner */}
      {status && status !== "loading" && (
        <div className={`px-4 py-3 rounded-xl border text-sm flex items-center gap-2.5 ${
          status === "ok"
            ? dark ? "bg-emerald-500/10 border-emerald-700 text-emerald-400" : "bg-emerald-50 border-emerald-200 text-emerald-700"
            : dark ? "bg-red-500/10 border-red-900 text-red-400" : "bg-red-50 border-red-200 text-red-600"
        }`}>
          <span className="text-base">{status === "ok" ? "✓" : "✕"}</span>
          {msg}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={!valid || status === "loading"}
        className={`w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-colors ${
          valid && status !== "loading"
            ? "bg-blue-600 hover:bg-blue-500 text-white"
            : dark ? "bg-slate-800 text-slate-600 cursor-not-allowed" : "bg-slate-100 text-slate-400 cursor-not-allowed"
        }`}
      >
        {status === "loading" ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            Uploading…
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Upload Model
          </>
        )}
      </button>
    </form>
  );
}

// ── ML Models view ────────────────────────────────────────────────────────────
export default function MLModels({ models, onAdded, onDeleted }) {
  const { dark }         = useTheme();
  const [showForm, setShowForm] = useState(false);
  const [search,   setSearch]   = useState("");

  const filtered = models.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.framework.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id) => {
    try {
      // Direct to backend to avoid proxy issues
      const res = await fetch(`http://localhost:8000/models/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || `Delete failed: ${res.status}`);
      }
      onDeleted(id);
    } catch (err) {
      alert(`Failed to delete model: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className={`text-xl font-bold mb-1 ${dark ? "text-slate-100" : "text-slate-900"}`}>
            ML Models
          </h1>
          <p className={`text-sm ${dark ? "text-slate-400" : "text-slate-500"}`}>
            Upload and manage YOLO models and inference scripts for deployment.
          </p>
        </div>
        <button
          onClick={() => setShowForm(s => !s)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
            showForm
              ? dark ? "bg-slate-800 text-slate-300 border border-slate-700" : "bg-slate-100 text-slate-600 border border-slate-200"
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
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Upload Model
            </>
          )}
        </button>
      </div>

      {/* Upload form */}
      {showForm && (
        <div className={`rounded-2xl border p-6 animate-fade-in ${
          dark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
        }`}>
          <h2 className={`text-sm font-semibold mb-5 ${dark ? "text-slate-200" : "text-slate-800"}`}>
            Upload New Model
          </h2>
          <UploadForm onAdded={(m) => { onAdded(m); setShowForm(false); }} />
        </div>
      )}

      {/* Search */}
      {models.length > 0 && (
        <div className="relative">
          <svg className={`absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 ${dark ? "text-slate-500" : "text-slate-400"}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search models…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={`w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm outline-none transition-all ${
              dark
                ? "bg-slate-900 border-slate-800 text-slate-100 placeholder:text-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20"
                : "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 focus:border-blue-400"
            }`}
          />
        </div>
      )}

      {/* Models grid */}
      {filtered.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(m => (
            <ModelCard key={m.id} model={m} onDelete={handleDelete} />
          ))}
        </div>
      ) : models.length === 0 ? (
        /* Empty state */
        <div className={`flex flex-col items-center justify-center py-20 rounded-2xl border border-dashed ${
          dark ? "border-slate-800" : "border-slate-200"
        }`}>
          <div className={`w-14 h-14 rounded-2xl mb-4 flex items-center justify-center ${
            dark ? "bg-slate-800" : "bg-slate-100"
          }`}>
            <svg className={`w-7 h-7 ${dark ? "text-slate-500" : "text-slate-400"}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
            </svg>
          </div>
          <p className={`text-sm font-medium mb-1 ${dark ? "text-slate-400" : "text-slate-600"}`}>
            No models uploaded yet
          </p>
          <p className={`text-xs mb-5 ${dark ? "text-slate-600" : "text-slate-400"}`}>
            Upload a .pt model file and an inference script to get started.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl"
          >
            Upload First Model
          </button>
        </div>
      ) : (
        /* No search results */
        <div className={`py-12 text-center ${dark ? "text-slate-600" : "text-slate-400"}`}>
          <p className="text-sm">No models match "{search}"</p>
          <button
            onClick={() => setSearch("")}
            className={`text-xs mt-1 ${dark ? "text-blue-400" : "text-blue-600"}`}
          >
            Clear search
          </button>
        </div>
      )}

    </div>
  );
}
