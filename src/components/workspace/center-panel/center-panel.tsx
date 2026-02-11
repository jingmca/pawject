"use client";

import { useWorkspaceStore } from "@/stores/workspace-store";
import { useTasksStore } from "@/stores/tasks-store";
import { NewTaskForm } from "./new-task-form";
import { TaskHeader } from "./task-header";
import { ChatSession } from "./chat-session";
import { MessageSquare } from "lucide-react";

interface CenterPanelProps {
  projectId: string;
}

export function CenterPanel({ projectId }: CenterPanelProps) {
  const { selectedTaskId, showNewTaskForm } = useWorkspaceStore();
  const tasks = useTasksStore((s) => s.tasks);
  const selectedTask = tasks.find((t) => t.id === selectedTaskId);

  if (showNewTaskForm) {
    return (
      <div className="h-full flex flex-col bg-background">
        <NewTaskForm projectId={projectId} />
      </div>
    );
  }

  if (!selectedTask) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center text-muted-foreground">
          <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>选择一个任务开始对话</p>
          <p className="text-sm mt-1">或创建新任务</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      <TaskHeader task={selectedTask} />
      <ChatSession task={selectedTask} />
    </div>
  );
}
