"use client";

import { useAskUserStore } from "@/stores/ask-user-store";
import { useWorkspaceStore } from "@/stores/workspace-store";
import { MessageCircleQuestion } from "lucide-react";

export function AwaitingInputSection() {
  const queries = useAskUserStore((s) => s.queries);
  const setSelectedTaskId = useWorkspaceStore((s) => s.setSelectedTaskId);

  if (queries.length === 0) return null;

  return (
    <div className="rounded-lg border border-orange-500/30 bg-orange-500/5">
      <div className="flex items-center gap-2 px-3 py-2">
        <MessageCircleQuestion className="h-4 w-4 text-orange-400 shrink-0" />
        <span className="text-xs font-medium text-orange-400">
          待你处理
        </span>
        <span className="ml-auto text-xs font-bold text-orange-400">
          {queries.length}
        </span>
      </div>

      <div className="px-2 pb-2 space-y-1">
        {queries.map((query) => (
          <button
            key={query.taskId}
            className="w-full text-left rounded-md px-2 py-1.5 hover:bg-orange-500/10 transition-colors cursor-pointer"
            onClick={() => setSelectedTaskId(query.taskId)}
          >
            <div className="text-xs font-medium text-foreground truncate">
              {query.taskName}
            </div>
            <div className="text-[10px] text-muted-foreground truncate mt-0.5">
              {query.question}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
