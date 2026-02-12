# Agent Project System — 产品与技术设计文档

> 让 AI Agent 像团队成员一样，持续、自主地为你工作。

---

## 一、产品定位

### 核心问题

当前 AI 对话工具是"一问一答"模式——用户发起，AI 响应，对话结束就结束了。但现实中大量工作是持续性的：每天要做的简报、长期跟踪的项目、需要多轮协作的任务。目前没有好的方式让 AI "一直在干活"。

### 解决思路

把 AI Agent 从"对话工具"升级为"项目成员"：

| 传统 AI 对话 | Agent Project System |
|---|---|
| 一问一答，用完即走 | Agent 持续驻留在项目中 |
| 用户驱动，手动触发 | Agent 自主执行，定时汇报 |
| 单次对话，无记忆延续 | 项目级上下文，跨任务共享 |
| 纯文本输出 | 产出文件、报告等可交付物 |

### 一句话总结

一个 AI Agent 的项目管理平台——你可以把多个 AI Agent 组织到一个项目里，给它们分配一次性、周期性或长期跟踪的任务，它们会自主执行、定时汇报、遇到问题主动问你，产出直接写成文件。就像你多了几个 7×24 在线的虚拟助手。

---

## 二、任务模型

### 三种任务类型

**一次性任务 (One-time)** — "帮我做个竞品分析"，Agent 立即执行，完成即结束。

**周期任务 (Periodic)** — "每天早上出一份 AI 行业简报"，Agent 定时自动执行，持续产出。

**长期任务 (Long-term)** — "持续跟踪竞对动态，有重要变化就告诉我"，Agent 长期驻留，阶段性汇报。

### Human-in-the-Loop 机制

Agent 遇到无法自主决定的问题时，通过两个标准化 Action 与用户交互：

**ASK_USER_CONTEXT(query)** — Agent 缺乏信息，无法继续。Project Agent 凭借全局视野判断：该信息是否已存在于 context 或其他 task 产出中？如果确实缺失，建议用户补充到 project 级别（多 task 复用）还是 task 级别（仅本任务需要）。

**ASK_USER_CONFIRM(query)** — Agent 有方案但需要用户决策。给出选项或草稿，用户确认后自动恢复执行。

---

## 三、两层 Agent 架构

### 架构概览

```
┌──────────────────────────────────────────────┐
│             Project Agent（管理者）            │
│  · 拥有全局视野，了解所有 task 和 context      │
│  · 管理任务调度、状态汇总、用户视图            │
│  · 通过 Skills 读写项目级文件                  │
│  · CLAUDE.md 定义角色、能力和工作目录结构       │
├──────────────────────────────────────────────┤
│   Task 1 (执行单元)  │  Task 2  │  Task 3    │
│   · 独立工作目录      │          │            │
│   · 独立 CLAUDE.md   │          │            │
│   · 独立 todo.md     │          │            │
│   · 通过指令判断      │          │            │
│     是否需要用户介入   │          │            │
└──────────────────────────────────────────────┘
```

### Project Agent 的职责

- 巡检各 task 子目录，通过 todo.md 感知任务状态
- 汇总所有 ASK_USER_* 条目，生成用户侧 todo list
- 维护 workspace_view.md，管理用户视图的排序和展示
- 维护 tasks.md，管理任务列表和状态
- 判断跨 task 的信息复用（某个 task 需要的信息是否已在 context 或其他 task 产出中）

### Task 的自治能力

每个 task 通过自己的 CLAUDE.md 约束行为，根据指令自主判断是否需要生成 todo 条目。当需要用户介入时，调用 ASK_USER_CONTEXT 或 ASK_USER_CONFIRM，结果写入 todo.md。

---

## 四、文件系统设计

### 核心设计哲学

> 文件即状态，Agent 通过读写文件来感知和操作一切。

所有 UI 都是文件的投影，Agent 的一切行为都有据可查，Git 记录完整历史。

### 目录结构

