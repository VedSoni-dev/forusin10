# Local AI Platform Spec

## Working thesis

We are not building another desktop wrapper around a local model. We are building a local AI runtime that users install once and then use everywhere: on our own website, in our own apps, and inside third-party products through a developer SDK.

The shift is from downloading models to installing working local intelligence.

Current local AI tooling mostly distributes:

- model weights
- a thin inference runner
- a manual developer workflow

We want to distribute:

- model runtime
- tool runtime
- memory and local persistence
- local permissions
- file and browser capabilities
- agent orchestration
- website connectivity
- developer SDK
- packaged "ecosystems" instead of raw models

## Core claim

Users should be able to use a beautiful website like ChatGPT while the actual AI runs on their own machine.

Developers should be able to build AI products against our SDK instead of paying per-token cloud API bills.

That means:

- users own the compute
- users keep their data local
- developers integrate once
- every compatible app can reuse the user's installed runtime

## Product pillars

### 1. Local runtime

The runtime is the real product. It is a long-running local service that manages:

- model execution
- model downloads and updates
- tool calling
- memory storage
- file access
- browser and local action capabilities
- permission prompts
- app-to-runtime authentication
- telemetry that stays local by default

This replaces the current "open the desktop app to chat" assumption with "install the runtime once and let multiple surfaces use it."

### 2. Web shell

The website is the primary consumer surface.

Users visit our site and interact with AI exactly like they would with a cloud product, except the website connects to a local runtime on the user's device.

The website should:

- detect whether the runtime is installed
- guide install when missing
- connect securely to the local runtime
- provide a fast chat and workspace UI
- expose local/private status clearly
- allow capability approvals when apps ask for access

### 3. Developer SDK

Developers should integrate our local AI stack the way they currently integrate OpenAI, Anthropic, or Gemini APIs.

The difference is that requests resolve against the end user's local runtime when available.

This gives developers:

- no per-token inference bill for local users
- private-by-default execution
- shared user intelligence across apps
- access to local capabilities beyond text generation

### 4. Ecosystem bundles

Users should not install just "a model." They should install a package that contains the pieces required to make the model useful.

A bundle can include:

- model or model profile
- system behavior
- tools
- memory modules
- file parsers
- domain presets
- local safety policies
- update channel

Example bundle types:

- General Assistant
- Coding Workspace
- Research Agent
- Creative Studio
- Shopping or Fashion Assistant

## User stories

### Consumer

"I want ChatGPT-level convenience, but I do not want my conversations, files, or photos living on somebody else's servers."

Flow:

1. User visits website.
2. Website detects whether runtime is installed.
3. If not installed, user installs the runtime.
4. Runtime downloads the selected intelligence bundle.
5. User returns to website and chats immediately.
6. The website shows that inference is running locally.

### Developer

"I want AI in my app, but I do not want token costs, vendor lock-in, or privacy headaches."

Flow:

1. Developer installs our SDK.
2. Developer uses a chat or generate API compatible surface.
3. End user opens developer app.
4. SDK checks for local runtime.
5. If runtime exists, calls are executed locally on the user's device.
6. If runtime is missing, app can prompt install or fall back to a hosted mode later.

### Ecosystem user

"I already installed this local AI once. Every app that supports it should just work."

Flow:

1. User installs runtime and one or more bundles.
2. User visits another compatible product.
3. Product detects runtime and asks for permission.
4. Product reuses the user's local AI stack instead of requiring new onboarding.

## Platform architecture

```text
Browser UI / Website / 3P App
            |
            v
      SDK or Web Bridge
            |
            v
   Local Runtime Gateway
            |
   ---------------------
   |         |         |
   v         v         v
 Models   Tools    Memory/State
   |         |         |
   ---------------------
            |
            v
  Local permissions + audit layer
```

## Runtime architecture

The runtime should evolve from the current Electron-only app into a split architecture:

### Current state in this repo

- `electron/main.cjs` handles model lifecycle, chat orchestration, web search, updates, and file access.
- `electron/memory.cjs` handles local memory extraction, reinforcement, dreaming, and compaction.
- `src/` provides the consumer UI.

### Target state

#### A. Local daemon

A background process that runs independently of the UI and exposes a local API.

Responsibilities:

- keep models available
- manage bundle installation
- expose chat/generation/tool endpoints
- enforce permission prompts
- expose capability discovery
- manage per-app sessions and grants

Likely interface:

- `http://127.0.0.1:<port>` for local apps and browser bridge
- websocket for streaming tokens and events

Current implementation:

