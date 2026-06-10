# for us in 10 — the app

A private AI that runs **entirely on your own computer**. No servers, no tracking,
nothing ever leaves your device. It feels like ChatGPT — ask anything, attach files
and photos — except it's 100% yours.

This is the desktop app that pairs with the [for us in 10](../localai) website.

---

## For everyday people

1. Install the free engine once: **https://ollama.com/download**
2. Open the **for us in 10** app.
3. The first time, it downloads your private AI (about 2 GB). After that it works
   instantly — even with no internet, even on a plane.
4. Start talking. Your words never leave your computer.

That's it. No accounts, no sign-ups, no subscriptions to chat.

---

## What it does

- 💬 **Chat** like ChatGPT — writing, ideas, explanations, code.
- 📎 **Attachments** — drop in documents or photos and ask about them.
- 🔒 **Truly private** — runs locally; conversations are saved only on your device.
- ✈️ **Works offline** — once set up, no internet needed.

---

## For developers

Built with **Electron + React + Vite + Tailwind v4**, styled to match the website
(Inter, slate + emerald). The AI runs through a local [Ollama](https://ollama.com)
engine — the app talks to it over `127.0.0.1:11434` from the Electron main process
and streams tokens into the UI.

```bash
npm install        # install dependencies
npm run dev        # live dev (Vite + Electron together)
npm run build      # build the renderer
npm start          # run the built app in Electron
npm run dist:win   # package a Windows installer  (also :mac / :linux)
```

### How the pieces fit

| File | Role |
|------|------|
| `electron/main.cjs` | Window, model health-check, download progress, streaming chat |
| `electron/preload.cjs` | Safe bridge between the UI and the engine |
| `src/App.jsx` | State, conversations (saved in `localStorage`), streaming logic |
| `src/components/Onboarding.jsx` | Friendly first-run: install engine → download model |
| `src/components/Chat.jsx` | Welcome screen + message list |
| `src/components/Composer.jsx` | Input box with attachments + drag-and-drop |
| `src/components/Message.jsx` | Markdown rendering + attachment chips |
| `src/components/Sidebar.jsx` | Conversation history |

The default model is `llama3.2`. If a vision-capable model (e.g. `llama3.2-vision`)
is installed, photo attachments are automatically routed to it so the AI can actually
*see* them.
