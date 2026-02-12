import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { chat } from "@/lib/agent";
import {
  createWorkspace,
  initGitRepo,
  getWorkspacePath,
  getContextDir,
  getDraftDir,
  createTaskDir,
  commitChange,
  writeWorkspaceFile,
} from "@/lib/workspace";
import type { ScheduleConfig } from "@/types";

export async function GET() {
  const projects = await prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { tasks: true } },
    },
  });
  return NextResponse.json(projects);
}

// Background agent execution -- not awaited by the request
async function runInitialAgent(
  projectId: string,
  taskId: string,
  instruction: string,
  userMsg: string
) {
  try {
    const workspacePath = getWorkspacePath(projectId);

    // Create task subdirectory
    const taskDir = await createTaskDir(projectId, taskId);
    const addDirs = [getContextDir(projectId), getDraftDir(projectId)];

    // First classify the task type
    const classifyTask = {
      id: "classify-temp",
      projectId,
      name: "classify",
      description: "",
      type: "one_time" as const,
      status: "pending",
      sessionId: null,
      scheduleConfig: null,
      nextRunAt: null,
      lastRunAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const classifyResponse = await chat({
      task: classifyTask,
      userMessage: `Based on the following project instruction, determine the most suitable task type. Reply with only a JSON object, nothing else:
{"type": "one_time or periodic or proactive", "name": "short task name", "intervalMinutes": 60}

type description:
- one_time: a one-time task, completed after execution
- periodic: a task that needs to run periodically (e.g. daily reports, monitoring)
- proactive: a long-term goal that needs continuous tracking and proactive work

If the type is periodic, set intervalMinutes to an appropriate interval in minutes (e.g. daily=1440, hourly=60).

Project instruction: ${instruction}`,
      sharedContext: [],
      projectInstruction: "",
      workspacePath,
      addDirs,
      taskDir,
    });

    // Parse classification
    let taskType = "one_time";
    let taskName: string | undefined;
    let intervalMinutes = 60;

    try {
      const jsonMatch = classifyResponse.content.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (["one_time", "periodic", "proactive"].includes(parsed.type)) {
          taskType = parsed.type;
        }
        if (parsed.name) taskName = parsed.name;
        if (parsed.intervalMinutes && typeof parsed.intervalMinutes === "number") {
          intervalMinutes = parsed.intervalMinutes;
        }
      }
    } catch {
      // keep defaults
    }

    // Update task with classified type
    const updateData: Record<string, unknown> = { type: taskType };
    if (taskName) updateData.name = taskName;
    if (taskType === "periodic") {
      updateData.scheduleConfig = JSON.stringify({ intervalMinutes });
      updateData.nextRunAt = new Date(Date.now() + intervalMinutes * 60 * 1000);
    }
    const task = await prisma.task.update({
      where: { id: taskId },
      data: updateData,
    });

    // Update the system message with correct type
    if (taskName) {
      await prisma.message.create({
        data: {
          taskId,
          role: "system",
          content: `Task type identified as: ${taskType}${taskName ? `, name: ${taskName}` : ""}`,
        },
      });
    }

    // Call agent for initial response
    const response = await chat({
      task,
      userMessage: userMsg,
      sharedContext: [],
      projectInstruction: instruction,
      workspacePath,
      addDirs,
      taskDir,
    });

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

    if (response.taskStatusChange) {
      await prisma.task.update({
        where: { id: taskId },
        data: { status: response.taskStatusChange },
      });
    } else if (task.type === "one_time") {
      // Auto-complete one_time tasks when agent finishes without explicit status change
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
    await commitChange(projectId, `Agent: ${taskName || "initial analysis"}`);
  } catch (error) {
    console.error("Background agent execution failed:", error);
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
  const { name, description, instruction, feishuLink, suggestedTask, contextSources } = body;

  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  // Create project first
  const project = await prisma.project.create({
    data: {
      name,
      description: description || "",
      instruction: instruction || "",
      feishuLink: feishuLink || null,
    },
  });

  // Create workspace directory and init git repo
  const workspacePath = await createWorkspace(project.id);
  await initGitRepo(project.id);

  // Save the workspacePath to the project record
  await prisma.project.update({
    where: { id: project.id },
    data: { workspacePath },
  });

  // Save context sources to workspace/context/ and DB
  if (contextSources && Array.isArray(contextSources)) {
    for (const src of contextSources) {
      const fileName = src.type === "url" ? `${src.name}.url` : src.name;
      await writeWorkspaceFile(project.id, `context/${fileName}`, src.value);
      await prisma.contextItem.create({
        data: {
          projectId: project.id,
          name: src.name,
          type: src.type === "url" ? "url" : "text_note",
          content: src.value,
        },
      });
    }
    await commitChange(project.id, `Add ${contextSources.length} context sources`);
  }

  // Create task from suggestedTask (from AI parse) or from instruction
  if (suggestedTask) {
    let status = "running";
    let nextRunAt: Date | null = null;
    const sessionId = crypto.randomUUID();

    if (suggestedTask.type === "periodic" && suggestedTask.scheduleConfig) {
      try {
        const config: ScheduleConfig = JSON.parse(suggestedTask.scheduleConfig);
        nextRunAt = new Date(Date.now() + config.intervalMinutes * 60 * 1000);
      } catch {
        // invalid config
      }
    }

    const task = await prisma.task.create({
      data: {
        projectId: project.id,
        name: suggestedTask.name,
        description: suggestedTask.description || "",
        type: suggestedTask.type,
        status,
        sessionId,
        nextRunAt,
      },
    });

    await prisma.message.create({
      data: {
        taskId: task.id,
        role: "system",
        content: `Task created: ${suggestedTask.name} (${suggestedTask.type})`,
      },
    });

    const userMsg = suggestedTask.description || instruction || "";
    await prisma.message.create({
      data: { taskId: task.id, role: "user", content: userMsg },
    });

    // Fire and forget
    runInitialAgent(project.id, task.id, instruction, userMsg);
  } else if (instruction && instruction.trim()) {
    // Fallback: no suggestedTask, but has instruction
    const task = await prisma.task.create({
      data: {
        projectId: project.id,
        name,
        description: instruction,
        type: "one_time",
        status: "running",
      },
    });

    await prisma.message.create({
      data: {
        taskId: task.id,
        role: "system",
        content: `Task created: ${name} (analyzing task type...)`,
      },
    });

    const userMsg = `${instruction}`;
    await prisma.message.create({
      data: { taskId: task.id, role: "user", content: userMsg },
    });

    runInitialAgent(project.id, task.id, instruction, userMsg);
  }

  // Return immediately
  const result = await prisma.project.findUnique({
    where: { id: project.id },
    include: { _count: { select: { tasks: true } } },
  });

  return NextResponse.json(result, { status: 201 });
}
