import { create } from "zustand";
import type { Task } from "@/generated/prisma/client";

interface TaskWithCount extends Task {
  _count?: { messages: number };
}

interface TasksState {
  tasks: TaskWithCount[];
  loading: boolean;
  fetchTasks: (projectId: string) => Promise<void>;
  createTask: (data: {
    projectId: string;
    name: string;
    description?: string;
    type: string;
    scheduleConfig?: string;
  }) => Promise<TaskWithCount>;
  controlTask: (
    taskId: string,
    action: "pause" | "resume" | "stop"
  ) => Promise<void>;
  updateTaskInList: (task: TaskWithCount) => void;
}

export const useTasksStore = create<TasksState>((set, get) => ({
  tasks: [],
  loading: false,

  fetchTasks: async (projectId) => {
    set({ loading: true });
    try {
      const res = await fetch(`/api/tasks?projectId=${projectId}`);
      const tasks = await res.json();
      set({ tasks, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  createTask: async (data) => {
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const task = await res.json();
    set({ tasks: [task, ...get().tasks] });
    return task;
  },

  controlTask: async (taskId, action) => {
    const res = await fetch(`/api/tasks/${taskId}/control`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const updated = await res.json();
    set({
      tasks: get().tasks.map((t) => (t.id === taskId ? { ...t, ...updated } : t)),
    });
  },

  updateTaskInList: (task) => {
    set({
      tasks: get().tasks.map((t) => (t.id === task.id ? task : t)),
    });
  },
}));
