import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, Plane, Globe, Send, X, CheckCircle2, Trash2, Lock, KeyRound } from "lucide-react";

function when(ts) {
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
}

export default function PrivacyPanel({
  open,
  offline,
  onToggleOffline,
  log = [],
  grants = [],
  onRevokeGrant,
  onClear,
  onClose,
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-6"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-[var(--color-ink)]/30 backdrop-blur-sm" />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            onClick={(e) => e.stopPropagation()}
            className="relative surface rounded-2xl shadow-lift w-full max-w-xl max-h-[84vh] flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--color-brand-soft)]">
                  <ShieldCheck size={20} className="text-[var(--color-brand-deep)]" />
                </span>
                <div>
                  <h2 className="font-display text-[1.35rem] text-[var(--color-ink)] leading-tight">
                    Privacy
                  </h2>
                  <p className="text-[0.82rem] text-[var(--color-ink-soft)] font-light">
                    See exactly what does and does not leave your device.
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--color-ink-faint)] hover:bg-[var(--color-paper-2)] transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Offline mode */}
            <div className="px-6 pb-4">
              <button
                onClick={onToggleOffline}
                className={`w-full flex items-center gap-3 rounded-xl border p-3.5 text-left transition-[background-color,border-color] duration-150 ${
                  offline
                    ? "border-[var(--color-brand)] bg-[var(--color-brand-soft)]"
                    : "border-[var(--color-line)] hover:border-[var(--color-ink-faint)]"
                }`}
              >
                <span className={`inline-flex items-center justify-center w-9 h-9 rounded-lg ${offline ? "bg-[var(--color-brand)] text-white" : "bg-[var(--color-paper-2)] text-[var(--color-ink-soft)]"}`}>
                  <Plane size={17} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[0.92rem] font-medium text-[var(--color-ink)]">
                    Offline Mode {offline && "- on"}
                  </div>
                  <div className="text-[0.8rem] text-[var(--color-ink-soft)] font-light">
                    {offline
                      ? "Airtight. Web search is disabled, so nothing can leave."
                      : "Turn on to fully seal the app. Even web search is blocked."}
                  </div>
                </div>
                <span
                  className={`relative flex-shrink-0 w-10 h-6 rounded-full transition-colors ${offline ? "bg-[var(--color-brand)]" : "bg-[var(--color-line)]"}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-[left] duration-150 ${offline ? "left-[1.125rem]" : "left-0.5"}`} />
                </span>
              </button>
            </div>

            {/* Connected apps */}
            <div className="px-6 pb-4">
              <div className="flex items-center justify-between pb-2">
                <h3 className="text-[0.72rem] font-semibold text-[var(--color-ink-faint)] uppercase tracking-wide">
                  Connected apps
                </h3>
              </div>
              {grants.length === 0 ? (
                <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-2)]/45 px-3.5 py-3 flex items-center gap-3">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white text-[var(--color-ink-faint)]">
                    <KeyRound size={15} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-[0.88rem] font-medium text-[var(--color-ink)]">
                      No apps have access
                    </div>
                    <div className="text-[0.76rem] font-light text-[var(--color-ink-soft)]">
                      Apps you approve will appear here.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {grants.map((grant) => (
                    <div
                      key={grant.key}
                      className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-2)]/45 px-3.5 py-3 flex items-start gap-3"
                    >
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white text-[var(--color-brand-deep)] flex-shrink-0">
                        <KeyRound size={15} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[0.88rem] font-medium text-[var(--color-ink)] truncate">
                          {grant.appName || grant.appId}
                        </div>
                        <div className="text-[0.74rem] font-light text-[var(--color-ink-soft)] truncate">
                          {grant.origin || "local file"} - {grant.capabilities?.join(", ") || "no scopes"}
                        </div>
                      </div>
                      <button
                        onClick={() => onRevokeGrant?.(grant.key)}
                        className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-[var(--color-ink-faint)] hover:bg-white hover:text-red-500 transition-colors"
                        title="Revoke access"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Activity log */}
            <div className="flex items-center justify-between px-6 pb-2">
              <h3 className="text-[0.72rem] font-semibold text-[var(--color-ink-faint)] uppercase tracking-wide">
                What has left your device
              </h3>
              {log.length > 0 && (
                <button
                  onClick={onClear}
                  className="flex items-center gap-1 text-[0.74rem] font-medium text-[var(--color-ink-faint)] hover:text-red-500 transition-colors"
                >
                  <Trash2 size={12} /> Clear
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-2">
              {log.length === 0 ? (
                <div className="text-center py-10">
                  <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[var(--color-brand-soft)] mb-3">
                    <CheckCircle2 size={24} className="text-[var(--color-brand-deep)]" />
                  </span>
                  <p className="text-[0.95rem] font-medium text-[var(--color-ink)]">
                    Nothing has ever left this device.
                  </p>
                  <p className="text-[0.82rem] text-[var(--color-ink-soft)] font-light mt-1 max-w-xs mx-auto">
                    Your conversations, files and Brain all stay here. The only thing
                    that can ever go out is a web-search query, and only if you turn it on.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5 pb-2">
                  {log.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-start gap-3 rounded-lg bg-[var(--color-paper-2)]/60 px-3 py-2.5"
                    >
                      <span className="flex-shrink-0 mt-0.5">
                        {e.type === "search" ? (
                          <Globe size={15} className="text-[var(--color-sand)]" />
                        ) : (
                          <Send size={15} className="text-[var(--color-brand)]" />
                        )}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[0.7rem] uppercase tracking-wide text-[var(--color-ink-faint)] font-semibold">
                          {e.type === "search" ? "Web search" : "Sent out"}
                        </div>
                        <div className="text-[0.88rem] text-[var(--color-ink)] font-light break-words">
                          {e.detail}
                        </div>
                      </div>
                      <span className="flex-shrink-0 text-[0.7rem] text-[var(--color-ink-faint)] mt-0.5">
                        {when(e.ts)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer pledge */}
            <div className="px-6 py-4 border-t border-[var(--color-line-2)] flex items-center gap-2.5 text-[0.8rem] text-[var(--color-ink-soft)] font-light">
              <Lock size={14} className="text-[var(--color-brand)] flex-shrink-0" />
              We cannot train on you. The model runs entirely on your machine.
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
