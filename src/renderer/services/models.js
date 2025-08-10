/**
 * AI model configuration file
 * Contains model information for various AI service providers
 */

// Add i18next import
import { v4 as uuidv4 } from "uuid";
import i18n from "../i18n";
import { getProvidersConfig } from "../hooks/useUserConfig";

// Model classification regex
const VISION_REGEX =
  /\b(llava|moondream|minicpm|gemini-1\.5|gemini-2\.0|gemini-exp|claude-3|vision|glm-4v|qwen-vl|qwen2-vl|qwen2.5-vl|internvl2|grok-vision-beta|pixtral|gpt-4(?:-[\w-]+)|gpt-4o(?:-[\w-]+)?|chatgpt-4o(?:-[\w-]+)?|o1(?:-[\w-]+)?|deepseek-vl(?:[\w-]+)?|kimi-latest)\b/i;

const TEXT_TO_IMAGE_REGEX =
  /flux|diffusion|stabilityai|sd-|dall|cogview|janus/i;
const REASONING_REGEX =
  /^(o\d+(?:-[\w-]+)?|.*\b(?:reasoner|thinking)\b.*|.*-[rR]\d+.*)$/i;
const EMBEDDING_REGEX =
  /(?:^text-|embed|bge-|e5-|LLM2Vec|retrieval|uae-|gte-|jina-clip|jina-embeddings)/i;

// System model definitions
export const SYSTEM_MODELS = {
  silicon: [
    {
      id: "deepseek-ai/DeepSeek-R1",
      name: "deepseek-ai/DeepSeek-R1",
      provider: "silicon",
      group: "deepseek-ai",
    },
    {
      id: "deepseek-ai/DeepSeek-V3",
      name: "deepseek-ai/DeepSeek-V3",
      provider: "silicon",
      group: "deepseek-ai",
    },
    {
      id: "Qwen/Qwen2.5-7B-Instruct",
      provider: "silicon",
      name: "Qwen2.5-7B-Instruct",
      group: "Qwen",
    },
    {
      id: "meta-llama/Llama-3.3-70B-Instruct",
      name: "meta-llama/Llama-3.3-70B-Instruct",
      provider: "silicon",
      group: "meta-llama",
    },
    {
      id: "BAAI/bge-m3",
      name: "BAAI/bge-m3",
      provider: "silicon",
      group: "BAAI",
    },
  ],
  openai: [
    {
      id: "gpt-4.5-preview",
      provider: "openai",
      name: " gpt-4.5-preview",
      group: "gpt-4.5",
    },
    { id: "gpt-4o", provider: "openai", name: " GPT-4o", group: "GPT 4o" },
    {
      id: "gpt-4o-mini",
      provider: "openai",
      name: " GPT-4o-mini",
      group: "GPT 4o",
    },
    { id: "o1-mini", provider: "openai", name: " o1-mini", group: "o1" },
    { id: "o1-preview", provider: "openai", name: " o1-preview", group: "o1" },
  ],
  "azure-openai": [
    {
      id: "gpt-4o",
      provider: "azure-openai",
      name: " GPT-4o",
      group: "GPT 4o",
    },
    {
      id: "gpt-4o-mini",
      provider: "azure-openai",
      name: " GPT-4o-mini",
      group: "GPT 4o",
    },
  ],
  deepseek: [
    {
      id: "deepseek-chat",
      provider: "deepseek",
      name: "DeepSeek Chat",
      group: "DeepSeek Chat",
    },
    {
      id: "deepseek-reasoner",
      provider: "deepseek",
      name: "DeepSeek Reasoner",
      group: "DeepSeek Reasoner",
    },
  ],
  moonshot: [
    {
      id: "moonshot-v1-auto",
      name: "moonshot-v1-auto",
      provider: "moonshot",
      group: "moonshot-v1",
    },
  ],
  bailian: [
    {
      id: "qwen-vl-plus",
      name: "qwen-vl-plus",
      provider: "dashscope",
      group: "qwen-vl",
    },
    {
      id: "qwen-coder-plus",
      name: "qwen-coder-plus",
      provider: "dashscope",
      group: "qwen-coder",
    },
    {
      id: "qwen-turbo",
      name: "qwen-turbo",
      provider: "dashscope",
      group: "qwen-turbo",
    },
    {
      id: "qwen-plus",
      name: "qwen-plus",
      provider: "dashscope",
      group: "qwen-plus",
    },
    {
      id: "qwen-max",
      name: "qwen-max",
      provider: "dashscope",
      group: "qwen-max",
    },
  ],
};

