import React, { useState, useEffect } from "react";
import {
  Button,
  Tooltip,
  Modal,
  Select,
  Form,
  Input,
  List,
  Space,
  Typography,
  Collapse,
  Tag,
  Spin,
  Alert,
  Switch,
  Divider,
} from "antd";
import {
  ToolOutlined,
  QuestionCircleOutlined,
  ApiOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import mcpService from "../services/mcpService";

const { Option } = Select;
const { Text, Title, Paragraph } = Typography;
const { Panel } = Collapse;

/**
 * MCP tools button component
 * @param {Function} onToolUse Tool usage callback
 * @returns {JSX.Element}
 */
const MCPToolsButton = ({ onToolUse }) => {
  const { t } = useTranslation();
  const [modalVisible, setModalVisible] = useState(false);
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTool, setSelectedTool] = useState(null);
  const [parameterValues, setParameterValues] = useState({});
  const [form] = Form.useForm();
  const [executing, setExecuting] = useState(false);
  const [addToPrompt, setAddToPrompt] = useState(true);
  const [result, setResult] = useState(null);

  // Load active MCP tools
  const loadTools = async () => {
    try {
      setLoading(true);
      const activeTools = await mcpService.getAllActiveTools();
      setTools(activeTools);
    } catch (error) {
      console.error("Failed to load MCP tools:", error);
    } finally {
      setLoading(false);
    }
  };

  // Load tools when component mounts or modal shows
  useEffect(() => {
    if (modalVisible) {
      loadTools();
    }
  }, [modalVisible]);

  // Open modal
  const handleOpenModal = () => {
    setModalVisible(true);
  };

  // Close modal
  const handleCloseModal = () => {
    setModalVisible(false);
    setSelectedTool(null);
    setParameterValues({});
    setResult(null);
    form.resetFields();
  };

  // Select tool
  const handleSelectTool = (toolInfo) => {
    setSelectedTool(toolInfo);
    setParameterValues({});
    form.resetFields();
    setResult(null);
  };

  // Execute tool
  const handleExecuteTool = async () => {
    try {
      await form.validateFields();

      setExecuting(true);
      setResult(null);

      // Ensure parameter format is correct
      let processedParams = {};

      // Process parameter values according to parameter types
      if (selectedTool.parameters && selectedTool.parameters.properties) {
        const { properties } = selectedTool.parameters;

        Object.entries(parameterValues).forEach(([key, value]) => {
          const paramDef = properties[key];
          if (paramDef) {
            // Convert value according to parameter type
            if (paramDef.type === "number" || paramDef.type === "integer") {
              processedParams[key] = Number(value);
            } else if (paramDef.type === "boolean") {
              processedParams[key] = Boolean(value);
            } else {
              processedParams[key] = value;
            }
          } else {
            // If parameter definition not found, keep original value
            processedParams[key] = value;
          }
        });
      } else {
        processedParams = { ...parameterValues };
      }

      console.log(
        `Execute tool ${selectedTool.name} (${selectedTool.id}) parameters:`,
        processedParams
      );

      const result = await mcpService.callTool(
        selectedTool.serverId,
        selectedTool.id,
        processedParams
      );

      console.log(`Tool ${selectedTool.name} execution result:`, result);
      setResult(result);

      // If operation successful and needs to add to prompt, call callback function
      if (result.success && addToPrompt && onToolUse) {
        const toolName = selectedTool.name;
        const serverName = selectedTool.serverName;
        const params = JSON.stringify(processedParams, null, 2);
        const resultContent = JSON.stringify(result.result, null, 2);

        const toolPrompt = `Tool "${toolName}" (from "${serverName}") execution result:\nInput parameters:\n\`\`\`json\n${params}\n\`\`\`\nOutput result:\n\`\`\`json\n${resultContent}\n\`\`\``;

        onToolUse(toolPrompt);
        handleCloseModal();
      }
    } catch (error) {
      console.error("Failed to execute tool:", error);
      setResult({
        success: false,
        message: `Failed to execute tool: ${error.message}`,
        result: null,
      });
    } finally {
      setExecuting(false);
    }
  };

  // Get tool parameters form
  const getToolParametersForm = () => {
    if (!selectedTool || !selectedTool.parameters) return null;

    const { parameters } = selectedTool;
    const { properties, required = [] } = parameters;

    if (!properties) return null;

    return (
      <Form
        form={form}
        layout="vertical"
        onValuesChange={(changedValues) => {
          setParameterValues({ ...parameterValues, ...changedValues });
        }}
      >
        {Object.entries(properties).map(([key, value]) => {
          const isRequired = required.includes(key);

          return (
            <Form.Item
              key={key}
              name={key}
              label={
                <Space>
                  {key}
                  {value.description && (
                    <Tooltip title={value.description}>
                      <QuestionCircleOutlined />
                    </Tooltip>
                  )}
                </Space>
              }
              rules={[
                {
                  required: isRequired,
                  message: t("chat.mcpTools.parameterRequired"),
                },
              ]}
            >
              {renderInputByType(key, value)}
            </Form.Item>
          );
        })}
      </Form>
    );
  };

  // Render input component based on parameter type
  const renderInputByType = (key, param) => {
    switch (param.type) {
      case "string":
        if (param.enum && Array.isArray(param.enum)) {
          return (
            <Select placeholder={t("chat.mcpTools.selectOption")}>
              {param.enum.map((option) => (
                <Option key={option} value={option}>
                  {option}
                </Option>
              ))}
            </Select>
          );
        }
        return <Input placeholder={param.description || key} />;

      case "number":
      case "integer":
        return <Input type="number" placeholder={param.description || key} />;

      case "boolean":
        return <Switch checkedChildren="True" unCheckedChildren="False" />;

      default:
        return <Input placeholder={param.description || key} />;
    }
  };

  return (
    <>
      <Tooltip title={t("chat.mcpTools.useMCPTools")}>
        <Button
          type="text"
          icon={<ToolOutlined />}
          onClick={handleOpenModal}
          className="mcp-tools-button"
        />
      </Tooltip>

      <Modal
        title={
          <Space>
            <ToolOutlined />
            {t("chat.mcpTools.mcpTools")}
          </Space>
        }
        open={modalVisible}
        onCancel={handleCloseModal}
        footer={
          selectedTool
            ? [
                <Button key="back" onClick={() => setSelectedTool(null)}>
                  {t("common.back")}
                </Button>,
                <Button
                  key="execute"
                  type="primary"
                  onClick={handleExecuteTool}
                  loading={executing}
                >
                  {t("chat.mcpTools.executeTool")}
                </Button>,
              ]
            : null
        }
        width={700}
      >
        {loading ? (
          <div style={{ textAlign: "center", padding: "20px" }}>
            <Spin tip={t("chat.mcpTools.loadingTools")} />
          </div>
        ) : tools.length === 0 ? (
          <Alert
            message={t("chat.mcpTools.noToolsAvailable")}
            description={t("chat.mcpTools.noToolsDescription")}
            type="info"
            showIcon
          />
        ) : selectedTool ? (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Title level={4}>
                {selectedTool.name}
                <Tag color="blue" style={{ marginLeft: 8 }}>
                  {selectedTool.serverName}
                </Tag>
              </Title>
              <Paragraph>{selectedTool.description}</Paragraph>
            </div>

            <Divider orientation="left">
              {t("chat.mcpTools.parameters")}
            </Divider>
            {getToolParametersForm()}

            {result && (
              <>
                <Divider orientation="left">
                  {t("chat.mcpTools.result")}
                </Divider>
                <Alert
                  message={
                    result.success
                      ? t("chat.mcpTools.executionSuccess")
                      : t("chat.mcpTools.executionFailed")
                  }
                  description={result.message}
                  type={result.success ? "success" : "error"}
                  showIcon
                  style={{ marginBottom: 16 }}
                />

                {result.success && result.result && (
                  <Collapse defaultActiveKey={["1"]}>
                    <Panel header={t("chat.mcpTools.resultData")} key="1">
                      <pre style={{ maxHeight: 300, overflow: "auto" }}>
                        {JSON.stringify(result.result, null, 2)}
                      </pre>
                    </Panel>
                  </Collapse>
                )}
              </>
            )}

            <Divider />

            <Form.Item>
              <Space align="baseline">
                <Switch checked={addToPrompt} onChange={setAddToPrompt} />
                <Text>{t("chat.mcpTools.addToPrompt")}</Text>
                <Tooltip title={t("chat.mcpTools.addToPromptTooltip")}>
                  <QuestionCircleOutlined />
                </Tooltip>
              </Space>
            </Form.Item>
          </div>
        ) : (
          <List
            dataSource={tools}
            renderItem={(tool) => (
              <List.Item
                key={`${tool.serverId}-${tool.id}`}
                actions={[
                  <Button
                    key="use"
                    type="primary"
                    icon={<ThunderboltOutlined />}
                    onClick={() => handleSelectTool(tool)}
                  >
                    {t("chat.mcpTools.useTool")}
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  avatar={<ApiOutlined style={{ fontSize: 24 }} />}
                  title={
                    <Space>
                      <Text strong>{tool.name}</Text>
                      <Tag color="blue">{tool.serverName}</Tag>
                    </Space>
                  }
                  description={
                    tool.description || t("settings.noToolDescription")
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Modal>
    </>
  );
};

export default MCPToolsButton;
