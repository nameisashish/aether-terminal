// ==========================================
// usePty Hook
// Manages PTY lifecycle for a single terminal
// tab — creates PTY session, handles I/O,
// resize, cleanup, and CWD detection.
//
// KEY UPGRADE: Now detects CWD changes via
// OSC 7 escape codes and syncs with the
// workspace/file explorer.
// ==========================================

import { useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { Terminal, IDisposable } from "@xterm/xterm";
import { useTerminalStore } from "../stores/terminalStore";
import { useWorkspaceStore } from "../stores/workspaceStore";
import { useFileStore } from "../stores/fileStore";

interface UsePtyOptions {
  tabId: string;
  terminal: Terminal | null;
  rows: number;
  cols: number;
}

interface PtyCreatedResponse {
  id: string;
}

/**
 * Hook that creates and manages a PTY session for a terminal tab.
 * Handles:
 * - Creating the PTY on mount
 * - Writing terminal input to PTY
 * - Receiving PTY output and writing to xterm
 * - Detecting CWD changes (OSC 7 + shell prompt parsing)
 * - Resizing PTY when terminal size changes
 * - Cleaning up on unmount
 */
export function usePty({ tabId, terminal, rows, cols }: UsePtyOptions) {
  const ptyIdRef = useRef<string | null>(null);
  const destroyedRef = useRef(false);
  const unlistenOutputRef = useRef<UnlistenFn | null>(null);
  const unlistenExitRef = useRef<UnlistenFn | null>(null);
  const onDataDisposableRef = useRef<IDisposable | null>(null);
  const onBinaryDisposableRef = useRef<IDisposable | null>(null);
  const { setPtyId, setConnected } = useTerminalStore();
  const { setWorkspacePath } = useWorkspaceStore();
  const { loadDirectory, explorerOpen } = useFileStore();
  const lastCwdRef = useRef<string | null>(null);

  // ── Detect CWD from terminal output ──
  const detectCwd = useCallback((data: string) => {
    // Method 1: OSC 7 escape sequence (modern shells emit this)
    // Format: \x1b]7;file:///path/to/dir\x07
    const osc7Match = data.match(/\x1b\]7;file:\/\/[^/]*([^\x07\x1b]+)/);
    if (osc7Match) {
      const detectedPath = decodeURIComponent(osc7Match[1]);
      if (detectedPath !== lastCwdRef.current) {
        lastCwdRef.current = detectedPath;
        setWorkspacePath(detectedPath);
        if (explorerOpen) {
          loadDirectory(detectedPath);
        }
      }
      return;
    }

    // Method 2: Detect common shell prompt patterns with paths
    // e.g., "user@host:~/projects/myapp$ " or "~/projects/myapp ❯ "
    const promptPatterns = [
      /(?:^|\n)\S*:([~\/][^\$#❯%>\n]+)\s*[\$#❯%>]\s*$/,
      /(?:^|\n)([~\/][^\s❯%>]+)\s+[❯%>]\s*$/,
    ];

    for (const pattern of promptPatterns) {
      const match = data.match(pattern);
      if (match) {
        let detectedPath = match[1].trim();
        // Expand ~ to home dir
        if (detectedPath.startsWith("~")) {
          // We'll try to resolve ~ later
          break;
        }
        if (detectedPath !== lastCwdRef.current && detectedPath.startsWith("/")) {
          lastCwdRef.current = detectedPath;
          setWorkspacePath(detectedPath);
          if (explorerOpen) {
            loadDirectory(detectedPath);
          }
        }
        break;
      }
    }
  }, [setWorkspacePath, loadDirectory, explorerOpen]);

  // ── Create PTY session ──
  const createPtySession = useCallback(async () => {
    if (!terminal) return;
    if (destroyedRef.current) return;
    if (ptyIdRef.current) return;

    try {
      const response = await invoke<PtyCreatedResponse>("create_pty", {
        request: {
          rows,
          cols,
          cwd: null,
        },
      });

      if (destroyedRef.current) {
        invoke("destroy_pty", { id: response.id }).catch(() => {});
        return;
      }

      ptyIdRef.current = response.id;
      setPtyId(tabId, response.id);
      setConnected(tabId, true);

      // Listen for PTY output events
      unlistenOutputRef.current = await listen<string>(
        `pty-output-${response.id}`,
        (event) => {
          terminal.write(event.payload);
          // Detect CWD changes from output
          detectCwd(event.payload);
        }
      );

      // Listen for PTY exit events
      unlistenExitRef.current = await listen(
        `pty-exit-${response.id}`,
        () => {
          setConnected(tabId, false);
          terminal.write("\r\n\x1b[90m[Process exited]\x1b[0m\r\n");
        }
      );

      // Forward terminal input to PTY
      onDataDisposableRef.current = terminal.onData((data) => {
        if (ptyIdRef.current && !destroyedRef.current) {
          invoke("write_pty", {
            request: {
              id: ptyIdRef.current,
              data,
            },
          }).catch((err) => {
            console.error("PTY write error:", err);
            if (!destroyedRef.current) {
              terminal.write(
                `\r\n\x1b[31m[PTY error: ${err}]\x1b[0m\r\n`
              );
            }
          });
        }
      });

      // Handle binary data (for mouse events, etc.)
      onBinaryDisposableRef.current = terminal.onBinary((data) => {
        if (ptyIdRef.current && !destroyedRef.current) {
          invoke("write_pty", {
            request: {
              id: ptyIdRef.current,
              data,
            },
          }).catch((err) => {
            console.error("PTY binary write error:", err);
          });
        }
      });
    } catch (err) {
      console.error("Failed to create PTY session:", err);
      terminal.write(
        `\r\n\x1b[31mFailed to create terminal session: ${err}\x1b[0m\r\n`
      );
    }
  }, [terminal, rows, cols, tabId, setPtyId, setConnected, detectCwd]);

  // ── Resize PTY ──
  const resizePty = useCallback(
    async (newRows: number, newCols: number) => {
      if (!ptyIdRef.current || destroyedRef.current) return;
      try {
        await invoke("resize_pty", {
          request: {
            id: ptyIdRef.current,
            rows: newRows,
            cols: newCols,
          },
        });
      } catch (err) {
        console.error("Failed to resize PTY:", err);
      }
    },
    []
  );

  // ── Destroy PTY ──
  const destroyPty = useCallback(async () => {
    destroyedRef.current = true;

    if (onDataDisposableRef.current) {
      onDataDisposableRef.current.dispose();
      onDataDisposableRef.current = null;
    }
    if (onBinaryDisposableRef.current) {
      onBinaryDisposableRef.current.dispose();
      onBinaryDisposableRef.current = null;
    }

    if (unlistenOutputRef.current) {
      unlistenOutputRef.current();
      unlistenOutputRef.current = null;
    }
    if (unlistenExitRef.current) {
      unlistenExitRef.current();
      unlistenExitRef.current = null;
    }

    if (ptyIdRef.current) {
      try {
        await invoke("destroy_pty", { id: ptyIdRef.current });
      } catch (err) {
        console.error("Failed to destroy PTY:", err);
      }
      ptyIdRef.current = null;
    }
  }, []);

  // ── Create PTY on mount ──
  useEffect(() => {
    if (terminal) {
      destroyedRef.current = false;
      createPtySession();
    }

    return () => {
      destroyPty();
    };
  }, [terminal]);

  return { resizePty, destroyPty };
}
