import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  CheckCircle2,
  Cpu,
  Database,
  Globe,
  KeyRound,
  Lock,
  Plane,
  RefreshCw,
  Settings,
  ShieldCheck,
  Trash2,
  Download,
  X,
} from "lucide-react";

function DetailRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-[var(--color-line-2)] last:border-b-0">
      <span className="text-[0.76rem] font-light text-[var(--color-ink-faint)]">
        {label}
      </span>
      <span className="text-[0.82rem] font-medium text-[var(--color-ink)] truncate">
        {value}
      </span>
    </div>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <section className="py-4 border-t border-[var(--color-line-2)] first:border-t-0 first:pt-0">
      <div className="flex items-center gap-2 mb-3">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--color-brand-soft)] text-[var(--color-brand-deep)]">
          <Icon size={14} />
        </span>
        <h3 className="text-[0.84rem] font-medium text-[var(--color-ink)]">
          {title}
        </h3>
      </div>
      {children}
    </section>
  );
}

function ToggleRow({ icon: Icon, title, detail, active, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-[background-color,border-color] duration-150 disabled:cursor-not-allowed disabled:opacity-60 ${
        active
          ? "border-[var(--color-brand)] bg-[var(--color-brand-soft)]"
          : "border-[var(--color-line)] hover:border-[var(--color-ink-faint)]"
      }`}
    >
      <span
        className={`inline-flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0 ${
          active
            ? "bg-[var(--color-brand)] text-white"
            : "bg-[var(--color-paper-2)] text-[var(--color-ink-soft)]"
        }`}
      >
        <Icon size={17} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[0.9rem] font-medium text-[var(--color-ink)]">
          {title}
        </span>
        <span className="block text-[0.76rem] font-light text-[var(--color-ink-soft)]">
          {detail}
        </span>
      </span>
      <span
        className={`relative flex-shrink-0 w-10 h-6 rounded-full transition-colors ${
          active ? "bg-[var(--color-brand)]" : "bg-[var(--color-line)]"
        }`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-[left] duration-150 ${
            active ? "left-[1.125rem]" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}

function ActionButton({ children, onClick, danger, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[0.78rem] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        danger
          ? "text-red-500 hover:bg-red-50"
          : "text-[var(--color-ink-soft)] hover:bg-[var(--color-paper-2)] hover:text-[var(--color-ink)]"
      }`}
    >
      {children}
    </button>
  );
}

