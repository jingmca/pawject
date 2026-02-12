"use client";

import { cn } from "@/lib/utils";
import { useWorkspaceStore } from "@/stores/workspace-store";
import type { Task } from "@/generated/prisma/client";
import { TASK_TYPE_LABELS } from "@/lib/constants";
import { Repeat, Zap, Compass } from "lucide-react";

interface TaskListItemProps {
  task: Task & { _count?: { messages: number } };
}

const statusDotColors: Record<string, string> = {
  pending: "bg-zinc-400",
  running: "bg-green-400",
  completed: "bg-blue-400",
  awaiting_input: "bg-orange-400",
};

const typeIcons: Record<string, React.ElementType> = {
  one_time: Zap,
  periodic: Repeat,
  proactive: Compass,
};

const typeIconColors: Record<string, string> = {
  one_time: "text-blue-400",
  periodic: "text-purple-400",
  proactive: "text-amber-400",
};

export function TaskListItem({ task }: TaskListItemProps) {
  const { selectedTaskId, setSelectedTaskId } = useWorkspaceStore();
  const isSelected = selectedTaskId === task.id;

  const TypeIcon = typeIcons[task.type] || Zap;
  const dotColor = statusDotColors[task.status] || "bg-zinc-400";
  const iconColor = typeIconColors[task.type] || "text-muted-foreground";

  return (
    <div
      className={cn(
        "rounded-lg px-2.5 py-2 cursor-pointer transition-colors border border-transparent flex items-center gap-2",
        isSelected
          ? "bg-accent border-accent-foreground/10"
          : "hover:bg-accent/50"
      )}
      onClick={() => setSelectedTaskId(task.id)}
    >
      {/* Status dot */}
      <span className="relative flex h-2 w-2 shrink-0">
        {(task.status === "running" || task.status === "awaiting_input") && (
          <span
            className={cn(
              "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
              dotColor
            )}
          />
        )}
        <span
          className={cn(
            "relative inline-flex rounded-full h-2 w-2",
            dotColor
          )}
        />
      </span>

      {/* Type icon */}
      <TypeIcon className={cn("h-3.5 w-3.5 shrink-0", iconColor)} />

      {/* Task name */}
      <span className="text-sm truncate flex-1">{task.name}</span>

      {/* Type label (subtle) */}
      <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:inline">
        {TASK_TYPE_LABELS[task.type] || task.type}
      </span>
    </div>
  );
}
