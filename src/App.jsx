import { useState, useEffect, useRef, useCallback } from "react";
import Onboarding from "./components/Onboarding.jsx";
import Sidebar from "./components/Sidebar.jsx";
import Chat from "./components/Chat.jsx";
import TitleBar from "./components/TitleBar.jsx";
import PrivacyPanel from "./components/PrivacyPanel.jsx";
import Toast from "./components/Toast.jsx";

const STORAGE_KEY = "fui10.conversations.v1";
const WEBSEARCH_KEY = "fui10.websearch.v1";
const OFFLINE_KEY = "fui10.offline.v1";
const PRIVACYLOG_KEY = "fui10.privacylog.v1";

const SYSTEM_PROMPT =
  "You are 'for us in 10', a private AI assistant that runs entirely on the user's own computer. " +
  "Nothing they say ever leaves their device. Be warm, clear and genuinely helpful. " +
  "Explain things simply, the way you'd help a friend who isn't technical. Keep answers focused.";

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function loadConversations() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function loadPrivacyLog() {
  try {
    const raw = localStorage.getItem(PRIVACYLOG_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

// Turn our stored messages (with attachments) into what the engine expects.
// Images are always included; the main process picks a working vision model
// (or strips them with a friendly note if none is installed).
function buildApiMessages(messages) {
  const out = [{ role: "system", content: SYSTEM_PROMPT }];
  for (const m of messages) {
    if (m.role === "assistant") {
      out.push({ role: "assistant", content: m.content });
      continue;
    }
    let content = m.content || "";
    const images = [];
    for (const a of m.attachments || []) {
      if (a.kind === "text") {
        content += `\n\n--- Attached file: ${a.name} ---\n${a.content}`;
      } else if (a.kind === "image" && a.dataUrl) {
        images.push(a.dataUrl.split(",")[1]); // strip data: prefix
      } else if (a.kind === "other") {
        content += `\n\n(The user attached "${a.name}", but its text couldn't be extracted, so you can't see what's inside. Let them know.)`;
      }
    }
    const msg = { role: "user", content };
    if (images.length) msg.images = images;
    out.push(msg);
  }
  return out;
}

export default function App() {
  const [screen, setScreen] = useState("loading"); // loading | onboarding | ready
  const [model, setModel] = useState("forusin10:core");
  const [conversations, setConversations] = useState(loadConversations);
  const [activeId, setActiveId] = useState(() => loadConversations()[0]?.id || null);
  const [streaming, setStreaming] = useState(false);
  const [searching, setSearching] = useState(false); // "looking it up on the web" cue

  // Web search: when on, fresh questions are answered using a quick web lookup.
  // Off by default keeps the "nothing leaves your device" promise literally true;
  // toggling it on is the user explicitly opting in to send search queries out.
  const [webSearchOn, setWebSearchOn] = useState(() => {
    try {
      return localStorage.getItem(WEBSEARCH_KEY) === "true";
    } catch {
      return false;
    }
  });
  // Privacy: Offline Mode (airtight — nothing can leave) + a visible activity log
  // of everything that has ever left the device (web-search queries).
  const [offline, setOffline] = useState(() => {
    try {
      return localStorage.getItem(OFFLINE_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [privacyLog, setPrivacyLog] = useState(loadPrivacyLog);
  const [privacyOpen, setPrivacyOpen] = useState(false);

  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const streamRef = useRef({ convId: null, msgId: null, reqId: null });

  function showToast(text, kind = "ok") {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), text, kind });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  // The memory "brain" learns quietly in the background (main process); nothing
  // to surface here — the app stays dead simple.

  // Persist conversations
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    } catch {}
  }, [conversations]);

  // Persist the web-search opt-in
  useEffect(() => {
    try {
      localStorage.setItem(WEBSEARCH_KEY, String(webSearchOn));
    } catch {}
  }, [webSearchOn]);

  // Persist Offline Mode + the privacy activity log
  useEffect(() => {
    try {
      localStorage.setItem(OFFLINE_KEY, String(offline));
    } catch {}
  }, [offline]);
  useEffect(() => {
    try {
      localStorage.setItem(PRIVACYLOG_KEY, JSON.stringify(privacyLog.slice(0, 200)));
    } catch {}
  }, [privacyLog]);

  // Append an entry to the "what left your device" log. Keeps the newest 200.
  const logPrivacy = useCallback((type, detail) => {
    setPrivacyLog((prev) =>
      [{ id: uid(), ts: Date.now(), type, detail }, ...prev].slice(0, 200)
    );
  }, []);

  async function saveReplyToFile(content) {
    const res = await window.localai?.connectors?.saveFile({
      suggestedName: "reply.md",
      content,
    });
    if (res?.ok) showToast("Saved to your computer");
    else if (!res?.canceled) showToast("Couldn't save the file", "error");
  }

  // Check the local engine on launch
  const checkStatus = useCallback(async () => {
    if (!window.localai) {
      // Running in a plain browser (dev preview without Electron) — let the UI through.
      setScreen("ready");
      return;
    }
    const s = await window.localai.status();
    if (s.chatModel) setModel(s.chatModel);
    if (s.running && s.hasModel) setScreen("ready");
    else setScreen("onboarding");
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Wire up streaming listeners once
  useEffect(() => {
    if (!window.localai) return;
    const offSearching = window.localai.onSearching(({ id, query }) => {
      if (id !== streamRef.current.reqId) return;
      setSearching(true);
      if (query) logPrivacy("search", query); // record exactly what left the device
    });
    const offToken = window.localai.onToken(({ id, token }) => {
      if (id !== streamRef.current.reqId) return;
      setSearching(false); // first answer token arrived → done searching
      const { convId, msgId } = streamRef.current;
      setConversations((prev) =>
        prev.map((c) =>
          c.id !== convId
            ? c
            : {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === msgId ? { ...m, content: m.content + token } : m
                ),
              }
        )
      );
    });
    const finish = ({ id }) => {
      if (id !== streamRef.current.reqId) return;
      setStreaming(false);
      setSearching(false);
      streamRef.current = { convId: null, msgId: null, reqId: null };
    };
    const offDone = window.localai.onDone(finish);
    const offErr = window.localai.onError(({ id }) => {
      if (id !== streamRef.current.reqId) return;
      const { convId, msgId } = streamRef.current;
      setConversations((prev) =>
        prev.map((c) =>
          c.id !== convId
            ? c
            : {
                ...c,
                messages: c.messages.map((m) =>
                  m.id === msgId
                    ? {
                        ...m,
                        content:
                          m.content ||
                          "Hmm, I couldn't reach the AI just now. Make sure the app finished setting up, then try again.",
                        error: true,
                      }
                    : m
                ),
              }
        )
      );
      setStreaming(false);
      setSearching(false);
      streamRef.current = { convId: null, msgId: null, reqId: null };
    });
    return () => {
      offSearching?.();
      offToken?.();
      offDone?.();
      offErr?.();
    };
  }, [logPrivacy]);

  const activeConv = conversations.find((c) => c.id === activeId) || null;

  function newChat() {
    setActiveId(null);
  }

  function deleteChat(id) {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) setActiveId(null);
  }

  async function sendMessage(text, attachments) {
    if (streaming) return;
    const trimmed = text.trim();
    if (!trimmed && attachments.length === 0) return;

    const userMsg = { id: uid(), role: "user", content: trimmed, attachments };
    const asstMsg = { id: uid(), role: "assistant", content: "" };

    let convId = activeId;
    let baseMessages = [];

    if (!convId) {
      // Start a fresh conversation, titled from the first message.
      convId = uid();
      const title =
        trimmed.slice(0, 40) + (trimmed.length > 40 ? "…" : "") ||
        attachments[0]?.name ||
        "New chat";
      const conv = { id: convId, title, createdAt: Date.now(), messages: [userMsg, asstMsg] };
      baseMessages = [userMsg];
      setConversations((prev) => [conv, ...prev]);
      setActiveId(convId);
    } else {
      const current = conversations.find((c) => c.id === convId);
      baseMessages = [...(current?.messages || []), userMsg];
      setConversations((prev) =>
        prev.map((c) =>
          c.id === convId
            ? { ...c, messages: [...c.messages, userMsg, asstMsg] }
            : c
        )
      );
    }

    const reqId = uid();
    streamRef.current = { convId, msgId: asstMsg.id, reqId };
    setStreaming(true);

    if (!window.localai) {
      // Browser preview fallback: echo so the UI is testable without Electron.
      setStreaming(false);
      return;
    }

    window.localai.chat({
      id: reqId,
      model, // main process upgrades to a vision model when photos are present
      messages: buildApiMessages(baseMessages),
      web: webSearchOn && !offline,
    });
  }

  function stop() {
    if (streamRef.current.reqId) window.localai?.stop(streamRef.current.reqId);
    setStreaming(false);
    setSearching(false);
  }

  // Re-run the AI's answer using the conversation up to (but not including) it.
  function regenerate(msgId) {
    if (streaming) return;
    const conv = conversations.find((c) => c.id === activeId);
    if (!conv) return;
    const idx = conv.messages.findIndex((m) => m.id === msgId);
    if (idx < 0) return;

    const history = conv.messages.slice(0, idx); // everything before this answer
    if (!history.some((m) => m.role === "user")) return;

    // Drop anything after this answer and clear it, ready to stream fresh.
    const newMessages = conv.messages
      .slice(0, idx + 1)
      .map((m, i) => (i === idx ? { ...m, content: "", error: false } : m));
    setConversations((prev) =>
      prev.map((c) => (c.id === activeId ? { ...c, messages: newMessages } : c))
    );

    const reqId = uid();
    streamRef.current = { convId: activeId, msgId, reqId };
    setStreaming(true);

    if (!window.localai) {
      setStreaming(false);
      return;
    }

    window.localai.chat({
      id: reqId,
      model,
      messages: buildApiMessages(history),
      web: webSearchOn && !offline,
    });
  }

  let content;
  if (screen === "loading") {
    content = (
      <div className="h-full flex items-center justify-center bg-white">
        <div className="flex items-center gap-3 text-slate-400 text-sm font-light">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Starting up…
        </div>
      </div>
    );
  } else if (screen === "onboarding") {
    content = (
      <Onboarding
        model={model}
        onReady={() => setScreen("ready")}
        onRecheck={checkStatus}
      />
    );
  } else {
    content = (
      <div className="h-full flex text-[var(--color-ink)] overflow-hidden">
        <Sidebar
          conversations={conversations}
          activeId={activeId}
          onSelect={setActiveId}
          onNew={newChat}
          onDelete={deleteChat}
          offline={offline}
          onOpenPrivacy={() => setPrivacyOpen(true)}
        />
        <Chat
          conversation={activeConv}
          streaming={streaming}
          onSend={sendMessage}
          onStop={stop}
          onRegenerate={regenerate}
          searching={searching}
          webSearchOn={webSearchOn && !offline}
          onToggleWebSearch={() => setWebSearchOn((v) => !v)}
          offline={offline}
          onSaveFile={saveReplyToFile}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[var(--color-paper)]">
      <TitleBar />
      <div className="flex-1 min-h-0">{content}</div>
      <PrivacyPanel
        open={privacyOpen}
        offline={offline}
        onToggleOffline={() => setOffline((v) => !v)}
        log={privacyLog}
        onClear={() => setPrivacyLog([])}
        onClose={() => setPrivacyOpen(false)}
      />
      <Toast toast={toast} />
    </div>
  );
}
