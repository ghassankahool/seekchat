/**
 * Gemini adapter
 * Handles interaction with Google Gemini API
 */

import baseOpenAICompatibleAdapter from "./baseAdapter.js";

/**
 * Gemini provider adapter
 * @param {Array} messages Message list
 * @param {Object} provider Provider configuration
 * @param {Object} model Model configuration
 * @param {Function} onProgress Progress callback function
 * @param {Function} onComplete Complete callback function
 * @param {Object} options Option parameters
 * @returns {Promise} Response
 */
const geminiAdapter = async (
  messages,
  provider,
  model,
  onProgress,
  onComplete,
  options = {}
) => {
  // Gemini uses different endpoints and request formats
  const adapterConfig = {
    endpoint: `/models/${model.id}:generateContent?key=${provider.apiKey}`,

    // Request body transformer
    requestTransformer: (requestBody, model, options) => {
      const formattedMessages = messages.map((msg) => ({
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: msg.content }],
      }));

      return {
        contents: formattedMessages,
        generationConfig: {
          temperature: requestBody.temperature,
          maxOutputTokens: options.max_tokens || 2000,
        },
        stream: !!onProgress,
      };
    },

    // Stream processor
    streamProcessor: (data, content, reasoning_content) => {
      let hasUpdate = false;

      if (
        data.candidates &&
        data.candidates[0].content &&
        data.candidates[0].content.parts
      ) {
        const newText = data.candidates[0].content.parts[0].text || "";
        if (newText) {
          content += newText;
          hasUpdate = true;
        }
      }

      return {
        content,
        reasoning_content,
        hasUpdate,
      };
    },

    // Response parser
    responseParser: (data, model) => {
      const content =
        data.candidates &&
        data.candidates[0].content &&
        data.candidates[0].content.parts
          ? data.candidates[0].content.parts[0].text || ""
          : "";

      return {
        content,
        reasoning_content: "",
        model: model.id,
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

export default geminiAdapter;
