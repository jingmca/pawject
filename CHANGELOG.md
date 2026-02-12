# Agent Project System — 修改记录

本文档记录了对项目进行的全部设计变更和代码修改。

---

## 九、Task 子目录 + `--add-dir` + Draft 列表 + 状态修复

### 9.1 问题背景

| 问题 | 描述 |
|------|------|
| System Prompt 冲突 | 所有任务共享同一个 workspace 目录和 CLAUDE.md，并发任务互相覆盖 system prompt |
| Draft 目录混杂 | `draft/` 目录混合所有任务的输出，无法区分来源 |
| Draft 面板不完整 | "Agent Drafts" 面板只显示数据库 `OutputArtifact` 记录，遗漏 agent 直接写入磁盘的文件 |
| 一次性任务不结束 | `parseClaudeResult` 只在 `[ASK_USER:]` 时设置 `taskStatusChange`，普通完成时状态不变 |

### 9.2 Task 子目录设计

每个任务在 `workspaces/{projectId}/tasks/{taskId}/` 下有独立的工作目录。

**`src/lib/workspace.ts`** 新增：
- `getTaskDir(projectId, taskId)` — 返回 `workspaces/{projectId}/tasks/{taskId}/`
- `createTaskDir(projectId, taskId)` — 递归创建目录，返回路径
- `listDraftFilesDetailed(projectId)` — 递归扫描 `draft/` 目录，返回文件详情数组

### 9.3 CLAUDE.md 分层

**`src/lib/agent.ts`** `ensureClaudeMd()` 函数新增 `taskDir` 参数：

当 `taskDir` 存在时，写入两个文件：
- **项目 CLAUDE.md**（`workspaces/{projectId}/CLAUDE.md`）：项目指令 + 共享上下文
- **任务 CLAUDE.md**（`workspaces/{projectId}/tasks/{taskId}/CLAUDE.md`）：任务类型 prompt + 输出约定 + ASK_USER 格式

当 `taskDir` 不存在时，回退为写入单个合并 CLAUDE.md（向后兼容）。

### 9.4 `--add-dir` CLI 集成

**`src/lib/claude-code.ts`** `claudeStream` / `claudeOneShot` 新增 `addDirs?: string[]` 参数：

```typescript
if (params.addDirs) {
  for (const dir of params.addDirs) {
    args.push("--add-dir", dir);
  }
}
```

`--add-dir` 标志在 `-c` 和 `-p` 之前插入。所有 API 路由传入 `addDirs = [contextDir, draftDir]`，让 CLI 以 task 子目录为 cwd 的同时能访问共享的 `context/` 和 `draft/` 目录。

### 9.5 一次性任务自动完成

三处 API 路由新增自动完成逻辑：

**`src/app/api/projects/route.ts`** 和 **`src/app/api/tasks/route.ts`**：
```typescript
if (response.taskStatusChange) {
  // 使用 agent 指定的状态（如 awaiting_input）
} else if (task.type === "one_time") {
  // 无 ASK_USER → 自动设为 completed
  await prisma.task.update({ where: { id: taskId }, data: { status: "completed" } });
}
```

**`src/app/api/messages/route.ts`** — 计算 `effectiveStatus` 并写入 SSE done 事件：
```typescript
const effectiveStatus = agentResponse.taskStatusChange
  || (task.type === "one_time" ? "completed" : undefined);
```

### 9.6 Draft 文件列表 API + UI 合并

**`src/app/api/drafts/route.ts`**（新建）：
- `GET /api/drafts?projectId=...` 返回 `draft/` 目录下所有文件的 `{ name, relativePath, size, content, modifiedAt }`

**`src/stores/outputs-store.ts`** 新增：
- `draftFiles: DraftFile[]` 状态
- `fetchDraftFiles(projectId)` action — 调用 `/api/drafts` 端点

**`src/components/workspace/contributions-panel/contributions-tab.tsx`**：
- `useEffect` 在 `projectId` 变化时拉取 draft 文件
- `useMemo` 合并 DB 产出 + 文件系统 draft，按名称去重（DB 优先）
- 文件系统产出显示 "file" 标签，不可删除

### 9.7 测试

