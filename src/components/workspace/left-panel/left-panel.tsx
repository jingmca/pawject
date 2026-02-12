"use client";

import { useRouter } from "next/navigation";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus } from "lucide-react";
import { StatusCards } from "./status-cards";
import { TaskList } from "./task-list";
import { useWorkspaceStore } from "@/stores/workspace-store";

interface LeftPanelProps {
  projectId: string;
}

export function LeftPanel({ projectId: _projectId }: LeftPanelProps) {
  const router = useRouter();
  const setSelectedTaskId = useWorkspaceStore((s) => s.setSelectedTaskId);

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
          variant="outline"
          size="sm"
          onClick={() => setSelectedTaskId(null)}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          新建任务
        </Button>
      </div>

      <div className="px-3 pb-3">
        <StatusCards />
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
