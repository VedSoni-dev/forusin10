const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");

const memory = require("../electron/memory.cjs");

const OLLAMA = process.env.FUI10_OLLAMA_URL || "http://127.0.0.1:11434";
const RUNTIME_PORT = Number(process.env.FUI10_RUNTIME_PORT || 43110);
const RUNTIME_VERSION = "0.1.0-alpha";
const DEFAULT_MODEL = process.env.FUI10_MODEL || "forusin10:core";
const BASE_MODEL = process.env.FUI10_BASE_MODEL || "qwen2.5vl:3b";
const DATA_DIR = process.env.FUI10_RUNTIME_DATA_DIR || path.join(os.homedir(), ".forusin10");
const BUNDLES_DIR = path.join(__dirname, "..", "bundles");
const AUTO_GRANT = process.env.FUI10_DAEMON_AUTO_GRANT === "1";
const DEFAULT_ALLOWED_ORIGINS = [
  "https://www.10humansvsai.com",
  "https://10humansvsai.com",
  "https://www.forusin10.com",
  "https://forusin10.com",
];

let server = null;
let grantsFile = null;
let grantsStore = { grants: [] };
let brainBusy = false;
const controllers = new Map();

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  memory.init(DATA_DIR);
  initPermissionStore(DATA_DIR);
}

