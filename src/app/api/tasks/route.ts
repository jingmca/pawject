import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { chat } from "@/lib/agent";
import type { ScheduleConfig } from "@/types";

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json(
      { error: "projectId is required" },
      { status: 400 }
    );
  }

  const tasks = await prisma.task.findMany({
    where: { projectId },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { messages: true } },
    },
  });

  return NextResponse.json(tasks);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { projectId, name, description, type, scheduleConfig } = body;

  if (!projectId || !name || !type) {
    return NextResponse.json(
      { error: "projectId, name, and type are required" },
      { status: 400 }
    );
  }

  // Determine initial status and nextRunAt based on type
  let status = "pending";
  let nextRunAt: Date | null = null;

  if (type === "periodic" && scheduleConfig) {
    try {
      const config: ScheduleConfig = JSON.parse(scheduleConfig);
      nextRunAt = new Date(
        Date.now() + config.intervalMinutes * 60 * 1000
      );
      status = "running";
    } catch {
      // invalid config
    }
  } else if (type === "one_time" || type === "long_term") {
    status = "running";
  }

  const task = await prisma.task.create({
    data: {
      projectId,
      name,
      description: description || "",
      type,
      status,
      scheduleConfig: scheduleConfig || null,
      nextRunAt,
    },
  });

  // Auto-generate initial agent message for running tasks
  if (status === "running") {
    try {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { context: true },
      });

      if (project) {
        const initialMessages: Record<string, string> = {
          one_time: `请开始执行任务「${name}」。${description || ""}`,
          long_term: `请开始跟踪目标「${name}」，并提供初始分析。${description || ""}`,
          periodic: `任务「${name}」已创建。请确认任务配置并准备首次执行。`,
        };

        const userMsg = initialMessages[type] || initialMessages.one_time;

        // Save system init message
        await prisma.message.create({
          data: {
            taskId: task.id,
            role: "system",
            content: `任务已创建：${name} (${type})`,
          },
        });

        const response = await chat({
          task,
          userMessage: userMsg,
          messageHistory: [],
          sharedContext: project.context,
          projectInstruction: project.instruction,
        });

        // Save user trigger and agent response
        await prisma.message.create({
          data: {
            taskId: task.id,
            role: "user",
            content: userMsg,
          },
        });

        await prisma.message.create({
          data: {
            taskId: task.id,
            role: "agent",
            content: response.content,
          },
        });

        // Save artifacts
        if (response.artifacts) {
          for (const artifact of response.artifacts) {
            await prisma.outputArtifact.create({
              data: {
                projectId,
                taskId: task.id,
                name: artifact.name,
                type: artifact.type,
                content: artifact.content,
                summary: artifact.summary,
              },
            });
          }
        }

        // Update status if agent suggested a change
        if (response.taskStatusChange) {
          await prisma.task.update({
            where: { id: task.id },
            data: { status: response.taskStatusChange },
          });
        }
      }
    } catch (error) {
      console.error("Failed to generate initial agent message:", error);
      // Task is still created, just without initial message
    }
  }

  // Return fresh task data
  const updatedTask = await prisma.task.findUnique({
    where: { id: task.id },
    include: { _count: { select: { messages: true } } },
  });

  return NextResponse.json(updatedTask, { status: 201 });
}
