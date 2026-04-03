import { useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { motion, AnimatePresence } from "framer-motion";
import {
  FolderOpen,
  X,
  RefreshCw,
  FileCheck,
  Trash2,
} from "lucide-react";
import { useFileStore, type FileEntry } from "../../stores/fileStore";
import { FileNode } from "./FileNode";

export function FileExplorer() {
  const {
    rootPath,
    entries,
    selectedFiles,
    explorerOpen,
    setExplorerOpen,
    setRootPath,
    setEntries,
    clearSelected,
  } = useFileStore();

  // Load directory contents
  const loadDirectory = useCallback(
    async (dirPath: string) => {
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
            // Directories first, then alphabetical
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            return a.name.localeCompare(b.name);
          });

        setEntries(mapped);
      } catch (err) {
        console.error("Failed to load directory:", err);
      }
    },
    [setEntries]
  );

  // Load home dir on first open
  useEffect(() => {
    if (explorerOpen && !rootPath) {
      // Get actual home directory from the Rust backend
      invoke<string>("get_home_dir")
        .then((homeDir) => {
          setRootPath(homeDir);
          loadDirectory(homeDir);
        })
        .catch(() => {
          // Fallback for platforms where the command might fail
          const fallback = navigator.platform.startsWith("Win")
            ? "C:\\Users"
            : "/home";
          setRootPath(fallback);
          loadDirectory(fallback);
        });
    }
  }, [explorerOpen]);

  useEffect(() => {
    if (rootPath) {
      loadDirectory(rootPath);
    }
  }, [rootPath]);

  if (!explorerOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ width: 0, opacity: 0 }}
        animate={{ width: 260, opacity: 1 }}
        exit={{ width: 0, opacity: 0 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "var(--bg-secondary)",
          borderRight: "1px solid var(--border-subtle)",
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 12px",
            borderBottom: "1px solid var(--border-subtle)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <FolderOpen size={14} style={{ color: "var(--accent)" }} />
            <span
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--text-primary)",
              }}
            >
              Explorer
            </span>
          </div>
          <div style={{ display: "flex", gap: "2px" }}>
            {selectedFiles.size > 0 && (
              <button
                className="icon-btn"
                onClick={clearSelected}
                title="Clear selected"
                style={{ width: "24px", height: "24px" }}
              >
                <Trash2 size={12} />
              </button>
            )}
            <button
              className="icon-btn"
              onClick={() => rootPath && loadDirectory(rootPath)}
              title="Refresh"
              style={{ width: "24px", height: "24px" }}
            >
              <RefreshCw size={12} />
            </button>
            <button
              className="icon-btn"
              onClick={() => setExplorerOpen(false)}
              style={{ width: "24px", height: "24px" }}
            >
              <X size={12} />
            </button>
          </div>
        </div>

        {/* Context badge */}
        {selectedFiles.size > 0 && (
          <div
            style={{
              padding: "4px 12px",
              fontSize: "10px",
              color: "var(--accent)",
              background: "var(--accent-muted)",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              flexShrink: 0,
            }}
          >
            <FileCheck size={10} />
            {selectedFiles.size} file{selectedFiles.size > 1 ? "s" : ""} in AI
            context
          </div>
        )}

        {/* File Tree */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            padding: "4px 0",
          }}
        >
          {entries.map((entry) => (
            <FileNode
              key={entry.path}
              entry={entry}
              depth={0}
              onLoadChildren={async (dirPath) => {
                try {
                  const { readDir } = await import("@tauri-apps/plugin-fs");
                  const rawEntries = await readDir(dirPath);
                  return rawEntries
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
                } catch {
                  return [];
                }
              }}
            />
          ))}
        </div>

        {/* Root path */}
        <div
          style={{
            padding: "6px 12px",
            borderTop: "1px solid var(--border-subtle)",
            fontSize: "10px",
            color: "var(--text-muted)",
            fontFamily: "var(--font-mono)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            flexShrink: 0,
          }}
        >
          {rootPath || "No directory open"}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
