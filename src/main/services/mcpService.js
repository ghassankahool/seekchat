const {
  StdioClientTransport,
} = require("@modelcontextprotocol/sdk/client/stdio.js");
const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const logger = require("../logger");
// SSEClientTransport cannot use require, otherwise will throw "ERR_REQUIRE_ASYNC_MODULE" error, changed to dynamic import approach
// Added at the top of the file
const os = require("os");
const path = require("path");

// Determine operating system type
const isMac = process.platform === "darwin";
const isLinux = process.platform === "linux";
const isWin = process.platform === "win32";

/**
 * Get enhanced PATH environment variable, including common tool locations
 * @param {string} originalPath Original PATH environment variable
 * @returns {string} Enhanced PATH environment variable
 */
const getEnhancedPath = (originalPath) => {
  // Split the original PATH by separator into an array
  const pathSeparator = process.platform === "win32" ? ";" : ":";
  const existingPaths = new Set(
    originalPath.split(pathSeparator).filter(Boolean)
  );
  const homeDir = process.env.HOME || process.env.USERPROFILE || "";

  // Define new paths to add
  const newPaths = [];

  if (isMac) {
    newPaths.push(
      "/bin",
      "/usr/bin",
      "/usr/local/bin",
      "/usr/local/sbin",
      "/opt/homebrew/bin",
      "/opt/homebrew/sbin",
      "/usr/local/opt/node/bin",
      `${homeDir}/.nvm/current/bin`,
      `${homeDir}/.npm-global/bin`,
      `${homeDir}/.yarn/bin`,
      `${homeDir}/.cargo/bin`,
      "/opt/local/bin"
    );
  }

  if (isLinux) {
    newPaths.push(
      "/bin",
      "/usr/bin",
      "/usr/local/bin",
      `${homeDir}/.nvm/current/bin`,
      `${homeDir}/.npm-global/bin`,
      `${homeDir}/.yarn/bin`,
      `${homeDir}/.cargo/bin`,
      "/snap/bin"
    );
  }

  if (isWin) {
    newPaths.push(
      `${process.env.APPDATA}\\npm`,
      `${homeDir}\\AppData\\Local\\Yarn\\bin`,
      `${homeDir}\\.cargo\\bin`
    );
  }

  // Add application internal node_modules/.bin directory
  newPaths.push(path.join(__dirname, "..", "..", "node_modules", ".bin"));

  // Only add paths that don't exist
  newPaths.forEach((p) => {
    if (p && !existingPaths.has(p)) {
      existingPaths.add(p);
    }
  });

  // Convert back to string
  return Array.from(existingPaths).join(pathSeparator);
};
// Database instance will be obtained through global reference
let _db = null;

// Client connection pool for managing all MCP client instances
const clientPool = new Map();

/**
 * Get or create MCP client
 * @param {string} serverId Server ID
 * @returns {Promise<Client>} MCP client instance
 */
async function getOrCreateClient(serverId) {
  // Check if there's already a client for this server in the pool and connection is normal
  if (clientPool.has(serverId) && clientPool.get(serverId).isConnected) {
    logger.info(`Using existing MCP client connection: ${serverId}`);
    return clientPool.get(serverId).client;
  }

  try {
    // Get server information
    const server = await _db.getMCPServerById(serverId);
    if (!server) {
      throw new Error(`Cannot find MCP server with ID ${serverId}`);
    }

    logger.info(`Creating new MCP client connection for server ${server.name}`);

    // Create client
    const client = await createMCPClient(server);

    // Store in pool
    clientPool.set(serverId, {
      client,
      isConnected: true,
      server: server,
      lastUsed: Date.now(),
    });

    return client;
  } catch (error) {
    logger.error(`Failed to get or create MCP client: ${error.message}`, error);
    throw error;
  }
}

/**
 * Create MCP client
 * @param {Object} serverData Server data
 * @param {number} retryCount Retry count
 * @param {number} retryDelay Retry delay (milliseconds)
 * @returns {Promise<Client>} MCP client instance
 */
