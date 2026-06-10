const { app, BrowserWindow, ipcMain, shell, Menu, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const { autoUpdater } = require("electron-updater");
const memory = require("./memory.cjs");

// No native menu bar (removes File / Edit / View / Window / Help).
Menu.setApplicationMenu(null);

const isDev = process.env.NODE_ENV === "development";
const OLLAMA = "http://127.0.0.1:11434";
// We pull this small multimodal model (text + photos, ~3.2 GB) under the hood,
// then alias it to a branded name so users never see a raw model id anywhere.
const BASE_MODEL = "qwen2.5vl:3b";
const DEFAULT_MODEL = "forusin10:core";

let win;
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

app.whenReady().then(() => {
  memory.init(app.getPath("userData"));
  createWindow();
  setupAutoUpdate();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
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

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
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

/* ─────────────────────────────────────────────
   Health check: is the local engine running, and
   is our model already downloaded?
───────────────────────────────────────────── */
ipcMain.handle("ollama:status", async () => {
  try {
    const res = await fetch(`${OLLAMA}/api/tags`, {
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return { running: false, hasModel: false, models: [] };
    const data = await res.json();
    const models = (data.models || []).map((m) => m.name);
    const hasBrand = models.includes(DEFAULT_MODEL);
    const hasBase = models.some((n) => n === BASE_MODEL || n.startsWith(`${BASE_MODEL}:`));
    // If the base model is present but the branded alias isn't, create it
    // and retire the raw tag so users only ever see the brand.
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
      running: true,
      hasModel: hasBrand || hasBase,
      models,
      chatModel: DEFAULT_MODEL,
      visionModel,
      defaultModel: DEFAULT_MODEL,
    };
  } catch {
    return { running: false, hasModel: false, models: [] };
  }
});

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
   Chat — stream tokens back to the renderer
───────────────────────────────────────────── */
ipcMain.handle("chat:start", async (_e, { id, model, messages }) => {
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
