import { create } from "zustand";

interface WorkspaceState {
  selectedProjectId: string | null;
  selectedTaskId: string | null;
  rightPanelOpen: boolean;
  rightPanelTab: "context" | "output";
  showNewTaskForm: boolean;

  setSelectedProjectId: (id: string | null) => void;
  setSelectedTaskId: (id: string | null) => void;
  setRightPanelOpen: (open: boolean) => void;
  setRightPanelTab: (tab: "context" | "output") => void;
  setShowNewTaskForm: (show: boolean) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  selectedProjectId: null,
  selectedTaskId: null,
  rightPanelOpen: true,
  rightPanelTab: "context",
  showNewTaskForm: false,

  setSelectedProjectId: (id) => set({ selectedProjectId: id }),
  setSelectedTaskId: (id) => set({ selectedTaskId: id, showNewTaskForm: false }),
  setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
  setRightPanelTab: (tab) => set({ rightPanelTab: tab }),
  setShowNewTaskForm: (show) =>
    set({ showNewTaskForm: show, selectedTaskId: show ? null : undefined }),
}));
