import React, { memo } from "react";
import { Avatar, Tooltip } from "antd";
import { UserOutlined, RobotOutlined, CopyOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { message as antMessage } from "antd";

// Message content component
const MessageContent = ({ content }) => {
  const { t } = useTranslation();

  // If content is string, try to parse as JSON
  let parsedContent = content;
  if (typeof content === "string") {
    try {
      parsedContent = JSON.parse(content);
    } catch (error) {
      // If parsing fails, use original content
      parsedContent = [{ type: "content", content }];
    }
  }

  // Function to copy code to clipboard
  const copyCodeToClipboard = (code) => {
    navigator.clipboard
      .writeText(code)
      .then(() => {
        antMessage.success(t("chat.codeCopied"));
      })
      .catch((err) => {
        console.error("Failed to copy code:", err);
        antMessage.error(t("chat.copyFailed"));
      });
  };

  // Handle link click events, open in external browser
  const handleLinkClick = (href, event) => {
    event.preventDefault();

    // Use electronAPI to open link in browser
    window.electronAPI.openExternalURL(href).catch((err) => {
      console.error(t("about.openLinkFailed"), err);
      antMessage.error(`${t("about.openLinkFailed")} ${err.message}`);
    });
  };

  // Render Markdown content, focusing on code blocks
  const components = {
    code({ node, inline, className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || "");
      const language = match ? match[1] : "";
      const code = String(children).replace(/\n$/, "");

      return !inline && match ? (
        <div className="code-block-wrapper">
          <div className="code-block-header">
            <span className="code-language">{language}</span>
            <Tooltip title={t("chat.copyCode")}>
              <button
                className="copy-code-button"
                onClick={() => copyCodeToClipboard(code)}
              >
                <CopyOutlined />
              </button>
            </Tooltip>
          </div>
          <SyntaxHighlighter
            style={vscDarkPlus}
            language={language}
            PreTag="div"
            {...props}
          >
            {code}
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

  // Main content
  const mainContent = parsedContent.find((item) => item.type === "content");
  const reasoningContent = parsedContent.find(
    (item) => item.type === "reasoning_content"
  );
  const toolCallsContent = parsedContent.find(
    (item) => item.type === "tool_calls"
  );

  const status =
    mainContent && mainContent.status
      ? mainContent.status
      : reasoningContent && reasoningContent.status
      ? reasoningContent.status
      : "success";

  return (
    <div>
      {/* Render main content */}
      {mainContent && mainContent.content && (
        <div
          className={`message-text ${
            status === "error" ? "error-message" : ""
          }`}
        >
          <ReactMarkdown components={components}>
            {mainContent.content}
          </ReactMarkdown>
        </div>
      )}

      {/* Render reasoning content (if any) */}
      {reasoningContent && reasoningContent.content && (
        <div
          className={`reasoning-content ${
            reasoningContent.status ? reasoningContent.status : ""
          }`}
        >
          <ReactMarkdown components={components}>
            {reasoningContent.content}
          </ReactMarkdown>
        </div>
      )}

      {/* Render tool call results (if any) */}
      {toolCallsContent && toolCallsContent.content && (
        <div className="tool-calls-content">
          {Array.isArray(toolCallsContent.content) ? (
            toolCallsContent.content.map((toolCall, index) => (
              <div key={index} className="tool-call-item">
                <div className="tool-call-name">
                  Tool: {toolCall.name || "Unknown tool"}
                </div>
                <div className="tool-call-result">
                  <ReactMarkdown components={components}>
                    {toolCall.result || "No result"}
                  </ReactMarkdown>
                </div>
              </div>
            ))
          ) : (
            <div>No tool call results</div>
          )}
        </div>
      )}
    </div>
  );
};

// Copy message content to clipboard
const copyToClipboard = (content, t) => {
  // Extract plain text content
  let textContent = "";

  if (typeof content === "string") {
    try {
      const parsed = JSON.parse(content);
      const mainContent = parsed.find((item) => item.type === "content");
      if (mainContent && mainContent.content) {
        textContent = mainContent.content;
      }
    } catch (error) {
      textContent = content;
    }
  } else if (Array.isArray(content)) {
    const mainContent = content.find((item) => item.type === "content");
    if (mainContent && mainContent.content) {
      textContent = mainContent.content;
    }
  }

  // Copy to clipboard
  navigator.clipboard
    .writeText(textContent)
    .then(() => {
      antMessage.success(t("chat.messageCopied"));
    })
    .catch((err) => {
      console.error("Copy failed:", err);
      antMessage.error(t("chat.copyFailed"));
    });
};

// Message item component - use memo to optimize rendering performance
const MessageItem = memo(({ message, style, getProviderAndModelInfo, t }) => {
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

  return (
    <div
      style={style} // This style property is the positioning style provided by virtual list
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
                  e.target.parentNode.querySelector(".anticon").style.display =
                    "block";
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
          <div className="message-sender">
            {message.role === "user"
              ? t("chat.you")
              : modelInfo.providerName
              ? `${modelInfo.providerName} - ${modelInfo.modelName}`
              : t("settings.aiAssistant")}
          </div>
          <div className="message-time">
            {new Date(message.createdAt).toLocaleString()}
          </div>
        </div>
        <MessageContent content={message.parsedContent || message.content} />
        <div className="message-footer">
          <Tooltip title={t("chat.copyMessage")}>
            <button
              className="copy-button"
              onClick={() =>
                copyToClipboard(message.parsedContent || message.content, t)
              }
            >
              <CopyOutlined /> {t("chat.copy")}
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
});

export default MessageItem;