const createMCPClient = async (
  serverData,
  retryCount = 3,
  retryDelay = 1000
) => {
  let lastError = null;

  for (let attempt = 1; attempt <= retryCount; attempt++) {
    try {
      logger.info(`Attempting to create MCP client (${attempt}/${retryCount})...`);

      // Create client configuration
      const clientConfig = {
        name: "seekchat-client",
        version: "1.0.0",
      };

      // Create client capability settings
      const clientCapabilities = {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      };

      // Create client
      const client = new Client(clientConfig, clientCapabilities);

      // Add error handling to prevent connection close or errors
      client.on =
        client.on ||
        function (event, handler) {
          if (event === "close") {
            this._onCloseHandlers = this._onCloseHandlers || [];
            this._onCloseHandlers.push(handler);
          } else if (event === "error") {
            this._onErrorHandlers = this._onErrorHandlers || [];
            this._onErrorHandlers.push(handler);
          }
        };

      // Create different transports based on server type
      let transport;
      const connectionTimeout = 15000; // 15 second connection timeout

      if (serverData.type === "stdio") {
        // Parse command line and arguments
        const urlParts = serverData.url.split(" ");
        const command = urlParts[0];
        const args = urlParts.slice(1);

        logger.info(
          `Creating stdio transport: command=${command}, args=${JSON.stringify(args)}`
        );
        const mergedEnv = {
          ...serverData.env,
          PATH: getEnhancedPath(process.env.PATH || ""),
        };
        logger.info(`mergedEnv: ${JSON.stringify(mergedEnv)}`);

        // Create stdio transport
        transport = new StdioClientTransport({
          command,
          args,
          stderr: process.platform === "win32" ? "pipe" : "inherit",
          env: mergedEnv,
          timeout: connectionTimeout,
        });
      } else if (serverData.type === "sse") {
        logger.info(`Creating SSE transport: URL=${serverData.url}`);

        // Dynamically import SSEClientTransport
        const { SSEClientTransport } = await import(
          "@modelcontextprotocol/sdk/client/sse.js"
        );

        // Create SSE transport - no longer use apiKey
        transport = new SSEClientTransport(new URL(serverData.url));
      } else {
        throw new Error(`Unsupported MCP server type: ${serverData.type}`);
      }

      // Connect client
      await client.connect(transport);

      // Add connection close handling functionality to client
      const originalDisconnect = client.disconnect;
      client.disconnect = async function () {
        try {
          logger.info(`Disconnecting MCP client connection: ${serverData.name || "unknown"}`);

          if (this._onCloseHandlers) {
            for (const handler of this._onCloseHandlers) {
              try {
                handler();
              } catch (e) {
                logger.warn(`Failed to call connection close handler: ${e.message}`);
              }
            }
          }

          // Check if originalDisconnect exists before calling
          if (typeof originalDisconnect === "function") {
            await originalDisconnect.call(this);
          } else {
            // If original disconnect method doesn't exist, disconnect directly through transport
            if (
              this.transport &&
              typeof this.transport.disconnect === "function"
            ) {
              await this.transport.disconnect();
            }
            // If neither exists, mark as disconnected state
            if (this._isConnected !== undefined) {
              this._isConnected = false;
            }
          }

          logger.info(`MCP client successfully disconnected: ${serverData.name || "unknown"}`);
          return true;
        } catch (error) {
          logger.error(`Failed to disconnect MCP client connection: ${error.message}`);
          return false;
        }
      };

      logger.info(`MCP client created successfully: ${serverData.name}`);
      return client;
    } catch (error) {
      lastError = error;
      logger.warn(
        `Failed to create MCP client (attempt ${attempt}/${retryCount}): ${error.message}`
      );

      if (attempt < retryCount) {
        // Wait for a while before retrying
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        // Gradually increase retry delay
        retryDelay = Math.min(retryDelay * 1.5, 10000); // Maximum 10 seconds
      }
    }
  }

  // All retries failed
  logger.error(
    `Failed to create MCP client after ${retryCount} retries: ${lastError.message}`
  );
  throw lastError;
};

