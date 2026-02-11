import { NextResponse } from "next/server";
import { checkAndRunScheduledTasks } from "@/lib/scheduler";

export async function POST() {
  try {
    const result = await checkAndRunScheduledTasks();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Scheduler error:", error);
    return NextResponse.json(
      { error: "Scheduler execution failed" },
      { status: 500 }
    );
  }
}
