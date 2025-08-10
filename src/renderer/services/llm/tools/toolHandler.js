/**
 * Tool call handling module
 * Responsible for handling AI tool calls and response processing
 */

import { safeJsonParse, parseMCPToolParams } from "../utils/common.js";
import i18n from "../../../i18n/index.js";

/**
 * Handle tool call
 * @param {Object} toolCall Tool call object
 * @param {Array} mcpTools MCP tool list
 * @param {Function} onProgress Progress callback function
 * @returns {Promise<Object>} Tool call result
 */
export const handleToolCall = async (toolCall, mcpTools, onProgress) => {
  try {
    // Find the corresponding tool from MCP tool list
    const tool = mcpTools.find((t) => t.id === toolCall.function.name);
    if (!tool) {
      throw new Error(
        i18n.t("error.toolNotFound", { id: toolCall.function.name })
      );
    }

    // Parse parameters
    let args;
    try {
      console.log("toolCall", toolCall);
      // Check and clean tool call parameter string
      let argsStr = toolCall.function.arguments || "{}";

      // Use enhanced MCP tool parameter parsing function
      args = parseMCPToolParams(argsStr);
      console.log("Tool parameter parsing successful:", args);
    } catch (e) {
      console.error("Failed to parse tool parameters:", e);
      return {
        success: false,
        message: i18n.t("error.toolParameterParseFailed"),
      };
    }

    // Notify that tool is being called
    if (onProgress) {
      onProgress({
        toolCallStatus: {
          id: toolCall.id,
          name: tool.name,
          status: "running",
          message: i18n.t("status.callingTool", { name: tool.name }),
        },
      });
    }

    // Import MCP service
    const mcpService = (await import("../../mcpService.js")).default;

    // Call MCP tool
    console.log(`Calling MCP tool: ${tool.id}, parameters:`, args);
    const result = await mcpService.callTool(tool.serverId, tool.id, args);

    if (!result.success) {
      throw new Error(
        i18n.t("error.toolExecutionFailed", { message: result.message })
      );
    }

    // Notify tool call success
    if (onProgress) {
      onProgress({
        toolCallStatus: {
          id: toolCall.id,
          name: tool.name,
          status: "success",
          message: i18n.t("status.toolCallSuccess", { name: tool.name }),
        },
      });
    }

    return {
      success: true,
      toolName: tool.name,
      result: result.result,
    };
  } catch (error) {
    console.error("Tool call failed:", error);

    // Notify tool call failure
    if (onProgress) {
      onProgress({
        toolCallStatus: {
          id: toolCall?.id,
          name:
            mcpTools.find((t) => t.id === toolCall?.function?.name)?.name ||
            toolCall?.function?.name ||
            i18n.t("common.unknownTool"),
          status: "error",
          message: i18n.t("error.toolExecutionFailed", {
            message: error.message,
          }),
        },
      });
    }

    return {
      success: false,
      error: error.message,
    };
  }
};
