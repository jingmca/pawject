import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get("projectId");
  const taskId = request.nextUrl.searchParams.get("taskId");

  const where: Record<string, string> = {};
  if (projectId) where.projectId = projectId;
  if (taskId) where.taskId = taskId;

  const outputs = await prisma.outputArtifact.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { task: { select: { name: true, type: true } } },
  });

  return NextResponse.json(outputs);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { projectId, taskId, name, type, content, summary } = body;

  if (!projectId || !name || !type || !content) {
    return NextResponse.json(
      { error: "projectId, name, type, and content are required" },
      { status: 400 }
    );
  }

  const output = await prisma.outputArtifact.create({
    data: {
      projectId,
      taskId: taskId || null,
      name,
      type,
      content,
      summary: summary || null,
    },
  });

  return NextResponse.json(output, { status: 201 });
}
