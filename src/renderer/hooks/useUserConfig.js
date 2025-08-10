import React, { useState, useEffect } from "react";
import { getAllProviders } from "../services/models";
// Remove import of models.js to avoid circular dependency
// import { providers } from "../services/models";

// Config name constants
const userConfigName = "user_config";
const providersConfigName = "providers_config";

// Default user config
const defaultUserConfig = {
  theme: "light", // Default theme
  // language: "en", // Default language
  // Other default configs...
};

/**
 * User config hook for getting and managing user config
 * @returns {Object} Contains user config state and methods
 */
export const useUserConfig = () => {
  const [config, setConfig] = useState(() => getUserConfig());

  // Listen for config changes
  useEffect(() => {
    const handleStorageChange = () => {
      setConfig(getUserConfig());
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  // Save config
  const saveConfig = (newConfig) => {
    const success = saveUserConfig(newConfig);
    if (success) {
      setConfig(newConfig);
    }
    return success;
  };

  // Update language setting
  const updateLanguage = (language) => {
    const newConfig = { ...config, language };
    return saveConfig(newConfig);
  };

  return {
    config,
    setConfig,
    saveConfig,
    getProvidersConfig,
    saveProviderConfig,
    clearAllConfig: () => {
      const success = clearAllConfigInternal();
      if (success) {
        setConfig(defaultUserConfig);
      }
      return success;
    },
    updateLanguage,
  };
};

// Get config from localStorage
export const getUserConfig = () => {
  try {
    const configStr = localStorage.getItem(userConfigName);
    if (configStr) {
      return JSON.parse(configStr);
    }
  } catch (error) {
  console.error("Failed to get user config:", error);
  }
  return { ...defaultUserConfig };
};

// Save config to localStorage
export const saveUserConfig = (config) => {
  try {
    localStorage.setItem(userConfigName, JSON.stringify(config));
    return true;
  } catch (error) {
  console.error("Failed to save user config:", error);
    return false;
  }
};

// Get provider config
export const getProvidersConfig = () => {
  try {
    const providersJson = localStorage.getItem(providersConfigName);
    if (!providersJson) {
  console.log("No provider config in localStorage, returning empty object");
      return {};
    }

    const savedConfig = JSON.parse(providersJson);

  // Check if savedConfig is an array, convert to object if so
    if (Array.isArray(savedConfig)) {
  // console.log('Provider config from localStorage is array, converting to object');
      const configObj = {};
      savedConfig.forEach((provider) => {
        if (provider && provider.id) {
          configObj[provider.id] = provider;
        }
      });
      return configObj;
    }

  // If it's an object, return directly
    if (savedConfig && typeof savedConfig === "object") {
  // console.log('Provider config from localStorage:', savedConfig);
      return savedConfig;
    }

  console.error("Provider config format from localStorage is incorrect");
    return {};
  } catch (error) {
  console.error("Failed to parse provider config:", error);
    return {};
  }
};

export const saveProviderConfig = (providersConfig) => {
  try {
    console.log("saveProviderConfig", providersConfig);
  // Ensure providersConfig is object, not array
    if (Array.isArray(providersConfig)) {
  console.error("providersConfig is array, needs to be converted to object");
      const configObj = {};
      providersConfig.forEach((provider) => {
        if (provider && provider.id) {
          configObj[provider.id] = provider;
        }
      });
      providersConfig = configObj;
    }

  // Ensure providersConfig is an object
    if (!providersConfig) {
      providersConfig = {};
    }
  // Compare providersConfig and getAllProviders, add missing fields from getAllProviders
    const allProviders = getAllProviders();
    allProviders.forEach((provider) => {
      if (providersConfig[provider.id]) {
  // Compare providersConfig[provider.id] and provider, add missing fields if not present
        Object.keys(provider).forEach((key) => {
          // Only add default if providersConfig[provider.id][key] is undefined
          // This ensures false values are not overwritten by defaults
          if (providersConfig[provider.id][key] === undefined) {
            providersConfig[provider.id][key] = provider[key];
          }
        });
      }
    });

  // Ensure each provider has models property
    Object.keys(providersConfig).forEach((providerId) => {
      const provider = providersConfig[providerId];
      if (!provider.models) {
  console.warn(`Provider ${providerId} has no models property, initializing as empty array`);
        provider.models = [];
      } else if (!Array.isArray(provider.models)) {
  console.warn(`Provider ${providerId} models is not array, resetting to empty array`);
        provider.models = [];
      }
    });

  // Save to localStorage
    const configJson = JSON.stringify(providersConfig);
    localStorage.setItem(providersConfigName, configJson);
  console.log("Provider config saved successfully, data size:", configJson.length, "bytes");
  console.log("Saved data:", providersConfig);

    return true;
  } catch (error) {
  console.error("Failed to save provider config:", error);
    return false;
  }
};

/**
 * Save config for a single provider
 * @param {string} providerId Provider ID
 * @param {Object} config Provider config
 * @returns {boolean} Whether save was successful
 */
export const saveProviderConfigById = (providerId, config) => {
  try {
    const savedConfig = getProvidersConfig();
    savedConfig[providerId] = config;
    return saveProviderConfig(savedConfig);
  } catch (error) {
  console.error("Failed to save provider config:", error);
    return false;
  }
};

// Clear all config
export const clearAllConfigInternal = () => {
  try {
  // Clear user config
    localStorage.removeItem(userConfigName);

  // Clear provider config
    localStorage.removeItem(providersConfigName);

  console.log("All config cleared");
    return true;
  } catch (error) {
  console.error("Failed to clear config:", error);
    return false;
  }
};

// Initialize config
if (typeof window !== "undefined") {
  if (!localStorage.getItem(userConfigName)) {
    saveUserConfig(getUserConfig());
  }

  // Initialize provider config
  if (!localStorage.getItem(providersConfigName)) {
  // No longer depend on providers in models.js
  // Initialize as empty object, providers will be loaded by other means at app startup
    localStorage.setItem(providersConfigName, "{}");
  } else {
  // Check if existing config has enabled field, add if missing
    const existingConfig = JSON.parse(
      localStorage.getItem(providersConfigName)
    );
    let needsUpdate = false;

  // If array format
    if (Array.isArray(existingConfig)) {
      const updatedConfig = existingConfig.map((provider) => {
        if (provider.enabled === undefined) {
          needsUpdate = true;
          return { ...provider, enabled: false };
        }
        return provider;
      });

      if (needsUpdate) {
        localStorage.setItem(
          providersConfigName,
          JSON.stringify(updatedConfig)
        );
      }
    }
  // If object format
    else if (typeof existingConfig === "object") {
      const updatedConfig = { ...existingConfig };
      let needsUpdate = false;

      Object.keys(updatedConfig).forEach((key) => {
        if (updatedConfig[key].enabled === undefined) {
          updatedConfig[key].enabled = false;
          needsUpdate = true;
        }
      });

      if (needsUpdate) {
        localStorage.setItem(
          providersConfigName,
          JSON.stringify(updatedConfig)
        );
      }
    }
  }
}

/**
 * Check if AI provider and model are configured
 * @returns {boolean} Whether configured
 */
export function isAIConfigured() {
  const config = getUserConfig();
  const allProviders = getAllProviders();
  console.log("Check AI config:", { userConfig: config, allProviders });
  // Check if provider and model are selected
  if (!config.providerId || !config.modelId) {
  console.log("Provider or model not selected");
    return false;
  }

  // Check in allProviders that provider is not disabled and model is not disabled or deleted
  const provider = allProviders.find(
    (p) => p.id === config.providerId && p.enabled !== false
  );
  console.log("Check AI config:", { provider });
  if (!provider) {
    return false;
  }
  const model = provider.models.find(
    (m) => m.id === config.modelId && m.enabled !== false && m.deleted !== true
  );
  console.log("Check AI config:", { model });
  if (!model) {
    return false;
  }
  return true;
}
