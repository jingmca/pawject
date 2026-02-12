"use client";

import { useTasksStore } from "@/stores/tasks-store";
import { AwaitingInputSection } from "./awaiting-input-section";

export function StatusCards() {
  const tasks = useTasksStore((s) => s.tasks);

  const pending = tasks.filter((t) => t.status === "pending").length;
  const running = tasks.filter((t) => t.status === "running").length;
  const completed = tasks.filter((t) => t.status === "completed").length;

  return (
    <div className="space-y-2">
      {/* Row 1: compact status counts */}
      <div className="grid grid-cols-3 gap-2">
        <StatusCard
          label="待启动"
          count={pending}
          color="text-zinc-400"
          bg="bg-zinc-400/10"
        />
        <StatusCard
          label="进行中"
          count={running}
          color="text-green-400"
          bg="bg-green-400/10"
        />
        <StatusCard
          label="已执行"
          count={completed}
          color="text-blue-400"
          bg="bg-blue-400/10"
        />
      </div>

      {/* Row 2: awaiting input section */}
      <AwaitingInputSection />
    </div>
  );
}

function StatusCard({
  label,
  count,
  color,
  bg,
}: {
  label: string;
  count: number;
  color: string;
  bg: string;
}) {
  return (
    <div className={`rounded-lg p-2 text-center ${bg}`}>
      <div className={`text-xl font-bold ${color}`}>{count}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}
