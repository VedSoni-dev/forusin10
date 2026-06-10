import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, FileText, FolderPlus, FilePlus2, Trash2, Shield, Folder, UploadCloud } from "lucide-react";
import { fileKind, prettyBytes } from "../lib/utils.js";

const MAX_FILE_CHARS = 200000;
const MAX_FILES = 50;

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function ProjectPanel({
  project,
  onClose,
  onUpdate,
  onAddFiles,
  onRemoveFile,
  onDelete,
}) {
  const fileRef = useRef(null);
  const folderRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  async function ingest(fileList) {
    const files = Array.from(fileList)
      .filter((f) => fileKind(f.name) === "text")
      .slice(0, MAX_FILES);
    const out = [];
    for (const f of files) {
      let content = await f.text();
      if (content.length > MAX_FILE_CHARS)
        content = content.slice(0, MAX_FILE_CHARS) + "\n…(truncated)";
      out.push({
        id: uid(),
        name: f.webkitRelativePath || f.name,
        content,
        size: f.size,
      });
    }
    if (out.length) onAddFiles(out);
  }

  return (
    <AnimatePresence>
      {project && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/20 backdrop-blur-[2px] z-40"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={(e) => {
              if (e.currentTarget === e.target) setDragging(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (e.dataTransfer.files?.length) ingest(e.dataTransfer.files);
            }}
            className="fixed top-0 right-0 h-full w-[420px] max-w-[92vw] bg-white border-l border-slate-200 z-50 flex flex-col shadow-2xl"
          >
            {/* Drag-to-drop overlay */}
            <AnimatePresence>
              {dragging && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-3 z-10 rounded-2xl border-2 border-dashed border-emerald-400 bg-emerald-50/80 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-none"
                >
                  <UploadCloud size={32} className="text-emerald-500 mb-3" />
                  <p className="text-sm font-light text-emerald-700">
                    Drop files to add them to this project
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
            {/* Header */}
            <div className="px-6 pt-6 pb-5 border-b border-slate-100 flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-emerald-50">
                  <Folder className="text-emerald-500" size={16} strokeWidth={1.8} />
                </span>
                <h2 className="font-light text-lg tracking-tight text-slate-900">
                  Project
                </h2>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-7">
              {/* Name */}
              <div>
                <label className="block text-xs font-normal tracking-widest text-slate-400 uppercase mb-2">
                  Name
                </label>
                <input
                  value={project.name}
                  onChange={(e) => onUpdate({ name: e.target.value })}
                  placeholder="e.g. My novel, Tax 2026, Biology class"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-300 font-light"
                />
              </div>

              {/* Instructions */}
              <div>
                <label className="block text-xs font-normal tracking-widest text-slate-400 uppercase mb-2">
                  Instructions
                </label>
                <p className="text-xs font-light text-slate-400 mb-2 leading-relaxed">
                  How should the AI behave in this project? (tone, role, what to focus on)
                </p>
                <textarea
                  value={project.instructions}
                  onChange={(e) => onUpdate({ instructions: e.target.value })}
                  rows={4}
                  placeholder="e.g. You're my writing partner. Keep a warm literary tone and always suggest a next sentence."
                  className="w-full resize-none rounded-xl border border-slate-200 px-3.5 py-3 text-sm text-slate-800 outline-none focus:border-slate-300 font-light leading-relaxed"
                />
              </div>

              {/* Linked files */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-normal tracking-widest text-slate-400 uppercase">
                    Linked knowledge
                  </label>
                  <span className="text-[0.7rem] text-slate-300 font-light">
                    {project.files?.length || 0} file
                    {(project.files?.length || 0) === 1 ? "" : "s"}
                  </span>
                </div>
                <p className="text-xs font-light text-slate-400 mb-3 leading-relaxed">
                  Drop in documents or a whole folder. The AI reads them to answer —
                  and they never leave your computer.
                </p>

                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-light text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/30 transition-all"
                  >
                    <FilePlus2 size={15} className="text-emerald-500" /> Add files
                  </button>
                  <button
                    onClick={() => folderRef.current?.click()}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-light text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/30 transition-all"
                  >
                    <FolderPlus size={15} className="text-emerald-500" /> Add folder
                  </button>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    ingest(e.target.files);
                    e.target.value = "";
                  }}
                />
                <input
                  ref={(el) => {
                    folderRef.current = el;
                    if (el) {
                      // These must be set as DOM properties for folder selection.
                      el.webkitdirectory = true;
                      el.directory = true;
                    }
                  }}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    ingest(e.target.files);
                    e.target.value = "";
                  }}
                />

                {project.files?.length > 0 && (
                  <ul className="space-y-1.5">
                    {project.files.map((f) => (
                      <li
                        key={f.id}
                        className="group flex items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2"
                      >
                        <FileText size={14} className="text-slate-400 flex-shrink-0" />
                        <span className="flex-1 truncate text-[0.8rem] font-light text-slate-600">
                          {f.name}
                        </span>
                        {f.size != null && (
                          <span className="text-[0.65rem] text-slate-300">
                            {prettyBytes(f.size)}
                          </span>
                        )}
                        <button
                          onClick={() => onRemoveFile(f.id)}
                          className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all"
                        >
                          <Trash2 size={13} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[0.7rem] text-slate-400 font-light flex items-center gap-1.5">
                <Shield size={11} /> Files stay on this device
              </span>
              <button
                onClick={() => {
                  if (confirm(`Delete project "${project.name}"? Your chats will be kept.`))
                    onDelete();
                }}
                className="text-[0.72rem] font-light text-slate-400 hover:text-red-400 transition-colors"
              >
                Delete project
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
