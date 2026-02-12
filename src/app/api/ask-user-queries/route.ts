import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { AskUserQuery } from "@/types";

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json(
      { error: "projectId is required" },
      { status: 400 }
    );
  }

  // Find all tasks in awaiting_input status for this project
  const tasks = await prisma.task.findMany({
    where: {
      projectId,
      status: "awaiting_input",
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (tasks.length === 0) {
    return NextResponse.json([]);
  }

  const queries: AskUserQuery[] = [];

  // For each awaiting_input task, find the latest agent message with askUser metadata
  for (const task of tasks) {
    const latestAgentMessage = await prisma.message.findFirst({
      where: {
        taskId: task.id,
        role: "agent",
        metadata: { not: null },
      },
      orderBy: { createdAt: "desc" },
    });

    if (latestAgentMessage && latestAgentMessage.metadata) {
      try {
        const metadata = JSON.parse(latestAgentMessage.metadata);
        if (metadata.askUser) {
          queries.push({
            taskId: task.id,
            taskName: task.name,
            question: metadata.askUser,
            messageId: latestAgentMessage.id,
            createdAt: latestAgentMessage.createdAt,
          });
        }
      } catch {
        // Invalid metadata JSON, skip
      }
    }
  }

  return NextResponse.json(queries);
}
