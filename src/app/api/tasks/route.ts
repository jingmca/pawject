import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { chat } from "@/lib/agent";
import { getWorkspacePath, getContextDir, getDraftDir, createTaskDir, commitChange } from "@/lib/workspace";
import type { ScheduleConfig } from "@/types";
import crypto from "node:crypto";

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

// Background agent execution for new tasks -- not awaited by the request
async function runInitialTaskAgent(
  projectId: string,
  taskId: string,
  taskName: string,
  taskType: string,
  userMsg: string
) {
  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { context: true },
    });

    if (!project) return;

    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) return;

    const workspacePath = getWorkspacePath(projectId);

    // Create task subdirectory
    const taskDir = await createTaskDir(projectId, taskId);
    const addDirs = [getContextDir(projectId), getDraftDir(projectId)];

    const response = await chat({
      task,
      userMessage: userMsg,
      sharedContext: project.context,
      projectInstruction: project.instruction,
      workspacePath,
      addDirs,
      taskDir,
      projectMeta: { name: project.name, description: project.description },
    });

    // Save agent response
    const messageData: {
      taskId: string;
      role: string;
      content: string;
      metadata?: string;
    } = {
      taskId,
      role: "agent",
      content: response.content,
    };

    if (response.askUser) {
      messageData.metadata = JSON.stringify({ askUser: response.askUser });
    }

    await prisma.message.create({ data: messageData });

    // Save artifacts
    if (response.artifacts) {
      for (const artifact of response.artifacts) {
        await prisma.outputArtifact.create({
          data: {
            projectId,
            taskId,
            name: artifact.name,
            type: artifact.type,
            content: artifact.content,
            summary: artifact.summary,
          },
        });
      }
    }

    // Update status if agent suggested a change, or auto-complete one_time tasks
    if (response.taskStatusChange) {
      await prisma.task.update({
        where: { id: taskId },
        data: { status: response.taskStatusChange },
      });
    } else if (taskType === "one_time") {
      await prisma.task.update({
        where: { id: taskId },
        data: { status: "completed" },
      });
    }

    // Update task's sessionId if returned
    if (response.sessionId && !task.sessionId) {
      await prisma.task.update({
        where: { id: taskId },
        data: { sessionId: response.sessionId },
      });
    }

    // Commit workspace changes
    await commitChange(projectId, `Agent: ${taskName}`);
  } catch (error) {
    console.error("Background task agent execution failed:", error);
    const errMsg = error instanceof Error ? error.message : String(error);
    await prisma.message.create({
      data: {
        taskId,
        role: "system",
        content: `Agent execution error: ${errMsg}`,
      },
    });
    await prisma.task.update({
      where: { id: taskId },
      data: { status: "completed" },
    });
  }
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

  // Validate that the project exists
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    return NextResponse.json(
      { error: `Project not found: ${projectId}` },
      { status: 404 }
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
  } else if (type === "one_time" || type === "proactive") {
    status = "running";
  }

  // Generate a sessionId for the task
  const sessionId = crypto.randomUUID();

  const task = await prisma.task.create({
    data: {
      projectId,
      name,
      description: description || "",
      type,
      status,
      sessionId,
      scheduleConfig: scheduleConfig || null,
      nextRunAt,
    },
  });

  // Save initial messages synchronously so they show up immediately, then run agent in background
  if (status === "running") {
    const initialMessages: Record<string, string> = {
      one_time: `Please start executing task "${name}". ${description || ""}`,
      proactive: `Please start tracking goal "${name}" and provide initial analysis. ${description || ""}`,
      periodic: `Task "${name}" has been created. Please confirm configuration and prepare for first execution.`,
    };

    const userMsg = initialMessages[type] || initialMessages.one_time;

    await prisma.message.create({
      data: {
        taskId: task.id,
        role: "system",
        content: `Task created: ${name} (${type})`,
      },
    });

    await prisma.message.create({
      data: {
        taskId: task.id,
        role: "user",
        content: userMsg,
      },
    });

    // Fire and forget -- don't await
    runInitialTaskAgent(projectId, task.id, name, type, userMsg);
  }

  // Return immediately
  const updatedTask = await prisma.task.findUnique({
    where: { id: task.id },
    include: { _count: { select: { messages: true } } },
  });

  return NextResponse.json(updatedTask, { status: 201 });
}
