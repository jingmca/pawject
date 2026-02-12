"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Send,
  Loader2,
  Sparkles,
  Zap,
  Repeat,
  Target,
  Plus,
  X,
  Link,
  FileText,
  Check,
  Pencil,
} from "lucide-react";
import { TASK_TYPE_LABELS } from "@/lib/constants";

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

interface ParsedProject {
  name: string;
  description: string;
  projectInstruction: string;
  suggestedTask?: {
    name: string;
    description: string;
    type: string;
  };
}

interface ContextSource {
  id: string;
  name: string;
  type: "url" | "text";
  value: string;
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  one_time: <Zap className="h-3.5 w-3.5 text-blue-400" />,
  periodic: <Repeat className="h-3.5 w-3.5 text-purple-400" />,
  proactive: <Target className="h-3.5 w-3.5 text-amber-400" />,
};

const TYPE_COLORS: Record<string, string> = {
  one_time: "border-blue-500/30 bg-blue-500/5",
  periodic: "border-purple-500/30 bg-purple-500/5",
  proactive: "border-amber-500/30 bg-amber-500/5",
};

export function CreateProjectDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateProjectDialogProps) {
  const router = useRouter();
  const [instruction, setInstruction] = useState("");
  const [parsing, setParsing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [parsed, setParsed] = useState<ParsedProject | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [editedName, setEditedName] = useState("");

  // Context sources
  const [sources, setSources] = useState<ContextSource[]>([]);
  const [showAddSource, setShowAddSource] = useState(false);
  const [newSourceType, setNewSourceType] = useState<"url" | "text">("url");
  const [newSourceName, setNewSourceName] = useState("");
  const [newSourceValue, setNewSourceValue] = useState("");

  const reset = () => {
    setInstruction("");
    setParsed(null);
    setParsing(false);
    setCreating(false);
    setSources([]);
    setShowAddSource(false);
    setEditingName(false);
    setEditedName("");
  };

  // Step 1: User submits instruction → AI parses
  const handleParse = async () => {
    if (!instruction.trim()) return;
    setParsing(true);

    try {
      const res = await fetch("/api/projects/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction: instruction.trim() }),
      });
      if (res.ok) {
        const data: ParsedProject = await res.json();
        setParsed(data);
        setEditedName(data.name);
      }
    } finally {
      setParsing(false);
    }
  };

  // Step 2: User confirms → create project
  const handleConfirm = async () => {
    if (!parsed) return;
    setCreating(true);

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editedName || parsed.name,
          description: parsed.description,
          instruction: parsed.projectInstruction,
          suggestedTask: parsed.suggestedTask,
          contextSources: sources.length > 0 ? sources : undefined,
        }),
      });
      const project = await res.json();
      reset();
      onCreated();
      router.push(`/projects/${project.id}`);
    } finally {
      setCreating(false);
    }
  };

  const addSource = () => {
    if (!newSourceName.trim() || !newSourceValue.trim()) return;
    setSources([
      ...sources,
      {
        id: `src-${Date.now()}`,
        name: newSourceName.trim(),
        type: newSourceType,
        value: newSourceValue.trim(),
      },
    ]);
    setNewSourceName("");
    setNewSourceValue("");
    setShowAddSource(false);
  };

  const removeSource = (id: string) => {
    setSources(sources.filter((s) => s.id !== id));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey && !parsed) {
      e.preventDefault();
      handleParse();
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            新建项目
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 pb-5 space-y-4">
          {/* Main input area */}
          {!parsed ? (
            <>
              <div className="relative rounded-xl border bg-card">
                <Textarea
                  placeholder="描述你要做的事情，例如：&#10;• 帮我每天早上汇总行业新闻并生成简报&#10;• 分析竞品的产品策略，持续跟踪动态&#10;• 整理这份调研数据并生成分析报告"
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={4}
                  className="border-none focus-visible:ring-0 resize-none text-sm bg-transparent"
                  disabled={parsing}
                />
                <div className="flex items-center justify-between px-3 py-2 border-t border-border/50">
                  <div className="text-xs text-muted-foreground">
                    {parsing
                      ? "AI 正在分析你的指令..."
                      : "Enter 发送 · Shift+Enter 换行"}
                  </div>
                  <Button
                    size="sm"
                    className="h-7 px-3"
                    onClick={handleParse}
                    disabled={!instruction.trim() || parsing}
                  >
                    {parsing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Context/data source section (optional) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                    上下文 / 数据源（可选）
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs px-2"
                    onClick={() => setShowAddSource(!showAddSource)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    添加
                  </Button>
                </div>

                {showAddSource && (
                  <div className="rounded-lg border p-3 space-y-2 mb-2">
                    <div className="flex gap-2">
                      <Button
                        variant={
                          newSourceType === "url" ? "secondary" : "ghost"
                        }
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setNewSourceType("url")}
                      >
                        <Link className="h-3 w-3 mr-1" />
                        链接
                      </Button>
                      <Button
                        variant={
                          newSourceType === "text" ? "secondary" : "ghost"
                        }
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setNewSourceType("text")}
                      >
                        <FileText className="h-3 w-3 mr-1" />
                        文本
                      </Button>
                    </div>
                    <Input
                      placeholder="名称"
                      value={newSourceName}
                      onChange={(e) => setNewSourceName(e.target.value)}
                      className="h-8 text-xs"
                    />
                    {newSourceType === "url" ? (
                      <Input
                        placeholder="https://..."
                        value={newSourceValue}
                        onChange={(e) => setNewSourceValue(e.target.value)}
                        className="h-8 text-xs"
                      />
                    ) : (
                      <Textarea
                        placeholder="粘贴文本内容..."
                        rows={3}
                        value={newSourceValue}
                        onChange={(e) => setNewSourceValue(e.target.value)}
                        className="text-xs"
                      />
                    )}
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setShowAddSource(false)}
                      >
                        取消
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        onClick={addSource}
                        disabled={
                          !newSourceName.trim() || !newSourceValue.trim()
                        }
                      >
                        添加
                      </Button>
                    </div>
                  </div>
                )}

                {sources.length > 0 && (
                  <div className="space-y-1">
                    {sources.map((src) => (
                      <div
                        key={src.id}
                        className="flex items-center justify-between rounded-md border px-2.5 py-1.5 text-xs group"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {src.type === "url" ? (
                            <Link className="h-3 w-3 text-muted-foreground shrink-0" />
                          ) : (
                            <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                          )}
                          <span className="truncate">{src.name}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100"
                          onClick={() => removeSource(src.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Step 2: Confirmation card */
            <div className="space-y-3">
              {/* User's original instruction */}
              <div className="rounded-lg bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                {instruction}
              </div>

              <Separator />

              {/* Parsed result card */}
              <div className="rounded-xl border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground uppercase tracking-wide">
                    AI 解析结果
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs px-2"
                    onClick={() => setParsed(null)}
                  >
                    重新输入
                  </Button>
                </div>

                {/* Project name (editable) */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    项目名称
                  </label>
                  {editingName ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        className="h-8 text-sm"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") setEditingName(false);
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => setEditingName(false)}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <div
                      className="flex items-center gap-2 cursor-pointer group"
                      onClick={() => setEditingName(true)}
                    >
                      <span className="text-sm font-medium">
                        {editedName || parsed.name}
                      </span>
                      <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                    </div>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">
                    项目描述
                  </label>
                  <p className="text-sm">{parsed.description}</p>
                </div>

                {/* Suggested task */}
                {parsed.suggestedTask && (
                  <div
                    className={`rounded-lg border p-3 ${TYPE_COLORS[parsed.suggestedTask.type] || ""}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {TYPE_ICONS[parsed.suggestedTask.type]}
                      <span className="text-xs font-medium">
                        初始任务 ·{" "}
                        {TASK_TYPE_LABELS[parsed.suggestedTask.type] ||
                          parsed.suggestedTask.type}
                      </span>
                    </div>
                    <p className="text-sm font-medium">
                      {parsed.suggestedTask.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {parsed.suggestedTask.description}
                    </p>
                  </div>
                )}

                {!parsed.suggestedTask && (
                  <div className="rounded-lg border border-dashed p-3 text-center text-xs text-muted-foreground">
                    未识别到具体任务，创建后可在 workspace 中手动添加
                  </div>
                )}
              </div>

              {/* Context sources summary */}
              {sources.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  将附带 {sources.length} 个上下文数据源
                </div>
              )}

              {/* Confirm / Cancel */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setParsed(null)}
                >
                  修改
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleConfirm}
                  disabled={creating}
                >
                  {creating ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                      创建中...
                    </>
                  ) : (
                    <>
                      <Check className="h-3.5 w-3.5 mr-2" />
                      确认创建
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
