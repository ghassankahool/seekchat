import React, { memo, lazy } from "react";
import { Spin, Avatar, Tooltip, Button, Collapse, message } from "antd";
import { UserOutlined, RobotOutlined, CopyOutlined } from "@ant-design/icons";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import {
  parseMessageContent,
  formatMessageContent,
} from "../services/messageService";
import { useTranslation } from "react-i18next";

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

  // If not array, render content directly
  return (
    <ReactMarkdown components={renderers}>
      {typeof parsedContent === "string"
        ? parsedContent
        : formatMessageContent(parsedContent)}
    </ReactMarkdown>
  );
};

// Copy to clipboard function
const copyToClipboard = (content, t) => {
  // If is string, try to parse as JSON
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

    // Fallback solution: create temporary text area
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

// Use memo wrapper for message item component to avoid unnecessary re-renders
const MessageItem = memo(
  ({ message, getProviderAndModelInfo, onVisibilityChange }) => {
    const { t } = useTranslation();

    // Get current message AI model information
    const modelInfo =
      message.role === "assistant" && message.providerId && message.modelId
        ? getProviderAndModelInfo(message.providerId, message.modelId)
        : {
            providerName: t("settings.aiAssistant"),
            modelName: t("settings.aiAssistant"),
            logo: null,
            providerId: "",
          };

    // Handle element entering view
    React.useEffect(() => {
      // If visibility change callback is provided, call it
      if (onVisibilityChange && typeof onVisibilityChange === "function") {
        const observer = new IntersectionObserver(
          ([entry]) => {
            if (entry.isIntersecting) {
              onVisibilityChange(message.id, true);
            } else {
              onVisibilityChange(message.id, false);
            }
          },
          { threshold: 0.5 }
        );

        // Current component DOM reference
        const element = document.getElementById(`message-${message.id}`);
        if (element) {
          observer.observe(element);
        }

        return () => {
          if (element) {
            observer.unobserve(element);
          }
        };
      }
    }, [message.id, onVisibilityChange]);

    return (
      <div
        id={`message-${message.id}`}
        className={`message-item ${
          message.role === "user" ? "user-message" : "ai-message"
        }`}
      >
        <div className="message-avatar">
          {message.role === "user" ? (
            <Avatar icon={<UserOutlined />} className="user-avatar" />
          ) : (
            <div className="ai-avatar">
              {modelInfo.logo ? (
                <img
                  src={modelInfo.logo}
                  alt={modelInfo.providerName}
                  onError={(e) => {
                    e.target.style.display = "none";
                    e.target.parentNode.querySelector(
                      ".anticon"
                    ).style.display = "block";
                  }}
                />
              ) : null}
              <RobotOutlined
                style={{
                  display: modelInfo.logo ? "none" : "block",
                }}
              />
            </div>
          )}
        </div>
        <div className="message-content">
          <div className="message-header">
            <span className="message-sender">
              {message.role === "user" ? t("common.user") : modelInfo.modelName}
            </span>
            {message.role === "assistant" &&
              modelInfo.providerName !== t("common.aiAssistant") && (
                <span className="message-provider">
                  {modelInfo.providerName}
                </span>
              )}
            <span className="message-time">
              {new Date(message.createdAt).toLocaleString("zh-CN", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              })}
            </span>
          </div>
          <div className="message-text">
            {message.status === "pending" &&
            (!message.content ||
              (typeof message.content === "string" &&
                JSON.parse(message.content).find(
                  (item) => item.type === "content"
                )?.content === "")) ? (
              <Spin size="small" />
            ) : (
              <MessageContent content={message.content} />
            )}

            <div className="message-footer">
              <Tooltip title={t("chat.copyMessage")}>
                <Button
                  type="text"
                  icon={<CopyOutlined />}
                  size="small"
                  onClick={() => copyToClipboard(message.content, t)}
                  className="copy-button"
                />
              </Tooltip>
            </div>
          </div>
        </div>
      </div>
    );
  },
  // Custom comparison function, only re-render when message content or status changes
  (prevProps, nextProps) => {
    // Check if ID is the same
    if (prevProps.message.id !== nextProps.message.id) {
      return false; // Different message, needs re-render
    }

    // Check if status changes
    if (prevProps.message.status !== nextProps.message.status) {
      return false; // Status changed, needs re-render
    }

    // Check if content changes
    if (prevProps.message.content !== nextProps.message.content) {
      return false; // Content changed, needs re-render
    }

    // Other properties haven't changed, no need to re-render
    return true;
  }
);

export default MessageItem;