```
project/
├── CLAUDE.md                  # Project Agent 角色定义和能力描述
├── tasks.md                   # 任务列表和状态（驱动左栏 Task List）
├── workspace_view.md          # 用户视图配置（驱动右栏 Workspace 排序）
├── user_todos.md              # 汇总的用户待办（驱动 Todo 面板）
│
├── context/                   # 项目级共享上下文（用户上传的资料）
│   ├── 竞品资料.pdf
│   ├── 风格指南.md
│   └── ...
│
├── task-daily-jokes/          # Task 1 工作目录
│   ├── CLAUDE.md              # Task 级指令和约束
│   ├── todo.md                # Agent 内部工作状态（含 ASK_USER_* 条目）
│   └── drafts/
│       ├── 每日趣味段子_2026_02_12.md
│       └── 每日趣味段子_2026_02_11.md
│
├── task-competitor-analysis/  # Task 2 工作目录
│   ├── CLAUDE.md
│   ├── todo.md
│   └── drafts/
│       └── 分析框架_草稿.md
│
└── .git/                      # Project 级版本控制
```

### 文件协议说明

| 文件 | 写入者 | 读取者 | 作用 |
|---|---|---|---|
| `CLAUDE.md` (project) | 人 + Agent | Agent | Project Agent 角色和能力定义 |
| `CLAUDE.md` (task) | Agent（人可调整） | Agent | Task 行为约束和指令 |
| `tasks.md` | Agent（人可触发） | 人 + Agent | 项目有哪些任务、类型、状态 |
| `workspace_view.md` | Agent | 人（通过 UI） | 右栏 Workspace 排序和展示逻辑 |
| `user_todos.md` | Agent | 人（通过 UI） | 汇总的用户待办事项和优先级 |
| `todo.md` (task 内) | Agent | Agent | 单任务内部工作状态和进度 |
| `context/*` | 人 | Agent | 项目级共享知识和参考资料 |
| `task-xxx/drafts/*` | Agent | 人 | 任务产出物 |

### Git 策略

Project 级 Git 覆盖整个项目目录，自动记录所有文件变更。作用包括：

- 追溯 todo 的变更历史（何时提出、何时响应、响应后如何推进）
- 记录 Agent 产出的版本演进
- 为 Agent View 提供工作过程数据源
- 任何时候 DB 不一致，可从文件 + Git 重建

---

## 五、Agent Skills 体系

### Project Agent Skills

| Skill | 功能 | 操作的文件 |
|---|---|---|
| `manage_tasks` | 创建/更新/删除任务 | `tasks.md` + 创建 task 子目录 |
| `update_workspace_view` | 更新用户视图排序和推荐理由 | `workspace_view.md` |
| `aggregate_todos` | 汇总各 task 的 ASK_USER_* 为用户待办 | 读取各 `todo.md` → 写入 `user_todos.md` |
| `read_context` | 读取项目级共享资料 | `context/*` |
| `cross_task_query` | 查询其他 task 的产出 | `task-xxx/drafts/*` |

### Task Agent Skills

| Skill | 功能 | 操作的文件 |
|---|---|---|
| `ASK_USER_CONTEXT(query)` | 请求用户补充信息，附带补充位置建议 | 写入 `todo.md` |
| `ASK_USER_CONFIRM(query)` | 请求用户确认决策 | 写入 `todo.md` |
| `update_progress` | 更新任务内部进度 | `todo.md` |
| `write_draft` | 生成或更新产出文件 | `drafts/*` |
| `read_project_context` | 读取项目级 context | `../context/*` |

---

## 六、交互设计

### 三栏式 Workspace 布局

```
┌──────────────┬────────────────────┬──────────────────────┐
│   左栏        │   中栏             │   右栏                │
│   Task List   │   对话区           │   Todo + Tabs         │
│              │                    │                      │
│  任务列表     │  与 Agent 的        │  ┌─ Todo List ──────┐ │
│  + 状态图标   │  聊天对话           │  │ 需要处理的事项    │ │
│              │                    │  │ 带优先级和类型    │ │
│  ● 运行中     │  人机协作的         │  └──────────────────┘ │
│  ● 已完成     │  主界面             │                      │
│  ● 等待确认   │                    │  [Workspace][AgentView]│
│              │                    │                      │
│  + 新建任务   │  支持自然语言       │  Workspace 或         │
│              │  创建和管理任务      │  Agent View 内容      │
│              │                    │                      │
└──────────────┴────────────────────┴──────────────────────┘
```

