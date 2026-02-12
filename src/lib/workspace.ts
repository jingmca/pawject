import { execFile, spawn, type ChildProcess } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs/promises";

const execFileAsync = promisify(execFile);

const WORKSPACE_ROOT =
  process.env.WORKSPACE_ROOT || path.join(process.cwd(), "workspaces");

export function getWorkspaceRoot(): string {
  return WORKSPACE_ROOT;
}

export function getWorkspacePath(projectId: string): string {
  return path.join(WORKSPACE_ROOT, projectId);
}

export function getContextDir(projectId: string): string {
  return path.join(getWorkspacePath(projectId), "context");
}

export function getDraftDir(projectId: string): string {
  return path.join(getWorkspacePath(projectId), "draft");
}

export function getTaskDir(projectId: string, taskId: string): string {
  return path.join(getWorkspacePath(projectId), "tasks", taskId);
}

export async function createTaskDir(
  projectId: string,
  taskId: string
): Promise<string> {
  const taskDir = getTaskDir(projectId, taskId);
  await fs.mkdir(taskDir, { recursive: true });

  // Create initial todo.md if it doesn't exist
  const todoPath = path.join(taskDir, "todo.md");
  try {
    await fs.access(todoPath);
  } catch {
    await fs.writeFile(todoPath, `# Task Todo\n\n<!-- Agent maintains this file to track execution progress -->\n\n## Plan\n- [ ] Analyze task requirements\n- [ ] Execute task\n- [ ] Generate output\n\n## ASK_USER Items\n<!-- Items pending user response -->\n`, "utf-8");
  }

  return taskDir;
}

export interface DraftFileInfo {
  name: string;
  relativePath: string;
  size: number;
  content: string;
  modifiedAt: Date;
}

export async function listDraftFilesDetailed(
  projectId: string
): Promise<DraftFileInfo[]> {
  const draftDir = getDraftDir(projectId);
  const results: DraftFileInfo[] = [];

  async function scanDir(dir: string, prefix: string) {
    let entries: import("node:fs").Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name === ".gitkeep") continue;
      const fullPath = path.join(dir, entry.name);
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await scanDir(fullPath, rel);
      } else {
        try {
          const stat = await fs.stat(fullPath);
          const content = await fs.readFile(fullPath, "utf-8");
          results.push({
            name: entry.name,
            relativePath: rel,
            size: stat.size,
            content,
            modifiedAt: stat.mtime,
          });
        } catch {
          // skip unreadable files
        }
      }
    }
  }

  await scanDir(draftDir, "");
  return results;
}

export async function createWorkspace(projectId: string): Promise<string> {
  const wsPath = getWorkspacePath(projectId);
  const contextDir = getContextDir(projectId);
  const draftDir = getDraftDir(projectId);

  await fs.mkdir(contextDir, { recursive: true });
  await fs.mkdir(draftDir, { recursive: true });

  // Create .gitkeep files so empty dirs are tracked
  await fs.writeFile(path.join(contextDir, ".gitkeep"), "");
  await fs.writeFile(path.join(draftDir, ".gitkeep"), "");

  return wsPath;
}

export async function initGitRepo(projectId: string): Promise<void> {
  const wsPath = getWorkspacePath(projectId);

  await execFileAsync("git", ["init"], { cwd: wsPath });
  await execFileAsync("git", ["add", "-A"], { cwd: wsPath });
  await execFileAsync(
    "git",
    ["commit", "-m", "Initial workspace setup", "--allow-empty"],
    {
      cwd: wsPath,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "Agent System",
        GIT_AUTHOR_EMAIL: "agent@system.local",
        GIT_COMMITTER_NAME: "Agent System",
        GIT_COMMITTER_EMAIL: "agent@system.local",
      },
    }
  );
}