/**
 * Execute MCP tool
 * @param {string} serverId Server ID
 * @param {string} toolId Tool ID
 * @param {Object|string} parameters Tool parameters
 * @returns {Promise<Object>} Execution result
 */
const executeTool = async (serverId, toolId, parameters, retryCount = 1) => {
  let client = null;

  try {
    if (!_db) {
      throw new Error("Database not initialized");
    }

    // Get server information
    const server = await _db.getMCPServerById(serverId);
    if (!server) {
      throw new Error(`Cannot find MCP server with ID ${serverId}`);
    }

    // Check if server is active
    if (!server.active) {
      throw new Error(`MCP server '${server.name}' is not active`);
    }

    try {
      // Get or create client
      client = await getOrCreateClient(serverId);

      // Ensure parameters is an object
      const parsedParameters =
        typeof parameters === "string"
          ? JSON.parse(parameters)
          : parameters || {};

      logger.info(
        `Preparing to execute tool ${toolId}, parameters:`,
        JSON.stringify(parsedParameters).substring(0, 200) +
          (JSON.stringify(parsedParameters).length > 200 ? "..." : "")
      );

      // Get tool list to check parameter format
      const toolsList = await client.listTools();
      const toolInfo = toolsList.tools.find((tool) => tool.name === toolId);

      if (!toolInfo) {
        throw new Error(`Tool ${toolId} does not exist`);
      }

      // Execute tool
      const result = await client.callTool({
        name: toolId,
        arguments: parsedParameters,
      });

      logger.info(`Tool ${toolId} executed successfully`);

      // Update last used time
      if (clientPool.has(serverId)) {
        clientPool.get(serverId).lastUsed = Date.now();
      }

      return {
        success: true,
        message: "Tool execution successful",
        result: result,
      };
    } catch (error) {
      // If it's a connection error and there are retry attempts left, try to recreate connection
      if (error.message.includes("Connection") && retryCount > 0) {
        logger.warn(`MCP connection error, attempting to reconnect: ${error.message}`);

        // If client connection exists, try to disconnect
        if (clientPool.has(serverId)) {
          const poolEntry = clientPool.get(serverId);
          if (
            poolEntry.client &&
            typeof poolEntry.client.disconnect === "function"
          ) {
            try {
              await poolEntry.client.disconnect();
            } catch (e) {
              logger.warn(`Failed to disconnect old connection: ${e.message}`);
            }
          }

          // Mark as disconnected state
          poolEntry.isConnected = false;
        }

        // Remove old connection
        clientPool.delete(serverId);

        // Re-execute tool call
        return executeTool(serverId, toolId, parameters, retryCount - 1);
      }

      logger.error(`Failed to execute tool ${toolId}: ${error.message}`);
      return {
        success: false,
        message: `Tool execution failed: ${error.message}`,
        result: null,
      };
    }
  } catch (error) {
    logger.error(`Failed to execute MCP tool: ${error.message}`);
    return {
      success: false,
      message: `Tool execution failed: ${error.message}`,
      result: null,
    };
  }
};

/**
 * Set up client pool periodic cleanup
 */
function setupClientPoolCleanup() {
  const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
  const IDLE_TIMEOUT = 15 * 60 * 1000; // Close after 15 minutes of no use

  setInterval(async () => {
    const now = Date.now();
    const poolEntries = Array.from(clientPool.entries());

    logger.debug(`Starting cleanup of MCP client connection pool, current connections: ${poolEntries.length}`);

    for (const [serverId, value] of poolEntries) {
      if (now - value.lastUsed > IDLE_TIMEOUT) {
        logger.info(`Closing idle MCP client connection: ${serverId}`);

        if (value.client && typeof value.client.disconnect === "function") {
          try {
            await value.client.disconnect();
          } catch (e) {
            logger.warn(`Failed to close MCP client connection: ${e.message}`);
          }
        }

        clientPool.delete(serverId);
      }
    }
  }, CLEANUP_INTERVAL);
}