### 右栏详细设计

#### Todo List 面板（常驻顶部）

独立于 tab 之外，常驻且可折叠。有待办时展开并显示角标数字，全部处理完自动收起。数据源为 `user_todos.md`。

```
┌─ 需要你处理 (3) ─────────────────────────────────┐
│                                                    │
│ 🔴 竞品分析 — 确认分析框架                          │
│    "我整理了两个分析维度，你倾向哪个方向？"          │
│    → 查看详情 / 快速回复                            │
│                                                    │
│ 🟡 每日简报 — 补充信息源                            │
│    "目前只有 36kr 和虎嗅，是否需要增加英文源？"      │
│    → 建议补充到：项目资料（其他任务也能用）          │
│    → 查看详情 / 快速回复                            │
│                                                    │
│ 🟢 周报生成 — 确认发送                              │
│    "本周周报已生成，确认后自动发送"                  │
│    → 查看草稿 / 确认 / 修改                         │
│                                                    │
└──────────────────────────────────────────────────────┘
```

优先级说明：🔴 阻塞型（缺信息无法继续）> 🟡 决策型（有方案待确认）> 🟢 通知型（完成确认）。

ASK_USER_CONTEXT 条目附带 Project Agent 的建议（补充到项目级还是 task 级），体现全局视野。

#### Workspace Tab — 文件夹视图

用户心智模型："我和 Agent 共享的文件夹，按事项分类"。使用 GroupBy 卡片展示。

```
┌─ 📂 项目资料 ──────────────────────────────────┐
│                                                  │
│  📄 段子风格指南.md          📄 受众偏好.txt      │
│  📄 往期精选.md              ＋ 添加资料          │
│                                                  │
└──────────────────────────────────────────────────┘

┌─ 📂 每日段子生成 ──────────────── 🟢 今日完成 ──┐
│                                                  │
│  📄 每日趣味段子_02_12.md  ← 最新                │
│  📄 每日趣味段子_02_11.md                        │
│  📄 每日趣味段子_02_10.md                        │
│  ··· 查看更多                                    │
│                                                  │
└──────────────────────────────────────────────────┘

┌─ 📂 竞品分析 ──────────────── 🟡 等待确认 ──────┐
│                                                  │
│  📄 分析框架_草稿.md                              │
│  📄 数据采集记录.md                               │
│                                                  │
└──────────────────────────────────────────────────┘
```

设计要点：

- 第一个卡片固定为"项目资料"（project/context），后面按 task 排列
- 每张卡片右上角带 task 状态图标
- 默认按创建时间排序，支持切换为 Agent 推荐排序
- Agent 推荐排序时，卡片可显示排序理由（如"有待确认事项，建议优先处理"）
- 排序逻辑由 `workspace_view.md` 驱动
- 点击文件直接预览，点击卡片标题跳转到中栏对应 task 对话

排序切换器：

```
排序：创建时间 ↓  |  🤖 Agent 推荐
```

#### Agent View Tab — 时间轴 + 状态视图

按时间状态 GroupBy，分三组展示：

```
── 已完成 ──────────────────────────────────────────

┌ 每日段子生成 · 今日轮次                           ┐
│ ✅ 读取风格指南和往期精选                          │
│ ✅ 生成 12 个段子，分 4 个主题                     │
│ ✅ 输出 每日趣味段子_02_12.md                      │
│ 耗时 2 分钟 · 11:55 → 11:57                      │
└───────────────────────────────────────────────────┘

── 进行中 ──────────────────────────────────────────

┌ 竞品分析                             40% ████░░  ┐
│ ✅ 确定分析目标                                   │
│ ✅ 采集 3 家竞品数据                              │
│ 🔵 撰写分析框架 ← 等待用户确认后继续              │
│ ○ 生成完整报告                                    │
│ ○ 交叉验证结论                                    │
└───────────────────────────────────────────────────┘

── 待启动 ──────────────────────────────────────────

┌ 每日段子生成 · 明日轮次                           ┐
│ ⏱ 计划执行：明天 08:00                            │
└───────────────────────────────────────────────────┘
```

