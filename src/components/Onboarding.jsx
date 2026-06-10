import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Leaf, Shield, Download, RefreshCw, Check, ArrowRight } from "lucide-react";

// Decides what the user still needs: the engine, or just the model.
export default function Onboarding({ model, onReady, onRecheck }) {
  const [phase, setPhase] = useState("checking"); // checking | needEngine | needModel | downloading | done
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState("");
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setPhase("checking");
    setError("");
    const s = await window.localai.status();
    if (s.running && s.hasModel) {
      setPhase("done");
      setTimeout(onReady, 700);
    } else if (s.running) {
      setPhase("needModel");
    } else {
      setPhase("needEngine");
    }
  }, [onReady]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Listen to download progress
  useEffect(() => {
    const off = window.localai.onPullProgress(({ status, percent }) => {
      if (typeof percent === "number") setProgress(percent);
      if (status) setStatusText(prettyStatus(status));
    });
    return () => off?.();
  }, []);

  async function startDownload() {
    setPhase("downloading");
    setProgress(0);
    setStatusText("Getting things ready…");
    const res = await window.localai.pullModel(model);
    if (res.ok) {
      setPhase("done");
      setTimeout(onReady, 800);
    } else {
      setError(res.error || "Something went wrong.");
      setPhase("needModel");
    }
  }

  return (
    <div className="h-full w-full bg-white flex items-center justify-center p-8">
      <div className="w-full max-w-md text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-50 mb-8"
        >
          <Leaf className="text-emerald-500" size={26} strokeWidth={1.5} />
        </motion.div>

        <AnimatePresence mode="wait">
          {/* ── Checking ── */}
          {phase === "checking" && (
            <Step key="checking">
              <h1 className="font-extralight text-3xl tracking-tight text-slate-900 mb-3">
                Getting set up
              </h1>
              <p className="text-slate-500 font-light leading-relaxed">
                One moment while we check that everything's ready…
              </p>
              <div className="mt-8 flex justify-center">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
            </Step>
          )}

          {/* ── Need engine (Ollama not running) ── */}
          {phase === "needEngine" && (
            <Step key="needEngine">
              <h1 className="font-extralight text-3xl tracking-tight text-slate-900 mb-3">
                One quick step
              </h1>
              <p className="text-slate-500 font-light leading-relaxed mb-8">
                for us in 10 runs on a small, free, open-source engine called{" "}
                <span className="text-slate-800">Ollama</span>. Install it once,
                open it, then come back here.
              </p>
              <div className="flex flex-col gap-3">
                <a
                  href="https://ollama.com/download"
                  className="bg-slate-900 text-white rounded-full px-8 py-3.5 text-sm font-normal inline-flex items-center justify-center gap-2 hover:bg-slate-700 transition-all no-underline"
                >
                  <Download size={15} /> Install the engine (free)
                </a>
                <button
                  onClick={refresh}
                  className="text-slate-500 font-light text-sm inline-flex items-center justify-center gap-2 hover:text-slate-900 transition-colors py-2"
                >
                  <RefreshCw size={13} /> I've done it — check again
                </button>
              </div>
              <p className="mt-8 text-xs text-slate-400 font-light flex items-center justify-center gap-1.5">
                <Shield size={12} /> Nothing leaves your computer. Ever.
              </p>
            </Step>
          )}

          {/* ── Need model ── */}
          {phase === "needModel" && (
            <Step key="needModel">
              <h1 className="font-extralight text-3xl tracking-tight text-slate-900 mb-3">
                Download your private AI
              </h1>
              <p className="text-slate-500 font-light leading-relaxed mb-2">
                This happens once. After that, it works instantly — even offline,
                even on a plane.
              </p>
              <p className="text-xs text-slate-400 font-light mb-8">
                About 3 GB · takes a few minutes
              </p>
              {error && (
                <p className="text-xs text-red-400 font-light mb-4">{error}</p>
              )}
              <button
                onClick={startDownload}
                className="bg-slate-900 text-white rounded-full px-8 py-3.5 text-sm font-normal inline-flex items-center justify-center gap-2 hover:bg-slate-700 transition-all"
              >
                Download & start <ArrowRight size={15} />
              </button>
            </Step>
          )}

          {/* ── Downloading ── */}
          {phase === "downloading" && (
            <Step key="downloading">
              <h1 className="font-extralight text-3xl tracking-tight text-slate-900 mb-3">
                Setting things up
              </h1>
              <p className="text-slate-500 font-light leading-relaxed mb-8">
                {statusText || "Downloading your private AI…"}
              </p>
              <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <motion.div
                  className="h-full bg-emerald-500 rounded-full"
                  animate={{ width: `${progress}%` }}
                  transition={{ ease: "easeOut", duration: 0.4 }}
                />
              </div>
              <p className="mt-4 text-sm text-slate-400 font-light tabular-nums">
                {progress}%
              </p>
              <p className="mt-8 text-xs text-slate-400 font-light">
                You only have to do this once.
              </p>
            </Step>
          )}

          {/* ── Done ── */}
          {phase === "done" && (
            <Step key="done">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500 mb-6"
              >
                <Check className="text-white" size={24} strokeWidth={2.5} />
              </motion.div>
              <h1 className="font-extralight text-3xl tracking-tight text-slate-900">
                You're ready
              </h1>
            </Step>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Step({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

function prettyStatus(s) {
  const t = s.toLowerCase();
  if (t.includes("pulling")) return "Downloading your private AI…";
  if (t.includes("verifying")) return "Double-checking everything…";
  if (t.includes("manifest")) return "Getting things ready…";
  if (t.includes("success")) return "Almost done…";
  return "Setting things up…";
}
