import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { chatStream } from "@/lib/agent";

export async function GET(request: NextRequest) {
  const taskId = request.nextUrl.searchParams.get("taskId");
  if (!taskId) {
    return NextResponse.json(
      { error: "taskId is required" },
      { status: 400 }
    );
  }

  const messages = await prisma.message.findMany({
    where: { taskId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(messages);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { taskId, content } = body;

  if (!taskId || !content) {
    return NextResponse.json(
      { error: "taskId and content are required" },
      { status: 400 }
    );
  }

  // Save user message
  await prisma.message.create({
    data: { taskId, role: "user", content },
  });

  // Load task with project context
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      project: { include: { context: true } },
    },
  });

  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  // Load message history
  const messageHistory = await prisma.message.findMany({
    where: { taskId },
    orderBy: { createdAt: "asc" },
  });

  // Create SSE stream
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const generator = chatStream({
          task,
          userMessage: content,
          messageHistory,
          sharedContext: task.project.context,
          projectInstruction: task.project.instruction,
        });

        let fullContent = "";
        let result = await generator.next();

        while (!result.done) {
          const chunk = result.value as string;
          fullContent += chunk;
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "delta", content: chunk })}\n\n`)
          );
          result = await generator.next();
        }

        // result.value is the parsed AgentResponse
        const agentResponse = result.value;

        // Save agent message
        const agentMessage = await prisma.message.create({
          data: {
            taskId,
            role: "agent",
            content: agentResponse.content,
          },
        });

        // Handle artifacts
        if (agentResponse.artifacts) {
          for (const artifact of agentResponse.artifacts) {
            await prisma.outputArtifact.create({
              data: {
                projectId: task.projectId,
                taskId,
                name: artifact.name,
                type: artifact.type,
                content: artifact.content,
                summary: artifact.summary,
              },
            });
          }
        }

        // Handle status change
        if (agentResponse.taskStatusChange) {
          await prisma.task.update({
            where: { id: taskId },
            data: { status: agentResponse.taskStatusChange },
          });
        }

        // Ensure running status if task was awaiting input
        if (task.status === "awaiting_input") {
          await prisma.task.update({
            where: { id: taskId },
            data: { status: "running" },
          });
        }

        // Send completion event
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: "done",
              messageId: agentMessage.id,
              taskStatusChange: agentResponse.taskStatusChange,
              artifacts: agentResponse.artifacts,
            })}\n\n`
          )
        );
      } catch (error) {
        console.error("Stream error:", error);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", error: "Agent response failed" })}\n\n`
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