设计要点：

- 数据源为各 task 的 `todo.md` + Git log，由 Project Agent 加工
- 已完成的任务折叠为摘要，可展开查看详细步骤
- 进行中的任务展开显示每一步进度
- 待启动的仅显示计划时间
- 此视图为只读观察视图，操作回到 Workspace 或对话区

### 两个 Tab 的定位区分

| 维度 | Workspace | Agent View |
|---|---|---|
| 组织方式 | 按空间（文件夹） | 按时间和进度（状态分组） |
| 用户意图 | "我要找东西、放东西" | "我要了解全局进展" |
| 可操作性 | 上传、预览、下载 | 只读观察 |
| 回答的问题 | 东西在哪、长什么样 | Agent 在干什么、干到哪了 |

---

## 七、状态管理架构

### 分层设计：文件是源，DB 是索引

```
Agent 写入层（Source of Truth）
  └── Markdown 文件（todo.md, tasks.md, workspace_view.md, user_todos.md）
        │
        │  文件监听 / Git Hook
        ▼
状态同步层（自动）
  └── SQLite 数据库
        │
        │  查询 / 订阅 / WebSocket 推送
        ▼
UI 渲染层
  └── 左栏 Task List、右栏 Todo 面板、Workspace、Agent View
```

### 设计原则

**Agent 侧不感知 DB。** Agent 继续通过 Skills 读写 Markdown 文件，这是它的工作方式，不要改变。Agent 的世界观是干净的——一切都是文件。

**文件变更自动同步到 DB。** 文件系统上挂 watcher（或每次 Git commit 触发 hook），自动将文件内容解析后同步到 DB。

**UI 层全部从 DB 读取。** 支持实时查询、过滤、排序、角标计数等，避免遍历文件系统的性能开销。

**文件是 Single Source of Truth。** 任何时候 DB 不一致或数据丢失，都可以从文件 + Git 完整重建。

### DB Schema（SQLite）

```sql
-- 任务表
CREATE TABLE tasks (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    type        TEXT NOT NULL CHECK (type IN ('one-time', 'periodic', 'long-term')),
    status      TEXT NOT NULL CHECK (status IN (
                    'pending', 'running', 'completed',
                    'awaiting_input', 'paused', 'failed'
                )),
    priority    INTEGER DEFAULT 0,
    schedule    TEXT,               -- 周期任务的 cron 表达式或自然语言描述
    description TEXT,
    directory   TEXT NOT NULL,      -- task 子目录路径
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 用户待办表
CREATE TABLE user_todos (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id     TEXT NOT NULL REFERENCES tasks(id),
    type        TEXT NOT NULL CHECK (type IN ('ASK_USER_CONTEXT', 'ASK_USER_CONFIRM')),
    query       TEXT NOT NULL,      -- Agent 的问题
    suggestion  TEXT,               -- Project Agent 的建议（如补充位置）
    priority    TEXT CHECK (priority IN ('high', 'medium', 'low')),
    resolved    BOOLEAN DEFAULT FALSE,
    response    TEXT,               -- 用户的回复
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    resolved_at DATETIME
);

-- 文件表
CREATE TABLE files (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id     TEXT REFERENCES tasks(id),  -- NULL 表示 project/context 级
    path        TEXT NOT NULL,
    filename    TEXT NOT NULL,
    author      TEXT NOT NULL CHECK (author IN ('user', 'agent')),
    file_type   TEXT,               -- draft / context / config
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Agent 活动日志（从 Git log 同步）
CREATE TABLE activity_log (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id     TEXT REFERENCES tasks(id),
    action      TEXT NOT NULL,      -- read / write / create / ask_user / complete
    target      TEXT,               -- 操作的文件或资源
    summary     TEXT,               -- 人类可读的操作摘要
    git_hash    TEXT,               -- 关联的 Git commit
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 同步机制

```
文件变更事件
    │
    ├── fs.watch / chokidar 监听文件系统变更
    │   适用于：实时性要求高的场景（todo 状态更新）
    │
    └── Git post-commit hook
        适用于：批量变更后的一致性同步（Agent 完成一轮工作后）
    │
    ▼
