import { motion } from "framer-motion";
import { Home, MessagesSquare, FolderOpen, Workflow, Brain, Sparkles, ShieldCheck, Plane } from "lucide-react";

const ITEMS = [
  { id: "home", label: "Home", icon: Home },
  { id: "chat", label: "Chat", icon: MessagesSquare },
  { id: "workspace", label: "Workspace", icon: FolderOpen },
  { id: "automations", label: "Automations", icon: Workflow },
  { id: "brain", label: "Brain", icon: Brain },
];

export default function NavRail({ section, onSection, brainTier = "Core", onUpgradeBrain, offline, onOpenPrivacy }) {
  return (
    <nav className="no-drag flex flex-col items-center w-[78px] flex-shrink-0 bg-[var(--color-paper-2)] border-r border-[var(--color-line)] py-3">
      {/* Brand mark */}
      <div className="mb-4 mt-1">
        <div className="w-9 h-9 rounded-[12px] bg-gradient-to-br from-[var(--color-brand)] to-[var(--color-brand-deep)] flex items-center justify-center shadow-glow">
          <Sparkles size={17} className="text-white" strokeWidth={2} />
        </div>
      </div>

      <div className="flex flex-col gap-1 w-full px-2">
        {ITEMS.map(({ id, label, icon: Icon }) => {
          const active = section === id;
          return (
            <button
              key={id}
              onClick={() => onSection(id)}
              className="group relative flex flex-col items-center gap-1 py-2.5 rounded-xl transition-colors"
              title={label}
            >
              {active && (
                <motion.span
                  layoutId="nav-active"
                  className="absolute inset-0 rounded-xl bg-[var(--color-brand-soft)]"
                  transition={{ type: "spring", stiffness: 500, damping: 38 }}
                />
              )}
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-[var(--color-brand)]" />
              )}
              <Icon
                size={20}
                strokeWidth={active ? 2.1 : 1.8}
                className={`relative z-10 transition-colors ${
                  active
                    ? "text-[var(--color-brand-deep)]"
                    : "text-[var(--color-ink-faint)] group-hover:text-[var(--color-ink-soft)]"
                }`}
              />
              <span
                className={`relative z-10 text-[0.62rem] font-medium tracking-wide transition-colors ${
                  active
                    ? "text-[var(--color-brand-deep)]"
                    : "text-[var(--color-ink-faint)] group-hover:text-[var(--color-ink-soft)]"
                }`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Privacy — the visible-trust affordance */}
      <button
        onClick={onOpenPrivacy}
        className="no-drag mt-auto group flex flex-col items-center gap-1 px-2 py-2 rounded-xl hover:bg-white/60 transition-colors"
        title={offline ? "Offline Mode is on — nothing can leave" : "Privacy — see what leaves your device"}
      >
        <span className="relative flex items-center justify-center w-9 h-9 rounded-full border border-[var(--color-line)] bg-white">
          {offline ? (
            <Plane size={16} className="text-[var(--color-brand-deep)]" />
          ) : (
            <ShieldCheck size={16} className="text-[var(--color-brand)]" />
          )}
        </span>
        <span className="text-[0.6rem] font-medium text-[var(--color-ink-faint)] group-hover:text-[var(--color-ink-soft)]">
          {offline ? "Offline" : "Private"}
        </span>
      </button>

      {/* Brain tier — the "Pro Brain" upgrade affordance */}
      <button
        onClick={onUpgradeBrain}
        className="no-drag group flex flex-col items-center gap-1 px-2 py-2 mt-1 rounded-xl hover:bg-white/60 transition-colors"
        title="Your AI engine"
      >
        <span className="relative flex items-center justify-center w-9 h-9 rounded-full border border-[var(--color-line)] bg-white">
          <Brain size={16} className="text-[var(--color-brand)]" />
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[var(--color-brand)] border-2 border-white" />
        </span>
        <span className="text-[0.6rem] font-medium text-[var(--color-ink-faint)] group-hover:text-[var(--color-ink-soft)]">
          {brainTier}
        </span>
      </button>
    </nav>
  );
}
