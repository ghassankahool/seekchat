import React, { useState, useEffect } from "react";
import {
  Switch,
  Typography,
  message,
  Button,
  Modal,
  Form,
  Input,
  Card,
  Alert,
  Tag,
  Divider,
} from "antd";
import { useTranslation } from "react-i18next";
import { PlusOutlined, ApiOutlined } from "@ant-design/icons";
import { providerService } from "../../services/providerService";

const { Title, Paragraph } = Typography;

const ModelServices = ({
  providers: initialProviders,
  handleSelectProvider,
  onProvidersChange,
}) => {
  const { t } = useTranslation();
  const [providers, setProviders] = useState(initialProviders);
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    setProviders(initialProviders);
  }, [initialProviders]);

  const handleProviderEnabledChange = (providerId, enabled) => {
    // Use providerService to enable/disable provider
    const result = providerService.enableProvider(providerId, enabled);

    if (result.success) {
      // Update local state
      const updatedProviders = providers.map((provider) => {
        if (provider.id === providerId) {
          return { ...provider, enabled };
        }
        return provider;
      });

      setProviders(updatedProviders);

      if (onProvidersChange) {
        onProvidersChange(updatedProviders);
      }

      message.success(
        `${enabled ? t("common.enable") : t("common.disable")} ${t(
          "common.success"
        )}`
      );
    } else {
      message.error(result.message || t("common.operationFailed"));
    }
  };

  // Show add provider dialog
  const showAddModal = () => {
    setIsAddModalVisible(true);
    form.resetFields();
  };

  // Handle add provider
  const handleAddProvider = async () => {
    try {
      const values = await form.validateFields();

      // Create new provider object
      const newProviderData = {
        name: values.name,
        baseUrl: values.baseUrl,
        apiKey: values.apiKey || "",
        models: [
          {
            id: values.modelId,
            name: values.modelName || values.modelId,
            enabled: true,
          },
        ],
        enabled: true,
      };

      // Use providerService to add custom provider
      const result = providerService.addCustomProvider(newProviderData);

      if (result.success) {
        // Re-fetch all providers to ensure data consistency
        const allProviders = providerService.getAllProviders();
        setProviders(allProviders);

        if (onProvidersChange) {
          onProvidersChange(allProviders);
        }

        message.success(t("settings.addProviderSuccess"));
        setIsAddModalVisible(false);
      } else {
        message.error(result.message || t("settings.addProviderFailed"));
      }
    } catch (error) {
      console.error("Failed to add provider:", error);
      message.error(t("settings.addProviderFailed"));
    }
  };

  return (
    <div className="settings-content">
      <Card className="settings-card" title={t("settings.modelServices")}>
        <Alert
          message={t("settings.selectProvider")}
          description={t("settings.selectProviderHint")}
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        <div className="provider-grid">
          {providers && providers.length > 0 ? (
            <>
              {providers.map((provider) => (
                <div
                  key={provider.id}
                  className={`provider-grid-item ${
                    !provider.enabled ? "provider-disabled" : ""
                  }`}
                >
                  <div
                    className="provider-content"
                    onClick={() => handleSelectProvider(provider)}
                  >
                    <div className="provider-logo-container">
                      {provider.logo ? (
                        <img
                          src={provider.logo}
                          alt={provider.name}
                          className="provider-logo"
                          onError={(e) => {
                            e.target.style.display = "none";
                            // Display first letter
                            const textElement =
                              e.target.parentNode.querySelector(
                                ".provider-logo-text"
                              );
                            if (textElement) {
                              textElement.style.display = "flex";
                            }
                          }}
                        />
                      ) : (
                        <div className="provider-logo-text">
                          {provider.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="provider-info">
                      <div className="provider-name">{provider.name}</div>
                      <div className="provider-model-count">
                        {provider.models.length} {t("common.models")}
                      </div>
                    </div>
                  </div>
                  <div
                    className="provider-actions"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Switch
                      checked={provider.enabled !== false}
                      onChange={(checked) =>
                        handleProviderEnabledChange(provider.id, checked)
                      }
                      checkedChildren={t("common.enable")}
                      unCheckedChildren={t("common.disable")}
                    />
                  </div>
                </div>
              ))}
              {/* Add provider button as the last card */}
              <div
                className="provider-grid-item add-provider-item"
                onClick={showAddModal}
              >
                <div className="add-provider-content">
                  <PlusOutlined className="add-icon" />
                  <div className="add-text">{t("settings.addProvider")}</div>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-providers">
              <div className="empty-providers-text">
                {t("settings.noProvidersAvailable")}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Add provider dialog */}
      <Modal
        title={t("settings.addCustomProvider")}
        open={isAddModalVisible}
        onOk={handleAddProvider}
        onCancel={() => setIsAddModalVisible(false)}
        destroyOnClose={true}
        maskClosable={false}
        okText={t("common.save")}
        cancelText={t("common.cancel")}
        width={500}
      >
        <Form form={form} layout="vertical" className="provider-form">
          <Form.Item
            name="name"
            label={t("settings.providerName")}
            rules={[
              { required: true, message: t("settings.providerNameRequired") },
            ]}
          >
            <Input placeholder={t("settings.providerNamePlaceholder")} />
          </Form.Item>
          <Form.Item
            name="baseUrl"
            label={t("settings.apiBaseUrl")}
            rules={[{ required: true, message: t("settings.baseUrlRequired") }]}
          >
            <Input placeholder="https://api.example.com/v1" />
          </Form.Item>
          <Form.Item
            name="apiKey"
            label={t("settings.apiKey")}
            rules={[{ required: false, message: t("settings.apiKeyRequired") }]}
          >
            <Input.Password placeholder={t("settings.enterApiKey")} />
          </Form.Item>

          <Divider style={{ margin: "12px 0" }}>
            {t("settings.modelSettings")}
          </Divider>

          <Form.Item
            name="modelId"
            label={t("settings.modelId")}
            rules={[{ required: true, message: t("settings.modelIdRequired") }]}
          >
            <Input placeholder="gpt-3.5-turbo" />
          </Form.Item>
          <Form.Item name="modelName" label={t("settings.modelName")}>
            <Input placeholder={t("settings.modelNamePlaceholder")} />
          </Form.Item>
          <div className="provider-form-tips">
            {t("settings.modelIdNotEditable")}
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default ModelServices;