// Provider definitions
export const providers = [
  {
    id: "deepseek",
    name: "DeepSeek",
    logo: "assets/providers/deepseek.png",
    baseUrl: "https://api.deepseek.com/v1",
    models: SYSTEM_MODELS.deepseek || [],
  },
  {
    id: "openai",
    name: "OpenAI",
    logo: "assets/providers/openai.png",
    baseUrl: "https://api.openai.com/v1",
    models: SYSTEM_MODELS.openai || [],
  },
  {
    id: "silicon",
    name: "siliconflow",
    logo: "assets/providers/silicon.png",
    baseUrl: "https://api.siliconflow.cn/v1",
    models: SYSTEM_MODELS.silicon || [],
  },
  {
    id: "lmstudio",
    name: "lmstudio",
    logo: "assets/providers/lmstudio.png",
    baseUrl: "http://127.0.0.1:1234/v1",
    models: [],
  },
  {
    id: "ollama",
    name: "ollama",
    logo: "assets/providers/ollama.png",
    baseUrl: "http://127.0.0.1:11434/v1",
    models: [],
  },
  {
    id: "moonshot",
    name: "moonshot",
    logo: "assets/providers/moonshot.png",
    baseUrl: "https://api.moonshot.cn/v1",
    models: SYSTEM_MODELS.moonshot || [],
  },
  {
    id: "dashscope",
  name: "Aliyun Bailian",
    logo: "assets/providers/dashscope.png",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    models: SYSTEM_MODELS.dashscope || [],
  },
  {
    id: "doubao",
    name: "Doubao",
    logo: "assets/providers/doubao.png",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    models: SYSTEM_MODELS.doubao || [],
  },
];

/**
 * Determine if the model is a reasoning model
 * @param {Object} model Model object
 * @returns {boolean} Whether it is a reasoning model
 */
export function isReasoningModel(model) {
  if (!model) {
    return false;
  }

  if (model.id.includes("claude-3-7-sonnet") || model.id.includes("o1")) {
    return true;
  }

  return (
    REASONING_REGEX.test(model.id) ||
    (model.type && model.type.includes("reasoning"))
  );
}

/**
 * Get the model name for the current config
 * @param {string} providerId Provider ID
 * @param {string} modelId Model ID
 * @param {boolean} useAllProviders Whether to use all providers (including custom providers)
 * @returns {string} Model name
 */
export function getModelName(providerId, modelId) {
  // If useAllProviders is true, use getAllProviders to get all providers
  // Otherwise, use only system providers
  const providerList = getAllProviders();
  const provider = providerList.find((p) => p.id === providerId);

  if (!provider) return i18n.t("settings.unknownModel");

  const model = provider.models.find((m) => m.id === modelId);
  return model ? model.name : i18n.t("settings.unknownModel");
}

/**
 * Get all models for the specified provider
 * @param {string} providerId Provider ID
 * @returns {Array} Model list
 */
export function getProviderModels(providerId) {
  const allProviders = getAllProviders();
  const provider = allProviders.find((p) => p.id === providerId);
  return provider ? provider.models : [];
}

/**
 * Get all providers (including system and custom providers)
 * @returns {Array} List of all providers
 */
