"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, FileText, Link, FolderOpen, StickyNote } from "lucide-react";
import { CONTEXT_TYPE_LABELS } from "@/lib/constants";
import type { ContextItem } from "@/generated/prisma/client";

interface ContextItemCardProps {
  item: ContextItem;
  onRemove: () => void;
}

const typeIcons: Record<string, React.ElementType> = {
  file: FileText,
  url: Link,
  feishu_folder: FolderOpen,
  text_note: StickyNote,
};

export function ContextItemCard({ item, onRemove }: ContextItemCardProps) {
  const Icon = typeIcons[item.type] || StickyNote;

  return (
    <div className="border rounded-lg p-2.5 group">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0">
          <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{item.name}</div>
            <Badge variant="outline" className="text-[10px] mt-0.5 px-1.5 py-0">
              {CONTEXT_TYPE_LABELS[item.type] || item.type}
            </Badge>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          onClick={onRemove}
        >
          <Trash2 className="h-3 w-3 text-muted-foreground" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2 pl-6">
        {item.content}
      </p>
    </div>
  );
}
