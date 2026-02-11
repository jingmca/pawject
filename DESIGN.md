# Agent Project System — 设计文档

## 1. 项目概述

基于 Claude Cowork 的设计理念，构建的 AI Agent 项目管理系统。用户通过自然语言创建 project，每个 project 对应一个三栏式 workspace，支持三种任务类型（周期 / 一次性 / 长期互动），每个 task 以 chat session 形式与 agent 交互。Agent 层使用 Claude API 实现真实的 AI 对话能力。

---

## 2. 技术方案

### 2.1 技术栈

| 层面 | 技术选型 | 说明 |
|------|---------|------|
| 框架 | Next.js 15 (App Router) + React 19 + TypeScript | 全栈框架，API Routes + SSR |
| UI | shadcn/ui + Tailwind CSS v4 | 组件库 + 原子化 CSS，深色主题 |
| 数据库 | SQLite + Prisma 7 ORM | 轻量级本地数据库，`@prisma/adapter-better-sqlite3` 驱动 |
| 状态管理 | Zustand | 轻量级全局状态 |
| Agent | `@anthropic-ai/sdk` (Claude API) | AI 对话能力，支持 streaming |
| 辅助 | next-themes, sonner, lucide-react | 主题切换、Toast 通知、图标 |

### 2.2 架构设计

```
┌─────────────┐     ┌──────────────┐     ┌────────────┐
│   Frontend   │────▶│  API Routes  │────▶│  Database   │
│  (React 19)  │◀────│  (Next.js)   │◀────│  (SQLite)   │
│  + Zustand   │     │  + Agent Svc │     │  + Prisma   │
└─────────────┘     └──────────────┘     └────────────┘
                          │
                          ▼
                    ┌────────────┐
                    │ Claude API │
                    │ (Streaming) │
                    └────────────┘
```

**关键设计决策：**

- **SSE 流式传输**：消息 API 使用 Server-Sent Events 将 Claude 的回复实时推送到前端，实现打字机效果
- **每个 Task 独立对话上下文**：每个 task 维护独立的 message history，workspace 的 shared context 作为 system prompt 注入
- **System Prompt 按任务类型定制**：periodic / one_time / long_term 三种类型各有专门的 system prompt 策略
- **自定义 Resizable 面板**：纯 CSS flex + JS mouseEvent 实现，替代第三方库以确保兼容性

### 2.3 数据模型

```
Project (项目)
├── id, name, description, instruction, feishuLink
├── tasks[]          → Task (一对多，级联删除)
├── context[]        → ContextItem (一对多，级联删除)
└── outputs[]        → OutputArtifact (一对多，级联删除)

Task (任务)
├── id, projectId, name, description
├── type             → periodic | one_time | long_term
├── status           → pending | running | paused | stopped | completed | error | awaiting_input
├── scheduleConfig   → JSON (周期任务的间隔配置)
├── nextRunAt, lastRunAt
├── messages[]       → Message (一对多，级联删除)
└── outputs[]        → OutputArtifact (一对多，task 删除时置 null)

Message (消息)
├── id, taskId, role (user | agent | system), content, metadata

ContextItem (上下文)
├── id, projectId, name, type (file | url | feishu_folder | text_note), content

OutputArtifact (产出)
├── id, projectId, taskId?, name, type (report | document | data | code | other)
├── content, summary
```

### 2.4 目录结构

