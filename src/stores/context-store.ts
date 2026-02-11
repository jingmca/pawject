import { create } from "zustand";
import type { ContextItem } from "@/generated/prisma/client";

interface ContextState {
  items: ContextItem[];
  loading: boolean;
  fetchItems: (projectId: string) => Promise<void>;
  addItem: (data: {
    projectId: string;
    name: string;
    type: string;
    content: string;
  }) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
}

export const useContextStore = create<ContextState>((set, get) => ({
  items: [],
  loading: false,

  fetchItems: async (projectId) => {
    set({ loading: true });
    try {
      const res = await fetch(`/api/context?projectId=${projectId}`);
      const items = await res.json();
      set({ items, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  addItem: async (data) => {
    const res = await fetch("/api/context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const item = await res.json();
    set({ items: [item, ...get().items] });
  },

  removeItem: async (id) => {
    await fetch(`/api/context/${id}`, { method: "DELETE" });
    set({ items: get().items.filter((i) => i.id !== id) });
  },
}));
