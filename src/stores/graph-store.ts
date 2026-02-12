import { create } from "zustand";
import type { GraphEvent } from "@/types";

interface GraphState {
  events: GraphEvent[];
  loading: boolean;
  fetchEvents: (projectId: string) => Promise<void>;
}

export const useGraphStore = create<GraphState>((set) => ({
  events: [],
  loading: false,

  fetchEvents: async (projectId: string) => {
    set({ loading: true });
    try {
      const res = await fetch(`/api/graph-events?projectId=${projectId}`);
      if (res.ok) {
        const data = await res.json();
        set({ events: data });
      }
    } finally {
      set({ loading: false });
    }
  },
}));
