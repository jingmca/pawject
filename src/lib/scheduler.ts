import { prisma } from "@/lib/db";
import { executePeriodicRun, generateProgressUpdate } from "@/lib/agent";
import type { ScheduleConfig } from "@/types";

export async function checkAndRunScheduledTasks(): Promise<{
  periodicRan: number;
  progressUpdates: number;
}> {
  let periodicRan = 0;
  let progressUpdates = 0;

  // 1. Check periodic tasks that are due
  const now = new Date();
  const periodicTasks = await prisma.task.findMany({
    where: {
      type: "periodic",
      status: "running",
      nextRunAt: { lte: now },
    },
    include: {
      project: { include: { context: true } },
    },
  });

  for (const task of periodicTasks) {
    try {
      const response = await executePeriodicRun(
        task,
        task.project.context,
        task.project.instruction
      );

      // Save agent message
      await prisma.message.create({
        data: {
          taskId: task.id,
          role: "agent",
          content: response.content,
        },
      });

      // Save artifacts
      if (response.artifacts) {
        for (const artifact of response.artifacts) {
          await prisma.outputArtifact.create({
            data: {
              projectId: task.projectId,
              taskId: task.id,
              name: artifact.name,
              type: artifact.type,
              content: artifact.content,
              summary: artifact.summary,
            },
          });
        }
      }

      // Calculate next run
      let nextRunAt: Date | null = null;
      if (task.scheduleConfig) {
        try {
          const config: ScheduleConfig = JSON.parse(task.scheduleConfig);
          nextRunAt = new Date(
            now.getTime() + config.intervalMinutes * 60 * 1000
          );
        } catch {
          // invalid config
        }
      }

      await prisma.task.update({
        where: { id: task.id },
        data: {
          lastRunAt: now,
          nextRunAt,
          status: response.taskStatusChange || "running",
        },
      });

      periodicRan++;
    } catch (error) {
      console.error(`Periodic task ${task.id} failed:`, error);
      await prisma.task.update({
        where: { id: task.id },
        data: { status: "error" },
      });
    }
  }

  // 2. Check long-term tasks for progress updates (only if no recent messages)
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const longTermTasks = await prisma.task.findMany({
    where: {
      type: "long_term",
      status: "running",
    },
    include: {
      project: { include: { context: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  for (const task of longTermTasks) {
    const lastMessage = task.messages[0];
    if (lastMessage && lastMessage.createdAt > oneHourAgo) {
      continue; // Skip if there was recent activity
    }

    try {
      const history = await prisma.message.findMany({
        where: { taskId: task.id },
        orderBy: { createdAt: "asc" },
      });

      const response = await generateProgressUpdate(
        task,
        history,
        task.project.context,
        task.project.instruction
      );

      await prisma.message.create({
        data: {
          taskId: task.id,
          role: "agent",
          content: response.content,
        },
      });

      if (response.artifacts) {
        for (const artifact of response.artifacts) {
          await prisma.outputArtifact.create({
            data: {
              projectId: task.projectId,
              taskId: task.id,
              name: artifact.name,
              type: artifact.type,
              content: artifact.content,
              summary: artifact.summary,
            },
          });
        }
      }

      if (response.taskStatusChange) {
        await prisma.task.update({
          where: { id: task.id },
          data: { status: response.taskStatusChange },
        });
      }

      progressUpdates++;
    } catch (error) {
      console.error(`Long-term task ${task.id} update failed:`, error);
    }
  }

  return { periodicRan, progressUpdates };
}
