import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";
import path from "node:path";

const CLAUDE_CLI = process.env.CLAUDE_CLI_PATH || "claude";

export interface ClaudeResult {
  type: "result";
  subtype: "success" | "error";
  is_error: boolean;
  result: string;
  session_id: string;
  total_cost_usd: number;
  duration_ms: number;
  usage?: Record<string, unknown>;
}

export interface ClaudeStreamCallbacks {
  onToken?: (text: string) => void;
  onToolUse?: (tool: string, input: unknown) => void;
  onAssistantMessage?: (message: unknown) => void;
  onResult?: (result: ClaudeResult) => void | Promise<void>;
  onInit?: (init: unknown) => void;
}

function buildEnv(): NodeJS.ProcessEnv {
  const currentPath = process.env.PATH || "";
  const extraPaths = "/opt/homebrew/bin:/usr/local/bin";
  const scriptsDir = path.join(process.cwd(), "scripts");
  return {
    ...process.env,
    PATH: [
      scriptsDir,
      ...(currentPath.includes("/opt/homebrew/bin")
        ? [currentPath]
        : [extraPaths, currentPath]),
    ].join(":"),
    ANTHROPIC_AUTH_TOKEN: process.env.ANTHROPIC_API_KEY,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    ANTHROPIC_BASE_URL: process.env.ANTHROPIC_BASE_URL,
    ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL,
    PAWJECT_API_URL: process.env.PAWJECT_API_URL || `http://localhost:${process.env.PORT || "3000"}`,
  };
}

/*
 * Claude Code CLI 用法:
 * - System prompt → 写入 workspace 下的 CLAUDE.md 文件，CLI 自动读取
 * - -p "prompt"   → 用户指令
 * - -c            → 继续 CWD 下最近一次对话（同一 task 的后续消息）
 * - 不加 -c       → 新对话（新 task 的第一条消息）
 * - --dangerously-skip-permissions → 跳过交互式权限确认
 */

/**
 * Stream Claude Code CLI output with real-time token callbacks.
 */
export function claudeStream(params: {
  prompt: string;
  cwd: string;
  continueConversation?: boolean;
  addDirs?: string[];
  callbacks: ClaudeStreamCallbacks;
}): { process: ChildProcess; done: Promise<ClaudeResult> } {
  const args: string[] = [
    "--print",
    "--output-format", "stream-json",
    "--verbose",
    "--include-partial-messages",
    "--dangerously-skip-permissions",
  ];

  if (params.addDirs) {
    for (const dir of params.addDirs) {
      args.push("--add-dir", dir);
    }
  }

  if (params.continueConversation) {
    args.push("-c");
  }

  args.push("-p", params.prompt);

  console.log(`[claude] stream: ${CLAUDE_CLI} ${args.map(a => a.includes(" ") ? `"${a}"` : a).join(" ")}`);
  console.log(`[claude] stream cwd: ${params.cwd}`);

  const child = spawn(CLAUDE_CLI, args, {
    cwd: params.cwd,
    env: buildEnv(),
    stdio: ["pipe", "pipe", "pipe"],
  });

  // Log process lifecycle
  console.log(`[claude] stream: spawned pid=${child.pid}`);
  child.on("exit", (code, signal) => {
    console.log(`[claude] stream: exited code=${code} signal=${signal}`);
  });
  child.on("error", (err) => {
    console.error(`[claude] stream: spawn error:`, err.message);
  });

  const done = new Promise<ClaudeResult>((resolve, reject) => {
    const rl = createInterface({ input: child.stdout! });
    let resultEvent: ClaudeResult | null = null;
    let stderrData = "";
    let onResultPromise: Promise<void> | undefined;

    child.stderr?.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderrData += text;
      console.log(`[claude] stream stderr: ${text.slice(0, 200)}`);
    });

    rl.on("line", (line) => {
      if (!line.trim()) return;
      console.log(`[claude] stream stdout line: ${line.slice(0, 120)}...`);
      try {
        const event = JSON.parse(line);

        if (event.type === "system") {
          params.callbacks.onInit?.(event);
        } else if (event.type === "stream_event") {
          const inner = event.event as Record<string, unknown>;
          if (inner.type === "content_block_delta") {
            const delta = inner.delta as { type: string; text?: string };
            if (delta.type === "text_delta" && delta.text) {
              params.callbacks.onToken?.(delta.text);
            }
          } else if (inner.type === "content_block_start") {
            const block = inner.content_block as Record<string, unknown>;
            if (block.type === "tool_use") {
              params.callbacks.onToolUse?.(block.name as string, block.input);
            }
          }
        } else if (event.type === "assistant") {
          params.callbacks.onAssistantMessage?.(event);
        } else if (event.type === "result") {
          resultEvent = event as ClaudeResult;
          const ret = params.callbacks.onResult?.(resultEvent);
          if (ret && typeof (ret as Promise<void>).then === "function") {
            onResultPromise = ret as Promise<void>;
          }
        }
      } catch {
        // Ignore parse errors
      }
    });

    child.on("close", async (code) => {
      if (onResultPromise) {
        try { await onResultPromise; } catch { /* handled by caller */ }
      }
      if (resultEvent) {
        resolve(resultEvent);
      } else if (code === 0) {
        reject(new Error("Claude process ended without result event"));
      } else {
        reject(new Error(`Claude exited with code ${code}: ${stderrData.slice(0, 500)}`));
      }
    });

    child.on("error", (err) => {
      reject(new Error(`Failed to spawn Claude CLI: ${err.message}`));
    });
  });

  return { process: child, done };
}

