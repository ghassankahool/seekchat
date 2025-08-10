/**
 * Anthropic adapter
 * Handles interaction with Anthropic API
 */

import baseOpenAICompatibleAdapter from "./baseAdapter.js";
import i18n from "../../../i18n";

/**
 * Anthropic provider adapter
 * @param {Array} messages Message list
 * @param {Object} provider Provider configuration
 * @param {Object} model Model configuration
 * @param {Function} onProgress Progress callback function
 * @param {Function} onComplete Complete callback function
 * @param {Object} options Option parameters
 * @returns {Promise} Response
 */
const anthropicAdapter = async (
  messages,
  provider,
  model,
  onProgress,
  onComplete,
  options = {}
) => {
  // Anthropic uses different endpoint and request format
  const adapterConfig = {
    endpoint: "/v1/messages",

    // Request body transformer
    requestTransformer: (requestBody, model, options) => {
      // Convert format to Anthropic compatible
      const formattedMessages = messages.map((msg) => ({
        role: msg.role === "user" ? "user" : "assistant",
        content: msg.content,
      }));

      const result = {
        model: model.id,
        messages: formattedMessages,
        temperature: requestBody.temperature,
        max_tokens: options.max_tokens || 2000,
        stream: !!onProgress,
      };

      // Add tool support
      if (
        options.tools &&
        Array.isArray(options.tools) &&
        options.tools.length > 0
      ) {
        result.tools = options.tools;
      }

      return result;
    },

    // Response parser
    responseParser: (data, model) => {
      const content =
        data.content && data.content.length > 0
          ? data.content.map((item) => item.text).join("")
          : "";

      return {
        content,
        reasoning_content: "",
        model: model.id,
        toolCalls: data.tool_calls || [],
      };
    },

    // Stream processor
    streamProcessor: (data, content, reasoning_content, toolCalls) => {
      let hasUpdate = false;

      if (
        data.type === "content_block_delta" &&
        data.delta &&
        data.delta.text
      ) {
        content += data.delta.text;
        hasUpdate = true;
      } else if (data.type === "message_stop") {
        // Message end
      } else if (data.type === "tool_call_delta") {
        // Handle tool call updates
        const deltaToolCall = data.delta;

        // Find existing tool call or create new one
        let existingToolCall = toolCalls.find(
          (tc) => tc.id === data.tool_call_id
        );

        if (!existingToolCall) {
          existingToolCall = {
            id: data.tool_call_id,
            type: "function",
            function: { name: "", arguments: "" },
          };
          toolCalls.push(existingToolCall);
        }

        // Update function information
        if (deltaToolCall.name) {
          existingToolCall.function.name = deltaToolCall.name;
        }

        // Handle different forms of input parameters
        if (deltaToolCall.input) {
          // If it's an object, serialize directly
          if (typeof deltaToolCall.input === "object") {
            try {
              existingToolCall.function.arguments = JSON.stringify(
                deltaToolCall.input
              );
            } catch (e) {
              console.warn("Failed to serialize Anthropic tool input:", e);
              existingToolCall.function.arguments = "{}";
            }
          }
          // If it's a string, it might already be JSON or need to be appended to existing parameters
          else if (typeof deltaToolCall.input === "string") {
            // Clean possible special tokens
            let inputStr = deltaToolCall.input;
            if (inputStr.includes("<｜tool") || inputStr.includes("<|tool")) {
              console.warn("Anthropic tool input contains special tokens:", inputStr);
              const tokenMatch = inputStr.match(/<[｜|]tool[^>]*>/);
              if (tokenMatch) {
                inputStr = inputStr.substring(tokenMatch[0].length);
              }
            }

            // Append to existing parameters
            existingToolCall.function.arguments += inputStr;
          }
        }

        hasUpdate = true;
      }

      return {
        content,
        reasoning_content,
        toolCalls,
        hasUpdate,
      };
    },
  };

  return baseOpenAICompatibleAdapter(
    messages,
    provider,
    model,
    onProgress,
    onComplete,
    options,
    adapterConfig
  );
};

export default anthropicAdapter;
