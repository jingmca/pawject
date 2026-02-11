import { create } from "zustand";
import type { OutputArtifact } from "@/generated/prisma/client";

interface OutputsState {
  outputs: OutputArtifact[];
  loading: boolean;
  fetchOutputs: (projectId: string) => Promise<void>;
  removeOutput: (id: string) => Promise<void>;
}

export const useOutputsStore = create<OutputsState>((set, get) => ({
  outputs: [],
  loading: false,

  fetchOutputs: async (projectId) => {
    set({ loading: true });
    try {
      const res = await fetch(`/api/outputs?projectId=${projectId}`);
      const outputs = await res.json();
      set({ outputs, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  removeOutput: async (id) => {
    await fetch(`/api/outputs/${id}`, { method: "DELETE" });
    set({ outputs: get().outputs.filter((o) => o.id !== id) });
  },
}));
