"use client";

import type { FilePreviewTarget } from "@/types";

interface FilePreviewContentProps {
  target: FilePreviewTarget;
}

const codeExtensions = new Set([
  "js", "jsx", "ts", "tsx", "py", "rb", "go", "rs", "java",
  "c", "cpp", "h", "hpp", "cs", "swift", "kt", "scala",
  "html", "css", "scss", "less", "json", "yaml", "yml",
  "toml", "xml", "sql", "sh", "bash", "zsh", "fish",
  "md", "mdx", "graphql", "prisma", "dockerfile",
]);

function isCodeFile(name: string, language?: string): boolean {
  if (language) return true;
  const ext = name.split(".").pop()?.toLowerCase() || "";
  return codeExtensions.has(ext);
}

function getLineNumbers(content: string): string[] {
  const lines = content.split("\n");
  return lines.map((_, i) => String(i + 1));
}

export function FilePreviewContent({ target }: FilePreviewContentProps) {
  const content = target.content || "(空文件)";
  const isCode = isCodeFile(target.name, target.language);

  if (!isCode) {
    return (
      <div className="text-sm text-foreground whitespace-pre-wrap break-words leading-relaxed">
        {content}
      </div>
    );
  }

  const lineNumbers = getLineNumbers(content);

  return (
    <div className="relative text-xs font-mono">
      <div className="flex">
        {/* Line numbers */}
        <div className="select-none pr-3 text-right text-muted-foreground/50 shrink-0 border-r border-border mr-3">
          {lineNumbers.map((num) => (
            <div key={num} className="leading-5">
              {num}
            </div>
          ))}
        </div>

        {/* Code content */}
        <pre className="flex-1 overflow-x-auto">
          <code className="text-foreground leading-5 whitespace-pre">
            {content}
          </code>
        </pre>
      </div>
    </div>
  );
}
