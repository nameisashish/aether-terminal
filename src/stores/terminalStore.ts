// ==========================================
// Terminal Store (Zustand)
// Manages terminal tabs, active tab, and
// per-tab state like title and PTY session ID.
// ==========================================

import { create } from "zustand";

/** Represents a single terminal tab */
export interface TerminalTab {
  id: string;
  title: string;
  ptyId: string | null; // PTY session ID from Rust backend
  isConnected: boolean;
  cwd?: string;
}

/** Terminal store state */
interface TerminalState {
  tabs: TerminalTab[];
  activeTabId: string | null;

  // ── Actions ──
  addTab: (tab: TerminalTab) => void;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTab: (id: string, updates: Partial<TerminalTab>) => void;
  setPtyId: (tabId: string, ptyId: string) => void;
  setConnected: (tabId: string, connected: boolean) => void;
}

/** Generate a unique tab ID */
let tabCounter = 0;
export function generateTabId(): string {
  return `tab-${++tabCounter}-${Date.now()}`;
}

/** Create a new terminal tab config */
export function createTab(overrides?: Partial<TerminalTab>): TerminalTab {
  const id = generateTabId();
  return {
    id,
    title: `Terminal ${tabCounter}`,
    ptyId: null,
    isConnected: false,
    ...overrides,
  };
}

/** Zustand store for terminal state */
export const useTerminalStore = create<TerminalState>((set, get) => ({
  tabs: [],
  activeTabId: null,

  addTab: (tab) =>
    set((state) => ({
      tabs: [...state.tabs, tab],
      activeTabId: tab.id,
    })),

  removeTab: (id) =>
    set((state) => {
      const newTabs = state.tabs.filter((t) => t.id !== id);
      let newActiveId = state.activeTabId;

      // If closing the active tab, switch to adjacent tab
      if (state.activeTabId === id) {
        const closedIndex = state.tabs.findIndex((t) => t.id === id);
        if (newTabs.length > 0) {
          const newIndex = Math.min(closedIndex, newTabs.length - 1);
          newActiveId = newTabs[newIndex].id;
        } else {
          newActiveId = null;
        }
      }

      return { tabs: newTabs, activeTabId: newActiveId };
    }),

  setActiveTab: (id) => set({ activeTabId: id }),

  updateTab: (id, updates) =>
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),

  setPtyId: (tabId, ptyId) => {
    get().updateTab(tabId, { ptyId });
  },

  setConnected: (tabId, connected) => {
    get().updateTab(tabId, { isConnected: connected });
  },
}));
