import { NextRequest, NextResponse } from "next/server";
import { listDraftFilesDetailed } from "@/lib/workspace";

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json(
      { error: "projectId is required" },
      { status: 400 }
    );
  }

  try {
    const files = await listDraftFilesDetailed(projectId);
    return NextResponse.json(files);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}
