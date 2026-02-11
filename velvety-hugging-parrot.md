# Agent Project System - Implementation Plan

## Context

基于 Claude Cowork 的设计理念，构建一个 Agent Project 系统。用户通过自然语言创建 project，每个 project 对应一个三栏式 workspace，支持三种任务类型（周期/一次性/长期互动），每个 task 以 chat session 形式与 agent 交互。Agent 层使用 Claude Code SDK 实现真实的 AI 对话能力。

## Tech Stack

- **Framework**: Next.js 15 (App Router) + React 19 + TypeScript
- **UI**: shadcn/ui + Tailwind CSS, 深色主题
- **Database**: SQLite + Prisma ORM
- **State**: Zustand
- **Agent**: `@anthropic-ai/sdk` (Claude API)
- **Extras**: next-themes, sonner (toast), lucide-react (icons), react-resizable-panels

---

## Phase 1: Project Scaffolding

### Step 1: Init Next.js + Dependencies
```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --turbopack
npm install prisma @prisma/client zustand next-themes sonner @anthropic-ai/sdk
npm install -D tsx
npx prisma init --datasource-provider sqlite
```

### Step 2: Init shadcn/ui + Components
```bash
npx shadcn@latest init  # New York style, Zinc, CSS variables, dark default
npx shadcn@latest add button card dialog input textarea badge tabs select scroll-area separator dropdown-menu avatar tooltip sheet skeleton resizable
```

### Step 3: Dark Theme Config
- `src/app/globals.css` - dark theme CSS variables as default
- `src/components/providers/theme-provider.tsx` - next-themes wrapper
- `src/app/layout.tsx` - ThemeProvider with `defaultTheme="dark"`

---

## Phase 2: Database Schema

### Step 4: Prisma Schema (`prisma/schema.prisma`)

**Models:**
- **Project**: id, name, description, instruction (自然语言指令), feishuLink?, timestamps
- **Task**: id, projectId, name, description, type (`periodic|one_time|long_term`), status (`pending|running|paused|stopped|completed|error|awaiting_input`), scheduleConfig? (JSON string), nextRunAt?, lastRunAt?, timestamps
- **Message**: id, taskId, role (`user|agent|system`), content, metadata? (JSON), createdAt
- **ContextItem**: id, projectId, name, type (`file|url|feishu_folder|text_note`), content, metadata?, timestamps
- **OutputArtifact**: id, projectId, taskId?, name, type (`report|document|data|code|other`), content, summary?, metadata?, timestamps

Cascade delete: Project -> Tasks/Context/Outputs; Task -> Messages; Task delete sets OutputArtifact.taskId to null.

### Step 5: Prisma Client + Types
- `src/lib/db.ts` - Prisma singleton
- `src/types/index.ts` - TypeScript types/enums matching schema

---

## Phase 3: Agent Layer (Claude SDK)

### Step 6: Agent Service (`src/lib/agent.ts`)

使用 `@anthropic-ai/sdk` 实现 agent 服务，核心设计：

```typescript
// 每个 task 维护独立的 conversation history
// workspace 的 shared context 作为 system prompt 的一部分注入

class AgentService {
  private client: Anthropic;

  // 为 task 生成 agent 回复
  async chat(params: {
    task: Task;
    userMessage: string;
    messageHistory: Message[];    // task 独立上下文
    sharedContext: ContextItem[];  // workspace 共享 context
  }): Promise<AgentResponse>;

  // 构建 system prompt（包含 task 类型指令 + shared context）
  private buildSystemPrompt(task: Task, context: ContextItem[]): string;

  // 周期任务触发时的自动执行
  async executePeriodicRun(task: Task, context: ContextItem[]): Promise<AgentResponse>;

  // 长期任务的阶段性思考更新
  async generateProgressUpdate(task: Task, history: Message[], context: ContextItem[]): Promise<AgentResponse>;
}
```

