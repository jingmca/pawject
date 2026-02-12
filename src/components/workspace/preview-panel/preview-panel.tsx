"use client";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { X, FileText, Code, File } from "lucide-react";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { FilePreviewContent } from "./file-preview-content";

const typeIcons: Record<string, React.ElementType> = {
  context: FileText,
  draft: Code,
};

export function PreviewPanel() {
  const filePreviewTarget = useWorkspaceStore((s) => s.filePreviewTarget);
  const closeFilePreview = useWorkspaceStore((s) => s.closeFilePreview);

  if (!filePreviewTarget) {
    return (
      <div className="h-full flex items-center justify-center bg-card border-l">
        <div className="text-center text-muted-foreground text-sm">
          <File className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p>无预览内容</p>
        </div>
      </div>
    );
  }

  const Icon = typeIcons[filePreviewTarget.type] || FileText;

  return (
    <div className="h-full flex flex-col bg-card border-l">
      {/* Header */}
      <div className="px-3 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium truncate">
            {filePreviewTarget.name}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0"
          onClick={closeFilePreview}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <Separator />

      {/* Body */}
      <ScrollArea className="flex-1">
        <div className="p-3">
          <FilePreviewContent target={filePreviewTarget} />
        </div>
      </ScrollArea>
    </div>
  );
}
