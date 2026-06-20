import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, HardDrive, Loader2, ShieldCheck, WifiOff } from "lucide-react";

export default function Onboarding({ model, onReady }) {
  const [phase, setPhase] = useState("starting");
  const [pct, setPct] = useState(0);
  const [statusLabel, setStatusLabel] = useState("Preparing your private AI");
  const [error, setError] = useState("");
  const cancelledRef = useRef(false);

  useEffect(() => {
    const off = window.localai?.onPullProgress?.(({ status, percent }) => {
      if (typeof percent === "number") setPct(percent);
      if (status) setStatusLabel(prettyStatus(status));
    });
    return () => off?.();
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    runSetup();
    return () => {
      cancelledRef.current = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function runSetup() {
    setPhase("starting");
    setError("");
    setPct(0);
    setStatusLabel("Starting the local engine");

    let attempts = 0;
    while (!cancelledRef.current) {
      const s = await window.localai?.status?.().catch(() => null);
      if (s?.hasModel) {
        setPhase("done");
        setTimeout(onReady, 700);
        return;
      }
      if (s?.running) break;
      await sleep(1000);
      if (++attempts > 60) {
        setError("The local AI engine did not start. Restart the app, then try again.");
        setPhase("error");
        return;
      }
    }
    if (cancelledRef.current) return;

    setPhase("downloading");
    setStatusLabel("Downloading the private model");
    const res = await window.localai?.pullModel?.(model).catch((e) => ({
      ok: false,
      error: String(e?.message || e),
    }));

    if (cancelledRef.current) return;

    if (res?.ok) {
      setPhase("done");
      setTimeout(onReady, 900);
    } else {
      setError(res?.error || "The model download failed. Check your connection and try again.");
      setPhase("error");
    }
  }

  return (
    <div className="h-full w-full bg-white flex items-center justify-center p-6">
      <div className="w-full max-w-4xl grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="min-w-0"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-1.5 text-[0.76rem] font-medium text-[var(--color-ink-soft)] mb-5">
            <ShieldCheck size={14} className="text-[var(--color-brand-deep)]" />
            One-time local setup
          </div>
          <h1 className="font-display text-[clamp(2.2rem,4.8vw,4.3rem)] leading-[0.98] text-[var(--color-ink)] max-w-[10ch] mb-4">
            Make this computer yours.
          </h1>
          <p className="text-[1rem] leading-relaxed text-[var(--color-ink-soft)] font-light max-w-[58ch]">
            The app starts a private AI engine and stores the model on this device. After setup, chat works without accounts or subscriptions.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-7">
            <SetupFact icon={HardDrive} label="Stored locally" />
            <SetupFact icon={WifiOff} label="Works offline" />
            <SetupFact icon={ShieldCheck} label="No cloud account" />
          </div>
        </motion.div>

        <div className="surface rounded-2xl p-5 shadow-soft">
          <AnimatePresence mode="wait">
            {phase === "starting" && (
              <SetupStep key="starting">
                <Loader2 className="text-[var(--color-brand)] animate-spin" size={26} />
                <div>
                  <h2 className="text-[1rem] font-medium text-[var(--color-ink)]">Starting the engine</h2>
                  <p className="text-[0.84rem] text-[var(--color-ink-soft)] font-light mt-1">
                    This usually takes a few seconds.
                  </p>
                </div>
              </SetupStep>
            )}

            {phase === "downloading" && (
              <SetupStep key="downloading">
                <Loader2 className="text-[var(--color-brand)] animate-spin" size={26} />
                <div className="flex-1 min-w-0">
                  <h2 className="text-[1rem] font-medium text-[var(--color-ink)]">{statusLabel}</h2>
                  <p className="text-[0.84rem] text-[var(--color-ink-soft)] font-light mt-1">
                    About 3.2 GB. Keep the app open.
                  </p>
                  <div className="w-full h-1.5 rounded-full bg-[var(--color-paper-2)] overflow-hidden mt-5">
                    <motion.div
                      className="h-full bg-[var(--color-brand)] rounded-full"
                      animate={{ width: `${pct}%` }}
                      transition={{ ease: "easeOut", duration: 0.4 }}
                    />
                  </div>
                  <p className="text-[0.76rem] text-[var(--color-ink-faint)] font-light tabular-nums mt-2">
                    {pct}% complete
                  </p>
                </div>
              </SetupStep>
            )}

            {phase === "done" && (
              <SetupStep key="done">
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[var(--color-brand)]">
                  <Check className="text-white" size={20} strokeWidth={2.5} />
                </span>
                <div>
                  <h2 className="text-[1rem] font-medium text-[var(--color-ink)]">Ready</h2>
                  <p className="text-[0.84rem] text-[var(--color-ink-soft)] font-light mt-1">
                    Your private AI is set up on this computer.
                  </p>
                </div>
              </SetupStep>
            )}

            {phase === "error" && (
              <SetupStep key="error">
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-red-50 text-red-500">
                  !
                </span>
                <div className="flex-1 min-w-0">
                  <h2 className="text-[1rem] font-medium text-[var(--color-ink)]">Setup stopped</h2>
                  <p className="text-[0.84rem] text-red-500 font-light mt-1">{error}</p>
                  <button
                    onClick={runSetup}
                    className="mt-5 rounded-full bg-[var(--color-ink)] text-white px-5 py-2 text-[0.78rem] font-medium hover:bg-slate-700 transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)]"
                  >
                    Try again
                  </button>
                </div>
              </SetupStep>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function SetupFact({ icon: Icon, label }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2.5 text-[0.8rem] text-[var(--color-ink-soft)]">
      <Icon size={15} className="text-[var(--color-brand-deep)] flex-shrink-0" />
      <span className="truncate">{label}</span>
    </div>
  );
}

function SetupStep({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="flex items-start gap-4"
    >
      {children}
    </motion.div>
  );
}

function prettyStatus(s) {
  const t = s.toLowerCase();
  if (t.includes("pulling")) return "Downloading the private model";
  if (t.includes("verifying")) return "Verifying the download";
  if (t.includes("manifest")) return "Checking the model version";
  if (t.includes("success")) return "Finishing setup";
  return "Setting things up";
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
