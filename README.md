# for us in 10 - the app

A private AI that runs **entirely on your own computer**. No servers, no tracking,
nothing ever leaves your device unless you explicitly turn on web search. It feels
like ChatGPT - ask anything, attach files and photos - except it is yours.

This is the desktop app that pairs with the for us in 10 website.

---

## For Everyday People

1. Install the **for us in 10** desktop app.
2. Open it once so the local runtime can start.
3. On first launch, let the private model download. After that, it stays on your computer.
4. Start talking. Your chats and files stay local by default.

That's it. No accounts, no sign-ups, no subscriptions to chat.

---

## What It Does

- Chat like ChatGPT for writing, ideas, explanations, and code.
- Attach PDFs, Word docs, text/code files, or photos and ask about them.
- Keep conversations saved only on your device.
- Work offline after setup.
- Turn on web search only when you need current information.

---

## For Developers

Built with **Electron + React + Vite + Tailwind v4**. The AI runs through the
local runtime and streams tokens into the UI.

```bash
npm install        # install dependencies
npm run dev        # live dev
npm run build      # build the renderer
npm start          # run the built app in Electron
npm run dist:win   # package a Windows installer
```

### How The Pieces Fit

| File | Role |
|------|------|
| `electron/main.cjs` | Window, runtime orchestration, model health, streaming chat |
| `electron/preload.cjs` | Safe bridge between the UI and the local runtime |
| `runtime/daemon.cjs` | Local HTTP runtime for browser and desktop clients |
| `src/App.jsx` | App state, conversations, privacy controls, streaming logic |
| `src/components/LandingPage.jsx` | First screen with install/setup guidance |
| `src/components/Onboarding.jsx` | Friendly first-run setup |
| `src/components/Chat.jsx` | Chat shell, suggestions, and composer |
| `src/components/Composer.jsx` | Input box with attachments and drag-and-drop |
| `src/components/Message.jsx` | Markdown rendering and attachment chips |
| `src/components/Sidebar.jsx` | Conversation history and privacy/settings entry points |

Document and markdown rendering are lazy-loaded so the first screen stays fast.