export async function commitChange(
  projectId: string,
  message: string
): Promise<void> {
  const wsPath = getWorkspacePath(projectId);

  try {
    await execFileAsync("git", ["add", "-A"], { cwd: wsPath });
    // Check if there are staged changes
    const { stdout: status } = await execFileAsync(
      "git",
      ["status", "--porcelain"],
      { cwd: wsPath }
    );
    if (!status.trim()) return; // nothing to commit

    await execFileAsync("git", ["commit", "-m", message], {
      cwd: wsPath,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "Agent System",
        GIT_AUTHOR_EMAIL: "agent@system.local",
        GIT_COMMITTER_NAME: "Agent System",
        GIT_COMMITTER_EMAIL: "agent@system.local",
      },
    });
  } catch {
    // Ignore commit errors (e.g., nothing to commit)
  }
}

export interface GitLogEntry {
  hash: string;
  message: string;
  timestamp: string;
  files: string[];
}

export async function getGitLog(
  projectId: string,
  limit = 50
): Promise<GitLogEntry[]> {
  const wsPath = getWorkspacePath(projectId);

  try {
    const { stdout } = await execFileAsync(
      "git",
      [
        "log",
        `--max-count=${limit}`,
        "--format=%H<<SEP>>%s<<SEP>>%aI",
        "--name-only",
      ],
      { cwd: wsPath }
    );

    const entries: GitLogEntry[] = [];
    const blocks = stdout.trim().split("\n\n");

    for (const block of blocks) {
      if (!block.trim()) continue;
      const lines = block.trim().split("\n");
      const headerLine = lines[0];
      const parts = headerLine.split("<<SEP>>");
      if (parts.length < 3) continue;
      const [hash, message, timestamp] = parts;
      const files = lines.slice(1).filter((f) => f.trim());

      entries.push({ hash, message: message || "", timestamp: timestamp || "", files });
    }

    return entries;
  } catch {
    return [];
  }
}

export async function readTaskTodo(
  projectId: string,
  taskId: string
): Promise<string | null> {
  const todoPath = path.join(getTaskDir(projectId, taskId), "todo.md");
  try {
    return await fs.readFile(todoPath, "utf-8");
  } catch {
    return null;
  }
}

export async function listContextFiles(
  projectId: string
): Promise<string[]> {
  const contextDir = getContextDir(projectId);
  try {
    const entries = await fs.readdir(contextDir);
    return entries.filter((e) => e !== ".gitkeep");
  } catch {
    return [];
  }
}

export async function listDraftFiles(
  projectId: string
): Promise<string[]> {
  const draftDir = getDraftDir(projectId);
  try {
    const entries = await fs.readdir(draftDir);
    return entries.filter((e) => e !== ".gitkeep");
  } catch {
    return [];
  }
}

export async function readWorkspaceFile(
  projectId: string,
  relativePath: string
): Promise<string> {
  const wsPath = getWorkspacePath(projectId);
  const filePath = path.join(wsPath, relativePath);
  // Ensure path doesn't escape workspace
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(wsPath))) {
    throw new Error("Path traversal detected");
  }
  return fs.readFile(filePath, "utf-8");
}

export async function writeWorkspaceFile(
  projectId: string,
  relativePath: string,
  content: string
): Promise<void> {
  const wsPath = getWorkspacePath(projectId);
  const filePath = path.join(wsPath, relativePath);
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(wsPath))) {
    throw new Error("Path traversal detected");
  }
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, "utf-8");
}

export async function deleteWorkspaceFile(
  projectId: string,
  relativePath: string
): Promise<void> {
  const wsPath = getWorkspacePath(projectId);
  const filePath = path.join(wsPath, relativePath);
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(wsPath))) {
    throw new Error("Path traversal detected");
  }
  await fs.unlink(filePath);
}

export async function deleteWorkspace(projectId: string): Promise<void> {
  const wsPath = getWorkspacePath(projectId);
  try {
    await fs.rm(wsPath, { recursive: true, force: true });
  } catch {
    // Ignore
  }
}
