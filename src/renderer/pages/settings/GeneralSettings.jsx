import React, { useEffect } from "react";
import { Form, Select, Card, Button, Typography, Modal, message } from "antd";
import { ClearOutlined, ExclamationCircleOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";

const { Title, Paragraph } = Typography;

const GeneralSettings = ({
  config,
  saveConfig,
  updateLanguage,
  handleResetAllConfig,
}) => {
  const { t, i18n } = useTranslation();
  const [form] = Form.useForm();

  // Initialize form values
  useEffect(() => {
    form.setFieldsValue({
      language: config.language || "en",
    });
  }, [config, form]);

  // Handle form value changes (moved to component internal)
  const handleFormValueChange = (changedValues, allValues) => {
    // Update configuration
    const newConfig = { ...config, ...allValues };
    saveConfig(newConfig);
  };

  // Handle language change (moved to component internal)
  const handleLanguageChange = (language) => {
    updateLanguage(language);
    i18n.changeLanguage(language);
    message.success(t("settings.saveSuccess"));
  };

  return (
    <div className="settings-content">
      <Card title={t("settings.general")} bordered={false}>
        <Form
          form={form}
          layout="vertical"
          onValuesChange={handleFormValueChange}
          initialValues={{ language: config.language || "en" }}
        >
          <Form.Item
            name="language"
            label={t("settings.language")}
            tooltip={t("settings.language")}
          >
            <Select
              onChange={handleLanguageChange}
              options={[
                { value: "en", label: t("language.en") },
                { value: "zh-CN", label: t("language.zh-CN") },
              ]}
            />
          </Form.Item>
        </Form>
      </Card>

      <Card className="settings-card" style={{ marginTop: 16 }}>
        <div className="settings-section">
          <Title level={5}>{t("settings.clearConfig")}</Title>
          <Paragraph>{t("settings.clearConfigHint")}</Paragraph>
          <Button
            type="primary"
            danger
            icon={<ClearOutlined />}
            onClick={handleResetAllConfig}
          >
            {t("settings.clearConfig")}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default GeneralSettings;
