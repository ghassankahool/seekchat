/**
 * DeepSeek adapter
 * Handles interaction with DeepSeek API
 */

import baseOpenAICompatibleAdapter from "./baseAdapter.js";

/**
 * DeepSeek provider adapter
 * @param {Array} messages Message list
 * @param {Object} provider Provider configuration
 * @param {Object} model Model configuration
 * @param {Function} onProgress Progress callback function
 * @param {Function} onComplete Complete callback function
 * @param {Object} options Option parameters
 * @returns {Promise} Response
 */
const deepseekAdapter = async (
  messages,
  provider,
  model,
  onProgress,
  onComplete,
  options = {}
) => {
  return baseOpenAICompatibleAdapter(
    messages,
    provider,
    model,
    onProgress,
    onComplete,
    options
  );
};

export default deepseekAdapter;
