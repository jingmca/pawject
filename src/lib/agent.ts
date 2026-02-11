import Anthropic from "@anthropic-ai/sdk";
import type { AgentResponse } from "@/types";
import type { Task, Message, ContextItem } from "@/generated/prisma/client";

const client = new Anthropic();

function buildSystemPrompt(
  task: Task,
  projectInstruction: string,
  context: ContextItem[]
): string {
  const contextBlock =
    context.length > 0
      ? `\n\n## 共享上下文信息\n${context.map((c) => `### ${c.name} (${c.type})\n${c.content}`).join("\n\n")}`
      : "";

  const typePrompts: Record<string, string> = {
    periodic: `你是一个定期执行任务的 agent。当前任务是：${task.name}。${task.description ? `任务描述：${task.description}。` : ""}请基于最新信息和上下文，生成本次执行的报告或结果。确保输出结构化、有重点。`,
    one_time: `你是一个一次性任务执行 agent。目标是：${task.name}。${task.description ? `任务描述：${task.description}。` : ""}请高效完成任务。如果遇到问题需要用户输入，明确说明需要什么信息。任务完成后，总结执行结果。`,
    long_term: `你是一个长期跟踪目标的 agent。目标是：${task.name}。${task.description ? `任务描述：${task.description}。` : ""}请持续围绕目标思考，整合新信息，阶段性汇报进展和洞察。`,
  };

  const basePrompt = typePrompts[task.type] || typePrompts.one_time;

  return `${basePrompt}${projectInstruction ? `\n\n## 项目指令\n${projectInstruction}` : ""}${contextBlock}

## 输出格式约定
如果你需要生成产物（报告、文档、代码等），请在回复末尾使用以下 JSON 格式标记：
\`\`\`artifacts
[{"name": "产物名称", "type": "report|document|data|code|other", "content": "产物内容", "summary": "一句话摘要"}]
\`\`\`

如果你认为当前任务状态应该变更，在回复末尾使用：
\`\`\`status_change
completed|awaiting_input|error
\`\`\``;
}

function parseAgentResponse(text: string): AgentResponse {
  let content = text;
  let taskStatusChange: AgentResponse["taskStatusChange"];
  let artifacts: AgentResponse["artifacts"];

  // Parse artifacts
  const artifactsMatch = content.match(
    /```artifacts\s*\n([\s\S]*?)\n```/
  );
  if (artifactsMatch) {
    try {
      artifacts = JSON.parse(artifactsMatch[1]);
      content = content.replace(artifactsMatch[0], "").trim();
    } catch {
      // ignore parse errors
    }
  }

  // Parse status change
  const statusMatch = content.match(
    /```status_change\s*\n(\w+)\s*\n```/
  );
  if (statusMatch) {
    const status = statusMatch[1] as AgentResponse["taskStatusChange"];
    if (
      status &&
      ["completed", "awaiting_input", "error"].includes(status)
    ) {
      taskStatusChange = status;
    }
    content = content.replace(statusMatch[0], "").trim();
  }

  return { content, taskStatusChange, artifacts };
}

function buildMessages(
  messageHistory: Message[]
): Array<{ role: "user" | "assistant"; content: string }> {
  return messageHistory
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: (m.role === "agent" ? "assistant" : "user") as
        | "user"
        | "assistant",
      content: m.content,
    }));
}

export async function chat(params: {
  task: Task;
  userMessage: string;
  messageHistory: Message[];
  sharedContext: ContextItem[];
  projectInstruction: string;
}): Promise<AgentResponse> {
  const { task, userMessage, messageHistory, sharedContext, projectInstruction } =
    params;

  const systemPrompt = buildSystemPrompt(task, projectInstruction, sharedContext);
  const messages = buildMessages(messageHistory);
  messages.push({ role: "user", content: userMessage });

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: systemPrompt,
    messages,
  });

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  return parseAgentResponse(text);
}

export async function* chatStream(params: {
  task: Task;
  userMessage: string;
  messageHistory: Message[];
  sharedContext: ContextItem[];
  projectInstruction: string;
}): AsyncGenerator<string, AgentResponse> {
  const { task, userMessage, messageHistory, sharedContext, projectInstruction } =
    params;

  const systemPrompt = buildSystemPrompt(task, projectInstruction, sharedContext);
  const messages = buildMessages(messageHistory);
  messages.push({ role: "user", content: userMessage });

  let fullText = "";

  const stream = client.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: systemPrompt,
    messages,
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      fullText += event.delta.text;
      yield event.delta.text;
    }
  }

  return parseAgentResponse(fullText);
}

export async function executePeriodicRun(
  task: Task,
  context: ContextItem[],
  projectInstruction: string
): Promise<AgentResponse> {
  return chat({
    task,
    userMessage:
      "这是一次定期执行触发。请基于当前上下文信息，生成本次执行的报告。",
    messageHistory: [],
    sharedContext: context,
    projectInstruction,
  });
}

export async function generateProgressUpdate(
  task: Task,
  history: Message[],
  context: ContextItem[],
  projectInstruction: string
): Promise<AgentResponse> {
  return chat({
    task,
    userMessage:
      "请基于目前的信息和进展，生成一次阶段性进展更新。",
    messageHistory: history,
    sharedContext: context,
    projectInstruction,
  });
}