/**
 * One-shot Claude Code CLI execution (non-streaming).
 * Uses spawn instead of execFile to properly handle stdin closure,
 * preventing the CLI from hanging when waiting for input.
 */
export async function claudeOneShot(params: {
  prompt: string;
  cwd: string;
  continueConversation?: boolean;
  noSessionPersistence?: boolean;
  addDirs?: string[];
}): Promise<ClaudeResult> {
  const args: string[] = [
    "--print",
    "--output-format", "json",
    "--dangerously-skip-permissions",
  ];

  if (params.addDirs) {
    for (const dir of params.addDirs) {
      args.push("--add-dir", dir);
    }
  }

  if (params.noSessionPersistence) {
    args.push("--no-session-persistence");
  }

  if (params.continueConversation) {
    args.push("-c");
  }

  args.push("-p", params.prompt);

  console.log(`[claude] oneShot: ${CLAUDE_CLI} ${args.slice(0, 4).join(" ")} -p "<prompt>"`);
  console.log(`[claude] oneShot cwd: ${params.cwd}`);

  return new Promise<ClaudeResult>((resolve, reject) => {
    const child = spawn(CLAUDE_CLI, args, {
      cwd: params.cwd,
      env: buildEnv(),
      stdio: ["ignore", "pipe", "pipe"],
    });

    console.log(`[claude] oneShot: spawned pid=${child.pid}`);

    let stdout = "";
    let stderr = "";
    const timeout = setTimeout(() => {
      console.error(`[claude] oneShot: killing pid=${child.pid} after timeout`);
      child.kill("SIGTERM");
    }, 300_000);

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    child.on("error", (err) => {
      clearTimeout(timeout);
      console.error(`[claude] oneShot spawn error:`, err.message);
      reject(new Error(`Failed to spawn Claude CLI: ${err.message}`));
    });

    child.on("close", (code) => {
      clearTimeout(timeout);
      if (stderr) {
        console.warn(`[claude] oneShot stderr: ${stderr.slice(0, 300)}`);
      }
      if (code !== 0) {
        console.error(`[claude] oneShot failed: code=${code}, stdout=${stdout.slice(0, 300)}, stderr=${stderr.slice(0, 500)}`);
        reject(new Error(`Claude CLI exited with code ${code}. stderr: ${stderr.slice(0, 500)}`));
        return;
      }
      try {
        console.log(`[claude] oneShot completed, result length: ${stdout.length}`);
        const result = JSON.parse(stdout) as ClaudeResult;
        resolve(result);
      } catch {
        console.error(`[claude] oneShot: failed to parse JSON output: ${stdout.slice(0, 300)}`);
        reject(new Error(`Failed to parse Claude CLI output as JSON: ${stdout.slice(0, 200)}`));
      }
    });
  });
}

/**
 * Parse askUser markers from Claude's response.
 * Supports both types: [ASK_USER_CONTEXT: ...] and [ASK_USER_CONFIRM: ...]
 * Falls back to legacy [ASK_USER: ...] marker.
 */
export function parseAskUser(content: string): {
  cleanContent: string;
  askUser?: string;
  askUserType?: "ASK_USER_CONTEXT" | "ASK_USER_CONFIRM";
} {
  // Try new typed markers first
  const contextMatch = content.match(/\[ASK_USER_CONTEXT:\s*([\s\S]*?)\]/);
  if (contextMatch) {
    return {
      cleanContent: content.replace(contextMatch[0], "").trim(),
      askUser: contextMatch[1].trim(),
      askUserType: "ASK_USER_CONTEXT",
    };
  }

  const confirmMatch = content.match(/\[ASK_USER_CONFIRM:\s*([\s\S]*?)\]/);
  if (confirmMatch) {
    return {
      cleanContent: content.replace(confirmMatch[0], "").trim(),
      askUser: confirmMatch[1].trim(),
      askUserType: "ASK_USER_CONFIRM",
    };
  }

  // Fallback: legacy [ASK_USER: ...] marker (treated as CONTEXT by default)
  const match = content.match(/\[ASK_USER:\s*([\s\S]*?)\]/);
  if (match) {
    return {
      cleanContent: content.replace(match[0], "").trim(),
      askUser: match[1].trim(),
      askUserType: "ASK_USER_CONTEXT",
    };
  }
  return { cleanContent: content };
}

/**
 * Parse artifacts from Claude's response.
 */
export function parseArtifacts(content: string): {
  cleanContent: string;
  artifacts?: Array<{ name: string; type: string; content: string; summary: string }>;
} {
  const match = content.match(/```artifacts\s*\n([\s\S]*?)\n```/);
  if (match) {
    try {
      const artifacts = JSON.parse(match[1]);
      return { cleanContent: content.replace(match[0], "").trim(), artifacts };
    } catch {
      return { cleanContent: content };
    }
  }
  return { cleanContent: content };
}
