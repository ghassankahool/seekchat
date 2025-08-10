import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { ConfigProvider } from "antd";
import zhCN from "antd/lib/locale/zh_CN";
import enUS from "antd/lib/locale/en_US";
import App from "./App.jsx";
import "./index.css";
import "./i18n"; // Import i18n configuration
import { I18nextProvider, useTranslation } from "react-i18next";
import i18n from "./i18n";

// Create a wrapper component to handle language switching
const AppWrapper = () => {
  const { i18n } = useTranslation();
  const [antdLocale, setAntdLocale] = useState(
    i18n.language === "zh-CN" ? zhCN : enUS
  );

  // Listen for language changes and update Ant Design locale
  useEffect(() => {
    const handleLanguageChange = () => {
      setAntdLocale(i18n.language === "zh-CN" ? zhCN : enUS);
    };

    i18n.on("languageChanged", handleLanguageChange);
    return () => {
      i18n.off("languageChanged", handleLanguageChange);
    };
  }, [i18n]);

  return (
    <ConfigProvider locale={antdLocale}>
      <App />
    </ConfigProvider>
  );
};

// Create React root node
const root = ReactDOM.createRoot(document.getElementById("root"));

// Render the application
root.render(
  <I18nextProvider i18n={i18n}>
    <AppWrapper />
  </I18nextProvider>
);
