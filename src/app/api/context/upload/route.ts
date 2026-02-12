import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { writeWorkspaceFile, commitChange } from "@/lib/workspace";

export async function POST(request: Request) {
  const body = await request.json();
  const { projectId, name, content, type } = body;

  if (!projectId || !name || !content) {
    return NextResponse.json(
      { error: "projectId, name, and content are required" },
      { status: 400 }
    );
  }

  // Write the file to the workspace context/ directory
  const relativePath = `context/${name}`;
  await writeWorkspaceFile(projectId, relativePath, content);

  // Create ContextItem in DB
  const contextItem = await prisma.contextItem.create({
    data: {
      projectId,
      name,
      type: type || "file",
      content,
    },
  });

  // Commit the change with git
  await commitChange(projectId, `Context added: ${name}`);

  return NextResponse.json(contextItem, { status: 201 });
}