解析器（Parser）
    │
    ├── tasks.md → tasks 表
    ├── user_todos.md → user_todos 表
    ├── workspace_view.md → 排序配置
    ├── todo.md（各 task） → 内部状态 + 活动日志
    └── 文件增删 → files 表
    │
    ▼
SQLite 写入 → WebSocket 广播 → UI 更新
```

### 用户操作的回写路径

用户在 UI 上的操作（如确认 todo、上传文件）需要双写：

1. **先写文件**（让 Agent 能感知到变更）
2. **再同步 DB**（让 UI 立即更新）

```
用户确认 todo
    → 更新 task/todo.md（标记 ASK_USER_CONFIRM 为已回复）
    → 更新 user_todos.md（移除或标记已处理）
    → DB 同步（通过 watcher 自动触发，或 UI 层直接写入加速）
    → Agent 下次巡检时读到文件变更，恢复执行
```

---

## 八、技术选型

### 整体架构

```
┌───────────────────────────────────────────────────────┐
│                     Web Frontend                       │
│              React + TypeScript + Tailwind              │
│    左栏 TaskList │ 中栏 Chat │ 右栏 Todo/Workspace/View │
└──────────────────────┬────────────────────────────────┘
                       │ WebSocket + REST API
                       ▼
┌───────────────────────────────────────────────────────┐
│                     Backend Server                     │
│                    Node.js + Express                   │
│                                                       │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Task        │  │ File Sync    │  │ WebSocket    │ │
│  │ Scheduler   │  │ Service      │  │ Server       │ │
│  └─────────────┘  └──────────────┘  └──────────────┘ │
│         │                │                  │         │
│         ▼                ▼                  ▼         │
│  ┌─────────────────────────────────────────────────┐ │
│  │              SQLite (better-sqlite3)             │ │
│  └─────────────────────────────────────────────────┘ │
└──────────┬────────────────────────────────────────────┘
           │ Spawns / manages
           ▼
┌───────────────────────────────────────────────────────┐
│              Claude Code CLI (Agent 引擎)              │
│                                                       │
│  ┌─────────────────┐    ┌─────────────────────────┐  │
│  │ Project Agent   │    │ Task Execution          │  │
│  │ (管理者)        │    │ (独立子进程 per task)    │  │
│  └─────────────────┘    └─────────────────────────┘  │
│         │                          │                  │
│         ▼                          ▼                  │
│  ┌─────────────────────────────────────────────────┐ │
│  │           Project 文件系统 + Git                  │ │
│  └─────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────┘
```

### 前端

| 选型 | 说明 |
|---|---|
| React + TypeScript | 组件化开发，类型安全 |
| Tailwind CSS | 快速样式开发，适合三栏布局 |
| Zustand | 轻量状态管理，比 Redux 简洁 |
| WebSocket (native) | 实时接收 Agent 状态更新和文件变更推送 |
| Monaco Editor | 文件预览和编辑（可选，用于 markdown 预览） |
| react-markdown | Markdown 渲染（产出文件预览） |

### 后端

| 选型 | 说明 |
|---|---|
| Node.js + Express | 轻量 Web Server，与 Claude Code CLI 同生态 |
| better-sqlite3 | 同步 SQLite 驱动，嵌入进程，零运维 |
| chokidar | 文件系统监听，跨平台，高性能 |
| simple-git | Git 操作封装（读取 log、diff） |
| node-cron | 周期任务调度 |
| ws | WebSocket Server |

### Agent 引擎

| 选型 | 说明 |
|---|---|
| Claude Code CLI | 底层 Agent 执行引擎，每个 task 独立子进程 |
| CLAUDE.md | Agent 指令和约束定义 |
| 自定义 Skills（bash/脚本） | Agent 的扩展能力（通过 CLAUDE.md 中定义的工具） |

### 存储

| 层级 | 选型 | 作用 |
|---|---|---|
| 文件系统 | 本地文件 + Git | Source of Truth，Agent 读写，版本追溯 |
| 数据库 | SQLite (better-sqlite3) | 派生索引，UI 查询，实时状态 |
| 未来扩展 | PostgreSQL | 多项目、多用户协作时迁移 |

### 选型理由

**为什么 SQLite 而非 PostgreSQL？** 单项目内数据量有限（几十个 task、几百个文件），SQLite 嵌入进程零运维，读性能极高。文件是 Source of Truth，DB 只是索引——即使 DB 损坏也可从文件重建。多用户协作场景再考虑升级。

**为什么 chokidar 而非 Git hook？** 两者配合使用。chokidar 提供文件级实时监听（毫秒级延迟），Git post-commit hook 提供批量变更后的一致性校验。chokidar 覆盖实时性，Git hook 覆盖完整性。

**为什么不让 Agent 直接写 DB？** 保持 Agent 世界观的纯净——Agent 只知道文件系统和 Git，不感知 DB 存在。这样 Agent 的行为完全可追溯（Git log），且 Agent 引擎可以替换而不影响上层系统。

---

## 九、关键流程

### 9.1 用户创建新任务

```
用户在左栏点击"+ 新建任务"
    → 输入任务名称、类型（one-time/periodic/long-term）、描述
    → Backend 创建 task 子目录
    → 生成 task/CLAUDE.md（含任务指令和约束）
    → 生成 task/todo.md（初始状态）
    → 更新 tasks.md（添加新任务条目）
    → DB 同步（通过 watcher）
    → UI 更新左栏列表
    → 如果是 periodic，注册 cron job
    → 启动 Claude Code CLI 子进程执行任务