function initPermissionStore(dataDir) {
  grantsFile = path.join(dataDir, "runtime-grants.json");
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
  if (!raw) return { id: "unknown.app", name: "Unknown app" };

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

  if (!AUTO_GRANT) {
    return {
      ok: false,
      approvalRequired: true,
      error:
        "Approval UI unavailable in the headless daemon. Run `fui trust-web` for the official web shell, `fui trust <origin>` for another site, or set FUI10_DAEMON_AUTO_GRANT=1 for local development.",
    };
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

async function getRuntimeStatus() {
  try {
    const res = await fetch(`${OLLAMA}/api/tags`, {
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) throw new Error("Ollama did not respond");

    const data = await res.json();
    const models = (data.models || []).map((model) => model.name);
    const hasBrand = models.includes(DEFAULT_MODEL);
    const hasBase = models.some((name) => name === BASE_MODEL || name.startsWith(`${BASE_MODEL}:`));

    return {
      runtime: "forusin10",
      mode: "daemon",
      version: RUNTIME_VERSION,
      running: true,
      hasModel: hasBrand || hasBase,
      models,
      chatModel: DEFAULT_MODEL,
      defaultModel: DEFAULT_MODEL,
      baseModel: BASE_MODEL,
      port: RUNTIME_PORT,
      dataDir: DATA_DIR,
      approvalMode: AUTO_GRANT ? "auto-grant-dev" : "headless-deny",
    };
  } catch {
    return {
      runtime: "forusin10",
      mode: "daemon",
      version: RUNTIME_VERSION,
      running: false,
      hasModel: false,
      models: [],
      chatModel: DEFAULT_MODEL,
      defaultModel: DEFAULT_MODEL,
      baseModel: BASE_MODEL,
      port: RUNTIME_PORT,
      dataDir: DATA_DIR,
      approvalMode: AUTO_GRANT ? "auto-grant-dev" : "headless-deny",
    };
  }
}

function getRuntimeCapabilities() {
  return {
    runtime: "forusin10",
    mode: "daemon",
    version: RUNTIME_VERSION,
    capabilities: [
      "chat.stream",
      "generate",
      "memory.local",
      "bundles.local",
      "permissions.local",
      "web-search.opt-in",
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

function genRuntimeId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

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

function ddgRealUrl(href = "") {
  const match = href.match(/[?&]uddg=([^&]+)/);
  if (match) {
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return "";
    }
  }
  return href.startsWith("http") ? href : "";
}

function domainOf(url = "") {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

async function webSearch(query, max = 5) {
  try {
    const res = await fetch(
      "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(query),
      { headers: { "User-Agent": SEARCH_UA }, signal: AbortSignal.timeout(15000) }
    );
    if (!res.ok) return null;

    const html = await res.text();
    const titles = [...html.matchAll(/class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)];
    const snippets = [...html.matchAll(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g)].map((match) =>
      stripHtml(match[1])
    );
    const items = [];

    for (let i = 0; i < titles.length && items.length < max; i++) {
      const title = stripHtml(titles[i][2]);
      if (!title) continue;
      const url = ddgRealUrl(titles[i][1]);
      items.push({ title, url, snippet: snippets[i] || "" });
    }

    if (!items.length) return null;
    return items
      .map((item, index) => {
        const source = item.url ? ` - ${domainOf(item.url)}` : "";
        return `[${index + 1}] ${item.title}${source}\n${item.snippet}`;
      })
      .join("\n\n")
      .slice(0, 4000);
  } catch {
    return null;
  }
}

const PLANNER_PROMPT =
  "Classify whether answering the user's message requires looking up current, " +
  "real-time, or recent information from the web - news, prices, weather, sports " +
  "scores, schedules, or any 'latest'/'current' facts that change over time. " +
  "Creative writing, coding, math, explanations, and general knowledge do NOT " +
  "require it. Set needs_search accordingly, and if true give a short web query.";

const PLANNER_SCHEMA = {
  type: "object",
  properties: { needs_search: { type: "boolean" }, query: { type: "string" } },
  required: ["needs_search", "query"],
};

async function planSearch(model, messages) {
  const lastUser = [...messages].reverse().find((message) => message.role === "user");
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
    try {
      parsed = JSON.parse(data.message?.content || "{}");
    } catch {
      return null;
    }
    if (!parsed.needs_search) return null;
    return (parsed.query || q).trim().slice(0, 200) || null;
  } catch {
    return null;
  }
}

async function runChat({ id, model, messages, web }, events = {}) {
  const reqId = id || genRuntimeId();
  const controller = new AbortController();
  controllers.set(reqId, controller);

  try {
    const useModel = model || DEFAULT_MODEL;
    const clonedMessages = Array.isArray(messages)
      ? messages.map((message) => ({ ...message }))
      : [];

    if (web && !controller.signal.aborted) {
      const query = await planSearch(useModel, clonedMessages);
      if (query && !controller.signal.aborted) {
        events.searching?.({ id: reqId, query });
        const results = await webSearch(query);
        if (results) {
          const today = new Date().toISOString().slice(0, 10);
          const block =
            `\n\nLive web search results for "${query}" (retrieved ${today}). ` +
            `Use these to answer the user's question, and mention that you looked it up:\n${results}`;
          if (clonedMessages[0]?.role === "system") clonedMessages[0].content += block;
          else clonedMessages.unshift({ role: "system", content: block.trimStart() });
        }
      }
    }

    const recentUser = clonedMessages
      .filter((message) => message.role === "user")
      .slice(-2)
      .map((message) => message.content || "")
      .join(" ");

    const memBlock = memory.buildMemoryBlock(recentUser);
    if (memBlock) {
      if (clonedMessages[0]?.role === "system") clonedMessages[0].content += memBlock;
      else clonedMessages.unshift({ role: "system", content: memBlock.trimStart() });
    }

    const { messages: sendMessages, compacted } = await memory.compact(useModel, clonedMessages);
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
      events.error?.({ id: reqId, error: "The local model engine did not respond." });
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
          /* ignore malformed engine chunks */
        }
      }
    }

    events.done?.({ id: reqId });
    controllers.delete(reqId);

    const lastUser = [...clonedMessages].reverse().find((message) => message.role === "user");
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

async function learnInBackground(model, userText, assistantText) {
  if (brainBusy) return;
  brainBusy = true;
  try {
    await memory.learnFromExchange(model, userText, assistantText);
    if (memory.shouldDream()) await memory.dream(model);
  } catch {
    /* never let local memory crash the runtime */
  } finally {
    brainBusy = false;
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

function sendNotFound(res, origin) {
  writeJson(res, 404, { ok: false, error: "Not found" }, origin);
}

async function handleRequest(req, res) {
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
      writeJson(res, 200, { app: appInfo, origin, grant, grants: listGrants() }, origin);
      return;
    }

    if (req.method === "POST" && url.pathname === "/v1/permissions/revoke") {
      const body = await readJsonBody(req);
      const appInfo = parseRuntimeApp(req);
      const key = body.key || grantKey(origin, appInfo.id);
      const changed = revokeGrant(key);
      writeJson(res, 200, { ok: true, revoked: changed }, origin);
      return;
    }

    if (req.method === "POST" && url.pathname === "/v1/permissions/request") {
      const body = await readJsonBody(req);
      const appInfo = parseRuntimeApp(req);
      const capabilities = Array.isArray(body.capabilities) ? body.capabilities : ["chat"];
      const result = await requestGrant(origin, appInfo, capabilities);
      writeJson(res, result.ok ? 200 : result.approvalRequired ? 409 : 403, result, origin);
      return;
    }

    if (req.method === "POST" && url.pathname === "/v1/stop") {
      if (!requireGrant(req, res, origin, ["chat"])) return;
      const body = await readJsonBody(req);
      const controller = controllers.get(body.id);
      if (controller) controller.abort();
      writeJson(res, 200, { ok: true, stopped: Boolean(controller) }, origin);
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

    sendNotFound(res, origin);
  } catch (err) {
    writeJson(res, 500, { ok: false, error: String(err?.message || err) }, origin);
  }
}

function start() {
  ensureDataDir();
  server = http.createServer(handleRequest);
  server.on("error", (err) => {
    console.error("[runtime] server error:", err?.message || err);
    process.exitCode = 1;
  });
  server.listen(RUNTIME_PORT, "127.0.0.1", () => {
    console.log(`[runtime] daemon listening on http://127.0.0.1:${RUNTIME_PORT}`);
    console.log(`[runtime] data dir: ${DATA_DIR}`);
    if (!AUTO_GRANT) {
      console.log("[runtime] approve browser origins with `fui trust-web` or `fui trust <origin>`.");
    }
  });
}

function stop() {
  for (const controller of controllers.values()) controller.abort();
  controllers.clear();
  if (!server) return;
  server.close(() => process.exit(0));
}

process.on("SIGINT", stop);
process.on("SIGTERM", stop);

start();
