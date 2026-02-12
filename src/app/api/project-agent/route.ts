import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  startProjectAgent,
  stopProjectAgent,
  getProjectAgentStatus,
} from "@/lib/project-agent";

// GET /api/project-agent?projectId=xxx — get agent status
export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const status = await getProjectAgentStatus(projectId);
  return NextResponse.json(status);
}

// POST /api/project-agent — register/start project agent
// When called from CLI (pawject agent-register): just upsert DB record
// When called with action=start: actually start the agent process
// When called with action=stop: stop the agent process
export async function POST(request: Request) {
  const body = await request.json();
  const { projectId, pid, sessionId, action } = body;

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  // Handle lifecycle actions (called from frontend)
  if (action === "start") {
    try {
      await startProjectAgent(projectId);
      const status = await getProjectAgentStatus(projectId);
      return NextResponse.json(status);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  if (action === "stop") {
    await stopProjectAgent(projectId);
    const status = await getProjectAgentStatus(projectId);
    return NextResponse.json(status);
  }

  // Default: register/upsert (called from pawject CLI agent-register)
  const agent = await prisma.projectAgent.upsert({
    where: { projectId },
    create: {
      projectId,
      pid: pid || null,
      sessionId: sessionId || null,
      status: "running",
      lastHeartbeat: new Date(),
    },
    update: {
      pid: pid || undefined,
      sessionId: sessionId || undefined,
      status: "running",
      lastHeartbeat: new Date(),
    },
  });

  return NextResponse.json(agent);
}

// PATCH /api/project-agent — heartbeat or status update
export async function PATCH(request: Request) {
  const body = await request.json();
  const { projectId, status, pid, sessionId } = body;

  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  const data: Record<string, unknown> = {
    lastHeartbeat: new Date(),
  };
  if (status) data.status = status;
  if (pid !== undefined) data.pid = pid;
  if (sessionId !== undefined) data.sessionId = sessionId;

  try {
    const agent = await prisma.projectAgent.update({
      where: { projectId },
      data,
    });
    return NextResponse.json(agent);
  } catch {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }
}
