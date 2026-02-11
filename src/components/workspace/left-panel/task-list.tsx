"use client";

import { useTasksStore } from "@/stores/tasks-store";
import { TaskListItem } from "./task-list-item";
import { Skeleton } from "@/components/ui/skeleton";

export function TaskList() {
  const { tasks, loading } = useTasksStore();

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        暂无任务
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {tasks.map((task) => (
        <TaskListItem key={task.id} task={task} />
      ))}
    </div>
  );
}
