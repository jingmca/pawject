"use client";

import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useWorkspaceStore } from "@/stores/workspace-store";

interface NewTaskButtonProps {
  projectId: string;
}

export function NewTaskButton({ projectId: _projectId }: NewTaskButtonProps) {
  const setShowNewTaskForm = useWorkspaceStore((s) => s.setShowNewTaskForm);

  return (
    <Button
      className="w-full"
      variant="outline"
      onClick={() => setShowNewTaskForm(true)}
    >
      <Plus className="h-4 w-4 mr-2" />
      新建任务
    </Button>
  );
}
