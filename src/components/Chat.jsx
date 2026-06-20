import { lazy, Suspense, useRef, useEffect } from "react";
import {
  BookOpen,
  Code2,
  FileText,
  Globe,
  HardDrive,
  Lightbulb,
  Lock,
  MonitorCheck,
  MonitorX,
  PenLine,
  ShieldCheck,
} from "lucide-react";
import Composer from "./Composer.jsx";

const Message = lazy(() => import("./Message.jsx"));

const SUGGESTIONS = [
  { icon: PenLine, title: "Write something", prompt: "Help me write a warm thank-you note to a friend." },
  { icon: Lightbulb, title: "Think through a plan", prompt: "Give me a simple 3-day plan to start eating healthier." },
  { icon: Code2, title: "Explain code", prompt: "Explain what an API is, like I'm completely new to tech." },
  { icon: BookOpen, title: "Learn a topic", prompt: "Explain how solar panels work in plain language." },
];

const TRUST_ITEMS = [
  { icon: HardDrive, label: "Runs locally" },
  { icon: FileText, label: "Reads files here" },
  { icon: ShieldCheck, label: "No account" },
  { icon: Lock, label: "Web is opt-in" },
];

export default function Chat({
  conversation,
  streaming,
  onSend,
  onStop,
  onRegenerate,
  searching,
  webSearchOn,
  onToggleWebSearch,
  offline,
  onSaveFile,
  runtimeState,
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
      {runtimeState?.mode === "web" && (
        <div
          className={`flex items-center gap-2 px-5 py-2 border-b text-[0.78rem] ${
            runtimeState.connected
              ? "bg-emerald-50 text-emerald-700 border-emerald-100"
              : "bg-amber-50 text-amber-800 border-amber-100"
          }`}
        >
          {runtimeState.connected ? <MonitorCheck size={14} /> : <MonitorX size={14} />}
          <span className="font-medium">
            {runtimeState.connected ? "Using local runtime" : "Local runtime unavailable"}
          </span>
          <span className="font-light opacity-80 truncate">{runtimeState.label}</span>
        </div>
      )}

      {isEmpty ? (
        <div className="flex-1 flex flex-col justify-center px-6 py-10 overflow-y-auto">
          <div className="surface-enter w-full max-w-4xl mx-auto">
            <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-1.5 text-[0.76rem] font-medium text-[var(--color-ink-soft)] mb-5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)]" />
                  Private by default
                </div>
                <h1 className="font-display text-[clamp(2.35rem,5vw,4.4rem)] leading-[0.98] text-[var(--color-ink)] mb-4 max-w-[9ch]">
                  Your AI, on your machine.
                </h1>
                <p className="text-[1rem] leading-relaxed text-[var(--color-ink-soft)] font-light max-w-[56ch]">
                  Chat, attach files and think out loud without an account. Web search stays off unless you turn it on.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {TRUST_ITEMS.map(({ icon: Icon, label }) => (
                  <div
                    key={label}
                    className="flex items-center gap-2 rounded-xl border border-[var(--color-line)] bg-white px-3 py-3 text-[0.8rem] text-[var(--color-ink-soft)]"
                  >
                    <Icon size={15} className="text-[var(--color-brand-deep)] flex-shrink-0" />
                    <span className="truncate">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-9 grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left">
              {SUGGESTIONS.map(({ icon: Icon, title, prompt }) => (
                <button
                  key={title}
                  onClick={() => onSend(prompt, [])}
                  className="group flex items-start gap-3 rounded-xl border border-[var(--color-line)] bg-white p-4 text-left transition-[border-color,background-color,transform] duration-200 ease-[var(--ease-out)] hover:-translate-y-0.5 hover:border-[var(--color-ink-faint)] hover:bg-[var(--color-paper)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)]"
                >
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--color-paper-2)] group-hover:bg-white flex-shrink-0 transition-colors duration-200">
                    <Icon size={15} className="text-[var(--color-ink-soft)]" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-[var(--color-ink)]">
                      {title}
                    </span>
                    <span className="block text-xs font-light text-[var(--color-ink-faint)] mt-0.5 leading-snug">
                      {prompt}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-10 space-y-7">
            <Suspense fallback={<MessageListFallback />}>
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
            </Suspense>
            {streaming && searching && (
              <div className="surface-enter flex items-center gap-2 text-[0.78rem] font-light text-emerald-600 pl-[42px]">
                <Globe size={12} className="animate-pulse" />
                Searching the web...
              </div>
            )}
          </div>
        </div>
      )}

      <Composer
        streaming={streaming}
        onSend={onSend}
        onStop={onStop}
        webSearchOn={webSearchOn}
        onToggleWebSearch={onToggleWebSearch}
        offline={offline}
      />
    </main>
  );
}

function MessageListFallback() {
  return (
    <div className="flex gap-3.5 items-start">
      <span className="flex-shrink-0 w-7 h-7 rounded-lg bg-[var(--color-brand-soft)]" />
      <div className="flex-1 space-y-2 pt-1">
        <span className="block h-3 w-2/3 rounded-full bg-[var(--color-paper-2)]" />
        <span className="block h-3 w-1/2 rounded-full bg-[var(--color-paper-2)]" />
      </div>
    </div>
  );
}
