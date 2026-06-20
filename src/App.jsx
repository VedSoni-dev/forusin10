import { lazy, Suspense, useState, useEffect, useRef, useCallback } from "react";
import LandingPage from "./components/LandingPage.jsx";
import TitleBar from "./components/TitleBar.jsx";
import Toast from "./components/Toast.jsx";
import { detectLocalAI } from "../sdk/localai.js";

const Chat = lazy(() => import("./components/Chat.jsx"));
const Onboarding = lazy(() => import("./components/Onboarding.jsx"));
const PrivacyPanel = lazy(() => import("./components/PrivacyPanel.jsx"));
const SettingsPanel = lazy(() => import("./components/SettingsPanel.jsx"));
const Sidebar = lazy(() => import("./components/Sidebar.jsx"));

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
  const [showLanding, setShowLanding] = useState(true);
  const [model, setModel] = useState("forusin10:core");
  const [conversations, setConversations] = useState(loadConversations);
  const [activeId, setActiveId] = useState(() => loadConversations()[0]?.id || null);
  const [streaming, setStreaming] = useState(false);
  const [searching, setSearching] = useState(false); // "looking it up on the web" cue
  const [runtimeState, setRuntimeState] = useState({
    mode: window.localai ? "electron" : "web",
    connected: Boolean(window.localai),
    label: window.localai ? "Desktop runtime" : "Checking local runtime",
  });

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
  // Privacy: Offline Mode (airtight: nothing can leave) + a visible activity log
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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [runtimeGrants, setRuntimeGrants] = useState([]);
  const [memoryFacts, setMemoryFacts] = useState([]);

  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const streamRef = useRef({ convId: null, msgId: null, reqId: null });
  const browserRuntimeRef = useRef(null);

  function showToast(text, kind = "ok") {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), text, kind });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  // The memory "brain" learns quietly in the background (main process); nothing
  // to surface here: the app stays dead simple.

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

  useEffect(() => {
    if ((!privacyOpen && !settingsOpen) || !window.localai?.permissions) return;
    window.localai.permissions.list().then(setRuntimeGrants).catch(() => setRuntimeGrants([]));
  }, [privacyOpen, settingsOpen]);

  useEffect(() => {
    if (!settingsOpen || !window.localai?.memory) return;
    window.localai.memory.get().then(setMemoryFacts).catch(() => setMemoryFacts([]));
  }, [settingsOpen]);

  // Append an entry to the "what left your device" log. Keeps the newest 200.
  const logPrivacy = useCallback((type, detail) => {
    setPrivacyLog((prev) =>
      [{ id: uid(), ts: Date.now(), type, detail }, ...prev].slice(0, 200)
    );
  }, []);

  async function revokeRuntimeGrant(key) {
    if (!window.localai?.permissions) return;
    const next = await window.localai.permissions.revoke(key);
    setRuntimeGrants(next || []);
  }

  async function refreshRuntimeSettings() {
    await checkStatus();
    if (window.localai?.permissions) {
      const grants = await window.localai.permissions.list().catch(() => []);
      setRuntimeGrants(grants || []);
    }
    if (window.localai?.memory) {
      const facts = await window.localai.memory.get().catch(() => []);
      setMemoryFacts(facts || []);
    }
    showToast("Runtime status refreshed");
  }

  function clearConversations() {
    if (!window.confirm("Clear all chats saved on this computer?")) return;
    setConversations([]);
    setActiveId(null);
    showToast("Chats cleared");
  }

  function exportConversations() {
    const payload = {
      product: "for us in 10",
      exportedAt: new Date().toISOString(),
      conversations,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `for-us-in-10-chats-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    showToast("Chats exported");
  }

  async function clearMemory() {
    if (!window.localai?.memory) return;
    if (!window.confirm("Clear everything the local memory has learned?")) return;
    const facts = await window.localai.memory.clear().catch(() => null);
    if (facts) setMemoryFacts(facts);
    showToast("Memory cleared");
  }

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
      const detected = await detectLocalAI({
        appId: "com.forusin10.web",
        appName: "for us in 10 web",
      });
      browserRuntimeRef.current = detected.installed ? detected.runtime : null;
      if (detected.installed) {
        if (detected.health.chatModel) setModel(detected.health.chatModel);
        let granted = false;
        if (detected.health.running && detected.health.hasModel) {
          try {
            await detected.runtime.connect({ capabilities: ["chat"] });
            granted = true;
          } catch {
            granted = false;
          }
        }
        setRuntimeState({
          mode: "web",
          connected: Boolean(detected.health.running && detected.health.hasModel && granted),
          label:
            detected.health.running && detected.health.hasModel && granted
              ? `Local runtime on port ${detected.health.port}`
              : detected.health.running && detected.health.hasModel
                ? "Runtime access not granted"
              : "Runtime found, model not ready",
        });
      } else {
        setRuntimeState({
          mode: "web",
          connected: false,
          label: "Open the desktop app to start the local runtime",
        });
      }
      setScreen("ready");
      return;
    }
    const s = await window.localai.status();
    if (s.chatModel) setModel(s.chatModel);
    setRuntimeState({
      mode: "electron",
      connected: Boolean(s.running && s.hasModel),
      label: s.running && s.hasModel ? "Desktop runtime" : "Runtime setup needed",
    });
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
      setSearching(false); // first answer token arrived; done searching
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

  function appendAssistantToken(convId, msgId, token) {
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
  }

  function setAssistantError(convId, msgId, content) {
    setConversations((prev) =>
      prev.map((c) =>
        c.id !== convId
          ? c
          : {
              ...c,
              messages: c.messages.map((m) =>
                m.id === msgId ? { ...m, content, error: true } : m
              ),
            }
      )
    );
  }

  async function chatThroughBrowserRuntime({ reqId, convId, msgId, messages }) {
    const runtime = browserRuntimeRef.current;
    if (!runtime || !runtimeState.connected) {
      setAssistantError(
        convId,
        msgId,
        "I can't find the local runtime yet. Open the desktop app once, then refresh this page."
      );
      setStreaming(false);
      streamRef.current = { convId: null, msgId: null, reqId: null };
      return;
    }

    try {
      await runtime.chat({
        id: reqId,
        model,
        messages,
        web: webSearchOn && !offline,
        onEvent(event) {
          if (event.type === "searching" && event.data.query) {
            setSearching(true);
            logPrivacy("search", event.data.query);
          }
          if (event.type === "done" || event.type === "error") {
            setSearching(false);
          }
        },
        onToken(token) {
          setSearching(false);
          appendAssistantToken(convId, msgId, token);
        },
      });
    } catch (err) {
      setAssistantError(convId, msgId, String(err?.message || err));
    } finally {
      setStreaming(false);
      setSearching(false);
      streamRef.current = { convId: null, msgId: null, reqId: null };
    }
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
        trimmed.slice(0, 40) + (trimmed.length > 40 ? "..." : "") ||
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
      chatThroughBrowserRuntime({
        reqId,
        convId,
        msgId: asstMsg.id,
        messages: buildApiMessages(baseMessages),
      });
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
    if (streamRef.current.reqId) {
      if (window.localai) window.localai.stop(streamRef.current.reqId);
      else browserRuntimeRef.current?.stop(streamRef.current.reqId).catch(() => {});
    }
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
      chatThroughBrowserRuntime({
        reqId,
        convId: activeId,
        msgId,
        messages: buildApiMessages(history),
      });
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
  if (showLanding) {
    content = (
      <LandingPage
        runtimeState={runtimeState}
        screen={screen}
        onStart={() => setShowLanding(false)}
      />
    );
  } else if (screen === "loading") {
    content = <ScreenFallback label="Starting up..." />;
  } else if (screen === "onboarding") {
    content = (
      <Suspense fallback={<ScreenFallback label="Loading setup..." />}>
        <Onboarding
          model={model}
          onReady={() => setScreen("ready")}
          onRecheck={checkStatus}
        />
      </Suspense>
    );
  } else {
    content = (
      <Suspense fallback={<ScreenFallback label="Loading chat..." />}>
        <div className="h-full flex text-[var(--color-ink)] overflow-hidden">
          <Sidebar
            conversations={conversations}
            activeId={activeId}
            onSelect={setActiveId}
            onNew={newChat}
            onDelete={deleteChat}
            offline={offline}
            onOpenPrivacy={() => setPrivacyOpen(true)}
            onOpenSettings={() => setSettingsOpen(true)}
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
            runtimeState={runtimeState}
          />
        </div>
      </Suspense>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[var(--color-paper)]">
      <TitleBar landing={showLanding} />
      <div className="flex-1 min-h-0">{content}</div>
      {privacyOpen && (
        <Suspense fallback={null}>
          <PrivacyPanel
            open={privacyOpen}
            offline={offline}
            onToggleOffline={() => setOffline((v) => !v)}
            log={privacyLog}
            grants={runtimeGrants}
            onRevokeGrant={revokeRuntimeGrant}
            onClear={() => setPrivacyLog([])}
            onClose={() => setPrivacyOpen(false)}
          />
        </Suspense>
      )}
      {settingsOpen && (
        <Suspense fallback={null}>
          <SettingsPanel
            open={settingsOpen}
            runtimeState={runtimeState}
            model={model}
            webSearchOn={webSearchOn}
            offline={offline}
            conversationsCount={conversations.length}
            privacyLogCount={privacyLog.length}
            grants={runtimeGrants}
            memoryFacts={memoryFacts}
            canManageMemory={Boolean(window.localai?.memory)}
            onRefreshRuntime={refreshRuntimeSettings}
            onToggleWebSearch={() => setWebSearchOn((v) => !v)}
            onToggleOffline={() => setOffline((v) => !v)}
            onClearConversations={clearConversations}
            onExportConversations={exportConversations}
            onClearPrivacyLog={() => {
              if (!window.confirm("Clear the privacy activity log?")) return;
              setPrivacyLog([]);
              showToast("Privacy log cleared");
            }}
            onClearMemory={clearMemory}
            onRevokeGrant={revokeRuntimeGrant}
            onClose={() => setSettingsOpen(false)}
          />
        </Suspense>
      )}
      <Toast toast={toast} />
    </div>
  );
}

function ScreenFallback({ label }) {
  return (
    <div className="h-full flex items-center justify-center bg-white">
      <div className="flex items-center gap-3 text-slate-400 text-sm font-light">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        {label}
      </div>
    </div>
  );
}
