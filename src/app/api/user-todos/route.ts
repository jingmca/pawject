import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// GET /api/user-todos?projectId=xxx — list user todos (optionally filter by resolved)
export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const resolved = request.nextUrl.searchParams.get("resolved");
  const where: Record<string, unknown> = { projectId };
  if (resolved === "true") where.resolved = true;
  else if (resolved === "false") where.resolved = false;

  const todos = await prisma.userTodo.findMany({
    where,
    orderBy: [{ resolved: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(todos);
}

// POST /api/user-todos — create a user todo (called by Agent skill)
export async function POST(request: Request) {
  const body = await request.json();
  const { projectId, taskId, type, query, suggestion, priority } = body;

  if (!projectId || !taskId || !type || !query) {
    return NextResponse.json(
      { error: "projectId, taskId, type, and query are required" },
      { status: 400 }
    );
  }

  if (!["ASK_USER_CONTEXT", "ASK_USER_CONFIRM"].includes(type)) {
    return NextResponse.json(
      { error: "type must be ASK_USER_CONTEXT or ASK_USER_CONFIRM" },
      { status: 400 }
    );
  }

  const todo = await prisma.userTodo.create({
    data: {
      projectId,
      taskId,
      type,
      query,
      suggestion: suggestion || null,
      priority: priority || "medium",
    },
  });

  return NextResponse.json(todo, { status: 201 });
}

// PATCH /api/user-todos — resolve a todo (user responds)
export async function PATCH(request: Request) {
  const body = await request.json();
  const { id, response } = body;

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const todo = await prisma.userTodo.update({
    where: { id },
    data: {
      resolved: true,
      response: response || null,
      resolvedAt: new Date(),
    },
  });

  return NextResponse.json(todo);
}
