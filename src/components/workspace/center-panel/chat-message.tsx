"use client";

import { cn } from "@/lib/utils";
import type { Message } from "@/generated/prisma/client";
import { Bot, User, Info, FileText, MessageCircleQuestion, HelpCircle } from "lucide-react";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useCallback, useMemo } from "react";
import { ToolCallsList } from "./tool-call-card";
import type { ToolCallEntry } from "@/stores/messages-store";

interface ChatMessageProps {
  message: Message;
  isStreaming?: boolean;
}

// Detect file references like [FILE: filename.ext] or [file:path/to/file]
const FILE_REF_REGEX = /\[(?:FILE|file):\s*([^\]]+)\]/g;

// Detect ASK_USER markers: [ASK_USER_CONTEXT: ...], [ASK_USER_CONFIRM: ...], [ASK_USER: ...]
const ASK_USER_REGEX = /\[ASK_USER(?:_(CONTEXT|CONFIRM))?:\s*([^\]]+)\]/g;

function parseMessageContent(content: string) {
  const parts: Array<
    | { type: "text"; content: string }
    | { type: "file_ref"; fileName: string }
    | { type: "ask_user"; question: string; askType: "CONTEXT" | "CONFIRM" }
  > = [];

  let lastIndex = 0;

  // Combine both regex matches and sort by index
  const allMatches: Array<{
    index: number;
    fullMatch: string;
    type: "file_ref" | "ask_user";
    value: string;
    askType?: "CONTEXT" | "CONFIRM";
  }> = [];

  // Reset regex state
  FILE_REF_REGEX.lastIndex = 0;
  ASK_USER_REGEX.lastIndex = 0;

  let match;
  while ((match = FILE_REF_REGEX.exec(content)) !== null) {
    allMatches.push({
      index: match.index,
      fullMatch: match[0],
      type: "file_ref",
      value: match[1].trim(),
    });
  }
  while ((match = ASK_USER_REGEX.exec(content)) !== null) {
    allMatches.push({
      index: match.index,
      fullMatch: match[0],
      type: "ask_user",
      value: match[2].trim(),
      askType: (match[1] as "CONTEXT" | "CONFIRM") || "CONTEXT",
    });
  }

  allMatches.sort((a, b) => a.index - b.index);

  for (const m of allMatches) {
    if (m.index > lastIndex) {
      parts.push({ type: "text", content: content.slice(lastIndex, m.index) });
    }

    if (m.type === "file_ref") {
      parts.push({ type: "file_ref", fileName: m.value });
    } else {
      parts.push({ type: "ask_user", question: m.value, askType: m.askType || "CONTEXT" });
    }

    lastIndex = m.index + m.fullMatch.length;
  }

  if (lastIndex < content.length) {
    parts.push({ type: "text", content: content.slice(lastIndex) });
  }

  return parts.length > 0 ? parts : [{ type: "text" as const, content }];
}

function FileChip({ fileName }: { fileName: string }) {
  const openFilePreview = useWorkspaceStore((s) => s.openFilePreview);

  const handleClick = useCallback(() => {
    openFilePreview({
      id: `file-${fileName}`,
      name: fileName,
      type: "context",
      content: "",
      filePath: fileName,
    });
  }, [fileName, openFilePreview]);

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center gap-1 rounded-md bg-primary/10 border border-primary/20 px-2 py-0.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors mx-0.5 cursor-pointer"
    >
      <FileText className="h-3 w-3" />
      {fileName}
    </button>
  );
}

function AskUserCard({ question, askType }: { question: string; askType: "CONTEXT" | "CONFIRM" }) {
  const isContext = askType === "CONTEXT";
  return (
    <div className={cn(
      "my-2 rounded-lg border p-3",
      isContext
        ? "border-red-500/30 bg-red-500/5"
        : "border-orange-500/30 bg-orange-500/5"
    )}>
      <div className="flex items-start gap-2">
        {isContext ? (
          <HelpCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
        ) : (
          <MessageCircleQuestion className="h-4 w-4 text-orange-400 mt-0.5 shrink-0" />
        )}
        <div>
          <div className={cn(
            "text-xs font-medium mb-1",
            isContext ? "text-red-400" : "text-orange-400"
          )}>
            {isContext ? "需要补充信息" : "需要确认决策"}
          </div>
          <div className="text-sm text-foreground">{question}</div>
        </div>
      </div>
    </div>
  );
}

export function ChatMessage({ message, isStreaming }: ChatMessageProps) {
  if (message.role === "system") {
    return (
      <div className="flex justify-center">
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-full px-3 py-1">
          <Info className="h-3 w-3" />
          {message.content}
        </div>
      </div>
    );
  }

  const isAgent = message.role === "agent";
  const parts = isAgent ? parseMessageContent(message.content) : null;

  // Parse toolCalls from metadata for completed agent messages
  const toolCalls = useMemo<ToolCallEntry[]>(() => {
    if (!isAgent || !message.metadata) return [];
    try {
      const meta = JSON.parse(message.metadata);
      if (Array.isArray(meta.toolCalls)) return meta.toolCalls;
    } catch { /* ignore */ }
    return [];
  }, [isAgent, message.metadata]);

  return (
    <div
      className={cn("flex gap-3", isAgent ? "justify-start" : "justify-end")}
    >
      {isAgent && (
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
          <Bot className="h-4 w-4 text-primary" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[75%] rounded-xl px-4 py-2.5 text-sm leading-relaxed",
          isAgent
            ? "bg-card border text-card-foreground"
            : "bg-primary text-primary-foreground"
        )}
      >
        {isAgent && toolCalls.length > 0 && (
          <ToolCallsList toolCalls={toolCalls} />
        )}
        <div className="whitespace-pre-wrap break-words">
          {isAgent && parts
            ? parts.map((part, i) => {
                if (part.type === "file_ref") {
                  return <FileChip key={i} fileName={part.fileName} />;
                }
                if (part.type === "ask_user") {
                  return <AskUserCard key={i} question={part.question} askType={part.askType} />;
                }
                return <span key={i}>{part.content}</span>;
              })
            : message.content}
          {isStreaming && (
            <span className="inline-block w-1.5 h-4 bg-primary animate-pulse ml-0.5 align-middle" />
          )}
        </div>
        {!isStreaming && (
          <div
            className={cn(
              "text-[10px] mt-1",
              isAgent ? "text-muted-foreground" : "text-primary-foreground/70"
            )}
          >
            {new Date(message.createdAt).toLocaleTimeString("zh-CN", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        )}
      </div>
      {!isAgent && (
        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary flex items-center justify-center">
          <User className="h-4 w-4 text-primary-foreground" />
        </div>
      )}
    </div>
  );
}
