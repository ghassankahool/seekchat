import React, { useRef, memo, useState, useEffect, useCallback } from "react";
import {
  Input,
  Button,
  Spin,
  Avatar,
  Tooltip,
  message,
  Select,
  Space,
  Collapse,
  Modal,
  Slider,
  InputNumber,
  Form,
} from "antd";
import {
  SendOutlined,
  UserOutlined,
  RobotOutlined,
  SettingOutlined,
  CopyOutlined,
  StopOutlined,
  DownOutlined,
} from "@ant-design/icons";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { getEnabledProviders } from "../services/aiService";
import { getModelName, getAllProviders } from "../services/models";
import { providers } from "../services/models";
import { useUserConfig } from "../hooks/useUserConfig";
import { useMessages } from "../hooks/useMessages";
import {
  parseMessageContent,
  formatMessageContent,
} from "../services/messageService";
import "../styles/ChatWindow.css";
import { useTranslation } from "react-i18next";
import ChatInputContainer from "./ChatInputContainer";
import MCPToolsButton from "./MCPToolsButton";
import MessageItem from "./MessageItem";

const { TextArea } = Input;
const { Option, OptGroup } = Select;
const { Panel } = Collapse;

// Message content component
const MessageContent = ({ content }) => {
  const { t } = useTranslation();

  // If content is string, try to parse as JSON
  const parsedContent =
    typeof content === "string" ? parseMessageContent(content) : content;

  // Copy code to clipboard
  const copyCodeToClipboard = (code) => {
    navigator.clipboard
      .writeText(code)
      .then(() => {
        message.success(t("chat.codeCopied"));
      })
      .catch((error) => {
        console.error("Failed to copy code:", error);
        message.error(t("chat.copyToClipboard") + t("common.failed"));
      });
  };

  // Handle link click events, open in external browser
  const handleLinkClick = (href, event) => {
    event.preventDefault();

    // Use electronAPI to open link in browser
    window.electronAPI.openExternalURL(href).catch((err) => {
      console.error(t("about.openLinkFailed"), err);
      message.error(`${t("about.openLinkFailed")} ${err.message}`);
    });
  };

  // Custom renderer, add code highlighting functionality
  const renderers = {
    code({ node, inline, className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || "");
      const language = match ? match[1] : "text";
      const codeString = String(children).replace(/\n$/, "");

      return !inline && match ? (
        <div className="code-block-wrapper">
          <div className="code-block-header">
            <span className="code-language">{language}</span>
            <Tooltip title={t("chat.copyCode")}>
              <Button
                type="text"
                icon={<CopyOutlined />}
                className="code-copy-button"
                onClick={() => copyCodeToClipboard(codeString)}
              />
            </Tooltip>
          </div>
          <SyntaxHighlighter
            style={vscDarkPlus}
            language={language}
            PreTag="div"
            {...props}
          >
            {codeString}
          </SyntaxHighlighter>
        </div>
      ) : (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },

    // Custom link rendering, set to open in external browser
    a({ node, href, children, ...props }) {
      return (
        <a
          href={href}
          onClick={(event) => handleLinkClick(href, event)}
          style={{ color: "#1890ff", textDecoration: "underline" }}
          {...props}
        >
          {children}
        </a>
      );
    },
  };

  // If parsed result is array, render multiple content blocks
  if (Array.isArray(parsedContent)) {
    // Find main content (type is content)
    const mainContent = parsedContent.find((item) => item.type === "content");
    // Find reasoning content (type is reasoning_content)
    const reasoningContent = parsedContent.find(
      (item) => item.type === "reasoning_content"
    );
    // Find tool call content (type is tool_calls)
    const toolCallsContent = parsedContent.find(
      (item) => item.type === "tool_calls"
    );
    console.log("toolCallsContent:", toolCallsContent);

    // Import MCP tool call component
    const MCPToolCall = lazy(() => import("./MCPToolCall"));

    return (
      <div className="message-content-blocks">
        {/* Reasoning content (collapsible) - moved before main content */}
        {reasoningContent &&
          reasoningContent.content &&
          reasoningContent.content !== "" && (
            <Collapse
              ghost
              className="reasoning-collapse"
              defaultActiveKey={[]}
            >
              <Panel
                header={
                  <div className="reasoning-header">
                    <span>💡 {t("chat.reasoning")}</span>
                    {reasoningContent.status === "pending" && (
                      <Spin size="small" className="reasoning-spinner" />
                    )}
                  </div>
                }
                key="1"
              >
                <div className={`reasoning-content ${reasoningContent.status}`}>
                  {reasoningContent.status === "pending" ? (
                    <Spin size="small" />
                  ) : (
                    <ReactMarkdown components={renderers}>
                      {reasoningContent.content}
                    </ReactMarkdown>
                  )}
                </div>
              </Panel>
            </Collapse>
          )}
        {/* Tool call content */}
        {toolCallsContent &&
          toolCallsContent.content &&
          Array.isArray(toolCallsContent.content) && (
            <div className="tool-calls-container">
              {toolCallsContent.status === "receiving" && (
                <div className="tool-calling-status">
                  <Spin size="small" />
                  <span>{t("chat.mcpTools.executingTools")}</span>
                </div>
              )}
              {toolCallsContent.content.map((toolCall, index) => (
                <React.Suspense
                  key={toolCall.id || index}
                  fallback={<Spin size="small" />}
                >
                  <MCPToolCall toolCall={toolCall} isCollapsed={true} />
                </React.Suspense>
              ))}
            </div>
          )}
        {/* Main content - moved after reasoning content */}
        {mainContent && mainContent.status !== "error" && (
          <div className="message-main-content">
            <ReactMarkdown components={renderers}>
              {mainContent.content}
            </ReactMarkdown>
            {mainContent.status === "pending" && mainContent.content && (
              <div className="message-pending-indicator">
                <Spin size="small" />
              </div>
            )}
          </div>
        )}

        {/* Error content */}
        {mainContent && mainContent.status === "error" && (
          <div className="message-error-content">{mainContent.content}</div>
        )}

        {/* If no content, show loading */}
        {!mainContent && !reasoningContent && !toolCallsContent && (
          <Spin size="small" />
        )}
      </div>
    );
  }

  // If not an array, render content directly
  return (
    <ReactMarkdown components={renderers}>
      {typeof parsedContent === "string"
        ? parsedContent
        : formatMessageContent(parsedContent)}
    </ReactMarkdown>
  );
};

// Implement copy functionality directly in frontend
const copyToClipboard = (content, t) => {
  // If it's a string, try to parse as JSON
  const parsedContent =
    typeof content === "string" ? parseMessageContent(content) : content;

  // Find main content
  let textToCopy = "";
  if (Array.isArray(parsedContent)) {
    const mainContent = parsedContent.find((item) => item.type === "content");
    if (mainContent) {
      textToCopy = mainContent.content;
    }
  } else {
    textToCopy =
      typeof parsedContent === "string"
        ? parsedContent
        : formatMessageContent(parsedContent);
  }

  // Copy to clipboard
  try {
    navigator.clipboard.writeText(textToCopy);
    message.success(t("chat.copiedToClipboard"));
  } catch (error) {
    console.error("copy failed:", error);
    message.error(
      t("chat.copyToClipboard") + t("common.failed") + ":" + error.message
    );

    // Fallback: create temporary textarea
    try {
      const textArea = document.createElement("textarea");
      textArea.value = textToCopy;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      message.success(t("chat.copiedToClipboard"));
    } catch (fallbackError) {
      console.error("fallback copy failed:", fallbackError);
      message.error(
        t("chat.copyToClipboard") +
          t("common.failed") +
          ":" +
          fallbackError.message
      );
    }
  }
};

// Model settings modal component
const ModelSettingsModal = ({ visible, onCancel, onSave, initialSettings }) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [temperature, setTemperature] = useState(0.7);
  const [contextLength, setContextLength] = useState(10);

  // When modal opens, set form initial values
  useEffect(() => {
    if (visible && initialSettings) {
      // Set default values or use saved values from session
      const defaultSettings = { temperature: 0.7, contextLength: 10 };
      const settings = { ...defaultSettings, ...initialSettings };

      console.log("settings modal initial settings:", settings);

      // Set local state directly
      setTemperature(parseFloat(settings.temperature));
      setContextLength(settings.contextLength);

      // Set form values
      form.setFieldsValue({
        temperature: parseFloat(settings.temperature),
        contextLength: settings.contextLength,
      });
    }
  }, [visible, initialSettings, form]);

  const handleSave = () => {
    form
      .validateFields()
      .then((values) => {
        onSave(values);
        onCancel();
      })
      .catch((info) => {
        console.log("settings modal validation failed:", info);
      });
  };

  // Generate context length options
  const contextOptions = [
    { label: t("settings.unlimitedContext"), value: -1 },
    ...Array.from({ length: 20 }, (_, i) => ({
      label: `${i + 1} ${t("settings.messages")}`,
      value: i + 1,
    })),
  ];

  return (
    <Modal
      title={t("settings.modelSettings")}
      open={visible}
      onCancel={onCancel}
      onOk={handleSave}
      destroyOnClose={true}
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={{ temperature, contextLength }}
      >
        <Form.Item
          name="temperature"
          label={t("settings.temperature")}
          tooltip={t("settings.temperatureHint")}
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            <Slider
              min={0}
              max={1}
              step={0.1}
              style={{ flex: 1, marginRight: 16 }}
              value={temperature}
              onChange={(value) => {
                setTemperature(value);
                form.setFieldsValue({ temperature: value });
              }}
            />
            <InputNumber
              min={0}
              max={1}
              step={0.1}
              style={{ width: 70 }}
              value={temperature}
              onChange={(value) => {
                if (value !== null) {
                  setTemperature(value);
                  form.setFieldsValue({ temperature: value });
                }
              }}
            />
          </div>
        </Form.Item>

        <Form.Item
          name="contextLength"
          label={t("settings.contextLength")}
          tooltip={t("settings.contextLengthHint")}
        >
          <Select
            options={contextOptions}
            style={{ width: "100%" }}
            value={contextLength}
            onChange={(value) => {
              setContextLength(value);
              form.setFieldsValue({ contextLength: value });
            }}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
};

// Get service provider and model information
const getProviderAndModelInfo = (providerId, modelId) => {
  // Get all providers (including system and custom providers)
  const allProviders = getAllProviders();

  // Find provider
  const provider = allProviders.find((p) => p.id === providerId);
  if (!provider)
    return {
      providerName: "AI Assistant",
      modelName: "Unknown Model",
      logo: null,
      providerId: "",
    };

  // Find model
  let modelName = "AI Assistant";
  const allModels = provider.models || [];
  const model = allModels.find((m) => m.id === modelId);

  if (model) {
    modelName = model.name;
  }

  return {
    providerName: provider.name,
    modelName: modelName,
    logo: provider.logo,
    providerId: provider.id,
  };
};

// Wrap ChatWindow component with memo
const ChatWindow = memo(({ session, onUpdateSession }) => {
  const { t } = useTranslation();
  const { config, saveConfig } = useUserConfig();
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [sessionSettings, setSessionSettings] = useState(null);
  const electronAPI = window.electronAPI;
  const sessionIdRef = useRef(null);

  // Track visible message IDs for optimizing scrolling and rendering
  const [visibleMessageIds, setVisibleMessageIds] = useState({});

  const {
    messages,
    isSending,
    loading,
    messagesEndRef,
    chatContainerRef,
    handleSendMessage,
    loadMessages,
    handleStopGeneration,
    scrollToBottom,
  } = useMessages(session, sessionSettings);

  // Load settings when session changes
  useEffect(() => {
    const loadSessionSettings = async () => {
      if (!session) {
        setSessionSettings(null);
        return;
      }

      // Set current session ID reference
      sessionIdRef.current = session.id;

      // Get latest session data from database
      try {
        // Get latest session data
        const sessions = await electronAPI.getSessions();
        const freshSession = sessions.find((s) => s.id === session.id);

        if (!freshSession) {
          console.error(`Session not found ID: ${session.id}`);
          setSessionSettings({ temperature: 0.7, contextLength: 10 });
          return;
        }

        console.log("Get latest session data from database:", freshSession);

        // Try to load settings from session metadata
        let metadata = {};
        if (freshSession.metadata) {
          metadata =
            typeof freshSession.metadata === "string" && freshSession.metadata
              ? JSON.parse(freshSession.metadata)
              : freshSession.metadata || {};
        }
        console.log("session metadata:", metadata);

        // Merge default settings with potentially missing values
        const defaultSettings = { temperature: 0.7, contextLength: 10 };
        const mergedSettings = { ...defaultSettings, ...metadata };

        // Ensure temperature is a number type
        if (mergedSettings.temperature !== undefined) {
          mergedSettings.temperature = parseFloat(mergedSettings.temperature);
        }

        console.log(
          `session ${freshSession.id} load settings:`,
          mergedSettings
        );
        setSessionSettings(mergedSettings);
      } catch (error) {
        console.error("Failed to load session settings:", error);
        // Use default settings
        setSessionSettings({ temperature: 0.7, contextLength: 10 });
      }
    };

    loadSessionSettings();
  }, [session, electronAPI]);

  // Listen to message list changes, auto scroll to bottom
  useEffect(() => {
    if (messages.length > 0 && !loading) {
      // Use requestAnimationFrame to ensure scroll executes in next render cycle
      requestAnimationFrame(() => {
        scrollToBottom();
        console.log("Auto scroll to bottom after message update");
      });
    }
  }, [messages.length, loading, scrollToBottom]);

  // Handle message visibility changes
  const handleMessageVisibilityChange = useCallback((messageId, isVisible) => {
    if (isVisible) {
      setVisibleMessageIds((prev) => ({ ...prev, [messageId]: true }));
    } else {
      setVisibleMessageIds((prev) => {
        const newState = { ...prev };
        delete newState[messageId];
        return newState;
      });
    }
  }, []);

  // Save session settings
  const saveSessionSettings = async (settings) => {
    if (!session) return;

    try {
      // Ensure temperature is a number type, only save temperature and context message count
      const processedSettings = {
        temperature: parseFloat(settings.temperature),
        contextLength: settings.contextLength,
      };

      console.log(`save session ${session.id} settings:`, processedSettings);
      await electronAPI.updateSessionMetadata(session.id, processedSettings);

      // Immediately reload latest settings from database after saving
      const sessions = await electronAPI.getSessions();
      const freshSession = sessions.find((s) => s.id === session.id);

      if (freshSession && freshSession.metadata) {
        const metadata =
          typeof freshSession.metadata === "string" && freshSession.metadata
            ? JSON.parse(freshSession.metadata)
            : freshSession.metadata || {};

        const defaultSettings = { temperature: 0.7, contextLength: 10 };
        const mergedSettings = { ...defaultSettings, ...metadata };

        if (mergedSettings.temperature !== undefined) {
          mergedSettings.temperature = parseFloat(mergedSettings.temperature);
        }

        console.log(`Reload session settings:`, mergedSettings);
        setSessionSettings(mergedSettings);
      } else {
        // Use current settings directly
        setSessionSettings(processedSettings);
      }

      message.success(t("settings.saveSuccess"));
    } catch (error) {
      console.error("save session settings failed:", error);
      message.error(t("settings.saveFailed") + ":" + error.message);
    }
  };

  // Handle model changes
  const handleModelChange = async (value) => {
    const [providerId, modelId] = value.split("|");

    // Update configuration
    const newConfig = { ...config, providerId, modelId };
    saveConfig(newConfig);

    // Show notification
    message.success(
      `${t("chat.modelChanged", {
        model: getModelName(providerId, modelId),
      })}`
    );
  };

  // Get all enabled providers and their models
  const getProviderModels = () => {
    const enabledProviders = getEnabledProviders();

    return enabledProviders
      .map((provider) => {
        // Ensure provider.models exists and is an array
        if (!provider.models || !Array.isArray(provider.models)) {
          console.warn(`Provider ${provider.name} does not have a valid models array`);
          return { provider, models: [] };
        }

        // Filter out enabled and non-deleted models
        const enabledModels = provider.models.filter((model) => {
          // If model doesn't have explicit enabled property or enabled is true, and not deleted, consider it available
          return model.enabled !== false && model.deleted !== true;
        });

        return {
          provider,
          models: enabledModels,
        };
      })
      .filter((item) => item.models.length > 0); // Only return providers with enabled models
  };
  const providerModels = getProviderModels();

  // Get currently selected model
  const getCurrentModel = () => {
    // First check if configuration has providerId and modelId
    if (!config.providerId || !config.modelId) return null;
    // Check if currently selected provider exists in available provider list
    const provider = providerModels.find(
      (item) => item.provider.id === config.providerId
    );
    if (!provider) return null;

    // Check if currently selected model exists in available model list
    const modelExists = provider.models.some(
      (model) => model.id === config.modelId
    );
    if (!modelExists) return null;

    // Only return complete selection value when both provider and model exist and are enabled
    return `${config.providerId}|${config.modelId}`;
  };

  // Check if currently selected model is available, if not available then select first available model
  useEffect(() => {
    // Only return when no available models
    if (providerModels.length === 0) return;

    // If user hasn't selected a model or selected model/provider is unavailable, automatically select a default model
    if (!config.providerId || !config.modelId) {
      // When user initialization has no selected model, automatically select first available model
      if (providerModels.length > 0 && providerModels[0].models.length > 0) {
        const firstProvider = providerModels[0];
        const firstModel = firstProvider.models[0];
        handleModelChange(`${firstProvider.provider.id}|${firstModel.id}`);
        console.log(`Initialization auto-selected model: ${firstModel.name}`);
      }
      return;
    }

    // Check if currently selected provider exists in available provider list
    const provider = providerModels.find(
      (item) => item.provider.id === config.providerId
    );

    // If provider doesn't exist or has no models, select first available model
    if (!provider) {
      // If there are available providers and models, select the first one
      if (providerModels.length > 0 && providerModels[0].models.length > 0) {
        const firstProvider = providerModels[0];
        const firstModel = firstProvider.models[0];
        handleModelChange(`${firstProvider.provider.id}|${firstModel.id}`);
        console.log(`Auto-selected first available model: ${firstModel.name}`);
      }
      return;
    }

    // Check if currently selected model exists in available model list
    const modelExists = provider.models.some(
      (model) => model.id === config.modelId
    );

    // If model doesn't exist, select provider's first available model
    if (!modelExists) {
      if (provider.models.length > 0) {
        const firstModel = provider.models[0];
        handleModelChange(`${provider.provider.id}|${firstModel.id}`);
        console.log(`Current model unavailable, auto-selected: ${firstModel.name}`);
      } else if (
        providerModels.length > 0 &&
        providerModels[0].models.length > 0
      ) {
        // If this provider has no available models, select first available provider's first model
        const firstProvider = providerModels[0];
        const firstModel = firstProvider.models[0];
        handleModelChange(`${firstProvider.provider.id}|${firstModel.id}`);
        console.log(`Auto-selected first available model: ${firstModel.name}`);
      }
    }
  }, [config.providerId, config.modelId, providerModels, handleModelChange]);

  return (
    <div className="chat-window">
      <div className="chat-header">
        <div className="chat-title">
          {session ? session.name : t("chat.startNewChat")}
        </div>
        <div className="chat-actions">
          <div className="model-selector">
            <Select
              value={getCurrentModel()}
              onChange={handleModelChange}
              placeholder={t("settings.modelServices")}
              style={{ width: 180 }}
              disabled={!session}
            >
              {providerModels.length > 0 ? (
                providerModels.map(({ provider, models }) => (
                  <OptGroup key={provider.id} label={provider.name}>
                    {models.map((model) => (
                      <Option
                        key={`${provider.id}|${model.id}`}
                        value={`${provider.id}|${model.id}`}
                      >
                        {model.name}
                      </Option>
                    ))}
                  </OptGroup>
                ))
              ) : (
                <Option disabled>{t("settings.noModelAvailable")}</Option>
              )}
            </Select>
          </div>

          <Tooltip title={t("settings.modelSettings")}>
            <Button
              icon={<SettingOutlined />}
              onClick={() => setSettingsVisible(true)}
              disabled={!session}
              style={{ marginLeft: 8 }}
            />
          </Tooltip>
        </div>
      </div>

      <div className="chat-messages" ref={chatContainerRef}>
        {loading ? (
          <div className="loading-container">
            <Spin tip={t("chat.loading")} />
          </div>
        ) : (
          <>
            {messages && messages.length > 0 ? (
              <div className="message-list">
                {messages.map((msg) => (
                  <MessageItem
                    key={msg.id}
                    message={msg}
                    getProviderAndModelInfo={getProviderAndModelInfo}
                    onVisibilityChange={handleMessageVisibilityChange}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-messages">
                <div className="empty-message-icon">
                  <RobotOutlined style={{ fontSize: 48, opacity: 0.5 }} />
                </div>
                <div className="empty-message-text">{t("chat.noMessages")}</div>
              </div>
            )}
            {/* Still need to keep reference element but not make it visible */}
            <div
              ref={messagesEndRef}
              style={{ height: "1px", marginBottom: "20px" }}
            />
          </>
        )}
      </div>

      <ChatInputContainer
        onSendMessage={handleSendMessage}
        isSending={isSending}
        onStopGeneration={handleStopGeneration}
      />

      <ModelSettingsModal
        visible={settingsVisible}
        onCancel={() => setSettingsVisible(false)}
        onSave={saveSessionSettings}
        initialSettings={sessionSettings}
      />
    </div>
  );
});

export default ChatWindow;