export const getAllProviders = () => {
  // Get saved provider configs
  const savedProviderConfigs = getProvidersConfig();

  // Create a copy of system providers
  const allProviders = JSON.parse(JSON.stringify(providers));

  // Update system provider configs
  allProviders.forEach((provider) => {
    const savedConfig = savedProviderConfigs[provider.id];
    if (savedConfig) {
  // Use saved config if available
      provider.apiKey = savedConfig.apiKey || "";
      provider.baseUrl = savedConfig.baseUrl || "";
      provider.enabled =
        savedConfig.enabled !== undefined ? savedConfig.enabled : false;

  // Update model enabled and deleted status
      if (savedConfig.models) {
        provider.models.forEach((model) => {
          const savedModel = savedConfig.models.find((m) => m.id === model.id);
          if (savedModel) {
            model.enabled =
              savedModel.enabled !== undefined ? savedModel.enabled : true;
            // Add support for deleted flag
            model.deleted = savedModel.deleted === true;
          } else {
            // If no saved model config, default to enabled and not deleted
            model.enabled = true;
            model.deleted = false;
          }
        });

  // Add models from saved config that do not exist in system models (possibly added later)
        savedConfig.models.forEach((savedModel) => {
          const existingModel = provider.models.find(
            (m) => m.id === savedModel.id
          );
          if (!existingModel) {
            provider.models.push({
              id: savedModel.id,
              name: savedModel.name || savedModel.id,
              enabled:
                savedModel.enabled !== undefined ? savedModel.enabled : true,
              deleted: savedModel.deleted === true,
            });
          }
        });
      } else {
  // If no saved model config, all models are enabled and not deleted by default
        provider.models.forEach((model) => {
          model.enabled = true;
          model.deleted = false;
        });
      }
    } else {
  // If no saved config, provider is disabled by default, but all models are enabled and not deleted
      provider.enabled = false;
      provider.models.forEach((model) => {
        model.enabled = true;
        model.deleted = false;
      });
    }
  });

  // Add custom providers
  Object.keys(savedProviderConfigs).forEach((providerId) => {
    const providerConfig = savedProviderConfigs[providerId];
    if (providerConfig.isCustom) {
      const customProvider = {
        id: providerId,
        name: providerConfig.name,
        baseUrl: providerConfig.baseUrl,
        apiKey: providerConfig.apiKey,
        models: (providerConfig.models || []).map((model) => ({
          ...model,
          deleted: model.deleted === true,
        })),
        enabled:
          providerConfig.enabled !== undefined ? providerConfig.enabled : false,
        isCustom: true,
      };
      allProviders.push(customProvider);
    }
  });

  // Filter out models marked as deleted from the result
  allProviders.forEach((provider) => {
    provider.models = provider.models.filter((model) => !model.deleted);
  });

  return allProviders;
};

// Initialize system provider config
// This code runs at app startup to ensure system providers are correctly saved to config
if (typeof window !== "undefined") {
  // Get current saved provider config
  const savedConfig = getProvidersConfig();
  let needsUpdate = false;

  // Check if each system provider is already in config
  providers.forEach((provider) => {
    if (!savedConfig[provider.id]) {
  // If system provider is not in config, add it
      savedConfig[provider.id] = {
        ...provider,
        enabled: false, // Disabled by default
        models: provider.models.map((model) => ({
          ...model,
          enabled: true, // Enable all models by default
        })),
      };
      needsUpdate = true;
    } else {
  // If system provider is already in config, check if new models need to be added
      const savedModels = savedConfig[provider.id].models || [];
      const savedModelIds = savedModels.map((m) => m.id);

      provider.models.forEach((model) => {
        if (!savedModelIds.includes(model.id)) {
          // If model is not in config, add it
          savedModels.push({
            ...model,
            enabled: true, // Enable by default
          });
          needsUpdate = true;
        }
      });

  // Update model list
      savedConfig[provider.id].models = savedModels;
    }
  });

  // Save config if there are updates
  if (needsUpdate) {
    const configJson = JSON.stringify(savedConfig);
    localStorage.setItem("providersConfig", configJson);
  console.log("System provider config initialized");
  }
}
