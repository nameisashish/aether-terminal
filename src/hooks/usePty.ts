// ==========================================
// usePty Hook
// Manages PTY lifecycle for a single terminal
// tab — creates PTY session, handles I/O,
// resize, and cleanup.
// ==========================================

import { useCallback, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { Terminal, IDisposable } from "@xterm/xterm";
import { useTerminalStore } from "../stores/terminalStore";

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

  // ── Create PTY session ──
  const createPtySession = useCallback(async () => {
    if (!terminal) return;
    // Guard: don't create if already destroyed or already has a session
    if (destroyedRef.current) return;
    if (ptyIdRef.current) return;

    try {
      // Invoke Rust command to create a PTY
      const response = await invoke<PtyCreatedResponse>("create_pty", {
        request: {
          rows,
          cols,
          cwd: null, // Use default home directory
        },
      });

      // Guard: check if component was unmounted during async call
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
  }, [terminal, rows, cols, tabId, setPtyId, setConnected]);

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

    // Clean up terminal input disposables
    if (onDataDisposableRef.current) {
      onDataDisposableRef.current.dispose();
      onDataDisposableRef.current = null;
    }
    if (onBinaryDisposableRef.current) {
      onBinaryDisposableRef.current.dispose();
      onBinaryDisposableRef.current = null;
    }

    // Clean up event listeners
    if (unlistenOutputRef.current) {
      unlistenOutputRef.current();
      unlistenOutputRef.current = null;
    }
    if (unlistenExitRef.current) {
      unlistenExitRef.current();
      unlistenExitRef.current = null;
    }

    // Destroy the backend PTY session
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
  }, [terminal]); // Only re-run when terminal instance changes

  return { resizePty, destroyPty };
}
