import { create } from "zustand";
import type { Message } from "@/generated/prisma/client";
import { useTasksStore } from "@/stores/tasks-store";
import { useAskUserStore } from "@/stores/ask-user-store";

export interface ToolCallEntry {
  tool: string;
  input: unknown;
  timestamp: number;
}

interface MessagesState {
  messagesByTask: Record<string, Message[]>;
  streamingContent: string;
  isStreaming: boolean;
  streamingTaskId: string | null;
  streamingToolCalls: ToolCallEntry[];

  fetchMessages: (taskId: string) => Promise<void>;
  sendMessage: (taskId: string, content: string) => Promise<void>;
  addLocalMessage: (taskId: string, message: Message) => void;
}

export const useMessagesStore = create<MessagesState>((set, get) => ({
  messagesByTask: {},
  streamingContent: "",
  isStreaming: false,
  streamingTaskId: null,
  streamingToolCalls: [],

  fetchMessages: async (taskId) => {
    const res = await fetch(`/api/messages?taskId=${taskId}`);
    const messages = await res.json();
    set({
      messagesByTask: { ...get().messagesByTask, [taskId]: messages },
    });
  },

  sendMessage: async (taskId, content) => {
    if (get().isStreaming) return;

    // If task was awaiting_input, remove from askUser queue
    const tasksStore = useTasksStore.getState();
    const task = tasksStore.tasks.find((t) => t.id === taskId);
    if (task?.status === "awaiting_input") {
      useAskUserStore.getState().removeQuery(taskId);
    }

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
      streamingTaskId: taskId,
      streamingToolCalls: [],
    });

    const safetyTimer = setTimeout(() => {
      if (get().isStreaming) {
        console.warn("[messages-store] Safety timeout: forcing streaming cleanup");
        set({ isStreaming: false, streamingContent: "", streamingTaskId: null, streamingToolCalls: [] });
        get().fetchMessages(taskId);
      }
    }, 120_000);

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId, content }),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No reader");

      const decoder = new TextDecoder();
      let accumulated = "";
      let buffer = "";
      let streamDone = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith("data: ")) continue;

          try {
            const data = JSON.parse(line.slice(6));

            if (data.type === "delta") {
              accumulated += data.content;
              set({ streamingContent: accumulated });
            } else if (data.type === "tool_use") {
              const toolCall: ToolCallEntry = {
                tool: data.tool,
                input: data.input,
                timestamp: Date.now(),
              };
              set({ streamingToolCalls: [...get().streamingToolCalls, toolCall] });
            } else if (data.type === "done") {
              streamDone = true;
              // Build metadata with askUser and toolCalls
              const metadataObj: Record<string, unknown> = {};
              if (data.askUser) metadataObj.askUser = data.askUser;
              if (data.toolCalls && data.toolCalls.length > 0) {
                metadataObj.toolCalls = data.toolCalls;
              }

              const agentMessage: Message = {
                id: data.messageId,
                taskId,
                role: "agent",
                content: accumulated,
                metadata: Object.keys(metadataObj).length > 0
                  ? JSON.stringify(metadataObj)
                  : null,
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
                streamingTaskId: null,
                streamingToolCalls: [],
              });

              // Sync task status change
              if (data.taskStatusChange) {
                const existingTask = tasksStore.tasks.find(
                  (t) => t.id === taskId
                );
                if (existingTask) {
                  tasksStore.updateTaskInList({
                    ...existingTask,
                    status: data.taskStatusChange,
                  });
                }

                // If awaiting_input, add to askUser store
                if (
                  data.taskStatusChange === "awaiting_input" &&
                  data.askUser
                ) {
                  useAskUserStore.getState().addQuery({
                    taskId,
                    taskName: existingTask?.name || "",
                    question: data.askUser,
                    messageId: data.messageId,
                    createdAt: new Date(),
                  });
                }
              }
            } else if (data.type === "error") {
              streamDone = true;
              set({
                isStreaming: false,
                streamingContent: "",
                streamingTaskId: null,
                streamingToolCalls: [],
              });
              get().fetchMessages(taskId);
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }

      if (!streamDone && get().isStreaming) {
        set({
          isStreaming: false,
          streamingContent: "",
          streamingTaskId: null,
          streamingToolCalls: [],
        });
        get().fetchMessages(taskId);
      }
    } catch {
      set({ isStreaming: false, streamingContent: "", streamingTaskId: null, streamingToolCalls: [] });
      get().fetchMessages(taskId);
    } finally {
      clearTimeout(safetyTimer);
      if (get().isStreaming) {
        set({
          isStreaming: false,
          streamingContent: "",
          streamingTaskId: null,
          streamingToolCalls: [],
        });
      }
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