```

### 9.2 Agent 执行任务并请求用户输入

```
Agent 执行 task，发现缺少关键信息
    → Agent 调用 ASK_USER_CONTEXT(query)
    → 写入 task/todo.md：
        ## ASK_USER_CONTEXT
        - query: "目前只有 36kr 和虎嗅，是否需要增加英文源？"
        - status: pending
        - suggested_scope: project  # Project Agent 建议补充到项目级
    → Agent 暂停执行
    → Project Agent 巡检发现新的 ASK_USER_* 条目
    → 更新 user_todos.md（汇总待办）
    → DB 同步 → WebSocket 推送 → UI 显示 Todo 面板角标
    → 用户回复："加上 TechCrunch 和 The Verge"
    → UI 写入 task/todo.md（标记为 resolved，附带用户回复）
    → 更新 user_todos.md（移除条目）
    → Agent 读取变更，恢复执行
```

### 9.3 周期任务自动执行

```
node-cron 触发定时任务
    → 检查 task 状态（是否有未解决的 awaiting_input）
    → 如果就绪，启动 Claude Code CLI 子进程
    → Agent 读取 context/ 和上次产出
    → 生成新的产出文件到 task/drafts/
    → 更新 todo.md 状态为 completed
    → Git commit
    → DB 同步 → UI 更新
    → 等待下次触发
```

---

## 十、待决策事项

### 产品层面

1. **Task 并发上限** — 单个 project 最多同时运行多少个 task？Claude Code CLI 的并发能力边界？
2. **Agent 推荐排序的算法** — workspace_view.md 里 Agent 按什么逻辑排序？需要定义排序规则还是让 Agent 自由发挥？
3. **用户 Todo 的超时机制** — 如果用户长期不处理 ASK_USER_* 条目，Agent 是否需要降级处理或二次提醒？
4. **跨项目的 Agent 能力** — 是否支持一个 Agent 同时服务多个 project？
5. **权限模型** — 多人协作场景下，谁能给 Agent 下达指令、谁能确认 todo？

### 技术层面

1. **Claude Code CLI 进程管理** — 长期任务的 Agent 进程如何保活？crash 后如何恢复？
2. **文件冲突处理** — 多个 task 的 Agent 同时修改 project 级文件时的冲突策略
3. **DB 同步延迟** — chokidar 的防抖策略，避免高频文件写入导致的 DB 风暴
4. **安全沙箱** — Agent 的文件系统访问范围是否需要限制在 project 目录内？
5. **日志和监控** — Agent 执行过程的日志采集和异常告警机制
