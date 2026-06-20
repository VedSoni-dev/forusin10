#!/usr/bin/env node
const fs = require("fs");
const os = require("os");
const path = require("path");

const WEB_APP = { id: "com.10humansvsai.web", name: "10 Humans vs AI" };
const CLI_APP = { id: "com.forusin10.cli", name: "fui CLI" };
const WEB_ORIGINS = ["https://www.10humansvsai.com", "https://10humansvsai.com"];

if (require.main === module) {
  runCli(process.argv.slice(2)).catch((error) => {
    console.error(`fui: ${error.message || error}`);
    process.exit(1);
  });
}

async function runCli(argv, options = {}) {
  const command = argv[0] || "help";
  const args = argv.slice(1);
  const defaultPort = Number(process.env.FUI10_RUNTIME_PORT || 43110);
  const baseUrl = options.baseUrl || `http://127.0.0.1:${defaultPort}`;
  const dataDir = options.dataDir || process.env.FUI10_RUNTIME_DATA_DIR || path.join(os.homedir(), ".forusin10");
  const grantsFile = path.join(dataDir, "runtime-grants.json");

  if (command === "serve") {
    require("./daemon.cjs");
    return;
  }

  if (command === "status") {
    const health = await json(baseUrl, "/v1/health");
    printHealth(health, defaultPort);
    return;
  }

  if (command === "models") {
    const models = await json(baseUrl, "/v1/models");
    for (const model of models.data || []) console.log(model.id);
    return;
  }

  if (command === "trust-web") {
    for (const origin of WEB_ORIGINS) {
      saveGrant(grantsFile, dataDir, origin, WEB_APP, ["chat"]);
      console.log(`trusted ${origin} for ${WEB_APP.name}`);
    }
    return;
  }

  if (command === "trust") {
    const origin = args[0];
    if (!origin) throw new Error("usage: fui trust <origin> [--app app.id] [--name app name] [--cap chat,memory]");
    const app = {
      id: flag(args, "--app") || WEB_APP.id,
      name: flag(args, "--name") || WEB_APP.name,
    };
    const capabilities = (flag(args, "--cap") || "chat")
      .split(",")
      .map((cap) => cap.trim())
      .filter(Boolean);
    saveGrant(grantsFile, dataDir, origin, app, capabilities);
    console.log(`trusted ${origin} for ${app.name}: ${capabilities.join(", ")}`);
    return;
  }

  if (command === "grants") {
    const grants = readGrants(grantsFile).grants;
    if (!grants.length) {
      console.log("no grants");
      return;
    }
    for (const grant of grants) {
      console.log(`${grant.origin}  ${grant.appId}  ${grant.capabilities.join(",")}`);
    }
    return;
  }

  if (command === "run") {
    const prompt = args.join(" ").trim();
    if (!prompt) throw new Error('usage: fui run "your prompt"');
    saveGrant(grantsFile, dataDir, "null", CLI_APP, ["chat"]);
    const result = await json(baseUrl, "/v1/generate", {
      method: "POST",
      headers: appHeaders(CLI_APP),
      body: JSON.stringify({ prompt }),
    });
    console.log(result.content || "");
    return;
  }

  if (command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  throw new Error(`unknown command: ${command}`);
}

function flag(args, name) {
  const index = args.indexOf(name);
  if (index === -1) return "";
  return args[index + 1] || "";
}

function readGrants(grantsFile) {
  try {
    if (fs.existsSync(grantsFile)) {
      const store = JSON.parse(fs.readFileSync(grantsFile, "utf8"));
      if (Array.isArray(store.grants)) return store;
    }
  } catch {}
  return { grants: [] };
}

function writeGrants(grantsFile, dataDir, store) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(grantsFile, JSON.stringify(store, null, 2), "utf8");
}

function grantKey(origin, appId) {
  return `${origin || "null"}::${appId || "unknown.app"}`;
}

function saveGrant(grantsFile, dataDir, origin, app, capabilities) {
  const store = readGrants(grantsFile);
  const key = grantKey(origin, app.id);
  const now = new Date().toISOString();
  const existing = store.grants.find((grant) => grant.key === key);
  if (existing) {
    existing.appName = app.name;
    existing.capabilities = [...new Set([...existing.capabilities, ...capabilities])];
    existing.updatedAt = now;
  } else {
    store.grants.push({
      key,
      origin,
      appId: app.id,
      appName: app.name,
      capabilities: [...new Set(capabilities)],
      createdAt: now,
      updatedAt: now,
    });
  }
  writeGrants(grantsFile, dataDir, store);
}

async function json(baseUrl, pathname, init = {}) {
  const res = await fetch(`${baseUrl}${pathname}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.error || `runtime request failed: ${res.status}`);
  return data;
}

function appHeaders(app) {
  return {
    "X-ForUsIn10-App": JSON.stringify(app),
  };
}

function printHealth(health, defaultPort) {
  console.log(`runtime: ${health.runtime || "forusin10"} ${health.version || ""}`.trim());
  console.log(`mode: ${health.mode || "gateway"}`);
  console.log(`running: ${health.running ? "yes" : "no"}`);
  console.log(`model: ${health.defaultModel || health.chatModel || "forusin10:core"}`);
  console.log(`has model: ${health.hasModel ? "yes" : "no"}`);
  console.log(`port: ${health.port || defaultPort}`);
}

function printHelp() {
  console.log(`fui - local AI runtime

Usage:
  fui serve                 Start the local runtime daemon
  fui status                Show runtime status
  fui models                List local runtime models
  fui run "prompt"          Run a prompt through the local runtime
  fui trust-web             Trust 10humansvsai.com for browser chat
  fui trust <origin>        Trust another website or app origin
  fui grants                List local grants

Examples:
  fui serve
  fui trust-web
  fui run "write a launch tweet for private local AI"
`);
}

module.exports = {
  runCli,
};
