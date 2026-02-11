"use client";

import type { Project } from "@/generated/prisma/client";
import { ProjectCard } from "./project-card";
import { Skeleton } from "@/components/ui/skeleton";

interface ProjectListProps {
  projects: (Project & { _count?: { tasks: number } })[];
  loading: boolean;
}

export function ProjectList({ projects, loading }: ProjectListProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-40 rounded-xl" />
        ))}
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground text-lg">暂无项目</p>
        <p className="text-muted-foreground text-sm mt-1">
          点击右上角按钮创建第一个项目
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {projects.map((project) => (
        <ProjectCard key={project.id} project={project} />
      ))}
    </div>
  );
}
