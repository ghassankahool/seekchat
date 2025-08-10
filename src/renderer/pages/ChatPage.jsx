import React, { useState, useEffect } from "react";
import { Layout, Button, message, Tooltip, Dropdown, Menu, Badge } from "antd";
import {
  SettingOutlined,
  PlusCircleOutlined,
  MenuOutlined,
  MessageOutlined,
  FileTextOutlined,
  UserOutlined,
  CloudOutlined,
  RobotOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import SessionList from "../components/SessionList.jsx";
import ChatWindow from "../components/ChatWindow.jsx";
import { useUserConfig } from "../hooks/useUserConfig";
import "../styles/ChatPage.css";
import { useTranslation } from "react-i18next";

const { Sider, Content, Header } = Layout;
// Use the API exposed in preload.js
const electronAPI = window.electronAPI;

const ChatPage = () => {
  const { t } = useTranslation();
  const { config } = useUserConfig();
  const [sessions, setSessions] = useState([]);
  const [currentSession, setCurrentSession] = useState(null);
  const [siderCollapsed, setSiderCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const navigate = useNavigate();

  // Detect window size changes
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile && !siderCollapsed) {
        setSiderCollapsed(true);
      }
    };

    window.addEventListener("resize", handleResize);
  handleResize(); // Initial call
    return () => window.removeEventListener("resize", handleResize);
  }, [siderCollapsed]);

  // Load all sessions
  const loadSessions = async () => {
    try {
      const sessionList = await electronAPI.getSessions();
      setSessions(sessionList);

      // If there are sessions, select the first one by default
      if (sessionList.length > 0 && !currentSession) {
        setCurrentSession(sessionList[0]);
      }
    } catch (error) {
      console.error("Failed to load sessions:", error);
      message.error(t("common.loading") + t("common.failed"));
    }
  };

  // Create a new session
  const createNewSession = async (name) => {
    try {
      const sessionName = name || `${t("chat.newChat")} ${sessions.length + 1}`;
      const newSession = await electronAPI.createSession(sessionName);
      setSessions([newSession, ...sessions]);
      setCurrentSession(newSession);

      // If on mobile, automatically collapse the sidebar after creating a new session
      if (isMobile) {
        setSiderCollapsed(true);
      }

      message.success(t("chat.newChat") + t("common.success"));
    } catch (error) {
      console.error("Failed to create session:", error);
      message.error(t("chat.newChat") + t("common.failed"));
    }
  };

  // Load session list
  useEffect(() => {
    loadSessions();
  }, []);

  // Toggle sidebar visibility
  const toggleSider = () => {
    setSiderCollapsed(!siderCollapsed);
  };

  // Quickly create a new session
  const handleQuickNewSession = () => {
    createNewSession();
  };

  // Handle session deletion
  const handleDeleteSession = (sessionId) => {
    const updatedSessions = sessions.filter(
      (session) => session.id !== sessionId
    );
    setSessions(updatedSessions);

    if (currentSession && currentSession.id === sessionId) {
      setCurrentSession(updatedSessions.length > 0 ? updatedSessions[0] : null);
    }
  };

  // Update session list
  const handleSessionListUpdate = (updatedSessions) => {
    setSessions(updatedSessions);
  };

  // User menu
  const userMenu = (
    <Menu>
      <Menu.Item
        key="settings"
        icon={<SettingOutlined />}
        onClick={() => navigate("/settings")}
      >
        {t("common.settings")}
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item key="about" icon={<InfoCircleOutlined />}>
        {t("common.about")}
      </Menu.Item>
    </Menu>
  );

  return (
    <Layout className="chat-page">
      <Layout className="chat-body">
        <Sider
          width={240}
          theme="light"
          className="session-sider"
          collapsed={siderCollapsed}
          collapsedWidth={isMobile ? 0 : 0}
          trigger={null}
          collapsible
        >
          <div className="session-list-wrapper">
            <div className="sidebar-header">
              <div className="app-title">
                <RobotOutlined />
                <span>SeekChat</span>
              </div>
              <Button
                type="text"
                icon={<MenuOutlined />}
                onClick={toggleSider}
                className="sidebar-collapse-button"
                title={t("common.collapseSidebar")}
              />
            </div>
            <SessionList
              sessions={sessions}
              currentSession={currentSession}
              onSelectSession={(session) => {
                setCurrentSession(session);
                if (isMobile) {
                  setSiderCollapsed(true);
                }
              }}
              onDeleteSession={handleDeleteSession}
              onSessionListUpdate={handleSessionListUpdate}
            />
            <div className="session-list-footer">
              <Button
                type="primary"
                icon={<PlusCircleOutlined />}
                onClick={handleQuickNewSession}
                className="create-chat-button"
                block
              >
                {t("chat.newChat")}
              </Button>
              <Button  
                icon={<SettingOutlined />}
                onClick={() => navigate("/settings")}
                className="settings-button-bottom"
                block
              >
                {t("common.settings")}
              </Button>
            </div>
          </div>
        </Sider>
        <Content className="chat-content">
          {siderCollapsed && (
            <Button
              type="primary"
              icon={<MenuOutlined />}
              onClick={toggleSider}
              className="open-sidebar-button"
              title={t("common.openSidebar")}
            />
          )}
          <ChatWindow
            session={currentSession}
            onSessionUpdate={(updatedSession) => {
              setCurrentSession(updatedSession);
              setSessions(
                sessions.map((s) =>
                  s.id === updatedSession.id ? updatedSession : s
                )
              );
            }}
          />
        </Content>
      </Layout>
    </Layout>
  );
};

export default ChatPage;
