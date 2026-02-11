"use client";

import { useState } from "react";
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
import { useTasksStore } from "@/stores/tasks-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { toast } from "sonner";
import { Repeat, Zap, Target } from "lucide-react";

interface NewTaskFormProps {
  projectId: string;
}

export function NewTaskForm({ projectId }: NewTaskFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("one_time");
  const [intervalMinutes, setIntervalMinutes] = useState("60");
  const [loading, setLoading] = useState(false);

  const createTask = useTasksStore((s) => s.createTask);
  const { setShowNewTaskForm, setSelectedTaskId } = useWorkspaceStore();

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setLoading(true);

    try {
      const scheduleConfig =
        type === "periodic"
          ? JSON.stringify({
              intervalMinutes: parseInt(intervalMinutes) || 60,
            })
          : undefined;

      const task = await createTask({
        projectId,
        name: name.trim(),
        description: description.trim(),
        type,
        scheduleConfig,
      });

      toast.success("任务已创建");
      setSelectedTaskId(task.id);
    } catch {
      toast.error("创建任务失败");
    } finally {
      setLoading(false);
    }
  };

  const typeOptions = [
    {
      value: "one_time",
      label: "一次性任务",
      description: "执行一次后完成",
      icon: Zap,
      color: "text-blue-400",
    },
    {
      value: "periodic",
      label: "周期任务",
      description: "定期自动执行",
      icon: Repeat,
      color: "text-purple-400",
    },
    {
      value: "long_term",
      label: "长期任务",
      description: "持续跟踪和互动",
      icon: Target,
      color: "text-amber-400",
    },
  ];

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        <div>
          <h2 className="text-xl font-semibold">新建任务</h2>
          <p className="text-sm text-muted-foreground mt-1">
            选择任务类型并填写相关信息
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {typeOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setType(opt.value)}
              className={`rounded-lg border p-3 text-left transition-colors ${
                type === opt.value
                  ? "border-primary bg-accent"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <opt.icon className={`h-5 w-5 ${opt.color} mb-2`} />
              <div className="text-sm font-medium">{opt.label}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {opt.description}
              </div>
            </button>
          ))}
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">任务名称</label>
            <Input
              placeholder="例如：生成每日报告"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">任务描述</label>
            <Textarea
              placeholder="描述任务的具体目标..."
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {type === "periodic" && (
            <div className="space-y-2">
              <label className="text-sm font-medium">执行间隔</label>
              <Select
                value={intervalMinutes}
                onValueChange={setIntervalMinutes}
              >
                <SelectTrigger>
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
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setShowNewTaskForm(false)}
          >
            取消
          </Button>
          <Button
            className="flex-1"
            onClick={handleSubmit}
            disabled={!name.trim() || loading}
          >
            {loading ? "创建中..." : "创建任务"}
          </Button>
        </div>
      </div>
    </div>
  );
}
