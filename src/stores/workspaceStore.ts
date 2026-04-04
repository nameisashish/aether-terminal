// ==========================================
// Workspace Store (Zustand)
// Central source of truth for the active
// project/workspace. All systems (explorer,
// AI, agents, terminal) sync through this.
// ==========================================

import { create } from "zustand";

export interface WorkspaceState {
  // ── State ──
  workspacePath: string | null;       // Active project root directory
  openFilePath: string | null;        // Currently viewed file
  openFileContent: string | null;     // Content of viewed file
  openFileLanguage: string | null;    // Language for syntax hints
  recentWorkspaces: string[];         // Recently opened folders

  // ── Actions ──
  setWorkspacePath: (path: string) => void;
  openFile: (path: string) => Promise<void>;
  closeFile: () => void;
  addRecentWorkspace: (path: string) => void;
}

/** Detect language from file extension */
function detectLanguage(filename: string): string | null {
  const ext = filename.split(".").pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx",
    py: "python", rs: "rust", go: "go", java: "java",
    c: "c", cpp: "cpp", h: "c", rb: "ruby", swift: "swift",
    kt: "kotlin", json: "json", yaml: "yaml", yml: "yaml",
    toml: "toml", md: "markdown", html: "html", css: "css",
    scss: "scss", sql: "sql", sh: "shell", bash: "shell",
    zsh: "shell", dockerfile: "dockerfile", xml: "xml",
  };
  return ext ? langMap[ext] || null : null;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  workspacePath: null,
  openFilePath: null,
  openFileContent: null,
  openFileLanguage: null,
  recentWorkspaces: [],

  setWorkspacePath: (path) =>
    set((s) => ({
      workspacePath: path,
      recentWorkspaces: [path, ...s.recentWorkspaces.filter((p) => p !== path)].slice(0, 10),
    })),

  openFile: async (path) => {
    try {
      const { readTextFile } = await import("@tauri-apps/plugin-fs");
      const content = await readTextFile(path);
      const filename = path.split("/").pop() || path;
      set({
        openFilePath: path,
        openFileContent: content.length > 500000
          ? content.slice(0, 500000) + "\n\n...[File truncated — too large to display]"
          : content,
        openFileLanguage: detectLanguage(filename),
      });
    } catch (err) {
      console.error("Failed to open file:", err);
      set({
        openFilePath: path,
        openFileContent: `Error: Could not read file.\n${err}`,
        openFileLanguage: null,
      });
    }
  },

  closeFile: () =>
    set({ openFilePath: null, openFileContent: null, openFileLanguage: null }),

  addRecentWorkspace: (path) =>
    set((s) => ({
      recentWorkspaces: [path, ...s.recentWorkspaces.filter((p) => p !== path)].slice(0, 10),
    })),
}));
