"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileText,
  Code,
  Database,
  FileBarChart,
  File,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { OUTPUT_TYPE_LABELS } from "@/lib/constants";
import type { OutputArtifact } from "@/generated/prisma/client";

interface OutputItemCardProps {
  output: OutputArtifact & { task?: { name: string; type: string } | null };
}

const typeIcons: Record<string, React.ElementType> = {
  report: FileBarChart,
  document: FileText,
  data: Database,
  code: Code,
  other: File,
};

export function OutputItemCard({ output }: OutputItemCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const Icon = typeIcons[output.type] || File;

  return (
    <>
      <div className="border rounded-lg p-2.5">
        <div
          className="flex items-start gap-2 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{output.name}</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0"
              >
                {OUTPUT_TYPE_LABELS[output.type] || output.type}
              </Badge>
              {output.task && (
                <span className="text-[10px] text-muted-foreground truncate">
                  来自: {output.task.name}
                </span>
              )}
            </div>
            {output.summary && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                {output.summary}
              </p>
            )}
          </div>
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
        </div>
        {expanded && (
          <div className="mt-2 pl-6">
            <pre className="text-xs text-muted-foreground bg-muted/50 rounded p-2 max-h-32 overflow-hidden whitespace-pre-wrap">
              {output.content.slice(0, 300)}
              {output.content.length > 300 && "..."}
            </pre>
            {output.content.length > 300 && (
              <Button
                variant="link"
                size="sm"
                className="text-xs px-0 h-6"
                onClick={() => setDialogOpen(true)}
              >
                查看完整内容
              </Button>
            )}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{output.name}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <pre className="text-sm whitespace-pre-wrap p-4">
              {output.content}
            </pre>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
