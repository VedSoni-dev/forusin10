import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Leaf, Check } from "lucide-react";

/**
 * First-launch setup screen.
 *
 * Everything is automatic — no manual steps, no external downloads, no "install Ollama".
 * The app starts its own bundled AI engine, then downloads the model (~3.2 GB).
 * After that the user never sees this screen again.
 *
 * phases:
 *   starting    — waiting for the bundled Ollama binary to be ready (a few seconds)
 *   downloading — pulling the AI model, showing a progress bar
 *   done        — brief success moment before handing off to the main UI
 *   error       — something went wrong, offer retry
 */
export default function Onboarding({ model, onReady }) {
  const [phase, setPhase] = useState("starting");
  const [pct, setPct] = useState(0);
  const [statusLabel, setStatusLabel] = useState("Downloading your private AI…");
  const [error, setError] = useState("");
  const cancelledRef = useRef(false);

  // Listen to model-download progress events from the main process.
  useEffect(() => {
    const off = window.localai?.onPullProgress?.(({ status, percent }) => {
      if (typeof percent === "number") setPct(percent);
      if (status) setStatusLabel(prettyStatus(status));
    });
    return () => off?.();
  }, []);

  // Kick off the automated setup on mount.
  useEffect(() => {
    cancelledRef.current = false;
    runSetup();
    return () => { cancelledRef.current = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runSetup() {
    setPhase("starting");
    setError("");
    setPct(0);

    // ── Step 1: wait for the bundled Ollama to be ready ──────────────────────
    // The binary is starting in the background; poll status every second.
    let attempts = 0;
    while (!cancelledRef.current) {
      const s = await window.localai?.status?.().catch(() => null);
      if (s?.hasModel) {
        // Returning user — model already here, skip straight to the app.
        if (!cancelledRef.current) {
          setPhase("done");
          setTimeout(onReady, 700);
        }
        return;
      }
      if (s?.running) break; // engine is up, model just needs downloading
      await sleep(1000);
      if (++attempts > 60) {
        // 60s timeout — something went badly wrong.
        setError("The AI engine didn't start. Please restart the app.");
        setPhase("error");
        return;
      }
    }
    if (cancelledRef.current) return;

    // ── Step 2: auto-pull the model (no button click needed) ─────────────────
    setPhase("downloading");
    const res = await window.localai?.pullModel?.(model).catch((e) => ({
      ok: false,
      error: String(e?.message || e),
    }));

    if (cancelledRef.current) return;

    if (res?.ok) {
      setPhase("done");
      setTimeout(onReady, 900);
    } else {
      setError(res?.error || "Download failed. Check your internet connection.");
      setPhase("error");
    }
  }

  return (
    <div className="h-full w-full bg-white flex items-center justify-center p-8">
      <div className="w-full max-w-sm text-center">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-50 mb-8"
        >
          <Leaf className="text-emerald-500" size={26} strokeWidth={1.5} />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12, duration: 0.5 }}
          className="font-extralight text-3xl tracking-tight text-slate-900 mb-10"
        >
          for us in <span className="font-light">10</span>
        </motion.h1>

        <AnimatePresence mode="wait">
          {/* ── Starting (engine booting up) ── */}
          {phase === "starting" && (
            <Step key="starting">
              <p className="text-slate-500 font-light text-sm mb-6">
                Starting your private AI…
              </p>
              <div className="flex justify-center gap-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-slate-300 block"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
              </div>
            </Step>
          )}

          {/* ── Downloading ── */}
          {phase === "downloading" && (
            <Step key="downloading">
              <p className="text-slate-700 font-light text-sm mb-1">
                {statusLabel}
              </p>
              <p className="text-xs text-slate-400 font-light mb-6">
                ~3.2 GB · this happens once, then it's yours forever
              </p>
              <div className="w-full h-1 rounded-full bg-slate-100 overflow-hidden mb-3">
                <motion.div
                  className="h-full bg-emerald-500 rounded-full"
                  animate={{ width: `${pct}%` }}
                  transition={{ ease: "easeOut", duration: 0.4 }}
                />
              </div>
              <p className="text-xs text-slate-400 font-light tabular-nums">{pct}%</p>
            </Step>
          )}

          {/* ── Done ── */}
          {phase === "done" && (
            <Step key="done">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-emerald-500 mb-4"
              >
                <Check className="text-white" size={20} strokeWidth={2.5} />
              </motion.div>
              <p className="text-slate-500 font-light text-sm">All set</p>
            </Step>
          )}

          {/* ── Error ── */}
          {phase === "error" && (
            <Step key="error">
              <p className="text-red-400 font-light text-sm mb-5">{error}</p>
              <button
                onClick={runSetup}
                className="bg-slate-900 text-white rounded-full px-7 py-2.5 text-xs font-normal hover:bg-slate-700 transition-all"
              >
                Try again
              </button>
            </Step>
          )}
        </AnimatePresence>

        <p className="mt-14 text-[0.7rem] text-slate-300 font-light">
          Runs entirely on your computer · nothing is ever sent anywhere
        </p>
      </div>
    </div>
  );
}

function Step({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

function prettyStatus(s) {
  const t = s.toLowerCase();
  if (t.includes("pulling")) return "Downloading your private AI…";
  if (t.includes("verifying")) return "Verifying…";
  if (t.includes("manifest")) return "Checking version…";
  if (t.includes("success")) return "Almost done…";
  return "Setting things up…";
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
