const { contextBridge, ipcRenderer } = require("electron");

// A small, safe bridge between the UI and the local AI engine.
contextBridge.exposeInMainWorld("localai", {
  // First-run / health
  status: () => ipcRenderer.invoke("ollama:status"),
  pullModel: (name) => ipcRenderer.invoke("model:pull", name),
  onPullProgress: (cb) => {
    const fn = (_e, data) => cb(data);
    ipcRenderer.on("model:progress", fn);
    return () => ipcRenderer.removeListener("model:progress", fn);
  },

  // Chat streaming
  chat: (payload) => ipcRenderer.invoke("chat:start", payload),
  stop: (id) => ipcRenderer.send("chat:stop", id),
  onSearching: (cb) => {
    const fn = (_e, data) => cb(data);
    ipcRenderer.on("chat:searching", fn);
    return () => ipcRenderer.removeListener("chat:searching", fn);
  },
  onToken: (cb) => {
    const fn = (_e, data) => cb(data);
    ipcRenderer.on("chat:token", fn);
    return () => ipcRenderer.removeListener("chat:token", fn);
  },
  onDone: (cb) => {
    const fn = (_e, data) => cb(data);
    ipcRenderer.on("chat:done", fn);
    return () => ipcRenderer.removeListener("chat:done", fn);
  },
  onError: (cb) => {
    const fn = (_e, data) => cb(data);
    ipcRenderer.on("chat:error", fn);
    return () => ipcRenderer.removeListener("chat:error", fn);
  },

  // Memory ("the brain") — what the AI remembers about the user
  memory: {
    get: () => ipcRenderer.invoke("memory:get"),
    delete: (id) => ipcRenderer.invoke("memory:delete", id),
    clear: () => ipcRenderer.invoke("memory:clear"),
    onUpdated: (cb) => {
      const fn = (_e, data) => cb(data);
      ipcRenderer.on("memory:updated", fn);
      return () => ipcRenderer.removeListener("memory:updated", fn);
    },
    onDreaming: (cb) => {
      const fn = (_e, data) => cb(data);
      ipcRenderer.on("memory:dreaming", fn);
      return () => ipcRenderer.removeListener("memory:dreaming", fn);
    },
  },

  permissions: {
    list: () => ipcRenderer.invoke("permissions:list"),
    revoke: (key) => ipcRenderer.invoke("permissions:revoke", key),
  },

  // App auto-update
  update: {
    check: () => ipcRenderer.invoke("update:check"),
    install: () => ipcRenderer.invoke("update:install"),
    onAvailable: (cb) => {
      const fn = (_e, data) => cb(data);
      ipcRenderer.on("update:available", fn);
      return () => ipcRenderer.removeListener("update:available", fn);
    },
    onProgress: (cb) => {
      const fn = (_e, data) => cb(data);
      ipcRenderer.on("update:progress", fn);
      return () => ipcRenderer.removeListener("update:progress", fn);
    },
    onReady: (cb) => {
      const fn = (_e, data) => cb(data);
      ipcRenderer.on("update:ready", fn);
      return () => ipcRenderer.removeListener("update:ready", fn);
    },
  },

  // Ask your files — pick a local folder; its readable text is read on-device
  files: {
    readFolder: () => ipcRenderer.invoke("files:readFolder"),
  },

  // Connectors — user-initiated "send this reply out"
  connectors: {
    webhook: (payload) => ipcRenderer.invoke("connector:webhook", payload),
    saveFile: (payload) => ipcRenderer.invoke("connector:saveFile", payload),
  },

  // Window controls for our custom title bar
  win: {
    minimize: () => ipcRenderer.send("window:minimize"),
    maximize: () => ipcRenderer.send("window:maximize"),
    close: () => ipcRenderer.send("window:close"),
    isMaximized: () => ipcRenderer.invoke("window:isMaximized"),
    onMaximizedChange: (cb) => {
      const fn = (_e, val) => cb(val);
      ipcRenderer.on("window:maximized", fn);
      return () => ipcRenderer.removeListener("window:maximized", fn);
    },
  },

  platform: process.platform,
});
