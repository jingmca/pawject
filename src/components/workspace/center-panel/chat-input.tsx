"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";
import { useMessagesStore } from "@/stores/messages-store";

interface ChatInputProps {
  taskId: string;
  disabled?: boolean;
}

export function ChatInput({ taskId, disabled }: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sendMessage = useMessagesStore((s) => s.sendMessage);
  const isStreaming = useMessagesStore((s) => s.isStreaming);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || disabled || isStreaming) return;
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
          placeholder={
            disabled ? "任务未在运行中..." : "输入消息..."
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
          className="min-h-[40px] max-h-[120px] resize-none"
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!input.trim() || disabled || isStreaming}
          className="shrink-0 h-10 w-10"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
