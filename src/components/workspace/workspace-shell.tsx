"use client";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { LeftPanel } from "./left-panel/left-panel";
import { CenterPanel } from "./center-panel/center-panel";
import { RightPanel } from "./right-panel/right-panel";
import { usePolling } from "@/hooks/use-polling";

interface WorkspaceShellProps {
  projectId: string;
}

export function WorkspaceShell({ projectId }: WorkspaceShellProps) {
  const rightPanelOpen = useWorkspaceStore((s) => s.rightPanelOpen);

  // Scheduler polling
  usePolling("/api/scheduler", 30000);

  if (!rightPanelOpen) {
    return (
      <ResizablePanelGroup>
        <ResizablePanel defaultSize={30} minSize={15} maxSize={40}>
          <LeftPanel projectId={projectId} />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={70} minSize={40}>
          <CenterPanel projectId={projectId} />
        </ResizablePanel>
      </ResizablePanelGroup>
    );
  }

  return (
    <ResizablePanelGroup>
      <ResizablePanel defaultSize={30} minSize={15} maxSize={40}>
        <LeftPanel projectId={projectId} />
      </ResizablePanel>

      <ResizableHandle withHandle />

      <ResizablePanel defaultSize={40} minSize={20}>
        <CenterPanel projectId={projectId} />
      </ResizablePanel>

      <ResizableHandle withHandle />

      <ResizablePanel defaultSize={30} minSize={15} maxSize={45}>
        <RightPanel projectId={projectId} />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
