"use client";

import { use, useEffect } from "react";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useTasksStore } from "@/stores/tasks-store";
import { useContextStore } from "@/stores/context-store";
import { useOutputsStore } from "@/stores/outputs-store";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";

export default function WorkspacePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const setSelectedProjectId = useWorkspaceStore(
    (s) => s.setSelectedProjectId
  );
  const fetchTasks = useTasksStore((s) => s.fetchTasks);
  const fetchContext = useContextStore((s) => s.fetchItems);
  const fetchOutputs = useOutputsStore((s) => s.fetchOutputs);

  useEffect(() => {
    setSelectedProjectId(projectId);
    fetchTasks(projectId);
    fetchContext(projectId);
    fetchOutputs(projectId);
  }, [projectId, setSelectedProjectId, fetchTasks, fetchContext, fetchOutputs]);

  return (
    <div className="h-full w-full">
      <WorkspaceShell projectId={projectId} />
    </div>
  );
}