```
src/
├── app/
│   ├── layout.tsx, page.tsx, globals.css
│   ├── projects/
│   │   ├── page.tsx                          # 项目列表页
│   │   └── [projectId]/
│   │       ├── layout.tsx                    # workspace 布局 (h-screen)
│   │       └── page.tsx                      # workspace 页面
│   └── api/
│       ├── projects/        (route.ts + [projectId]/route.ts)
│       ├── tasks/           (route.ts + [taskId]/route.ts + [taskId]/control/route.ts)
│       ├── messages/        (route.ts — SSE streaming)
│       ├── context/         (route.ts + [contextId]/route.ts)
│       ├── outputs/         (route.ts + [outputId]/route.ts)
│       └── scheduler/       (route.ts)
├── lib/
│   ├── db.ts                # Prisma 单例
│   ├── agent.ts             # Claude SDK agent 服务 (chat / chatStream / periodic / progress)
│   ├── scheduler.ts         # 定时任务调度器
│   ├── constants.ts         # 标签映射、轮询间隔
│   └── utils.ts             # shadcn cn() 工具
├── stores/
│   ├── workspace-store.ts   # 选中项目/任务、面板开关
│   ├── tasks-store.ts       # 任务列表 CRUD + 控制
│   ├── messages-store.ts    # 消息 + SSE streaming 状态
│   ├── context-store.ts     # 上下文 CRUD
│   └── outputs-store.ts     # 产出 CRUD
├── hooks/
│   └── use-polling.ts       # 通用轮询 hook
├── types/
│   └── index.ts             # TaskType / TaskStatus / MessageRole 等枚举和接口
└── components/
    ├── ui/                  # shadcn 组件 (button, card, dialog, resizable 等)
    ├── providers/
    │   └── theme-provider.tsx
    ├── projects/
    │   ├── project-list.tsx
    │   ├── project-card.tsx
    │   └── create-project-dialog.tsx
    └── workspace/
        ├── workspace-shell.tsx          # 三栏 resizable 布局
        ├── left-panel/
        │   ├── left-panel.tsx           # 左栏容器
        │   ├── status-cards.tsx         # 运行中/已停止/需处理 统计
        │   ├── new-task-button.tsx
        │   ├── task-list.tsx
        │   └── task-list-item.tsx       # 任务卡片 (类型+状态徽章)
        ├── center-panel/
        │   ├── center-panel.tsx         # 中栏容器 (视图切换)
        │   ├── new-task-form.tsx        # 新建任务表单
        │   ├── task-header.tsx          # 任务名 + 控制按钮
        │   ├── chat-session.tsx         # 聊天会话
        │   ├── chat-message.tsx         # 消息气泡
        │   └── chat-input.tsx           # 输入框 + 发送
        └── right-panel/
            ├── right-panel.tsx          # 右栏容器 + Tabs
            ├── context-tab.tsx          # 上下文管理
            ├── context-item.tsx
            ├── output-tab.tsx           # 产出展示
            └── output-item.tsx
```

---

## 3. 功能清单

### 3.1 项目管理

| 功能 | 说明 |
|------|------|
| 项目列表 | 网格布局展示所有项目，显示任务数量 |
| 创建项目 | 弹窗填写名称、自然语言指令、飞书链接（可选） |
| 编辑项目 | PATCH API 支持修改项目信息 |
| 删除项目 | 级联删除所有关联的 task、message、context、output |

### 3.2 Workspace（三栏工作区）

| 功能 | 说明 |
|------|------|
| 三栏布局 | 左 30% / 中 40% / 右 30%，可拖拽调整宽度 |
| 右面板折叠 | 点击按钮收起右面板，中面板自动扩展 |
| 返回项目列表 | 左上角返回按钮 |

### 3.3 任务管理

| 功能 | 说明 |
|------|------|
| 创建任务 | 选择类型（一次性/周期/长期）+ 名称 + 描述 + 周期配置 |
| 任务列表 | 左面板展示，含类型徽章和状态徽章 |
| 状态统计 | 三张卡片：运行中(绿)、已停止(红)、需处理(橙) |
| 任务控制 | 暂停 / 恢复 / 停止按钮，状态实时切换 |
| 状态动画 | running 和 awaiting_input 状态有脉冲动画指示器 |

**任务类型行为：**

| 类型 | 创建后行为 | 特点 |
|------|-----------|------|
| `one_time` | 立即运行，agent 发送初始执行消息 | 完成后自动标记 completed |
| `periodic` | 计算 nextRunAt，等待调度器触发 | 按设定间隔自动执行 |
| `long_term` | 立即运行，agent 发送初始分析消息 | 持续跟踪，阶段性汇报 |

### 3.4 聊天对话

