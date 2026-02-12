import type { Task, ContextItem } from "@/generated/prisma/client";
import {
  claudeStream,
  claudeOneShot,
  parseAskUser,
  parseArtifacts,
  type ClaudeResult,
  type ClaudeStreamCallbacks,
} from "./claude-code";
import { writeWorkspaceFile } from "./workspace";
import Anthropic from "@anthropic-ai/sdk";
import type { ChildProcess } from "node:child_process";

const sdk = new Anthropic();
const SDK_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5-20250929";

export interface AgentResponse {
  content: string;
  taskStatusChange?: string;
  askUser?: string;
  artifacts?: Array<{
    name: string;
    type: string;
    content: string;
    summary: string;
  }>;
  sessionId?: string;
  costUsd?: number;
}

/**
 * Build system prompt and write it to CLAUDE.md in the workspace.
 * Claude Code CLI automatically reads this file as project-level instructions.
 */
async function ensureClaudeMd(
  task: Task,
  projectInstruction: string,
  context: ContextItem[],
  workspacePath: string,
  projectId: string
): Promise<void> {
  const contextBlock =
    context.length > 0
      ? `\n\n## 共享上下文信息\n${context.map((c) => `### ${c.name} (${c.type})\n${c.content}`).join("\n\n")}`
      : "";

  const typePrompts: Record<string, string> = {
    periodic: `你是一个定期执行任务的 agent。当前任务是：${task.name}。${task.description ? `任务描述：${task.description}。` : ""}请基于最新信息和上下文，生成本次执行的报告或结果。确保输出结构化、有重点。`,
    one_time: `你是一个一次性任务执行 agent。目标是：${task.name}。${task.description ? `任务描述：${task.description}。` : ""}请高效完成任务。你可以在 workspace 的 draft/ 目录下创建文件保存你的产出。`,
    proactive: `你是一个主动探索型 agent，负责围绕目标持续推进工作。目标是：${task.name}。${task.description ? `任务描述：${task.description}。` : ""}

你的工作模式是 Plan→Execute→Think→Update 循环：
1. **规划**: 分析目标，制定执行计划
2. **执行**: 按计划逐步执行，将产出写入 draft/ 目录
3. **思考**: 评估进展，发现新信息和机会
4. **更新**: 根据新发现调整计划

请注意 context/ 目录下的内容变化，这些是用户提供的参考资料。
你可以在 draft/ 目录下创建和更新文件来保存你的工作成果。`,
  };

  const basePrompt = typePrompts[task.type] || typePrompts.one_time;

  const claudeMd = `${basePrompt}${projectInstruction ? `\n\n## 项目指令\n${projectInstruction}` : ""}${contextBlock}

## 输出格式约定
如果你需要生成产物（报告、文档、代码等），请直接写入 draft/ 目录下的文件。

## 与用户交互
如果你需要用户补充信息或做决策，请在回复中使用以下格式标记：
[ASK_USER: 你的问题内容]
使用此标记后，任务将暂停等待用户回复。不要在文本中直接提问，而是使用此标记。`;

  await writeWorkspaceFile(projectId, "CLAUDE.md", claudeMd);
}

/**
 * Stream a chat interaction with Claude Code CLI.
 */
export function chatStream(params: {
  task: Task;
  userMessage: string;
  sharedContext: ContextItem[];
  projectInstruction: string;
  workspacePath: string;
  hasAgentReplied: boolean; // true if agent has responded before in this task
  callbacks: ClaudeStreamCallbacks;
}): { process: ChildProcess; done: Promise<ClaudeResult> } {
  const { task, userMessage, workspacePath, hasAgentReplied, callbacks } = params;

  return claudeStream({
    prompt: userMessage,
    cwd: workspacePath,
    continueConversation: hasAgentReplied,
    callbacks,
  });
}

/**
 * Parse a completed Claude result into our AgentResponse format.
 */
export function parseClaudeResult(result: ClaudeResult): AgentResponse {
  const { cleanContent: afterAskUser, askUser } = parseAskUser(result.result);
  const { cleanContent, artifacts } = parseArtifacts(afterAskUser);

  const response: AgentResponse = {
    content: cleanContent,
    sessionId: result.session_id,
    costUsd: result.total_cost_usd,
  };

  if (askUser) {
    response.askUser = askUser;
    response.taskStatusChange = "awaiting_input";
  }

  if (artifacts && artifacts.length > 0) {
    response.artifacts = artifacts;
  }

  return response;
}

/**
 * One-shot chat (non-streaming) for background tasks.
 */
export async function chat(params: {
  task: Task;
  userMessage: string;
  sharedContext: ContextItem[];
  projectInstruction: string;
  workspacePath: string;
  hasAgentReplied?: boolean;
}): Promise<AgentResponse> {
  const { task, userMessage, sharedContext, projectInstruction, workspacePath, hasAgentReplied } =
    params;

  // Write CLAUDE.md before calling CLI
  await ensureClaudeMd(task, projectInstruction, sharedContext, workspacePath, task.projectId);

  const result = await claudeOneShot({
    prompt: userMessage,
    cwd: workspacePath,
    continueConversation: !!hasAgentReplied,
  });

  return parseClaudeResult(result);
}

/**
 * Execute a periodic task run.
 */
export async function executePeriodicRun(
  task: Task,
  context: ContextItem[],
  projectInstruction: string,
  workspacePath: string
): Promise<AgentResponse> {
  return chat({
    task,
    userMessage: "这是一次定期执行触发。请基于当前上下文信息，生成本次执行的报告。将产出写入 draft/ 目录。",
    sharedContext: context,
    projectInstruction,
    workspacePath,
  });
}

/**
 * Generate a progress update for proactive tasks.
 */
export async function generateProgressUpdate(
  task: Task,
  context: ContextItem[],
  projectInstruction: string,
  workspacePath: string
): Promise<AgentResponse> {
  return chat({
    task,
    userMessage: "请检查 context/ 目录是否有新内容，并基于目前的信息和进展，生成一次阶段性进展更新。如有需要，更新 draft/ 目录中的工作成果。",
    sharedContext: context,
    projectInstruction,
    workspacePath,
  });
}

// Re-export ensureClaudeMd for use in API routes
export { ensureClaudeMd };

/**
 * Quick SDK call for text-in/text-out (no tools needed).
 * Used for parsing/classification tasks. Much faster than CLI.
 */
async function sdkChat(prompt: string): Promise<string> {
  const res = await sdk.messages.create({
    model: SDK_MODEL,
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });
  const block = res.content[0];
  return block.type === "text" ? block.text : "";
}

/**
 * Parse a natural language instruction into structured task fields.
 */
export async function parseTaskInstruction(
  instruction: string,
  taskType: string
): Promise<{
  name: string;
  description: string;
  scheduleConfig?: string;
}> {
  const prompt = `请根据以下用户指令，提取结构化的任务信息。

用户指令: "${instruction}"
任务类型: ${taskType}

请以 JSON 格式返回（不要包含其他文字）:
{
  "name": "简短的任务标题（不超过30字）",
  "description": "任务的详细描述"${taskType === "periodic" ? ',\n  "intervalMinutes": 数字（执行间隔分钟数，根据指令推断）' : ""}
}`;

  try {
    const text = await sdkChat(prompt);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    const response: { name: string; description: string; scheduleConfig?: string } = {
      name: parsed.name || instruction.slice(0, 30),
      description: parsed.description || instruction,
    };

    if (taskType === "periodic" && parsed.intervalMinutes) {
      response.scheduleConfig = JSON.stringify({
        intervalMinutes: parsed.intervalMinutes,
      });
    }

    return response;
  } catch {
    return {
      name: instruction.slice(0, 30),
      description: instruction,
    };
  }
}

/**
 * Parse a natural language instruction into structured project fields.
 */
export async function parseProjectInstruction(instruction: string): Promise<{
  name: string;
  description: string;
  projectInstruction: string;
  suggestedTask?: {
    name: string;
    description: string;
    type: string;
  };
}> {
  const prompt = `请根据以下用户指令，提取结构化的项目信息。

用户指令: "${instruction}"

请以 JSON 格式返回（不要包含其他文字）:
{
  "name": "简短的项目名称（不超过20字）",
  "description": "项目的简要描述",
  "projectInstruction": "给 agent 的详细指令",
  "suggestedTask": {
    "name": "建议的初始任务标题",
    "description": "初始任务描述",
    "type": "one_time 或 periodic 或 proactive"
  }
}

如果无法从指令中识别出具体的任务，suggestedTask 可以为 null。`;

  try {
    const text = await sdkChat(prompt);
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    return {
      name: parsed.name || instruction.slice(0, 20),
      description: parsed.description || instruction,
      projectInstruction: parsed.projectInstruction || instruction,
      suggestedTask: parsed.suggestedTask || undefined,
    };
  } catch {
    return {
      name: instruction.slice(0, 20),
      description: instruction,
      projectInstruction: instruction,
    };
  }
}
