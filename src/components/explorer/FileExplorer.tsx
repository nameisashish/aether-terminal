// ==========================================
// File Explorer Component — Full Rewrite
// Now syncs with workspace context, supports:
// - "Open Folder" button
// - Terminal CWD sync
// - File click → opens in FileViewer
// - Right-click context menu
// - Create new file / folder
// ==========================================

import { useEffect, useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { motion, AnimatePresence } from "framer-motion";
import {
  FolderOpen,
  X,
  RefreshCw,
  FileCheck,
  Trash2,
  FolderPlus,
  FilePlus,
  Loader2,
} from "lucide-react";
import { useFileStore, type FileEntry } from "../../stores/fileStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { FileNode } from "./FileNode";

export function FileExplorer() {
  const {
    rootPath,
    entries,
    selectedFiles,
    explorerOpen,
    setExplorerOpen,
    loadDirectory,
    refreshExplorer,
    clearSelected,
    isLoading,
  } = useFileStore();

  const { workspacePath, setWorkspacePath, openFile } = useWorkspaceStore();

  const [showNewInput, setShowNewInput] = useState<"file" | "folder" | null>(null);
  const [newName, setNewName] = useState("");

  // ── Sync with workspace path ──
  useEffect(() => {
    if (workspacePath && workspacePath !== rootPath) {
      loadDirectory(workspacePath);
    }
  }, [workspacePath]);

  // ── Load initial directory ──
  useEffect(() => {
    if (explorerOpen && !rootPath && !workspacePath) {
      // Try to get home dir as starting point
      invoke<string>("get_home_dir")
        .then((homeDir) => {
          setWorkspacePath(homeDir);
          loadDirectory(homeDir);
        })
        .catch(() => {
          const fallback = navigator.platform.startsWith("Win")
            ? "C:\\Users"
            : "/home";
          setWorkspacePath(fallback);
          loadDirectory(fallback);
        });
    } else if (explorerOpen && rootPath) {
      loadDirectory(rootPath);
    }
  }, [explorerOpen]);

  // ── Open Folder dialog ──
  const handleOpenFolder = useCallback(async () => {
    try {
      // Use Tauri's dialog to pick a folder
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Open Project Folder",
      });
      if (selected && typeof selected === "string") {
        setWorkspacePath(selected);
        loadDirectory(selected);
      }
    } catch {
      // Fallback: just prompt user
      console.error("Dialog not available");
    }
  }, [setWorkspacePath, loadDirectory]);

  // ── Create new file or folder ──
  const handleCreateNew = useCallback(async () => {
    if (!newName.trim() || !rootPath) return;
    const fullPath = `${rootPath}/${newName.trim()}`;

    try {
      if (showNewInput === "folder") {
        const { mkdir } = await import("@tauri-apps/plugin-fs");
        await mkdir(fullPath, { recursive: true });
      } else {
        const { writeTextFile } = await import("@tauri-apps/plugin-fs");
        await writeTextFile(fullPath, "");
      }
      setNewName("");
      setShowNewInput(null);
      await refreshExplorer();
    } catch (err) {
      console.error("Failed to create:", err);
    }
  }, [newName, rootPath, showNewInput, refreshExplorer]);

  // ── Handle file click → open in viewer ──
  const handleFileClick = useCallback(
    (filePath: string) => {
      openFile(filePath);
    },
    [openFile]
  );

  // ── Load children for expand ──
  const handleLoadChildren = useCallback(async (dirPath: string): Promise<FileEntry[]> => {
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
  }, []);

  if (!explorerOpen) return null;

  const folderName = rootPath ? rootPath.split("/").pop() || rootPath : "No folder open";

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
                maxWidth: "100px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {folderName}
            </span>
            {isLoading && (
              <Loader2 size={10} style={{ color: "var(--accent)" }} className="animate-spin" />
            )}
          </div>
          <div style={{ display: "flex", gap: "2px" }}>
            <button
              className="icon-btn"
              onClick={() => setShowNewInput("file")}
              title="New File"
              style={{ width: "24px", height: "24px" }}
            >
              <FilePlus size={12} />
            </button>
            <button
              className="icon-btn"
              onClick={() => setShowNewInput("folder")}
              title="New Folder"
              style={{ width: "24px", height: "24px" }}
            >
              <FolderPlus size={12} />
            </button>
            <button
              className="icon-btn"
              onClick={handleOpenFolder}
              title="Open Folder"
              style={{ width: "24px", height: "24px" }}
            >
              <FolderOpen size={12} />
            </button>
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
              onClick={refreshExplorer}
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

        {/* New file/folder input */}
        {showNewInput && (
          <div
            style={{
              padding: "6px 12px",
              borderBottom: "1px solid var(--border-subtle)",
              display: "flex",
              gap: "4px",
            }}
          >
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateNew();
                if (e.key === "Escape") { setShowNewInput(null); setNewName(""); }
              }}
              placeholder={showNewInput === "folder" ? "folder name..." : "filename..."}
              autoFocus
              style={{
                flex: 1,
                padding: "3px 8px",
                fontSize: "11px",
                background: "var(--bg-tertiary)",
                border: "1px solid var(--border-active)",
                borderRadius: "4px",
                color: "var(--text-primary)",
                outline: "none",
                fontFamily: "var(--font-mono)",
              }}
            />
            <button
              className="icon-btn"
              onClick={handleCreateNew}
              style={{ width: "24px", height: "24px" }}
              title="Create"
            >
              <FileCheck size={12} style={{ color: "var(--green)" }} />
            </button>
            <button
              className="icon-btn"
              onClick={() => { setShowNewInput(null); setNewName(""); }}
              style={{ width: "24px", height: "24px" }}
            >
              <X size={10} />
            </button>
          </div>
        )}

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
          {entries.length === 0 && !isLoading && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                height: "100%",
                gap: "12px",
                padding: "20px",
              }}
            >
              <FolderOpen size={28} strokeWidth={1.5} style={{ opacity: 0.3, color: "var(--text-muted)" }} />
              <span style={{ fontSize: "12px", color: "var(--text-muted)", textAlign: "center" }}>
                No folder open
              </span>
              <button
                className="btn btn-primary"
                onClick={handleOpenFolder}
                style={{ fontSize: "12px", padding: "6px 14px" }}
              >
                Open Folder
              </button>
            </div>
          )}

          {entries.map((entry) => (
            <FileNode
              key={entry.path}
              entry={entry}
              depth={0}
              onLoadChildren={handleLoadChildren}
              onFileClick={handleFileClick}
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
