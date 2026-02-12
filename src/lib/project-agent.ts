import { prisma } from "@/lib/db";
import { claudeStream, type ClaudeResult } from "@/lib/claude-code";
import { getWorkspacePath, getContextDir, getDraftDir } from "@/lib/workspace";
import { writeWorkspaceFile } from "@/lib/workspace";
import type { ChildProcess } from "node:child_process";

const HEARTBEAT_INTERVAL_MS = 30_000; // 30 seconds
const HEARTBEAT_TIMEOUT_MS = 90_000;  // 90 seconds — consider crashed if no heartbeat

// In-memory registry of running project agents
const runningAgents = new Map<string, {
  process: ChildProcess;
  heartbeatTimer: ReturnType<typeof setInterval>;
  projectId: string;
}>();

/**
 * Build the Project Agent CLAUDE.md content.
 */
function buildProjectAgentClaudeMd(project: {
  id: string;
  name: string;
  description: string;
  instruction: string;
}): string {
  return `# Project Agent: ${project.name}
> ${project.description}

## 你的角色
你是 **Project Agent**（项目管理者），负责管理和协调项目中所有任务的执行。
你拥有全局视野，了解项目下的所有 task、context 和产出物。

## 项目信息
- Project ID: \`${project.id}\`
- API Base: \`${process.env.PAWJECT_API_URL || "http://localhost:3000"}\`

${project.instruction ? `## 项目指令\n${project.instruction}\n` : ""}

## 你的职责

### 1. 巡检任务状态
定期检查各 task 子目录下的 \`todo.md\` 文件，了解每个任务的执行进度和状态。
\`\`\`bash
pawject tasks                    # 列出所有任务
pawject task <id>                # 查看任务详情和最近消息
\`\`\`

### 2. 汇总用户待办
读取各 task 的 todo.md 中的 ASK_USER 条目，汇总到项目级 \`user_todos.md\`。
给每个待办标注优先级和建议（如信息该补充到项目级还是任务级）。
\`\`\`bash
pawject user-todos                                    # 查看已有的用户待办
pawject user-todo-create --type ASK_USER_CONTEXT \\
  --query "问题" --task-id <id> --priority high       # 创建新的用户待办
\`\`\`

### 3. 维护任务列表
更新 \`tasks.md\` 文件，保持任务列表与实际状态同步。
\`\`\`bash
pawject task-create --name "任务名" --type one_time    # 创建新任务
pawject sync-task-status --task-id <id> --status running  # 更新任务状态
\`\`\`

### 4. 维护工作区视图
更新 \`workspace_view.md\`，包含排序规则和推荐理由。

### 5. 定期发送心跳
\`\`\`bash
pawject heartbeat   # 告知系统你仍在运行
\`\`\`

## 工作区目录结构
\`\`\`
workspaces/${project.id}/
├── CLAUDE.md           ← 本文件（你的角色定义）
├── tasks.md            ← 任务列表和状态
├── user_todos.md       ← 用户待办汇总
├── workspace_view.md   ← 工作区视图排序规则
├── context/            ← 项目级共享上下文
├── draft/              ← 产出文件
└── tasks/
    ├── {taskId-1}/
    │   ├── CLAUDE.md   ← 任务级指令
    │   └── todo.md     ← 任务内部进度
    └── {taskId-2}/
        ├── CLAUDE.md
        └── todo.md
\`\`\`

## 可用工具 (pawject CLI)
| 命令 | 功能 |
|------|------|
| \`pawject tasks\` | 列出所有任务 |
| \`pawject task <id>\` | 任务详情 + 最近消息 |
| \`pawject task-create --name "x" --type T\` | 创建新任务 |
| \`pawject task-stop <id>\` | 停止任务 |
| \`pawject sync-task-status --task-id ID --status S\` | 更新任务状态 |
| \`pawject user-todos\` | 列出用户待办 |
| \`pawject user-todo-create --type T --query "q"\` | 创建用户待办 |
| \`pawject user-todo-resolve --id ID\` | 标记待办已解决 |
| \`pawject drafts\` | 列出 draft 文件 |
| \`pawject context\` | 列出上下文项 |
| \`pawject heartbeat\` | 发送心跳 |

## 工作流程
1. **启动时**：执行 \`pawject agent-register\` 注册自己，然后巡检所有任务状态
2. **定期巡检**：每隔一段时间读取各 task/todo.md，检查是否有新的 ASK_USER 条目
3. **汇总待办**：将各 task 的 ASK_USER 条目汇总写入 user_todos.md，并同步到 DB
4. **更新视图**：根据任务状态和优先级更新 workspace_view.md
5. **心跳**：定期执行 \`pawject heartbeat\` 保持存活状态
`;
}

