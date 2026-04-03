// ==========================================
// Agent Tools
// Tool definitions that agents can use:
// - Shell command execution (with approval)
// - File read/write (with approval for writes)
// - Code analysis
// - Web search (placeholder)
// ==========================================

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { PendingApproval, AgentRole } from "./types";

// We use a callback pattern for approvals since tools run in the LangChain pipeline
type ApprovalCallback = (approval: PendingApproval) => Promise<boolean>;
type OutputCallback = (output: string) => void;

let approvalIdCounter = 0;
function generateApprovalId(): string {
  return `approval-${++approvalIdCounter}-${Date.now()}`;
}

/**
 * Creates the set of tools available to agents.
 * Tools that modify the system require human-in-the-loop approval.
 */
export function createAgentTools(
  agentRole: AgentRole,
  onApproval: ApprovalCallback,
  onOutput: OutputCallback
) {
  // ── Read File Tool ──
  const readFileTool = tool(
    async ({ path }) => {
      try {
        // Use Tauri FS API via dynamic import
        const { readTextFile } = await import("@tauri-apps/plugin-fs");
        const content = await readTextFile(path);
        onOutput(`📖 Read file: ${path} (${content.length} chars)`);
        return content;
      } catch (err) {
        return `Error reading file: ${err}`;
      }
    },
    {
      name: "read_file",
      description:
        "Read the contents of a file at the given path. Returns the file content as a string.",
      schema: z.object({
        path: z.string().describe("Absolute path to the file to read"),
      }),
    }
  );

  // ── Write File Tool (requires approval) ──
  const writeFileTool = tool(
    async ({ path, content }) => {
      // Request human approval before writing
      const approved = await onApproval({
        id: generateApprovalId(),
        agentRole,
        action: `Write to file: ${path}`,
        detail: content.length > 500 ? content.slice(0, 500) + "\n...(truncated)" : content,
        type: "file_write",
        timestamp: Date.now(),
      });

      if (!approved) {
        return "Action rejected by user.";
      }

      try {
        const { writeTextFile } = await import("@tauri-apps/plugin-fs");
        await writeTextFile(path, content);
        onOutput(`✍️ Wrote file: ${path}`);
        return `Successfully wrote to ${path}`;
      } catch (err) {
        return `Error writing file: ${err}`;
      }
    },
    {
      name: "write_file",
      description:
        "Write content to a file. Requires user approval. Creates the file if it doesn't exist.",
      schema: z.object({
        path: z.string().describe("Absolute path to write to"),
        content: z.string().describe("Content to write to the file"),
      }),
    }
  );

  // ── Run Command Tool (requires approval) ──
  const runCommandTool = tool(
    async ({ command }) => {
      // Request human approval before executing
      const approved = await onApproval({
        id: generateApprovalId(),
        agentRole,
        action: `Execute shell command`,
        detail: command,
        type: "shell_command",
        timestamp: Date.now(),
      });

      if (!approved) {
        return "Command execution rejected by user.";
      }

      try {
        const { Command } = await import("@tauri-apps/plugin-shell");
        const cmd = Command.create("sh", ["-c", command]);
        const output = await cmd.execute();
        const result = output.stdout + (output.stderr ? "\n" + output.stderr : "");
        onOutput(`⚡ Ran: ${command}`);
        return result || "(no output)";
      } catch (err) {
        return `Error executing command: ${err}`;
      }
    },
    {
      name: "run_command",
      description:
        "Execute a shell command. Requires user approval. Returns stdout + stderr.",
      schema: z.object({
        command: z.string().describe("The shell command to execute"),
      }),
    }
  );

  // ── List Directory Tool ──
  const listDirTool = tool(
    async ({ path }) => {
      try {
        const { readDir } = await import("@tauri-apps/plugin-fs");
        const entries = await readDir(path);
        const result = entries
          .map((e) => `${e.isDirectory ? "📁" : "📄"} ${e.name}`)
          .join("\n");
        onOutput(`📂 Listed: ${path} (${entries.length} entries)`);
        return result || "(empty directory)";
      } catch (err) {
        return `Error listing directory: ${err}`;
      }
    },
    {
      name: "list_directory",
      description:
        "List files and directories at the given path.",
      schema: z.object({
        path: z.string().describe("Absolute path to the directory"),
      }),
    }
  );

  // ── Analyze Code Tool ──
  const analyzeCodeTool = tool(
    async ({ code, language }) => {
      onOutput(`🔬 Analyzing ${language} code...`);
      return `Code analysis for ${language}:\n- Lines: ${code.split("\n").length}\n- Characters: ${code.length}\n- Language: ${language}\n\nPlease review the code for:\n1. Syntax correctness\n2. Best practices\n3. Potential bugs\n4. Performance concerns`;
    },
    {
      name: "analyze_code",
      description:
        "Analyze a code snippet for issues, best practices, and improvements.",
      schema: z.object({
        code: z.string().describe("The code to analyze"),
        language: z.string().describe("Programming language of the code"),
      }),
    }
  );

  return [readFileTool, writeFileTool, runCommandTool, listDirTool, analyzeCodeTool];
}
