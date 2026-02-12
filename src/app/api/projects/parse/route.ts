import { NextResponse } from "next/server";
import { parseProjectInstruction } from "@/lib/agent";

export async function POST(request: Request) {
  const body = await request.json();
  const { instruction } = body;

  if (!instruction) {
    return NextResponse.json(
      { error: "instruction is required" },
      { status: 400 }
    );
  }

  const parsed = await parseProjectInstruction(instruction);
  return NextResponse.json(parsed);
}