新增 `tests/` 目录：
- `tests/test-task-dirs.ts` — 74 项单元测试，覆盖目录结构、CLAUDE.md 拆分、--add-dir 参数、draft 列表、状态逻辑、UI 合并
- `tests/test-api-integration.sh` — API 集成测试，验证完整的 project → task → draft 流程

### 9.8 修改文件清单

| 文件 | 修改内容 |
|------|---------|
| `src/lib/workspace.ts` | 新增 `getTaskDir`、`createTaskDir`、`listDraftFilesDetailed` |
| `src/lib/claude-code.ts` | `claudeStream`/`claudeOneShot` 新增 `addDirs` 参数 |
| `src/lib/agent.ts` | `ensureClaudeMd` 拆分 CLAUDE.md，所有函数新增 `addDirs`/`taskDir` |
| `src/app/api/projects/route.ts` | task dir + addDirs + one_time 自动完成 |
| `src/app/api/tasks/route.ts` | task dir + addDirs + one_time 自动完成 |
| `src/app/api/messages/route.ts` | task dir + addDirs + effectiveStatus + SSE 事件 |
| `src/lib/scheduler.ts` | task dir + addDirs |
| `src/app/api/drafts/route.ts` | **新建** — GET 文件系统 draft 列表 |
| `src/stores/outputs-store.ts` | 新增 `draftFiles` 状态 + `fetchDraftFiles` |
| `src/components/.../contributions-tab.tsx` | DB+FS 合并展示、去重、useEffect + useMemo |
| `tests/test-task-dirs.ts` | **新建** — 74 项单元测试 |
| `tests/test-api-integration.sh` | **新建** — API 集成测试脚本 |

---

## 一、环境与启动修复

### 1.1 Node.js 版本

Next.js 16 要求 Node >= 20.9.0。项目需使用 `nvm use 20` 切换到 Node 20。

### 1.2 SWC 二进制签名问题

macOS 安全策略拒绝加载 `@next/swc-darwin-arm64`。修复方式：`rm -rf node_modules && npm install` 重新安装。

### 1.3 Google Fonts 移除

`next/font/google`（Geist 字体）在国内网络下会导致编译超时。已从 `src/app/layout.tsx` 中移除，改用系统字体。

### 1.4 环境变量配置

`.env` 文件需要配置以下变量：

```env
DATABASE_URL="file:./dev.db"
ANTHROPIC_API_KEY=<your-key>
ANTHROPIC_BASE_URL=https://llm.onerouter.pro    # 代理地址
ANTHROPIC_MODEL=claude-opus-4-6                  # 可选，默认 claude-sonnet-4-5-20250929
```

---

## 二、代理兼容性修复（核心问题）

### 问题

代理 `https://llm.onerouter.pro` 返回的 Anthropic API 响应是 **JSON 字符串** 而非解析后的对象。导致 `response.content` 为 `undefined`，`.filter()` 调用崩溃。

### 修复：`src/lib/agent.ts`

新增 `normalizeResponse()` 函数：

```typescript
function normalizeResponse(response: unknown): Record<string, unknown> {
  if (typeof response === "string") {
    try { return JSON.parse(response); }
    catch { return { content: [{ type: "text", text: response }] }; }
  }
  return response as Record<string, unknown>;
}
```

`chat()` 和 `chatStream()`（fallback 路径）中均使用此函数处理返回值。

---

## 三、askUser 工具（任务状态重新设计）

### 设计目标

将"需要用户输入"的状态从 prompt 约定改为 **Anthropic tool_use 机制**：

| 状态 | 含义 | 触发条件 |
|------|------|---------|
| `running` | 运行中 | agent 正在执行或任务未完成 |
| `awaiting_input` | 需处理 | agent 调用了 `askUser` tool |
| `error` | 错误 | agent 执行过程中抛出异常 |

### 修改：`src/lib/agent.ts`

1. **新增 `askUser` tool 定义**：

```typescript
const ASK_USER_TOOL = {
  name: "askUser",
  description: "当你需要用户提供额外信息、做出选择、或确认某些内容时使用此工具",
  input_schema: {
    type: "object",
    properties: {
      question: { type: "string", description: "要问用户的问题" },
    },
    required: ["question"],
  },
};
```