/**
 * Write project-level management files (tasks.md, user_todos.md, workspace_view.md)
 * with initial content if they don't exist.
 */
async function ensureProjectFiles(projectId: string): Promise<void> {
  const files: Array<{ path: string; content: string }> = [
    {
      path: "tasks.md",
      content: `# Tasks\n\n<!-- Project Agent maintains this file -->\n\n| ID | Name | Type | Status |\n|---|---|---|---|\n`,
    },
    {
      path: "user_todos.md",
      content: `# User Todos\n\n<!-- Project Agent aggregates ASK_USER items here -->\n\nNo pending items.\n`,
    },
    {
      path: "workspace_view.md",
      content: `# Workspace View\n\n<!-- Project Agent maintains sorting rules here -->\n\n## Sort Order\nORDER BY status_priority ASC, updatedAt DESC\n\n## Status Priority\n- awaiting_input: 1\n- running: 2\n- pending: 3\n- completed: 4\n`,
    },
  ];

  for (const file of files) {
    try {
      const wsPath = getWorkspacePath(projectId);
      const fullPath = `${wsPath}/${file.path}`;
      const fs = await import("node:fs/promises");
      await fs.access(fullPath);
    } catch {
      await writeWorkspaceFile(projectId, file.path, file.content);
    }
  }
}

/**
 * Start or restart the Project Agent for a given project.
 */
