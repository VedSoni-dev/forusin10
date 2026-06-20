const { app, BrowserWindow, ipcMain, shell, Menu, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const http = require("http");
const { spawn } = require("child_process");
const { autoUpdater } = require("electron-updater");
const memory = require("./memory.cjs");
const { runCli } = require("../runtime/fui.cjs");

/* ─────────────────────────────────────────────
   Bundled Ollama management
   We ship the Ollama server binary inside the app package and start it
   automatically on launch. Users never install anything manually.
───────────────────────────────────────────── */
let ollamaProcess = null;

function getOllamaBinaryPath() {
  const bin = process.platform === "win32" ? "ollama.exe" : "ollama";
  if (app.isPackaged) {
    // In production: electron-builder copies the binary into Resources/ollama/
    return path.join(process.resourcesPath, "ollama", bin);
  }
  // Dev mode: fall back to a system-installed Ollama so local dev still works.
  if (process.platform === "win32") {
    const local = path.join(
      process.env.LOCALAPPDATA || "",
      "Programs", "Ollama", "ollama.exe"
    );
    if (fs.existsSync(local)) return local;
    return "ollama"; // hope it's on PATH
  }
  return "/usr/local/bin/ollama";
}

async function isOllamaAlreadyRunning() {
  try {
    const r = await fetch(`${OLLAMA}/`, {
      signal: AbortSignal.timeout(1200),
    });
    return r.status < 500;
  } catch {
    return false;
  }
}

async function startBundledOllama() {
  // Don't start a second copy if Ollama is already up (e.g. system-level one).
  if (await isOllamaAlreadyRunning()) {
    console.log("[ollama] already running — using existing instance");
    return;
  }

  const binPath = getOllamaBinaryPath();
  if (!fs.existsSync(binPath)) {
    // In dev mode without system Ollama the app will show the setup screen and
    // wait — that's fine for development.
    console.warn("[ollama] binary not found at", binPath);
    return;
  }

  // Store models inside the app's userData folder so they survive uninstalls
  // without cluttering the user's home directory.
  const modelsDir = path.join(app.getPath("userData"), "models");
  fs.mkdirSync(modelsDir, { recursive: true });

  // Make sure the binary is executable (macOS unpacks it without the bit set).
  if (process.platform !== "win32") {
    try { fs.chmodSync(binPath, 0o755); } catch {}
  }

  console.log("[ollama] starting bundled binary:", binPath);
  ollamaProcess = spawn(binPath, ["serve"], {
    env: {
      ...process.env,
      OLLAMA_MODELS: modelsDir,
      OLLAMA_HOST: "127.0.0.1:11434",
    },
    detached: false,
    stdio: "ignore",
    windowsHide: true, // no console window on Windows
  });

  ollamaProcess.on("error", (err) => console.error("[ollama] process error:", err));
  ollamaProcess.on("exit", (code) => {
    console.log("[ollama] exited with code", code);
    ollamaProcess = null;
  });
}

// No native menu bar (removes File / Edit / View / Window / Help).
Menu.setApplicationMenu(null);

const isDev = process.env.NODE_ENV === "development";
const cliArgIndex = process.argv.indexOf("--cli");
const isCliMode = cliArgIndex !== -1;
const cliArgs = isCliMode ? process.argv.slice(cliArgIndex + 1) : [];
const OLLAMA = "http://127.0.0.1:11434";
// We pull this small multimodal model (text + photos, ~3.2 GB) under the hood,
// then alias it to a branded name so users never see a raw model id anywhere.
const BASE_MODEL = "qwen2.5vl:3b";
const DEFAULT_MODEL = "forusin10:core";
const RUNTIME_PORT = Number(process.env.FUI10_RUNTIME_PORT || 43110);
const RUNTIME_VERSION = "0.1.0-alpha";
const BUNDLES_DIR = path.join(__dirname, "..", "bundles");
const DEFAULT_ALLOWED_ORIGINS = [
  "https://www.10humansvsai.com",
  "https://10humansvsai.com",
  "https://www.forusin10.com",
  "https://forusin10.com",
];

let win;
let runtimeServer = null;
let grantsFile = null;
let grantsStore = { grants: [] };
// Tracks in-flight chat streams so they can be stopped.
const controllers = new Map();

function createWindow() {
  win = new BrowserWindow({
    width: 1180,
    height: 820,
    minWidth: 720,
    minHeight: 560,
    backgroundColor: "#ffffff",
    frame: false, // we draw our own title bar
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
    trafficLightPosition: { x: 14, y: 18 },
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  // Open external links in the system browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Keep the renderer's maximize/restore icon in sync.
  const notify = () =>
    win?.webContents.send("window:maximized", win.isMaximized());
  win.on("maximize", notify);
  win.on("unmaximize", notify);
}

app.whenReady().then(async () => {
  if (isCliMode) {
    await startCliMode();
    return;
  }

  memory.init(app.getPath("userData"));
  initPermissionStore(app.getPath("userData"));
  // Start our bundled Ollama in the background — fire-and-forget so the window
  // opens immediately while the binary is booting up.
  startBundledOllama().catch((e) => console.error("[ollama] startup error:", e));
  startRuntimeGateway().catch((e) => console.error("[runtime] startup error:", e));
  createWindow();
  setupAutoUpdate();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

async function startCliMode() {
  const userDataDir = app.getPath("userData");
  process.env.FUI10_RUNTIME_DATA_DIR = userDataDir;
  memory.init(userDataDir);
  initPermissionStore(userDataDir);

  const command = cliArgs[0] || "help";
  if (needsRuntime(command)) {
    await startBundledOllama().catch((e) => console.error("[ollama] startup error:", e));
    await startRuntimeGateway().catch((e) => console.error("[runtime] startup error:", e));
  }

  try {
    await runCli(cliArgs, {
      dataDir: userDataDir,
      baseUrl: `http://127.0.0.1:${RUNTIME_PORT}`,
    });
    if (command !== "serve") app.quit();
  } catch (error) {
    console.error(`fui: ${error?.message || error}`);
    app.exit(1);
  }
}

function needsRuntime(command) {
  return command === "serve" || command === "status" || command === "models" || command === "run";
}

// Kill the bundled Ollama process cleanly when the app quits.
app.on("before-quit", () => {
  if (runtimeServer) {
    runtimeServer.close();
    runtimeServer = null;
  }
  if (ollamaProcess) {
    ollamaProcess.kill();
    ollamaProcess = null;
  }
});

/* ─────────────────────────────────────────────
   Auto-update (GitHub Releases via electron-updater)
───────────────────────────────────────────── */
function setupAutoUpdate() {
  if (!app.isPackaged) return; // only the installed app can update itself

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", (info) => {
    win?.webContents.send("update:available", { version: info?.version });
  });
  autoUpdater.on("download-progress", (p) => {
    win?.webContents.send("update:progress", { percent: Math.round(p?.percent || 0) });
  });
  autoUpdater.on("update-downloaded", (info) => {
    win?.webContents.send("update:ready", { version: info?.version });
  });
  autoUpdater.on("error", (err) => {
    console.log("[update] error:", err?.message || err);
  });

  const check = () => autoUpdater.checkForUpdates().catch(() => {});
  check();
  setInterval(check, 6 * 60 * 60 * 1000); // re-check every 6 hours
}

ipcMain.handle("update:check", () => autoUpdater.checkForUpdates().catch(() => null));
ipcMain.handle("update:install", () => {
  // Install the already-downloaded update and relaunch.
  setImmediate(() => autoUpdater.quitAndInstall());
  return true;
});

/* ── Connectors: the user explicitly pushes a finished reply somewhere ──
   Inference + data stay local; this only fires when the user clicks "Send". */
ipcMain.handle("connector:webhook", async (_e, { url, text, title }) => {
  try {
    // Include several common keys so Slack (text), Discord (content) and
    // generic tools (message) all work without per-service config.
    const payload = {
      text,
      content: text,
      message: text,
      title: title || null,
      source: "for us in 10",
      timestamp: new Date().toISOString(),
    };
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });
    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
});

ipcMain.handle("connector:saveFile", async (_e, { suggestedName, content }) => {
  try {
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      defaultPath: suggestedName || "reply.md",
      filters: [
        { name: "Markdown", extensions: ["md"] },
        { name: "Text", extensions: ["txt"] },
      ],
    });
    if (canceled || !filePath) return { ok: false, canceled: true };
    fs.writeFileSync(filePath, content, "utf8");
    return { ok: true, path: filePath };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
});

/* ── Ask your files: read readable text files from a folder the user picks ──
   Runs entirely in the main process; the folder never leaves the device. Binary
   docs (.pdf/.docx) are handled by the renderer's extractor when attached. */
const READABLE_EXT = new Set([
  ".txt", ".md", ".markdown", ".csv", ".json", ".js", ".jsx", ".ts", ".tsx",
  ".py", ".java", ".c", ".cpp", ".cs", ".go", ".rs", ".rb", ".php", ".swift",
  ".html", ".css", ".scss", ".xml", ".yaml", ".yml", ".sql", ".sh", ".log",
]);
const MAX_FILES = 60;
const MAX_FILE_BYTES = 200 * 1024; // 200 KB per file
const MAX_TOTAL_BYTES = 4 * 1024 * 1024; // 4 MB total

function walkReadable(dir, out, total, depth) {
  if (depth > 4 || out.length >= MAX_FILES || total.bytes >= MAX_TOTAL_BYTES) return;
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const ent of entries) {
    if (out.length >= MAX_FILES || total.bytes >= MAX_TOTAL_BYTES) break;
    if (ent.name.startsWith(".") || ent.name === "node_modules") continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      walkReadable(full, out, total, depth + 1);
    } else if (ent.isFile()) {
      if (!READABLE_EXT.has(path.extname(ent.name).toLowerCase())) continue;
      let stat;
      try { stat = fs.statSync(full); } catch { continue; }
      if (stat.size === 0 || stat.size > MAX_FILE_BYTES) continue;
      let content;
      try { content = fs.readFileSync(full, "utf8"); } catch { continue; }
      total.bytes += stat.size;
      out.push({ name: ent.name, content });
    }
  }
}

