import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getGitLog } from "@/lib/workspace";
import type { GraphEvent } from "@/types";

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json(
      { error: "projectId is required" },
      { status: 400 }
    );
  }

  const events: GraphEvent[] = [];

  // Get git log entries and map to GraphEvent format
  const gitEntries = await getGitLog(projectId);

  for (const entry of gitEntries) {
    // Determine event type from the commit message and file paths
    let type: GraphEvent["type"] = "draft_generated";
    if (entry.message.startsWith("Initial workspace")) {
      continue; // Skip initial setup commit
    }

    const hasContextFiles = entry.files.some((f) => f.startsWith("context/"));
    const hasDraftFiles = entry.files.some((f) => f.startsWith("draft/"));

    if (hasContextFiles && !hasDraftFiles) {
      type = "context_added";
    } else if (hasDraftFiles) {
      type = "draft_generated";
    }

    const label =
      type === "context_added"
        ? `Context updated: ${entry.files.filter((f) => f.startsWith("context/")).join(", ")}`
        : entry.message;

    events.push({
      id: entry.hash,
      type,
      label,
      detail: entry.files.join(", "),
      timestamp: new Date(entry.timestamp),
    });
  }

  // Get task creation events from DB
  const tasks = await prisma.task.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      status: true,
      createdAt: true,
    },
  });

  for (const task of tasks) {
    events.push({
      id: `task-created-${task.id}`,
      type: "task_created",
      label: `Task created: ${task.name}`,
      detail: `Status: ${task.status}`,
      taskId: task.id,
      timestamp: task.createdAt,
    });

    if (task.status === "completed") {
      events.push({
        id: `task-completed-${task.id}`,
        type: "task_completed",
        label: `Task completed: ${task.name}`,
        detail: "",
        taskId: task.id,
        timestamp: task.createdAt, // Approximate; could use updatedAt if available
      });
    }
  }

  // Also check for ask_user events from messages
  const askUserMessages = await prisma.message.findMany({
    where: {
      task: { projectId },
      role: "agent",
      metadata: { not: null },
    },
    orderBy: { createdAt: "desc" },
    include: {
      task: { select: { id: true, name: true } },
    },
  });

  for (const msg of askUserMessages) {
    try {
      const metadata = JSON.parse(msg.metadata!);
      if (metadata.askUser) {
        events.push({
          id: `ask-user-${msg.id}`,
          type: "ask_user",
          label: `Awaiting input: ${msg.task.name}`,
          detail: metadata.askUser,
          taskId: msg.task.id,
          timestamp: msg.createdAt,
        });
      }
    } catch {
      // Skip invalid metadata
    }
  }

  // Sort all events by timestamp descending
  events.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return NextResponse.json(events);
}
