import { prisma } from "@/lib/db";
import { executePeriodicRun, generateProgressUpdate } from "@/lib/agent";
import { getWorkspacePath, commitChange } from "@/lib/workspace";
import type { ScheduleConfig } from "@/types";

export async function checkAndRunScheduledTasks(): Promise<{
  periodicRan: number;
  progressUpdates: number;
}> {
  let periodicRan = 0;
  let progressUpdates = 0;

  const now = new Date();

  // 1. Check periodic tasks that are due
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
      await prisma.message.create({
        data: {
          taskId: task.id,
          role: "system",
          content: `定期执行触发 (${new Date().toLocaleString("zh-CN")})`,
        },
      });

      const workspacePath =
        task.project.workspacePath || getWorkspacePath(task.projectId);

      const response = await executePeriodicRun(
        task,
        task.project.context,
        task.project.instruction,
        workspacePath
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

      // Commit workspace changes
      await commitChange(task.projectId, `Periodic: ${task.name}`);

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
      const errMsg = error instanceof Error ? error.message : String(error);
      await prisma.message.create({
        data: {
          taskId: task.id,
          role: "system",
          content: `定期执行出错：${errMsg}`,
        },
      });
    }
  }

  // 2. Check proactive tasks for progress updates
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const proactiveTasks = await prisma.task.findMany({
    where: {
      type: "proactive",
      status: "running",
    },
    include: {
      project: { include: { context: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  for (const task of proactiveTasks) {
    const lastMessage = task.messages[0];
    if (lastMessage && lastMessage.createdAt > oneHourAgo) {
      continue;
    }

    try {
      await prisma.message.create({
        data: {
          taskId: task.id,
          role: "system",
          content: `阶段性进展更新 (${new Date().toLocaleString("zh-CN")})`,
        },
      });

      const workspacePath =
        task.project.workspacePath || getWorkspacePath(task.projectId);

      const response = await generateProgressUpdate(
        task,
        task.project.context,
        task.project.instruction,
        workspacePath
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

      // Commit workspace changes
      await commitChange(task.projectId, `Progress: ${task.name}`);

      if (response.taskStatusChange) {
        await prisma.task.update({
          where: { id: task.id },
          data: { status: response.taskStatusChange },
        });
      }

      progressUpdates++;
    } catch (error) {
      console.error(`Proactive task ${task.id} update failed:`, error);
      const errMsg = error instanceof Error ? error.message : String(error);
      await prisma.message.create({
        data: {
          taskId: task.id,
          role: "system",
          content: `进展更新出错：${errMsg}`,
        },
      });
    }
  }

  return { periodicRan, progressUpdates };
}
