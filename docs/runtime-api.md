# Local Runtime API

The core product is a localhost runtime. It can run as a standalone daemon,
Ollama-style, and the hosted website or third-party apps connect to it.

## Install flow

Windows installer target:

1. Install `for us in 10`.
2. Open a new terminal.
3. Run `fui trust-web`.
4. Run `fui serve`.
5. Open `https://www.10humansvsai.com`.

Mac installer target:

1. Install `for us in 10`.
2. Run the bundled `install-fui.command` once.
3. Open a new terminal.
4. Run `fui trust-web`.
5. Run `fui serve`.
6. Open `https://www.10humansvsai.com`.

The desktop window can still ship in the same installer as an optional control
panel, but the runtime and terminal command are the primary entrypoint.

Default URL:

```text
http://127.0.0.1:43110
```

Override the port:

```bash
FUI10_RUNTIME_PORT=43111 npm run dev
```

Run the standalone daemon:

```bash
npm run fui -- serve
```

Run the daemon on another port:

```bash
FUI10_RUNTIME_PORT=43111 npm run fui -- serve
```

The daemon stores memory and grants in `~/.forusin10` by default. Override it:

```bash
FUI10_RUNTIME_DATA_DIR=/path/to/local-state npm run runtime:daemon
```

Trust the hosted web shell from the terminal:

```bash
npm run fui -- trust-web
```

Run a prompt from the terminal:

```bash
npm run fui -- run "Write a launch tweet for private local AI."
```

The headless daemon has no approval dialog. For local SDK/demo development only,
you can auto-grant requested capabilities:

```bash
FUI10_DAEMON_AUTO_GRANT=1 npm run fui -- serve
```

The production web shell origins are allowed by default:

```text
https://www.10humansvsai.com
https://10humansvsai.com
https://www.forusin10.com
https://forusin10.com
```

Allow additional hosted websites to call the runtime:

```bash
FUI10_ALLOWED_ORIGINS=https://example.com npm run dev
```

Localhost and `file://` clients are allowed by default for development.
The gateway also returns `Access-Control-Allow-Private-Network: true` for browser private-network preflights from hosted sites to localhost.

## Endpoints

### `GET /v1/health`

Returns runtime identity, model status, installed model names, default model, and gateway port.

### `GET /v1/capabilities`

Returns the current runtime feature list and endpoint map.

### `GET /v1/models`

Returns an OpenAI-style model list for compatibility clients.

Response:

```json
{
  "object": "list",
  "data": [
    {
      "id": "forusin10:core",
      "object": "model",
      "created": 0,
      "owned_by": "forusin10"
    }
  ]
}
```

### `POST /v1/chat`

Streams Server-Sent Events.

Request:

```json
{
  "id": "optional-request-id",
  "model": "forusin10:core",
  "web": false,
  "messages": [
    { "role": "user", "content": "Hello" }
  ]
}
```

Set `"web": true` to allow the runtime to send one search query online when the
local planner decides the question needs current information. When that happens,
the stream emits `searching` before answer tokens begin.

Events:

- `searching`
- `compacted`
- `token`
- `done`
- `error`

### `POST /v1/generate`

Runs the same local chat path and returns the full response as JSON.

Request:

```json
{
  "prompt": "Write a short product blurb.",
  "web": false
}
```

### `POST /v1/chat/completions`

OpenAI-style compatibility endpoint backed by the local runtime.

Request:

```json
{
  "model": "forusin10:core",
  "stream": false,
  "web": false,
  "messages": [
    { "role": "user", "content": "Hello from a local app." }
  ]
}
```

Non-streaming responses use the familiar `chat.completion` shape:

```json
{
  "id": "chatcmpl-local",
  "object": "chat.completion",
  "model": "forusin10:core",
  "choices": [
    {
      "index": 0,
      "message": { "role": "assistant", "content": "Hello." },
      "finish_reason": "stop"
    }
  ]
}
```

When `stream: true`, the endpoint streams `data: {...}` chat completion chunks followed by `data: [DONE]`.

### `GET /v1/memory`

Returns local memory facts from the runtime.

### `GET /v1/bundles`

Returns installed ecosystem bundle manifests.

### `GET /v1/permissions/grants`

Returns the current grant for the calling app and origin.

Apps identify themselves with the `X-ForUsIn10-App` header:

```json
{
  "id": "com.example.fashion",
  "name": "Drip"
}
```

### `POST /v1/permissions/request`

Prompts the user to approve scoped access for the calling app and origin.
In the desktop gateway this shows an approval dialog. In the standalone daemon,
requests return `409` until the user trusts the origin with `fui trust-web` or
`fui trust <origin>`.

Request:

```json
{
  "capabilities": ["chat"]
}
```

Sensitive endpoints require grants:

- `chat` for `/v1/chat`, `/v1/chat/completions`, `/v1/generate`, and `/v1/stop`
- `memory` for `/v1/memory`

### `POST /v1/permissions/revoke`

Revokes the current app and origin's grant.

### `POST /v1/stop`

Stops an in-flight chat stream by id.

Request:

```json
{
  "id": "request-id"
}
```

## Current limitations

- The permission model is origin + app ID gated, but grant editing is still coarse.
- The standalone daemon expects an Ollama-compatible engine to already be running at `FUI10_OLLAMA_URL` or `http://127.0.0.1:11434`.
- The standalone daemon exposes local chat, generation, opt-in web search, memory, bundles, terminal trust, and grants.
- `/v1/chat/completions` is a compatibility bridge, not full OpenAI API parity.