2. **`chat()` 和 `chatStream()` 中传入 `tools: [ASK_USER_TOOL]`**

3. **新增 `extractFromResponse()`**：解析 `content` 数组中的 `text` 块和 `tool_use` 块

4. **`chatStream()` 流式处理 tool_use 事件**：处理 `content_block_start`、`input_json_delta`、`content_block_stop` 事件

5. **`chatStream()` fallback**：streaming 失败时回退到非流式调用，重置 `fullText` 避免内容重复

6. **移除** system prompt 中的 `status_change` 文本约定

### 修改：`src/types/index.ts`

`AgentResponse` 新增 `askUser` 字段：

```typescript
export interface AgentResponse {
  content: string;
  taskStatusChange?: TaskStatus;
  askUser?: string;           // ← 新增
  artifacts?: Array<{ name: string; type: string; content: string; summary: string }>;
}
```

### 修改：`src/app/api/messages/route.ts`

- 收到 `askUser` 时，将问题追加到 agent 消息内容（`💬 **需要你的输入：**`）
- SSE `done` 事件中包含 `askUser` 字段
- 用户发送消息时，若任务为 `awaiting_input` 或 `error`，自动恢复为 `running`

---

## 四、错误处理

### 问题

之前 agent 调用失败（如 API 认证错误、网络超时）时错误被静默吞掉，任务状态不变，对话中无错误信息。

### 修复

所有 agent 调用点增加 try/catch，统一处理：

1. 将错误信息写入对话（`role: "system"`，内容为 `Agent 执行出错：{errMsg}`）
2. 将任务状态设为 `error`

涉及文件：
- `src/app/api/tasks/route.ts` — 任务创建时的 agent 初始消息
- `src/app/api/messages/route.ts` — 对话中的 agent 回复
- `src/app/api/projects/route.ts` — 项目创建时的初始 agent 调用
- `src/lib/scheduler.ts` — 周期任务和长期任务的调度执行

### SSE Controller 安全

`messages/route.ts` 中 ReadableStream 的 controller 操作用 `safeEnqueue`/`safeClose` 包装，避免 `Controller is already closed` 错误：

```typescript
let closed = false;
const safeEnqueue = (data: Uint8Array) => {
  if (!closed) {
    try { controller.enqueue(data); } catch { /* already closed */ }
  }
};
const safeClose = () => {
  if (!closed) {
    closed = true;
    try { controller.close(); } catch { /* already closed */ }
  }
};
```

---

## 五、非阻塞任务创建（Fire-and-Forget）

### 问题

创建项目/任务后，API 会等待 agent 完成初始回复才返回响应，导致前端按钮卡住数十秒。

### 修复原则

**先返回，后台执行**：同步保存初始消息（system + user），立即返回 HTTP 201，agent 在后台异步执行。

### 修改：`src/app/api/projects/route.ts`

创建项目时若提供了 `instruction`：
1. 同步创建 task + system 消息 + user 消息
2. 调用 `runInitialAgent()` 但不 await
3. 后台 agent 执行流程：分类任务类型 → 更新 task 类型 → 生成初始回复 → 保存
4. 立即返回 project 数据

### 修改：`src/app/api/tasks/route.ts`

同理，新增 `runInitialTaskAgent()` 后台函数：
1. 同步创建 task + 初始消息
2. `runInitialTaskAgent()` 不 await
3. 立即返回 task 数据

---

## 六、消息显示修复

### 6.1 初始消息保存顺序

之前 `tasks/route.ts` 中 agent 调用在消息保存之前。如果 agent 失败，对话中无任何记录。

**修复**：system 消息和 user 消息在 agent 调用之前保存。

### 6.2 loadedRef 阻止刷新

`chat-session.tsx` 使用 `loadedRef` 防止重复加载，但也阻止了切换 task 后的重新获取。

**修复**：移除 `loadedRef`，改为依赖 `useEffect` 的 `task.id` 依赖自动刷新。

### 6.3 消息轮询

新增 10 秒轮询，用于获取调度器生成的消息（周期任务触发、长期任务进展更新）。Streaming 期间暂停轮询。