export async function startProjectAgent(projectId: string): Promise<void> {
  // Stop existing agent if running
  await stopProjectAgent(projectId);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { context: true },
  });

  if (!project) {
    console.error(`[project-agent] Project ${projectId} not found`);
    return;
  }

  const workspacePath = getWorkspacePath(projectId);

  // Write Project Agent CLAUDE.md
  const agentClaudeMd = buildProjectAgentClaudeMd(project);
  await writeWorkspaceFile(projectId, "CLAUDE.md", agentClaudeMd);

  // Ensure management files exist
  await ensureProjectFiles(projectId);

  // Build the initial prompt for the Project Agent
  const initialPrompt = `你是 Project Agent，刚刚被启动。请执行以下初始化步骤：

1. 执行 \`pawject agent-register\` 注册自己
2. 执行 \`pawject tasks\` 查看当前所有任务
3. 检查各任务的 todo.md 文件，了解任务状态
4. 如果有 ASK_USER 待办，汇总到 user_todos.md 并通过 \`pawject user-todo-create\` 同步到 DB
5. 更新 tasks.md 反映当前任务状态
6. 执行 \`pawject heartbeat\` 发送心跳

完成后，持续保持巡检状态。每当你完成一轮巡检后，执行 \`pawject heartbeat\` 然后等待下一轮。`;

  const addDirs = [getContextDir(projectId), getDraftDir(projectId)];

  console.log(`[project-agent] Starting for project ${projectId}`);

  const { process: childProcess, done } = claudeStream({
    prompt: initialPrompt,
    cwd: workspacePath,
    addDirs,
    callbacks: {
      onToken: (text) => {
        // Log Project Agent output
        if (process.env.DEBUG_PROJECT_AGENT) {
          process.stdout.write(text);
        }
      },
      onResult: async (result) => {
        console.log(`[project-agent] ${projectId} completed: cost=$${result.total_cost_usd?.toFixed(4)}`);

        // Update DB status
        await prisma.projectAgent.upsert({
          where: { projectId },
          create: { projectId, status: "stopped", lastHeartbeat: new Date() },
          update: { status: "stopped", lastHeartbeat: new Date() },
        });
      },
    },
  });

  // Register in DB
  await prisma.projectAgent.upsert({
    where: { projectId },
    create: {
      projectId,
      pid: childProcess.pid || null,
      status: "running",
      lastHeartbeat: new Date(),
    },
    update: {
      pid: childProcess.pid || null,
      status: "running",
      lastHeartbeat: new Date(),
    },
  });

  // Set up heartbeat check timer
  const heartbeatTimer = setInterval(async () => {
    try {
      const agent = await prisma.projectAgent.findUnique({
        where: { projectId },
      });

      if (!agent || agent.status !== "running") {
        clearInterval(heartbeatTimer);
        return;
      }

      if (agent.lastHeartbeat) {
        const elapsed = Date.now() - new Date(agent.lastHeartbeat).getTime();
        if (elapsed > HEARTBEAT_TIMEOUT_MS) {
          console.warn(`[project-agent] ${projectId} heartbeat timeout, restarting...`);
          // Mark as crashed and restart
          await prisma.projectAgent.update({
            where: { projectId },
            data: { status: "crashed" },
          });
          clearInterval(heartbeatTimer);
          runningAgents.delete(projectId);

          // Auto-restart after brief delay
          setTimeout(() => startProjectAgent(projectId), 5000);
        }
      }
    } catch (err) {
      console.error(`[project-agent] heartbeat check error:`, err);
    }
  }, HEARTBEAT_INTERVAL_MS);

  // Store in registry
  runningAgents.set(projectId, {
    process: childProcess,
    heartbeatTimer,
    projectId,
  });

  // Handle process exit
  done.catch((err) => {
    console.error(`[project-agent] ${projectId} process error:`, err);
  }).finally(() => {
    const entry = runningAgents.get(projectId);
    if (entry) {
      clearInterval(entry.heartbeatTimer);
      runningAgents.delete(projectId);
    }
  });
}

/**
 * Stop the Project Agent for a given project.
 */
export async function stopProjectAgent(projectId: string): Promise<void> {
  const entry = runningAgents.get(projectId);
  if (entry) {
    clearInterval(entry.heartbeatTimer);
    try {
      entry.process.kill("SIGTERM");
    } catch {
      // Already dead
    }
    runningAgents.delete(projectId);
  }

  // Update DB
  try {
    await prisma.projectAgent.update({
      where: { projectId },
      data: { status: "stopped", pid: null },
    });
  } catch {
    // Agent record might not exist yet
  }
}

/**
 * Get the status of a Project Agent.
 */
export async function getProjectAgentStatus(projectId: string): Promise<{
  running: boolean;
  status: string;
  lastHeartbeat: Date | null;
  pid: number | null;
}> {
  const agent = await prisma.projectAgent.findUnique({
    where: { projectId },
  });

  const isRunning = runningAgents.has(projectId);

  return {
    running: isRunning,
    status: agent?.status || "not_started",
    lastHeartbeat: agent?.lastHeartbeat || null,
    pid: agent?.pid || null,
  };
}

/**
 * Check and restart any crashed project agents.
 */
export async function checkAndRestartCrashedAgents(): Promise<number> {
  const crashedAgents = await prisma.projectAgent.findMany({
    where: {
      status: "running",
      lastHeartbeat: {
        lt: new Date(Date.now() - HEARTBEAT_TIMEOUT_MS),
      },
    },
  });

  let restarted = 0;
  for (const agent of crashedAgents) {
    if (!runningAgents.has(agent.projectId)) {
      console.log(`[project-agent] Auto-restarting crashed agent for ${agent.projectId}`);
      await startProjectAgent(agent.projectId);
      restarted++;
    }
  }

  return restarted;
}
