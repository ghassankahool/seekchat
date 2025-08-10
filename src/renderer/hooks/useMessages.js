import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { message as antMessage } from "antd";
import {
  sendMessage,
  saveMessage,
  updateMessageStatus,
  updateMessageContent,
  parseMessageContent,
  createMessageContent,
} from "../services/messageService";
import {
  getUserConfig,
  getProvidersConfig,
  isAIConfigured,
} from "../hooks/useUserConfig";
import { useTranslation } from "react-i18next";
import mcpService from "../services/mcpService";
import { sendMessageToAI } from "../services/aiService";

/**
 * message management hook, for handling message sending, receiving and status management
 * @param {Object} session current session
 * @param {Object} sessionSettings Session settings including temperature etc.
 * @returns {Object} contains message related status and methods
 */
export const useMessages = (session, sessionSettings) => {
  const { t } = useTranslation();
  // ================== define status ==================
  const [messages, setMessages] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentAIMessageId, setCurrentAIMessageId] = useState(null); // track the id of the current generating ai message
  const abortControllerRef = useRef(null); // for canceling network request

  // ================== define refs ==================
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  const sessionIdRef = useRef(null);

  // use the api exposed in preload.js
  const electronAPI = window.electronAPI;

  // ================== scroll control ==================
  /**
   * Function to scroll to the bottom of the chat
   * Optimized for instant scrolling to bottom, no transition animation or unnecessary delay
   */
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "instant" });
    } else if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop =
        chatContainerRef.current.scrollHeight;
    }
  }, [messagesEndRef, chatContainerRef]);

  // ================== load messages ==================
  /**
   * load messages from database
   */
  const loadMessages = useCallback(
    async (sessionId) => {
      if (!sessionId) return;

      setLoading(true);
      try {
        const messageList = await electronAPI.getMessages(sessionId);
        const processedMessages = messageList.map((msg) => ({
          ...msg,
          parsedContent:
            typeof msg.content === "string"
              ? parseMessageContent(msg.content)
              : msg.content,
        }));
        setMessages(processedMessages);
      } catch (error) {
        console.error("Failed to load messages:", error);
        antMessage.error(t("chat.loadMessagesFailed"));
      } finally {
        setLoading(false);
      }
    },
    [electronAPI, t]
  );

  // when session changes, load messages
  useEffect(() => {
    if (session) {
      // if the session id changes, update the reference
      if (sessionIdRef.current !== session.id) {
        sessionIdRef.current = session.id;
        console.log(`switch to session: ${session.id}`);
      }
      loadMessages(session.id);
    } else {
      setMessages([]);
    }
  }, [session?.id, loadMessages]);

  // When messages are loaded, scroll to bottom
  useEffect(() => {
    if (messages.length > 0 && !loading) {
      // console.log("Messages loaded, preparing to scroll to bottom");
      // Use requestAnimationFrame to ensure DOM is updated before scrolling
      requestAnimationFrame(() => {
        scrollToBottom();
        // console.log("Scroll to bottom executed");
      });
    }
  }, [messages, loading, scrollToBottom]);

  // ================== handle message context ==================
  /**
   * get context settings
   * @param {Object} targetSession target session
   * @returns {Object} contains maxMessages and noLimit
   */
  const getContextSettings = useCallback(
    (targetSession) => {
      // default settings
      const settings = {
        maxMessages: 10, // default limit 10 messages
        noLimit: false, // default enable limit
      };

      // Prioritize sessionSettings values even if targetSession doesn't exist
      if (sessionSettings) {
        console.log(
          `Using sessionSettings: ${JSON.stringify(sessionSettings)}`
        );

        if (sessionSettings.contextLength !== undefined) {
          const contextLength = parseInt(sessionSettings.contextLength);
          console.log(
            `Using contextLength from sessionSettings: ${contextLength}`
          );

          // If contextLength is -1, it means unlimited
          if (contextLength === -1) {
            console.log("Context length is -1, setting noLimit=true");
            settings.noLimit = true;
          } else {
            console.log(`Setting maxMessages=${contextLength}`);
            settings.maxMessages = contextLength;
          }

          return settings;
        }
      } else {
        console.log("No sessionSettings provided");
      }

      // if there is no session, return default settings
      if (!targetSession) {
        console.log("No targetSession provided, using default settings");
        return settings;
      }

      try {
        if (targetSession.metadata) {
          let metadata;
          if (typeof targetSession.metadata === "string") {
            try {
              metadata = JSON.parse(targetSession.metadata);
              console.log(
                `Parsed session metadata: ${JSON.stringify(metadata)}`
              );
            } catch (e) {
              console.error("Failed to parse session metadata string:", e);
              metadata = {};
            }
          } else {
            metadata = targetSession.metadata || {};
            console.log(
              `Using session metadata object: ${JSON.stringify(metadata)}`
            );
          }

          // Check new contextLength field
          if (metadata.contextLength !== undefined) {
            const contextLength = parseInt(metadata.contextLength);
            console.log(`Using contextLength from metadata: ${contextLength}`);

            // If contextLength is -1, it means unlimited
            if (contextLength === -1) {
              console.log("Context length is -1, setting noLimit=true");
              settings.noLimit = true;
            } else {
              console.log(`Setting maxMessages=${contextLength}`);
              settings.maxMessages = contextLength;
            }
          }

          // Compatible with legacy noContextLimit field
          if (metadata.noContextLimit) {
            settings.noLimit = true;
            console.log("Using legacy noContextLimit=true");
          }
        } else {
          console.log("No metadata in session, using default settings");
        }
      } catch (error) {
        console.error("parse session metadata failed:", error);
      }

      console.log(
        `Final context settings: maxMessages=${settings.maxMessages}, noLimit=${settings.noLimit}`
      );
      return settings;
    },
    [sessionSettings]
  );

  /**
   * parse the messages need to be sent
   * @param {Array} allMessage all messages
   * @param {Object} currentSession current session
   * @returns {Array} processed messages array
   */
  const parseNeedSendMessage = useCallback(
    (allMessage, currentSession = null) => {
      // use the current session or the session in the hook
      const targetSession = currentSession || session;

      // get context settings
      const { maxMessages, noLimit } = getContextSettings(targetSession);

      console.log(
        `Context settings: maxMessages=${maxMessages}, noLimit=${noLimit}`
      );
      console.log(`Original message count: ${allMessage.length}`);

      // if there is no message, return empty array
      if (!allMessage || allMessage.length === 0) {
        return [];
      }

      const sortedMessages = [...allMessage].sort((a, b) => {
        // sort by created time
        return new Date(a.createdAt) - new Date(b.createdAt);
      });

      // collect valid messages
      let validMessages = [];

      // process each message, extract content
      for (const msg of sortedMessages) {
        // skip empty message
        if (!msg.content || msg.content === "") continue;

        // parse message content
        const parsedContent = parseMessageContent(msg.content);
        const mainContent = parsedContent.find(
          (item) => item.type === "content"
        );

        if (mainContent && mainContent.content) {
          validMessages.push({
            ...msg,
            parsedContent: mainContent.content,
          });
        }
      }

      // build the strict alternating message sequence
      let alternatingMessages = [];
      let i = 0;

      while (i < validMessages.length) {
        const currentMsg = validMessages[i];

        // if the current message is user message
        if (currentMsg.role === "user") {
          // find the next assistant message
          let nextAssistantIndex = -1;
          for (let j = i + 1; j < validMessages.length; j++) {
            if (validMessages[j].role === "assistant") {
              nextAssistantIndex = j;
              break;
            }
          }

          // If assistant message found
          if (nextAssistantIndex !== -1) {
            const assistantMsg = validMessages[nextAssistantIndex];

            // if the assistant message is not error status, add user-assistant pair
            if (assistantMsg.status !== "error") {
              alternatingMessages.push({
                role: "user",
                content: currentMsg.parsedContent,
              });

              alternatingMessages.push({
                role: "assistant",
                content: assistantMsg.parsedContent,
              });
            }
            // if the assistant message is error status, skip this pair
            else {
              console.log(
                "skip error message and its corresponding user message"
              );
            }

            // continue to process the next pair
            i = nextAssistantIndex + 1;
          }
          // if there is no corresponding assistant message, this is the last user message
          else {
            alternatingMessages.push({
              role: "user",
              content: currentMsg.parsedContent,
            });
            i++;
          }
        }
        // if the current message is assistant message, it may be a standalone message, skip it
        else {
          i++;
        }
      }

      // If no valid messages, return empty array
      if (alternatingMessages.length === 0) {
        console.log(
          "no valid alternating message pair, cannot build conversation"
        );
        return [];
      }

      // ensure the first message is user message
      if (alternatingMessages[0].role !== "user") {
        // find the first user message in the array
        const firstUserIndex = alternatingMessages.findIndex(
          (msg) => msg.role === "user"
        );
        if (firstUserIndex > 0) {
          // move to the beginning
          const firstUserMsg = alternatingMessages.splice(firstUserIndex, 1)[0];
          alternatingMessages.unshift(firstUserMsg);
          console.log("adjusted the position of the first user message");
        } else {
          console.log("no user message found, cannot adjust the first message");
        }
      }

      // Ensure the last message is a user message
      if (
        alternatingMessages.length > 0 &&
        alternatingMessages[alternatingMessages.length - 1].role !== "user"
      ) {
        // find the last user message
        for (let i = alternatingMessages.length - 2; i >= 0; i--) {
          if (alternatingMessages[i].role === "user") {
            // move to the end
            const lastUserMsg = alternatingMessages.splice(i, 1)[0];
            alternatingMessages.push(lastUserMsg);
            console.log("adjusted the position of the last user message");
            break;
          }
        }
      }

      // Apply message count limit
      if (
        !noLimit &&
        maxMessages > 0 &&
        alternatingMessages.length > maxMessages
      ) {
        console.log(
          `Message count(${alternatingMessages.length}) exceeds the limit(${maxMessages}), truncating...`
        );

        console.log(
          "Messages before truncation:",
          alternatingMessages.map((m) => ({
            role: m.role,
            content:
              typeof m.content === "string"
                ? m.content.substring(0, 20) + "..."
                : "[object]",
          }))
        );

        // ensure to keep the last user message
        const lastUserMessage =
          alternatingMessages[alternatingMessages.length - 1];

        // Truncate messages, keep recent messages
        alternatingMessages = alternatingMessages.slice(-maxMessages);

        // Ensure the first message is a user message
        if (
          alternatingMessages.length > 0 &&
          alternatingMessages[0].role !== "user"
        ) {
          // Find the first user message in the new array
          const firstUserIndex = alternatingMessages.findIndex(
            (msg) => msg.role === "user"
          );
          if (firstUserIndex > 0) {
            // Move to beginning
            const firstUserMsg = alternatingMessages.splice(
              firstUserIndex,
              1
            )[0];
            alternatingMessages.unshift(firstUserMsg);

            // If this causes the array to exceed size limit, remove one message
            if (alternatingMessages.length > maxMessages) {
              alternatingMessages.splice(1, 1);
            }
          }
        }

        console.log(
          "Messages after truncation:",
          alternatingMessages.map((m) => ({
            role: m.role,
            content:
              typeof m.content === "string"
                ? m.content.substring(0, 20) + "..."
                : "[object]",
          }))
        );
      } else {
        console.log(
          `No truncation needed (${alternatingMessages.length} messages, limit=${maxMessages}, noLimit=${noLimit})`
        );
      }

      // Special case: if limit is 1, only return the last user message
      if (maxMessages === 1) {
        const lastUserIndex = alternatingMessages.findIndex(
          (msg) => msg.role === "user"
        );
        if (lastUserIndex !== -1) {
          return [alternatingMessages[lastUserIndex]];
        }
      }

      // Final check to ensure strict alternation (except last may be user message)
      let finalMessages = [];
      let expectedRole = "user";

      for (const msg of alternatingMessages) {
        if (msg.role === expectedRole) {
          finalMessages.push(msg);
          // Switch next expected role
          expectedRole = expectedRole === "user" ? "assistant" : "user";
        }
      }

      // If last is not user message, find the last user message and add it
      if (
        finalMessages.length > 0 &&
        finalMessages[finalMessages.length - 1].role !== "user"
      ) {
        // Find the last user message
        for (let i = alternatingMessages.length - 1; i >= 0; i--) {
          if (alternatingMessages[i].role === "user") {
            finalMessages.push(alternatingMessages[i]);
            break;
          }
        }
      }

      console.log(`Final messages to send: ${finalMessages.length} messages`);
      return finalMessages;
    },
    [getContextSettings, session]
  );

  /**
   * Ensure the first message is a user message
   * @param {Array} messages Message array
   * @returns {Array} Adjusted message array
   */
  const ensureUserMessageFirst = useCallback((messages) => {
    if (messages.length > 1 && messages[0].role !== "user") {
      console.log("First is not user message, adjusting order");
      // Find the first user message
      const firstUserIndex = messages.findIndex((msg) => msg.role === "user");
      if (firstUserIndex > 0) {
        // Move the first user message to the beginning of the array
        const firstUserMsg = messages.splice(firstUserIndex, 1)[0];
        messages.unshift(firstUserMsg);
      }
    }
    return messages;
  }, []);

  // ================== Message Update ==================
  /**
   * Update AI message content and status
   * @param {Number} messageId Message ID
   * @param {String} content Message content
   * @param {String} reasoning_content Reasoning content
   * @param {String} status Message status
   * @param {Array} toolCallResults Tool call results
   */
  const updateAIMessage = useCallback(
    async (
      messageId,
      content,
      reasoning_content,
      status,
      toolCallResults = []
    ) => {
      const messageContent = [
        createMessageContent("content", content, status),
        ...(reasoning_content
          ? [
              createMessageContent(
                "reasoning_content",
                reasoning_content,
                status
              ),
            ]
          : []),
      ];

      // If tool call results exist, add them to message content
      if (toolCallResults && toolCallResults.length > 0) {
        messageContent.push(
          createMessageContent("tool_calls", toolCallResults, status)
        );

        // No longer save tool calls to database separately, but include them directly in message content
        // saveToolCalls(messageId, toolCallResults);
      }

      const updatedContent = JSON.stringify(messageContent);

      try {
        // Update message content in database
        if (status === "success" || status === "error") {
          await updateMessageContent(messageId, updatedContent, electronAPI);
          await updateMessageStatus(messageId, status, electronAPI);

          // When message status is success or error, also scroll to bottom directly
          // Use requestAnimationFrame to ensure scrolling after DOM update
          requestAnimationFrame(() => {
            scrollToBottom();
            console.log("AI message complete, scrolled to bottom");
          });
        }

        // Update local message list - use functional update to ensure always based on latest state
        setMessages((prevMessages) =>
          prevMessages.map((msg) =>
            msg.id === messageId
              ? {
                  ...msg,
                  status: status,
                  content: updatedContent,
                }
              : msg
          )
        );
      } catch (error) {
        console.error("Failed to update message content:", error);
      }
    },
    [electronAPI, scrollToBottom]
  );

  // ================== Get Latest Session ==================
  /**
   * Get latest session data
   * @param {Object} currentSession Current session
   * @returns {Promise<Object>} Latest session data
   */
  const getFreshSession = useCallback(
    async (currentSession) => {
      try {
        // If possible, get latest session information from database
        if (electronAPI && electronAPI.getSessions) {
          const sessions = await electronAPI.getSessions();
          const freshSession = sessions.find((s) => s.id === currentSession.id);
          if (freshSession) {
            console.log("Got latest session info:", freshSession.id);
            return freshSession;
          }
        }
        return currentSession;
      } catch (error) {
        console.error("Failed to get latest session info:", error);
        return currentSession;
      }
    },
    [electronAPI]
  );

  /**
   * Get temperature setting from session metadata
   * @param {Object} sessionData Session data
   * @returns {Number} Temperature value
   */
  const getTemperatureSetting = useCallback(
    (sessionData) => {
      let temperature = 0.7; // Default value

      // Prefer using passed sessionSettings
      if (sessionSettings && sessionSettings.temperature !== undefined) {
        temperature = parseFloat(sessionSettings.temperature);
        console.log(`Using passed session temperature setting: ${temperature}`);
        return temperature;
      }

      try {
        if (sessionData.metadata) {
          const metadata =
            typeof sessionData.metadata === "string"
              ? JSON.parse(sessionData.metadata)
              : sessionData.metadata;

          if (metadata.temperature !== undefined) {
            temperature = parseFloat(metadata.temperature);
            console.log(`Using session custom temperature: ${temperature}`);
          }
        }
      } catch (error) {
        console.error("Failed to parse session temperature setting:", error);
      }

      return temperature;
    },
    [sessionSettings]
  );

  // ================== Message Sending ==================
  /**
   * Create and save user message
   * @param {String} content Message content
   * @param {Object} sessionData Session data
   * @param {Object} userConfig User configuration
   * @returns {Object} Local user message object
   */
  const createUserMessage = useCallback(
    async (content, sessionData, userConfig) => {
      const userMessage = {
        sessionId: sessionData.id,
        role: "user",
        providerId: userConfig.providerId,
        modelId: userConfig.modelId,
        content: JSON.stringify([createMessageContent("content", content)]),
        status: "success",
      };

      const savedUserMessage = await saveMessage(userMessage, electronAPI);
      return {
        ...savedUserMessage,
        parsedContent: [createMessageContent("content", content)],
      };
    },
    [electronAPI]
  );

  /**
   * Create and save AI response message
   * @param {Object} sessionData Session data
   * @param {Object} userConfig User configuration
   * @returns {Object} Local AI message object and saved message ID
   */
  const createAIMessage = useCallback(
    async (sessionData, userConfig) => {
      const aiMessage = {
        sessionId: sessionData.id,
        role: "assistant",
        providerId: userConfig.providerId,
        modelId: userConfig.modelId,
        content: JSON.stringify([
          createMessageContent("content", ""),
          createMessageContent("reasoning_content", "", "pending"),
        ]),
        status: "pending",
      };

      const savedAiMessage = await saveMessage(aiMessage, electronAPI);

      // Save current AI message ID for use when stopping generation
      setCurrentAIMessageId(savedAiMessage.id);

      return {
        message: {
          ...savedAiMessage,
          parsedContent: [
            createMessageContent("content", ""),
            createMessageContent("reasoning_content", "", "pending"),
          ],
        },
        id: savedAiMessage.id,
      };
    },
    [electronAPI]
  );

  /**
   * Send message to AI service
   * @param {Object} currentSession Current session
   * @param {Array} allMessages All messages
   * @param {Number} aiMessageId AI message ID
   * @param {Number} temperature Temperature setting
   */
  const sendMessageToAI = useCallback(
    async (currentSession, allMessages, aiMessageId, temperature) => {
      try {
        console.log(
          "sendMessageToAI",
          currentSession,
          `allMessages=${allMessages.length}`,
          `aiMessageId=${aiMessageId}`,
          `temperature=${temperature}`
        );

        // Create a new AbortController for cancelling requests
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        // Apply context length limiting, get messages to send
        const messagesToSend = parseNeedSendMessage(
          allMessages,
          currentSession
        );
        console.log(
          `After context limiting, sending ${messagesToSend.length} messages to AI service`
        );

        // Get active MCP tools
        let mcpTools = [];
        try {
          mcpTools = await mcpService.getAllActiveTools();
          console.log(`Got ${mcpTools.length} active MCP tools`);
        } catch (error) {
          console.error("Failed to get MCP tools:", error);
          // Tool retrieval failure doesn't affect normal chat
        }

        // Log first two and last message to help debugging
        if (messagesToSend.length > 0) {
          console.log("First message:", {
            role: messagesToSend[0].role,
            content:
              typeof messagesToSend[0].content === "string"
                ? messagesToSend[0].content.substring(0, 50) + "..."
                : "[object]",
          });

          if (messagesToSend.length > 1) {
            console.log("Second message:", {
              role: messagesToSend[1].role,
              content:
                typeof messagesToSend[1].content === "string"
                  ? messagesToSend[1].content.substring(0, 50) + "..."
                  : "[object]",
            });
          }

          console.log("Last message:", {
            role: messagesToSend[messagesToSend.length - 1].role,
            content:
              typeof messagesToSend[messagesToSend.length - 1].content ===
              "string"
                ? messagesToSend[messagesToSend.length - 1].content.substring(
                    0,
                    50
                  ) + "..."
                : "[object]",
          });
        } else {
          console.warn("No messages to send after context limiting!");
        }

        await sendMessage(
          messagesToSend,
          currentSession,
          // Stream update callback
          (response) => {
            const content = response.content || "";
            const reasoning_content = response.reasoning_content || "";
            // Get tool call status
            const toolCallResults = response.toolCallResults || [];
            // receiving means it will be displayed in UI but not immediately updated to db
            updateAIMessage(
              aiMessageId,
              content,
              reasoning_content,
              "receiving",
              toolCallResults
            );
          },
          // Error callback
          async (error) => {
            console.log("sendMessageToAI error", error);
            // If error is caused by request abortion, ignore it (we already handled it in handleStopGeneration)
            if (error.name === "AbortError") {
              console.log("Request cancelled by user");
              return;
            }

            const errorContent = error.message || "Failed to send message";
            updateAIMessage(aiMessageId, errorContent, "", "error");

            // Clear current AI message ID
            setCurrentAIMessageId(null);
            setIsSending(false);
            abortControllerRef.current = null;
          },
          // Complete callback
          async (response) => {
            console.log("sendMessageToAI complete", response);
            const content = response.content || "";
            const reasoning_content = response.reasoning_content || "";
            const toolCallResults = response.toolCallResults || [];
            updateAIMessage(
              aiMessageId,
              content,
              reasoning_content,
              "success",
              toolCallResults
            );

            // Clear current AI message ID
            setCurrentAIMessageId(null);
            setIsSending(false);
            abortControllerRef.current = null;
          },
          // pass parameters, including AbortSignal
          {
            temperature,
            signal: abortController.signal,
            mcpTools, // Pass MCP tools
          }
        );

        // if there is a callback function, call it
        if (typeof onSendMessage === "function") {
          onSendMessage();
        }
      } catch (error) {
        // if the error is caused by user cancel request, ignore it
        if (error.name === "AbortError") {
          console.log("request cancelled by user");
          return;
        }

        // if there is an uncaught exception, also clear status
        setCurrentAIMessageId(null);
        setIsSending(false);
        abortControllerRef.current = null;
        throw error;
      }
    },
    [parseNeedSendMessage, updateAIMessage]
  );

  /**
   * handle send message - main function
   * @param {string} content Content of the message to send
   */
  const handleSendMessage = useCallback(
    async (content) => {
      if (!content) return;

      if (!session) {
        antMessage.error(t("chat.pleaseSelectOrCreateASession"));
        return;
      }

      // check if AI is configured
      if (!isAIConfigured()) {
        antMessage.error(t("chat.pleaseSelectAModel"));
        return;
      }

      // get current config and provider and model infofig and provider and model info
      const userConfig = getUserConfig();

      // Set sending status
      setIsSending(true);

      try {
        // get latest session info
        const currentSession = await getFreshSession(session);

        // create and save user message
        const localUserMessage = await createUserMessage(
          content,
          currentSession,
          userConfig
        );
        setMessages((prevMessages) => [...prevMessages, localUserMessage]);

        // create and save ai response message
        const { message: localAiMessage, id: aiMessageId } =
          await createAIMessage(currentSession, userConfig);
        setMessages((prevMessages) => [...prevMessages, localAiMessage]);
        console.log("localAiMessage", localAiMessage);

        // Scroll to bottom directly after sending message
        // Use requestAnimationFrame to ensure scrolling after DOM update
        requestAnimationFrame(() => {
          scrollToBottom();
          console.log("After sending message, scrolled to bottom");
        });

        // get temperature setting
        const temperature = getTemperatureSetting(currentSession);

        // send message to ai service
        await sendMessageToAI(
          currentSession,
          [...messages, localUserMessage],
          aiMessageId,
          temperature
        );
      } catch (error) {
        // handle error directly, not call handleSendError
        console.error("send message failed:", error);
        antMessage.error(t("chat.sendMessageFailed") + ": " + error.message);
      }
    },
    [
      session,
      messages,
      createUserMessage,
      createAIMessage,
      getFreshSession,
      getTemperatureSetting,
      t,
      scrollToBottom,
    ]
  );

  /**
   * handle stop generation operation
   * mark the current generating message as error, content is user stopped
   */
  const handleStopGeneration = useCallback(async () => {
    if (!currentAIMessageId) {
      console.log("no generating message can be stopped");
      return;
    }

    try {
      console.log(`stop generation message id: ${currentAIMessageId}`);

      // Cancel network request
      if (abortControllerRef.current) {
        console.log("abort network request");
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      // create termination message content
      const terminationContent = [
        createMessageContent(
          "content",
          t("chat.userTerminatedGeneration"),
          "error"
        ),
      ];

      // update message content and status
      await updateMessageContent(
        currentAIMessageId,
        JSON.stringify(terminationContent),
        electronAPI
      );
      await updateMessageStatus(currentAIMessageId, "error", electronAPI);

      // update local status
      setMessages((prevMessages) =>
        prevMessages.map((msg) =>
          msg.id === currentAIMessageId
            ? {
                ...msg,
                status: "error",
                content: JSON.stringify(terminationContent),
                parsedContent: terminationContent,
              }
            : msg
        )
      );

      // clear current ai message id and reset sending status
      setCurrentAIMessageId(null);
      setIsSending(false);

      // show tip
      antMessage.info(t("chat.aiGenerationTerminated"));
    } catch (error) {
      console.error("stop generation failed:", error);
      antMessage.error(t("chat.stopGenerationFailed") + error.message);

      // note: even if error, reset status
      setCurrentAIMessageId(null);
      setIsSending(false);
      abortControllerRef.current = null;
    }
  }, [
    currentAIMessageId,
    electronAPI,
    updateMessageContent,
    updateMessageStatus,
  ]);

  // ================== export interface ==================
  return {
    messages,
    isSending,
    loading,
    messagesEndRef,
    chatContainerRef,
    handleSendMessage,
    loadMessages,
    handleStopGeneration,
    scrollToBottom,
  };
};