**System Prompt 策略（按 task 类型）:**
- **periodic**: "你是一个定期执行任务的 agent，当前任务是... 请基于最新信息生成本次执行的报告/结果"
- **one_time**: "你是一个一次性任务执行 agent，目标是... 如果遇到问题需要用户输入，明确说明需要什么信息"
- **long_term**: "你是一个长期跟踪目标的 agent，目标是... 持续围绕目标思考，整合新信息，阶段性汇报进展"

**AgentResponse 结构:**
```typescript
interface AgentResponse {
  content: string;                    // agent 回复文本
  taskStatusChange?: TaskStatus;      // 可选状态变更
  artifacts?: Array<{                 // 可选产物
    name: string; type: string; content: string; summary: string;
  }>;
}
```

### Step 7: Streaming Support (`src/app/api/messages/route.ts`)

使用 Claude SDK 的 streaming API，通过 Server-Sent Events (SSE) 将 agent 回复实时推送到前端：

```typescript
// POST /api/messages - 发送消息并流式返回 agent 回复
// 1. 保存 user message
// 2. 加载 task history + shared context
// 3. 调用 agentService.chat() with streaming
// 4. 通过 ReadableStream 返回 SSE
// 5. 流结束后保存完整的 agent message + artifacts
```

---

## Phase 4: API Routes

### Step 8: Projects API
- `src/app/api/projects/route.ts` - GET (list), POST (create)
- `src/app/api/projects/[projectId]/route.ts` - GET, PATCH, DELETE

### Step 9: Tasks API
- `src/app/api/tasks/route.ts` - GET (by projectId), POST (create, 自动触发首条 agent 消息)
- `src/app/api/tasks/[taskId]/route.ts` - GET, PATCH, DELETE
- `src/app/api/tasks/[taskId]/control/route.ts` - POST (pause/resume/stop)

Task 创建副作用:
- `one_time`: status -> "running", agent 发送初始执行消息
- `periodic`: 计算 nextRunAt, status -> "pending"
- `long_term`: status -> "running", agent 发送初始分析消息

### Step 10: Messages API
- `src/app/api/messages/route.ts` - GET (by taskId), POST (发送消息 + SSE 流式 agent 回复)

### Step 11: Context + Output + Scheduler APIs
- `src/app/api/context/route.ts` + `[contextId]/route.ts` - CRUD
- `src/app/api/outputs/route.ts` + `[outputId]/route.ts` - CRUD
- `src/app/api/scheduler/route.ts` - POST (触发周期任务检查 + 长期任务进展更新)

---

## Phase 5: Frontend - Core Layout

### Step 12: Projects Page (`src/app/projects/page.tsx`)
- `src/components/projects/project-list.tsx` - 项目网格
- `src/components/projects/project-card.tsx` - 项目卡片
- `src/components/projects/create-project-dialog.tsx` - 创建弹窗（name, instruction, feishuLink）

### Step 13: Zustand Stores (`src/stores/`)
- `workspace-store.ts` - selectedProjectId, selectedTaskId, rightPanelOpen, rightPanelTab
- `tasks-store.ts` - tasks[], fetchTasks, createTask, controlTask
- `messages-store.ts` - messagesByTask{}, fetchMessages, sendMessage (with SSE streaming)
- `context-store.ts` - context items CRUD
- `outputs-store.ts` - output artifacts CRUD

### Step 14: Workspace Shell
- `src/app/projects/[projectId]/layout.tsx` - workspace layout
- `src/app/projects/[projectId]/page.tsx` - loads workspace
- `src/components/workspace/workspace-shell.tsx` - ResizablePanelGroup (左20% | 中50% | 右30%)

---

## Phase 6: Frontend - Panel Components

### Step 15: Left Panel (`src/components/workspace/left-panel/`)
- `left-panel.tsx` - 容器
- `status-cards.tsx` - 三张状态卡片（运行中/已停止/需处理）
- `new-task-button.tsx` - 新建任务按钮
- `task-list.tsx` + `task-list-item.tsx` - 任务列表，点击选中