ipcMain.handle("files:readFolder", async () => {
  try {
    const { canceled, filePaths } = await dialog.showOpenDialog(win, {
      properties: ["openDirectory"],
    });
    if (canceled || !filePaths?.[0]) return { ok: false, canceled: true };
    const root = filePaths[0];
    const out = [];
    walkReadable(root, out, { bytes: 0 }, 0);
    return { ok: true, folder: path.basename(root), files: out };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
});

/* ── Memory IPC: let the UI read & manage what the AI remembers ── */
ipcMain.handle("memory:get", () => memory.getFacts());
ipcMain.handle("memory:delete", (_e, id) => {
  memory.deleteFact(id);
  return memory.getFacts();
});
ipcMain.handle("memory:clear", () => {
  memory.clearAll();
  return memory.getFacts();
});
ipcMain.handle("permissions:list", () => listGrants());
ipcMain.handle("permissions:revoke", (_e, key) => {
  revokeGrant(key);
  return listGrants();
});

app.on("window-all-closed", () => {
  if (!isCliMode && process.platform !== "darwin") app.quit();
});

// Architectures that report "vision" but don't actually work on this engine:
//  - mllama  (llama3.2-vision): crashes on load
//  - gemma4  (gemma multimodal): loads but ignores the image / hallucinates
const BROKEN_ARCHS = ["mllama", "gemma4"];
// Families known to genuinely see images on this engine, in order of preference.
const PREFERRED_VISION = [
  "qwen2.5vl",
  "qwen2-vl",
  "llava-llama3",
  "llava",
  "bakllava",
  "minicpm-v",
  "pixtral",
  "llama4",
];

// Ask the engine what a single model can do. Returns { caps, arch } or null.
async function modelInfo(name) {
  try {
    const res = await fetch(`${OLLAMA}/api/show`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: name }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const info = await res.json();
    return {
      caps: info.capabilities || [],
      arch: info.model_info?.["general.architecture"] || "",
    };
  } catch {
    return null;
  }
}

// True if this exact model can reliably read images on this engine.
async function modelCanSee(name) {
  const info = await modelInfo(name);
  return Boolean(info && info.caps.includes("vision") && !BROKEN_ARCHS.includes(info.arch));
}

// Find any installed model that reliably reads images, preferring trusted families.
async function pickVisionModel(models) {
  const candidates = [];
  for (const name of models) {
    if (await modelCanSee(name)) candidates.push(name);
  }
  if (candidates.length === 0) return null;
  for (const fam of PREFERRED_VISION) {
    const hit = candidates.find((n) => n.toLowerCase().includes(fam));
    if (hit) return hit;
  }
  return candidates[0];
}

async function getRuntimeStatus() {
  try {
    const res = await fetch(`${OLLAMA}/api/tags`, {
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) {
      return {
        runtime: "forusin10",
        version: RUNTIME_VERSION,
        running: false,
        hasModel: false,
        models: [],
        port: RUNTIME_PORT,
      };
    }

    const data = await res.json();
    const models = (data.models || []).map((m) => m.name);
    const hasBrand = models.includes(DEFAULT_MODEL);
    const hasBase = models.some((n) => n === BASE_MODEL || n.startsWith(`${BASE_MODEL}:`));
    if (!hasBrand && hasBase) {
      const base = models.find((n) => n === BASE_MODEL || n.startsWith(`${BASE_MODEL}:`));
      await fetch(`${OLLAMA}/api/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: base, destination: DEFAULT_MODEL }),
      }).catch(() => {});
      await fetch(`${OLLAMA}/api/delete`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: base }),
      }).catch(() => {});
    }

    const visionModel = await pickVisionModel(models);
    return {
      runtime: "forusin10",
      version: RUNTIME_VERSION,
      running: true,
      hasModel: hasBrand || hasBase,
      models,
      chatModel: DEFAULT_MODEL,
      visionModel,
      defaultModel: DEFAULT_MODEL,
      port: RUNTIME_PORT,
    };
  } catch {
    return {
      runtime: "forusin10",
      version: RUNTIME_VERSION,
      running: false,
      hasModel: false,
      models: [],
      port: RUNTIME_PORT,
    };
  }
}

function getRuntimeCapabilities() {
  return {
    runtime: "forusin10",
    version: RUNTIME_VERSION,
    capabilities: [
      "chat.stream",
      "generate",
      "memory.local",
      "files.local-picker",
      "web-search.opt-in",
      "vision.when-model-available",
    ],
    endpoints: {
      health: "/v1/health",
      capabilities: "/v1/capabilities",
      models: "/v1/models",
      chat: "/v1/chat",
      chatCompletions: "/v1/chat/completions",
      generate: "/v1/generate",
      memory: "/v1/memory",
      bundles: "/v1/bundles",
      permissions: "/v1/permissions/request",
      stop: "/v1/stop",
    },
    models: {
      default: DEFAULT_MODEL,
      base: BASE_MODEL,
      profiles: ["fast", "balanced", "vision"],
    },
  };
}

function listBundles() {
  let entries = [];
  try {
    entries = fs.readdirSync(BUNDLES_DIR, { withFileTypes: true });
  } catch {
    return [];
  }

  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const manifestPath = path.join(BUNDLES_DIR, entry.name, "manifest.json");
      try {
        return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function initPermissionStore(userDataDir) {
  grantsFile = path.join(userDataDir, "runtime-grants.json");
  try {
    if (fs.existsSync(grantsFile)) {
      grantsStore = JSON.parse(fs.readFileSync(grantsFile, "utf8"));
    }
  } catch {
    grantsStore = { grants: [] };
  }
  if (!Array.isArray(grantsStore.grants)) grantsStore.grants = [];
}

function persistPermissionStore() {
  if (!grantsFile) return;
  try {
    fs.writeFileSync(grantsFile, JSON.stringify(grantsStore, null, 2), "utf8");
  } catch {}
}

function parseRuntimeApp(req) {
  const raw = req.headers["x-forusin10-app"];
  if (!raw) {
    return { id: "unknown.app", name: "Unknown app" };
  }
  try {
    const parsed = JSON.parse(raw);
    return {
      id: String(parsed.id || "unknown.app").slice(0, 120),
      name: String(parsed.name || parsed.id || "Unknown app").slice(0, 160),
    };
  } catch {
    return { id: "unknown.app", name: "Unknown app" };
  }
}

function grantKey(origin, appId) {
  return `${origin || "null"}::${appId || "unknown.app"}`;
}

function getGrant(origin, appId) {
  const key = grantKey(origin, appId);
  return grantsStore.grants.find((grant) => grant.key === key) || null;
}

function listGrants() {
  return [...grantsStore.grants].sort((a, b) =>
    String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))
  );
}

function revokeGrant(key) {
  const before = grantsStore.grants.length;
  grantsStore.grants = grantsStore.grants.filter((grant) => grant.key !== key);
  const changed = grantsStore.grants.length !== before;
  if (changed) persistPermissionStore();
  return changed;
}

function hasGrant(origin, appId, capabilities = []) {
  const grant = getGrant(origin, appId);
  if (!grant) return false;
  return capabilities.every((capability) => grant.capabilities.includes(capability));
}

function saveGrant(origin, appInfo, capabilities = []) {
  const key = grantKey(origin, appInfo.id);
  const now = new Date().toISOString();
  const existing = getGrant(origin, appInfo.id);
  if (existing) {
    existing.capabilities = [...new Set([...existing.capabilities, ...capabilities])];
    existing.appName = appInfo.name;
    existing.updatedAt = now;
  } else {
    grantsStore.grants.push({
      key,
      origin,
      appId: appInfo.id,
      appName: appInfo.name,
      capabilities: [...new Set(capabilities)],
      createdAt: now,
      updatedAt: now,
    });
  }
  persistPermissionStore();
}

async function requestGrant(origin, appInfo, capabilities = []) {
  if (hasGrant(origin, appInfo.id, capabilities)) {
    return { ok: true, alreadyGranted: true, grant: getGrant(origin, appInfo.id) };
  }

  if (!win) {
    return { ok: false, error: "No approval window is available." };
  }

  const label = origin === "null" ? "a local file" : origin;
  const result = await dialog.showMessageBox(win, {
    type: "question",
    buttons: ["Allow", "Deny"],
    defaultId: 0,
    cancelId: 1,
    title: "Allow local AI access?",
    message: `${appInfo.name} wants to use your local AI runtime.`,
    detail:
      `Origin: ${label}\n` +
      `App ID: ${appInfo.id}\n` +
      `Requested access: ${capabilities.join(", ") || "none"}`,
  });

  if (result.response !== 0) {
    return { ok: false, denied: true, error: "The user denied access." };
  }

  saveGrant(origin, appInfo, capabilities);
  return { ok: true, alreadyGranted: false, grant: getGrant(origin, appInfo.id) };
}

function requireGrant(req, res, origin, capabilities = []) {
  const appInfo = parseRuntimeApp(req);
  if (hasGrant(origin, appInfo.id, capabilities)) return true;
  writeJson(
    res,
    401,
    {
      ok: false,
      error: "Permission required",
      required: capabilities,
      app: appInfo,
      endpoint: "/v1/permissions/request",
    },
    origin
  );
  return false;
}

function genRuntimeId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function runChat({ id, model, messages, web }, events = {}) {
  const reqId = id || genRuntimeId();
  const controller = new AbortController();
  controllers.set(reqId, controller);

  try {
    const wantsVision = messages.some((m) => m.images?.length);
    let useModel = model || DEFAULT_MODEL;
    if (wantsVision && !(await modelCanSee(useModel))) {
      const tags = await fetch(`${OLLAMA}/api/tags`)
        .then((r) => r.json())
        .catch(() => ({}));
      const installed = (tags.models || []).map((m) => m.name);
      const vm = await pickVisionModel(installed);
      if (vm) {
        useModel = vm;
      } else {
        for (const m of messages) {
          if (m.images?.length) {
            delete m.images;
            m.content +=
              "\n\n(The user attached an image, but no photo-reading AI is " +
              "installed yet, so you can't see it. Kindly let them know.)";
          }
        }
      }
    }

    if (web && !wantsVision && !controller.signal.aborted) {
      const query = await planSearch(useModel, messages);
      if (query && !controller.signal.aborted) {
        events.searching?.({ id: reqId, query });
        const results = await webSearch(query);
        if (results) {
          const today = new Date().toISOString().slice(0, 10);
          const block =
            `\n\nLive web search results for "${query}" (retrieved ${today}). ` +
            `Use these to answer the user's question, and mention that you looked it up:\n${results}`;
          if (messages[0]?.role === "system") messages[0].content += block;
          else messages.unshift({ role: "system", content: block.trimStart() });
        }
      }
    }

    const recentUser = messages
      .filter((m) => m.role === "user")
      .slice(-2)
      .map((m) => m.content || "")
      .join(" ");
    const memBlock = memory.buildMemoryBlock(recentUser);
    if (memBlock) {
      if (messages[0]?.role === "system") messages[0].content += memBlock;
      else messages.unshift({ role: "system", content: memBlock.trimStart() });
    }

    const { messages: sendMessages, compacted } = await memory.compact(useModel, messages);
    if (compacted) events.compacted?.({ id: reqId });

    const res = await fetch(`${OLLAMA}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: useModel,
        messages: sendMessages,
        stream: true,
        options: { num_ctx: 8192 },
      }),
      signal: controller.signal,
    });

    if (!res.ok || !res.body) {
      events.error?.({ id: reqId, error: "The AI engine did not respond." });
      controllers.delete(reqId);
      return { ok: false, id: reqId };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let full = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const obj = JSON.parse(line);
          const token = obj.message?.content || "";
          if (token) {
            full += token;
            events.token?.({ id: reqId, token });
          }
        } catch {
          /* ignore */
        }
      }
    }

    events.done?.({ id: reqId });
    controllers.delete(reqId);

    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    learnInBackground(useModel, lastUser?.content || "", full);

    return { ok: true, id: reqId, content: full, model: useModel };
  } catch (err) {
    if (controller.signal.aborted) {
      events.done?.({ id: reqId, stopped: true });
    } else {
      events.error?.({ id: reqId, error: String(err?.message || err) });
    }
    controllers.delete(reqId);
    return { ok: false, id: reqId };
  }
}

function allowedOrigin(req) {
  const origin = req.headers.origin || "";
  if (!origin) return "null";
  if (origin === "null") return "null";
  try {
    const url = new URL(origin);
    const allowed = new Set(
      [...DEFAULT_ALLOWED_ORIGINS, ...(process.env.FUI10_ALLOWED_ORIGINS || "").split(",")]
        .map((x) => x.trim())
        .filter(Boolean)
    );
    const isLocal =
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "::1";
    if (isLocal || allowed.has(origin)) return origin;
  } catch {}
  return null;
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "null",
    "Access-Control-Allow-Headers": "Content-Type, X-ForUsIn10-App, Authorization",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Private-Network": "true",
    Vary: "Origin, Access-Control-Request-Private-Network",
  };
}

function writeJson(res, status, data, origin) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    ...corsHeaders(origin),
  });
  res.end(JSON.stringify(data));
}

function writeSseHeaders(res, origin) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    ...corsHeaders(origin),
  });
}

function writeSse(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function writeOpenAiSse(res, data) {
  res.write(`data: ${typeof data === "string" ? data : JSON.stringify(data)}\n\n`);
}

async function readJsonBody(req) {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  if (!raw.trim()) return {};
  return JSON.parse(raw);
}

function openAiModelsPayload() {
  return {
    object: "list",
    data: [
      {
        id: DEFAULT_MODEL,
        object: "model",
        created: 0,
        owned_by: "forusin10",
      },
    ],
  };
}

function openAiCompletionPayload({ id, model, content }) {
  return {
    id,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: model || DEFAULT_MODEL,
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: content || "" },
        finish_reason: "stop",
      },
    ],
  };
}

async function startRuntimeGateway() {
  if (runtimeServer) return;

  runtimeServer = http.createServer(async (req, res) => {
    const origin = allowedOrigin(req);
    if (!origin) {
      writeJson(res, 403, { ok: false, error: "Origin not allowed" }, "null");
      return;
    }

    if (req.method === "OPTIONS") {
      writeJson(res, 204, {}, origin);
      return;
    }

    const url = new URL(req.url, `http://127.0.0.1:${RUNTIME_PORT}`);
    try {
      if (req.method === "GET" && url.pathname === "/v1/health") {
        writeJson(res, 200, await getRuntimeStatus(), origin);
        return;
      }

      if (req.method === "GET" && url.pathname === "/v1/capabilities") {
        writeJson(res, 200, getRuntimeCapabilities(), origin);
        return;
      }

      if (req.method === "GET" && url.pathname === "/v1/models") {
        writeJson(res, 200, openAiModelsPayload(), origin);
        return;
      }

      if (req.method === "GET" && url.pathname === "/v1/memory") {
        if (!requireGrant(req, res, origin, ["memory"])) return;
        writeJson(res, 200, { facts: memory.getFacts() }, origin);
        return;
      }

      if (req.method === "GET" && url.pathname === "/v1/bundles") {
        writeJson(res, 200, { bundles: listBundles() }, origin);
        return;
      }

      if (req.method === "GET" && url.pathname === "/v1/permissions/grants") {
        const appInfo = parseRuntimeApp(req);
        const grant = getGrant(origin, appInfo.id);
        writeJson(res, 200, { app: appInfo, origin, grant }, origin);
        return;
      }

      if (req.method === "POST" && url.pathname === "/v1/permissions/revoke") {
        const appInfo = parseRuntimeApp(req);
        const changed = revokeGrant(grantKey(origin, appInfo.id));
        writeJson(res, 200, { ok: true, revoked: changed }, origin);
        return;
      }

      if (req.method === "POST" && url.pathname === "/v1/permissions/request") {
        const body = await readJsonBody(req);
        const appInfo = parseRuntimeApp(req);
        const capabilities = Array.isArray(body.capabilities) ? body.capabilities : ["chat"];
        const result = await requestGrant(origin, appInfo, capabilities);
        writeJson(res, result.ok ? 200 : result.denied ? 403 : 500, result, origin);
        return;
      }

      if (req.method === "POST" && url.pathname === "/v1/stop") {
        if (!requireGrant(req, res, origin, ["chat"])) return;
        const body = await readJsonBody(req);
        const c = controllers.get(body.id);
        if (c) c.abort();
        writeJson(res, 200, { ok: true, stopped: Boolean(c) }, origin);
        return;
      }

      if (req.method === "POST" && url.pathname === "/v1/generate") {
        if (!requireGrant(req, res, origin, ["chat"])) return;
        const body = await readJsonBody(req);
        const messages = body.messages || [{ role: "user", content: body.prompt || "" }];
        const result = await runChat({
          id: body.id,
          model: body.model,
          messages,
          web: Boolean(body.web),
        });
        writeJson(res, result.ok ? 200 : 500, result, origin);
        return;
      }

      if (req.method === "POST" && url.pathname === "/v1/chat/completions") {
        if (!requireGrant(req, res, origin, ["chat"])) return;
        const body = await readJsonBody(req);
        const messages = Array.isArray(body.messages) ? body.messages : [];

        if (body.stream) {
          const completionId = body.id || `chatcmpl-${genRuntimeId()}`;
          writeSseHeaders(res, origin);

          await runChat(
            {
              id: completionId,
              model: body.model,
              messages,
              web: Boolean(body.web),
            },
            {
              token: (data) =>
                writeOpenAiSse(res, {
                  id: completionId,
                  object: "chat.completion.chunk",
                  created: Math.floor(Date.now() / 1000),
                  model: body.model || DEFAULT_MODEL,
                  choices: [{ index: 0, delta: { content: data.token }, finish_reason: null }],
                }),
              done: () => {
                writeOpenAiSse(res, {
                  id: completionId,
                  object: "chat.completion.chunk",
                  created: Math.floor(Date.now() / 1000),
                  model: body.model || DEFAULT_MODEL,
                  choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
                });
                writeOpenAiSse(res, "[DONE]");
              },
              error: (data) => writeOpenAiSse(res, { error: data.error || "Local runtime error" }),
            }
          );
          res.end();
          return;
        }

        const result = await runChat({
          id: body.id,
          model: body.model,
          messages,
          web: Boolean(body.web),
        });
        if (!result.ok) {
          writeJson(res, 500, { error: { message: "Local runtime error" } }, origin);
          return;
        }
        writeJson(
          res,
          200,
          openAiCompletionPayload({
            id: result.id,
            model: result.model || body.model,
            content: result.content,
          }),
          origin
        );
        return;
      }

      if (req.method === "POST" && url.pathname === "/v1/chat") {
        if (!requireGrant(req, res, origin, ["chat"])) return;
        const body = await readJsonBody(req);
        writeSseHeaders(res, origin);

        await runChat(
          {
            id: body.id,
            model: body.model,
            messages: body.messages || [],
            web: Boolean(body.web),
          },
          {
            searching: (data) => writeSse(res, "searching", data),
            compacted: (data) => writeSse(res, "compacted", data),
            token: (data) => writeSse(res, "token", data),
            done: (data) => writeSse(res, "done", data),
            error: (data) => writeSse(res, "error", data),
          }
        );
        res.end();
        return;
      }

      writeJson(res, 404, { ok: false, error: "Not found" }, origin);
    } catch (err) {
      writeJson(res, 500, { ok: false, error: String(err?.message || err) }, origin);
    }
  });

  runtimeServer.on("error", (err) => {
    console.error("[runtime] server error:", err?.message || err);
  });

  runtimeServer.listen(RUNTIME_PORT, "127.0.0.1", () => {
    console.log(`[runtime] listening on http://127.0.0.1:${RUNTIME_PORT}`);
  });
}

/* ─────────────────────────────────────────────
   Health check: is the local engine running, and
   is our model already downloaded?
───────────────────────────────────────────── */
ipcMain.handle("ollama:status", getRuntimeStatus);

/* ─────────────────────────────────────────────
   First-run: download the model, streaming progress
───────────────────────────────────────────── */
ipcMain.handle("model:pull", async (_e, modelName) => {
  // Always pull the real base model (the brand name is a local-only alias).
  const requested = modelName || DEFAULT_MODEL;
  const name = requested === DEFAULT_MODEL ? BASE_MODEL : requested;
  try {
    const res = await fetch(`${OLLAMA}/api/pull`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, stream: true }),
    });
    if (!res.ok || !res.body) {
      return { ok: false, error: "Could not start the download." };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const obj = JSON.parse(line);
          let percent = null;
          if (obj.total && obj.completed) {
            percent = Math.round((obj.completed / obj.total) * 100);
          }
          win?.webContents.send("model:progress", {
            status: obj.status || "",
            percent,
          });
        } catch {
          /* ignore partial json */
        }
      }
    }
    // Alias the freshly-pulled base model to our branded name, then drop the
    // raw tag so only the brand ever appears (blobs are shared, nothing re-downloads).
    await fetch(`${OLLAMA}/api/copy`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: name, destination: DEFAULT_MODEL }),
    }).catch(() => {});
    if (name !== DEFAULT_MODEL) {
      await fetch(`${OLLAMA}/api/delete`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      }).catch(() => {});
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
});

