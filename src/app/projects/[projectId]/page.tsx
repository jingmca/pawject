"use client";

import { use, useEffect } from "react";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { useTasksStore } from "@/stores/tasks-store";
import { useContextStore } from "@/stores/context-store";
import { useOutputsStore } from "@/stores/outputs-store";
import { useAskUserStore } from "@/stores/ask-user-store";
import { useGraphStore } from "@/stores/graph-store";
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
  const fetchAskUserQueries = useAskUserStore((s) => s.fetchQueries);
  const fetchGraphEvents = useGraphStore((s) => s.fetchEvents);

  useEffect(() => {
    setSelectedProjectId(projectId);
    fetchTasks(projectId);
    fetchContext(projectId);
    fetchOutputs(projectId);
    fetchAskUserQueries(projectId);
    fetchGraphEvents(projectId);
  }, [
    projectId,
    setSelectedProjectId,
    fetchTasks,
    fetchContext,
    fetchOutputs,
    fetchAskUserQueries,
    fetchGraphEvents,
  ]);

  return (
    <div className="h-full w-full">
      <WorkspaceShell projectId={projectId} />
    </div>
  );
}
