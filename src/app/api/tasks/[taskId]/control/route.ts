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

  if (action !== "stop") {
    return NextResponse.json(
      { error: "Invalid action. Only 'stop' is supported." },
      { status: 400 }
    );
  }

  if (!["running", "awaiting_input", "pending"].includes(task.status)) {
    return NextResponse.json(
      { error: "Task cannot be stopped in current state" },
      { status: 400 }
    );
  }

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: { status: "completed" },
  });

  // Add system message about status change
  await prisma.message.create({
    data: {
      taskId,
      role: "system",
      content: `Task stopped and marked as completed.`,
    },
  });

  return NextResponse.json(updated);
}