### Step 16: Center Panel (`src/components/workspace/center-panel/`)
- `center-panel.tsx` - 视图切换容器
- `new-task-form.tsx` - 默认视图：任务类型选择 + 名称 + 描述 + 周期配置（条件显示）
- `task-header.tsx` - 任务名 + 类型徽章 + 暂停/继续/停止按钮
- `chat-session.tsx` - 聊天会话容器
- `chat-message.tsx` - 消息气泡（user右/agent左/system居中）
- `chat-input.tsx` - 输入框 + 发送按钮，支持 streaming 显示

### Step 17: Right Panel (`src/components/workspace/right-panel/`)
- `right-panel.tsx` - 可折叠容器 + Tabs
- `context-tab.tsx` + `context-item.tsx` - Context 管理（添加/列表/删除）
- `output-tab.tsx` + `output-item.tsx` - Output 展示（关联 task、预览）

---

## Phase 7: Integration & Polish

### Step 18: Scheduler Client-Side Polling
- `src/hooks/use-polling.ts` - 通用轮询 hook
- Workspace 页面每 30s 调用 `/api/scheduler`，刷新任务状态

### Step 19: Seed Data (`prisma/seed.ts`)
- 2 个示例 project
- 各种类型的 task + 聊天记录 + context + outputs

### Step 20: Loading & Error States
- Skeleton loaders (shadcn Skeleton)
- Error toasts (sonner)
- Empty states ("暂无任务"/"暂无上下文")

### Step 21: Visual Polish
- 类型徽章颜色: periodic=紫, one_time=蓝, long_term=琥珀
- 状态徽章: running=绿(pulse), paused=黄, stopped=红, completed=绿, awaiting_input=橙(pulse)
- 面板折叠/展开动画
- 新消息滚动动画
- Streaming 打字机效果

---

## File Structure Summary

```
src/
├── app/
│   ├── layout.tsx, page.tsx, globals.css
│   ├── projects/
│   │   ├── page.tsx
│   │   └── [projectId]/ (layout.tsx, page.tsx)
│   └── api/
│       ├── projects/, tasks/, messages/, context/, outputs/, scheduler/
├── lib/
│   ├── db.ts, agent.ts, scheduler.ts, utils.ts, constants.ts
├── stores/
│   ├── workspace-store.ts, tasks-store.ts, messages-store.ts, context-store.ts, outputs-store.ts
├── hooks/
│   ├── use-tasks.ts, use-messages.ts, use-context.ts, use-outputs.ts, use-polling.ts
├── types/
│   └── index.ts
└── components/
    ├── ui/ (shadcn components)
    ├── providers/theme-provider.tsx
    ├── projects/ (project-list, project-card, create-project-dialog)
    └── workspace/
        ├── workspace-shell.tsx
        ├── left-panel/ (left-panel, status-cards, new-task-button, task-list, task-list-item)
        ├── center-panel/ (center-panel, new-task-form, task-header, chat-session, chat-message, chat-input)
        └── right-panel/ (right-panel, context-tab, context-item, output-tab, output-item)
```

---

## Environment Variables

```env
DATABASE_URL="file:./prisma/dev.db"
# ANTHROPIC_API_KEY - 直接使用当前系统环境变量，无需在 .env 中额外配置
```

> **Note**: Claude SDK 的 `Anthropic` client 默认会从 `process.env.ANTHROPIC_API_KEY` 读取，直接继承系统已有的环境变量设置即可，代码中不做硬编码也不要求 .env 配置。

---

## Verification Plan

1. `npx prisma db push && npx prisma db seed` - 数据库初始化
2. `npm run dev` - 启动开发服务器
3. 测试流程:
   - 创建 project -> 验证跳转到 workspace
   - 创建三种类型 task -> 验证各自初始化行为
   - 在 chat 中发消息 -> 验证 Claude SDK streaming 回复
   - 暂停/继续/停止 task -> 验证状态切换
   - 添加 context item -> 验证 agent 回复中引用 context
   - 查看 outputs -> 验证 task 产物展示
   - 等待 scheduler 触发 -> 验证周期任务自动执行
