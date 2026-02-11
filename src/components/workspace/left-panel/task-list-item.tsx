"use client";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useWorkspaceStore } from "@/stores/workspace-store";
import type { Task } from "@/generated/prisma/client";
import { TASK_TYPE_LABELS, TASK_STATUS_LABELS } from "@/lib/constants";

interface TaskListItemProps {
  task: Task & { _count?: { messages: number } };
}

const typeColors: Record<string, string> = {
  periodic: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  one_time: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  long_term: "bg-amber-500/20 text-amber-300 border-amber-500/30",
};

const statusColors: Record<string, string> = {
  running: "bg-green-500/20 text-green-300",
  paused: "bg-yellow-500/20 text-yellow-300",
  stopped: "bg-red-500/20 text-red-300",
  completed: "bg-green-500/20 text-green-300",
  pending: "bg-zinc-500/20 text-zinc-300",
  error: "bg-red-500/20 text-red-300",
  awaiting_input: "bg-orange-500/20 text-orange-300",
};

export function TaskListItem({ task }: TaskListItemProps) {
  const { selectedTaskId, setSelectedTaskId } = useWorkspaceStore();
  const isSelected = selectedTaskId === task.id;

  return (
    <div
      className={cn(
        "rounded-lg p-2.5 cursor-pointer transition-colors border border-transparent",
        isSelected
          ? "bg-accent border-accent-foreground/10"
          : "hover:bg-accent/50"
      )}
      onClick={() => setSelectedTaskId(task.id)}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium truncate flex-1">
          {task.name}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {(task.status === "running" || task.status === "awaiting_input") && (
            <span className="relative flex h-2 w-2">
              <span
                className={cn(
                  "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                  task.status === "running"
                    ? "bg-green-400"
                    : "bg-orange-400"
                )}
              />
              <span
                className={cn(
                  "relative inline-flex rounded-full h-2 w-2",
                  task.status === "running"
                    ? "bg-green-400"
                    : "bg-orange-400"
                )}
              />
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 mt-1.5">
        <Badge
          variant="outline"
          className={cn("text-[10px] px-1.5 py-0", typeColors[task.type])}
        >
          {TASK_TYPE_LABELS[task.type] || task.type}
        </Badge>
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] px-1.5 py-0 border-transparent",
            statusColors[task.status]
          )}
        >
          {TASK_STATUS_LABELS[task.status] || task.status}
        </Badge>
      </div>
    </div>
  );
}
