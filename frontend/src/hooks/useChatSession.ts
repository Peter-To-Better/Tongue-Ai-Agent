import { useState } from "react";
import { makeStreamRequest, predictAndAnalyzeTongueImage } from "../api/api";

export interface ChatEntry {
  user: "assistant" | "user";
  message: string;
  imageUrl?: string;
  toolStatus?: string;
}

export const useChatSession = () => {
  const [userId] = useState<string>(() => {
    let storedUserId = localStorage.getItem("tongue_ai_user_id");
    if (!storedUserId) {
      storedUserId = `user_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      localStorage.setItem("tongue_ai_user_id", storedUserId);
    }
    return storedUserId;
  });

  const [sessionId] = useState<string>(
    () =>
      `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  );

  const [chatLog, setChatLog] = useState<ChatEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const updateLastMessage = (updates: Partial<ChatEntry>) => {
    setChatLog((prev) => {
      const newLog = [...prev];
      const lastIndex = newLog.length - 1;
      if (lastIndex >= 0 && newLog[lastIndex].user === "assistant") {
        newLog[lastIndex] = { ...newLog[lastIndex], ...updates };
      }
      return newLog;
    });
  };

  const handleSubmit = async (
    userMessage: string,
    imageUrl: string | null
  ) => {
    if ((!userMessage.trim() && !imageUrl) || isLoading) return;

    setIsLoading(true);
    setChatLog((prev) => [
      ...prev,
      {
        user: "user" as const,
        message: userMessage || "[圖片]",
        imageUrl: imageUrl || undefined,
      },
      {
        user: "assistant" as const,
        message: "",
        toolStatus: undefined,
      },
    ]);

    try {
      let accumulatedText = "";

      if (imageUrl) {
        await predictAndAnalyzeTongueImage(
          {
            imageFile: imageUrl,
            additional_info: userMessage || undefined,
            user_id: userId,
            session_id: sessionId,
          },
          (chunk) => {
            accumulatedText += chunk;
            updateLastMessage({ message: accumulatedText });
          },
          (status) => {
            updateLastMessage({ toolStatus: status });
          },
          () => {
            setIsLoading(false);
            updateLastMessage({ toolStatus: undefined });
          },
          (error) => {
            updateLastMessage({
              message: `錯誤：${error}`,
              toolStatus: undefined,
            });
            setIsLoading(false);
          }
        );
      } else {
        await makeStreamRequest(
          {
            prompt: userMessage,
            user_id: userId,
            session_id: sessionId,
          },
          (chunk) => {
            accumulatedText += chunk;
            updateLastMessage({ message: accumulatedText });
          },
          () => {
            setIsLoading(false);
            updateLastMessage({ toolStatus: undefined });
          },
          (error) => {
            updateLastMessage({
              message: `錯誤：${error}`,
              toolStatus: undefined,
            });
            setIsLoading(false);
          }
        );
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "發生未知錯誤";
      updateLastMessage({ message: `錯誤：${message}`, toolStatus: undefined });
      setIsLoading(false);
    }
  };

  return { userId, sessionId, chatLog, isLoading, handleSubmit };
};
