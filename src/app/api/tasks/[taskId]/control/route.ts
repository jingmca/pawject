import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  const { taskId } = await params;
  const { action } = await request.json();

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  let newStatus: string;

  switch (action) {
    case "pause":
      if (task.status !== "running") {
        return NextResponse.json(
          { error: "Can only pause running tasks" },
          { status: 400 }
        );
      }
      newStatus = "paused";
      break;

    case "resume":
      if (task.status !== "paused") {
        return NextResponse.json(
          { error: "Can only resume paused tasks" },
          { status: 400 }
        );
      }
      newStatus = "running";
      break;

    case "stop":
      if (!["running", "paused", "awaiting_input"].includes(task.status)) {
        return NextResponse.json(
          { error: "Task cannot be stopped in current state" },
          { status: 400 }
        );
      }
      newStatus = "stopped";
      break;

    default:
      return NextResponse.json(
        { error: "Invalid action. Use: pause, resume, stop" },
        { status: 400 }
      );
  }

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: { status: newStatus },
  });

  // Add system message about status change
  await prisma.message.create({
    data: {
      taskId,
      role: "system",
      content: `任务状态变更为：${newStatus}`,
    },
  });

  return NextResponse.json(updated);
}
