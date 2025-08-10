import React, { useState } from "react";
import {
  DownOutlined,
  RightOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  LoadingOutlined,
  CloseCircleOutlined,
} from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { Spin, Tag, Typography } from "antd";

const { Text, Paragraph } = Typography;

/**
 * MCP tool call component
 * @param {Object} props Component properties
 * @param {Object} props.toolCall Tool call information
 * @param {boolean} props.isCollapsed Whether collapsed
 * @returns {JSX.Element} MCP tool call component
 */
const MCPToolCall = ({ toolCall, isCollapsed = false }) => {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(isCollapsed);

  if (!toolCall) return null;

  const {
    tool_name,
    tool_id,
    parameters = {},
    result = {},
    status = "running",
  } = toolCall;

  // Enhanced JSON formatting function
  const formatJSON = (data) => {
    if (data === undefined || data === null) return "";

    try {
      // If is string, try to parse as JSON
      if (typeof data === "string") {
        try {
          const parsedData = JSON.parse(data);
          return JSON.stringify(parsedData, null, 2);
        } catch (e) {
          // Not valid JSON string, return original string directly
          return data;
        }
      }

      // Object or array, format directly
      return JSON.stringify(data, null, 2);
    } catch (e) {
      console.error("Failed to format JSON:", e);
      // If cannot process, convert to string and return
      return String(data);
    }
  };

  // Show different icons based on status
  const getStatusIcon = () => {
    switch (status) {
      case "success":
        return <CheckCircleOutlined style={{ color: "#52c41a" }} />;
      case "error":
        return <CloseCircleOutlined style={{ color: "#f5222d" }} />;
      case "running":
      default:
        return <LoadingOutlined style={{ color: "#1890ff" }} />;
    }
  };

  // Show different text based on status
  const getStatusText = () => {
    switch (status) {
      case "success":
        return <Tag color="success">{t("chat.mcpTools.executionSuccess")}</Tag>;
      case "error":
        return <Tag color="error">{t("chat.mcpTools.executionFailed")}</Tag>;
      case "running":
      default:
        return <Tag color="processing">{t("chat.mcpTools.executing")}</Tag>;
    }
  };

  const toggleExpanded = () => {
    setCollapsed(!collapsed);
  };

  return (
    <div className="mcp-tool-call">
      <div
        className="mcp-tool-call-header"
        onClick={toggleExpanded}
        style={{ cursor: "pointer" }}
      >
        {collapsed ? <RightOutlined /> : <DownOutlined />}
        <span className="mcp-tool-name">
          {t("chat.mcpTools.callMCPTool")} {getStatusIcon()}{" "}
          {tool_name || tool_id}
        </span>
        <div>{getStatusText()}</div>
      </div>

      {!collapsed && (
        <div className="mcp-tool-call-details">
          <div className="mcp-tool-parameters">
            <Text strong>{t("chat.mcpTools.parameters")}:</Text>
            <Paragraph>
              <pre>{formatJSON(parameters)}</pre>
            </Paragraph>
          </div>

          <div className="mcp-tool-result">
            <Text strong>{t("chat.mcpTools.result")}:</Text>
            {status === "running" ? (
              <div className="tool-loading">
                <Spin size="small" /> {t("chat.mcpTools.waiting")}
              </div>
            ) : (
              <Paragraph>
                <pre>{formatJSON(result)}</pre>
              </Paragraph>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MCPToolCall;
