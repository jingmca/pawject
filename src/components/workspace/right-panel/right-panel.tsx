"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { ContextTab } from "./context-tab";
import { OutputTab } from "./output-tab";
import { Database, FileOutput } from "lucide-react";

interface RightPanelProps {
  projectId: string;
}

export function RightPanel({ projectId }: RightPanelProps) {
  const { rightPanelTab, setRightPanelTab } = useWorkspaceStore();

  return (
    <div className="h-full flex flex-col bg-card border-l">
      <Tabs
        value={rightPanelTab}
        onValueChange={(v) => setRightPanelTab(v as "context" | "output")}
        className="flex flex-col h-full"
      >
        <div className="px-3 pt-3">
          <TabsList className="w-full">
            <TabsTrigger value="context" className="flex-1 text-xs">
              <Database className="h-3.5 w-3.5 mr-1.5" />
              上下文
            </TabsTrigger>
            <TabsTrigger value="output" className="flex-1 text-xs">
              <FileOutput className="h-3.5 w-3.5 mr-1.5" />
              产出
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="context" className="flex-1 m-0 min-h-0">
          <ContextTab projectId={projectId} />
        </TabsContent>
        <TabsContent value="output" className="flex-1 m-0 min-h-0">
          <OutputTab projectId={projectId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
