/**
 * Tool formatting module
 * Responsible for converting MCP tools to formats required by different AI providers
 */

/**
 * Convert MCP tools to OpenAI functions format
 * @param {Array} mcpTools MCP tool list
 * @returns {Array} Tool list in OpenAI functions format
 */
export const formatMCPToolsForOpenAI = (mcpTools) => {
  if (!mcpTools || !Array.isArray(mcpTools) || mcpTools.length === 0) {
    return [];
  }

  return mcpTools.map((tool) => {
    // Get parameter definition
    const parameters = tool.parameters || {};

    return {
      type: "function",
      function: {
        name: tool.id,
        description: tool.description || `${tool.name} from ${tool.serverName}`,
        parameters: {
          type: "object",
          properties: parameters.properties || {},
          required: parameters.required || [],
        },
      },
    };
  });
};

/**
 * Convert MCP tools to Anthropic tools format
 * @param {Array} mcpTools MCP tool list
 * @returns {Array} Tool list in Anthropic tools format
 */
export const formatMCPToolsForAnthropic = (mcpTools) => {
  if (!mcpTools || !Array.isArray(mcpTools) || mcpTools.length === 0) {
    return [];
  }

  return mcpTools.map((tool) => {
    // Get parameter definition
    const parameters = tool.parameters || {};

    return {
      name: tool.id,
      description: tool.description || `${tool.name} from ${tool.serverName}`,
      input_schema: {
        type: "object",
        properties: parameters.properties || {},
        required: parameters.required || [],
      },
    };
  });
};

/**
 * Format MCP tools based on provider
 * @param {Array} mcpTools MCP tool list
 * @param {string} providerId Provider ID
 * @returns {Array} Formatted tool list
 */
export const formatToolsForProvider = (mcpTools, providerId) => {
  if (!mcpTools || !Array.isArray(mcpTools) || mcpTools.length === 0) {
    return [];
  }

  switch (providerId) {
    case "openai":
      return formatMCPToolsForOpenAI(mcpTools);
    case "anthropic":
      return formatMCPToolsForAnthropic(mcpTools);
    default:
      // Default to OpenAI format
      return formatMCPToolsForOpenAI(mcpTools);
  }
};
