// ==========================================
// Code Graph — Lightweight dependency graph
// Inspired by code-review-graph. Builds a
// file-level dependency graph by parsing
// imports, then provides blast-radius
// analysis, architecture overview, and
// large-function detection.
//
// No native dependencies — uses regex-based
// parsing for TS/JS/Python/Rust/Go/Java/C++.
// ==========================================

// ── Types ──

export interface FileNode {
  path: string;          // Absolute path
  relativePath: string;  // Relative to workspace root
  imports: string[];     // Relative paths of files this imports
  language: string;      // Detected language
  lineCount: number;     // Total lines
  functions: FunctionInfo[];
}

export interface FunctionInfo {
  name: string;
  startLine: number;
  lineCount: number;
}

export interface CodeGraph {
  root: string;
  files: Map<string, FileNode>;
  buildTime: number;      // ms to build
  fileCount: number;
  edgeCount: number;
  timestamp: number;
}

export interface ImpactResult {
  file: string;
  directDependents: string[];   // Files that directly import this file
  transitiveDependents: string[]; // All files affected (transitive)
  directDependencies: string[]; // Files this file imports
  depth: number;                // Max depth of impact chain
}

export interface ArchitectureModule {
  name: string;
  files: string[];
  internalEdges: number;
  externalEdges: number;
  coupledTo: { module: string; edges: number }[];
}

// ── Constants ──

const SKIP_DIRS = new Set([
  "node_modules", ".git", "target", "dist", "build", ".next",
  ".cache", "__pycache__", ".venv", "venv", ".tox", "coverage",
  ".nyc_output", ".turbo", ".parcel-cache", "vendor",
]);

const SOURCE_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".rs", ".go", ".java", ".kt", ".scala",
  ".c", ".cpp", ".h", ".hpp", ".cs",
  ".rb", ".php", ".swift", ".dart",
  ".vue", ".svelte",
]);

const MAX_FILES = 500;

// ── Graph Cache ──

let _graphCache: CodeGraph | null = null;
const GRAPH_CACHE_TTL = 60_000; // 60 seconds

// ── Import Parsing ──

function detectLanguage(path: string): string {
  const ext = path.slice(path.lastIndexOf("."));
  const map: Record<string, string> = {
    ".ts": "typescript", ".tsx": "typescript", ".js": "javascript",
    ".jsx": "javascript", ".mjs": "javascript", ".cjs": "javascript",
    ".py": "python", ".rs": "rust", ".go": "go",
    ".java": "java", ".kt": "kotlin", ".scala": "scala",
    ".c": "c", ".cpp": "cpp", ".h": "c", ".hpp": "cpp",
    ".cs": "csharp", ".rb": "ruby", ".php": "php",
    ".swift": "swift", ".dart": "dart",
    ".vue": "vue", ".svelte": "svelte",
  };
  return map[ext] || "unknown";
}

/**
 * Extract import paths from source code using regex patterns.
 * Returns raw import specifiers (e.g. "./utils", "react", "fs").
 */
