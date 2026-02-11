import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ outputId: string }> }
) {
  const { outputId } = await params;
  await prisma.outputArtifact.delete({ where: { id: outputId } });
  return NextResponse.json({ success: true });
}
