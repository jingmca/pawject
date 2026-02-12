import { create } from "zustand";
import type { OutputArtifact } from "@/generated/prisma/client";

export interface DraftFile {
  name: string;
  relativePath: string;
  size: number;
  content: string;
  modifiedAt: string;
}

interface OutputsState {
  outputs: OutputArtifact[];
  draftFiles: DraftFile[];
  loading: boolean;
  fetchOutputs: (projectId: string) => Promise<void>;
  fetchDraftFiles: (projectId: string) => Promise<void>;
  removeOutput: (id: string) => Promise<void>;
}

export const useOutputsStore = create<OutputsState>((set, get) => ({
  outputs: [],
  draftFiles: [],
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

  fetchDraftFiles: async (projectId) => {
    try {
      const res = await fetch(`/api/drafts?projectId=${projectId}`);
      const files = await res.json();
      set({ draftFiles: Array.isArray(files) ? files : [] });
    } catch {
      set({ draftFiles: [] });
    }
  },

  removeOutput: async (id) => {
    await fetch(`/api/outputs/${id}`, { method: "DELETE" });
    set({ outputs: get().outputs.filter((o) => o.id !== id) });
  },
}));
