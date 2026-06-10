import { useState, useEffect, useRef, useCallback } from "react";
import Onboarding from "./components/Onboarding.jsx";
import Sidebar from "./components/Sidebar.jsx";
import Chat from "./components/Chat.jsx";
import TitleBar from "./components/TitleBar.jsx";
import ProjectPanel from "./components/ProjectPanel.jsx";
import TemplatesPanel from "./components/TemplatesPanel.jsx";
import ConnectorsPanel from "./components/ConnectorsPanel.jsx";
import Toast from "./components/Toast.jsx";
import { selectKnowledge } from "./lib/knowledge.js";

const STORAGE_KEY = "fui10.conversations.v1";
const PROJECTS_KEY = "fui10.projects.v1";
const TEMPLATES_KEY = "fui10.templates.v1";
const CONNECTORS_KEY = "fui10.connectors.v1";

// Starter templates so it's useful on day one. {{input}} is where the user types.
const DEFAULT_TEMPLATES = [
  { emoji: "📝", title: "Summarize", prompt: "Summarize the following clearly, with a few key bullet points:\n\n{{input}}" },
  { emoji: "✍️", title: "Rewrite professionally", prompt: "Rewrite the following to sound clear, warm and professional:\n\n{{input}}" },
  { emoji: "💡", title: "Explain simply", prompt: "Explain this in plain language, like I'm completely new to it:\n\n{{input}}" },
  { emoji: "✉️", title: "Draft an email", prompt: "Write a friendly, concise email about:\n\n{{input}}" },
  { emoji: "✅", title: "Find action items", prompt: "Pull out the clear action items and next steps from this:\n\n{{input}}" },
];
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

