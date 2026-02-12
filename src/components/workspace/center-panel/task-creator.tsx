"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTasksStore } from "@/stores/tasks-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { toast } from "sonner";
import { Repeat, Zap, Compass, Send, Loader2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskCreatorProps {
  projectId: string;
}

const typeOptions = [
  {
    value: "one_time",
    label: "一次性",
    icon: Zap,
    color: "text-blue-400",
    borderColor: "border-blue-500/50",
    bgColor: "bg-blue-500/10",
    placeholder:
      "例如：帮我分析这份竞品报告，总结核心差异点\n\n写一份Q4季度总结，包含关键指标和团队贡献",
  },
  {
    value: "periodic",
    label: "周期",
    icon: Repeat,
    color: "text-purple-400",
    borderColor: "border-purple-500/50",
    bgColor: "bg-purple-500/10",
    placeholder:
      "例如：每天早上汇总产品反馈渠道的新消息\n\n每周五生成团队周报草稿",
  },
  {
    value: "proactive",
    label: "主动探索",
    icon: Compass,
    color: "text-amber-400",
    borderColor: "border-amber-500/50",
    bgColor: "bg-amber-500/10",
    placeholder:
      "例如：持续关注AI行业动态，发现与我们产品相关的机会\n\n探索用户行为数据中的异常模式",
  },
];

interface ParsedTask {
  name: string;
  description: string;
  type: string;
  intervalMinutes?: number;
}

export function TaskCreator({ projectId }: TaskCreatorProps) {
  const [type, setType] = useState("one_time");
  const [input, setInput] = useState("");
  const [intervalMinutes, setIntervalMinutes] = useState("60");
  const [loading, setLoading] = useState(false);
  const [parsedTask, setParsedTask] = useState<ParsedTask | null>(null);

  const createTask = useTasksStore((s) => s.createTask);
  const setSelectedTaskId = useWorkspaceStore((s) => s.setSelectedTaskId);

  const selectedType = typeOptions.find((o) => o.value === type)!;

  const handleSubmit = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    // Generate a task name from the input (first line or first 50 chars)
    const firstLine = trimmed.split("\n")[0];
    const name =
      firstLine.length > 50 ? firstLine.slice(0, 50) + "..." : firstLine;

    const parsed: ParsedTask = {
      name,
      description: trimmed,
      type,
      intervalMinutes: type === "periodic" ? parseInt(intervalMinutes) || 60 : undefined,
    };

    setParsedTask(parsed);
  };

  const handleConfirm = async () => {
    if (!parsedTask) return;
    setLoading(true);

    try {
      const scheduleConfig =
        parsedTask.type === "periodic"
          ? JSON.stringify({
              intervalMinutes: parsedTask.intervalMinutes || 60,
            })
          : undefined;

      const task = await createTask({
        projectId,
        name: parsedTask.name,
        description: parsedTask.description,
        type: parsedTask.type,
        scheduleConfig,
      });

      toast.success("任务已创建");
      setSelectedTaskId(task.id);
      setInput("");
      setParsedTask(null);
    } catch {
      toast.error("创建任务失败");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setParsedTask(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (parsedTask) {
        handleConfirm();
      } else {
        handleSubmit();
      }
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl space-y-6">
        <div className="text-center">
          <h2 className="text-xl font-semibold">创建新任务</h2>
          <p className="text-sm text-muted-foreground mt-1">
            描述你需要完成的事情
          </p>
        </div>

        {/* Type selector chips */}
        <div className="flex items-center justify-center gap-2">
          {typeOptions.map((opt) => {
            const Icon = opt.icon;
            const isActive = type === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => {
                  setType(opt.value);
                  setParsedTask(null);
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-all border",
                  isActive
                    ? `${opt.bgColor} ${opt.borderColor} ${opt.color}`
                    : "border-border text-muted-foreground hover:border-primary/30 hover:text-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Periodic interval selector */}
        {type === "periodic" && (
          <div className="flex items-center justify-center gap-2">
            <span className="text-sm text-muted-foreground">执行间隔:</span>
            <Select value={intervalMinutes} onValueChange={setIntervalMinutes}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">每 15 分钟</SelectItem>
                <SelectItem value="30">每 30 分钟</SelectItem>
                <SelectItem value="60">每小时</SelectItem>
                <SelectItem value="360">每 6 小时</SelectItem>
                <SelectItem value="720">每 12 小时</SelectItem>
                <SelectItem value="1440">每天</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Confirmation card */}
        {parsedTask ? (
          <div className="border rounded-xl p-4 space-y-3 bg-card">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground">
                  {parsedTask.name}
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-3">
                  {parsedTask.description}
                </p>
                {parsedTask.type === "periodic" && parsedTask.intervalMinutes && (
                  <p className="text-xs text-purple-400 mt-1">
                    每 {parsedTask.intervalMinutes} 分钟执行一次
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                disabled={loading}
              >
                <X className="h-3.5 w-3.5 mr-1" />
                修改
              </Button>
              <Button
                size="sm"
                onClick={handleConfirm}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5 mr-1" />
                )}
                {loading ? "创建中..." : "确认创建"}
              </Button>
            </div>
          </div>
        ) : (
          /* Main textarea */
          <div className="relative">
            <Textarea
              placeholder={selectedType.placeholder}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={5}
              className="resize-none text-sm pr-12 min-h-[140px]"
              autoFocus
            />
            <Button
              size="icon"
              className="absolute bottom-3 right-3 h-8 w-8"
              onClick={handleSubmit}
              disabled={!input.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        )}

        <p className="text-[10px] text-muted-foreground text-center">
          {parsedTask ? "确认后将创建任务并开始执行" : "按 Cmd+Enter 提交"}
        </p>
      </div>
    </div>
  );
}
