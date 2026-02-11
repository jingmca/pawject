"use client";

import { useTasksStore } from "@/stores/tasks-store";

export function StatusCards() {
  const tasks = useTasksStore((s) => s.tasks);

  const running = tasks.filter((t) => t.status === "running").length;
  const stopped = tasks.filter(
    (t) => t.status === "stopped" || t.status === "completed"
  ).length;
  const needsAction = tasks.filter(
    (t) => t.status === "awaiting_input" || t.status === "error"
  ).length;

  return (
    <div className="grid grid-cols-3 gap-2">
      <StatusCard
        label="运行中"
        count={running}
        color="text-green-400"
        bg="bg-green-400/10"
      />
      <StatusCard
        label="已停止"
        count={stopped}
        color="text-red-400"
        bg="bg-red-400/10"
      />
      <StatusCard
        label="需处理"
        count={needsAction}
        color="text-orange-400"
        bg="bg-orange-400/10"
      />
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
