export const TaskType = {
  PERIODIC: "periodic",
  ONE_TIME: "one_time",
  PROACTIVE: "proactive",
} as const;
export type TaskType = (typeof TaskType)[keyof typeof TaskType];

export const TaskStatus = {
  PENDING: "pending",
  RUNNING: "running",
  COMPLETED: "completed",
  AWAITING_INPUT: "awaiting_input",
} as const;
export type TaskStatus = (typeof TaskStatus)[keyof typeof TaskStatus];

export const MessageRole = {
  USER: "user",
  AGENT: "agent",
  SYSTEM: "system",
} as const;
export type MessageRole = (typeof MessageRole)[keyof typeof MessageRole];

export const ContextType = {
  FILE: "file",
  URL: "url",
  FEISHU_FOLDER: "feishu_folder",
  TEXT_NOTE: "text_note",
} as const;
export type ContextType = (typeof ContextType)[keyof typeof ContextType];

export const OutputType = {
  REPORT: "report",
  DOCUMENT: "document",
  DATA: "data",
  CODE: "code",
  OTHER: "other",
} as const;
export type OutputType = (typeof OutputType)[keyof typeof OutputType];

export interface ScheduleConfig {
  intervalMinutes: number;
  description?: string;
}

export interface AgentResponse {
  content: string;
  taskStatusChange?: TaskStatus;
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

export interface TaskControlAction {
  action: "stop";
}

export interface FilePreviewTarget {
  id: string;
  name: string;
  type: "context" | "draft";
  content: string;
  filePath?: string;
  language?: string;
}

export interface AskUserQuery {
  taskId: string;
  taskName: string;
  question: string;
  messageId: string;
  createdAt: Date;
}

export interface GraphEvent {
  id: string;
  type:
    | "context_added"
    | "draft_generated"
    | "task_created"
    | "task_completed"
    | "ask_user";
  label: string;
  detail: string;
  taskId?: string;
  timestamp: Date;
}
