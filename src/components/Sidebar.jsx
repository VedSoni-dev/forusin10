import { Plus, MessageSquare, Trash2, Sparkles, ShieldCheck, Plane } from "lucide-react";
import { cn } from "../lib/utils.js";

export default function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  offline,
  onOpenPrivacy,
}) {
  return (
    <aside className="no-drag w-[256px] flex-shrink-0 h-full bg-[var(--color-paper-2)] border-r border-[var(--color-line)] flex flex-col">
      {/* Brand */}
      <div className="h-14 flex items-center gap-2.5 px-5">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-[10px] bg-gradient-to-br from-[var(--color-brand)] to-[var(--color-brand-deep)] shadow-glow">
          <Sparkles size={14} className="text-white" strokeWidth={2} />
        </span>
        <span className="font-display text-[1.02rem] tracking-tight text-[var(--color-ink)]">
          Private AI
        </span>
      </div>

      {/* New chat */}
      <div className="px-3 pt-1 pb-2">
        <button
          onClick={onNew}
          className={cn(
            "w-full flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all",
            !activeId
              ? "bg-[var(--color-ink)] text-white"
              : "bg-white border border-[var(--color-line)] text-[var(--color-ink-soft)] hover:border-[var(--color-ink-faint)]"
          )}
        >
          <Plus size={16} /> New chat
        </button>
      </div>

      {/* History */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {conversations.length === 0 ? (
          <p className="text-xs text-[var(--color-ink-faint)] font-light px-3 py-6 text-center leading-relaxed">
            Your chats will appear here.
          </p>
        ) : (
          conversations.map((c) => (
            <div
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={cn(
                "group flex items-center gap-2.5 rounded-xl px-3 py-2.5 mb-0.5 cursor-pointer transition-all",
                c.id === activeId
                  ? "bg-white shadow-soft border border-[var(--color-line)]"
                  : "hover:bg-white/60 border border-transparent"
              )}
            >
              <MessageSquare
                size={14}
                className={cn(
                  "flex-shrink-0",
                  c.id === activeId ? "text-[var(--color-ink-soft)]" : "text-[var(--color-ink-faint)]"
                )}
              />
              <span className="flex-1 truncate text-[0.85rem] font-light text-[var(--color-ink)]">
                {c.title}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(c.id);
                }}
                className="opacity-0 group-hover:opacity-100 text-[var(--color-ink-faint)] hover:text-red-400 transition-all flex-shrink-0"
                title="Delete chat"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Privacy — the one thing that matters */}
      <div className="px-3 py-3 border-t border-[var(--color-line)]">
        <button
          onClick={onOpenPrivacy}
          className="w-full flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left hover:bg-white/70 transition-all"
          title="See what leaves your device"
        >
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--color-brand-soft)] flex-shrink-0">
            {offline ? (
              <Plane size={14} className="text-[var(--color-brand-deep)]" />
            ) : (
              <ShieldCheck size={14} className="text-[var(--color-brand-deep)]" />
            )}
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[0.82rem] font-medium text-[var(--color-ink)]">
              {offline ? "Offline mode" : "100% private"}
            </span>
            <span className="block text-[0.7rem] font-light text-[var(--color-ink-faint)]">
              {offline ? "Nothing can leave" : "Runs on this computer"}
            </span>
          </span>
        </button>
      </div>
    </aside>
  );
}
