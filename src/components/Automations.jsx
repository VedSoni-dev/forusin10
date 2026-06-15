import { Workflow, Plus, Play, Pencil, Webhook, Send, Settings2 } from "lucide-react";

export default function Automations({
  templates = [],
  connectors = [],
  onRunTemplate,
  onEditTemplates,
  onManageConnectors,
}) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-8 pt-12 pb-12">
        <div className="mb-8">
          <h1 className="font-display text-[2.1rem] leading-tight text-[var(--color-ink)]">
            Automations
          </h1>
          <p className="text-[0.98rem] text-[var(--color-ink-soft)] mt-1 font-light">
            One-tap workflows, and the places your results can go.
          </p>
        </div>

        {/* Workflows */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="flex items-center gap-2 text-[0.78rem] font-semibold text-[var(--color-ink-faint)] uppercase tracking-wide">
            <Workflow size={14} /> Workflows
          </h2>
          <button
            onClick={onEditTemplates}
            className="flex items-center gap-1.5 text-[0.8rem] font-medium text-[var(--color-brand-deep)] hover:bg-[var(--color-brand-soft)] rounded-lg px-2.5 py-1.5 transition-all"
          >
            <Plus size={14} /> New / edit
          </button>
        </div>
        <div className="grid sm:grid-cols-2 gap-2.5 mb-9">
          {templates.map((t) => (
            <div
              key={t.id || t.title}
              className="group surface rounded-xl shadow-soft p-3.5 flex items-center gap-3 hover:shadow-lift transition-all"
            >
              <span className="flex-shrink-0 w-10 h-10 rounded-xl bg-[var(--color-paper-2)] flex items-center justify-center text-lg">
                {t.emoji || "⚡"}
              </span>
              <div className="flex-1 min-w-0">
                <h3 className="text-[0.92rem] font-medium text-[var(--color-ink)] truncate">
                  {t.title}
                </h3>
                <p className="text-[0.76rem] text-[var(--color-ink-faint)] truncate font-light">
                  {(t.prompt || "").replace(/\{\{input\}\}/g, "…").slice(0, 60)}
                </p>
              </div>
              <button
                onClick={() => onRunTemplate(t)}
                className="flex-shrink-0 flex items-center gap-1.5 text-[0.8rem] font-semibold text-white bg-[var(--color-brand)] hover:bg-[var(--color-brand-deep)] rounded-lg px-3 py-1.5 transition-colors"
              >
                <Play size={13} fill="currentColor" /> Run
              </button>
            </div>
          ))}
          <button
            onClick={onEditTemplates}
            className="surface rounded-xl border-dashed flex items-center justify-center gap-2 p-3.5 text-[0.85rem] font-medium text-[var(--color-ink-faint)] hover:text-[var(--color-brand-deep)] hover:border-[var(--color-brand)] transition-all min-h-[68px]"
          >
            <Plus size={16} /> New workflow
          </button>
        </div>

        {/* Connectors */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="flex items-center gap-2 text-[0.78rem] font-semibold text-[var(--color-ink-faint)] uppercase tracking-wide">
            <Send size={14} /> Send results to
          </h2>
          <button
            onClick={onManageConnectors}
            className="flex items-center gap-1.5 text-[0.8rem] font-medium text-[var(--color-brand-deep)] hover:bg-[var(--color-brand-soft)] rounded-lg px-2.5 py-1.5 transition-all"
          >
            <Settings2 size={14} /> Manage
          </button>
        </div>
        {connectors.length === 0 ? (
          <button
            onClick={onManageConnectors}
            className="w-full surface rounded-xl border-dashed flex items-center justify-center gap-2 p-5 text-[0.85rem] font-medium text-[var(--color-ink-faint)] hover:text-[var(--color-brand-deep)] hover:border-[var(--color-brand)] transition-all"
          >
            <Webhook size={16} /> Connect Slack, Discord or any webhook
          </button>
        ) : (
          <div className="grid sm:grid-cols-2 gap-2.5">
            {connectors.map((c) => (
              <div
                key={c.id}
                className="surface rounded-xl shadow-soft p-3.5 flex items-center gap-3"
              >
                <span className="flex-shrink-0 w-9 h-9 rounded-lg bg-[var(--color-brand-soft)] flex items-center justify-center">
                  <Webhook size={16} className="text-[var(--color-brand-deep)]" />
                </span>
                <span className="flex-1 truncate text-[0.9rem] text-[var(--color-ink)] font-light">
                  {c.name}
                </span>
                <button
                  onClick={onManageConnectors}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--color-ink-faint)] hover:bg-[var(--color-paper-2)] hover:text-[var(--color-ink-soft)] transition-all"
                >
                  <Pencil size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
