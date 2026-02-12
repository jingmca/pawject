"use client";

import { useWorkspaceStore } from "@/stores/workspace-store";
import { useTasksStore } from "@/stores/tasks-store";
import { TaskCreator } from "./task-creator";
import { TaskHeader } from "./task-header";
import { ChatSession } from "./chat-session";

interface CenterPanelProps {
  projectId: string;
}

export function CenterPanel({ projectId }: CenterPanelProps) {
  const selectedTaskId = useWorkspaceStore((s) => s.selectedTaskId);
  const tasks = useTasksStore((s) => s.tasks);
  const selectedTask = tasks.find((t) => t.id === selectedTaskId);

  // No task selected -> show task creator
  if (!selectedTaskId || !selectedTask) {
    return (
      <div className="h-full flex flex-col bg-background">
        <TaskCreator projectId={projectId} />
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
