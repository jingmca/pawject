import { create } from "zustand";

interface AgentStatus {
  running: boolean;
  status: string;
  lastHeartbeat: string | null;
  pid: number | null;
}

interface UserTodo {
  id: string;
  projectId: string;
  taskId: string;
  type: string;
  query: string;
  suggestion: string | null;
  priority: string;
  resolved: boolean;
  response: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

interface ProjectAgentState {
  agentStatus: AgentStatus | null;
  userTodos: UserTodo[];
  loading: boolean;
  actionLoading: boolean;

  fetchAgentStatus: (projectId: string) => Promise<void>;
  fetchUserTodos: (projectId: string) => Promise<void>;
  startAgent: (projectId: string) => Promise<void>;
  stopAgent: (projectId: string) => Promise<void>;
  resolveUserTodo: (todoId: string, response?: string) => Promise<void>;
}

export const useProjectAgentStore = create<ProjectAgentState>((set, get) => ({
  agentStatus: null,
  userTodos: [],
  loading: false,
  actionLoading: false,

  fetchAgentStatus: async (projectId: string) => {
    try {
      const res = await fetch(`/api/project-agent?projectId=${projectId}`);
      if (res.ok) {
        const data = await res.json();
        set({ agentStatus: data });
      }
    } catch {
      // ignore
    }
  },

  fetchUserTodos: async (projectId: string) => {
    set({ loading: true });
    try {
      const res = await fetch(`/api/user-todos?projectId=${projectId}`);
      if (res.ok) {
        const data = await res.json();
        set({ userTodos: data });
      }
    } finally {
      set({ loading: false });
    }
  },

  startAgent: async (projectId: string) => {
    set({ actionLoading: true });
    try {
      const res = await fetch("/api/project-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, action: "start" }),
      });
      if (res.ok) {
        const data = await res.json();
        set({ agentStatus: data });
      }
    } finally {
      set({ actionLoading: false });
    }
  },

  stopAgent: async (projectId: string) => {
    set({ actionLoading: true });
    try {
      const res = await fetch("/api/project-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, action: "stop" }),
      });
      if (res.ok) {
        const data = await res.json();
        set({ agentStatus: data });
      }
    } finally {
      set({ actionLoading: false });
    }
  },

  resolveUserTodo: async (todoId: string, response?: string) => {
    try {
      const res = await fetch("/api/user-todos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: todoId, response }),
      });
      if (res.ok) {
        set((state) => ({
          userTodos: state.userTodos.map((t) =>
            t.id === todoId ? { ...t, resolved: true, response: response || null } : t
          ),
        }));
      }
    } catch {
      // ignore
    }
  },
}));
