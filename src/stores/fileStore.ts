// ==========================================
// File Store (Zustand)
// Manages file explorer state: current dir,
// file tree, selected files for AI context.
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

  setRootPath: (path: string) => void;
  setEntries: (entries: FileEntry[]) => void;
  toggleExpanded: (path: string) => void;
  toggleSelected: (path: string) => void;
  clearSelected: () => void;
  setExplorerOpen: (open: boolean) => void;
}

export const useFileStore = create<FileState>((set) => ({
  rootPath: null,
  entries: [],
  selectedFiles: new Set(),
  explorerOpen: false,

  setRootPath: (path) => set({ rootPath: path }),

  setEntries: (entries) => set({ entries }),

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

  clearSelected: () => set({ selectedFiles: new Set() }),

  setExplorerOpen: (open) => set({ explorerOpen: open }),
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
