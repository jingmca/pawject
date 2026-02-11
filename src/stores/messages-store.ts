import { create } from "zustand";
import type { Message } from "@/generated/prisma/client";

interface MessagesState {
  messagesByTask: Record<string, Message[]>;
  streamingContent: string;
  isStreaming: boolean;

  fetchMessages: (taskId: string) => Promise<void>;
  sendMessage: (taskId: string, content: string) => Promise<void>;
  addLocalMessage: (taskId: string, message: Message) => void;
}

export const useMessagesStore = create<MessagesState>((set, get) => ({
  messagesByTask: {},
  streamingContent: "",
  isStreaming: false,

  fetchMessages: async (taskId) => {
    const res = await fetch(`/api/messages?taskId=${taskId}`);
    const messages = await res.json();
    set({
      messagesByTask: { ...get().messagesByTask, [taskId]: messages },
    });
  },

  sendMessage: async (taskId, content) => {
    // Add user message locally
    const userMessage: Message = {
      id: `temp-${Date.now()}`,
      taskId,
      role: "user",
      content,
      metadata: null,
      createdAt: new Date(),
    };

    const current = get().messagesByTask[taskId] || [];
    set({
      messagesByTask: {
        ...get().messagesByTask,
        [taskId]: [...current, userMessage],
      },
      isStreaming: true,
      streamingContent: "",
    });

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, content }),
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n\n");

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = JSON.parse(line.slice(6));

          if (data.type === "delta") {
            accumulated += data.content;
            set({ streamingContent: accumulated });
          } else if (data.type === "done") {
            // Replace streaming with final message
            const agentMessage: Message = {
              id: data.messageId,
              taskId,
              role: "agent",
              content: accumulated,
              metadata: null,
              createdAt: new Date(),
            };

            const msgs = get().messagesByTask[taskId] || [];
            set({
              messagesByTask: {
                ...get().messagesByTask,
                [taskId]: [...msgs, agentMessage],
              },
              isStreaming: false,
              streamingContent: "",
            });
          } else if (data.type === "error") {
            set({ isStreaming: false, streamingContent: "" });
          }
        }
      }
    } catch {
      set({ isStreaming: false, streamingContent: "" });
    }
  },

  addLocalMessage: (taskId, message) => {
    const current = get().messagesByTask[taskId] || [];
    set({
      messagesByTask: {
        ...get().messagesByTask,
        [taskId]: [...current, message],
      },
    });
  },
}));
