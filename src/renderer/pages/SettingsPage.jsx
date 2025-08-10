import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout, Menu, Button, Form, message, Typography, Modal } from "antd";
import {
  ArrowLeftOutlined,
  ApiOutlined,
  SettingOutlined,
  InfoCircleOutlined,
  ThunderboltOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";

import { useUserConfig, getUserConfig } from "../hooks/useUserConfig";
import { providerService } from "../services/providerService";
import "../styles/SettingsPage.css";
import { useTranslation } from "react-i18next";

// Import split components
import ModelServices from "./settings/ModelServices";
import ProviderSettings from "./settings/ProviderSettings";
import GeneralSettings from "./settings/GeneralSettings";
import AboutSection from "./settings/AboutSection";
import MCPSettings from "./settings/MCPSettings";

const { Content, Header, Sider } = Layout;
const { Title } = Typography;

// Config name constants
const userConfigName = "user_config";
const providersConfigName = "providers_config";

const SettingsPage = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { config, saveConfig, clearAllConfig, updateLanguage } =
    useUserConfig();
  const [currentMenuKey, setCurrentMenuKey] = useState("model-services");
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [providers, setProviders] = useState([]);

  // Load provider config on initialization
  useEffect(() => {
    // Use providerService to get all providers
    const allProviders = providerService.getAllProviders();
    setProviders(allProviders);
    console.log("Loaded all providers:", allProviders);
  }, []);

  // Handle back button click
  const handleBack = () => {
    navigate("/");
  };

  // Handle menu selection
  const handleMenuSelect = ({ key }) => {
    setCurrentMenuKey(key);
    setSelectedProvider(null);
  };

  // Handle provider selection
  const handleSelectProvider = (provider) => {
    // Allow configuration even if provider is disabled
    console.log("Selected provider:", provider);
    setSelectedProvider(provider);
    setCurrentMenuKey("provider-settings");
  };

  // Handle provider data update
  const handleProviderUpdate = (updatedProvider) => {
    // If updatedProvider is null, it means the provider has been deleted
    if (!updatedProvider) {
      // Reload all providers
      const allProviders = providerService.getAllProviders();
      setProviders(allProviders);
      return;
    }

    // Update corresponding provider in providers list
    const updatedProviders = providers.map((provider) =>
      provider.id === updatedProvider.id ? updatedProvider : provider
    );
    setProviders(updatedProviders);
  };

  // Handle reset all configurations
  const handleResetAllConfig = () => {
    Modal.confirm({
      title: t("settings.clearConfigConfirm"),
      icon: <ExclamationCircleOutlined />,
      onOk() {
        // Clear all configurations
        const success = clearAllConfig();

        if (success) {
          // Show success message
          message.success(t("settings.clearSuccess"));

          // Delay 500ms before refreshing page to ensure configuration is completely cleared
          setTimeout(() => {
            window.location.reload();
          }, 500);
        } else {
          message.error("Failed to clear configuration, please try again");
        }
      },
      onCancel() {
        // User cancelled operation
      },
    });
  };

  // Render currently selected content
  const renderContent = () => {
    switch (currentMenuKey) {
      case "model-services":
        return (
          <ModelServices
            providers={providers}
            handleSelectProvider={handleSelectProvider}
            onProvidersChange={setProviders}
          />
        );
      case "provider-settings":
        return (
          <ProviderSettings
            initialProvider={selectedProvider}
            handleMenuSelect={handleMenuSelect}
            onProviderUpdate={handleProviderUpdate}
          />
        );
      case "general-settings":
        return (
          <GeneralSettings
            config={config}
            saveConfig={saveConfig}
            updateLanguage={updateLanguage}
            handleResetAllConfig={handleResetAllConfig}
          />
        );
      case "about":
        return <AboutSection />;
      case "mcp-settings":
        return <MCPSettings />;
      default:
        return <div>Unknown settings page</div>;
    }
  };

  return (
    <Layout className="settings-page">
      <Header className="settings-header">
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={handleBack}
          className="back-button"
        >
          {t("common.back")}
        </Button>
      </Header>
      <Layout className="settings-layout">
        <Sider width={200} className="settings-sider">
          <Menu
            mode="inline"
            selectedKeys={[currentMenuKey]}
            onSelect={handleMenuSelect}
            className="settings-menu"
          >
            <Menu.Item key="model-services" icon={<ApiOutlined />}>
              {t("settings.modelServices")}
            </Menu.Item>
            <Menu.Item key="mcp-settings" icon={<ThunderboltOutlined />}>
              {t("settings.mcpSettings")}
            </Menu.Item>
            <Menu.Item key="general-settings" icon={<SettingOutlined />}>
              {t("settings.general")}
            </Menu.Item>
            <Menu.Item key="about" icon={<InfoCircleOutlined />}>
              {t("common.about")}
            </Menu.Item>
          </Menu>
        </Sider>
        <Content className="settings-main-content">{renderContent()}</Content>
      </Layout>
    </Layout>
  );
};

export default SettingsPage;
