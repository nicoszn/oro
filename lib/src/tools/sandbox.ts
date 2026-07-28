import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

function sandboxPath(taskId: string, relPath: string) {
  const base = path.join(os.tmpdir(), "agent-sandbox", taskId);
  const resolved = path.resolve(base, relPath);
  if (!resolved.startsWith(base)) throw new Error("Path escapes sandbox");
  return resolved;
}

export function writeFileTool(taskId: string) {
  return tool(
    async ({ path: relPath, content }) => {
      const full = sandboxPath(taskId, relPath);
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, content, "utf-8");
      return `Wrote ${content.length} bytes to ${relPath}`;
    },
    {
      name: "write_file",
      description: "Write a file into this task's sandbox",
      schema: z.object({ path: z.string(), content: z.string() }),
    }
  );
}

export function runTestsTool(taskId: string) {
  return tool(
    async ({ command }) => {
      const { execSync } = await import("node:child_process");
      const cwd = sandboxPath(taskId, ".");
      try {
        const out = execSync(command, { encoding: "utf-8", cwd });
        return { success: true, output: out };
      } catch (e: any) {
        return { success: false, output: e.stdout?.toString() ?? e.message };
      }
    },
    {
      name: "run_tests",
      description: "Run a shell command in the task sandbox (Node only, no npm install)",
      schema: z.object({ command: z.string() }),
    }
  );
}
