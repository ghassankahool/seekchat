// Use secure IPC calls exposed on window.electronAPI

/**
 * MCP service renderer process interface
 */
class MCPService {
  /**
   * Get all MCP servers
   * @returns {Promise<Array>} MCP server list
   */
  async getAllServers() {
    try {
      // Call mcp-ipc handling directly
      return window.electronAPI.invokeMCP("get-all-mcp-servers");
    } catch (error) {
      console.error("Failed to get MCP server list:", error);
      return [];
    }
  }

  /**
   * Get all active MCP servers
   * @returns {Promise<Array>} Active MCP server list
   */
  async getActiveServers() {
    try {
      return window.electronAPI.invokeMCP("get-active-mcp-servers");
    } catch (error) {
      console.error("Failed to get active MCP server list:", error);
      return [];
    }
  }

  /**
   * Add MCP server
   * @param {Object} serverData Server data
   * @returns {Promise<Object>} Newly added server
   */
  async addServer(serverData) {
    return window.electronAPI.invokeMCP("add-mcp-server", serverData);
  }

  /**
   * Update MCP server
   * @param {string} id Server ID
   * @param {Object} updates Update data
   * @returns {Promise<Object>} Updated server
   */
  async updateServer(id, updates) {
    return window.electronAPI.invokeMCP("update-mcp-server", id, updates);
  }

  /**
   * Delete MCP server
   * @param {string} id Server ID
   * @returns {Promise<boolean>} Whether successful
   */
  async deleteServer(id) {
    return window.electronAPI.invokeMCP("delete-mcp-server", id);
  }

  /**
   * Set MCP server active status
   * @param {string} id Server ID
   * @param {boolean} active Active status
   * @returns {Promise<Object>} Updated server
   */
  async setServerActive(id, active) {
    return window.electronAPI.invokeMCP("set-mcp-server-active", id, active);
  }

  /**
   * Test MCP server connection
   * @param {Object} serverData Server data
   * @returns {Promise<Object>} Test result
   */
  async testConnection(serverData) {
    return window.electronAPI.invokeMCP("test-mcp-connection", serverData);
  }

  /**
   * Execute MCP tool
   * @param {string} serverId Server ID
   * @param {string} toolId Tool ID
   * @param {Object} parameters Parameters
   * @returns {Promise<Object>} Execution result
   */
  async executeTool(serverId, toolId, parameters) {
    return window.electronAPI.invokeMCP(
      "execute-mcp-tool",
      serverId,
      toolId,
      parameters
    );
  }

  /**
   * Get all tools from active servers
   * @returns {Promise<Array>} Tool list with server information
   */
  async getAllActiveTools() {
    try {
      const servers = await this.getActiveServers();
      const tools = [];

      // Collect tools from all active servers
      for (const server of servers) {
        if (server.tools && server.tools.length > 0) {
          server.tools.forEach((tool) => {
            tools.push({
              ...tool,
              serverId: server.id,
              serverName: server.name,
              serverType: server.type,
            });
          });
        }
      }

      return tools;
    } catch (error) {
      console.error("Failed to get all active tools:", error);
      return [];
    }
  }

  /**
   * Call MCP tool
   * @param {string} serverId Server ID
   * @param {string} toolId Tool ID
   * @param {Object} parameters Execution parameters
   * @returns {Promise<Object>} Execution result
   */
  async callTool(serverId, toolId, parameters) {
    return window.electronAPI.invokeMCP(
      "execute-mcp-tool",
      serverId,
      toolId,
      parameters
    );
  }
}

export default new MCPService();
