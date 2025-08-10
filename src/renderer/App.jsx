import React, { useState, useEffect } from "react";
import {
  HashRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { Layout } from "antd";
import ChatPage from "./pages/ChatPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import "./App.css";
import { useTranslation } from "react-i18next";
import { getUserConfig } from "./hooks/useUserConfig";

const { Content } = Layout;

const App = () => {
  const { i18n } = useTranslation();

  // Load language settings from user config on app startup
  useEffect(() => {
    const userConfig = getUserConfig();
    if (userConfig.language) {
      i18n.changeLanguage(userConfig.language);
    }
  }, [i18n]);

  return (
    <Router>
      <Layout className="app-container">
        <Content className="content">
          <Routes>
            <Route path="/" element={<ChatPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Content>
      </Layout>
    </Router>
  );
};

export default App;
