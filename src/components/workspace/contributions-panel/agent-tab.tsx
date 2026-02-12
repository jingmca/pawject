"use client";

import { useState, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Bot,
  Play,
  Square,
  HelpCircle,
  MessageCircleQuestion,
  CheckCircle2,
  Send,
  Loader2,
} from "lucide-react";
import { useProjectAgentStore } from "@/stores/project-agent-store";
import { cn } from "@/lib/utils";

interface AgentTabProps {
  projectId: string;
}

const STATUS_COLORS: Record<string, string> = {
  running: "bg-green-500",
  stopped: "bg-gray-400",
  crashed: "bg-red-500",
  not_started: "bg-gray-400",
};

const STATUS_LABELS: Record<string, string> = {
  running: "运行中",
  stopped: "已停止",
  crashed: "已崩溃",
  not_started: "未启动",
};

function UserTodoCard({
  todo,
  onResolve,
}: {
  todo: {
    id: string;
    type: string;
    query: string;
    suggestion: string | null;
    priority: string;
    resolved: boolean;
    taskId: string;
  };
  onResolve: (id: string, response?: string) => void;
}) {
  const [showReply, setShowReply] = useState(false);
  const [reply, setReply] = useState("");
  const isContext = todo.type === "ASK_USER_CONTEXT";

  if (todo.resolved) {
    return (
      <div className="rounded-lg border border-muted/50 p-2.5 opacity-60">
        <div className="flex items-start gap-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs text-muted-foreground line-through truncate">
              {todo.query}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border p-2.5",
        isContext
          ? "border-red-500/30 bg-red-500/5"
          : "border-orange-500/30 bg-orange-500/5"
      )}
    >
      <div className="flex items-start gap-2">
        {isContext ? (
          <HelpCircle className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" />
        ) : (
          <MessageCircleQuestion className="h-3.5 w-3.5 text-orange-400 mt-0.5 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <Badge
              variant="outline"
              className={cn(
                "text-[9px] px-1 py-0",
                isContext ? "border-red-500/30 text-red-400" : "border-orange-500/30 text-orange-400"
              )}
            >
              {isContext ? "需要信息" : "需要确认"}
            </Badge>
            <Badge
              variant="outline"
              className="text-[9px] px-1 py-0"
            >
              {todo.priority}
            </Badge>
          </div>
          <div className="text-xs text-foreground">{todo.query}</div>
          {todo.suggestion && (
            <div className="text-[10px] text-muted-foreground mt-1">
              建议: {todo.suggestion}
            </div>
          )}
        </div>
      </div>

      {showReply ? (
        <div className="mt-2 space-y-1.5">
          <Textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="输入回复..."
            rows={2}
            className="text-xs"
          />
          <div className="flex gap-1.5">
            <Button
              size="sm"
              className="h-6 text-xs flex-1"
              onClick={() => {
                onResolve(todo.id, reply);
                setShowReply(false);
                setReply("");
              }}
              disabled={!reply.trim()}
            >
              <Send className="h-3 w-3 mr-1" />
              回复
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-xs"
              onClick={() => setShowReply(false)}
            >
              取消
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-2 flex gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-xs"
            onClick={() => setShowReply(true)}
          >
            回复
          </Button>
          {!isContext && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-xs"
              onClick={() => onResolve(todo.id, "confirmed")}
            >
              确认
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function AgentTab({ projectId }: AgentTabProps) {
  const {
    agentStatus,
    userTodos,
    actionLoading,
    fetchAgentStatus,
    fetchUserTodos,
    startAgent,
    stopAgent,
    resolveUserTodo,
  } = useProjectAgentStore();

  useEffect(() => {
    fetchAgentStatus(projectId);
    fetchUserTodos(projectId);
  }, [projectId, fetchAgentStatus, fetchUserTodos]);

  // Poll agent status every 15s
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAgentStatus(projectId);
      fetchUserTodos(projectId);
    }, 15000);
    return () => clearInterval(interval);
  }, [projectId, fetchAgentStatus, fetchUserTodos]);

  const status = agentStatus?.status || "not_started";
  const isRunning = agentStatus?.running || false;
  const pendingTodos = userTodos.filter((t) => !t.resolved);
  const resolvedTodos = userTodos.filter((t) => t.resolved);

  return (
    <div className="h-full flex flex-col">
      {/* Agent Status Section */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Project Agent
          </span>
        </div>

        <div className="rounded-lg border p-3">
          <div className="flex items-center gap-2 mb-2">
            <Bot className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Agent 状态</span>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <div
              className={cn(
                "h-2 w-2 rounded-full",
                STATUS_COLORS[status] || "bg-gray-400",
                isRunning && "animate-pulse"
              )}
            />
            <span className="text-xs text-muted-foreground">
              {STATUS_LABELS[status] || status}
            </span>
            {agentStatus?.lastHeartbeat && (
              <span className="text-[10px] text-muted-foreground ml-auto">
                心跳: {new Date(agentStatus.lastHeartbeat).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>

          <div className="flex gap-2">
            {isRunning ? (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => stopAgent(projectId)}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Square className="h-3 w-3 mr-1" />
                )}
                停止
              </Button>
            ) : (
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={() => startAgent(projectId)}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : (
                  <Play className="h-3 w-3 mr-1" />
                )}
                启动
              </Button>
            )}
          </div>
        </div>
      </div>

      <Separator />

      {/* User Todos Section */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-3 pt-3 pb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            待办事项
          </span>
          {pendingTodos.length > 0 && (
            <Badge variant="destructive" className="text-[9px] px-1.5 py-0">
              {pendingTodos.length}
            </Badge>
          )}
        </div>

        <ScrollArea className="flex-1">
          <div className="px-3 pb-3 space-y-2">
            {pendingTodos.length === 0 && resolvedTodos.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-xs">
                暂无待办事项
              </div>
            ) : (
              <>
                {pendingTodos.map((todo) => (
                  <UserTodoCard
                    key={todo.id}
                    todo={todo}
                    onResolve={resolveUserTodo}
                  />
                ))}
                {resolvedTodos.length > 0 && pendingTodos.length > 0 && (
                  <Separator className="my-2" />
                )}
                {resolvedTodos.map((todo) => (
                  <UserTodoCard
                    key={todo.id}
                    todo={todo}
                    onResolve={resolveUserTodo}
                  />
                ))}
              </>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
