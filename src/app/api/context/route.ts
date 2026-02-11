import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json(
      { error: "projectId is required" },
      { status: 400 }
    );
  }

  const items = await prisma.contextItem.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(items);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { projectId, name, type, content, metadata } = body;

  if (!projectId || !name || !type || !content) {
    return NextResponse.json(
      { error: "projectId, name, type, and content are required" },
      { status: 400 }
    );
  }

  const item = await prisma.contextItem.create({
    data: {
      projectId,
      name,
      type,
      content,
      metadata: metadata ? JSON.stringify(metadata) : null,
    },
  });

  return NextResponse.json(item, { status: 201 });
}
