import { create } from "zustand";
import type { AskUserQuery } from "@/types";

interface AskUserState {
  queries: AskUserQuery[];
  loading: boolean;
  fetchQueries: (projectId: string) => Promise<void>;
  addQuery: (query: AskUserQuery) => void;
  removeQuery: (taskId: string) => void;
}

export const useAskUserStore = create<AskUserState>((set) => ({
  queries: [],
  loading: false,

  fetchQueries: async (projectId: string) => {
    set({ loading: true });
    try {
      const res = await fetch(`/api/ask-user-queries?projectId=${projectId}`);
      if (res.ok) {
        const data = await res.json();
        set({ queries: data });
      }
    } finally {
      set({ loading: false });
    }
  },

  addQuery: (query) =>
    set((state) => ({
      queries: [...state.queries.filter((q) => q.taskId !== query.taskId), query],
    })),

  removeQuery: (taskId) =>
    set((state) => ({
      queries: state.queries.filter((q) => q.taskId !== taskId),
    })),
}));
