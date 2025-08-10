import React, { useState, useEffect } from "react";
import { Input, Button, Tooltip } from "antd";
import { SendOutlined, StopOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";

const { TextArea } = Input;

/**
 * Chat input container component
 * Independently manages input state, avoiding re-rendering of entire chat interface during input
 *
 * @param {Object} props Component properties
 * @param {Function} props.onSendMessage Send message callback
 * @param {Boolean} props.isSending Whether sending
 * @param {Function} props.onStopGeneration Stop generation callback
 * @returns {JSX.Element} Chat input component
 */
const ChatInputContainer = React.memo(
  ({ onSendMessage, isSending, onStopGeneration }) => {
    const [inputValue, setInputValue] = useState("");
    const [isComposing, setIsComposing] = useState(false);
    const { t } = useTranslation();

    const handleSend = () => {
      if (!inputValue.trim()) return;
      onSendMessage(inputValue.trim());
      setInputValue(""); // Clear input
    };

    // Listen to input method editing status
    const handleCompositionStart = () => {
      setIsComposing(true);
    };

    const handleCompositionEnd = () => {
      setIsComposing(false);
    };

    const handleKeyDown = (e) => {
      // If using input method, don't handle Enter key
      if (isComposing) return;

      // Normal Enter sends message (but not during input method editing)
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    };

    return (
      <div className="chat-input-container">
        <div className="input-wrapper">
          <TextArea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            placeholder={t("chat.typing")}
            autoSize={{ minRows: 1, maxRows: 5 }}
            disabled={isSending}
          />
          <div className="input-actions">
            {isSending ? (
              <Button
                type="primary"
                danger
                icon={<StopOutlined />}
                onClick={onStopGeneration}
                className="stop-button"
              >
                {t("chat.stop")}
              </Button>
            ) : (
              <>
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={handleSend}
                  disabled={!inputValue.trim()}
                  className="send-button"
                >
                  {t("chat.send")}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }
);

export default ChatInputContainer;