/* ─────────────────────────────────────────────
   Background learning + "dreaming" (one at a time)
───────────────────────────────────────────── */
let brainBusy = false;
async function learnInBackground(model, userText, assistantText) {
  if (brainBusy) return;
  brainBusy = true;
  try {
    const added = await memory.learnFromExchange(model, userText, assistantText);
    if (added.length) {
      win?.webContents.send("memory:updated", {
        added: added.map((f) => f.text),
        facts: memory.getFacts(),
      });
    }
    // When enough has been learned, "dream": consolidate & prune.
    if (memory.shouldDream()) {
      win?.webContents.send("memory:dreaming", { state: "start" });
      const result = await memory.dream(model);
      win?.webContents.send("memory:dreaming", {
        state: "done",
        facts: memory.getFacts(),
        ...result,
      });
    }
  } catch {
    /* never let the brain crash the app */
  } finally {
    brainBusy = false;
  }
}

/* ─────────────────────────────────────────────
   Web search "tool" (orchestrated — the model can't call tools natively)
   A tiny planner step decides whether a question needs fresh info; if so we
   fetch results from DuckDuckGo here in the main process (no API key, no CORS)
   and feed them back into the answer. Inference stays local — only the search
   query itself leaves the device, and only when a question needs current info.
───────────────────────────────────────────── */
const SEARCH_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

