"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Wrench,
  ChevronDown,
  ChevronRight,
  FileText,
  Terminal,
  Search,
  FolderOpen,
  Edit3,
  Globe,
  type LucideIcon,
} from "lucide-react";
import type { ToolCallEntry } from "@/stores/messages-store";

// Tool icon mapping
const TOOL_ICONS: Record<string, LucideIcon> = {
  Read: FileText,
  Write: Edit3,
  Edit: Edit3,
  Bash: Terminal,
  Grep: Search,
  Glob: FolderOpen,
  WebFetch: Globe,
  WebSearch: Globe,
};

/**
 * Format a concise summary of tool input based on tool type.
 */
function formatToolSummary(tool: string, input: unknown): string {
  if (!input || typeof input !== "object") return "";
  const obj = input as Record<string, unknown>;

  switch (tool) {
    case "Read":
      return typeof obj.file_path === "string" ? truncatePath(obj.file_path) : "";
    case "Write":
      return typeof obj.file_path === "string" ? truncatePath(obj.file_path) : "";
    case "Edit":
      return typeof obj.file_path === "string" ? truncatePath(obj.file_path) : "";
    case "Bash":
      return typeof obj.command === "string" ? obj.command.slice(0, 60) : "";
    case "Grep":
      return typeof obj.pattern === "string"
        ? `/${obj.pattern}/${obj.path ? ` in ${truncatePath(String(obj.path))}` : ""}`
        : "";
    case "Glob":
      return typeof obj.pattern === "string" ? obj.pattern : "";
    case "WebFetch":
      return typeof obj.url === "string" ? obj.url.slice(0, 60) : "";
    case "WebSearch":
      return typeof obj.query === "string" ? obj.query.slice(0, 60) : "";
    case "Task":
      return typeof obj.description === "string" ? obj.description : "";
    default:
      return "";
  }
}

function truncatePath(p: string): string {
  const parts = p.split("/");
  if (parts.length <= 3) return p;
  return `.../${parts.slice(-2).join("/")}`;
}

interface ToolCallCardProps {
  toolCall: ToolCallEntry;
  isLatest?: boolean;
}

export function ToolCallCard({ toolCall, isLatest }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false);
  const Icon = TOOL_ICONS[toolCall.tool] || Wrench;
  const summary = formatToolSummary(toolCall.tool, toolCall.input);

  return (
    <div
      className={cn(
        "border rounded-lg text-xs transition-colors",
        isLatest
          ? "border-primary/40 bg-primary/5"
          : "border-border/50 bg-muted/30"
      )}
    >
      <button
        className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-muted/50 rounded-lg transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
        )}
        <Icon className="h-3 w-3 text-primary shrink-0" />
        <span className="font-medium text-foreground">{toolCall.tool}</span>
        {summary && (
          <span className="text-muted-foreground truncate">{summary}</span>
        )}
        {isLatest && (
          <span className="ml-auto shrink-0">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          </span>
        )}
      </button>
      {expanded && toolCall.input != null && (
        <div className="px-3 pb-2 pt-0">
          <pre className="text-[10px] text-muted-foreground bg-muted/50 rounded p-2 overflow-x-auto max-h-40 whitespace-pre-wrap break-all">
            {JSON.stringify(toolCall.input, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

interface ToolCallsListProps {
  toolCalls: ToolCallEntry[];
  streaming?: boolean;
}

/**
 * Streaming: show all tool calls with latest having pulse indicator.
 * Historical: show collapsed summary that expands to full list.
 */
export function ToolCallsList({ toolCalls, streaming }: ToolCallsListProps) {
  const [expanded, setExpanded] = useState(false);

  if (toolCalls.length === 0) return null;

  // Historical (completed) - show summary first
  if (!streaming) {
    return (
      <div className="mb-2">
        <button
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          <Wrench className="h-3 w-3" />
          <span>{toolCalls.length} tool call{toolCalls.length > 1 ? "s" : ""}</span>
        </button>
        {expanded && (
          <div className="mt-1.5 space-y-1">
            {toolCalls.map((tc, i) => (
              <ToolCallCard key={i} toolCall={tc} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // Streaming - show all with latest indicator
  return (
    <div className="space-y-1 mb-2">
      {toolCalls.map((tc, i) => (
        <ToolCallCard
          key={i}
          toolCall={tc}
          isLatest={i === toolCalls.length - 1}
        />
      ))}
    </div>
  );
}
