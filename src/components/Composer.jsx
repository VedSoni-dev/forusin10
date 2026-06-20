import { useState, useRef, useCallback } from "react";
import { Paperclip, ArrowUp, Square, X, FileText, Loader2, Globe, Plane, AlertCircle } from "lucide-react";
import { fileKind, prettyBytes } from "../lib/utils.js";

const MAX_TEXT_CHARS = 60000;
const MAX_FILES = 8;
let attachSeq = 0;

export default function Composer({ streaming, onSend, onStop, webSearchOn, onToggleWebSearch, offline }) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [dragging, setDragging] = useState(false);
  const taRef = useRef(null);
  const fileRef = useRef(null);

  const anyLoading = attachments.some((a) => a.loading);
  const canSend = !streaming && !anyLoading && (text.trim() || attachments.length > 0);

  const grow = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, []);

  function replaceAttachment(id, patch) {
    setAttachments((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  async function ingestFiles(fileList) {
    const files = Array.from(fileList).slice(0, MAX_FILES);
    for (const file of files) {
      const kind = fileKind(file.name);
      const id = ++attachSeq;

      if (kind === "image") {
        setAttachments((prev) => [
          ...prev,
          { id, kind: "image", name: file.name, size: file.size, dataUrl: null, loading: true },
        ]);
        try {
          const dataUrl = await readAsDataURL(file);
          replaceAttachment(id, { dataUrl, loading: false });
        } catch {
          replaceAttachment(id, { kind: "other", loading: false, error: "Could not read image" });
        }
        continue;
      }

      if (kind === "text") {
        setAttachments((prev) => [
          ...prev,
          { id, kind: "text", name: file.name, size: file.size, loading: true },
        ]);
        try {
          let content = await file.text();
          if (content.length > MAX_TEXT_CHARS) {
            content = content.slice(0, MAX_TEXT_CHARS) + "\n...(truncated)";
          }
          replaceAttachment(id, { content, loading: false });
        } catch {
          replaceAttachment(id, { kind: "other", loading: false, error: "Could not read text" });
        }
        continue;
      }

      if (kind === "doc") {
        setAttachments((prev) => [
          ...prev,
          { id, kind: "text", name: file.name, size: file.size, loading: true },
        ]);
        try {
          const { extractDocText } = await import("../lib/extract.js");
          let content = await extractDocText(file);
          if (!content) throw new Error("No text found in document");
          if (content.length > MAX_TEXT_CHARS) {
            content = content.slice(0, MAX_TEXT_CHARS) + "\n...(truncated)";
          }
          replaceAttachment(id, { content, loading: false });
        } catch {
          replaceAttachment(id, {
            kind: "other",
            loading: false,
            error: "Text could not be extracted",
          });
        }
        continue;
      }

      setAttachments((prev) => [
        ...prev,
        { id, kind: "other", name: file.name, size: file.size, error: "Preview unavailable" },
      ]);
    }
  }

  function submit() {
    if (!canSend) return;
    onSend(text, attachments);
    setText("");
    setAttachments([]);
    requestAnimationFrame(() => {
      if (taRef.current) taRef.current.style.height = "auto";
    });
  }

  function onKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  function onPaste(e) {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files = [];
    for (const item of items) {
      if (item.kind !== "file") continue;
      const file = item.getAsFile();
      if (!file) continue;
      if (!file.name && item.type.startsWith("image/")) {
        const ext = item.type.split("/")[1] || "png";
        files.push(new File([file], `pasted-${Date.now()}.${ext}`, { type: item.type }));
      } else {
        files.push(file);
      }
    }
    if (files.length) {
      e.preventDefault();
      ingestFiles(files);
    }
  }

  return (
    <div className="px-4 pb-4 pt-1">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files?.length) ingestFiles(e.dataTransfer.files);
        }}
        className={`max-w-3xl mx-auto rounded-2xl border bg-white transition-[border-color,box-shadow] duration-200 ease-[var(--ease-out)] ${
          dragging
            ? "border-[var(--color-brand)] shadow-soft"
            : "border-[var(--color-line)] shadow-sm focus-within:border-[var(--color-ink-faint)]"
        }`}
      >
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 p-3 pb-0">
            {attachments.map((a, i) =>
              a.kind === "image" ? (
                <div
                  key={a.id ?? i}
                  className="group relative w-16 h-16 rounded-xl overflow-hidden border border-[var(--color-line)] bg-[var(--color-paper-2)]"
                >
                  {a.dataUrl && (
                    <img
                      src={a.dataUrl}
                      alt={a.name}
                      className={`w-full h-full object-cover ${a.loading ? "opacity-40" : "opacity-100"}`}
                    />
                  )}
                  {a.loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/60">
                      <Loader2 size={18} className="text-[var(--color-brand)] animate-spin" />
                    </div>
                  )}
                  <RemoveAttachmentButton onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))} />
                </div>
              ) : (
                <div
                  key={a.id ?? i}
                  className={`group relative flex items-center gap-2 border rounded-xl pl-2.5 pr-7 py-2 text-xs max-w-[240px] ${
                    a.error
                      ? "bg-red-50 border-red-100 text-red-700"
                      : "bg-[var(--color-paper)] border-[var(--color-line)] text-[var(--color-ink-soft)]"
                  }`}
                  title={a.error || a.name}
                >
                  {a.loading ? (
                    <Loader2 size={14} className="text-[var(--color-brand)] flex-shrink-0 animate-spin" />
                  ) : a.error ? (
                    <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
                  ) : (
                    <FileText size={14} className="text-[var(--color-brand)] flex-shrink-0" />
                  )}
                  <span className="truncate font-light">{a.name}</span>
                  {a.size != null && <span className="text-[var(--color-ink-faint)]">{prettyBytes(a.size)}</span>}
                  <RemoveAttachmentButton onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))} compact />
                </div>
              )
            )}
          </div>
        )}

        <div className="flex items-end gap-2 p-2.5">
          <button
            onClick={() => fileRef.current?.click()}
            className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-[var(--color-ink-faint)] hover:text-[var(--color-ink)] hover:bg-[var(--color-paper)] transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)]"
            title="Attach files or photos"
          >
            <Paperclip size={18} />
          </button>

          {onToggleWebSearch &&
            (offline ? (
              <span
                className="flex-shrink-0 h-9 rounded-full flex items-center gap-1.5 px-2.5 bg-[var(--color-brand-soft)] text-[var(--color-brand-deep)]"
                title="Offline Mode is on. Web search is disabled."
              >
                <Plane size={18} />
                <span className="text-[0.78rem] font-normal pr-0.5">Offline</span>
              </span>
            ) : (
              <button
                onClick={onToggleWebSearch}
                className={`flex-shrink-0 h-9 rounded-full flex items-center gap-1.5 px-2.5 transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)] ${
                  webSearchOn
                    ? "bg-[var(--color-brand-soft)] text-[var(--color-brand-deep)]"
                    : "text-[var(--color-ink-faint)] hover:text-[var(--color-ink)] hover:bg-[var(--color-paper)]"
                }`}
                title={
                  webSearchOn
                    ? "Web search is on. Recent questions may send one query online."
                    : "Web search is off. Turn it on only when you need current information."
                }
              >
                <Globe size={18} />
                {webSearchOn && <span className="text-[0.78rem] font-normal pr-0.5">Search</span>}
              </button>
            ))}

          <input
            ref={fileRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) ingestFiles(e.target.files);
              e.target.value = "";
            }}
          />

          <textarea
            ref={taRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              grow();
            }}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            rows={1}
            placeholder="Ask anything - it stays on your computer"
            className="flex-1 resize-none bg-transparent outline-none text-[0.95rem] leading-relaxed text-[var(--color-ink)] placeholder:text-[var(--color-ink-faint)] py-1.5 max-h-[200px] font-light"
          />

          {streaming ? (
            <button
              onClick={onStop}
              className="flex-shrink-0 w-9 h-9 rounded-full bg-[var(--color-ink)] text-white flex items-center justify-center hover:bg-slate-700 transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)]"
              title="Stop"
            >
              <Square size={14} fill="currentColor" />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={!canSend}
              className="flex-shrink-0 w-9 h-9 rounded-full bg-[var(--color-ink)] text-white flex items-center justify-center hover:bg-slate-700 transition-colors duration-150 disabled:opacity-25 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)]"
              title={anyLoading ? "Reading attachment" : "Send"}
            >
              {anyLoading ? <Loader2 size={18} className="animate-spin" /> : <ArrowUp size={18} />}
            </button>
          )}
        </div>
      </div>
      <p className="text-center text-[0.7rem] text-[var(--color-ink-faint)] font-light mt-2.5">
        {webSearchOn && !offline
          ? "Private chat - local model - web search sends a query only when needed"
          : "Private and offline by default - your words stay on this device"}
      </p>
    </div>
  );
}

function RemoveAttachmentButton({ onClick, compact }) {
  return (
    <button
      onClick={onClick}
      className={
        compact
          ? "absolute right-1.5 top-1/2 -translate-y-1/2 text-[var(--color-ink-faint)] hover:text-[var(--color-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)]"
          : "absolute top-1 right-1 w-5 h-5 rounded-full bg-slate-900/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand)]"
      }
      title="Remove attachment"
    >
      <X size={compact ? 13 : 12} />
    </button>
  );
}

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}