/**
 * Clean up all client connections
 * @returns {Promise<Object>} Cleanup result
 */
const cleanup = async () => {
  logger.info("Cleaning up all MCP client connections");

  const disconnectPromises = [];

  for (const [serverId, value] of clientPool.entries()) {
    if (value.client && typeof value.client.disconnect === "function") {
      disconnectPromises.push(
        (async () => {
          try {
            logger.info(`Disconnecting MCP client connection: ${serverId}`);
            await value.client.disconnect();
            return true;
          } catch (e) {
            logger.warn(`Failed to disconnect MCP client connection: ${e.message}`);
            return false;
          }
        })()
      );
    }
  }

  // Wait for all disconnect operations to complete
  if (disconnectPromises.length > 0) {
    await Promise.allSettled(disconnectPromises);
  }

  // Clear client pool
  clientPool.clear();

  return { success: true };
};

/**
 * Test MCP server connection
 * @param {Object} serverData Server data
 * @returns {Promise<Object>} Test result
 */
const testMCPConnection = async (serverData) => {
  try {
    // Basic URL validation
    if (
      serverData.type === "sse" &&
      (!serverData.url || !serverData.url.startsWith("http"))
    ) {
      return {
        success: false,
        message: "Invalid URL format",
        tools: [],
      };
    }

    let client = null;
    try {
      // Create MCP client
      client = await createMCPClient(serverData);

      // Get tool list
      const tools = await client.listTools();
      logger.info("Retrieved MCP tool list:", tools);

      // Format tool list, ensure parameter format is correct
      const formattedTools = tools.tools.map((tool) => {
        logger.info(`Processing tool ${tool.name} definition`);
        return {
          id: tool.name,
          name: tool.name,
          description: tool.description || "",
          parameters: tool.arguments || tool.inputSchema || {},
        };
      });

      // If there's a server ID, update the server's tool information
      if (serverData.id && _db) {
        await _db.updateMCPServerTools(serverData.id, formattedTools);
      }

      return {
        success: true,
        message: "Connection successful",
        tools: formattedTools,
      };
    } catch (error) {
      logger.error(`Failed to list tools: ${error.message}`);
      return {
        success: false,
        message: `Failed to list tools: ${error.message}`,
        tools: [],
      };
    } finally {
      // Close client connection
      if (client && client.disconnect) {
        try {
          await client.disconnect();
        } catch (e) {
          logger.error(`Failed to close MCP client connection: ${e.message}`);
        }
      }
    }
  } catch (error) {
    logger.error(`Failed to test MCP connection: ${error.message}`);
    return {
      success: false,
      message: `Connection failed: ${error.message}`,
      tools: [],
    };
  }
};

/**
 * Initialize MCP module
 * @param {Object} db Database instance
 */
const initMCP = (db) => {
  // Prevent duplicate initialization
  if (_db) {
    logger.warn("MCP service already initialized, ignoring duplicate call");
    return;
  }

  _db = db;

  // Start client pool cleanup
  setupClientPoolCleanup();

  // Register cleanup function for process exit
  process.on("exit", () => {
    try {
      // Cannot use async functions during process exit, directly clean up synchronously
      logger.info("Process exiting, synchronously cleaning up MCP connections");
      Array.from(clientPool.values()).forEach((value) => {
        if (value.client && typeof value.client.disconnect === "function") {
          try {
            // Call disconnect but don't wait for result
            value.client.disconnect().catch(() => {});
          } catch (e) {
            // Ignore errors
          }
        }
      });
      clientPool.clear();
    } catch (e) {
      logger.error("Failed to clean up MCP connections on exit:", e);
    }
  });

  logger.info("MCP service initialization completed");
};

module.exports = {
  createMCPClient,
  testMCPConnection,
  executeTool,
  initMCP,
  cleanup,
};
