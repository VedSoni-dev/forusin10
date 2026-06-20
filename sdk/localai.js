const DEFAULT_BASE_URL = "http://127.0.0.1:43110";

export class LocalAIRuntime {
  constructor({ baseUrl = DEFAULT_BASE_URL, appId, appName, fetchImpl } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.appId = appId || "unknown.app";
    this.appName = appName || "Unknown app";
    this.fetch = fetchImpl || globalThis.fetch;
    if (!this.fetch) {
      throw new Error("LocalAI SDK requires fetch. Pass fetchImpl in this environment.");
    }
  }

  async health() {
    return this.#json("/v1/health");
  }

  async capabilities() {
    return this.#json("/v1/capabilities");
  }

  async models() {
    return this.#json("/v1/models");
  }

  async grant() {
    return this.#json("/v1/permissions/grants");
  }

  async requestPermissions(capabilities = ["chat"]) {
    return this.#json("/v1/permissions/request", {
      method: "POST",
      body: JSON.stringify({ capabilities }),
    });
  }

  async revokePermissions() {
    return this.#json("/v1/permissions/revoke", {
      method: "POST",
      body: JSON.stringify({}),
    });
  }

  async connect({ capabilities = ["chat"] } = {}) {
    await this.requestPermissions(capabilities);
    return this;
  }

  async memory() {
    return this.#json("/v1/memory");
  }

  async bundles() {
    return this.#json("/v1/bundles");
  }

  async generate({ prompt, messages, model, web, id } = {}) {
    return this.#json("/v1/generate", {
      method: "POST",
      body: JSON.stringify({ id, prompt, messages, model, web }),
    });
  }

  async chatCompletions({ messages, model, stream = false, web, id, onChunk, onToken } = {}) {
    if (!stream) {
      return this.#json("/v1/chat/completions", {
        method: "POST",
        body: JSON.stringify({ id, messages, model, stream, web }),
      });
    }

    const res = await this.fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: this.#headers(),
      body: JSON.stringify({ id, messages, model, stream, web }),
    });
    if (!res.ok || !res.body) {
      throw new Error(`Local runtime chat completions failed: ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let raw = "";
    let content = "";
    const chunks = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      raw += decoder.decode(value, { stream: true });
      const parts = raw.split("\n\n");
      raw = parts.pop() || "";
      for (const part of parts) {
        const chunk = parseOpenAiSse(part);
        if (!chunk) continue;
        if (chunk === "[DONE]") return { ok: true, content, chunks };
        chunks.push(chunk);
        const token = chunk.choices?.[0]?.delta?.content || "";
        if (token) {
          content += token;
          onToken?.(token, chunk);
        }
        onChunk?.(chunk);
      }
    }

    return { ok: true, content, chunks };
  }

  async stop(id) {
    return this.#json("/v1/stop", {
      method: "POST",
      body: JSON.stringify({ id }),
    });
  }

  async chat({ messages, model, web, id, onEvent, onToken } = {}) {
    const res = await this.fetch(`${this.baseUrl}/v1/chat`, {
      method: "POST",
      headers: this.#headers(),
      body: JSON.stringify({ id, messages, model, web }),
    });
    if (!res.ok || !res.body) {
      throw new Error(`Local runtime chat failed: ${res.status}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let raw = "";
    let content = "";
    const events = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      raw += decoder.decode(value, { stream: true });
      const parts = raw.split("\n\n");
      raw = parts.pop() || "";
      for (const part of parts) {
        const event = parseSseEvent(part);
        if (!event) continue;
        events.push(event);
        if (event.type === "token") {
          content += event.data.token || "";
          onToken?.(event.data.token || "", event.data);
        }
        onEvent?.(event);
      }
    }

    return { ok: true, id, content, events };
  }

  async #json(path, init = {}) {
    const res = await this.fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        ...this.#headers(),
        ...(init.headers || {}),
      },
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : {};
    if (!res.ok) {
      throw new Error(data.error || `Local runtime request failed: ${res.status}`);
    }
    return data;
  }

  #headers() {
    return {
      "Content-Type": "application/json",
      "X-ForUsIn10-App": JSON.stringify({
        id: this.appId,
        name: this.appName,
      }),
    };
  }
}

export function createLocalAI(options) {
  return new LocalAIRuntime(options);
}

export async function detectLocalAI(options = {}) {
  const runtime = new LocalAIRuntime(options);
  try {
    const health = await runtime.health();
    return { installed: true, runtime, health };
  } catch (error) {
    return { installed: false, runtime, error };
  }
}

function parseSseEvent(block) {
  const lines = block.split("\n");
  const type = lines.find((line) => line.startsWith("event: "))?.slice(7).trim();
  const dataLine = lines.find((line) => line.startsWith("data: "));
  if (!type || !dataLine) return null;
  try {
    return { type, data: JSON.parse(dataLine.slice(6)) };
  } catch {
    return null;
  }
}

function parseOpenAiSse(block) {
  const dataLine = block.split("\n").find((line) => line.startsWith("data: "));
  if (!dataLine) return null;
  const data = dataLine.slice(6).trim();
  if (data === "[DONE]") return data;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}
