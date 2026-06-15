import { FolderOpen, Plus, Settings2, FileText, ArrowRight, FolderSearch } from "lucide-react";

export default function Workspace({ projects = [], onNewProject, onOpenSettings, onEnterProject, onLinkFolder }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-8 pt-12 pb-12">
        <div className="flex items-end justify-between gap-4 mb-7">
          <div>
            <h1 className="font-display text-[2.1rem] leading-tight text-[var(--color-ink)]">
              Workspace
            </h1>
            <p className="text-[0.98rem] text-[var(--color-ink-soft)] mt-1 font-light">
              Spaces that group your chats, files and instructions — so it works the way each project needs.
            </p>
          </div>
          <button
            onClick={onNewProject}
            className="flex-shrink-0 flex items-center gap-1.5 text-[0.85rem] font-semibold text-white bg-[var(--color-ink)] hover:bg-black rounded-xl px-4 py-2.5 transition-colors shadow-soft"
          >
            <Plus size={16} /> New space
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="surface rounded-2xl shadow-soft px-8 py-14 text-center">
            <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[var(--color-brand-soft)] mb-4">
              <FolderOpen size={26} className="text-[var(--color-brand-deep)]" />
            </span>
            <h3 className="font-display text-[1.3rem] text-[var(--color-ink)] mb-1.5">
              No spaces yet
            </h3>
            <p className="text-[0.92rem] text-[var(--color-ink-soft)] font-light max-w-sm mx-auto leading-relaxed mb-5">
              Create a space for a project, then add files and instructions. Every
              chat inside it inherits that context automatically.
            </p>
            <button
              onClick={onNewProject}
              className="inline-flex items-center gap-1.5 text-[0.85rem] font-semibold text-[var(--color-brand-deep)] bg-[var(--color-brand-soft)] hover:brightness-95 rounded-xl px-4 py-2.5 transition-all"
            >
              <Plus size={16} /> Create your first space
            </button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {projects.map((p) => (
              <div
                key={p.id}
                className="group surface rounded-2xl shadow-soft hover:shadow-lift transition-all overflow-hidden"
              >
                <button
                  onClick={() => onEnterProject(p.id)}
                  className="w-full text-left p-4"
                >
                  <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-[var(--color-brand-soft)] mb-3">
                    <FolderOpen size={17} className="text-[var(--color-brand-deep)]" />
                  </span>
                  <h3 className="font-display text-[1.1rem] text-[var(--color-ink)] leading-snug truncate">
                    {p.name || "Untitled space"}
                  </h3>
                  <p className="text-[0.8rem] text-[var(--color-ink-soft)] font-light line-clamp-2 mt-1 min-h-[2.2em]">
                    {p.instructions?.trim() || "No instructions yet."}
                  </p>
                </button>
                <div className="flex items-center justify-between px-4 py-2.5 border-t border-[var(--color-line-2)]">
                  <span className="flex items-center gap-1.5 text-[0.75rem] text-[var(--color-ink-faint)]">
                    <FileText size={13} /> {p.files?.length || 0} file{p.files?.length === 1 ? "" : "s"}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onLinkFolder?.(p.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--color-ink-faint)] hover:bg-[var(--color-brand-soft)] hover:text-[var(--color-brand-deep)] transition-all"
                      title="Add a folder of files"
                    >
                      <FolderSearch size={15} />
                    </button>
                    <button
                      onClick={() => onOpenSettings(p.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--color-ink-faint)] hover:bg-[var(--color-paper-2)] hover:text-[var(--color-ink-soft)] transition-all"
                      title="Space settings"
                    >
                      <Settings2 size={15} />
                    </button>
                    <button
                      onClick={() => onEnterProject(p.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--color-ink-faint)] group-hover:text-[var(--color-brand)] hover:bg-[var(--color-brand-soft)] transition-all"
                      title="Open"
                    >
                      <ArrowRight size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
