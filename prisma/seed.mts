import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, "../dev.db");

const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
const prisma = new PrismaClient({ adapter });

// Clear existing data
await prisma.message.deleteMany();
await prisma.outputArtifact.deleteMany();
await prisma.contextItem.deleteMany();
await prisma.task.deleteMany();
await prisma.project.deleteMany();

// Project 1
const project1 = await prisma.project.create({
  data: {
    name: "AI 行业日报",
    description: "每日跟踪 AI 行业动态，生成结构化简报",
    instruction: "关注 AI 行业的最新进展，包括大模型、AI 应用、投融资等方面。输出中文简报，结构清晰，重点突出。",
  },
});

await prisma.contextItem.createMany({
  data: [
    {
      projectId: project1.id,
      name: "关注领域",
      type: "text_note",
      content: "重点关注：大语言模型进展、AI Agent 技术、AI 在企业中的应用、相关政策法规、重要投融资事件",
    },
    {
      projectId: project1.id,
      name: "输出格式要求",
      type: "text_note",
      content: "简报格式：1. 头条摘要（3-5条）2. 详细报道（每条含标题、摘要、分析）3. 市场数据 4. 一句话总结",
    },
  ],
});

const task1_1 = await prisma.task.create({
  data: {
    projectId: project1.id,
    name: "每日 AI 行业简报",
    description: "每天自动生成一份 AI 行业动态简报",
    type: "periodic",
    status: "running",
    scheduleConfig: JSON.stringify({ intervalMinutes: 1440 }),
    nextRunAt: new Date(Date.now() + 86400000),
  },
});

await prisma.message.createMany({
  data: [
    { taskId: task1_1.id, role: "system", content: "任务已创建：每日 AI 行业简报 (periodic)" },
    { taskId: task1_1.id, role: "agent", content: "已设置每日 AI 行业简报任务。我将每天自动收集和整理 AI 行业的最新动态，按照您指定的格式生成结构化简报。\n\n下一次执行时间：明天" },
  ],
});

const task1_2 = await prisma.task.create({
  data: {
    projectId: project1.id,
    name: "竞品分析报告",
    description: "分析主要 AI 助手产品的功能对比",
    type: "one_time",
    status: "completed",
  },
});

await prisma.message.createMany({
  data: [
    { taskId: task1_2.id, role: "system", content: "任务已创建：竞品分析报告 (one_time)" },
    { taskId: task1_2.id, role: "user", content: "请分析目前主流的 AI 助手产品，包括 ChatGPT、Claude、Gemini 的功能对比。" },
    { taskId: task1_2.id, role: "agent", content: "## AI 助手产品竞品分析\n\n### 1. ChatGPT (OpenAI)\n- 多模态能力强，支持图像生成和分析\n- 插件生态丰富\n- GPT-4o 模型性能领先\n\n### 2. Claude (Anthropic)\n- 长上下文处理优秀（200K tokens）\n- 代码能力突出\n- 安全性和可控性好\n\n### 3. Gemini (Google)\n- 与 Google 生态深度整合\n- 多模态原生支持\n- 搜索能力强\n\n### 总结\n各产品各有侧重，ChatGPT 生态最完善，Claude 在专业场景表现优异，Gemini 则依托 Google 生态有独特优势。" },
  ],
});

await prisma.outputArtifact.create({
  data: {
    projectId: project1.id,
    taskId: task1_2.id,
    name: "AI 助手竞品分析报告",
    type: "report",
    content: "ChatGPT、Claude、Gemini 三大 AI 助手的详细功能对比分析...",
    summary: "主流 AI 助手产品功能对比",
  },
});

// Project 2
const project2 = await prisma.project.create({
  data: {
    name: "Agent 技术调研",
    description: "深入调研 AI Agent 相关技术方案",
    instruction: "调研 AI Agent 的技术架构、框架选型、最佳实践。重点关注 ReAct、Tool Use、Multi-Agent 等方向。",
  },
});

await prisma.contextItem.create({
  data: {
    projectId: project2.id,
    name: "技术栈约束",
    type: "text_note",
    content: "团队技术栈：TypeScript, Next.js, Python。优先考虑与现有技术栈兼容的方案。",
  },
});

const task2_1 = await prisma.task.create({
  data: {
    projectId: project2.id,
    name: "跟踪 Agent 框架发展",
    description: "持续跟踪 LangChain, CrewAI, AutoGen 等 Agent 框架的最新进展",
    type: "long_term",
    status: "running",
  },
});

await prisma.message.createMany({
  data: [
    { taskId: task2_1.id, role: "system", content: "任务已创建：跟踪 Agent 框架发展 (long_term)" },
    { taskId: task2_1.id, role: "agent", content: "已开始跟踪 AI Agent 框架的发展动态。初始分析如下：\n\n**当前主要框架：**\n\n1. **LangChain** - 最成熟的 LLM 应用框架，生态丰富但复杂度高\n2. **CrewAI** - 专注多 Agent 协作，API 设计简洁\n3. **AutoGen (Microsoft)** - 强调对话式多 Agent，研究导向\n4. **Claude Code SDK** - Anthropic 官方工具，原生 tool use 支持好\n\n我将持续关注这些框架的版本更新、新特性和社区动态，定期提供进展报告。" },
    { taskId: task2_1.id, role: "user", content: "重点关注一下 Claude Code SDK 和 Anthropic 的 tool use 方案" },
    { taskId: task2_1.id, role: "agent", content: "收到，我会重点关注 Anthropic 生态。\n\n**Claude Tool Use 方案要点：**\n\n- 原生支持 function calling，JSON Schema 定义工具\n- 支持 streaming tool use\n- Claude Code SDK 提供了完整的 agent 开发框架\n- 支持 computer use（GUI 操作）\n\n后续会持续跟踪 Anthropic 的 API 更新和 SDK 版本发布。" },
  ],
});

const task2_2 = await prisma.task.create({
  data: {
    projectId: project2.id,
    name: "RAG 方案调研",
    description: "调研适合团队的 RAG 实现方案",
    type: "one_time",
    status: "awaiting_input",
  },
});

await prisma.message.createMany({
  data: [
    { taskId: task2_2.id, role: "system", content: "任务已创建：RAG 方案调研 (one_time)" },
    { taskId: task2_2.id, role: "agent", content: "我需要了解更多信息来推荐合适的 RAG 方案：\n\n1. **数据规模**：预计索引多少文档？\n2. **数据类型**：主要是文本、代码还是混合？\n3. **延迟要求**：对查询响应时间有什么要求？\n4. **部署方式**：云服务还是本地部署？\n\n请提供这些信息，我将据此推荐最适合的方案。" },
  ],
});

console.log("Seed data created successfully!");
console.log(`  Project 1: ${project1.id} (${project1.name})`);
console.log(`  Project 2: ${project2.id} (${project2.name})`);

await prisma.$disconnect();
