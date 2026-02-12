"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { ContributionsTab } from "./contributions-tab";
import { GraphTab } from "./graph-tab";
import { Layers, GitBranch } from "lucide-react";

interface ContributionsPanelProps {
  projectId: string;
}

export function ContributionsPanel({ projectId }: ContributionsPanelProps) {
  const { contributionsTab, setContributionsTab } = useWorkspaceStore();

  return (
    <div className="h-full flex flex-col bg-card border-l">
      <Tabs
        value={contributionsTab}
        onValueChange={(v) =>
          setContributionsTab(v as "contributions" | "graph")
        }
        className="flex flex-col h-full"
      >
        <div className="px-3 pt-3">
          <TabsList className="w-full">
            <TabsTrigger value="contributions" className="flex-1 text-xs">
              <Layers className="h-3.5 w-3.5 mr-1.5" />
              Contributions
            </TabsTrigger>
            <TabsTrigger value="graph" className="flex-1 text-xs">
              <GitBranch className="h-3.5 w-3.5 mr-1.5" />
              Graph
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="contributions" className="flex-1 m-0 min-h-0">
          <ContributionsTab projectId={projectId} />
        </TabsContent>
        <TabsContent value="graph" className="flex-1 m-0 min-h-0">
          <GraphTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
