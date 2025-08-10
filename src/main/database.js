const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const { app } = require("electron");
const logger = require("./logger");

class ChatDatabase {
  constructor() {
    // Database file path, placed in the application data directory
    const dbPath = path.join(app.getPath("userData"), "seekchat.db");

    logger.info("Database file path:", dbPath);

    try {
      // Create database connection
      this.db = new sqlite3.Database(dbPath, (err) => {
        if (err) {
          logger.error("Database connection failed:", err.message);
        } else {
          logger.info("Connected to database");
          this.init();
        }
      });
    } catch (err) {
      logger.error("Failed to create database connection:", err.message);
      throw err;
    }
  }

  // Initialize database tables
  init() {
    // Check if database object exists
    if (!this.db) {
      logger.error("Initialization failed: database object does not exist");
      throw new Error("Database object does not exist");
    }

    // Save this reference for use in callbacks
    const self = this;

    // Enable foreign key constraints
    this.db.run("PRAGMA foreign_keys = ON");

    // Create session table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS chat_session (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        metadata TEXT DEFAULT '',
        updatedAt INTEGER DEFAULT 0,
        createdAt INTEGER DEFAULT 0
      )
    `);

    // Create message table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS chat_message (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sessionId INTEGER NOT NULL,
        role TEXT NOT NULL,
        providerId INTEGER NOT NULL,
        modelId INTEGER NOT NULL,
        content TEXT NOT NULL,
        status TEXT DEFAULT '',
        updatedAt INTEGER DEFAULT 0,
        createdAt INTEGER DEFAULT 0,
        FOREIGN KEY (sessionId) REFERENCES chat_session(id) ON DELETE CASCADE
      )
    `);

    // Create MCP server table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS mcp_servers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        type TEXT NOT NULL,
        active BOOLEAN DEFAULT 0,
        tools TEXT,
        description TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    logger.info("Database table initialization completed");

    // Check if there are any sessions, if not create a default session
    this.db.get("SELECT COUNT(*) as count FROM chat_session", (err, row) => {
      if (err) {
        logger.error("Failed to check session count:", err);
        return;
      }

      if (row.count === 0) {
        logger.info("Creating default session");
        self.createSession("New Chat");
      }
    });
  }

  // Get all sessions
  getAllSessions() {
    return new Promise((resolve, reject) => {
      this.db.all(
        "SELECT * FROM chat_session ORDER BY updatedAt DESC",
        (err, rows) => {
          if (err) {
            logger.error("Failed to get session list:", err);
            reject(err);
          } else {
            resolve(rows);
          }
        }
      );
    });
  }

  // Create new session
  createSession(name) {
    return new Promise((resolve, reject) => {
      const now = Date.now();

      this.db.run(
        "INSERT INTO chat_session (name, updatedAt, createdAt) VALUES (?, ?, ?)",
        [name, now, now],
        function (err) {
          if (err) {
            logger.error("Failed to create session:", err);
            reject(err);
          } else {
            resolve({
              id: this.lastID,
              name,
              updatedAt: now,
              createdAt: now,
            });
          }
        }
      );
    });
  }

  // Get all messages for a session
  getMessages(sessionId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        "SELECT * FROM chat_message WHERE sessionId = ? ORDER BY createdAt ASC",
        [sessionId],
        (err, rows) => {
          if (err) {
            logger.error("Failed to get session messages:", err);
            reject(err);
          } else {
            resolve(rows);
          }
        }
      );
    });
  }

  // Delete all messages for a session
  deleteMessages(sessionId) {
    return new Promise((resolve, reject) => {
      this.db.run(
        "DELETE FROM chat_message WHERE sessionId = ?",
        [sessionId],
        function (err) {
          if (err) {
            logger.error("Failed to delete session messages:", err);
            reject(err);
          } else {
            resolve({ success: true, sessionId, deleted: this.changes });
          }
        }
      );
    });
  }

  // Add new message
  addMessage(message) {
    return new Promise((resolve, reject) => {
      if (!message || !message.sessionId) {
        reject(new Error("Message must contain sessionId"));
        return;
      }

      const {
        sessionId,
        role,
        providerId,
        modelId,
        content,
        status = "",
      } = message;
      const now = Date.now();

      logger.info("Database: Preparing to add message", {
        sessionId,
        role,
        content:
          typeof content === "string"
            ? content.substring(0, 30) + "..."
            : "[object]",
      });

      // Save this reference for use in callbacks
      const self = this;

      this.db.run(
        "INSERT INTO chat_message (sessionId, role, providerId, modelId, content, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        [sessionId, role, providerId, modelId, content, status, now, now],
        function (err) {
          if (err) {
            logger.error("Failed to add message:", err);
            reject(err);
          } else {
            logger.info(`Database: Message added successfully, ID: ${this.lastID}`);

            // Update session's updated time
            self.db.run(
              "UPDATE chat_session SET updatedAt = ? WHERE id = ?",
              [now, sessionId],
              (updateErr) => {
                if (updateErr) {
                  logger.warn("Failed to update session time:", updateErr);
                }
              }
            );

            resolve({
              id: this.lastID,
              sessionId,
              role,
              providerId,
              modelId,
              content,
              status,
              createdAt: now,
              updatedAt: now,
            });
          }
        }
      );
    });
  }

  // Update message status
  updateMessageStatus(id, status) {
    return new Promise((resolve, reject) => {
      const now = Date.now();

      this.db.run(
        "UPDATE chat_message SET status = ?, updatedAt = ? WHERE id = ?",
        [status, now, id],
        function (err) {
          if (err) {
            logger.error("Failed to update message status:", err);
            reject(err);
          } else {
            if (this.changes === 0) {
              logger.warn(`Database: Message not found to update status ID: ${id}`);
            } else {
              logger.info(
                `Database: Message status updated successfully, ID: ${id}, Status: ${status}`
              );
            }

            resolve({ id, status, updatedAt: now, changed: this.changes > 0 });
          }
        }
      );
    });
  }

  // Update message content
  updateMessageContent(id, content) {
    return new Promise((resolve, reject) => {
      const now = Date.now();

      this.db.run(
        "UPDATE chat_message SET content = ?, updatedAt = ? WHERE id = ?",
        [content, now, id],
        function (err) {
          if (err) {
            logger.error("Failed to update message content:", err);
            reject(err);
          } else {
            if (this.changes === 0) {
              logger.warn(`Database: Message not found to update content ID: ${id}`);
            } else {
              logger.info(`Database: Message content updated successfully, ID: ${id}`);
            }

            resolve({ id, content, updatedAt: now, changed: this.changes > 0 });
          }
        }
      );
    });
  }

  // Delete session
  deleteSession(id) {
    return new Promise((resolve, reject) => {
      // Save this reference for use in callbacks
      const self = this;

      // First delete all messages for the session
      this.db.run(
        "DELETE FROM chat_message WHERE sessionId = ?",
        [id],
        (err) => {
          if (err) {
            logger.error("Failed to delete session messages:", err);
            reject(err);
            return;
          }

          // Then delete the session
          self.db.run(
            "DELETE FROM chat_session WHERE id = ?",
            [id],
            function (err) {
              if (err) {
                logger.error("Failed to delete session:", err);
                reject(err);
              } else {
                resolve({ success: true, id, deleted: this.changes > 0 });
              }
            }
          );
        }
      );
    });
  }

  // Create or update message
  createOrUpdateMessage(message) {
    return new Promise((resolve, reject) => {
      if (!message || !message.sessionId) {
        reject(new Error("Message must contain sessionId"));
        return;
      }

      const {
        id,
        sessionId,
        role,
        providerId,
        modelId,
        content,
        status = "",
      } = message;
      const now = Date.now();

      // Save this reference for use in callbacks
      const self = this;

      // If ID exists, first check if message exists
      if (id) {
        this.db.get(
          "SELECT id FROM chat_message WHERE id = ?",
          [id],
          (err, row) => {
            if (err) {
              logger.error("Failed to query message:", err);
              reject(err);
              return;
            }

            if (row) {
              // Message exists, update it
              self.db.run(
                "UPDATE chat_message SET content = ?, status = ?, updatedAt = ? WHERE id = ?",
                [content, status, now, id],
                function (err) {
                  if (err) {
                    logger.error("Failed to update message:", err);
                    reject(err);
                  } else {
                    logger.info(`Message updated successfully, ID: ${id}`);

                    // Update session's updated time
                    self.db.run(
                      "UPDATE chat_session SET updatedAt = ? WHERE id = ?",
                      [now, sessionId]
                    );

                    resolve({
                      id,
                      sessionId,
                      role,
                      providerId,
                      modelId,
                      content,
                      status,
                      updatedAt: now,
                    });
                  }
                }
              );
            } else {
              // Message does not exist, create new message
              self.db.run(
                "INSERT INTO chat_message (sessionId, role, providerId, modelId, content, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                [
                  sessionId,
                  role,
                  providerId,
                  modelId,
                  content,
                  status,
                  now,
                  now,
                ],
                function (err) {
                  if (err) {
                    logger.error("Failed to add message:", err);
                    reject(err);
                  } else {
                    logger.info(`Message created successfully, ID: ${this.lastID}`);

                    // Update session's updated time
                    self.db.run(
                      "UPDATE chat_session SET updatedAt = ? WHERE id = ?",
                      [now, sessionId]
                    );

                    resolve({
                      id: this.lastID,
                      sessionId,
                      role,
                      providerId,
                      modelId,
                      content,
                      status,
                      createdAt: now,
                      updatedAt: now,
                    });
                  }
                }
              );
            }
          }
        );
      } else {
        // No ID, directly create new message
        this.db.run(
          "INSERT INTO chat_message (sessionId, role, providerId, modelId, content, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          [sessionId, role, providerId, modelId, content, status, now, now],
          function (err) {
            if (err) {
              logger.error("Failed to add message:", err);
              reject(err);
            } else {
              logger.info(`Message created successfully, ID: ${this.lastID}`);

              // Update session's updated time
              self.db.run(
                "UPDATE chat_session SET updatedAt = ? WHERE id = ?",
                [now, sessionId]
              );

              resolve({
                id: this.lastID,
                sessionId,
                role,
                providerId,
                modelId,
                content,
                status,
                createdAt: now,
                updatedAt: now,
              });
            }
          }
        );
      }
    });
  }

  // Update session metadata
  updateSessionMetadata(sessionId, metadata) {
    return new Promise((resolve, reject) => {
      const now = Date.now();

      // Convert metadata to string
      const metadataStr =
        typeof metadata === "string" ? metadata : JSON.stringify(metadata);

      this.db.run(
        "UPDATE chat_session SET metadata = ?, updatedAt = ? WHERE id = ?",
        [metadataStr, now, sessionId],
        function (err) {
          if (err) {
            logger.error("Failed to update session metadata:", err);
            reject(err);
          } else {
            if (this.changes === 0) {
              logger.warn(`Database: Session not found to update metadata ID: ${sessionId}`);
              reject(new Error(`Session not found ID: ${sessionId}`));
            } else {
              logger.info(`Database: Session metadata updated successfully, ID: ${sessionId}`);
              resolve({
                id: sessionId,
                metadata: metadataStr,
                updatedAt: now,
                changed: this.changes > 0,
              });
            }
          }
        }
      );
    });
  }

  // Update session name
  updateSessionName(sessionId, name) {
    return new Promise((resolve, reject) => {
      const now = Date.now();

      this.db.run(
        "UPDATE chat_session SET name = ?, updatedAt = ? WHERE id = ?",
        [name, now, sessionId],
        function (err) {
          if (err) {
            logger.error("Failed to update session name:", err);
            reject(err);
          } else {
            if (this.changes === 0) {
              logger.warn(`Database: Session not found to update name ID: ${sessionId}`);
              reject(new Error(`Session not found ID: ${sessionId}`));
            } else {
              logger.info(`Database: Session name updated successfully, ID: ${sessionId}`);
              resolve({
                id: sessionId,
                name,
                updatedAt: now,
                changed: this.changes > 0,
              });
            }
          }
        }
      );
    });
  }

  // Close database connection
  close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            logger.error("Failed to close database connection:", err);
            reject(err);
          } else {
            logger.info("Database connection closed");
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  // Update all pending messages to error status
  updateAllPendingMessagesToError() {
    return new Promise((resolve, reject) => {
      const now = Date.now();
      const errorContent = JSON.stringify([
        { type: "content", text: "Request interrupted due to page refresh", status: "error" },
      ]);

      this.db.all(
        "SELECT id, content FROM chat_message WHERE status = ?",
        ["pending"],
        (err, rows) => {
          if (err) {
            logger.error("Failed to query pending messages:", err);
            reject(err);
            return;
          }

          logger.info(
            `Found ${rows.length} messages in pending status, updating them to error status`
          );

          if (rows.length === 0) {
            resolve({ updatedCount: 0 });
            return;
          }

          const self = this;
          let updatedCount = 0;

          // Use transaction for batch update
          this.db.run("BEGIN TRANSACTION", function (err) {
            if (err) {
              logger.error("Failed to begin transaction:", err);
              reject(err);
              return;
            }

            // Update status and content for each message
            rows.forEach((row) => {
              let content = row.content;

              // Try to handle JSON format content
              try {
                const parsedContent = JSON.parse(content);
                // If it's simple string content, convert to error format
                if (
                  typeof parsedContent === "string" ||
                  !Array.isArray(parsedContent)
                ) {
                  content = errorContent;
                }
              } catch (e) {
                // If content is not in JSON format, use error content
                content = errorContent;
              }

              self.db.run(
                "UPDATE chat_message SET status = ?, content = ?, updatedAt = ? WHERE id = ?",
                ["error", content, now, row.id],
                function (updateErr) {
                  if (updateErr) {
                    logger.error(`Failed to update message ${row.id}:`, updateErr);
                    self.db.run("ROLLBACK");
                    reject(updateErr);
                    return;
                  }

                  updatedCount += this.changes;

                  // If all messages have been updated, commit transaction
                  if (updatedCount === rows.length) {
                    self.db.run("COMMIT", (commitErr) => {
                      if (commitErr) {
                        logger.error("Failed to commit transaction:", commitErr);
                        reject(commitErr);
                        return;
                      }

                      logger.info(
                        `Successfully updated ${updatedCount} pending messages to error status`
                      );
                      resolve({ updatedCount });
                    });
                  }
                }
              );
            });
          });
        }
      );
    });
  }

  // MCP related methods

  // Get all MCP servers
  getAllMCPServers() {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM mcp_servers ORDER BY created_at DESC`,
        (err, servers) => {
          if (err) {
            logger.error("Failed to get MCP servers:", err);
            reject(err);
            return;
          }

          resolve(
            servers.map((server) => ({
              ...server,
              tools: server.tools ? JSON.parse(server.tools) : [],
            }))
          );
        }
      );
    });
  }

  // Get all active MCP servers
  getActiveMCPServers() {
    return new Promise((resolve, reject) => {
      this.db.all(
        `SELECT * FROM mcp_servers WHERE active = 1 ORDER BY created_at DESC`,
        (err, servers) => {
          if (err) {
            logger.error("Failed to get active MCP servers:", err);
            reject(err);
            return;
          }

          resolve(
            servers.map((server) => ({
              ...server,
              tools: server.tools ? JSON.parse(server.tools) : [],
            }))
          );
        }
      );
    });
  }

  // Get MCP server by ID
  getMCPServerById(id) {
    return new Promise((resolve, reject) => {
      this.db.get(
        `SELECT * FROM mcp_servers WHERE id = ?`,
        [id],
        (err, server) => {
          if (err) {
            logger.error("Failed to get MCP server:", err);
            reject(err);
            return;
          }

          if (server) {
            resolve({
              ...server,
              tools: server.tools ? JSON.parse(server.tools) : [],
            });
          } else {
            resolve(null);
          }
        }
      );
    });
  }

  // Add MCP server
  addMCPServer(serverData) {
    return new Promise((resolve, reject) => {
      const timestamp = Date.now();

      this.db.run(
        `INSERT INTO mcp_servers (name, url, type, active, tools, created_at, updated_at)
         VALUES ( ?, ?, ?, ?, ?, ?, ?)`,
        [
          serverData.name,
          serverData.url,
          serverData.type,
          serverData.active || 0,
          JSON.stringify(serverData.tools || []),
          timestamp,
          timestamp,
        ],
        (err) => {
          if (err) {
            logger.error("Failed to add MCP server:", err);
            reject(err);
            return;
          }
          resolve(true);
        }
      );
    });
  }

  // Update MCP server information
  updateMCPServer(id, updates) {
    return new Promise((resolve, reject) => {
      const timestamp = Date.now();
      const updateFields = [];
      const updateValues = [];

      // Handle tools field, convert to JSON if exists
      if (updates.tools !== undefined) {
        updates.tools = JSON.stringify(updates.tools);
      }

      // Build update fields
      for (const [key, value] of Object.entries(updates)) {
        if (key === "id") continue; // Don't allow updating ID

        // Convert camelCase to snake_case
        const dbField = key.replace(/([A-Z])/g, "_$1").toLowerCase();
        updateFields.push(`${dbField} = ?`);
        updateValues.push(value);
      }

      updateFields.push("updated_at = ?");
      updateValues.push(timestamp);

      // Add id to update parameters
      updateValues.push(id);

      const sql = `UPDATE mcp_servers SET ${updateFields.join(
        ", "
      )} WHERE id = ?`;

      this.db.run(sql, updateValues, (err) => {
        if (err) {
          logger.error("Failed to update MCP server:", err);
          reject(err);
          return;
        }

        this.getMCPServerById(id).then(resolve).catch(reject);
      });
    });
  }

  // Delete MCP server
  deleteMCPServer(id) {
    return new Promise((resolve, reject) => {
      this.db.run(`DELETE FROM mcp_servers WHERE id = ?`, [id], (err) => {
        if (err) {
          logger.error("Failed to delete MCP server:", err);
          reject(err);
          return;
        }

        resolve(true);
      });
    });
  }

  // Set MCP server active status
  setMCPServerActive(id, active) {
    return new Promise((resolve, reject) => {
      this.db.run(
        `UPDATE mcp_servers SET active = ?, updated_at = ? WHERE id = ?`,
        [active ? 1 : 0, Date.now(), id],
        (err) => {
          if (err) {
            logger.error("Failed to set MCP server active status:", err);
            reject(err);
            return;
          }

          this.getMCPServerById(id).then(resolve).catch(reject);
        }
      );
    });
  }

  // Update MCP server tools
  updateMCPServerTools(id, tools) {
    return new Promise((resolve, reject) => {
      const timestamp = Date.now();
      this.db.run(
        `UPDATE mcp_servers SET tools = ?, updated_at = ? WHERE id = ?`,
        [JSON.stringify(tools), timestamp, id],
        (err) => {
          if (err) {
            logger.error("Failed to update MCP server tools:", err);
            reject(err);
            return;
          }

          this.getMCPServerById(id).then(resolve).catch(reject);
        }
      );
    });
  }
}

module.exports = ChatDatabase;
