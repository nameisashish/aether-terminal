// ==========================================
// Terminal Component
// Renders a single xterm.js terminal instance
// with WebGL renderer, fit addon, and PTY
// connection via the usePty hook.
// ==========================================

import { useEffect, useRef, useState, useCallback } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import { usePty } from "../../hooks/usePty";

interface TerminalProps {
  tabId: string;
  isActive: boolean;
}

/** xterm.js theme — matches Aether dark aesthetic */
const TERMINAL_THEME = {
  background: "#0a0a0f",
  foreground: "#e4e4ef",
  cursor: "#7c5cfc",
  cursorAccent: "#0a0a0f",
  selectionBackground: "rgba(124, 92, 252, 0.25)",
  selectionForeground: "#ffffff",

  // ANSI colors
  black: "#1a1a24",
  red: "#f87171",
  green: "#4ade80",
  yellow: "#fbbf24",
  blue: "#60a5fa",
  magenta: "#c084fc",
  cyan: "#22d3ee",
  white: "#e4e4ef",

  // Bright ANSI
  brightBlack: "#555570",
  brightRed: "#fca5a5",
  brightGreen: "#86efac",
  brightYellow: "#fde68a",
  brightBlue: "#93c5fd",
  brightMagenta: "#d8b4fe",
  brightCyan: "#67e8f9",
  brightWhite: "#ffffff",
};

export function Terminal({ tabId, isActive }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [terminal, setTerminal] = useState<XTerm | null>(null);
  const [dims, setDims] = useState({ rows: 24, cols: 80 });

  // ── Initialize xterm.js ──
  useEffect(() => {
    if (!containerRef.current || terminalRef.current) return;

    const term = new XTerm({
      theme: TERMINAL_THEME,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', 'Menlo', monospace",
      fontSize: 14,
      lineHeight: 1.35,
      letterSpacing: 0,
      cursorBlink: true,
      cursorStyle: "bar",
      cursorWidth: 2,
      scrollback: 10000,
      allowProposedApi: true,
      macOptionIsMeta: true,
      macOptionClickForcesSelection: true,
      convertEol: false,
      scrollOnUserInput: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(containerRef.current);

    // Try to load WebGL renderer for GPU acceleration
    try {
      const webglAddon = new WebglAddon();
      webglAddon.onContextLoss(() => {
        webglAddon.dispose();
      });
      term.loadAddon(webglAddon);
    } catch (e) {
      console.warn("WebGL addon failed, using canvas renderer:", e);
    }

    // Initial fit
    fitAddon.fit();

    terminalRef.current = term;
    fitAddonRef.current = fitAddon;

    setDims({ rows: term.rows, cols: term.cols });
    setTerminal(term);

    return () => {
      term.dispose();
      terminalRef.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  // ── Connect PTY ──
  const { resizePty } = usePty({
    tabId,
    terminal,
    rows: dims.rows,
    cols: dims.cols,
  });

  // ── Handle resize ──
  const handleResize = useCallback(() => {
    if (!fitAddonRef.current || !terminalRef.current) return;

    fitAddonRef.current.fit();
    const newRows = terminalRef.current.rows;
    const newCols = terminalRef.current.cols;

    setDims({ rows: newRows, cols: newCols });
    resizePty(newRows, newCols);
  }, [resizePty]);

  // ── Observe container resize ──
  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver(() => {
      handleResize();
    });

    observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [handleResize]);

  // ── Focus terminal when tab becomes active ──
  useEffect(() => {
    if (isActive && terminalRef.current) {
      terminalRef.current.focus();
      // Re-fit when switching tabs
      setTimeout(() => {
        fitAddonRef.current?.fit();
      }, 0);
    }
  }, [isActive]);

  return (
    <div
      ref={containerRef}
      className="terminal-container"
      style={{
        display: isActive ? "block" : "none",
      }}
    />
  );
}
