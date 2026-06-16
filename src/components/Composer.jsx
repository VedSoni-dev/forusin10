import { useState, useRef, useCallback } from "react";
import { Paperclip, ArrowUp, Square, X, FileText, Loader2, Globe, Plane } from "lucide-react";
import { fileKind, prettyBytes } from "../lib/utils.js";
import { extractDocText } from "../lib/extract.js";

const MAX_TEXT_CHARS = 60000;
let attachSeq = 0;

export default function Composer({ streaming, onSend, onStop, webSearchOn, onToggleWebSearch, offline }) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [dragging, setDragging] = useState(false);
  const taRef = useRef(null);
  const fileRef = useRef(null);

  const anyLoading = attachments.some((a) => a.loading);

  const grow = useCallback(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, []);

  async function ingestFiles(fileList) {
    const files = Array.from(fileList).slice(0, 8);
    for (const file of files) {
      const kind = fileKind(file.name);
      const id = ++attachSeq;
      if (kind === "image") {
        // Show the chip immediately with a spinner, then fill it in once read.
        setAttachments((prev) => [
          ...prev,
          { id, kind: "image", name: file.name, size: file.size, dataUrl: null, loading: true },
        ]);
        const dataUrl = await readAsDataURL(file);
        setAttachments((prev) =>
          prev.map((a) => (a.id === id ? { ...a, dataUrl, loading: false } : a))
        );
      } else if (kind === "text") {
        setAttachments((prev) => [
          ...prev,
          { id, kind: "text", name: file.name, size: file.size, loading: true },
        ]);
        let content = await file.text();
        if (content.length > MAX_TEXT_CHARS)
          content = content.slice(0, MAX_TEXT_CHARS) + "\n…(truncated)";
        setAttachments((prev) =>
          prev.map((a) => (a.id === id ? { ...a, content, loading: false } : a))
        );
      } else if (kind === "doc") {
        // Binary doc (.pdf/.docx): show the chip immediately, extract text in the
        // background, then store it as a normal text attachment. If extraction
        // fails, fall back to "other" so the model is told it couldn't be read.
        setAttachments((prev) => [
          ...prev,
          { id, kind: "text", name: file.name, size: file.size, loading: true },
        ]);
        try {
          let content = await extractDocText(file);
          if (!content) throw new Error("No text found in document");
          if (content.length > MAX_TEXT_CHARS)
            content = content.slice(0, MAX_TEXT_CHARS) + "\n…(truncated)";
          setAttachments((prev) =>
            prev.map((a) => (a.id === id ? { ...a, content, loading: false } : a))
          );
        } catch {
          setAttachments((prev) =>
            prev.map((a) => (a.id === id ? { ...a, kind: "other", loading: false } : a))
          );
        }
      } else {
        setAttachments((prev) => [
          ...prev,
          { id, kind: "other", name: file.name, size: file.size },
        ]);
      }
    }
  }

  function submit() {
    if (streaming || anyLoading) return; // wait until attachments finish reading
    if (!text.trim() && attachments.length === 0) return;
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

  // Paste images (or files) straight from the clipboard.
  function onPaste(e) {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files = [];
    for (const item of items) {
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (!file) continue;
        // Pasted screenshots often come through as an unnamed blob.
        if (!file.name && item.type.startsWith("image/")) {
          const ext = item.type.split("/")[1] || "png";
          files.push(
            new File([file], `pasted-${Date.now()}.${ext}`, { type: item.type })
          );
        } else {
          files.push(file);
        }
      }
    }
    if (files.length) {
      e.preventDefault(); // don't also dump the binary as text
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
        className={`max-w-3xl mx-auto rounded-[26px] border bg-white transition-all ${
          dragging
            ? "border-emerald-400 ring-4 ring-emerald-50"
            : "border-slate-200 shadow-sm focus-within:border-slate-300"
        }`}
      >
        {/* Attachment previews */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2 p-3 pb-0">
            {attachments.map((a, i) =>
              a.kind === "image" ? (
                // Thumbnail with a spinner overlay until the photo is fully read
                <div
                  key={a.id ?? i}
                  className="group relative w-16 h-16 rounded-xl overflow-hidden border border-slate-200 bg-slate-100"
                >
                  {a.dataUrl && (
                    <img
                      src={a.dataUrl}
                      alt={a.name}
                      className={`w-full h-full object-cover transition-opacity ${
                        a.loading ? "opacity-40" : "opacity-100"
                      }`}
                    />
                  )}
                  {a.loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/50">
                      <Loader2 size={18} className="text-emerald-500 animate-spin" />
                    </div>
                  )}
                  <button
                    onClick={() =>
                      setAttachments((prev) => prev.filter((_, j) => j !== i))
                    }
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-slate-900/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <div
                  key={a.id ?? i}
                  className="group relative flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl pl-2.5 pr-7 py-2 text-xs text-slate-600 max-w-[220px]"
                >
                  {a.loading ? (
                    <Loader2 size={14} className="text-emerald-500 flex-shrink-0 animate-spin" />
                  ) : (
                    <FileText size={14} className="text-emerald-500 flex-shrink-0" />
                  )}
                  <span className="truncate font-light">{a.name}</span>
                  {a.size != null && (
                    <span className="text-slate-300">{prettyBytes(a.size)}</span>
                  )}
                  <button
                    onClick={() =>
                      setAttachments((prev) => prev.filter((_, j) => j !== i))
                    }
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-600"
                  >
                    <X size={13} />
                  </button>
                </div>
              )
            )}
          </div>
        )}

        <div className="flex items-end gap-2 p-2.5">
          <button
            onClick={() => fileRef.current?.click()}
            className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all"
            title="Attach files or photos"
          >
            <Paperclip size={18} />
          </button>
          {onToggleWebSearch &&
            (offline ? (
              <span
                className="flex-shrink-0 h-9 rounded-full flex items-center gap-1.5 px-2.5 bg-emerald-50 text-emerald-600"
                title="Offline Mode is on — web search is disabled. Nothing leaves your device."
              >
                <Plane size={18} />
                <span className="text-[0.78rem] font-normal pr-0.5">Offline</span>
              </span>
            ) : (
              <button
                onClick={onToggleWebSearch}
                className={`flex-shrink-0 h-9 rounded-full flex items-center gap-1.5 px-2.5 transition-all ${
                  webSearchOn
                    ? "bg-emerald-50 text-emerald-600"
                    : "text-slate-400 hover:text-slate-700 hover:bg-slate-50"
                }`}
                title={
                  webSearchOn
                    ? "Web search is on — recent questions are looked up online (queries leave your device). Click to turn off."
                    : "Web search is off. Click to let it look up recent info online (your search query will be sent to the web)."
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
            placeholder="Ask anything — it stays on your computer"
            className="flex-1 resize-none bg-transparent outline-none text-[0.95rem] leading-relaxed text-slate-900 placeholder:text-slate-400 py-1.5 max-h-[200px] font-light"
          />

          {streaming ? (
            <button
              onClick={onStop}
              className="flex-shrink-0 w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center hover:bg-slate-700 transition-all"
              title="Stop"
            >
              <Square size={14} fill="currentColor" />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={anyLoading || (!text.trim() && attachments.length === 0)}
              className="flex-shrink-0 w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center hover:bg-slate-700 transition-all disabled:opacity-25 disabled:cursor-not-allowed"
              title={anyLoading ? "Loading attachment…" : "Send"}
            >
              {anyLoading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <ArrowUp size={18} />
              )}
            </button>
          )}
        </div>
      </div>
      <p className="text-center text-[0.7rem] text-slate-300 font-light mt-2.5">
        {webSearchOn
          ? "Private chat · runs on your device · web search sends your query online when needed"
          : "Private & offline · your words never leave this device"}
      </p>
    </div>
  );
}

function readAsDataURL(file) {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.readAsDataURL(file);
  });
}