- `runtime/daemon.cjs` exposes the same v1 localhost HTTP API as the Electron gateway.
- `runtime/fui.cjs` provides the Ollama-style terminal surface: `fui serve`, `fui status`, `fui run`, `fui trust-web`, and `fui grants`.
- It reuses `electron/memory.cjs` and the top-level `bundles/` manifests.
- It expects an Ollama-compatible engine at `FUI10_OLLAMA_URL` or `http://127.0.0.1:11434`.
- It stores daemon state in `~/.forusin10` unless `FUI10_RUNTIME_DATA_DIR` is set.
- It rejects unknown browser origins while headless until the user trusts them with `fui trust-web` or `fui trust <origin>`.

#### B. Desktop control app

The desktop app becomes a management console instead of the only user interface.

Responsibilities:

- install and update runtime
- browse installed bundles
- manage permissions
- inspect local memory and storage
- inspect connected apps
- debug local runtime

#### C. Web shell

The website becomes the default user-facing experience.

Responsibilities:

- detect runtime
- connect to it through a local bridge
- render chat, documents, agents, and settings
- gracefully handle "runtime not installed"

#### D. SDK

The SDK lets third-party apps connect to the runtime with a stable contract.

## SDK shape

The SDK should feel familiar to developers who have used cloud model APIs, but expose richer local capabilities.

### Principles

- local-first
- capability-based
- permissioned
- streaming by default
- works in browser and Node
- graceful fallback when runtime is unavailable

### Example surface

```ts
import { createLocalAI } from "@our/runtime-sdk";

const ai = await createLocalAI({
  appId: "com.example.fashion",
  appName: "Drip",
});

const session = await ai.connect();

const reply = await session.chat({
  messages: [
    { role: "user", content: "Build me 3 outfit ideas from these photos." }
  ],
  attachments: photos,
});

const result = await session.generate({
  prompt: "Write a short product blurb",
});

const tools = await session.tools.list();

const file = await session.files.pick();
```

### First-class SDK domains

- `chat()`
- `generate()`
- `embed()` later if needed
- `tools.list()`
- `tools.call()`
- `files.pick()`
- `browser.request()` for approved local browsing capabilities
- `permissions.request()`
- `capabilities.get()`
- `bundles.list()`
- `bundles.require()`

### App handshake

Each app should:

1. identify itself with `appId`
2. declare requested capabilities
3. receive user approval
4. get a scoped session token from the local runtime

This makes the runtime a user-controlled platform, not a blind local port that any site can abuse.

## Security and permission model

This is one of the biggest product differentiators. The runtime must feel safe enough that users actually trust it.

Rules:

- no app gets raw machine access without explicit approval
- local websites and third-party apps should receive scoped grants
- grants should be revocable
- all network-using actions should be visible
- "local only" status should be explicit in the UI
- file and browser access should be permissioned separately

Permission examples:

- chat only
- chat + attachments
- local file picker
- local folder read
- browser actions
- internet lookup
- persistent memory access

## Model strategy

We should not begin by rebuilding low-level inference infrastructure from scratch.

### Phase 1 model strategy

Use the best existing local runner under the hood while owning everything above it:

- runtime orchestration
- packaging
- local API
- website bridge
- permissions
- developer SDK
- bundle system

The user's install experience should feel like our platform even if the lowest inference layer initially wraps an existing engine.

### Phase 2 model strategy

Abstract the model backend behind an internal runtime interface so we can later swap or add:

- Ollama-compatible backends
- llama.cpp based backends
- MLX on Apple silicon
- vLLM style local-serving paths where appropriate
- our own optimized runner later

### Model profile guidance

We should think in bundles and device profiles, not a single magic model.

Suggested initial profiles:

- `fast`: 3B to 4B class model for weaker devices
- `balanced`: 7B to 8B class model for mainstream laptops
- `vision`: multimodal model for image-first tasks
- `code`: code-biased model profile

Do not hard-commit the company to one model family in the product story. Keep the product promise centered on the runtime and ecosystem.

## Website integration

The website should be the mainstream entry point because users prefer browser-first products.

### Detection path

The site should:

1. check for a local runtime bridge
2. if absent, show install CTA
3. if present, initiate handshake
4. show local/private connected state

Possible connection mechanisms:

- localhost HTTP + websocket
- browser helper/extension if needed
- custom protocol deep link as install fallback

Recommended v1 direction:

- local HTTP gateway
- websocket streaming
- explicit origin allowlist
- signed app/site handshake

## Packaging and bundle system

A bundle is the unit users install.

### Bundle contents

- manifest
- model requirements
- prompt/system behavior
- tools
- parsers
- memory policies
- UI metadata
- update channel

### Example manifest shape

