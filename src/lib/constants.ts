export const TASK_TYPE_LABELS: Record<string, string> = {
  periodic: "周期任务",
  one_time: "一次性任务",
  proactive: "主动探索",
};

export const TASK_STATUS_LABELS: Record<string, string> = {
  pending: "待启动",
  running: "进行中",
  completed: "已执行",
  awaiting_input: "待你处理",
};

export const CONTEXT_TYPE_LABELS: Record<string, string> = {
  file: "文件",
  url: "链接",
  feishu_folder: "飞书文件夹",
  text_note: "文本笔记",
};

export const OUTPUT_TYPE_LABELS: Record<string, string> = {
  report: "报告",
  document: "文档",
  data: "数据",
  code: "代码",
  other: "其他",
};

export const POLLING_INTERVAL_MS = 30000;
