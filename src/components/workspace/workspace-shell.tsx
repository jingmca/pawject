"use client";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { LeftPanel } from "./left-panel/left-panel";
import { CenterPanel } from "./center-panel/center-panel";
import { PreviewPanel } from "./preview-panel/preview-panel";
import { ContributionsPanel } from "./contributions-panel/contributions-panel";
import { usePolling } from "@/hooks/use-polling";

interface WorkspaceShellProps {
  projectId: string;
}

export function WorkspaceShell({ projectId }: WorkspaceShellProps) {
  const filePreviewOpen = useWorkspaceStore((s) => s.filePreviewOpen);

  // Scheduler polling
  usePolling("/api/scheduler", 30000);

  if (filePreviewOpen) {
    // 4-column layout: Left(18%) | Center(32%) | Preview(25%) | Contributions(25%)
    return (
      <ResizablePanelGroup>
        <ResizablePanel defaultSize={18} minSize={12} maxSize={25}>
          <LeftPanel projectId={projectId} />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={32} minSize={20}>
          <CenterPanel projectId={projectId} />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={25} minSize={15} maxSize={40}>
          <PreviewPanel />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={25} minSize={15} maxSize={40}>
          <ContributionsPanel projectId={projectId} />
        </ResizablePanel>
      </ResizablePanelGroup>
    );
  }

  // 3-column layout: Left(20%) | Center(50%) | Contributions(30%)
  return (
    <ResizablePanelGroup>
      <ResizablePanel defaultSize={20} minSize={12} maxSize={30}>
        <LeftPanel projectId={projectId} />
      </ResizablePanel>

      <ResizableHandle withHandle />

      <ResizablePanel defaultSize={50} minSize={30}>
        <CenterPanel projectId={projectId} />
      </ResizablePanel>

      <ResizableHandle withHandle />

      <ResizablePanel defaultSize={30} minSize={15} maxSize={45}>
        <ContributionsPanel projectId={projectId} />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
