# for us in 10 Runtime SDK

This is the alpha JavaScript SDK for apps that want to use the user's local `for us in 10` runtime instead of a cloud model API.

The runtime listens on `http://127.0.0.1:43110` by default.

For development, start the standalone runtime daemon:

```bash
npm run fui -- serve
```

Trust the hosted browser shell:

```bash
npm run fui -- trust-web
```

For local browser demos that need automatic permission grants:

```bash
FUI10_DAEMON_AUTO_GRANT=1 npm run fui -- serve
```

## Install

This SDK is local to the repo for now:

```js
import { createLocalAI, detectLocalAI } from "./sdk/localai.js";
```

## Detect the runtime

```js
const detected = await detectLocalAI({
  appId: "com.example.fashion",
  appName: "Drip",
});

if (!detected.installed) {
  // Show an install prompt.
}

await detected.runtime.connect({
  capabilities: ["chat"],
});
```

## Stream chat

```js
const ai = createLocalAI({
  appId: "com.example.fashion",
  appName: "Drip",
});

await ai.connect({ capabilities: ["chat"] });

const result = await ai.chat({
  messages: [
    { role: "user", content: "Build me 3 outfit ideas for dinner tonight." },
  ],
  onToken(token) {
    console.log(token);
  },
});

console.log(result.content);
```

## Non-streaming generation

```js
const result = await ai.generate({
  prompt: "Write a short product blurb for a linen jacket.",
});

console.log(result.content);
```

## OpenAI-style compatibility

```js
const completion = await ai.chatCompletions({
  model: "forusin10:core",
  messages: [
    { role: "user", content: "Write a product title for a linen jacket." },
  ],
});

console.log(completion.choices[0].message.content);
```

Streaming uses OpenAI-style `chat.completion.chunk` events:

```js
await ai.chatCompletions({
  stream: true,
  messages: [{ role: "user", content: "Say hello locally." }],
  onToken(token) {
    console.log(token);
  },
});
```

## Current endpoints

- `GET /v1/health`
- `GET /v1/capabilities`
- `GET /v1/models`
- `GET /v1/memory`
- `GET /v1/bundles`
- `GET /v1/permissions/grants`
- `POST /v1/permissions/request`
- `POST /v1/permissions/revoke`
- `POST /v1/chat`
- `POST /v1/chat/completions`
- `POST /v1/generate`
- `POST /v1/stop`

## Example app

See `examples/fashion-client/index.html` for a third-party-style browser app that uses the SDK against the local runtime.
