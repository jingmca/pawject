"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { useGraphStore } from "@/stores/graph-store";
import {
  Database,
  FileText,
  ListPlus,
  CheckCircle2,
  MessageCircleQuestion,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { GraphEvent } from "@/types";

const eventConfig: Record<
  GraphEvent["type"],
  { color: string; dotColor: string; icon: React.ElementType }
> = {
  context_added: {
    color: "text-blue-400",
    dotColor: "bg-blue-400",
    icon: Database,
  },
  draft_generated: {
    color: "text-green-400",
    dotColor: "bg-green-400",
    icon: FileText,
  },
  task_created: {
    color: "text-purple-400",
    dotColor: "bg-purple-400",
    icon: ListPlus,
  },
  task_completed: {
    color: "text-emerald-400",
    dotColor: "bg-emerald-400",
    icon: CheckCircle2,
  },
  ask_user: {
    color: "text-orange-400",
    dotColor: "bg-orange-400",
    icon: MessageCircleQuestion,
  },
};

function formatTimestamp(date: Date): string {
  const d = new Date(date);
  return d.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function GraphTab() {
  const { events, loading } = useGraphStore();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-xs text-muted-foreground">加载中...</span>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="text-xs text-muted-foreground">暂无事件</span>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-3">
        <div className="relative">
          {/* Vertical timeline line */}
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />

          <div className="space-y-0">
            {events.map((event) => {
              const config = eventConfig[event.type] || eventConfig.context_added;
              const Icon = config.icon;

              return (
                <div key={event.id} className="relative flex gap-3 pb-4">
                  {/* Dot on timeline */}
                  <div className="relative z-10 shrink-0 flex items-start pt-0.5">
                    <div
                      className={cn(
                        "h-[14px] w-[14px] rounded-full border-2 border-card flex items-center justify-center",
                        config.dotColor
                      )}
                    />
                  </div>

                  {/* Event content */}
                  <div className="flex-1 min-w-0 -mt-0.5">
                    <div className="flex items-center gap-1.5">
                      <Icon
                        className={cn("h-3 w-3 shrink-0", config.color)}
                      />
                      <span className="text-xs font-medium text-foreground truncate">
                        {event.label}
                      </span>
                    </div>
                    {event.detail && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                        {event.detail}
                      </p>
                    )}
                    <span className="text-[10px] text-muted-foreground/60 mt-0.5 block">
                      {formatTimestamp(event.timestamp)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
