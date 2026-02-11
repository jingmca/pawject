"use client";

import { useRouter } from "next/navigation";
import type { Project } from "@/generated/prisma/client";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FolderOpen } from "lucide-react";

interface ProjectCardProps {
  project: Project & { _count?: { tasks: number } };
}

export function ProjectCard({ project }: ProjectCardProps) {
  const router = useRouter();

  return (
    <Card
      className="cursor-pointer hover:border-primary/50 transition-colors"
      onClick={() => router.push(`/projects/${project.id}`)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{project.name}</CardTitle>
          </div>
          {project._count && (
            <Badge variant="secondary">
              {project._count.tasks} 个任务
            </Badge>
          )}
        </div>
        {project.description && (
          <CardDescription className="line-clamp-2 mt-1">
            {project.description}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="pt-0">
        {project.instruction && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {project.instruction}
          </p>
        )}
        <p className="text-xs text-muted-foreground mt-2">
          更新于{" "}
          {new Date(project.updatedAt).toLocaleDateString("zh-CN")}
        </p>
      </CardContent>
    </Card>
  );
}
