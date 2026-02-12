"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Square } from "lucide-react";
import { useTasksStore } from "@/stores/tasks-store";
import { TASK_TYPE_LABELS, TASK_STATUS_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Task } from "@/generated/prisma/client";
import { toast } from "sonner";

interface TaskHeaderProps {
  task: Task;
}

const typeColors: Record<string, string> = {
  periodic: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  one_time: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  proactive: "bg-amber-500/20 text-amber-300 border-amber-500/30",
};

const statusColors: Record<string, string> = {
  running: "bg-green-500/20 text-green-300",
  completed: "bg-blue-500/20 text-blue-300",
  pending: "bg-zinc-500/20 text-zinc-300",
  awaiting_input: "bg-orange-500/20 text-orange-300",
};

export function TaskHeader({ task }: TaskHeaderProps) {
  const controlTask = useTasksStore((s) => s.controlTask);

  const handleStop = async () => {
    try {
      await controlTask(task.id, "stop");
      toast.success("任务已停止");
    } catch {
      toast.error("操作失败");
    }
  };

  return (
    <>
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold">{task.name}</h2>
          <Badge
            variant="outline"
            className={cn("text-xs", typeColors[task.type])}
          >
            {TASK_TYPE_LABELS[task.type]}
          </Badge>
          <Badge
            variant="outline"
            className={cn("text-xs border-transparent", statusColors[task.status])}
          >
            {TASK_STATUS_LABELS[task.status]}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          {task.status === "running" && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-400 hover:text-red-300"
              onClick={handleStop}
            >
              <Square className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      <Separator />
    </>
  );
}