export default function SettingsPanel({
  open,
  runtimeState,
  model,
  webSearchOn,
  offline,
  conversationsCount,
  privacyLogCount,
  grants = [],
  memoryFacts = [],
  canManageMemory,
  onRefreshRuntime,
  onToggleWebSearch,
  onToggleOffline,
  onClearConversations,
  onClearPrivacyLog,
  onClearMemory,
  onExportConversations,
  onRevokeGrant,
  onClose,
}) {
  const [refreshing, setRefreshing] = useState(false);
  const connected = Boolean(runtimeState?.connected);

  async function refresh() {
    if (!onRefreshRuntime) return;
    setRefreshing(true);
    try {
      await onRefreshRuntime();
    } finally {
      setRefreshing(false);
    }
  }

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
            className="relative surface rounded-2xl shadow-lift w-full max-w-2xl max-h-[86vh] flex flex-col overflow-hidden"
          >
            <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--color-brand-soft)]">
                  <Settings size={20} className="text-[var(--color-brand-deep)]" />
                </span>
                <div className="min-w-0">
                  <h2 className="font-display text-[1.35rem] text-[var(--color-ink)] leading-tight">
                    Settings
                  </h2>
                  <p className="text-[0.82rem] text-[var(--color-ink-soft)] font-light">
                    Runtime, privacy and local data controls.
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--color-ink-faint)] hover:bg-[var(--color-paper-2)] transition-colors"
                title="Close settings"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-2">
              <Section icon={Cpu} title="Runtime">
                <div
                  className={`rounded-xl border px-3.5 py-3 mb-3 flex items-center gap-3 ${
                    connected
                      ? "border-emerald-100 bg-emerald-50"
                      : "border-amber-100 bg-amber-50"
                  }`}
                >
                  <span
                    className={`inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white ${
                      connected ? "text-emerald-600" : "text-amber-700"
                    }`}
                  >
                    {connected ? <CheckCircle2 size={17} /> : <RefreshCw size={16} />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div
                      className={`text-[0.9rem] font-medium ${
                        connected ? "text-emerald-800" : "text-amber-900"
                      }`}
                    >
                      {connected ? "Local runtime connected" : "Runtime needs attention"}
                    </div>
                    <div
                      className={`text-[0.76rem] font-light truncate ${
                        connected ? "text-emerald-700" : "text-amber-800"
                      }`}
                    >
                      {runtimeState?.label || "Runtime status unavailable"}
                    </div>
                  </div>
                  <ActionButton onClick={refresh} disabled={refreshing}>
                    <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
                    Refresh
                  </ActionButton>
                </div>
                <div className="rounded-xl border border-[var(--color-line)] px-3.5 bg-white">
                  <DetailRow label="Mode" value={runtimeState?.mode || "unknown"} />
                  <DetailRow label="Model" value={model || "unknown"} />
                  <DetailRow label="Connection" value={connected ? "ready" : "not ready"} />
                </div>
              </Section>

              <Section icon={ShieldCheck} title="Privacy">
                <div className="space-y-2">
                  <ToggleRow
                    icon={Plane}
                    title={offline ? "Offline Mode on" : "Offline Mode off"}
                    detail={
                      offline
                        ? "Web search is sealed off. Nothing can leave."
                        : "Turn on to block every online path."
                    }
                    active={offline}
                    onClick={onToggleOffline}
                  />
                  <ToggleRow
                    icon={Globe}
                    title={webSearchOn && !offline ? "Web search allowed" : "Web search blocked"}
                    detail={
                      offline
                        ? "Disabled while Offline Mode is on."
                        : webSearchOn
                          ? "Fresh questions may send one search query online."
                          : "Questions stay local unless you opt in."
                    }
                    active={webSearchOn && !offline}
                    disabled={offline}
                    onClick={onToggleWebSearch}
                  />
                </div>
              </Section>

              <Section icon={KeyRound} title="Connected Apps">
                {grants.length === 0 ? (
                  <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-2)]/45 px-3.5 py-3 text-[0.82rem] font-light text-[var(--color-ink-soft)]">
                    No apps have access to this runtime.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {grants.map((grant) => (
                      <div
                        key={grant.key}
                        className="rounded-xl border border-[var(--color-line)] bg-white px-3.5 py-3 flex items-start gap-3"
                      >
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--color-paper-2)] text-[var(--color-brand-deep)] flex-shrink-0">
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
                          className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-[var(--color-ink-faint)] hover:bg-red-50 hover:text-red-500 transition-colors"
                          title="Revoke access"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              <Section icon={Database} title="Local Data">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                  <div className="rounded-xl border border-[var(--color-line)] px-3 py-2.5">
                    <div className="text-[1.15rem] font-medium text-[var(--color-ink)]">
                      {conversationsCount}
                    </div>
                    <div className="text-[0.72rem] font-light text-[var(--color-ink-faint)]">
                      chats saved here
                    </div>
                  </div>
                  <div className="rounded-xl border border-[var(--color-line)] px-3 py-2.5">
                    <div className="text-[1.15rem] font-medium text-[var(--color-ink)]">
                      {privacyLogCount}
                    </div>
                    <div className="text-[0.72rem] font-light text-[var(--color-ink-faint)]">
                      privacy log entries
                    </div>
                  </div>
                  <div className="rounded-xl border border-[var(--color-line)] px-3 py-2.5">
                    <div className="text-[1.15rem] font-medium text-[var(--color-ink)]">
                      {canManageMemory ? memoryFacts.length : "N/A"}
                    </div>
                    <div className="text-[0.72rem] font-light text-[var(--color-ink-faint)]">
                      local memories
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  <ActionButton
                    onClick={onExportConversations}
                    disabled={conversationsCount === 0}
                  >
                    <Download size={13} />
                    Export chats
                  </ActionButton>
                  <ActionButton
                    onClick={onClearConversations}
                    danger
                    disabled={conversationsCount === 0}
                  >
                    <Trash2 size={13} />
                    Clear chats
                  </ActionButton>
                  <ActionButton
                    onClick={onClearPrivacyLog}
                    danger
                    disabled={privacyLogCount === 0}
                  >
                    <Trash2 size={13} />
                    Clear privacy log
                  </ActionButton>
                  <ActionButton
                    onClick={onClearMemory}
                    danger
                    disabled={!canManageMemory || memoryFacts.length === 0}
                  >
                    <Trash2 size={13} />
                    Clear memory
                  </ActionButton>
                </div>
              </Section>
            </div>

            <div className="px-6 py-4 border-t border-[var(--color-line-2)] flex items-center gap-2.5 text-[0.8rem] text-[var(--color-ink-soft)] font-light">
              <Lock size={14} className="text-[var(--color-brand)] flex-shrink-0" />
              Settings affect only this computer.
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
