import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowUp, Globe, FolderOpen, Workflow, Brain, Sparkles,
  MessageSquareText, ArrowRight, Clock,
} from "lucide-react";

const QUICK = [
  "Summarize a document I'll paste",
  "Draft a warm email to a client",
  "Explain a tricky topic simply",
  "Plan my week",
];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function Home({
  onAsk,
  onSection,
  recent = [],
  onOpenConversation,
  memoryCount = 0,
  webSearchOn,
  onToggleWebSearch,
}) {
  const [text, setText] = useState("");

  function submit() {
    const t = text.trim();
    if (!t) return;
    onAsk(t);
    setText("");
  }

  const cards = [
    {
      id: "workspace",
      icon: FolderOpen,
      title: "Work across your files",
      desc: "Drop in PDFs, docs and notes — it reads and reasons over all of them.",
    },
    {
      id: "automations",
      icon: Workflow,
      title: "Automate the repetitive",
      desc: "Turn a prompt into a one-tap workflow and send results anywhere.",
    },
    {
      id: "brain",
      icon: Brain,
      title: "A Brain that learns you",
      desc:
        memoryCount > 0
          ? `Remembering ${memoryCount} thing${memoryCount === 1 ? "" : "s"} about you — privately.`
          : "It quietly learns what matters to you, all on your device.",
    },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-8 pt-16 pb-12">
        {/* Greeting */}
        <motion.div className="reveal" style={{ "--d": "0ms" }}>
          <div className="inline-flex items-center gap-2 text-[0.72rem] font-medium text-[var(--color-brand-deep)] bg-[var(--color-brand-soft)] rounded-full px-3 py-1 mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand)]" style={{ animation: "breathe 2.4s ease-in-out infinite" }} />
            Private · running on your device
          </div>
          <h1 className="font-display text-[2.7rem] leading-[1.05] text-[var(--color-ink)]">
            {greeting()}.
          </h1>
          <p className="text-[1.05rem] text-[var(--color-ink-soft)] mt-2 font-light">
            What should we make happen today?
          </p>
        </motion.div>

        {/* Hero ask */}
        <motion.div
          className="reveal mt-7"
          style={{ "--d": "90ms" }}
        >
          <div className="surface shadow-lift rounded-[22px] p-2.5 focus-within:border-[var(--color-brand)] transition-colors">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={2}
              autoFocus
              placeholder="Ask anything — or tell it what to do…"
              className="w-full resize-none bg-transparent outline-none text-[1.02rem] leading-relaxed text-[var(--color-ink)] placeholder:text-[var(--color-ink-faint)] px-3 pt-2.5 pb-1 font-light"
            />
            <div className="flex items-center justify-between px-1.5 pb-0.5">
              <button
                onClick={onToggleWebSearch}
                className={`flex items-center gap-1.5 h-8 rounded-full px-3 text-[0.8rem] font-medium transition-all ${
                  webSearchOn
                    ? "bg-[var(--color-brand-soft)] text-[var(--color-brand-deep)]"
                    : "text-[var(--color-ink-faint)] hover:text-[var(--color-ink-soft)] hover:bg-[var(--color-paper-2)]"
                }`}
                title={webSearchOn ? "Web search on — recent questions get looked up online" : "Turn on web search for recent info"}
              >
                <Globe size={15} /> {webSearchOn ? "Web search on" : "Web search"}
              </button>
              <button
                onClick={submit}
                disabled={!text.trim()}
                className="w-10 h-10 rounded-full bg-[var(--color-ink)] text-white flex items-center justify-center hover:bg-black transition-all disabled:opacity-20 disabled:cursor-not-allowed"
              >
                <ArrowUp size={18} />
              </button>
            </div>
          </div>

          {/* Quick prompts */}
          <div className="flex flex-wrap gap-2 mt-3.5">
            {QUICK.map((q) => (
              <button
                key={q}
                onClick={() => onAsk(q)}
                className="text-[0.82rem] text-[var(--color-ink-soft)] bg-white border border-[var(--color-line)] rounded-full px-3.5 py-1.5 hover:border-[var(--color-brand)] hover:text-[var(--color-brand-deep)] transition-all shadow-soft"
              >
                {q}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Capability cards */}
        <motion.div className="reveal grid sm:grid-cols-3 gap-3 mt-9" style={{ "--d": "180ms" }}>
          {cards.map(({ id, icon: Icon, title, desc }) => (
            <button
              key={id}
              onClick={() => onSection(id)}
              className="group text-left surface rounded-2xl p-4 shadow-soft hover:shadow-lift hover:-translate-y-0.5 transition-all"
            >
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-[var(--color-brand-soft)] mb-3">
                <Icon size={17} className="text-[var(--color-brand-deep)]" />
              </span>
              <h3 className="font-display text-[1.05rem] text-[var(--color-ink)] leading-snug mb-1">
                {title}
              </h3>
              <p className="text-[0.82rem] text-[var(--color-ink-soft)] font-light leading-relaxed">
                {desc}
              </p>
              <span className="inline-flex items-center gap-1 text-[0.78rem] font-medium text-[var(--color-brand-deep)] mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                Open <ArrowRight size={13} />
              </span>
            </button>
          ))}
        </motion.div>

        {/* Recent */}
        {recent.length > 0 && (
          <motion.div className="reveal mt-10" style={{ "--d": "260ms" }}>
            <div className="flex items-center gap-2 text-[0.78rem] font-medium text-[var(--color-ink-faint)] mb-3 uppercase tracking-wide">
              <Clock size={13} /> Pick up where you left off
            </div>
            <div className="space-y-1.5">
              {recent.slice(0, 4).map((c) => (
                <button
                  key={c.id}
                  onClick={() => onOpenConversation(c.id)}
                  className="group w-full flex items-center gap-3 text-left bg-white/60 hover:bg-white border border-transparent hover:border-[var(--color-line)] rounded-xl px-3.5 py-2.5 transition-all"
                >
                  <MessageSquareText size={15} className="text-[var(--color-ink-faint)] group-hover:text-[var(--color-brand)] flex-shrink-0 transition-colors" />
                  <span className="flex-1 truncate text-[0.9rem] text-[var(--color-ink)] font-light">
                    {c.title}
                  </span>
                  <span className="text-[0.72rem] text-[var(--color-ink-faint)] flex-shrink-0">
                    {timeAgo(c.createdAt)}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
