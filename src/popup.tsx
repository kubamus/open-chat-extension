import React, { useState, useRef, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { ChatOllama } from "@langchain/community/chat_models/ollama";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";

import "./popup.css";

interface IContext {
  url: string;
  title: string;
  selection: string | null;
  pageContent: string;
}

interface IMessage {
  id: number;
  content: string;
  role: "user" | "assistant";
  context?: IContext;
}

interface IOptions {
  isUsingWholePageHTML: boolean;
  theme: "light" | "dark";
  systemPrompt: string;
  model: string;
}

const Popup = () => {
  const [isAiResponding, setIsAiResponding] = useState(false);
  const [options, setOptions] = useState<IOptions>();
  const [messages, setMessages] = useState<IMessage[]>([]);
  const userInputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const setOptionsFunction = async (data: { options: IOptions }) => {
      const handleOptionsSave = (options: IOptions) => {
        setOptions(options);
        if (options.theme === "dark") {
          document.documentElement.style.setProperty(
            "--html-color-scheme",
            "dark"
          );
          document.documentElement.style.setProperty(
            "--background-color",
            "#333"
          );
          document.documentElement.style.setProperty("--text-color", "#fff");
          document.documentElement.style.setProperty(
            "--user-message-background-color",
            "rgb(255 255 255 / .2)"
          );
        } else {
          document.documentElement.style.setProperty(
            "--html-color-scheme",
            "light"
          );
          document.documentElement.style.setProperty(
            "--background-color",
            "#fff"
          );
          document.documentElement.style.setProperty("--text-color", "#000");
          document.documentElement.style.setProperty(
            "--user-message-background-color",
            "#f0f0f0"
          );
        }
      };
      if (data.options) {
        handleOptionsSave(data.options);
      } else {
        await fetch("defaultoptions.json").then((res) => {
          res.json().then((data) => {
            handleOptionsSave(data as IOptions);
          });
        });
      }
    };

    chrome.storage.sync.get("options", (data) => {
      setOptionsFunction(data as { options: IOptions });
    });

    const getMessagesBackup = () => {
      chrome.storage.local.get("messagesBackup", (data) => {
        if (data.messagesBackup) {
          setMessages(data.messagesBackup);
        }
      });
    };
    getMessagesBackup();
  }, []);

  async function getCurrentContext() {
    const tabs = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(
        tabs[0].id!,
        {
          id: "GET_CURRENT_CONTEXT",
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError.message);
          } else {
            resolve(response);
          }
        }
      );
    });
  }

  const createMessagesBackup = (messages: IMessage[]) => {
    chrome.storage.local.set({ messagesBackup: messages });
  };

  const processMessage = (
    message: string,
    messageId: number | null,
    currentMessages: IMessage[]
  ): { id: number; updatedMessages: IMessage[] } => {
    if (messageId === null) {
      const newMessageId = currentMessages.length;
      const updatedMessages: IMessage[] = [
        ...currentMessages,
        { id: newMessageId, content: message, role: "assistant" },
      ];
      setMessages(updatedMessages);
      createMessagesBackup(updatedMessages);
      return { id: newMessageId, updatedMessages };
    } else {
      const currentMessagesCopy = [...currentMessages];
      const messageIndex = currentMessagesCopy.findIndex(
        (message) => message.id === messageId
      );
      if (messageIndex === -1)
        return { id: -1, updatedMessages: currentMessagesCopy };
      currentMessagesCopy[messageIndex].content += message;
      setMessages(currentMessagesCopy);
      createMessagesBackup(currentMessagesCopy);
      return { id: messageId, updatedMessages: currentMessagesCopy };
    }
  };

  const clearChat = () => {
    setMessages([]);
    createMessagesBackup([]);
  };

  const handleGenerate = async () => {
    const userInput = userInputRef.current?.value;
    if (!userInput) return;

    if (userInput.startsWith("/")) {
      const command = userInput.split(" ")[0];
      if (command === "/clear") {
        clearChat();
      } else if (command === "/help" || command === "/commands") {
        alert("Available commands: /clear, /help, /commands");
      }
      userInputRef.current!.value = "";
      return;
    }
    setIsAiResponding(true);
    let context;
    try {
      context = await getCurrentContext();
    } catch (error) {
      context = null;
    }
    const newMessage: IMessage = {
      id: messages.length,
      content: userInput,
      role: "user",
    };
    if (context) {
      newMessage.context = context as IContext;
    }
    setMessages([...messages, newMessage]);
    userInputRef.current!.value = "";

    const fixedMessages = [...messages, newMessage].map((message) => {
      if (message.role === "user") {
        return new HumanMessage(
          `${message.content} ${
            message.context
              ? ` (Human is currently on page ${
                  message.context.url
                } [Page title: ${message.context.title}], ${
                  options?.isUsingWholePageHTML
                    ? `the content of this website is ${message.context.pageContent} and `
                    : null
                }the user has selected ${
                  message.context.selection
                }. You can use this information, if user is asking for something related to this. If using is asking something that you can answer without this information, you can ignore this context.)`
              : ""
          }`
        );
      } else {
        return new AIMessage(message.content);
      }
    });
    try {
      const systemMessage = options?.systemPrompt
        ? new AIMessage(options.systemPrompt)
        : null;

      if (!options?.model) {
        return alert("Please select a model from the settings page.");
      }
      const chatModel = new ChatOllama({
        model: options.model,
      });
      console.log(chatModel.model);
      const stream = await chatModel.stream(
        systemMessage ? [systemMessage, ...fixedMessages] : fixedMessages
      );
      let { id, updatedMessages } = processMessage("", null, [
        ...messages,
        newMessage,
      ]);
      for await (const output of stream) {
        processMessage(output.content.toString(), id, updatedMessages);
        messagesContainerRef.current?.scrollTo({
          top: messagesContainerRef.current?.scrollHeight,
        });
      }
    } catch (error) {
      if (error instanceof Error)
        alert("Error generating response: " + error.message);
      else alert("Error generating response: " + error);
    } finally {
      setIsAiResponding(false);
    }
  };
  return (
    <div id="wrapper" className="popup-wrapper">
      <div className="popup-header">
        <h1 className="popup-title">Popup</h1>
        <div className="popup-header-right">
          <button className="headerButton" onClick={() => clearChat()}>
            Clear Chat
          </button>
          <button
            className="headerButton"
            onClick={() => chrome.tabs.create({ url: "options.html" })}
          >
            Settings
          </button>
        </div>
      </div>
      <div
        id="messages"
        className="messages-container"
        ref={messagesContainerRef}
      >
        {messages.map((message) => (
          <div key={message.id} className={`message message--${message.role}`}>
            {message.content}
          </div>
        ))}
      </div>
      <form
        id="userControls"
        onSubmit={(e) => e.preventDefault()}
        className="user-controls"
      >
        <input
          ref={userInputRef}
          type="text"
          id="userMessage"
          className="user-input"
          disabled={isAiResponding}
        />
        <button
          id="userSendButton"
          onClick={handleGenerate}
          className="send-button"
          disabled={isAiResponding}
        >
          Send
        </button>
      </form>
    </div>
  );
};

const root = createRoot(document.getElementById("root")!);

root.render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
);
