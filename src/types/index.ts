export const TaskType = {
  PERIODIC: "periodic",
  ONE_TIME: "one_time",
  LONG_TERM: "long_term",
} as const;
export type TaskType = (typeof TaskType)[keyof typeof TaskType];

export const TaskStatus = {
  PENDING: "pending",
  RUNNING: "running",
  PAUSED: "paused",
  STOPPED: "stopped",
  COMPLETED: "completed",
  ERROR: "error",
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
  artifacts?: Array<{
    name: string;
    type: string;
    content: string;
    summary: string;
  }>;
}

export interface TaskControlAction {
  action: "pause" | "resume" | "stop";
}