```json
{
  "id": "general.assistant",
  "name": "General Assistant",
  "version": "0.1.0",
  "models": {
    "preferred": "balanced",
    "fallback": "fast"
  },
  "capabilities": ["chat", "files", "memory"],
  "tools": ["web-search", "folder-read"],
  "permissions": {
    "network": "ask",
    "filesystem": "scoped"
  }
}
```

## Business logic and platform lock-in

The moat is not just model quality.

The moat is:

- user-installed runtime
- developer SDK integration
- cross-app reuse of the same local intelligence stack
- switching cost once users trust local/private workflows
- bundles and capability ecosystem

This is ecosystem lock-in through ownership, not cloud captivity.

That is a much stronger emotional story:

"Your AI belongs to you, and the apps you use can plug into it."

## What we keep from the current repo

This repo is not throwaway. It already contains useful foundations.

Keep and reuse:

- local streaming orchestration in `electron/main.cjs`
- local memory engine in `electron/memory.cjs`
- document extraction in `src/lib/extract.js`
- onboarding/install packaging flow
- privacy-first UI language
- update infrastructure

What changes:

- chat app stops being the product and becomes one surface
- the runtime gets split out from the UI
- website connection becomes a first-class path
- SDK becomes a top-level deliverable

## What to cut or de-emphasize

- positioning this as just a private desktop app
- depending on the Electron window as the only interaction model
- product language centered on "download a model"
- product framing that is too narrowly about memory instead of the full runtime

## V1 build plan

### Milestone 1: separate runtime from UI

Goal:

Extract the current chat orchestration and memory logic into a local runtime service boundary.

Deliverables:

- internal runtime module
- local HTTP and websocket server
- Electron app talks to runtime through the same interface the website will use

### Milestone 2: local website bridge

Goal:

Make a browser surface connect to the local runtime.

Deliverables:

- runtime discovery
- secure handshake
- streaming chat in browser
- clear local/private status indicators

### Milestone 3: developer SDK alpha

Goal:

Let one external sample app call the user's local runtime.

Deliverables:

- JavaScript SDK
- `chat()` and `generate()` methods
- app identity and permission prompt flow
- one reference demo app

### Milestone 4: bundle installer

Goal:

Stop installing raw models and start installing bundles.

Deliverables:

- bundle manifest format
- install manager
- at least 2 bundle types
- profile-based model selection

### Milestone 5: platform control plane

Goal:

Turn the current desktop app into a runtime manager.

Deliverables:

- installed bundles UI
- permissions UI
- connected apps UI
- runtime health UI

## Immediate implementation plan for this repo

The smartest next steps from the current codebase are:

1. Define a runtime API contract inside the repo.
2. Move chat orchestration behind that contract.
3. Move memory and tool modules behind that contract.
4. Add a local HTTP server in the Electron/main process or a sibling runtime process.
5. Build one browser-based client page that talks to the local runtime.
6. Extract an alpha SDK from that browser client.

## Implementation status

Started:

- Local runtime gateway inside `electron/main.cjs`.
- Standalone runtime daemon in `runtime/daemon.cjs`.
- Ollama-style CLI in `runtime/fui.cjs`.
- Runtime endpoints documented in `docs/runtime-api.md`.
- Alpha JavaScript SDK in `sdk/localai.js`.
- OpenAI-style compatibility endpoints: `GET /v1/models` and `POST /v1/chat/completions`.
- Third-party-style browser example in `examples/fashion-client/index.html`.
- Bundle manifests in `bundles/general-assistant` and `bundles/fashion-stylist`.
- Browser/web mode in `src/App.jsx` detects the local runtime and streams through the SDK when Electron is not present.
- Per-app permission grants in the runtime gateway for chat and memory access.
- Connected-app grants are visible and revocable from the desktop Privacy panel.

Still needed:

- Unify Electron gateway and standalone daemon behind shared runtime modules.
- Add finer-grained permission categories and grant editing.
- Deploy the hosted website client against the SDK.
- Add bundle install manager and update channel.
- Add production release/deployment automation for the runtime and website.

## Open questions

- Should the runtime be a child process of the desktop app first, or its own installable daemon immediately?
- Do we want browser connectivity through localhost only, or also a browser extension for stronger trust and UX?
- How much of the current web search/tool logic belongs in the core runtime versus optional bundles?
- Do we want one bundled default model profile, or a device-detected install decision tree?
- What is the minimal permission model that still feels safe enough for third-party apps?

## Recommended first concrete build after this spec

Build the runtime API first.

Not the landing page.
Not the final brand.
Not the whole SDK.

The first proof should be:

"Our website can talk to a local runtime on your machine and stream a response from your local model."

Once that works, the rest of the platform story becomes real.
