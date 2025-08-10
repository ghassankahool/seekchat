const { contextBridge, ipcRenderer } = require("electron");

// For debugging
console.log("Preload script loaded successfully!");

// Safely wrap IPC calls, add error handling
function safeIpcCall(channel, ...args) {
  try {
    return ipcRenderer.invoke(channel, ...args).catch((error) => {
      console.error(`IPC call ${channel} failed:`, error);
      throw error;
    });
  } catch (error) {
    console.error(`Unable to call IPC ${channel}:`, error);
    throw error;
  }
}

// Ensure API is available on the window object
if (process.contextIsolated) {
  contextBridge.exposeInMainWorld("electronAPI", {
    // Session related
    getSessions: () => safeIpcCall("get-sessions"),
    createSession: (name) => safeIpcCall("create-session", name),
    deleteSession: (id) => safeIpcCall("delete-session", id),
    updateSessionMetadata: (sessionId, metadata) =>
      safeIpcCall("update-session-metadata", sessionId, metadata),
    updateSessionName: (sessionId, name) =>
      safeIpcCall("update-session-name", sessionId, name),

    // Message related
    getMessages: (sessionId) => safeIpcCall("get-messages", sessionId),
    deleteMessages: (sessionId) => safeIpcCall("delete-messages", sessionId),
    addMessage: (message) => safeIpcCall("add-message", message),
    updateMessageStatus: (id, status) =>
      safeIpcCall("update-message-status", id, status),
    updateMessageContent: (id, content) =>
      safeIpcCall("update-message-content", id, content),
    createOrUpdateMessage: (message) =>
      safeIpcCall("create-or-update-message", message),

    // MCP related
    invokeMCP: (channel, ...args) => safeIpcCall(channel, ...args),

    // Database events
    onDatabaseError: (callback) => {
      ipcRenderer.on("db-error", (_, message) => callback(message));
      return () => ipcRenderer.removeListener("db-error", callback);
    },

    // Open link in system default browser
    openExternalURL: (url) => safeIpcCall("open-external-url", url),
  });
} else {
  window.electronAPI = electronAPI;
}
