import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Share2, Plus, Trash2, Shield, Loader2, Check } from "lucide-react";

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function ConnectorsPanel({ open, connectors, onClose, onSave, onDelete, onTest }) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [testing, setTesting] = useState(null);
  const [tested, setTested] = useState(null);

  function add() {
    if (!name.trim() || !/^https?:\/\//i.test(url.trim())) return;
    onSave({ id: uid(), name: name.trim(), url: url.trim(), createdAt: Date.now() });
    setName("");
    setUrl("");
  }

  async function test(c) {
    setTesting(c.id);
    setTested(null);
    const ok = await onTest(c);
    setTesting(null);
    setTested({ id: c.id, ok });
    setTimeout(() => setTested(null), 2500);
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
            <div className="px-6 pt-6 pb-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-emerald-50">
                  <Share2 className="text-emerald-500" size={16} strokeWidth={1.8} />
                </span>
                <h2 className="font-light text-lg tracking-tight text-slate-900">Sharing</h2>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              <p className="text-xs font-light text-slate-400 leading-relaxed">
                Connect a place you want to send replies to — Slack, Discord, or any app
                that gives you a link (a “webhook”). Then you can send any reply there in
                one click. Your chats stay private;{" "}
                <span className="text-slate-600">only the reply you choose to send goes out.</span>
              </p>

              {/* Add form */}
              <div className="space-y-2.5 rounded-2xl border border-slate-200 p-4">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Name (e.g. My Slack, Zapier)"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-300 font-light"
                />
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://hooks.slack.com/services/…"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-300 font-light"
                />
                <button
                  onClick={add}
                  disabled={!name.trim() || !/^https?:\/\//i.test(url.trim())}
                  className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white rounded-full px-4 py-2.5 text-sm font-normal hover:bg-slate-700 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <Plus size={15} /> Add
                </button>
              </div>

              {/* List */}
              {connectors.length > 0 && (
                <ul className="space-y-2">
                  {connectors.map((c) => (
                    <li
                      key={c.id}
                      className="group flex items-center gap-3 rounded-xl border border-slate-200 px-3.5 py-3"
                    >
                      <Webhook size={14} className="text-slate-400 flex-shrink-0" />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-normal text-slate-800 truncate">
                          {c.name}
                        </span>
                        <span className="block text-[0.7rem] font-light text-slate-400 truncate">
                          {c.url}
                        </span>
                      </span>
                      <button
                        onClick={() => test(c)}
                        className="text-[0.7rem] font-light text-slate-400 hover:text-emerald-600 flex items-center gap-1"
                      >
                        {testing === c.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : tested?.id === c.id ? (
                          tested.ok ? (
                            <Check size={12} className="text-emerald-500" />
                          ) : (
                            "failed"
                          )
                        ) : (
                          "Test"
                        )}
                      </button>
                      <button
                        onClick={() => onDelete(c.id)}
                        className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-400 transition-all"
                      >
                        <Trash2 size={13} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-100">
              <p className="text-[0.7rem] text-slate-400 font-light flex items-center gap-1.5">
                <Shield size={11} /> Nothing is sent until you click “Send” on a reply
              </p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
