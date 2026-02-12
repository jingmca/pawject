import { create } from "zustand";
import type { FilePreviewTarget } from "@/types";

interface WorkspaceState {
  selectedProjectId: string | null;
  selectedTaskId: string | null;
  contributionsTab: "contributions" | "graph";
  filePreviewOpen: boolean;
  filePreviewTarget: FilePreviewTarget | null;

  setSelectedProjectId: (id: string | null) => void;
  setSelectedTaskId: (id: string | null) => void;
  setContributionsTab: (tab: "contributions" | "graph") => void;
  openFilePreview: (target: FilePreviewTarget) => void;
  closeFilePreview: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  selectedProjectId: null,
  selectedTaskId: null,
  contributionsTab: "contributions",
  filePreviewOpen: false,
  filePreviewTarget: null,

  setSelectedProjectId: (id) => set({ selectedProjectId: id }),
  setSelectedTaskId: (id) => set({ selectedTaskId: id }),
  setContributionsTab: (tab) => set({ contributionsTab: tab }),
  openFilePreview: (target) =>
    set({ filePreviewOpen: true, filePreviewTarget: target }),
  closeFilePreview: () =>
    set({ filePreviewOpen: false, filePreviewTarget: null }),
}));
