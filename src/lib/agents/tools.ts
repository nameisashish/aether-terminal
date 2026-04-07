// ==========================================
// Agent Tools
// Tool definitions that agents can use:
// - Shell command execution (with approval)
// - File read/write (with approval for writes)
// - Search files (grep-like)
// - List directory
// - Analyze code (structural analysis)
// ==========================================

import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { PendingApproval, AgentRole } from "./types";
import {
  buildCodeGraph,
  getImpactRadius,
  getArchitectureOverview,
  findLargeFunctions,
  getGraphStats,
} from "../codegraph";

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
        const { readTextFile } = await import("@tauri-apps/plugin-fs");
        const content = await readTextFile(path);
        onOutput(`📖 Read file: ${path} (${content.length} chars)`);
        // Truncate very large files to avoid blowing context
        if (content.length > 15000) {
          return content.slice(0, 15000) + `\n\n...[truncated — file is ${content.length} chars total]`;
        }
        return content;
      } catch (err) {
        return `Error reading file: ${err}`;
      }
    },
    {
      name: "read_file",
      description:
        "Read the contents of a file at the given path. Returns the file content as a string. Use this BEFORE modifying any file.",
      schema: z.object({
        path: z.string().describe("Absolute path to the file to read"),
      }),
    }
  );

  // ── Write File Tool (requires approval) ──
  const writeFileTool = tool(
    async ({ path, content }) => {
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
        "Write content to a file. Requires user approval. Creates the file if it doesn't exist. ALWAYS read the file first before writing.",
      schema: z.object({
        path: z.string().describe("Absolute path to write to"),
        content: z.string().describe("Complete file content to write"),
      }),
    }
  );

  // ── Run Command Tool (requires approval) ──
  const runCommandTool = tool(
    async ({ command }) => {
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
        const result = output.stdout + (output.stderr ? "\nSTDERR:\n" + output.stderr : "");
        onOutput(`⚡ Ran: ${command}`);
        // Truncate very long command output
        if (result.length > 10000) {
          return result.slice(0, 10000) + `\n\n...[output truncated — ${result.length} chars total]`;
        }
        return result || "(no output)";
      } catch (err) {
        return `Error executing command: ${err}`;
      }
    },
    {
      name: "run_command",
      description:
        "Execute a shell command. Requires user approval. Returns stdout + stderr. Use for running tests, builds, linters, git commands, etc.",
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
        "List files and directories at the given path. Use to explore project structure before reading specific files.",
      schema: z.object({
        path: z.string().describe("Absolute path to the directory"),
      }),
    }
  );

  // ── Search Files Tool (grep-like) ──
  const searchFilesTool = tool(
    async ({ pattern, directory, fileExtension }) => {
      try {
        // Validate inputs — reject newlines and control chars to prevent injection
        if (/[\n\r\x00]/.test(pattern) || /[\n\r\x00]/.test(directory)) {
          return "Error: Pattern and directory cannot contain newlines or control characters";
        }
        const { Command } = await import("@tauri-apps/plugin-shell");
        // Use single-quote shell escaping to prevent injection
        const shellEscape = (s: string) => `'${s.replace(/'/g, "'\\''")}'`;
        const ext = (fileExtension || '*').replace(/[^a-zA-Z0-9*]/g, '');
        const cmd = `grep -rn --include="*.${ext}" ${shellEscape(pattern)} ${shellEscape(directory)} | head -50`;
        const shellCmd = Command.create("sh", ["-c", cmd]);
        const output = await shellCmd.execute();
        const result = output.stdout || "(no matches found)";
        onOutput(`🔍 Searched for "${pattern}" in ${directory}`);
        return result;
      } catch (err) {
        return `Error searching files: ${err}`;
      }
    },
    {
      name: "search_files",
      description:
        "Search for a pattern across files in a directory (like grep). Returns matching lines with file paths and line numbers. Useful for finding function definitions, imports, usages, etc.",
      schema: z.object({
        pattern: z.string().describe("Text or regex pattern to search for"),
        directory: z.string().describe("Absolute path to search in"),
        fileExtension: z.string().optional().describe("Filter by file extension, e.g. 'ts', 'py', 'rs'. Omit to search all files."),
      }),
    }
  );

  // ── Patch File Tool (requires approval) ──
  const patchFileTool = tool(
    async ({ path, search, replace }) => {
      const approved = await onApproval({
        id: generateApprovalId(),
        agentRole,
        action: `Patch file: ${path}`,
        detail: `SEARCH:\n${search}\n\nREPLACE:\n${replace}`,
        type: "file_write",
        timestamp: Date.now(),
      });

      if (!approved) {
        return "Action rejected by user.";
      }

      try {
        const { readTextFile, writeTextFile } = await import("@tauri-apps/plugin-fs");
        const content = await readTextFile(path);
        if (!content.includes(search)) {
          return `Error: Could not find the search string in ${path}. Read the file first to get the exact content.`;
        }
        const newContent = content.split(search).join(replace);
        await writeTextFile(path, newContent);
        onOutput(`🔧 Patched file: ${path}`);
        return `Successfully patched ${path}`;
      } catch (err) {
        return `Error patching file: ${err}`;
      }
    },
    {
      name: "patch_file",
      description:
        "Replace a specific section of a file. Provide the exact text to search for and the replacement. More precise than write_file for small changes. ALWAYS read the file first.",
      schema: z.object({
        path: z.string().describe("Absolute path to the file"),
        search: z.string().describe("Exact text to find (must match exactly)"),
        replace: z.string().describe("Text to replace it with"),
      }),
    }
  );

  // ── Code Graph Tools (inspired by code-review-graph) ──
  // Builds a file-level dependency graph, then provides
  // blast-radius analysis, architecture overview, and more.

  const buildGraphTool = tool(
    async ({ directory }) => {
      try {
        const graph = await buildCodeGraph(directory);
        const stats = getGraphStats(graph);
        onOutput(`📊 Built code graph: ${graph.fileCount} files, ${graph.edgeCount} edges`);
        return stats;
      } catch (err) {
        return `Error building code graph: ${err}`;
      }
    },
    {
      name: "build_code_graph",
      description:
        "Scan the workspace and build a dependency graph of all source files. Returns stats about the codebase (file count, languages, edges). Must be called before using get_impact_radius or get_architecture.",
      schema: z.object({
        directory: z.string().describe("Absolute path to the workspace root"),
      }),
    }
  );

  const impactRadiusTool = tool(
    async ({ directory, filePath }) => {
      try {
        const graph = await buildCodeGraph(directory);
        const relativePath = filePath.replace(directory + "/", "");
        const impact = getImpactRadius(graph, relativePath);

        const lines = [
          `BLAST RADIUS for: ${relativePath}`,
          `\nDirect dependencies (${impact.directDependencies.length} files this imports):`,
          ...impact.directDependencies.map((f) => `  → ${f}`),
          `\nDirect dependents (${impact.directDependents.length} files that import this):`,
          ...impact.directDependents.map((f) => `  ← ${f}`),
          `\nTransitive impact (${impact.transitiveDependents.length} total files affected):`,
          ...impact.transitiveDependents.slice(0, 20).map((f) => `  ⚡ ${f}`),
          impact.transitiveDependents.length > 20 ? `  ... and ${impact.transitiveDependents.length - 20} more` : "",
          `\nMax impact depth: ${impact.depth}`,
        ].filter(Boolean);

        onOutput(`🎯 Impact radius: ${relativePath} → ${impact.transitiveDependents.length} files affected`);
        return lines.join("\n");
      } catch (err) {
        return `Error computing impact radius: ${err}`;
      }
    },
    {
      name: "get_impact_radius",
      description:
        "Compute the blast radius of changing a file. Shows all files that depend on it (direct + transitive). Use BEFORE modifying a file to understand what could break.",
      schema: z.object({
        directory: z.string().describe("Absolute path to the workspace root"),
        filePath: z.string().describe("Absolute path to the file to analyze"),
      }),
    }
  );

  const architectureTool = tool(
    async ({ directory }) => {
      try {
        const graph = await buildCodeGraph(directory);
        const modules = getArchitectureOverview(graph);

        const lines = [`ARCHITECTURE OVERVIEW (${graph.fileCount} files, ${graph.edgeCount} dependency edges)\n`];
        for (const mod of modules) {
          lines.push(`📦 ${mod.name}/ (${mod.files.length} files)`);
          lines.push(`   Internal edges: ${mod.internalEdges} | External edges: ${mod.externalEdges}`);
          if (mod.coupledTo.length > 0) {
            lines.push(`   Coupled to: ${mod.coupledTo.map((c) => `${c.module} (${c.edges})`).join(", ")}`);
          }
        }

        onOutput(`🏗️ Architecture: ${modules.length} modules analyzed`);
        return lines.join("\n");
      } catch (err) {
        return `Error analyzing architecture: ${err}`;
      }
    },
    {
      name: "get_architecture",
      description:
        "Get an architecture overview showing module coupling. Groups files by directory and shows how modules depend on each other. Useful for understanding codebase structure before large changes.",
      schema: z.object({
        directory: z.string().describe("Absolute path to the workspace root"),
      }),
    }
  );

  const largeFunctionsTool = tool(
    async ({ directory, threshold }) => {
      try {
        const graph = await buildCodeGraph(directory);
        const large = findLargeFunctions(graph, threshold || 50);

        if (large.length === 0) {
          return `No functions found exceeding ${threshold || 50} lines.`;
        }

        const lines = [`LARGE FUNCTIONS (>${threshold || 50} lines):\n`];
        for (const fn of large.slice(0, 30)) {
          lines.push(`  ${fn.file}:${fn.startLine} — ${fn.name}() — ${fn.lineCount} lines`);
        }
        if (large.length > 30) {
          lines.push(`  ... and ${large.length - 30} more`);
        }

        onOutput(`📏 Found ${large.length} large functions`);
        return lines.join("\n");
      } catch (err) {
        return `Error finding large functions: ${err}`;
      }
    },
    {
      name: "find_large_functions",
      description:
        "Find functions that exceed a line count threshold (default 50). These are candidates for refactoring. Returns function name, file, line number, and size.",
      schema: z.object({
        directory: z.string().describe("Absolute path to the workspace root"),
        threshold: z.number().optional().describe("Minimum lines to flag (default: 50)"),
      }),
    }
  );

  return [
    readFileTool, writeFileTool, patchFileTool, runCommandTool,
    listDirTool, searchFilesTool,
    buildGraphTool, impactRadiusTool, architectureTool, largeFunctionsTool,
  ];
}
