import { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Sparkles, PenLine, Code2, Lightbulb, BookOpen, Globe } from "lucide-react";
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
  usingFiles,
  searching,
  webSearchOn,
  onToggleWebSearch,
  offline,
  composerSeed,
  onSaveFile,
}) {
  const scrollRef = useRef(null);
  const messages = conversation?.messages || [];
  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.id;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streaming]);

  const isEmpty = !conversation || messages.length === 0;

  return (
    <main className="flex-1 h-full flex flex-col bg-white min-w-0">
      {isEmpty ? (
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-2xl text-center"
          >
            <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[var(--color-brand)] to-[var(--color-brand-deep)] shadow-glow mb-7">
              <Sparkles className="text-white" size={24} strokeWidth={1.8} />
            </span>
            <h1 className="font-display text-[2.7rem] leading-[1.05] tracking-tight text-[var(--color-ink)] mb-3">
              What's on your mind?
            </h1>
            <p className="text-[var(--color-ink-soft)] font-light mb-12">
              Private AI that runs entirely on your computer. Nothing leaves this device.
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
                onSaveFile={onSaveFile}
              />
            ))}
            {streaming && searching && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-2 text-[0.78rem] font-light text-emerald-600 pl-[42px]"
              >
                <Globe size={12} className="animate-pulse" />
                Searching the web…
              </motion.div>
            )}
          </div>
        </div>
      )}

      <Composer
        streaming={streaming}
        onSend={onSend}
        onStop={onStop}
        seed={composerSeed}
        webSearchOn={webSearchOn}
        onToggleWebSearch={onToggleWebSearch}
        offline={offline}
      />
    </main>
  );
}
