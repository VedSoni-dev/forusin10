import { Plus, MessageSquare, Trash2, Sparkles, ShieldCheck, Plane, Settings } from "lucide-react";
import { cn } from "../lib/utils.js";

export default function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  offline,
  onOpenPrivacy,
  onOpenSettings,
}) {
  return (
    <aside className="no-drag w-[72px] sm:w-[256px] flex-shrink-0 h-full bg-[var(--color-paper-2)] border-r border-[var(--color-line)] flex flex-col">
      {/* Brand */}
      <div className="h-14 flex items-center justify-center sm:justify-start gap-2.5 px-3 sm:px-5">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-[10px] bg-[var(--color-ink)]">
          <Sparkles size={14} className="text-white" strokeWidth={2} />
        </span>
        <span className="hidden sm:inline font-display text-[1.02rem] tracking-tight text-[var(--color-ink)]">
          for us in 10
        </span>
      </div>

      {/* New chat */}
      <div className="px-2 sm:px-3 pt-1 pb-2">
        <button
          onClick={onNew}
          className={cn(
            "w-full flex items-center justify-center sm:justify-start gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-[background-color,border-color,color] duration-150",
            !activeId
              ? "bg-[var(--color-ink)] text-white"
              : "bg-white border border-[var(--color-line)] text-[var(--color-ink-soft)] hover:border-[var(--color-ink-faint)]"
          )}
          title="New chat"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">New chat</span>
        </button>
      </div>

      {/* History */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {conversations.length === 0 ? (
          <p className="hidden sm:block text-xs text-[var(--color-ink-faint)] font-light px-3 py-6 text-center leading-relaxed">
            Your chats will appear here.
          </p>
        ) : (
          conversations.map((c) => (
            <div
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={cn(
                "group flex items-center justify-center sm:justify-start gap-2.5 rounded-xl px-3 py-2.5 mb-0.5 cursor-pointer transition-[background-color,border-color] duration-150",
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
              <span className="hidden sm:block flex-1 truncate text-[0.85rem] font-light text-[var(--color-ink)]">
                {c.title}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(c.id);
                }}
                className="hidden sm:block opacity-0 group-hover:opacity-100 focus:opacity-100 text-[var(--color-ink-faint)] hover:text-red-400 transition-opacity duration-150 flex-shrink-0"
                title="Delete chat"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Privacy - the one thing that matters */}
      <div className="px-2 sm:px-3 py-3 border-t border-[var(--color-line)] space-y-1">
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center justify-center sm:justify-start gap-2.5 rounded-xl px-3 py-2.5 text-left hover:bg-white/70 transition-colors duration-150"
          title="Open settings"
        >
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-white border border-[var(--color-line)] text-[var(--color-ink-soft)] flex-shrink-0">
            <Settings size={14} />
          </span>
          <span className="hidden sm:block flex-1 min-w-0">
            <span className="block text-[0.82rem] font-medium text-[var(--color-ink)]">
              Settings
            </span>
            <span className="block text-[0.7rem] font-light text-[var(--color-ink-faint)]">
              Runtime and data
            </span>
          </span>
        </button>
        <button
          onClick={onOpenPrivacy}
          className="w-full flex items-center justify-center sm:justify-start gap-2.5 rounded-xl px-3 py-2.5 text-left hover:bg-white/70 transition-colors duration-150"
          title="See what leaves your device"
        >
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--color-brand-soft)] flex-shrink-0">
            {offline ? (
              <Plane size={14} className="text-[var(--color-brand-deep)]" />
            ) : (
              <ShieldCheck size={14} className="text-[var(--color-brand-deep)]" />
            )}
          </span>
          <span className="hidden sm:block flex-1 min-w-0">
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
