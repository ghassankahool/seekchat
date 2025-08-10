/**
 * Common utility functions
 */

import i18n from "../../../i18n";

/**
 * Safely parse JSON string
 * @param {string} jsonStr JSON string to parse
 * @param {*} defaultValue Default value to return when parsing fails
 * @returns {*} Parse result or default value
 */
export const safeJsonParse = (jsonStr, defaultValue = {}) => {
  if (!jsonStr || typeof jsonStr !== "string") {
    return defaultValue;
  }

  try {
    // Clean possible special tokens
    let cleanStr = jsonStr;
    if (cleanStr.includes("<｜tool") || cleanStr.includes("<|tool")) {
      const tokenMatch = cleanStr.match(/<[｜|]tool[^>]*>/);
      if (tokenMatch) {
        cleanStr = cleanStr.substring(tokenMatch[0].length);
      }
    }

    // Handle strings like {\"key\": \"value\"}"}
    // 1. Check if there are escaped quotes
    if (cleanStr.includes('\\"') || cleanStr.includes('\\"')) {
      // 2. Check if there are extra quotes and braces at the end
      const extraEndMatch = cleanStr.match(/"\}+$/);
      if (
        extraEndMatch &&
        cleanStr.lastIndexOf('\\"') < cleanStr.length - extraEndMatch[0].length
      ) {
        // Remove extra characters at the end
        cleanStr = cleanStr.substring(
          0,
          cleanStr.length - extraEndMatch[0].length + 1
        );
      }

      // 3. Try to handle double escaping
      if (cleanStr.startsWith('{\\"') || cleanStr.startsWith('{\\"')) {
        try {
          // First remove escaping, then re-parse
          const unescaped = cleanStr.replace(/\\"/g, '"');
          return JSON.parse(unescaped);
        } catch (e) {
          // If parsing fails, continue using original string for parsing
          console.warn("Unescape parsing failed, trying original parsing");
        }
      }
    }

    // Handle special format JSON returned by MCP tools, for example:
    // {\"destination\": \"/path/to/dir\", \"source\": \"/path/to/file\"}"}
    if (cleanStr.match(/\\\"/g) && cleanStr.endsWith('"}')) {
      try {
        // Remove trailing extra quotes and braces
        let fixedStr = cleanStr;
        if (fixedStr.endsWith('"}')) {
          fixedStr = fixedStr.substring(0, fixedStr.length - 1);
        }

        // Handle internal escaped quotes
        fixedStr = fixedStr.replace(/\\"/g, '"');

        // Try to parse the processed string
        const result = JSON.parse(fixedStr);
        console.log("Successfully processed special format JSON:", result);
        return result;
      } catch (e) {
        console.warn("Failed to process special format JSON:", e);
        // If failed, continue trying other methods
      }
    }

    return JSON.parse(cleanStr);
  } catch (e) {
    console.warn("JSON parsing failed:", e, "Original string:", jsonStr);

    // Last attempt: if string ends with {"}, it might have an extra quote
    if (jsonStr.endsWith('"}')) {
      try {
        // Try to remove the last quote
        const fixedStr = jsonStr.substring(0, jsonStr.length - 1);
        return JSON.parse(fixedStr);
      } catch {
        // Still failed, return default value
      }
    }

    return defaultValue;
  }
};

/**
 * Specifically handle parameters returned by MCP tools
 * Used to process strings like {\"key\": \"value\"}"}
 * @param {string} paramStr Parameter string
 * @returns {Object} Parsed object
 */
export const parseMCPToolParams = (paramStr) => {
  console.log("parseMCPToolParams", paramStr);
  if (!paramStr || typeof paramStr !== "string") {
    return {};
  }

  // Handle code block format
  const codeBlockRegex = /```(?:\w*\n)?([\s\S]*?)```/;
  const codeMatch = paramStr.match(codeBlockRegex);
  if (codeMatch) {
    // Extract code block content
    let extractedArgs = codeMatch[1].trim();
    // Clean function call format, like tool_call(name1=value1,name2=value2)
    const functionCallRegex = /^\s*\w+\s*\(([\s\S]*?)\)\s*$/;
    const functionMatch = extractedArgs.match(functionCallRegex);
    if (functionMatch) {
      extractedArgs = functionMatch[1];
    }
    paramStr = extractedArgs;
  }

  // Handle possible extra quotes and spaces at the beginning
  paramStr = paramStr.trim().replace(/^["'\s]+/, "");

  // Special handling for streaming parsing: try to extract the most likely JSON part
  // Find content between the first { and last }
  const firstBrace = paramStr.indexOf("{");
  const lastBrace = paramStr.lastIndexOf("}");

  if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
    try {
      // Extract possible JSON part
      const jsonCandidate = paramStr.substring(firstBrace, lastBrace + 1);

      // Handle escaped quotes
      const unescaped = jsonCandidate.replace(/\\"/g, '"');

      try {
        const result = JSON.parse(unescaped);
        console.log("Successfully extracted JSON from streaming data:", result);
        return result;
      } catch (e) {
        console.warn("Failed to extract JSON from streaming data, trying other methods:", e);
      }
    } catch (e) {
      console.warn("Streaming data processing failed:", e);
    }
  }

  // Handle special format: " " {\"script\": \"...\"}"}"
  if (paramStr.startsWith('" "') || paramStr.startsWith('" {')) {
    try {
      // Remove extra quotes and spaces at the beginning
      let cleaned = paramStr.replace(/^"\s+"/, "");

      // Remove extra quotes and braces at the end
      cleaned = cleaned.replace(/"}"+$/, "}");

      // Handle escaped quotes
      cleaned = cleaned.replace(/\\"/g, '"');

      try {
        return JSON.parse(cleaned);
      } catch (e) {
        console.warn("Special format JSON parsing failed:", e);
      }
    } catch (e) {
      console.warn("Special format processing failed:", e);
    }
  }

  // Handle multi-layer escaped JSON strings
  // For example: " " \" {\\\"script\\\": \\\"setTimeout...\\\"}\"}""
  if (paramStr.includes('\\\\"')) {
    try {
      // Gradually remove escaping, process layer by layer
      let cleaned = paramStr;

      // Remove extra quotes and spaces at the beginning
      cleaned = cleaned.replace(/^["'\s]+/, "");

      // Remove extra quotes and braces at the end
      cleaned = cleaned.replace(/["'}]+$/, "");

      // Fix possible incomplete JSON (missing opening brace)
      if (!cleaned.startsWith("{") && cleaned.includes("{")) {
        cleaned = cleaned.substring(cleaned.indexOf("{"));
      }

      // Handle double escaping \\\" -> \"
      cleaned = cleaned.replace(/\\\\"/g, '\\"');

      // Handle single escaping \" -> "
      cleaned = cleaned.replace(/\\"/g, '"');

      try {
        return JSON.parse(cleaned);
      } catch (e) {
        console.warn("Multi-layer escaped JSON parsing failed, trying other methods", e);
      }
    } catch (e) {
      console.warn("Multi-layer escaping processing failed:", e);
    }
  }

  // Handle single-layer escaped JSON strings
  if (paramStr.includes('\\"')) {
    try {
      // For format like {\"destination\": \"/path/to/dir\", \"source\": \"/path/to/file\"}"}
      if (paramStr.endsWith('"}') || paramStr.endsWith('"}"}')) {
        // Remove extra "} or "}"} at the end
        let cleaned = paramStr;
        while (cleaned.endsWith('"}')) {
          cleaned = cleaned.substring(0, cleaned.length - 1);
        }

        // Replace all \" with "
        cleaned = cleaned.replace(/\\"/g, '"');

        try {
          return JSON.parse(cleaned);
        } catch (e) {
          console.warn("Single-layer escaped JSON parsing failed:", e);
        }
      } else {
        // Handle other forms of single-layer escaping
        let cleaned = paramStr;

        // If string doesn't start with { but contains {, extract from {
        if (!cleaned.startsWith("{") && cleaned.includes("{")) {
          cleaned = cleaned.substring(cleaned.indexOf("{"));
        }

        // If string doesn't end with } but contains }, extract to the last }
        if (!cleaned.endsWith("}") && cleaned.includes("}")) {
          cleaned = cleaned.substring(0, cleaned.lastIndexOf("}") + 1);
        }

        // Replace all \" with "
        cleaned = cleaned.replace(/\\"/g, '"');

        try {
          return JSON.parse(cleaned);
        } catch (e) {
          console.warn("Single-layer escaped JSON parsing failed (general handling):", e);
        }
      }
    } catch (e) {
      console.warn("Single-layer escaping processing failed:", e);
    }
  }

  // Try to handle JSON strings wrapped in quotes
  if (paramStr.startsWith('"') && paramStr.endsWith('"')) {
    try {
      // Remove outer quotes
      const unquoted = paramStr.substring(1, paramStr.length - 1);
      // Handle internal escaping
      const unescaped = unquoted.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
      return JSON.parse(unescaped);
    } catch (e) {
      console.warn("Quote-wrapped JSON parsing failed:", e);
    }
  }

  // If special handling fails, fall back to general method
  return safeJsonParse(paramStr, {});
};

/**
 * Get provider adapter
 * @param {string} providerId Provider ID
 * @returns {Function} Adapter function
 */
export const getProviderAdapter = (providerId) => {
  switch (providerId) {
    case "openai":
      return import("../adapters/openAIAdapter.js").then((m) => m.default);
    case "deepseek":
      return import("../adapters/deepseekAdapter.js").then((m) => m.default);
    case "anthropic":
      return import("../adapters/anthropicAdapter.js").then((m) => m.default);
    case "gemini":
      return import("../adapters/geminiAdapter.js").then((m) => m.default);
    default:
      // For other providers, use general OpenAI compatible adapter
      return import("../adapters/baseAdapter.js").then((m) => m.default);
  }
};
