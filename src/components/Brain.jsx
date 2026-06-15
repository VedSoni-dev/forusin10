import { motion, AnimatePresence } from "framer-motion";
import { Brain as BrainIcon, X, Trash2, Sparkles, ShieldCheck, Zap } from "lucide-react";

export default function Brain({ facts = [], onDelete, onClear, onUpgradeBrain }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-8 pt-12 pb-12">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-2">
          <div>
            <div className="inline-flex items-center gap-2 text-[0.72rem] font-medium text-[var(--color-brand-deep)] bg-[var(--color-brand-soft)] rounded-full px-3 py-1 mb-3">
              <ShieldCheck size={13} /> Stored only on your device
            </div>
            <h1 className="font-display text-[2.1rem] leading-tight text-[var(--color-ink)]">
              Your Brain
            </h1>
            <p className="text-[0.98rem] text-[var(--color-ink-soft)] mt-1 font-light">
              What it has quietly learned about you as you chat.
            </p>
          </div>
          {facts.length > 0 && (
            <button
              onClick={onClear}
              className="flex-shrink-0 flex items-center gap-1.5 text-[0.8rem] font-medium text-[var(--color-ink-faint)] hover:text-red-500 border border-[var(--color-line)] hover:border-red-200 rounded-lg px-3 py-1.5 transition-all"
            >
              <Trash2 size={14} /> Clear all
            </button>
          )}
        </div>

        {/* Facts */}
        {facts.length === 0 ? (
          <div className="surface rounded-2xl shadow-soft mt-7 px-8 py-14 text-center">
            <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--color-brand-soft)] mb-4">
              <BrainIcon size={26} className="text-[var(--color-brand-deep)]" />
            </span>
            <h3 className="font-display text-[1.3rem] text-[var(--color-ink)] mb-1.5">
              Nothing learned yet
            </h3>
            <p className="text-[0.92rem] text-[var(--color-ink-soft)] font-light max-w-sm mx-auto leading-relaxed">
              As you talk, it remembers the things that matter — your name, your
              preferences, what you're working on — so it gets more useful over time.
              All of it stays here, on your computer.
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-2.5 mt-7">
            <AnimatePresence initial={false}>
              {facts.map((f) => (
                <motion.div
                  key={f.id}
                  layout
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: f.fading ? 0.6 : 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.92 }}
                  transition={{ duration: 0.2 }}
                  className="group relative surface rounded-xl shadow-soft px-4 py-3.5 pr-9"
                >
                  <div className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-[var(--color-brand)]" />
                    <p className="text-[0.9rem] text-[var(--color-ink)] leading-relaxed font-light">
                      {f.text}
                    </p>
                  </div>
                  {f.fading && (
                    <span className="mt-1.5 ml-4 inline-block text-[0.66rem] text-[var(--color-ink-faint)] uppercase tracking-wide">
                      fading
                    </span>
                  )}
                  <button
                    onClick={() => onDelete(f.id)}
                    className="absolute top-2.5 right-2.5 w-6 h-6 rounded-md flex items-center justify-center text-[var(--color-ink-faint)] opacity-0 group-hover:opacity-100 hover:bg-[var(--color-paper-2)] hover:text-red-500 transition-all"
                    title="Forget this"
                  >
                    <X size={14} />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Pro Brain upsell */}
        <div className="mt-8 rounded-2xl p-[1px] bg-gradient-to-br from-[var(--color-brand)]/30 via-[var(--color-sand)]/30 to-transparent">
          <div className="surface rounded-2xl px-5 py-4 flex items-center gap-4">
            <span className="flex-shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-[var(--color-brand)] to-[var(--color-brand-deep)] shadow-glow">
              <Zap size={19} className="text-white" />
            </span>
            <div className="flex-1 min-w-0">
              <h4 className="font-display text-[1.05rem] text-[var(--color-ink)] flex items-center gap-2">
                Upgrade to Pro Brain
                <Sparkles size={14} className="text-[var(--color-sand)]" />
              </h4>
              <p className="text-[0.82rem] text-[var(--color-ink-soft)] font-light">
                A bigger local model for deeper reasoning and tougher tasks — still 100% on your device.
              </p>
            </div>
            <button
              onClick={onUpgradeBrain}
              className="flex-shrink-0 text-[0.82rem] font-semibold text-white bg-[var(--color-ink)] hover:bg-black rounded-lg px-4 py-2 transition-colors"
            >
              Learn more
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
