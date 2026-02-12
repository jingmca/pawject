"use client";

import { useEffect, useRef, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMessagesStore } from "@/stores/messages-store";
import { ChatMessage } from "./chat-message";
import { ChatInput } from "./chat-input";
import type { Task } from "@/generated/prisma/client";
import { Skeleton } from "@/components/ui/skeleton";

interface ChatSessionProps {
  task: Task;
}

export function ChatSession({ task }: ChatSessionProps) {
  const { messagesByTask, fetchMessages, isStreaming, streamingTaskId, streamingContent } =
    useMessagesStore();
  const messages = messagesByTask[task.id] || [];
  const scrollRef = useRef<HTMLDivElement>(null);
  const isThisTaskStreaming = isStreaming && streamingTaskId === task.id;

  const refreshMessages = useCallback(() => {
    fetchMessages(task.id);
  }, [task.id, fetchMessages]);

  // Fetch messages on mount and when task changes
  useEffect(() => {
    refreshMessages();
  }, [refreshMessages]);

  // Poll for new messages every 10s for active tasks (periodic/long_term get scheduler updates)
  useEffect(() => {
    if (!["running", "awaiting_input"].includes(task.status)) return;
    if (isThisTaskStreaming) return;

    const interval = setInterval(() => {
      refreshMessages();
    }, 10000);

    return () => clearInterval(interval);
  }, [task.id, task.status, isThisTaskStreaming, refreshMessages]);

  // Auto-scroll on new messages or streaming
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length, streamingContent]);

  const isTaskActive = ["running", "awaiting_input"].includes(task.status);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-4 space-y-4">
          {messages.length === 0 && !isThisTaskStreaming && (
            <div className="flex justify-center py-8">
              <Skeleton className="h-16 w-64 rounded-lg" />
            </div>
          )}
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          {isThisTaskStreaming && streamingContent && (
            <ChatMessage
              message={{
                id: "streaming",
                taskId: task.id,
                role: "agent",
                content: streamingContent,
                metadata: null,
                createdAt: new Date(),
              }}
              isStreaming
            />
          )}
        </div>
      </ScrollArea>

      <ChatInput taskId={task.id} disabled={isThisTaskStreaming} />
    </div>
  );
}
