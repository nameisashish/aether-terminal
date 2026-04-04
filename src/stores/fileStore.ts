// ==========================================
// File Store (Zustand)
// Manages file explorer state: current dir,
// file tree, selected files for AI context.
// Syncs with workspaceStore for project root.
// ==========================================

import { create } from "zustand";

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileEntry[];
  isExpanded?: boolean;
}

interface FileState {
  rootPath: string | null;
  entries: FileEntry[];
  selectedFiles: Set<string>; // Files selected for AI context
  explorerOpen: boolean;
  isLoading: boolean;

  setRootPath: (path: string) => void;
  setEntries: (entries: FileEntry[]) => void;
  toggleExpanded: (path: string) => void;
  toggleSelected: (path: string) => void;
  selectFile: (path: string) => void;
  clearSelected: () => void;
  setExplorerOpen: (open: boolean) => void;
  setLoading: (loading: boolean) => void;
  loadDirectory: (dirPath: string) => Promise<void>;
  refreshExplorer: () => Promise<void>;
}

export const useFileStore = create<FileState>((set, get) => ({
  rootPath: null,
  entries: [],
  selectedFiles: new Set(),
  explorerOpen: false,
  isLoading: false,

  setRootPath: (path) => set({ rootPath: path }),

  setEntries: (entries) => set({ entries }),

  setLoading: (loading) => set({ isLoading: loading }),

  toggleExpanded: (path) =>
    set((s) => ({
      entries: toggleEntryExpanded(s.entries, path),
    })),

  toggleSelected: (path) =>
    set((s) => {
      const next = new Set(s.selectedFiles);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return { selectedFiles: next };
    }),

  selectFile: (path) =>
    set((s) => {
      const next = new Set(s.selectedFiles);
      next.add(path);
      return { selectedFiles: next };
    }),

  clearSelected: () => set({ selectedFiles: new Set() }),

  setExplorerOpen: (open) => set({ explorerOpen: open }),

  loadDirectory: async (dirPath: string) => {
    set({ isLoading: true });
    try {
      const { readDir } = await import("@tauri-apps/plugin-fs");
      const rawEntries = await readDir(dirPath);

      const mapped: FileEntry[] = rawEntries
        .map((e) => ({
          name: e.name,
          path: `${dirPath}/${e.name}`,
          isDirectory: e.isDirectory,
          children: e.isDirectory ? [] : undefined,
          isExpanded: false,
        }))
        .sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        });

      set({ entries: mapped, rootPath: dirPath, isLoading: false });
    } catch (err) {
      console.error("Failed to load directory:", err);
      set({ isLoading: false });
    }
  },

  refreshExplorer: async () => {
    const { rootPath } = get();
    if (rootPath) {
      await get().loadDirectory(rootPath);
    }
  },
}));

/** Recursively toggle isExpanded for a file entry */
function toggleEntryExpanded(entries: FileEntry[], targetPath: string): FileEntry[] {
  return entries.map((entry) => {
    if (entry.path === targetPath) {
      return { ...entry, isExpanded: !entry.isExpanded };
    }
    if (entry.children) {
      return { ...entry, children: toggleEntryExpanded(entry.children, targetPath) };
    }
    return entry;
  });
}
