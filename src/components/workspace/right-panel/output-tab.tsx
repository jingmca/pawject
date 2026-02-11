"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { useOutputsStore } from "@/stores/outputs-store";
import { OutputItemCard } from "./output-item";

interface OutputTabProps {
  projectId: string;
}

export function OutputTab({ projectId: _projectId }: OutputTabProps) {
  const { outputs } = useOutputsStore();

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-2">
        {outputs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-xs">
            暂无产出
          </div>
        ) : (
          outputs.map((output) => (
            <OutputItemCard key={output.id} output={output} />
          ))
        )}
      </div>
    </ScrollArea>
  );
}
