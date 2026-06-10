import { Plus, MessageSquare, Trash2, Leaf, Shield, Folder, Settings2, MessagesSquare, Share2 } from "lucide-react";
import { cn } from "../lib/utils.js";

export default function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  projects = [],
  activeProjectId = null,
  onSelectProject,
  onNewProject,
  onProjectSettings,
  onOpenSharing,
}) {
  return (
    <aside className="w-[260px] flex-shrink-0 h-full bg-slate-50 border-r border-slate-200 flex flex-col">
      {/* Brand */}
      <div className="h-14 flex items-center gap-2 px-5 border-b border-slate-200">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-emerald-50">
          <Leaf className="text-emerald-500" size={14} strokeWidth={1.8} />
        </span>
        <span className="font-light text-sm tracking-tight text-slate-900">
          for us in <span className="font-normal">10</span>
        </span>
      </div>

      {/* New chat */}
      <div className="p-3 pb-2">
        <button
          onClick={onNew}
          className={cn(
            "w-full flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-normal transition-all",
            !activeId
              ? "bg-slate-900 text-white"
              : "bg-white border border-slate-200 text-slate-700 hover:border-slate-300"
          )}
        >
          <Plus size={16} /> New chat
        </button>
      </div>

      {/* Projects */}
      <div className="px-3 pb-1">
        <div className="flex items-center justify-between px-1.5 mb-1">
          <span className="text-[0.65rem] font-normal tracking-widest text-slate-400 uppercase">
            Projects
          </span>
          <button
            onClick={onNewProject}
            className="text-slate-400 hover:text-slate-700 transition-colors"
            title="New project"
          >
            <Plus size={14} />
          </button>
        </div>

        {/* All chats (no project) */}
        <div
          onClick={() => onSelectProject(null)}
          className={cn(
            "flex items-center gap-2.5 rounded-lg px-2.5 py-2 cursor-pointer transition-all text-[0.82rem] font-light",
            activeProjectId === null
              ? "bg-white shadow-sm border border-slate-200 text-slate-800"
              : "text-slate-500 hover:bg-white/60 border border-transparent"
          )}
        >
          <MessagesSquare size={14} className="text-slate-400 flex-shrink-0" />
          All chats
        </div>

        {projects.map((p) => (
          <div
            key={p.id}
            onClick={() => onSelectProject(p.id)}
            className={cn(
              "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 cursor-pointer transition-all",
              p.id === activeProjectId
                ? "bg-white shadow-sm border border-slate-200"
                : "hover:bg-white/60 border border-transparent"
            )}
          >
            <Folder
              size={14}
              className={cn(
                "flex-shrink-0",
                p.id === activeProjectId ? "text-emerald-500" : "text-slate-400"
              )}
            />
            <span className="flex-1 truncate text-[0.82rem] font-light text-slate-700">
              {p.name}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onProjectSettings(p.id);
              }}
              className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-slate-600 transition-all flex-shrink-0"
              title="Project settings"
            >
              <Settings2 size={13} />
            </button>
          </div>
        ))}
      </div>

      <div className="mx-3 my-2 border-t border-slate-200/70" />

      {/* History */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {conversations.length === 0 ? (
          <p className="text-xs text-slate-400 font-light px-3 py-6 text-center leading-relaxed">
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
                  ? "bg-white shadow-sm border border-slate-200"
                  : "hover:bg-white/60 border border-transparent"
              )}
            >
              <MessageSquare
                size={14}
                className={cn(
                  "flex-shrink-0",
                  c.id === activeId ? "text-slate-700" : "text-slate-400"
                )}
              />
              <span className="flex-1 truncate text-[0.82rem] font-light text-slate-700">
                {c.title}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(c.id);
                }}
                className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all flex-shrink-0"
                title="Delete chat"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Sharing */}
      <div className="px-3 pt-2">
        <button
          onClick={onOpenSharing}
          className="w-full flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-light text-slate-600 hover:bg-white hover:border-slate-200 border border-transparent transition-all"
        >
          <Share2 size={15} className="text-slate-400" />
          Sharing
        </button>
      </div>

      {/* Privacy footer */}
      <div className="px-5 py-4 border-t border-slate-200 mt-1">
        <p className="text-[0.7rem] text-slate-400 font-light flex items-center gap-1.5 leading-relaxed">
          <Shield size={11} className="flex-shrink-0" />
          100% private · runs on this computer
        </p>
      </div>
    </aside>
  );
}
