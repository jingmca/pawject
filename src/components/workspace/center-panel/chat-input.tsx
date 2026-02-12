"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";
import { useMessagesStore } from "@/stores/messages-store";
import { useTasksStore } from "@/stores/tasks-store";
import { useWorkspaceStore } from "@/stores/workspace-store";

interface ChatInputProps {
  taskId: string;
  disabled?: boolean;
}

export function ChatInput({ taskId, disabled }: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sendMessage = useMessagesStore((s) => s.sendMessage);
  const isStreaming = useMessagesStore((s) => s.isStreaming);
  const streamingTaskId = useMessagesStore((s) => s.streamingTaskId);
  const isThisTaskStreaming = isStreaming && streamingTaskId === taskId;

  const tasks = useTasksStore((s) => s.tasks);
  const selectedTaskId = useWorkspaceStore((s) => s.selectedTaskId);
  const currentTask = tasks.find((t) => t.id === selectedTaskId);

  // All tasks can receive messages - sending will resume the task if needed
  const isDisabled = disabled || false;

  const placeholder = currentTask?.status === "completed"
    ? "任务已完成，发送消息将重新启动..."
    : currentTask?.status === "awaiting_input"
      ? "Agent 在等你回复..."
      : "输入消息...";

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isDisabled || isThisTaskStreaming) return;
    setInput("");
    sendMessage(taskId, trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  return (
    <div className="border-t p-3">
      <div className="flex items-end gap-2">
        <Textarea
          ref={textareaRef}
          placeholder={placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isDisabled}
          rows={1}
          className="min-h-[40px] max-h-[120px] resize-none"
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!input.trim() || isDisabled || isThisTaskStreaming}
          className="shrink-0 h-10 w-10"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