function loadProjects() {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

function loadTemplates() {
  try {
    const raw = localStorage.getItem(TEMPLATES_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  // First run: seed with the starters.
  return DEFAULT_TEMPLATES.map((t) => ({
    id: Math.random().toString(36).slice(2),
    createdAt: Date.now(),
    ...t,
  }));
}

function loadConnectors() {
  try {
    const raw = localStorage.getItem(CONNECTORS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

// Turn our stored messages (with attachments) into what the engine expects.
// Images are always included; the main process picks a working vision model
// (or strips them with a friendly note if none is installed).
function buildApiMessages(messages, project, queryText = "") {
  // Base behavior + optional project instructions + linked-file knowledge.
  let system = SYSTEM_PROMPT;
  if (project?.instructions?.trim()) {
    system += `\n\nThis conversation is part of the project "${project.name}". ` +
      `Follow these project instructions:\n${project.instructions.trim()}`;
  }
  if (project?.files?.length) {
    const knowledge = selectKnowledge(project.files, queryText);
    if (knowledge) {
      system +=
        `\n\nReference material from the user's linked files (use it to answer; ` +
        `mention the file name when you rely on it):\n${knowledge}`;
    }
  }

  const out = [{ role: "system", content: system }];
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
        content += `\n\n(The user attached a file named "${a.name}" that can't be read as text.)`;
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
  const [visionModel, setVisionModel] = useState(null);
  const [conversations, setConversations] = useState(loadConversations);
  const [activeId, setActiveId] = useState(() => loadConversations()[0]?.id || null);
  const [streaming, setStreaming] = useState(false);

  // Projects: workspaces that group chats + carry instructions + linked files
  const [projects, setProjects] = useState(loadProjects);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [settingsProjectId, setSettingsProjectId] = useState(null);
  const [usingFiles, setUsingFiles] = useState(false); // "answering from your files" cue

  // Templates / workflows
  const [templates, setTemplates] = useState(loadTemplates);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [composerSeed, setComposerSeed] = useState({ text: "", caret: 0, nonce: 0 });

  // Connectors (webhook + save)
  const [connectors, setConnectors] = useState(loadConnectors);
  const [connectorsOpen, setConnectorsOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  function showToast(text, kind = "ok") {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ id: Date.now(), text, kind });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  // The memory "brain" runs entirely in the background (main process):
  // it learns, reinforces, forgets, and compacts to keep answers sharp.
  // There is intentionally no user-facing memory UI.

  const streamRef = useRef({ convId: null, msgId: null, reqId: null });
  const pendingTemplateRef = useRef(null); // template that seeded the next message

  // Persist conversations
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
    } catch {}
  }, [conversations]);

  // Persist projects
  useEffect(() => {
    try {
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
    } catch {}
  }, [projects]);

  // Persist templates
  useEffect(() => {
    try {
      localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
    } catch {}
  }, [templates]);

  // Persist connectors
  useEffect(() => {
    try {
      localStorage.setItem(CONNECTORS_KEY, JSON.stringify(connectors));
    } catch {}
  }, [connectors]);

  /* ── Template handlers ── */
  function useTemplate(t) {
    const idx = t.prompt.indexOf("{{input}}");
    const text = t.prompt.replace("{{input}}", "");
    const caret = idx >= 0 ? idx : text.length;
    pendingTemplateRef.current = t.id; // remember which template this came from
    setComposerSeed({ text, caret, nonce: Date.now() }); // drop into the composer
    setTemplatesOpen(false);
  }

  // The place a template's output usually goes (explicit default, else learned).
  function suggestedConnectorFor(message) {
    if (!message?.templateId) return null;
    const t = templates.find((x) => x.id === message.templateId);
    if (!t) return null;
    const cid = t.defaultConnectorId || t.lastConnectorId;
    return connectors.find((c) => c.id === cid) || null;
  }
  function saveTemplate(tpl) {
    setTemplates((prev) =>
      prev.some((t) => t.id === tpl.id)
        ? prev.map((t) => (t.id === tpl.id ? tpl : t))
        : [{ ...tpl, createdAt: Date.now() }, ...prev]
    );
  }
  function deleteTemplate(id) {
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  /* ── Connector handlers (user-initiated push) ── */
  function saveConnector(c) {
    setConnectors((prev) =>
      prev.some((x) => x.id === c.id)
        ? prev.map((x) => (x.id === c.id ? c : x))
        : [c, ...prev]
    );
  }
  function deleteConnector(id) {
    setConnectors((prev) => prev.filter((c) => c.id !== id));
  }
  async function testConnector(c) {
    const res = await window.localai?.connectors?.webhook({
      url: c.url,
      text: "✅ Test from for us in 10 — your connector works!",
      title: "Connector test",
    });
    return Boolean(res?.ok);
  }
  async function saveReplyToFile(content) {
    const res = await window.localai?.connectors?.saveFile({
      suggestedName: "reply.md",
      content,
    });
    if (res?.ok) showToast("Saved to your computer");
    else if (!res?.canceled) showToast("Couldn't save the file", "error");
  }
  async function sendReplyToWebhook(connector, content, message) {
    showToast(`Sending to ${connector.name}…`);
    const res = await window.localai?.connectors?.webhook({
      url: connector.url,
      text: content,
      title: "Shared from for us in 10",
    });
    if (res?.ok) {
      showToast(`Sent to ${connector.name}`);
      // Learn: remember where this template's output went, for next time.
      if (message?.templateId) {
        setTemplates((prev) =>
          prev.map((t) =>
            t.id === message.templateId ? { ...t, lastConnectorId: connector.id } : t
          )
        );
      }
    } else {
      showToast(`Couldn't reach ${connector.name}`, "error");
    }
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
    if (s.visionModel) setVisionModel(s.visionModel);
    if (s.running && s.hasModel) setScreen("ready");
    else setScreen("onboarding");
  }, []);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Wire up streaming listeners once
  useEffect(() => {
    if (!window.localai) return;
    const offToken = window.localai.onToken(({ id, token }) => {
      if (id !== streamRef.current.reqId) return;
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
      setUsingFiles(false);
      streamRef.current = { convId: null, msgId: null, reqId: null };
    };
    const offDone = window.localai.onDone(finish);
    const offErr = window.localai.onError(({ id, error }) => {
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
      setUsingFiles(false);
      streamRef.current = { convId: null, msgId: null, reqId: null };
    });
    return () => {
      offToken?.();
      offDone?.();
      offErr?.();
    };
  }, []);

  const activeConv = conversations.find((c) => c.id === activeId) || null;
  // Chats shown in the sidebar depend on the selected project (null = all).
  const visibleConversations = activeProjectId
    ? conversations.filter((c) => c.projectId === activeProjectId)
    : conversations;
  // The project that governs the current chat (existing conv's, or the selected one).
  const activeProject =
    projects.find(
      (p) => p.id === (activeConv ? activeConv.projectId : activeProjectId)
    ) || null;
  const settingsProject = projects.find((p) => p.id === settingsProjectId) || null;

  function newChat() {
    setActiveId(null);
  }

  function deleteChat(id) {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) setActiveId(null);
  }

  /* ── Project handlers ── */
  function createProject() {
    const p = {
      id: uid(),
      name: "New project",
      instructions: "",
      files: [],
      createdAt: Date.now(),
    };
    setProjects((prev) => [p, ...prev]);
    setActiveProjectId(p.id);
    setActiveId(null);
    setSettingsProjectId(p.id); // open settings so they can name it & add files
  }

  function updateProject(id, patch) {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }

  function deleteProject(id) {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    // Detach its chats rather than deleting them.
    setConversations((prev) =>
      prev.map((c) => (c.projectId === id ? { ...c, projectId: null } : c))
    );
    if (activeProjectId === id) setActiveProjectId(null);
    if (settingsProjectId === id) setSettingsProjectId(null);
  }

  function addFilesToProject(id, newFiles) {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, files: [...(p.files || []), ...newFiles] } : p
      )
    );
  }

  function removeFileFromProject(id, fileId) {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, files: (p.files || []).filter((f) => f.id !== fileId) }
          : p
      )
    );
  }

  async function sendMessage(text, attachments) {
    if (streaming) return;
    const trimmed = text.trim();
    if (!trimmed && attachments.length === 0) return;

    const userMsg = { id: uid(), role: "user", content: trimmed, attachments };
    const asstMsg = { id: uid(), role: "assistant", content: "" };
    // Tag this reply with the template that produced it (for smart sharing).
    if (pendingTemplateRef.current) {
      asstMsg.templateId = pendingTemplateRef.current;
      pendingTemplateRef.current = null;
    }

    let convId = activeId;
    let baseMessages = [];

    if (!convId) {
      // Start a fresh conversation, titled from the first message.
      convId = uid();
      const title =
        trimmed.slice(0, 40) + (trimmed.length > 40 ? "…" : "") ||
        attachments[0]?.name ||
        "New chat";
      const conv = {
        id: convId,
        title,
        createdAt: Date.now(),
        projectId: activeProjectId || null, // inherit the selected project
        messages: [userMsg, asstMsg],
      };
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

    // Which project governs this chat (for instructions + linked knowledge)?
    const existing = conversations.find((c) => c.id === convId);
    const projId = existing ? existing.projectId : activeProjectId;
    const chatProject = projects.find((p) => p.id === projId) || null;
    setUsingFiles(Boolean(chatProject?.files?.length)); // show "reading your files" cue

    const reqId = uid();
    streamRef.current = { convId, msgId: asstMsg.id, reqId };
    setStreaming(true);

    if (!window.localai) {
      // Browser preview fallback: echo so the UI is testable without Electron.
      setStreaming(false);
      return;
    }

    // If the user attached a photo and a vision-capable model is installed,
    // route this turn to it so attachments are actually "seen".
    window.localai.chat({
      id: reqId,
      model, // main process upgrades to a vision model when photos are present
      messages: buildApiMessages(baseMessages, chatProject, trimmed),
    });
  }

  function stop() {
    if (streamRef.current.reqId) window.localai?.stop(streamRef.current.reqId);
    setStreaming(false);
    setUsingFiles(false);
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
    const proj = projects.find((p) => p.id === conv.projectId) || null;
    const lastQuery = [...history].reverse().find((m) => m.role === "user")?.content || "";

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
      model, // main process upgrades to a vision model when photos are present
      messages: buildApiMessages(history, proj, lastQuery),
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
      <div className="h-full flex bg-white text-slate-900 overflow-hidden">
        <Sidebar
          conversations={visibleConversations}
          activeId={activeId}
          onSelect={setActiveId}
          onNew={newChat}
          onDelete={deleteChat}
          projects={projects}
          activeProjectId={activeProjectId}
          onSelectProject={(pid) => {
            setActiveProjectId(pid);
            setActiveId(null);
          }}
          onNewProject={createProject}
          onProjectSettings={setSettingsProjectId}
          onOpenSharing={() => setConnectorsOpen(true)}
        />
        <Chat
          conversation={activeConv}
          streaming={streaming}
          onSend={sendMessage}
          onStop={stop}
          onRegenerate={regenerate}
          project={activeProjectId ? activeProject : null}
          onProjectSettings={() => setSettingsProjectId(activeProjectId)}
          usingFiles={usingFiles}
          templates={templates}
          onUseTemplate={useTemplate}
          onOpenTemplates={() => setTemplatesOpen(true)}
          composerSeed={composerSeed}
          connectors={connectors}
          onSaveFile={saveReplyToFile}
          onSendWebhook={sendReplyToWebhook}
          onManageConnectors={() => setConnectorsOpen(true)}
          getSuggestedConnector={suggestedConnectorFor}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      <TitleBar />
      <div className="flex-1 min-h-0">{content}</div>
      <ProjectPanel
        project={settingsProject}
        onClose={() => setSettingsProjectId(null)}
        onUpdate={(patch) => updateProject(settingsProject.id, patch)}
        onAddFiles={(files) => addFilesToProject(settingsProject.id, files)}
        onRemoveFile={(fid) => removeFileFromProject(settingsProject.id, fid)}
        onDelete={() => deleteProject(settingsProject.id)}
      />
      <TemplatesPanel
        open={templatesOpen}
        templates={templates}
        connectors={connectors}
        onClose={() => setTemplatesOpen(false)}
        onUse={useTemplate}
        onSave={saveTemplate}
        onDelete={deleteTemplate}
      />
      <ConnectorsPanel
        open={connectorsOpen}
        connectors={connectors}
        onClose={() => setConnectorsOpen(false)}
        onSave={saveConnector}
        onDelete={deleteConnector}
        onTest={testConnector}
      />
      <Toast toast={toast} />
    </div>
  );
}
