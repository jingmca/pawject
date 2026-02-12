# Chrome 手动验收测试清单

## 前置条件
- 确保 Node.js >= 20.9.0
- 确保 dev server 在运行: `npx next dev`
- 打开 Chrome 访问 http://localhost:3000

---

## 测试 1: 项目列表页
- [ ] 访问 http://localhost:3000/projects
- [ ] 页面正常显示项目列表
- [ ] 点击一个项目进入工作区

## 测试 2: 工作区三栏布局
- [ ] 左侧面板：显示任务列表和状态卡片
- [ ] 中间面板：显示任务创建表单或对话
- [ ] 右侧面板：显示三个 Tab（Contributions / Graph / **Agent**）

## 测试 3: Agent Tab（新功能）
- [ ] 点击右侧面板的 **Agent** Tab
- [ ] 显示 "Project Agent" 状态卡片
  - 状态指示灯（绿色=运行中 / 灰色=已停止）
  - 启动/停止按钮
- [ ] 显示 "待办事项" 区域
  - 如果有 user todos 会列出
  - 红色卡片 = 需要补充信息 (ASK_USER_CONTEXT)
  - 橙色卡片 = 需要确认决策 (ASK_USER_CONFIRM)
  - 可以点击 "回复" 按钮输入回复
  - CONFIRM 类型可以直接点击 "确认" 按钮

## 测试 4: 创建任务 + 聊天（Tool Use 展示）
- [ ] 在中间面板创建一个 one_time 类型任务
- [ ] 输入消息并发送
- [ ] 观察 agent 执行过程中是否出现 **折叠式工具卡片**
  - 收起时显示工具名和摘要（如 "Read src/lib/agent.ts"）
  - 展开时显示完整 input JSON
  - 最新工具调用带脉冲指示器
- [ ] Agent 回复完成后，工具卡片折叠为 "N tool calls" 摘要

## 测试 5: ASK_USER 双类型
- [ ] 如果 agent 回复包含 `[ASK_USER_CONTEXT: ...]` → 显示红色卡片
- [ ] 如果 agent 回复包含 `[ASK_USER_CONFIRM: ...]` → 显示橙色卡片
- [ ] 两种类型有不同的图标和文字

## 测试 6: Contributions Tab
- [ ] Context 区域可以添加/删除上下文项
- [ ] Agent Drafts 区域显示产出文件
- [ ] 点击文件可以在预览面板中查看

## 测试 7: Graph Tab
- [ ] 显示事件时间线
- [ ] 不同事件类型有不同颜色和图标

---

## API 自动化测试

运行自动化测试脚本:
```bash
bash scripts/test-acceptance.sh
```

预期结果: ALL TESTS PASSED (37/37)
