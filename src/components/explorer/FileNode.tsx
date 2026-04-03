// ==========================================
// File Node Component
// Individual file/folder node in the tree
// with expand/collapse, selection, and
// file type icons.
// ==========================================

import { useState, useCallback } from "react";
import {
  Folder,
  FolderOpen,
  FileText,
  FileCode,
  FileJson,
  File,
  Image,
  ChevronRight,
  ChevronDown,
  Check,
} from "lucide-react";
import { useFileStore, type FileEntry } from "../../stores/fileStore";

interface FileNodeProps {
  entry: FileEntry;
  depth: number;
  onLoadChildren: (path: string) => Promise<FileEntry[]>;
}

/** Map file extensions to icons */
function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts":
    case "tsx":
    case "js":
    case "jsx":
    case "py":
    case "rs":
    case "go":
    case "java":
    case "c":
    case "cpp":
    case "h":
    case "rb":
    case "swift":
    case "kt":
      return <FileCode size={14} style={{ color: "var(--blue)" }} />;
    case "json":
    case "yaml":
    case "yml":
    case "toml":
      return <FileJson size={14} style={{ color: "var(--yellow)" }} />;
    case "md":
    case "txt":
    case "log":
      return <FileText size={14} style={{ color: "var(--text-secondary)" }} />;
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "svg":
    case "webp":
      return <Image size={14} style={{ color: "var(--magenta, #c084fc)" }} />;
    default:
      return <File size={14} style={{ color: "var(--text-muted)" }} />;
  }
}

export function FileNode({ entry, depth, onLoadChildren }: FileNodeProps) {
  const { selectedFiles, toggleSelected } = useFileStore();
  const [children, setChildren] = useState<FileEntry[]>(entry.children || []);
  const [isExpanded, setIsExpanded] = useState(entry.isExpanded || false);
  const [isLoaded, setIsLoaded] = useState(false);

  const isSelected = selectedFiles.has(entry.path);

  const handleToggleExpand = useCallback(async () => {
    if (!entry.isDirectory) return;

    if (!isLoaded) {
      const loaded = await onLoadChildren(entry.path);
      setChildren(loaded);
      setIsLoaded(true);
    }

    setIsExpanded(!isExpanded);
  }, [entry.path, entry.isDirectory, isExpanded, isLoaded, onLoadChildren]);

  const handleSelect = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!entry.isDirectory) {
        toggleSelected(entry.path);
      }
    },
    [entry.path, entry.isDirectory, toggleSelected]
  );

  // Don't show hidden files
  if (entry.name.startsWith(".") && entry.name !== ".env") return null;

  return (
    <div>
      <div
        onClick={entry.isDirectory ? handleToggleExpand : handleSelect}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          paddingLeft: `${depth * 16 + 8}px`,
          paddingRight: "8px",
          height: "26px",
          cursor: "pointer",
          fontSize: "12px",
          color: isSelected ? "var(--text-primary)" : "var(--text-secondary)",
          background: isSelected ? "var(--accent-muted)" : "transparent",
          transition: "background 0.1s",
          userSelect: "none",
        }}
        onMouseEnter={(e) => {
          if (!isSelected) {
            (e.currentTarget as HTMLElement).style.background =
              "var(--bg-hover)";
          }
        }}
        onMouseLeave={(e) => {
          if (!isSelected) {
            (e.currentTarget as HTMLElement).style.background = "transparent";
          }
        }}
      >
        {/* Expand/collapse arrow for directories */}
        {entry.isDirectory ? (
          <span style={{ display: "flex", alignItems: "center", width: "14px" }}>
            {isExpanded ? (
              <ChevronDown size={12} style={{ color: "var(--text-muted)" }} />
            ) : (
              <ChevronRight size={12} style={{ color: "var(--text-muted)" }} />
            )}
          </span>
        ) : (
          <span style={{ width: "14px" }} />
        )}

        {/* Icon */}
        {entry.isDirectory ? (
          isExpanded ? (
            <FolderOpen size={14} style={{ color: "var(--yellow)" }} />
          ) : (
            <Folder size={14} style={{ color: "var(--yellow)" }} />
          )
        ) : (
          getFileIcon(entry.name)
        )}

        {/* Name */}
        <span
          style={{
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {entry.name}
        </span>

        {/* Selection indicator */}
        {isSelected && (
          <Check
            size={12}
            style={{ color: "var(--accent)", flexShrink: 0 }}
          />
        )}
      </div>

      {/* Children */}
      {entry.isDirectory && isExpanded && (
        <div>
          {children.map((child) => (
            <FileNode
              key={child.path}
              entry={child}
              depth={depth + 1}
              onLoadChildren={onLoadChildren}
            />
          ))}
          {isLoaded && children.length === 0 && (
            <div
              style={{
                paddingLeft: `${(depth + 1) * 16 + 8}px`,
                fontSize: "11px",
                color: "var(--text-muted)",
                height: "24px",
                display: "flex",
                alignItems: "center",
                fontStyle: "italic",
              }}
            >
              (empty)
            </div>
          )}
        </div>
      )}
    </div>
  );
}
