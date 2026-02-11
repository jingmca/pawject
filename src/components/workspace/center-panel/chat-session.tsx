"use client";

import { useEffect, useRef } from "react";
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
  const { messagesByTask, fetchMessages, isStreaming, streamingContent } =
    useMessagesStore();
  const messages = messagesByTask[task.id] || [];
  const scrollRef = useRef<HTMLDivElement>(null);
  const loadedRef = useRef<string | null>(null);

  useEffect(() => {
    if (loadedRef.current !== task.id) {
      loadedRef.current = task.id;
      fetchMessages(task.id);
    }
  }, [task.id, fetchMessages]);

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
          {messages.length === 0 && !isStreaming && (
            <div className="flex justify-center py-8">
              <Skeleton className="h-16 w-64 rounded-lg" />
            </div>
          )}
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          {isStreaming && streamingContent && (
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

      <ChatInput taskId={task.id} disabled={!isTaskActive || isStreaming} />
    </div>
  );
}
