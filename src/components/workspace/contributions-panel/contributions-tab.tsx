"use client";

import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  X,
  FileText,
  Link,
  FolderOpen,
  StickyNote,
  Code,
  FileBarChart,
  Database,
  File,
  Trash2,
} from "lucide-react";
import { useContextStore } from "@/stores/context-store";
import { useOutputsStore } from "@/stores/outputs-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { CONTEXT_TYPE_LABELS, OUTPUT_TYPE_LABELS } from "@/lib/constants";
import type { ContextItem } from "@/generated/prisma/client";
import type { OutputArtifact } from "@/generated/prisma/client";

interface ContributionsTabProps {
  projectId: string;
}

const contextTypeIcons: Record<string, React.ElementType> = {
  file: FileText,
  url: Link,
  feishu_folder: FolderOpen,
  text_note: StickyNote,
};

const outputTypeIcons: Record<string, React.ElementType> = {
  report: FileBarChart,
  document: FileText,
  data: Database,
  code: Code,
  other: File,
};

export function ContributionsTab({ projectId }: ContributionsTabProps) {
  const { items: contextItems, addItem, removeItem } = useContextStore();
  const { outputs, removeOutput } = useOutputsStore();
  const openFilePreview = useWorkspaceStore((s) => s.openFilePreview);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("text_note");
  const [content, setContent] = useState("");

  const handleAdd = async () => {
    if (!name.trim() || !content.trim()) return;
    await addItem({
      projectId,
      name: name.trim(),
      type,
      content: content.trim(),
    });
    setName("");
    setContent("");
    setType("text_note");
    setShowForm(false);
  };

  const handleContextClick = (item: ContextItem) => {
    openFilePreview({
      id: item.id,
      name: item.name,
      type: "context",
      content: item.content,
    });
  };

  const handleOutputClick = (output: OutputArtifact) => {
    openFilePreview({
      id: output.id,
      name: output.name,
      type: "draft",
      content: output.content,
      language: output.type === "code" ? "code" : undefined,
    });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Top half: Context items */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-3 pt-3 pb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Context
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setShowForm(!showForm)}
          >
            {showForm ? (
              <X className="h-3.5 w-3.5" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>

        {showForm && (
          <div className="px-3 pb-2">
            <div className="space-y-2 border rounded-lg p-2.5">
              <Input
                placeholder="名称"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-7 text-xs"
              />
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text_note">文本笔记</SelectItem>
                  <SelectItem value="url">链接</SelectItem>
                  <SelectItem value="file">文件</SelectItem>
                  <SelectItem value="feishu_folder">飞书文件夹</SelectItem>
                </SelectContent>
              </Select>
              <Textarea
                placeholder="内容..."
                rows={2}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="text-xs"
              />
              <Button
                size="sm"
                className="w-full h-7 text-xs"
                onClick={handleAdd}
                disabled={!name.trim() || !content.trim()}
              >
                添加
              </Button>
            </div>
          </div>
        )}

        <ScrollArea className="flex-1">
          <div className="px-3 pb-2 space-y-1">
            {contextItems.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-xs">
                暂无上下文
              </div>
            ) : (
              contextItems.map((item) => {
                const Icon = contextTypeIcons[item.type] || StickyNote;
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/50 cursor-pointer group transition-colors"
                    onClick={() => handleContextClick(item)}
                  >
                    <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs truncate flex-1">
                      {item.name}
                    </span>
                    <Badge
                      variant="outline"
                      className="text-[9px] px-1 py-0 shrink-0"
                    >
                      {CONTEXT_TYPE_LABELS[item.type] || item.type}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeItem(item.id);
                      }}
                    >
                      <Trash2 className="h-2.5 w-2.5 text-muted-foreground" />
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>

      <Separator />

      {/* Bottom half: Agent Drafts */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-3 pt-3 pb-2">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Agent Drafts
          </span>
        </div>

        <ScrollArea className="flex-1">
          <div className="px-3 pb-3 space-y-1">
            {outputs.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-xs">
                暂无产出
              </div>
            ) : (
              outputs.map((output) => {
                const Icon = outputTypeIcons[output.type] || File;
                return (
                  <div
                    key={output.id}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/50 cursor-pointer group transition-colors"
                    onClick={() => handleOutputClick(output)}
                  >
                    <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs truncate">{output.name}</div>
                      {output.summary && (
                        <div className="text-[10px] text-muted-foreground truncate">
                          {output.summary}
                        </div>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[9px] px-1 py-0 shrink-0"
                    >
                      {OUTPUT_TYPE_LABELS[output.type] || output.type}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeOutput(output.id);
                      }}
                    >
                      <Trash2 className="h-2.5 w-2.5 text-muted-foreground" />
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