| 功能 | 说明 |
|------|------|
| 消息发送 | 输入框 + Enter 发送，Shift+Enter 换行 |
| 流式回复 | SSE 实时推送 Claude 回复，打字机效果 |
| 消息角色 | user(右侧蓝色) / agent(左侧带头像) / system(居中灰色) |
| 自动滚动 | 新消息和 streaming 时自动滚到底部 |
| 上下文注入 | workspace 的 shared context 自动注入 agent 的 system prompt |
| 产物解析 | agent 回复中的 `artifacts` 标记会自动解析并保存为 OutputArtifact |
| 状态变更 | agent 可通过 `status_change` 标记建议任务状态变更 |

### 3.5 上下文管理（右面板 - 上下文 Tab）

| 功能 | 说明 |
|------|------|
| 添加上下文 | 支持文本笔记、链接、文件、飞书文件夹四种类型 |
| 上下文列表 | 展示名称、类型徽章、内容预览 |
| 删除上下文 | hover 显示删除按钮 |
| Agent 引用 | 所有上下文自动作为 system prompt 的一部分提供给 agent |

### 3.6 产出管理（右面板 - 产出 Tab）

| 功能 | 说明 |
|------|------|
| 产出列表 | 展示名称、类型徽章、关联任务、摘要 |
| 折叠预览 | 点击展开/折叠内容预览（前 300 字符） |
| 完整查看 | 弹窗展示产出完整内容 |
| 自动生成 | agent 回复中包含 artifacts 标记时自动创建 |

### 3.7 定时调度

| 功能 | 说明 |
|------|------|
| 周期任务触发 | 轮询检查 nextRunAt 到期的周期任务，自动执行并生成报告 |
| 长期任务更新 | 超过 1 小时无活动的长期任务，自动生成进展更新 |
| 客户端轮询 | workspace 页面每 30 秒调用 `/api/scheduler` 触发检查 |

### 3.8 视觉设计

| 元素 | 设计 |
|------|------|
| 主题 | 深色主题 (Zinc 色系) |
| 类型徽章 | periodic=紫色, one_time=蓝色, long_term=琥珀色 |
| 状态徽章 | running=绿色, paused=黄色, stopped=红色, completed=绿色, awaiting_input=橙色 |
| 状态动画 | running 和 awaiting_input 带脉冲圆点 |
| Streaming | 打字光标闪烁动画 |
| 空状态 | "暂无任务" / "暂无上下文" / "暂无产出" 占位提示 |
| 加载态 | Skeleton 骨架屏 |

---

## 4. API 接口一览

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/projects` | 项目列表 |
| POST | `/api/projects` | 创建项目 |
| GET | `/api/projects/[id]` | 项目详情（含 tasks/context/outputs） |
| PATCH | `/api/projects/[id]` | 更新项目 |
| DELETE | `/api/projects/[id]` | 删除项目 |
| GET | `/api/tasks?projectId=` | 任务列表 |
| POST | `/api/tasks` | 创建任务（自动触发 agent 初始消息） |
| GET | `/api/tasks/[id]` | 任务详情 |
| PATCH | `/api/tasks/[id]` | 更新任务 |
| DELETE | `/api/tasks/[id]` | 删除任务 |
| POST | `/api/tasks/[id]/control` | 任务控制（pause/resume/stop） |
| GET | `/api/messages?taskId=` | 消息列表 |
| POST | `/api/messages` | 发送消息（返回 SSE 流式 agent 回复） |
| GET | `/api/context?projectId=` | 上下文列表 |
| POST | `/api/context` | 添加上下文 |
| PATCH | `/api/context/[id]` | 更新上下文 |
| DELETE | `/api/context/[id]` | 删除上下文 |
| GET | `/api/outputs?projectId=` | 产出列表 |
| POST | `/api/outputs` | 创建产出 |
| DELETE | `/api/outputs/[id]` | 删除产出 |
| POST | `/api/scheduler` | 触发定时任务检查 |

---

## 5. 环境变量

```env
DATABASE_URL="file:./dev.db"
# ANTHROPIC_API_KEY — 从系统环境变量继承，Claude SDK 自动读取
```

## 6. 启动方式

```bash
# 安装依赖
npm install

# 生成 Prisma Client + 推送 schema 到数据库
npx prisma generate && npx prisma db push

# （可选）填充示例数据
npx tsx prisma/seed.mts

# 启动开发服务器
npm run dev
```

访问 `http://localhost:3000` 进入系统。
