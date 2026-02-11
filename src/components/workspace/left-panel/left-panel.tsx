"use client";

import { useRouter } from "next/navigation";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ArrowLeft, PanelRightClose, PanelRightOpen } from "lucide-react";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { StatusCards } from "./status-cards";
import { NewTaskButton } from "./new-task-button";
import { TaskList } from "./task-list";

interface LeftPanelProps {
  projectId: string;
}

export function LeftPanel({ projectId }: LeftPanelProps) {
  const router = useRouter();
  const { rightPanelOpen, setRightPanelOpen } = useWorkspaceStore();

  return (
    <div className="h-full flex flex-col bg-card border-r">
      <div className="p-3 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/projects")}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          项目列表
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setRightPanelOpen(!rightPanelOpen)}
        >
          {rightPanelOpen ? (
            <PanelRightClose className="h-4 w-4" />
          ) : (
            <PanelRightOpen className="h-4 w-4" />
          )}
        </Button>
      </div>

      <Separator />

      <div className="p-3">
        <StatusCards />
      </div>

      <Separator />

      <div className="p-3">
        <NewTaskButton projectId={projectId} />
      </div>

      <Separator />

      <ScrollArea className="flex-1">
        <div className="p-3">
          <TaskList />
        </div>
      </ScrollArea>
    </div>
  );
}