### 6.4 SSE 解析器

修复跨 chunk 边界的消息解析：使用 buffer + `parts.pop()` 保留不完整的最后一段。

### 6.5 Scheduler 系统消息

`src/lib/scheduler.ts` 在执行周期任务和长期任务前，写入系统触发消息，执行失败时写入错误消息。

---

## 七、前端状态管理修复

### 7.1 Streaming 状态隔离（per-task）

**问题**：`isStreaming` 是全局布尔值，一个任务的流卡住会导致所有任务的输入框被禁用。

**修复**：`src/stores/messages-store.ts` 新增 `streamingTaskId` 字段。`chat-session.tsx` 和 `chat-input.tsx` 使用 `isThisTaskStreaming = isStreaming && streamingTaskId === task.id` 替代全局 `isStreaming`。

### 7.2 Streaming 安全清理

`sendMessage` 中添加：
- 120 秒安全超时强制清理
- `finally` 块保证 `isStreaming` 一定被重置
- `streamDone` 标记判断是否收到了 `done`/`error` 事件
- 顶层 catch 中刷新消息列表

### 7.3 任务状态同步

**问题**：SSE `done` 事件中的 `taskStatusChange` 没有同步到 tasks store，导致前端 task 状态过期。

**修复**：在 messages-store 的 SSE 处理中，收到 `done` 或 `error` 事件后，通过 `useTasksStore.getState().updateTaskInList()` 同步更新。

### 7.4 Workspace Store 修复

**问题**：`setShowNewTaskForm(false)` 时设置 `selectedTaskId: undefined`，Zustand 中 `undefined` 不会触发状态更新。

**修复**：改为只在 `show=true` 时清空 `selectedTaskId`，关闭表单时不覆盖：

```typescript
setShowNewTaskForm: (show) =>
  set({ showNewTaskForm: show, ...(show ? { selectedTaskId: null } : {}) }),
```

### 7.5 Auto-select 冲突修复

**问题**：`page.tsx` 中 auto-select effect 在 `selectedTaskId` 为 `null` 时自动选第一个任务。点击"新建任务"会清空 `selectedTaskId`，触发 auto-select，立即关闭表单。

**修复**：条件中增加 `!showNewTaskForm`：

```typescript
if (!selectedTaskId && !showNewTaskForm && tasks.length > 0) {
  setSelectedTaskId(tasks[0].id);
}
```

### 7.6 ChatInput 始终可用

**修改**：移除基于 `task.status` 的禁用逻辑。输入框仅在当前任务 streaming 期间禁用，任何状态下用户都可以输入消息：

```typescript
<ChatInput taskId={task.id} disabled={isThisTaskStreaming} />
```

---

## 八、修改文件清单

| 文件 | 修改内容 |
|------|---------|
| `src/app/layout.tsx` | 移除 Google Fonts |
| `src/lib/agent.ts` | normalizeResponse、askUser tool、extractFromResponse、streaming fallback |
| `src/types/index.ts` | AgentResponse 增加 askUser 字段 |
| `src/app/api/projects/route.ts` | 自动创建初始 task + fire-and-forget agent |
| `src/app/api/tasks/route.ts` | fire-and-forget agent + 消息先保存 |
| `src/app/api/messages/route.ts` | askUser 处理 + error 恢复 + safeEnqueue/safeClose |
| `src/lib/scheduler.ts` | 系统触发消息 + 错误消息写入对话 |
| `src/stores/messages-store.ts` | streamingTaskId + 安全超时 + 状态同步 + finally 清理 |
| `src/stores/workspace-store.ts` | setShowNewTaskForm 修复 undefined 问题 |
| `src/stores/tasks-store.ts` | （未修改，但被 messages-store 跨 store 调用） |
| `src/components/workspace/center-panel/chat-session.tsx` | per-task streaming + 移除 loadedRef + 轮询 |
| `src/components/workspace/center-panel/chat-input.tsx` | per-task streaming 判断 |
| `src/components/workspace/center-panel/new-task-form.tsx` | 创建后关闭表单 |
| `src/app/projects/[projectId]/page.tsx` | auto-select 排除表单打开状态 |
