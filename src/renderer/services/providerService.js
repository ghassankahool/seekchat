/**
 * providerService.js
 * Unified management service for providers and models
 * Integrates all provider and model operations, providing a unified interface
 */

import { providers as systemProviders } from "./models.js";
import { getProvidersConfig, saveProviderConfig } from "../hooks/useUserConfig";
import { v4 as uuidv4 } from "uuid";
import i18n from "../i18n";

/**
 * Get all providers (including system and custom providers)
 * @returns {Array} List of all providers
 */
export const getAllProviders = () => {
  // Get saved provider configurations
  const savedProviderConfigs = getProvidersConfig();

  // Create a copy of system providers
  const allProviders = JSON.parse(JSON.stringify(systemProviders));

  // Update system provider configurations
  allProviders.forEach((provider) => {
    const savedConfig = savedProviderConfigs[provider.id];
    if (savedConfig) {
  // Use saved configuration if available
      provider.apiKey = savedConfig.apiKey || "";
      provider.baseUrl = savedConfig.baseUrl || "";
      provider.enabled =
        savedConfig.enabled !== undefined ? savedConfig.enabled : false;

  // Update model enabled and deleted status
      if (savedConfig.models)
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
      if (savedConfig.models) {
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

/**
 * Get the list of enabled providers
 * @returns {Array} List of enabled providers
 */
export const getEnabledProviders = () => {
  // Get all providers (including custom providers)
  const allProviders = getAllProviders();

  // Filter out enabled providers
  return allProviders.filter((provider) => provider.enabled !== false);
};

/**
 * Get provider by ID
 * @param {string} providerId Provider ID
 * @returns {Object|null} Provider object or null
 */
export const getProviderById = (providerId) => {
  const providers = getAllProviders();
  return providers.find((provider) => provider.id === providerId) || null;
};

/**
 * Enable or disable provider
 * @param {string} providerId Provider ID
 * @param {boolean} enabled Whether enabled
 * @returns {Object} Update result
 */
export const enableProvider = (providerId, enabled) => {
  try {
    const providersConfig = getProvidersConfig();
    if (!providersConfig[providerId]) {
      providersConfig[providerId] = { id: providerId };
    }

    providersConfig[providerId].enabled = enabled;

    const success = saveProviderConfig(providersConfig);
    return {
      success,
      message: success
        ? i18n.t(enabled ? "settings.enableSuccess" : "settings.disableSuccess")
        : i18n.t("settings.updateFailed"),
    };
  } catch (error) {
  console.error("Failed to enable/disable provider:", error);
    return { success: false, message: error.message };
  }
};

/**
 * Save provider settings
 * @param {string} providerId Provider ID
 * @param {Object} settings Provider settings
 * @returns {Object} Update result
 */
export const saveProviderSettings = (providerId, settings) => {
  try {
    const providersConfig = getProvidersConfig();
    const providerConfig = providersConfig[providerId] || {
      id: providerId,
      models: [],
    };

  // Update provider settings
    Object.keys(settings).forEach((key) => {
      providerConfig[key] = settings[key];
    });

  // Save config
    providersConfig[providerId] = providerConfig;
    const success = saveProviderConfig(providersConfig);

    return {
      success,
      message: success
        ? i18n.t("settings.saveSuccess")
        : i18n.t("settings.saveFailed"),
    };
  } catch (error) {
  console.error("Failed to save provider settings:", error);
    return { success: false, message: error.message };
  }
};

/**
 * Add custom provider
 * @param {Object} providerData Provider data
 * @returns {Object} Add result
 */
export const addCustomProvider = (providerData) => {
  try {
    const providerId = providerData.id || uuidv4();
    const providersConfig = getProvidersConfig();

  // Create new provider config
    providersConfig[providerId] = {
      id: providerId,
      name: providerData.name || "Custom Provider",
      baseUrl: providerData.baseUrl || "",
      apiKey: providerData.apiKey || "",
      models: providerData.models || [],
      isCustom: true,
      enabled:
        providerData.enabled !== undefined ? providerData.enabled : false,
    };

    const success = saveProviderConfig(providersConfig);

    return {
      success,
      providerId,
      message: success
        ? i18n.t("settings.addProviderSuccess")
        : i18n.t("settings.addProviderFailed"),
    };
  } catch (error) {
  console.error("Failed to add custom provider:", error);
    return { success: false, message: error.message };
  }
};

/**
 * Delete provider
 * @param {string} providerId Provider ID
 * @returns {Object} Delete result
 */
export const deleteProvider = (providerId) => {
  try {
  // Check if it is a system provider
    const provider = getProviderById(providerId);
    if (provider && !provider.isCustom) {
      return {
        success: false,
        message: i18n.t("settings.cannotDeleteSystemProvider"),
      };
    }

    const providersConfig = getProvidersConfig();
    delete providersConfig[providerId];

    const success = saveProviderConfig(providersConfig);

    return {
      success,
      message: success
        ? i18n.t("settings.deleteProviderSuccess")
        : i18n.t("settings.deleteProviderFailed"),
    };
  } catch (error) {
  console.error("Failed to delete provider:", error);
    return { success: false, message: error.message };
  }
};

/**
 * Get all models of a provider
 * @param {string} providerId Provider ID
 * @returns {Array} Model list
 */
export const getProviderModels = (providerId) => {
  const provider = getProviderById(providerId);
  return provider ? provider.models : [];
};

/**
 * Enable or disable model
 * @param {string} providerId Provider ID
 * @param {string} modelId Model ID
 * @param {boolean} enabled Whether enabled
 * @returns {Object} Update result
 */
export const enableModel = (providerId, modelId, enabled) => {
  try {
    const providersConfig = getProvidersConfig();
    const providerConfig = providersConfig[providerId];

    if (!providerConfig) {
      return {
        success: false,
        message: i18n.t("settings.providerNotFound"),
      };
    }

    // Ensure models array exists
    if (!providerConfig.models) {
      providerConfig.models = [];
    }

    // Find and update model
    let modelConfig = providerConfig.models.find((m) => m.id === modelId);

    if (modelConfig) {
      modelConfig.enabled = enabled;
    } else {
      // If model doesn't exist, add it
      const provider = getProviderById(providerId);
      const model = provider
        ? provider.models.find((m) => m.id === modelId)
        : null;

      providerConfig.models.push({
        id: modelId,
        name: model ? model.name : modelId,
        enabled: enabled,
      });
    }

    // Save configuration
    const success = saveProviderConfig(providersConfig);

    return {
      success,
      message: success
        ? i18n.t(
            enabled
              ? "settings.enableModelSuccess"
              : "settings.disableModelSuccess"
          )
        : i18n.t("settings.updateModelFailed"),
    };
  } catch (error) {
    console.error("Failed to enable/disable model:", error);
    return { success: false, message: error.message };
  }
};

/**
 * Add model to provider
 * @param {string} providerId Provider ID
 * @param {Object} modelData Model data
 * @returns {Object} Add result
 */
export const addModel = (providerId, modelData) => {
  try {
    if (!modelData.id) {
      return {
        success: false,
        message: i18n.t("settings.modelIdRequired"),
      };
    }

    const providersConfig = getProvidersConfig();
    const providerConfig = providersConfig[providerId];

    if (!providerConfig) {
      return {
        success: false,
        message: i18n.t("settings.providerNotFound"),
      };
    }

    // Ensure models array exists
    if (!providerConfig.models) {
      providerConfig.models = [];
    }

    // Check if model ID already exists
    if (providerConfig.models.some((m) => m.id === modelData.id)) {
      return {
        success: false,
        message: i18n.t("settings.modelAlreadyExists"),
      };
    }

    // Add new model
    const newModel = {
      id: modelData.id,
      name: modelData.name || modelData.id,
      enabled: modelData.enabled !== undefined ? modelData.enabled : true,
    };

    providerConfig.models.push(newModel);

    // Save configuration
    const success = saveProviderConfig(providersConfig);

    return {
      success,
      model: newModel,
      message: success
        ? i18n.t("settings.addModelSuccess")
        : i18n.t("settings.addModelFailed"),
    };
  } catch (error) {
    console.error("Failed to add model:", error);
    return { success: false, message: error.message };
  }
};

/**
 * Edit model
 * @param {string} providerId Provider ID
 * @param {string} modelId Model ID
 * @param {Object} modelData Model update data
 * @returns {Object} Update result
 */
export const editModel = (providerId, modelId, modelData) => {
  try {
    const providersConfig = getProvidersConfig();
    const providerConfig = providersConfig[providerId];

    if (!providerConfig || !providerConfig.models) {
      return {
        success: false,
        message: i18n.t("settings.providerOrModelNotFound"),
      };
    }

    // Find and update model
    const modelIndex = providerConfig.models.findIndex((m) => m.id === modelId);

    if (modelIndex === -1) {
      return {
        success: false,
        message: i18n.t("settings.modelNotFound"),
      };
    }

    // Create updated model object
    const updatedModel = {
      ...providerConfig.models[modelIndex],
      ...modelData,
      id: modelData.id || modelId, // Ensure ID exists
    };

    // If ID has changed, need to check if new ID already exists
    if (modelData.id && modelData.id !== modelId) {
      const existingModel = providerConfig.models.find(
        (m) => m.id === modelData.id
      );
      if (existingModel) {
        return {
          success: false,
          message: i18n.t("settings.modelIdAlreadyExists"),
        };
      }

      // Delete old ID model
      providerConfig.models.splice(modelIndex, 1);

      // Add new model
      providerConfig.models.push(updatedModel);
    } else {
      // Update model directly
      providerConfig.models[modelIndex] = updatedModel;
    }

    // Save configuration
    const success = saveProviderConfig(providersConfig);

    return {
      success,
      model: updatedModel,
      message: success
        ? i18n.t("settings.editModelSuccess")
        : i18n.t("settings.editModelFailed"),
    };
  } catch (error) {
    console.error("Failed to edit model:", error);
    return { success: false, message: error.message };
  }
};

/**
 * Delete model
 * @param {string} providerId Provider ID
 * @param {string} modelId Model ID
 * @returns {Object} Delete result
 */
export const deleteModel = (providerId, modelId) => {
  try {
    const providersConfig = getProvidersConfig();
    const providerConfig = providersConfig[providerId];

    if (!providerConfig || !providerConfig.models) {
      return {
        success: false,
        message: i18n.t("settings.providerOrModelNotFound"),
      };
    }

    // Find model
    const modelIndex = providerConfig.models.findIndex((m) => m.id === modelId);

    if (modelIndex === -1) {
      return {
        success: false,
        message: i18n.t("settings.modelNotFound"),
      };
    }

    // Check if it's a system provider
    const provider = getProviderById(providerId);
    const isSystemProvider = provider && !provider.isCustom;

    if (isSystemProvider) {
      // For system providers, mark model as deleted instead of removing
      providerConfig.models[modelIndex].deleted = true;
    } else {
      // For custom providers, remove model directly
      providerConfig.models.splice(modelIndex, 1);
    }

    // Save configuration
    const success = saveProviderConfig(providersConfig);

    return {
      success,
      message: success
        ? i18n.t("settings.deleteModelSuccess")
        : i18n.t("settings.deleteModelFailed"),
    };
  } catch (error) {
    console.error("Failed to delete model:", error);
    return { success: false, message: error.message };
  }
};

// Initialize system provider configuration
export const initializeProviders = () => {
  if (typeof window !== "undefined") {
    // Get currently saved provider configuration
    const savedConfig = getProvidersConfig();
    let needsUpdate = false;

    // Check if each system provider is already in configuration
    systemProviders.forEach((provider) => {
      if (!savedConfig[provider.id]) {
        // If system provider is not in configuration, add it
        savedConfig[provider.id] = {
          ...provider,
          enabled: false, // Default disabled
          models: provider.models.map((model) => ({
            ...model,
            enabled: true, // Default enable all models
          })),
        };
        needsUpdate = true;
      } else {
        // If system provider is already in configuration, check if there are new models to add
        const savedModels = savedConfig[provider.id].models || [];
        const savedModelIds = savedModels.map((m) => m.id);

        provider.models.forEach((model) => {
          if (!savedModelIds.includes(model.id)) {
            // If model is not in configuration, add it
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

    // If there are updates, save configuration
    if (needsUpdate) {
      saveProviderConfig(savedConfig);
      console.log("Initialized system provider configuration");
    }
  }
};

// Initialize provider configuration
initializeProviders();

// Export unified service object
export const providerService = {
  // Provider operations
  getAllProviders,
  getEnabledProviders,
  getProviderById,
  enableProvider,
  saveProviderSettings,
  addCustomProvider,
  deleteProvider,

  // Model operations
  getProviderModels,
  enableModel,
  addModel,
  editModel,
  deleteModel,

  // Configuration management
  getProvidersConfig,
  saveProviderConfig,
};

export default providerService;
