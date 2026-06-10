import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Zap, Plus, Trash2, Pencil, ArrowRight } from "lucide-react";

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const EMOJI_CHOICES = ["✨", "📝", "✍️", "💡", "✉️", "✅", "🔍", "🧠", "📊", "🐛", "🌱", "⚡"];

export default function TemplatesPanel({ open, templates, connectors = [], onClose, onUse, onSave, onDelete }) {
  const [editing, setEditing] = useState(null); // template being edited/created

  function startNew() {
    setEditing({ id: uid(), emoji: "✨", title: "", prompt: "" });
  }
  function commit() {
    if (!editing.title.trim() || !editing.prompt.trim()) return;
    onSave(editing);
    setEditing(null);
  }

  return (
    <AnimatePresence>
      {open && (
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
            className="fixed top-0 right-0 h-full w-[400px] max-w-[92vw] bg-white border-l border-slate-200 z-50 flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="px-6 pt-6 pb-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-emerald-50">
                  <Zap className="text-emerald-500" size={16} strokeWidth={1.8} />
                </span>
                <h2 className="font-light text-lg tracking-tight text-slate-900">Templates</h2>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              {editing ? (
                /* ── Editor ── */
                <div className="px-2 space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      {EMOJI_CHOICES.map((e) => (
                        <button
                          key={e}
                          onClick={() => setEditing({ ...editing, emoji: e })}
                          className={
                            "w-8 h-8 rounded-lg text-base flex items-center justify-center transition-all " +
                            (editing.emoji === e ? "bg-emerald-100 ring-1 ring-emerald-300" : "hover:bg-slate-100")
                          }
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>
                  <input
                    autoFocus
                    value={editing.title}
                    onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                    placeholder="Template name (e.g. Summarize)"
                    className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-300 font-light"
                  />
                  <div>
                    <textarea
                      value={editing.prompt}
                      onChange={(e) => setEditing({ ...editing, prompt: e.target.value })}
                      rows={6}
                      placeholder={"Summarize the following clearly:\n\n{{input}}"}
                      className="w-full resize-none rounded-xl border border-slate-200 px-3.5 py-3 text-sm text-slate-800 outline-none focus:border-slate-300 font-light leading-relaxed"
                    />
                    <p className="text-[0.7rem] font-light text-slate-400 mt-1.5">
                      Tip: put <code className="bg-slate-100 px-1 rounded">{"{{input}}"}</code> where
                      your text should go — the cursor lands there.
                    </p>
                  </div>

                  {/* Where the result usually goes */}
                  {connectors.length > 0 && (
                    <div>
                      <label className="block text-xs font-normal tracking-widest text-slate-400 uppercase mb-2">
                        Usually send result to
                      </label>
                      <select
                        value={editing.defaultConnectorId || ""}
                        onChange={(e) =>
                          setEditing({ ...editing, defaultConnectorId: e.target.value || null })
                        }
                        className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-300 font-light bg-white"
                      >
                        <option value="">Ask me each time</option>
                        {connectors.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <p className="text-[0.7rem] font-light text-slate-400 mt-1.5">
                        Replies from this template will offer a one-click send here.
                      </p>
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={commit}
                      className="flex-1 bg-slate-900 text-white rounded-full px-4 py-2.5 text-sm font-normal hover:bg-slate-700 transition-all"
                    >
                      Save template
                    </button>
                    <button
                      onClick={() => setEditing(null)}
                      className="px-4 py-2.5 text-sm font-light text-slate-500 hover:text-slate-800"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* ── List ── */
                <>
                  <button
                    onClick={startNew}
                    className="w-full flex items-center gap-2.5 rounded-xl border border-dashed border-slate-300 px-3.5 py-3 text-sm font-light text-slate-500 hover:border-emerald-300 hover:text-emerald-600 transition-all mb-3"
                  >
                    <Plus size={15} /> New template
                  </button>
                  <ul className="space-y-2">
                    {templates.map((t) => (
                      <li
                        key={t.id}
                        className="group rounded-xl border border-slate-200 hover:border-slate-300 transition-colors"
                      >
                        <button
                          onClick={() => onUse(t)}
                          className="w-full flex items-center gap-3 px-3.5 py-3 text-left"
                        >
                          <span className="text-lg flex-shrink-0">{t.emoji}</span>
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm font-normal text-slate-800 truncate">
                              {t.title}
                            </span>
                            <span className="block text-xs font-light text-slate-400 truncate">
                              {t.prompt.replace(/\{\{input\}\}/g, "…").replace(/\n+/g, " ")}
                            </span>
                          </span>
                          <ArrowRight
                            size={14}
                            className="text-slate-300 group-hover:text-emerald-500 transition-colors flex-shrink-0"
                          />
                        </button>
                        <div className="flex items-center gap-1 px-3 pb-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setEditing(t)}
                            className="text-[0.7rem] font-light text-slate-400 hover:text-slate-700 flex items-center gap-1"
                          >
                            <Pencil size={11} /> Edit
                          </button>
                          <button
                            onClick={() => onDelete(t.id)}
                            className="text-[0.7rem] font-light text-slate-400 hover:text-red-400 flex items-center gap-1 ml-2"
                          >
                            <Trash2 size={11} /> Delete
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100">
              <p className="text-[0.7rem] text-slate-400 font-light">
                One click drops a template into your message, ready to send.
              </p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