function stripHtml(s = "") {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// DuckDuckGo wraps each result as //duckduckgo.com/l/?uddg=<encoded real url>.
function ddgRealUrl(href = "") {
  const m = href.match(/[?&]uddg=([^&]+)/);
  if (m) { try { return decodeURIComponent(m[1]); } catch { return ""; } }
  return href.startsWith("http") ? href : "";
}

function domainOf(url = "") {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
}

// Fetch the top web results for a query and format them for the model.
async function webSearch(query, max = 5) {
  try {
    const res = await fetch(
      "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(query),
      { headers: { "User-Agent": SEARCH_UA }, signal: AbortSignal.timeout(15000) }
    );
    if (!res.ok) return null;
    const html = await res.text();
    const titles = [...html.matchAll(/class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];
    const snippets = [...html.matchAll(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => stripHtml(m[1]));
    const items = [];
    for (let i = 0; i < titles.length && items.length < max; i++) {
      const title = stripHtml(titles[i][2]);
      if (!title) continue;
      const url = ddgRealUrl(titles[i][1]);
      items.push({ title, url, snippet: snippets[i] || "" });
    }
    if (!items.length) return null;
    return items
      .map((it, i) => `[${i + 1}] ${it.title}${it.url ? ` — ${domainOf(it.url)}` : ""}\n${it.snippet}`)
      .join("\n\n")
      .slice(0, 4000);
  } catch {
    return null;
  }
}

const PLANNER_PROMPT =
  "Classify whether answering the user's message requires looking up current, " +
  "real-time, or recent information from the web — news, prices, weather, sports " +
  "scores, schedules, or any 'latest'/'current' facts that change over time. " +
  "Creative writing, coding, math, explanations, and general knowledge do NOT " +
  "require it. Set needs_search accordingly, and if true give a short web query.";

// A JSON schema forces a real boolean — a small model ignores free-text "NONE".
const PLANNER_SCHEMA = {
  type: "object",
  properties: { needs_search: { type: "boolean" }, query: { type: "string" } },
  required: ["needs_search", "query"],
};

// Cheap pre-step: ask the model whether this turn needs a search, and for what.
async function planSearch(model, messages) {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const q = (lastUser?.content || "").trim();
  if (!q) return null;
  try {
    const res = await fetch(`${OLLAMA}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        format: PLANNER_SCHEMA,
        options: { temperature: 0, num_predict: 80 },
        messages: [
          { role: "system", content: PLANNER_PROMPT },
          { role: "user", content: q },
        ],
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    let parsed;
    try { parsed = JSON.parse(data.message?.content || "{}"); } catch { return null; }
    if (!parsed.needs_search) return null;
    return (parsed.query || q).trim().slice(0, 200) || null;
  } catch {
    return null;
  }
}

/* ─────────────────────────────────────────────
   Chat — stream tokens back to the renderer
───────────────────────────────────────────── */
ipcMain.handle("chat:start", async (_e, { id, model, messages, web }) => {
  const controller = new AbortController();
  controllers.set(id, controller);

  try {
    // Does this turn contain a photo? The default model already reads images,
    // but if the active model can't, fall back to any installed one that can.
    const wantsVision = messages.some((m) => m.images?.length);
    let useModel = model || DEFAULT_MODEL;
    if (wantsVision && !(await modelCanSee(useModel))) {
      const tags = await fetch(`${OLLAMA}/api/tags`)
        .then((r) => r.json())
        .catch(() => ({}));
      const installed = (tags.models || []).map((m) => m.name);
      const vm = await pickVisionModel(installed);
      if (vm) {
        useModel = vm;
      } else {
        // No working vision model: strip the images and tell the model in words.
        for (const m of messages) {
          if (m.images?.length) {
            delete m.images;
            m.content +=
              "\n\n(The user attached an image, but no photo-reading AI is " +
              "installed yet, so you can't see it. Kindly let them know.)";
          }
        }
      }
    }

    // ── Agentic web search: if this turn needs fresh info, fetch it silently ──
    // Only when the user has opted in, and not for image turns (those are about
    // the photo). This is the one path where a query leaves the device.
    if (web && !wantsVision && !controller.signal.aborted) {
      const query = await planSearch(useModel, messages);
      if (query && !controller.signal.aborted) {
        win?.webContents.send("chat:searching", { id, query });
        const results = await webSearch(query);
        if (results) {
          const today = new Date().toISOString().slice(0, 10);
          const block =
            `\n\nLive web search results for "${query}" (retrieved ${today}). ` +
            `Use these to answer the user's question, and mention that you looked it up:\n${results}`;
          if (messages[0]?.role === "system") messages[0].content += block;
          else messages.unshift({ role: "system", content: block.trimStart() });
        }
      }
    }

    // ── Inject relevant memories into the system prompt (reinforces them) ──
    const recentUser = messages
      .filter((m) => m.role === "user")
      .slice(-2)
      .map((m) => m.content || "")
      .join(" ");
    const memBlock = memory.buildMemoryBlock(recentUser);
    if (memBlock) {
      if (messages[0]?.role === "system") messages[0].content += memBlock;
      else messages.unshift({ role: "system", content: memBlock.trimStart() });
    }

    // ── Auto-compact long conversations so nothing gets forgotten ──
    const { messages: sendMessages, compacted } = await memory.compact(useModel, messages);
    if (compacted) win?.webContents.send("chat:compacted", { id });

    const res = await fetch(`${OLLAMA}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: useModel,
        messages: sendMessages,
        stream: true,
        options: { num_ctx: 8192 },
      }),
      signal: controller.signal,
    });

    if (!res.ok || !res.body) {
      win?.webContents.send("chat:error", {
        id,
        error: "The AI engine did not respond.",
      });
      controllers.delete(id);
      return { ok: false };
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let full = ""; // accumulate the assistant reply for learning

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const obj = JSON.parse(line);
          const token = obj.message?.content || "";
          if (token) {
            full += token;
            win?.webContents.send("chat:token", { id, token });
          }
        } catch {
          /* ignore */
        }
      }
    }
    win?.webContents.send("chat:done", { id });
    controllers.delete(id);

    // ── Learn from this exchange in the background (never blocks the reply) ──
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    learnInBackground(useModel, lastUser?.content || "", full);

    return { ok: true };
  } catch (err) {
    if (controller.signal.aborted) {
      win?.webContents.send("chat:done", { id, stopped: true });
    } else {
      win?.webContents.send("chat:error", {
        id,
        error: String(err?.message || err),
      });
    }
    controllers.delete(id);
    return { ok: false };
  }
});

ipcMain.on("chat:stop", (_e, id) => {
  const c = controllers.get(id);
  if (c) c.abort();
});

/* ─────────────────────────────────────────────
   Custom window controls (frameless title bar)
───────────────────────────────────────────── */
ipcMain.on("window:minimize", () => win?.minimize());
ipcMain.on("window:maximize", () => {
  if (!win) return;
  if (win.isMaximized()) win.unmaximize();
  else win.maximize();
});
ipcMain.on("window:close", () => win?.close());
ipcMain.handle("window:isMaximized", () => win?.isMaximized() ?? false);
