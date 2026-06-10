import { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Leaf, PenLine, Code2, Lightbulb, BookOpen, Folder, Settings2, FileText, Zap } from "lucide-react";
import Message from "./Message.jsx";
import Composer from "./Composer.jsx";

const SUGGESTIONS = [
  { icon: PenLine, title: "Write a message", prompt: "Help me write a warm thank-you note to a friend." },
  { icon: Lightbulb, title: "Plan something", prompt: "Give me a simple 3-day plan to start eating healthier." },
  { icon: Code2, title: "Explain code", prompt: "Explain what an API is, like I'm completely new to tech." },
  { icon: BookOpen, title: "Understand a topic", prompt: "Explain how solar panels work in plain language." },
];

export default function Chat({
  conversation,
  streaming,
  onSend,
  onStop,
  onRegenerate,
  project,
  onProjectSettings,
  usingFiles,
  templates = [],
  onUseTemplate,
  onOpenTemplates,
  composerSeed,
  connectors,
  onSaveFile,
  onSendWebhook,
  onManageConnectors,
  getSuggestedConnector,
}) {
  const scrollRef = useRef(null);
  const messages = conversation?.messages || [];
  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.id;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streaming]);

  const isEmpty = !conversation || messages.length === 0;
  const fileCount = project?.files?.length || 0;

  return (
    <main className="flex-1 h-full flex flex-col bg-white min-w-0">
      {/* Project banner */}
      {project && (
        <div className="flex items-center gap-2 px-5 h-10 border-b border-slate-100 bg-slate-50/50 flex-shrink-0">
          <Folder size={13} className="text-emerald-500 flex-shrink-0" />
          <span className="text-[0.8rem] font-light text-slate-700 truncate">
            {project.name}
          </span>
          {fileCount > 0 && (
            <span className="flex items-center gap-1 text-[0.7rem] text-slate-400">
              <FileText size={11} /> {fileCount}
            </span>
          )}
          <button
            onClick={onProjectSettings}
            className="ml-auto text-slate-400 hover:text-slate-700 transition-colors"
            title="Project settings"
          >
            <Settings2 size={14} />
          </button>
        </div>
      )}
      {isEmpty ? (
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-2xl text-center"
          >
            <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-50 mb-7">
              <Leaf className="text-emerald-500" size={26} strokeWidth={1.5} />
            </span>
            <h1 className="font-extralight text-4xl tracking-tight text-slate-900 mb-3">
              What's on your mind?
            </h1>
            <p className="text-slate-500 font-light mb-12">
              A private AI that runs entirely on your computer.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
              {SUGGESTIONS.map(({ icon: Icon, title, prompt }) => (
                <button
                  key={title}
                  onClick={() => onSend(prompt, [])}
                  className="group flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 hover:border-slate-300 hover:bg-slate-50/50 transition-all text-left"
                >
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-50 group-hover:bg-white flex-shrink-0">
                    <Icon size={15} className="text-slate-500" />
                  </span>
                  <span>
                    <span className="block text-sm font-normal text-slate-800">
                      {title}
                    </span>
                    <span className="block text-xs font-light text-slate-400 mt-0.5 leading-snug">
                      {prompt}
                    </span>
                  </span>
                </button>
              ))}
            </div>

            {/* Template chips */}
            {templates.length > 0 && (
              <div className="mt-8">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <Zap size={12} className="text-slate-300" />
                  <span className="text-[0.7rem] font-normal tracking-widest text-slate-400 uppercase">
                    Templates
                  </span>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {templates.slice(0, 6).map((t) => (
                    <button
                      key={t.id}
                      onClick={() => onUseTemplate(t)}
                      className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-[0.8rem] font-light text-slate-600 hover:border-emerald-300 hover:text-emerald-700 hover:bg-emerald-50/30 transition-all"
                    >
                      <span>{t.emoji}</span> {t.title}
                    </button>
                  ))}
                  <button
                    onClick={onOpenTemplates}
                    className="flex items-center gap-1.5 rounded-full border border-dashed border-slate-300 px-3.5 py-1.5 text-[0.8rem] font-light text-slate-400 hover:text-slate-700 transition-all"
                  >
                    Manage…
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      ) : (
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-10 space-y-7">
            {messages.map((m) => (
              <Message
                key={m.id}
                message={m}
                streaming={streaming}
                canRegenerate={m.id === lastAssistantId}
                onRegenerate={() => onRegenerate(m.id)}
                connectors={connectors}
                onSaveFile={onSaveFile}
                onSendWebhook={onSendWebhook}
                onManageConnectors={onManageConnectors}
                suggestedConnector={getSuggestedConnector?.(m)}
              />
            ))}
            {streaming && usingFiles && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2 text-[0.78rem] font-light text-emerald-600 pl-[42px]"
              >
                <FileText size={12} className="animate-pulse" />
                Reading your linked files…
              </motion.div>
            )}
          </div>
        </div>
      )}

      <Composer
        streaming={streaming}
        onSend={onSend}
        onStop={onStop}
        onOpenTemplates={onOpenTemplates}
        seed={composerSeed}
      />
    </main>
  );
}
