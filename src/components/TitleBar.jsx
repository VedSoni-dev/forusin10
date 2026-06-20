import { useEffect, useState } from "react";
import { Minus, Square, Copy, X, Download, Loader2 } from "lucide-react";

const api = typeof window !== "undefined" ? window.localai : null;
const isMac = api?.platform === "darwin";

export default function TitleBar({ landing = false }) {
  const [maximized, setMaximized] = useState(false);
  const [update, setUpdate] = useState(null); // {state:'available'|'downloading'|'ready', percent, version}

  useEffect(() => {
    if (!api?.win) return;
    api.win.isMaximized().then(setMaximized);
    const off = api.win.onMaximizedChange(setMaximized);
    return () => off?.();
  }, []);

  // Listen for auto-update events
  useEffect(() => {
    if (!api?.update) return;
    const offA = api.update.onAvailable(({ version }) =>
      setUpdate({ state: "downloading", percent: 0, version })
    );
    const offP = api.update.onProgress(({ percent }) =>
      setUpdate((u) => (u ? { ...u, state: "downloading", percent } : u))
    );
    const offR = api.update.onReady(({ version }) =>
      setUpdate({ state: "ready", version })
    );
    return () => {
      offA?.();
      offP?.();
      offR?.();
    };
  }, []);

  return (
    <div className="drag flex items-stretch h-9 shrink-0 select-none">
      {/* Left segment continues the sidebar column */}
      <div
        className={
          landing
            ? "w-0"
            : "w-[72px] sm:w-[260px] bg-slate-50 border-r border-slate-200"
        }
      />

      {/* Right segment continues the chat column */}
      <div className="flex-1 bg-white flex items-center justify-end gap-2 pr-1">
        {/* Update button - shows whenever an update is available */}
        {update && (
          <button
            onClick={() => update.state === "ready" && api.update.install()}
            disabled={update.state !== "ready"}
            title={
              update.state === "ready"
                ? "Restart to update"
                : "Downloading update..."
            }
            className={`no-drag flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.72rem] font-normal transition-colors duration-150 ${
              update.state === "ready"
                ? "bg-emerald-500 text-white hover:bg-emerald-600 cursor-pointer"
                : "bg-emerald-50 text-emerald-600 cursor-default"
            }`}
          >
            {update.state === "ready" ? (
              <>
                <Download size={12} /> Restart to update
              </>
            ) : (
              <>
                <Loader2 size={12} className="animate-spin" /> Updating...{" "}
                {update.percent ? `${update.percent}%` : ""}
              </>
            )}
          </button>
        )}

        {/* macOS uses its native traffic lights; only draw controls elsewhere */}
        {!isMac && api?.win && (
          <div className="no-drag flex items-stretch h-full">
            <Ctl onClick={() => api.win.minimize()} label="Minimize">
              <Minus size={15} strokeWidth={1.6} />
            </Ctl>
            <Ctl onClick={() => api.win.maximize()} label="Maximize">
              {maximized ? (
                <Copy size={12} strokeWidth={1.6} />
              ) : (
                <Square size={12} strokeWidth={1.6} />
              )}
            </Ctl>
            <Ctl onClick={() => api.win.close()} label="Close" danger>
              <X size={16} strokeWidth={1.6} />
            </Ctl>
          </div>
        )}
      </div>
    </div>
  );
}

function Ctl({ children, onClick, label, danger }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`w-[44px] grid place-items-center text-slate-400 transition-colors ${
        danger
          ? "hover:bg-red-500 hover:text-white"
          : "hover:bg-slate-100 hover:text-slate-700"
      }`}
    >
      {children}
    </button>
  );
}
