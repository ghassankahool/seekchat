import React, { useState } from "react";
import {
  List,
  Button,
  Input,
  Modal,
  Popconfirm,
  Tooltip,
  Empty,
  Badge,
  message,
  Menu,
  Dropdown,
} from "antd";
import {
  MessageOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  RobotOutlined,
  SearchOutlined,
  SortAscendingOutlined,
  MoreOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
} from "@ant-design/icons";
import "../styles/SessionList.css";
import { useTranslation } from "react-i18next";

// Use API exposed in preload.js
const electronAPI = window.electronAPI;

const SessionList = ({
  sessions,
  currentSession,
  onSelectSession,
  onDeleteSession,
  onSessionListUpdate,
}) => {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState("");
  const [sessionName, setSessionName] = useState("");
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingSession, setEditingSession] = useState(null);

  // Filter session list
  const filteredSessions = sessions.filter((session) =>
    session.name.toLowerCase().includes(searchText.toLowerCase())
  );

  // Confirm deletion
  const confirmDelete = (sessionId, sessionName) => {
    Modal.confirm({
      title: t("chat.clearChatConfirm", { sessionName }),
      icon: <ExclamationCircleOutlined />,
      okType: "danger",
      content: t("chat.clearChatConfirmContent"),

      okText: t("common.delete"),
      cancelText: t("common.cancel"),
      onOk() {
        handleDeleteSession(sessionId);
      },
    });
  };

  // Delete session
  const handleDeleteSession = async (sessionId) => {
    try {
      await electronAPI.deleteSession(sessionId);
      // After deleting session, delete corresponding messages
      await electronAPI.deleteMessages(sessionId);

      // Refresh session list
      const sessionList = await electronAPI.getSessions();
      if (typeof onSessionListUpdate === "function") {
        onSessionListUpdate(sessionList);
      }

      // Notify parent component
      if (typeof onDeleteSession === "function") {
        onDeleteSession(sessionId);
      }

      message.success(t("chat.deleteChat") + t("common.success"));
    } catch (error) {
      console.error("Failed to delete session:", error);
      message.error(t("chat.deleteChat") + t("common.failed"));
    }
  };

  // Open rename modal
  const showRenameModal = (session) => {
    setEditingSession(session);
    setSessionName(session.name);
    setIsModalVisible(true);
  };

  // Save session name
  const handleRenameSession = async () => {
    if (!editingSession || !sessionName.trim()) return;

    try {
      await electronAPI.updateSessionName(
        editingSession.id,
        sessionName.trim()
      );

      // Directly reload all sessions to ensure list update
      const sessionList = await electronAPI.getSessions();

      // Update session list
      if (typeof onSessionListUpdate === "function") {
        onSessionListUpdate(sessionList);
      }

      // Notify parent component to update current session (if renaming current session)
      if (
        typeof onSelectSession === "function" &&
        currentSession &&
        currentSession.id === editingSession.id
      ) {
        const updatedSession = sessionList.find(
          (s) => s.id === currentSession.id
        );
        if (updatedSession) {
          onSelectSession(updatedSession);
        }
      }

      message.success(t("chat.renameChat") + t("common.success"));
      setIsModalVisible(false);
      setEditingSession(null);
    } catch (error) {
      console.error("Failed to rename session:", error);
      message.error(t("chat.renameChat") + t("common.failed"));
    }
  };

  // Render session item more actions menu
  const getSessionMenu = (session) => (
    <Menu>
      <Menu.Item
        key="rename"
        icon={<EditOutlined />}
        onClick={() => showRenameModal(session)}
      >
        {t("chat.renameChat")}
      </Menu.Item>
      <Menu.Item
        key="delete"
        icon={<DeleteOutlined />}
        onClick={() => confirmDelete(session.id, session.name)}
        danger
      >
        {t("chat.deleteChat")}
      </Menu.Item>
    </Menu>
  );

  return (
    <div className="session-list-container">
      <div className="session-list-header">
        <h3>{t("chat.newChat")}</h3>
      </div>

      <div className="session-search">
        <Input
          placeholder={t("common.search") + "..."}
          prefix={<SearchOutlined className="search-icon" />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
      </div>

      <div className="session-list">
        {filteredSessions.length === 0 ? (
          <div className="empty-session-list">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={t("chat.noMessages")}
            />
          </div>
        ) : (
          filteredSessions.map((session) => (
            <div
              key={session.id}
              className={`session-item ${
                currentSession && currentSession.id === session.id
                  ? "active"
                  : ""
              }`}
              onClick={() => onSelectSession(session)}
            >
              <div className="session-item-content">
                <div className="session-icon">
                  <MessageOutlined />
                </div>
                <div className="session-details">
                  <h4 className="session-name">{session.name}</h4>
                  <p className="session-time">
                    {new Date(session.updatedAt).toLocaleString()}
                  </p>
                </div>
                <Dropdown
                  overlay={getSessionMenu(session)}
                  trigger={["click"]}
                  placement="bottomRight"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    type="text"
                    icon={<MoreOutlined />}
                    className="session-action-button"
                    onClick={(e) => e.stopPropagation()}
                  />
                </Dropdown>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Rename session modal */}
      <Modal
        title={t("chat.renameChat")}
        open={isModalVisible}
        onOk={handleRenameSession}
        onCancel={() => {
          setIsModalVisible(false);
          setEditingSession(null);
        }}
        okText={t("common.save")}
        cancelText={t("common.cancel")}
      >
        <Input
          value={sessionName}
          onChange={(e) => setSessionName(e.target.value)}
          placeholder={t("chat.enterChatName")}
          autoFocus
        />
      </Modal>
    </div>
  );
};

export default SessionList;
