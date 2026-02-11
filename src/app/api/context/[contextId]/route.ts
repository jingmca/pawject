import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ contextId: string }> }
) {
  const { contextId } = await params;
  const body = await request.json();

  const item = await prisma.contextItem.update({
    where: { id: contextId },
    data: body,
  });

  return NextResponse.json(item);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ contextId: string }> }
) {
  const { contextId } = await params;
  await prisma.contextItem.delete({ where: { id: contextId } });
  return NextResponse.json({ success: true });
}
