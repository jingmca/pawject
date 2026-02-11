"use client";

import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { useContextStore } from "@/stores/context-store";
import { ContextItemCard } from "./context-item";
import { Plus, X } from "lucide-react";

interface ContextTabProps {
  projectId: string;
}

export function ContextTab({ projectId }: ContextTabProps) {
  const { items, addItem, removeItem } = useContextStore();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("text_note");
  const [content, setContent] = useState("");

  const handleAdd = async () => {
    if (!name.trim() || !content.trim()) return;
    await addItem({ projectId, name: name.trim(), type, content: content.trim() });
    setName("");
    setContent("");
    setType("text_note");
    setShowForm(false);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-3">
        {!showForm ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => setShowForm(true)}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            添加上下文
          </Button>
        ) : (
          <div className="space-y-2 border rounded-lg p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">添加上下文</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setShowForm(false)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            <Input
              placeholder="名称"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-8 text-xs"
            />
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="h-8 text-xs">
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
              rows={3}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="text-xs"
            />
            <Button
              size="sm"
              className="w-full"
              onClick={handleAdd}
              disabled={!name.trim() || !content.trim()}
            >
              添加
            </Button>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="px-3 pb-3 space-y-2">
          {items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-xs">
              暂无上下文
            </div>
          ) : (
            items.map((item) => (
              <ContextItemCard
                key={item.id}
                item={item}
                onRemove={() => removeItem(item.id)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
