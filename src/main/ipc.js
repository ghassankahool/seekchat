const { ipcMain } = require("electron");
const {
  createMCPClient,
  testMCPConnection,
  executeTool,
  initMCP,
} = require("./services/mcpService");
const logger = require("./logger");

let _db = null;

// Wrap IPC handler to ensure database is initialized
function wrapDbHandler(handler) {
  return async (event, ...args) => {
    try {
      if (!_db) {
        throw new Error("Database not initialized");
      }
      return await handler(_db, ...args);
    } catch (err) {
      logger.error("IPC handler error:", err);
      throw err;
    }
  };
}

// Register all IPC handlers
async function registerIpcHandlers(db) {
  // Save database reference
  _db = db;

  // Initialize MCP module
  initMCP(db);

  // Register session and message related IPC handlers
  registerSessionMessageHandlers();

  // Register MCP related IPC handlers
  registerMCPHandlers();
}

// Register MCP related IPC handlers
function registerMCPHandlers() {
  // Get all MCP servers
  ipcMain.handle(
    "get-all-mcp-servers",
    wrapDbHandler(async (database) => {
      try {
        return await database.getAllMCPServers();
      } catch (error) {
        logger.error("IPC: Failed to get MCP servers", error);
        throw error;
      }
    })
  );

  // Get active MCP servers
  ipcMain.handle(
    "get-active-mcp-servers",
    wrapDbHandler(async (database) => {
      try {
        return await database.getActiveMCPServers();
      } catch (error) {
        logger.error("IPC: Failed to get active MCP servers", error);
        throw error;
      }
    })
  );

  // Add MCP server
  ipcMain.handle(
    "add-mcp-server",
    wrapDbHandler(async (database, serverData) => {
      try {
        return await database.addMCPServer(serverData);
      } catch (error) {
        logger.error("IPC: Failed to add MCP server", error);
        throw error;
      }
    })
  );

  // Update MCP server
  ipcMain.handle(
    "update-mcp-server",
    wrapDbHandler(async (database, id, updates) => {
      try {
        return await database.updateMCPServer(id, updates);
      } catch (error) {
        logger.error("IPC: Failed to update MCP server", error);
        throw error;
      }
    })
  );

  // Delete MCP server
  ipcMain.handle(
    "delete-mcp-server",
    wrapDbHandler(async (database, id) => {
      try {
        return await database.deleteMCPServer(id);
      } catch (error) {
        logger.error("IPC: Failed to delete MCP server", error);
        throw error;
      }
    })
  );

  // Set MCP server active status
  ipcMain.handle(
    "set-mcp-server-active",
    wrapDbHandler(async (database, id, active) => {
      try {
        return await database.setMCPServerActive(id, active);
      } catch (error) {
        logger.error("IPC: Failed to set MCP server active status", error);
        throw error;
      }
    })
  );

  // Test MCP server connection
  ipcMain.handle(
    "test-mcp-connection",
    wrapDbHandler(async (database, serverData) => {
      try {
        return await testMCPConnection(serverData);
      } catch (error) {
        logger.error("IPC: Failed to test MCP connection", error);
        return {
          success: false,
          message: `Connection failed: ${error.message}`,
          tools: [],
        };
      }
    })
  );

  // Execute MCP tool
  ipcMain.handle(
    "execute-mcp-tool",
    wrapDbHandler(async (database, serverId, toolId, parameters) => {
      try {
        return await executeTool(serverId, toolId, parameters);
      } catch (error) {
        logger.error("IPC: Failed to execute MCP tool", error);
        return {
          success: false,
          message: `Tool execution failed: ${error.message}`,
          result: null,
        };
      }
    })
  );
}

// Register session and message related IPC handlers
function registerSessionMessageHandlers() {
  // Get all sessions
  ipcMain.handle(
    "get-sessions",
    wrapDbHandler(async (database) => {
      logger.info("Main process: Get all sessions");
      return await database.getAllSessions();
    })
  );

  // Create new session
  ipcMain.handle(
    "create-session",
    wrapDbHandler(async (database, name) => {
      logger.info("Main process: Create session", name);
      return await database.createSession(name);
    })
  );

  // Get session messages
  ipcMain.handle(
    "get-messages",
    wrapDbHandler(async (database, sessionId) => {
      logger.info("Main process: Get session messages", sessionId);
      return await database.getMessages(sessionId);
    })
  );

  // Delete session messages
  ipcMain.handle(
    "delete-messages",
    wrapDbHandler(async (database, sessionId) => {
      logger.info("Main process: Delete session messages", sessionId);
      return await database.deleteMessages(sessionId);
    })
  );

  // Add message
  ipcMain.handle(
    "add-message",
    wrapDbHandler(async (database, message) => {
      logger.info("Main process: About to add message");
      const result = await database.addMessage(message);
      logger.info("Main process: Add message success, ID:", result.id);
      return result;
    })
  );

  // Update message status
  ipcMain.handle(
    "update-message-status",
    wrapDbHandler(async (database, id, status) => {
      logger.info("Main process: About to update message status, ID:", id);
      const result = await database.updateMessageStatus(id, status);
      logger.info("Main process: Update message status success");
      return result;
    })
  );

  // Update message content
  ipcMain.handle(
    "update-message-content",
    wrapDbHandler(async (database, id, content) => {
      logger.info("Main process: About to update message content, ID:", id);
      const result = await database.updateMessageContent(id, content);
      logger.info("Main process: Update message content success");
      return result;
    })
  );

  // Delete session
  ipcMain.handle(
    "delete-session",
    wrapDbHandler(async (database, id) => {
      logger.info("Main process: About to delete session", id);
      const result = await database.deleteSession(id);
      logger.info("Main process: Delete session success");
      return result;
    })
  );

  // Create or update message
  ipcMain.handle(
    "create-or-update-message",
    wrapDbHandler(async (database, message) => {
      logger.info(
        "Main process: About to create or update message",
        message.id ? `ID: ${message.id}` : "new message"
      );
      const result = await database.createOrUpdateMessage(message);
      logger.info("Main process: Create or update message success, ID:", result.id);
      return result;
    })
  );

  // Update session metadata
  ipcMain.handle(
    "update-session-metadata",
    wrapDbHandler(async (database, sessionId, metadata) => {
      logger.info("Main process: About to update session metadata, ID:", sessionId);
      const result = await database.updateSessionMetadata(sessionId, metadata);
      logger.info("Main process: Update session metadata success");
      return result;
    })
  );

  // Update session name
  ipcMain.handle(
    "update-session-name",
    wrapDbHandler(async (database, sessionId, name) => {
      logger.info("Main process: About to update session name, ID:", sessionId);
      const result = await database.updateSessionName(sessionId, name);
      logger.info("Main process: Update session name success");
      return result;
    })
  );
}

module.exports = { registerIpcHandlers };
