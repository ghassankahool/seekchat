/**
 * Base OpenAI-compatible adapter
 * Provides unified interface implementation for all OpenAI-compatible providers
 */

/**
 * Base OpenAI-compatible adapter
 * Provides unified interface implementation for all OpenAI-compatible providers
 *
 * @param {Array} messages - Message list
 * @param {Object} provider - Provider configuration
 * @param {Object} model - Model configuration
 * @param {Function} onProgress - Streaming callback function
 * @param {Function} onComplete - Complete callback function
 * @param {Object} options - Option parameters
 * @param {Object} adapterConfig - Adapter-specific configuration
 * @returns {Promise<Object>} Response object
 */
export const baseOpenAICompatibleAdapter = async (
  messages,
  provider,
  model,
  onProgress,
  onComplete,
  options = {},
  adapterConfig = {}
) => {
  // Extract adapter configuration
  const {
    // Endpoint configuration
    endpoint = "/chat/completions",
    // Request body transformer
    requestTransformer = null,
    // Response parser
    responseParser = null,
    // Stream response processor
    streamProcessor = null,
    // Error handler
    errorHandler = null,
  } = adapterConfig;

  // Get API key and base URL
  const apiKey = provider.apiKey;
  const baseUrl = provider.baseUrl || "";

  // Build request headers
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  // Default request body
  let requestBody = {
    model: model.id,
    messages: messages,
    temperature: options.temperature !== undefined ? options.temperature : 0.7,
    stream: !!onProgress, // If there's onProgress callback, enable streaming
  };

  // Handle tools/functions
  if (
    options.tools &&
    Array.isArray(options.tools) &&
    options.tools.length > 0
  ) {
    requestBody.tools = options.tools;
    requestBody.tool_choice = "auto"; // By default let model automatically choose whether to use tools
  }

  // If there's a request transformer, use transformer to modify request body
  if (requestTransformer) {
    requestBody = requestTransformer(requestBody, model, options, provider);
  }

  console.log(`${provider.name} API request parameters:`, {
    model: model.id,
    messagesCount: messages.length,
    temperature: requestBody.temperature,
    hasSignal: !!options.signal,
    hasTools: Boolean(requestBody.tools),
    tools: requestBody.tools,
  });

  try {
    // Build request URL
    const requestUrl = `${baseUrl}${endpoint}`;

    // Send API request
    const response = await fetch(requestUrl, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(requestBody),
      signal: options.signal, // Add signal for request cancellation
    });

    // Handle error response
    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (e) {
        errorData = { error: { message: `HTTP error ${response.status}` } };
      }

      const errorMessage =
        errorData.error?.message ||
        `${provider.name} API error: ${response.status}`;

      // If there's a custom error handler, call it
      if (errorHandler) {
        return errorHandler(errorMessage, errorData, response);
      }

      throw new Error(errorMessage);
    }

    // Handle streaming response
    if (requestBody.stream) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let content = "";
      let reasoning_content = "";
      let currentToolCalls = [];

      // Read streaming response
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk
          .split("\n")
          .filter(
            (line) => line.trim() !== "" && line.trim() !== "data: [DONE]"
          );

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              // Parse data line
              const data = JSON.parse(line.slice(6));

              // Use stream processor or default processing logic
              if (streamProcessor) {
                const result = streamProcessor(
                  data,
                  content,
                  reasoning_content,
                  currentToolCalls
                );
                if (result) {
                  content =
                    result.content !== undefined ? result.content : content;
                  reasoning_content =
                    result.reasoning_content !== undefined
                      ? result.reasoning_content
                      : reasoning_content;
                  currentToolCalls =
                    result.toolCalls !== undefined
                      ? result.toolCalls
                      : currentToolCalls;

                  // If there's content update, call progress callback
                  if (result.hasUpdate) {
                    console.log("onProgress", {
                      content,
                      reasoning_content,
                      toolCalls: currentToolCalls,
                    });
                    console.log("onProgress", {
                      content,
                      reasoning_content,
                      toolCalls: currentToolCalls,
                      toolCallResults: result.toolCallResults,
                    });
                    onProgress({
                      content,
                      reasoning_content,
                      toolCalls: currentToolCalls,
                      toolCallResults: result.toolCallResults,
                    });
                  }
                }
              } else {
                // Default OpenAI format processing
                let hasUpdate = false;

                if (data.choices && data.choices[0].delta) {
                  // Handle content updates
                  if (data.choices[0].delta.content) {
                    content += data.choices[0].delta.content;
                    hasUpdate = true;
                  }

                  // Handle reasoning_content updates
                  if (data.choices[0].delta.reasoning_content) {
                    reasoning_content +=
                      data.choices[0].delta.reasoning_content;
                    hasUpdate = true;
                  }

                  // Handle tool call updates
                  if (data.choices[0].delta.tool_calls) {
                    // Merge tool call information
                    const deltaToolCalls = data.choices[0].delta.tool_calls;

                    for (const deltaToolCall of deltaToolCalls) {
                      const {
                        index,
                        id,
                        type,
                        function: functionData,
                      } = deltaToolCall;
                      // Find existing tool call or create new one
                      let existingToolCall = currentToolCalls.find(
                        (tc) => tc.index === index
                      );

                      if (!existingToolCall) {
                        existingToolCall = {
                          index,
                          id: id || "",
                          type: type || "",
                          function: { name: "", arguments: "" },
                        };
                        currentToolCalls.push(existingToolCall);
                      }

                      // Update ID and type
                      if (id) existingToolCall.id = id;
                      if (type) existingToolCall.type = type;

                      // Update function information
                      if (functionData) {
                        if (functionData.name) {
                          existingToolCall.function.name = functionData.name;
                        }
                        if (functionData.arguments) {
                          // Handle parameters that might contain special tokens
                          let argsStr = functionData.arguments;
                          existingToolCall.function.arguments += argsStr;
                        }
                      }
                    }

                    hasUpdate = true;
                  }
                }

                // If there are updates, call progress callback
                if (hasUpdate) {
                  // console.log("onProgress", {
                  //   content,
                  //   reasoning_content,
                  //   toolCalls: currentToolCalls,
                  // });
                  onProgress({
                    content,
                    reasoning_content,
                    toolCalls: currentToolCalls,
                  });
                }
              }
            } catch (e) {
              console.error("Failed to parse stream data:", e);
            }
          }
        }
      }

      // Stream ended, call completion callback
      if (onComplete) {
        console.log("onComplete", {
          content,
          reasoning_content,
          toolCalls: currentToolCalls,
        });
        onComplete({
          content,
          reasoning_content,
          toolCalls: currentToolCalls,
        });
      }

      // Return final result
      return {
        content,
        reasoning_content,
        model: model.id,
        toolCalls: currentToolCalls,
      };
    } else {
      // Handle non-streaming response
      const data = await response.json();

      // Use response parser or default parsing logic
      let result;
      if (responseParser) {
        result = responseParser(data, model);
      } else {
        // Default OpenAI format parsing
        const content =
          data.choices && data.choices[0].message
            ? data.choices[0].message.content
            : "";

        const reasoning_content =
          data.choices &&
          data.choices[0].message &&
          data.choices[0].message.reasoning_content
            ? data.choices[0].message.reasoning_content
            : "";

        // Extract tool calls
        const toolCalls =
          data.choices &&
          data.choices[0].message &&
          data.choices[0].message.tool_calls
            ? data.choices[0].message.tool_calls
            : [];

        result = {
          content,
          reasoning_content,
          model: data.model || model.id,
          usage: data.usage,
          toolCalls,
        };
      }

      // Call completion callback
      if (onComplete) {
        onComplete(result);
      }

      return result;
    }
  } catch (error) {
    // Handle request cancellation
    if (error.name === "AbortError") {
      console.log(`${provider.name} request cancelled by user`);
      throw error;
    }

    // Re-throw other errors
    throw new Error(`${provider.name} API error: ${error.message}`);
  }
};

export default baseOpenAICompatibleAdapter;
