/**
 * AI service management module
 * Responsible for API interactions with various AI service providers
 */

// Import provider service
import { providerService } from "./providerService.js";
import i18n from "../i18n";

// Import tool-related functionality
import { formatToolsForProvider } from "./llm/tools/toolFormatter.js";
import { handleToolCall } from "./llm/tools/toolHandler.js";

// Import utility functions
import {
  getProviderAdapter,
  safeJsonParse,
  parseMCPToolParams,
} from "./llm/utils/common.js";

/**
 * Get list of enabled providers
 * @returns {Array} List of enabled providers
 */
export const getEnabledProviders = () => {
  return providerService.getEnabledProviders();
};

/**
 * Send message to AI API
 * @param {Array} messages Message array
 * @param {Object} provider Provider configuration
 * @param {Object} model Model configuration
 * @param {Function} onProgress Progress callback function for streaming
 * @param {Function} onComplete Complete callback function
 * @param {Object} options Options including temperature and signal for request cancellation
 * @returns {Promise} Response
 */
const sendMessageToAI = async (
  messages,
  provider,
  model,
  onProgress,
  onComplete,
  options = {}
) => {
  if (!provider || !model) {
    console.error("Missing provider or model:", { provider, model });
    throw new Error(i18n.t("chat.missingProviderOrModel"));
  }

  // Handle options, set default values
  const temperature =
    options.temperature !== undefined ? options.temperature : 0.7;

  // Handle MCP tool options
  const tools = options.mcpTools
    ? formatToolsForProvider(options.mcpTools, provider.id)
    : [];

  // Check if provider is disabled
  const providerFromService = providerService.getProviderById(provider.id);
  if (!providerFromService || providerFromService.enabled === false) {
    console.error("Provider is disabled:", provider.name);
    throw new Error(
      i18n.t("settings.providerDisabled", { name: provider.name })
    );
  }

  try {
    console.log(`Preparing to call ${provider.name} API`, {
      modelId: model.id,
      messagesCount: messages.length,
      messages: messages,
      useStream: !!onProgress,
      temperature,
      hasSignal: !!options.signal,
      hasTools: tools.length > 0,
    });

    // Get adapter
    const adapterPromise = getProviderAdapter(provider.id);
    if (!adapterPromise) {
      console.error("Adapter not found:", provider.id);
      throw new Error(
        i18n.t("settings.unsupportedProvider", { name: provider.name })
      );
    }

    // Custom progress callback to handle tool calls
    const progressHandler = (progressData) => {
      // Call original progress callback
      if (onProgress) {
        onProgress(progressData);
      }
    };

    // Custom complete callback to handle tool calls
    const completeHandler = async (completeData) => {
      // Check if there are tool calls
      if (completeData.toolCalls && completeData.toolCalls.length > 0) {
        // Create a new message queue
        const updatedMessages = [...messages];

        // Get or initialize accumulated tool call results
        const prevToolCallResults = completeData.toolCallResults || [];
        let toolCallResults = [...prevToolCallResults];

        // Add AI response message (including tool calls)
        updatedMessages.push({
          role: "assistant",
          content: completeData.content || "",
          tool_calls: completeData.toolCalls,
        });

        // Notify frontend to start processing tool calls
        if (onProgress) {
          onProgress({
            content: completeData.content || "",
            reasoning_content: completeData.reasoning_content || "",
            toolCalls: completeData.toolCalls,
            toolCallsProcessing: true,
            message: i18n.t("chat.callingTool"),
          });
        }

        // Process each tool call
        for (const toolCall of completeData.toolCalls) {
          if (toolCall.type === "function" && toolCall.function) {
            try {
              // Call tool
              const toolResult = await handleToolCall(
                toolCall,
                options.mcpTools,
                onProgress
              );

              // Record tool call result
              toolCallResults.push({
                id: toolCall.id,
                tool_id: toolCall.function.name,
                tool_name:
                  options.mcpTools?.find((t) => t.id === toolCall.function.name)
                    ?.name || toolCall.function.name,
                parameters:
                  typeof toolCall.function.arguments === "string"
                    ? parseMCPToolParams(toolCall.function.arguments)
                    : toolCall.function.arguments,
                result: toolResult,
                status: toolResult.success ? "success" : "error",
              });

              // Add tool response message
              updatedMessages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                content:
                  typeof toolResult === "string"
                    ? toolResult
                    : JSON.stringify(toolResult, null, 2),
              });
            } catch (error) {
              console.error(`Tool call failed:`, error);

              // Record failed tool call
              toolCallResults.push({
                id: toolCall.id,
                tool_id: toolCall.function.name,
                tool_name:
                  options.mcpTools?.find((t) => t.id === toolCall.function.name)
                    ?.name || toolCall.function.name,
                parameters:
                  typeof toolCall.function.arguments === "string"
                    ? parseMCPToolParams(toolCall.function.arguments)
                    : toolCall.function.arguments,
                result: error.message,
                status: "error",
              });

              // Add tool error response message
              updatedMessages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                content: `Error: ${error.message}`,
              });
            }
          }
        }

        // Get current recursion depth or initialize to 1
        const recursionDepth = options._recursionDepth || 1;

        // Check if maximum recursion depth (50 rounds) is exceeded to prevent infinite loops
        const maxRecursionDepth = 50;
        const hasReachedMaxDepth = recursionDepth >= maxRecursionDepth;

        // Add tool call results to complete data
        completeData.toolCallResults = toolCallResults;

        // Notify frontend that tool calls are complete and ready to continue conversation
        if (onProgress) {
          onProgress({
            content: completeData.content || "",
            reasoning_content: completeData.reasoning_content || "",
            toolCalls: completeData.toolCalls,
            toolCallResults: toolCallResults,
            toolCallsProcessing: false,
            message: hasReachedMaxDepth
              ? i18n.t("chat.mcpTools.maxToolCallsReached")
              : i18n.t("chat.mcpTools.toolCallCompleted"),
          });
        }

        // If maximum call depth is reached, stop recursion
        if (hasReachedMaxDepth) {
          console.log(`Maximum tool calls reached (${maxRecursionDepth}), stopping recursion`);

          // Call original complete callback
          if (onComplete) {
            // Build final result
            const finalResult = {
              ...completeData,
              content:
                completeData.content +
                "\n\n[" +
                i18n.t("chat.mcpTools.maxToolCallsReached") +
                "]",
              toolCallResults: toolCallResults,
            };
            onComplete(finalResult);
          }

          return {
            ...completeData,
            content:
              completeData.content +
              "\n\n[" +
              i18n.t("chat.mcpTools.maxToolCallsReached") +
              "]",
            toolCallResults: toolCallResults,
          };
        }

        // Create a new recursion tracking flag to prevent internal onComplete from being called
        const followupOptions = {
          ...options,
          // Increase recursion depth count
          _recursionDepth: recursionDepth + 1,
          // Add a recursion marker for internal logic judgment
          _isFollowupCall: true,
        };

        // Don't delete mcpTools, keep tool list so AI can continue using other tools

        // Create a wrapped complete callback to handle final result
        const wrappedComplete = (finalData) => {
          // Merge all previous tool call results into final data
          finalData.toolCallResults = toolCallResults.concat(
            finalData.toolCallResults || []
          );

          // Call original onComplete regardless of whether there are more tool calls
          if (onComplete) {
            console.log("Calling final onComplete callback", finalData);
            onComplete(finalData);
          }

          return finalData;
        };

        // Use updated message queue to call AI again
        console.log(`Starting round ${recursionDepth + 1} of tool call recursion`);
        return sendMessageToAI(
          updatedMessages,
          provider,
          model,
          onProgress,
          wrappedComplete,
          followupOptions
        );
      }

      // If no tool calls, directly call original complete callback
      // Ensure final response always triggers onComplete
      if (onComplete) {
        console.log("No tool calls, directly calling onComplete callback", completeData);
        onComplete(completeData);
      }

      return completeData;
    };

    // Get adapter implementation
    const adapter = await adapterPromise;

    // Call adapter, pass temperature parameters and cancellation signal
    return await adapter(
      messages,
      provider,
      model,
      progressHandler,
      completeHandler,
      {
        temperature,
        signal: options.signal,
        tools,
        ...options,
      }
    );
  } catch (error) {
    // If it's AbortError, pass it directly
    if (error.name === "AbortError") {
      console.log(`${provider.name} request cancelled by user`);
      throw error;
    }

    console.error("Failed to call AI API:", error);
    throw error;
  }
};

export { sendMessageToAI, formatToolsForProvider, handleToolCall };
