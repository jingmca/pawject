import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { chatStream, parseClaudeResult, ensureClaudeMd, type ProjectMeta } from "@/lib/agent";
import { commitChange, getWorkspacePath, getContextDir, getDraftDir, createTaskDir } from "@/lib/workspace";

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

  // Resume task to running if not already
  if (task.status !== "running") {
    await prisma.task.update({
      where: { id: taskId },
      data: { status: "running" },
    });
  }

  const workspacePath = getWorkspacePath(task.projectId);
  const projectMeta: ProjectMeta = {
    name: task.project.name,
    description: task.project.description,
  };

  // Create task subdirectory
  const taskDir = await createTaskDir(task.projectId, taskId);
  const addDirs = [getContextDir(task.projectId), getDraftDir(task.projectId)];

  // Write CLAUDE.md with system prompt before starting the CLI
  await ensureClaudeMd(
    task,
    task.project.instruction,
    task.project.context,
    workspacePath,
    task.projectId,
    taskDir,
    projectMeta
  );

  // Check if agent has previously replied in this task (determines -c flag)
  const agentMessageCount = await prisma.message.count({
    where: { taskId, role: "agent" },
  });
  const hasAgentReplied = agentMessageCount > 0;

  // Create SSE stream
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const safeEnqueue = (data: Uint8Array) => {
        if (!closed) {
          try { controller.enqueue(data); } catch { /* controller already closed */ }
        }
      };
      const safeClose = () => {
        if (!closed) {
          closed = true;
          try { controller.close(); } catch { /* already closed */ }
        }
      };

      try {
        const toolCalls: Array<{ tool: string; input: unknown; timestamp: number }> = [];

        const { done } = chatStream({
          task,
          userMessage: content,
          sharedContext: task.project.context,
          projectInstruction: task.project.instruction,
          workspacePath,
          hasAgentReplied,
          addDirs,
          taskDir,
          projectMeta,
          callbacks: {
            onToken: (text) => {
              safeEnqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "delta", content: text })}\n\n`
                )
              );
            },
            onToolUse: (tool, input) => {
              const entry = { tool, input, timestamp: Date.now() };
              toolCalls.push(entry);
              safeEnqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "tool_use", tool, input })}\n\n`
                )
              );
            },
            onResult: async (result) => {
              try {
                const agentResponse = parseClaudeResult(result);

                // Build agent content, appending askUser question if present
                const askTag = agentResponse.askUserType || "ASK_USER";
                const agentContent = agentResponse.askUser
                  ? (agentResponse.content ? agentResponse.content + "\n\n" : "") +
                    `[${askTag}: ${agentResponse.askUser}]`
                  : agentResponse.content;

                // Save agent message with metadata for askUser and toolCalls
                const metadata: Record<string, unknown> = {};
                if (agentResponse.askUser) {
                  metadata.askUser = agentResponse.askUser;
                  metadata.askUserType = agentResponse.askUserType || "ASK_USER_CONTEXT";
                }
                if (toolCalls.length > 0) {
                  metadata.toolCalls = toolCalls;
                }

                const messageData: {
                  taskId: string;
                  role: string;
                  content: string;
                  metadata?: string;
                } = {
                  taskId,
                  role: "agent",
                  content: agentContent,
                };

                if (Object.keys(metadata).length > 0) {
                  messageData.metadata = JSON.stringify(metadata);
                }

                const agentMessage = await prisma.message.create({
                  data: messageData,
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

                // Handle status change (askUser -> awaiting_input), or auto-complete one_time tasks
                const effectiveStatus = agentResponse.taskStatusChange
                  || (task.type === "one_time" ? "completed" : undefined);

                if (effectiveStatus) {
                  await prisma.task.update({
                    where: { id: taskId },
                    data: { status: effectiveStatus },
                  });
                }

                // Update task's sessionId if Claude result includes one and task doesn't have it yet
                if (agentResponse.sessionId && !task.sessionId) {
                  await prisma.task.update({
                    where: { id: taskId },
                    data: { sessionId: agentResponse.sessionId },
                  });
                }

                // Commit workspace changes
                await commitChange(
                  task.projectId,
                  `Agent: ${task.name}`
                );

                // Send completion event
                safeEnqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      type: "done",
                      messageId: agentMessage.id,
                      taskStatusChange: effectiveStatus || agentResponse.taskStatusChange,
                      artifacts: agentResponse.artifacts,
                      askUser: agentResponse.askUser,
                      askUserType: agentResponse.askUserType,
                      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
                    })}\n\n`
                  )
                );
              } catch (err) {
                const errMsg =
                  err instanceof Error ? err.message : String(err);
                console.error("Error processing result:", err);
                safeEnqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: "error", error: errMsg })}\n\n`
                  )
                );
              }
            },
          },
        });

        // Wait for the Claude process to complete
        await done;
      } catch (error) {
        // Agent execution failed -- save error to conversation and mark task
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error("Stream error:", error);

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

        safeEnqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", error: errMsg })}\n\n`
          )
        );
      } finally {
        safeClose();
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