function extractImports(content: string, language: string): string[] {
  const imports: string[] = [];

  const patterns: RegExp[] = (() => {
    switch (language) {
      case "typescript":
      case "javascript":
      case "vue":
      case "svelte":
        return [
          /import\s+.*?\s+from\s+['"](.+?)['"]/g,
          /import\s*\(\s*['"](.+?)['"]\s*\)/g,
          /require\s*\(\s*['"](.+?)['"]\s*\)/g,
          /export\s+.*?\s+from\s+['"](.+?)['"]/g,
        ];
      case "python":
        return [
          /^from\s+(\S+)\s+import/gm,
          /^import\s+(\S+)/gm,
        ];
      case "rust":
        return [
          /use\s+(crate::\S+)/g,
          /mod\s+(\w+)/g,
        ];
      case "go":
        return [
          /"([^"]+)"/g, // inside import blocks
        ];
      case "java":
      case "kotlin":
      case "scala":
        return [
          /import\s+([\w.]+)/g,
        ];
      case "c":
      case "cpp":
        return [
          /#include\s*"(.+?)"/g,
        ];
      case "ruby":
        return [
          /require\s+['"](.+?)['"]/g,
          /require_relative\s+['"](.+?)['"]/g,
        ];
      case "php":
        return [
          /use\s+([\w\\]+)/g,
          /require(?:_once)?\s+['"](.+?)['"]/g,
          /include(?:_once)?\s+['"](.+?)['"]/g,
        ];
      case "swift":
        return [/import\s+(\w+)/g];
      case "dart":
        return [/import\s+['"](.+?)['"]/g];
      default:
        return [];
    }
  })();

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      imports.push(match[1]);
    }
  }

  return imports;
}

/**
 * Resolve a raw import specifier to a relative file path within the project.
 * Returns null if the import is external (npm package, stdlib, etc).
 */
function resolveImport(
  rawImport: string,
  fromFile: string,
  allFiles: Set<string>,
  root: string
): string | null {
  // Skip external packages
  if (!rawImport.startsWith(".") && !rawImport.startsWith("/") && !rawImport.startsWith("crate::")) {
    // Could be an alias or absolute import within project — check if any file matches
    const candidate = rawImport.replace(/\./g, "/");
    for (const f of allFiles) {
      if (f.includes(candidate)) return f;
    }
    return null;
  }

  // Relative import resolution
  const fromDir = fromFile.substring(0, fromFile.lastIndexOf("/"));
  let resolved: string;

  if (rawImport.startsWith("crate::")) {
    // Rust crate-relative
    resolved = root + "/src/" + rawImport.replace("crate::", "").replace(/::/g, "/");
  } else if (rawImport.startsWith(".")) {
    // Relative path
    const parts = fromDir.split("/");
    const importParts = rawImport.split("/");
    for (const part of importParts) {
      if (part === "..") parts.pop();
      else if (part !== ".") parts.push(part);
    }
    resolved = parts.join("/");
  } else {
    resolved = rawImport;
  }

  // Try common extensions
  const extensions = ["", ".ts", ".tsx", ".js", ".jsx", ".py", ".rs", "/index.ts", "/index.js", "/mod.rs"];
  for (const ext of extensions) {
    const candidate = resolved + ext;
    if (allFiles.has(candidate)) return candidate;
  }

  return null;
}

/**
 * Extract function definitions and their line counts.
 */
function extractFunctions(content: string, language: string): FunctionInfo[] {
  const functions: FunctionInfo[] = [];
  const lines = content.split("\n");

  const patterns: RegExp[] = (() => {
    switch (language) {
      case "typescript":
      case "javascript":
      case "vue":
      case "svelte":
        return [
          /(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
          /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(/,
          /(\w+)\s*\(.*?\)\s*(?::\s*\w+)?\s*\{/,
        ];
      case "python":
        return [/def\s+(\w+)\s*\(/];
      case "rust":
        return [/(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/];
      case "go":
        return [/func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)/];
      case "java":
      case "kotlin":
      case "scala":
        return [/(?:public|private|protected)?\s*(?:static\s+)?(?:\w+\s+)+(\w+)\s*\(/];
      default:
        return [];
    }
  })();

  for (let i = 0; i < lines.length; i++) {
    for (const pattern of patterns) {
      const match = lines[i].match(pattern);
      if (match && match[1] && !["if", "else", "for", "while", "switch", "catch", "return", "new", "class"].includes(match[1])) {
        // Count function body lines (simple brace/indent tracking)
        let depth = 0;
        let started = false;
        let endLine = i;

        for (let j = i; j < Math.min(i + 500, lines.length); j++) {
          const line = lines[j];
          if (language === "python") {
            // Python: track indentation
            if (j === i) { started = true; continue; }
            if (started && line.trim() && !line.match(/^\s/)) { endLine = j - 1; break; }
            endLine = j;
          } else {
            // Brace languages
            for (const ch of line) {
              if (ch === "{") { depth++; started = true; }
              if (ch === "}") depth--;
            }
            if (started && depth <= 0) { endLine = j; break; }
          }
        }

        const lineCount = endLine - i + 1;
        if (lineCount >= 2) {
          functions.push({ name: match[1], startLine: i + 1, lineCount });
        }
        break; // Only match first pattern per line
      }
    }
  }

  return functions;
}

// ── Public API ──

/**
 * Build a code dependency graph for the given workspace.
 * Scans source files, parses imports, resolves dependencies.
 */
export async function buildCodeGraph(workspacePath: string): Promise<CodeGraph> {
  // Return cache if fresh
  if (_graphCache && _graphCache.root === workspacePath && Date.now() - _graphCache.timestamp < GRAPH_CACHE_TTL) {
    return _graphCache;
  }

  const startTime = performance.now();
  const { readDir, readTextFile } = await import("@tauri-apps/plugin-fs");

  // Phase 1: Collect all source files recursively
  const allFilePaths: string[] = [];

  async function walkDir(dir: string) {
    if (allFilePaths.length >= MAX_FILES) return;
    try {
      const entries = await readDir(dir);
      for (const entry of entries) {
        if (allFilePaths.length >= MAX_FILES) break;
        const fullPath = `${dir}/${entry.name}`;
        if (entry.isDirectory) {
          if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith(".")) {
            await walkDir(fullPath);
          }
        } else {
          const ext = entry.name.slice(entry.name.lastIndexOf("."));
          if (SOURCE_EXTENSIONS.has(ext)) {
            allFilePaths.push(fullPath);
          }
        }
      }
    } catch { /* permission denied */ }
  }

  await walkDir(workspacePath);

  const allFileSet = new Set(allFilePaths);
  const files = new Map<string, FileNode>();
  let edgeCount = 0;

  // Phase 2: Parse each file
  for (const filePath of allFilePaths) {
    try {
      const content = await readTextFile(filePath);
      const relativePath = filePath.replace(workspacePath + "/", "");
      const language = detectLanguage(filePath);
      const rawImports = extractImports(content, language);
      const functions = extractFunctions(content, language);

      // Resolve imports to actual project files
      const resolvedImports: string[] = [];
      for (const raw of rawImports) {
        const resolved = resolveImport(raw, filePath, allFileSet, workspacePath);
        if (resolved) {
          resolvedImports.push(resolved.replace(workspacePath + "/", ""));
          edgeCount++;
        }
      }

      files.set(relativePath, {
        path: filePath,
        relativePath,
        imports: resolvedImports,
        language,
        lineCount: content.split("\n").length,
        functions,
      });
    } catch { /* file read error */ }
  }

  const graph: CodeGraph = {
    root: workspacePath,
    files,
    buildTime: Math.round(performance.now() - startTime),
    fileCount: files.size,
    edgeCount,
    timestamp: Date.now(),
  };

  _graphCache = graph;
  return graph;
}

/**
 * Compute the blast radius of a file change.
 * Returns direct and transitive dependents.
 */
export function getImpactRadius(graph: CodeGraph, targetRelativePath: string): ImpactResult {
  const node = graph.files.get(targetRelativePath);

  // Build reverse dependency map
  const reverseDeps = new Map<string, string[]>();
  for (const [filePath, fileNode] of graph.files) {
    for (const imp of fileNode.imports) {
      if (!reverseDeps.has(imp)) reverseDeps.set(imp, []);
      reverseDeps.get(imp)!.push(filePath);
    }
  }

  // Direct dependents
  const directDependents = reverseDeps.get(targetRelativePath) || [];

  // Transitive dependents (BFS)
  const visited = new Set<string>();
  const queue = [...directDependents];
  let maxDepth = 0;
  const depthMap = new Map<string, number>();
  for (const d of directDependents) depthMap.set(d, 1);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const currentDepth = depthMap.get(current) || 1;
    if (currentDepth > maxDepth) maxDepth = currentDepth;

    const nextDeps = reverseDeps.get(current) || [];
    for (const next of nextDeps) {
      if (!visited.has(next)) {
        depthMap.set(next, currentDepth + 1);
        queue.push(next);
      }
    }
  }

  return {
    file: targetRelativePath,
    directDependents,
    transitiveDependents: [...visited],
    directDependencies: node?.imports || [],
    depth: maxDepth,
  };
}

/**
 * Get architecture overview — module coupling analysis.
 * Groups files by top-level directory and shows inter-module dependencies.
 */
export function getArchitectureOverview(graph: CodeGraph): ArchitectureModule[] {
  const modules = new Map<string, { files: string[]; edges: Map<string, number> }>();

  for (const [filePath, node] of graph.files) {
    const parts = filePath.split("/");
    const moduleName = parts.length > 1 ? parts[0] : "(root)";

    if (!modules.has(moduleName)) {
      modules.set(moduleName, { files: [], edges: new Map() });
    }
    modules.get(moduleName)!.files.push(filePath);

    for (const imp of node.imports) {
      const impParts = imp.split("/");
      const impModule = impParts.length > 1 ? impParts[0] : "(root)";
      if (impModule !== moduleName) {
        const edges = modules.get(moduleName)!.edges;
        edges.set(impModule, (edges.get(impModule) || 0) + 1);
      }
    }
  }

  const result: ArchitectureModule[] = [];
  for (const [name, data] of modules) {
    const internalEdges = data.files.reduce((sum, f) => {
      const node = graph.files.get(f);
      if (!node) return sum;
      return sum + node.imports.filter((i) => {
        const parts = i.split("/");
        return (parts.length > 1 ? parts[0] : "(root)") === name;
      }).length;
    }, 0);

    let externalEdges = 0;
    const coupledTo: { module: string; edges: number }[] = [];
    for (const [mod, count] of data.edges) {
      externalEdges += count;
      coupledTo.push({ module: mod, edges: count });
    }
    coupledTo.sort((a, b) => b.edges - a.edges);

    result.push({
      name,
      files: data.files,
      internalEdges,
      externalEdges,
      coupledTo,
    });
  }

  return result.sort((a, b) => b.files.length - a.files.length);
}

/**
 * Find large functions that may need refactoring.
 * Returns functions exceeding the given line threshold.
 */
export function findLargeFunctions(
  graph: CodeGraph,
  threshold: number = 50
): { file: string; name: string; startLine: number; lineCount: number }[] {
  const results: { file: string; name: string; startLine: number; lineCount: number }[] = [];

  for (const [filePath, node] of graph.files) {
    for (const fn of node.functions) {
      if (fn.lineCount >= threshold) {
        results.push({
          file: filePath,
          name: fn.name,
          startLine: fn.startLine,
          lineCount: fn.lineCount,
        });
      }
    }
  }

  return results.sort((a, b) => b.lineCount - a.lineCount);
}

/**
 * Get graph statistics summary.
 */
export function getGraphStats(graph: CodeGraph): string {
  const langCounts = new Map<string, number>();
  let totalLines = 0;
  let totalFunctions = 0;

  for (const [, node] of graph.files) {
    langCounts.set(node.language, (langCounts.get(node.language) || 0) + 1);
    totalLines += node.lineCount;
    totalFunctions += node.functions.length;
  }

  const langs = [...langCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([lang, count]) => `  ${lang}: ${count} files`)
    .join("\n");

  return [
    `Code Graph Stats:`,
    `  Files: ${graph.fileCount}`,
    `  Dependencies: ${graph.edgeCount} edges`,
    `  Total lines: ${totalLines.toLocaleString()}`,
    `  Functions: ${totalFunctions}`,
    `  Build time: ${graph.buildTime}ms`,
    `\nLanguages:\n${langs}`,
  ].join("\n");
}
