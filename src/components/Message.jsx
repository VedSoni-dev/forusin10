import { memo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import {
  Leaf, FileText, ImageIcon, Copy, Check, RotateCcw, Download,
} from "lucide-react";
import { cn } from "../lib/utils.js";

// Models emit LaTeX with \[…\] (block) and \(…\) delimiters, but markdown eats
// the backslash before the bracket, so the math shows up as raw text. Convert
// those to the $$…$$ / $…$ that remark-math understands, before markdown runs.
function mathify(src = "") {
  return src
    .replace(/\\\[([\s\S]+?)\\\]/g, (_, x) => `\n\n$$\n${x.trim()}\n$$\n\n`)
    .replace(/\\\(([\s\S]+?)\\\)/g, (_, x) => `$${x.trim()}$`);
}

function MessageActions({ content, canRegenerate, onRegenerate, onSaveFile }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  }

  const btn =
    "flex items-center gap-1.5 text-[0.72rem] font-light text-[var(--color-ink-faint)] hover:text-[var(--color-ink)] hover:bg-[var(--color-paper-2)] rounded-lg px-2 py-1 transition-all";

  return (
    <div className="flex items-center gap-1 mt-2 -ml-1.5">
      <button onClick={copy} title={copied ? "Copied" : "Copy"} className={btn}>
        {copied ? (
          <>
            <Check size={13} className="text-[var(--color-brand)]" /> Copied
          </>
        ) : (
          <>
            <Copy size={13} /> Copy
          </>
        )}
      </button>
      {canRegenerate && (
        <button onClick={onRegenerate} title="Try again" className={btn}>
          <RotateCcw size={13} /> Try again
        </button>
      )}
      {onSaveFile && (
        <button onClick={() => onSaveFile(content)} title="Save as file" className={btn}>
          <Download size={13} /> Save
        </button>
      )}
    </div>
  );
}

function AttachmentChips({ attachments }) {
  if (!attachments?.length) return null;
  return (
    <div className="flex flex-wrap gap-2 mb-2 justify-end">
      {attachments.map((a, i) =>
        a.kind === "image" && a.dataUrl ? (
          <img
            key={i}
            src={a.dataUrl}
            alt={a.name}
            className="w-28 h-28 object-cover rounded-xl border border-slate-200"
          />
        ) : (
          <div
            key={i}
            className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-600 max-w-[200px]"
          >
            {a.kind === "image" ? (
              <ImageIcon size={14} className="text-emerald-500 flex-shrink-0" />
            ) : (
              <FileText size={14} className="text-emerald-500 flex-shrink-0" />
            )}
            <span className="truncate font-light">{a.name}</span>
          </div>
        )
      )}
    </div>
  );
}

function Message({
  message,
  streaming,
  canRegenerate,
  onRegenerate,
  onSaveFile,
}) {
  const isUser = message.role === "user";

  if (isUser) {
    return (
      <div className="flex flex-col items-end">
        <AttachmentChips attachments={message.attachments} />
        {message.content && (
          <div className="bg-[var(--color-ink)] text-white rounded-2xl rounded-br-md px-4 py-2.5 max-w-[80%] text-[0.95rem] leading-relaxed whitespace-pre-wrap">
            {message.content}
          </div>
        )}
      </div>
    );
  }

  const empty = !message.content;
  return (
    <div className="flex gap-3.5 items-start">
      <span className="flex-shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--color-brand-soft)] mt-0.5">
        <Leaf className="text-[var(--color-brand-deep)]" size={14} strokeWidth={1.8} />
      </span>
      <div className="flex-1 min-w-0 pt-0.5">
        {empty && streaming ? (
          <div className="flex gap-1.5 items-center h-6">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-slate-300"
                style={{
                  animation: "blink 1.2s infinite",
                  animationDelay: `${i * 0.18}s`,
                }}
              />
            ))}
          </div>
        ) : (
          <>
            <div
              className={cn(
                "prose-chat text-[0.95rem] text-[var(--color-ink)]",
                message.error && "text-[var(--color-ink-faint)]"
              )}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[[rehypeKatex, { throwOnError: false }]]}
              >
                {mathify(message.content)}
              </ReactMarkdown>
            </div>
            {!streaming && !message.error && (
              <MessageActions
                content={message.content}
                canRegenerate={canRegenerate}
                onRegenerate={onRegenerate}
                onSaveFile={onSaveFile}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default memo(Message);
