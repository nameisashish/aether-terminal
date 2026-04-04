// ==========================================
// Lightweight Markdown Renderer
// Renders markdown to React elements without
// external dependencies. Handles:
// - Code blocks with copy button
// - Inline code
// - Headers, bold, italic
// - Lists (ordered + unordered)
// - Links
// - Blockquotes
// - Tool activity lines (> 🔧 ...)
// ==========================================

import { useState, type ReactNode } from "react";

interface MarkdownProps {
  content: string;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      onClick={handleCopy}
      style={{
        position: "absolute",
        top: "6px",
        right: "6px",
        padding: "2px 8px",
        fontSize: "11px",
        fontFamily: "var(--font-mono)",
        background: copied ? "rgba(74, 222, 128, 0.15)" : "rgba(255,255,255,0.06)",
        color: copied ? "#4ade80" : "var(--text-muted)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "4px",
        cursor: "pointer",
        transition: "all 0.2s",
        zIndex: 2,
      }}
    >
      {copied ? "✓ Copied" : "Copy"}
    </button>
  );
}

/** Tokenize inline markdown: bold, italic, code, links */
function renderInline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Inline code: `code`
    let match = remaining.match(/^`([^`]+)`/);
    if (match) {
      parts.push(
        <code
          key={key++}
          style={{
            background: "rgba(124, 92, 252, 0.12)",
            color: "#c084fc",
            padding: "1px 5px",
            borderRadius: "3px",
            fontSize: "0.9em",
            fontFamily: "var(--font-mono)",
          }}
        >
          {match[1]}
        </code>
      );
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Bold: **text** or __text__
    match = remaining.match(/^\*\*(.+?)\*\*/);
    if (!match) match = remaining.match(/^__(.+?)__/);
    if (match) {
      parts.push(
        <strong key={key++} style={{ color: "var(--text-primary)", fontWeight: 600 }}>
          {match[1]}
        </strong>
      );
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Italic: *text* or _text_
    match = remaining.match(/^\*(.+?)\*/);
    if (!match) match = remaining.match(/^_(.+?)_/);
    if (match) {
      parts.push(<em key={key++}>{match[1]}</em>);
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Links: [text](url)
    match = remaining.match(/^\[([^\]]+)\]\(([^)]+)\)/);
    if (match) {
      parts.push(
        <a
          key={key++}
          href={match[2]}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--accent)", textDecoration: "underline" }}
        >
          {match[1]}
        </a>
      );
      remaining = remaining.slice(match[0].length);
      continue;
    }

    // Regular character
    const nextSpecial = remaining.slice(1).search(/[`*_\[]/);
    if (nextSpecial === -1) {
      parts.push(remaining);
      break;
    } else {
      parts.push(remaining.slice(0, nextSpecial + 1));
      remaining = remaining.slice(nextSpecial + 1);
    }
  }

  return parts;
}

/** Parse markdown string into React elements */
export function Markdown({ content }: MarkdownProps) {
  const lines = content.split("\n");
  const elements: ReactNode[] = [];
  let key = 0;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block: ```lang
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```

      const codeContent = codeLines.join("\n");
      elements.push(
        <div key={key++} style={{ position: "relative", margin: "8px 0" }}>
          {lang && (
            <div
              style={{
                fontSize: "10px",
                fontFamily: "var(--font-mono)",
                color: "var(--text-muted)",
                padding: "4px 12px",
                background: "rgba(255,255,255,0.03)",
                borderTopLeftRadius: "8px",
                borderTopRightRadius: "8px",
                borderBottom: "1px solid rgba(255,255,255,0.05)",
              }}
            >
              {lang}
            </div>
          )}
          <CopyButton text={codeContent} />
          <pre
            style={{
              background: "#0d0d14",
              padding: "12px 14px",
              borderRadius: lang ? "0 0 8px 8px" : "8px",
              overflow: "auto",
              fontSize: "12.5px",
              lineHeight: "1.55",
              fontFamily: "var(--font-mono)",
              color: "#e4e4ef",
              border: "1px solid rgba(255,255,255,0.05)",
              borderTop: lang ? "none" : undefined,
              margin: 0,
            }}
          >
            <code>
              <SyntaxHighlight code={codeContent} language={lang} />
            </code>
          </pre>
        </div>
      );
      continue;
    }

    // Tool activity line: > 🔧
    if (line.startsWith("> 🔧")) {
      elements.push(
        <div
          key={key++}
          style={{
            padding: "4px 10px",
            margin: "3px 0",
            borderLeft: "2px solid var(--accent)",
            background: "rgba(124, 92, 252, 0.05)",
            fontSize: "11.5px",
            color: "var(--text-secondary)",
            fontFamily: "var(--font-mono)",
            borderRadius: "0 4px 4px 0",
          }}
        >
          {line.slice(2)}
        </div>
      );
      i++;
      continue;
    }

    // Blockquote: >
    if (line.startsWith("> ")) {
      elements.push(
        <blockquote
          key={key++}
          style={{
            borderLeft: "3px solid var(--accent)",
            paddingLeft: "12px",
            margin: "6px 0",
            color: "var(--text-secondary)",
            fontStyle: "italic",
          }}
        >
          {renderInline(line.slice(2))}
        </blockquote>
      );
      i++;
      continue;
    }

    // Headers
    if (line.startsWith("### ")) {
      elements.push(
        <h4 key={key++} style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)", margin: "10px 0 4px" }}>
          {renderInline(line.slice(4))}
        </h4>
      );
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      elements.push(
        <h3 key={key++} style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", margin: "12px 0 4px" }}>
          {renderInline(line.slice(3))}
        </h3>
      );
      i++;
      continue;
    }
    if (line.startsWith("# ")) {
      elements.push(
        <h2 key={key++} style={{ fontSize: "15px", fontWeight: 700, color: "var(--text-primary)", margin: "14px 0 6px" }}>
          {renderInline(line.slice(2))}
        </h2>
      );
      i++;
      continue;
    }

    // Unordered list: - or *
    if (/^[\-\*] /.test(line)) {
      elements.push(
        <div key={key++} style={{ display: "flex", gap: "6px", margin: "2px 0", paddingLeft: "4px" }}>
          <span style={{ color: "var(--accent)", flexShrink: 0 }}>•</span>
          <span>{renderInline(line.slice(2))}</span>
        </div>
      );
      i++;
      continue;
    }

    // Ordered list: 1.
    const olMatch = line.match(/^(\d+)\. /);
    if (olMatch) {
      elements.push(
        <div key={key++} style={{ display: "flex", gap: "6px", margin: "2px 0", paddingLeft: "4px" }}>
          <span style={{ color: "var(--accent)", flexShrink: 0, fontFamily: "var(--font-mono)", fontSize: "12px" }}>
            {olMatch[1]}.
          </span>
          <span>{renderInline(line.slice(olMatch[0].length))}</span>
        </div>
      );
      i++;
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      elements.push(
        <hr key={key++} style={{ border: "none", borderTop: "1px solid var(--border-subtle)", margin: "10px 0" }} />
      );
      i++;
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      elements.push(<div key={key++} style={{ height: "6px" }} />);
      i++;
      continue;
    }

    // Default: paragraph
    elements.push(
      <p key={key++} style={{ margin: "3px 0", lineHeight: "1.6" }}>
        {renderInline(line)}
      </p>
    );
    i++;
  }

  return <div>{elements}</div>;
}

// ── Lightweight Syntax Highlighting ──────────
// Highlights keywords for common languages without
// any external dependency.

const KEYWORD_SETS: Record<string, { keywords: string[]; builtins: string[]; color: { keyword: string; builtin: string; string: string; comment: string; number: string } }> = {
  typescript: {
    keywords: ["const", "let", "var", "function", "return", "if", "else", "for", "while", "class", "interface", "type", "export", "import", "from", "async", "await", "new", "this", "try", "catch", "throw", "switch", "case", "default", "break", "continue", "extends", "implements", "enum", "readonly", "private", "public", "protected", "static", "abstract", "as", "typeof", "instanceof", "in", "of", "yield", "void", "null", "undefined", "true", "false", "do"],
    builtins: ["console", "Promise", "Array", "Object", "String", "Number", "Boolean", "Map", "Set", "Error", "JSON", "Math", "Date", "RegExp", "setTimeout", "setInterval", "fetch"],
    color: { keyword: "#c084fc", builtin: "#60a5fa", string: "#4ade80", comment: "#555570", number: "#fbbf24" },
  },
  javascript: {
    keywords: ["const", "let", "var", "function", "return", "if", "else", "for", "while", "class", "export", "import", "from", "async", "await", "new", "this", "try", "catch", "throw", "switch", "case", "default", "break", "continue", "extends", "typeof", "instanceof", "in", "of", "yield", "void", "null", "undefined", "true", "false", "do"],
    builtins: ["console", "Promise", "Array", "Object", "String", "Number", "Boolean", "Map", "Set", "Error", "JSON", "Math", "Date", "fetch", "document", "window"],
    color: { keyword: "#c084fc", builtin: "#60a5fa", string: "#4ade80", comment: "#555570", number: "#fbbf24" },
  },
  python: {
    keywords: ["def", "class", "return", "if", "elif", "else", "for", "while", "import", "from", "as", "try", "except", "finally", "raise", "with", "yield", "lambda", "pass", "break", "continue", "and", "or", "not", "in", "is", "True", "False", "None", "async", "await", "global", "nonlocal"],
    builtins: ["print", "len", "range", "int", "str", "float", "list", "dict", "set", "tuple", "type", "isinstance", "enumerate", "zip", "map", "filter", "open", "super", "self"],
    color: { keyword: "#c084fc", builtin: "#60a5fa", string: "#4ade80", comment: "#555570", number: "#fbbf24" },
  },
  rust: {
    keywords: ["fn", "let", "mut", "const", "if", "else", "match", "for", "while", "loop", "return", "struct", "enum", "impl", "trait", "pub", "mod", "use", "crate", "self", "super", "async", "await", "move", "ref", "where", "type", "unsafe", "extern", "true", "false", "as", "in", "dyn", "static", "macro_rules"],
    builtins: ["println", "eprintln", "format", "vec", "String", "Vec", "Option", "Result", "Box", "Rc", "Arc", "HashMap", "Ok", "Err", "Some", "None", "Self"],
    color: { keyword: "#c084fc", builtin: "#60a5fa", string: "#4ade80", comment: "#555570", number: "#fbbf24" },
  },
  bash: {
    keywords: ["if", "then", "else", "elif", "fi", "for", "while", "do", "done", "case", "esac", "function", "return", "exit", "export", "source", "local", "readonly", "declare", "unset", "shift", "in"],
    builtins: ["echo", "cd", "ls", "cat", "grep", "sed", "awk", "find", "mkdir", "rm", "mv", "cp", "chmod", "chown", "curl", "wget", "git", "npm", "pnpm", "yarn", "cargo", "pip", "brew"],
    color: { keyword: "#c084fc", builtin: "#22d3ee", string: "#4ade80", comment: "#555570", number: "#fbbf24" },
  },
};

// Aliases
KEYWORD_SETS["ts"] = KEYWORD_SETS["typescript"];
KEYWORD_SETS["tsx"] = KEYWORD_SETS["typescript"];
KEYWORD_SETS["js"] = KEYWORD_SETS["javascript"];
KEYWORD_SETS["jsx"] = KEYWORD_SETS["javascript"];
KEYWORD_SETS["py"] = KEYWORD_SETS["python"];
KEYWORD_SETS["rs"] = KEYWORD_SETS["rust"];
KEYWORD_SETS["sh"] = KEYWORD_SETS["bash"];
KEYWORD_SETS["shell"] = KEYWORD_SETS["bash"];
KEYWORD_SETS["zsh"] = KEYWORD_SETS["bash"];

function SyntaxHighlight({ code, language }: { code: string; language: string }) {
  const langConfig = KEYWORD_SETS[language.toLowerCase()];
  if (!langConfig) {
    // No highlighting — just return raw code
    return <>{code}</>;
  }

  const { keywords, builtins, color } = langConfig;
  const lines = code.split("\n");

  return (
    <>
      {lines.map((line, lineIdx) => (
        <span key={lineIdx}>
          {highlightLine(line, keywords, builtins, color)}
          {lineIdx < lines.length - 1 ? "\n" : ""}
        </span>
      ))}
    </>
  );
}

function highlightLine(
  line: string,
  keywords: string[],
  builtins: string[],
  colors: { keyword: string; builtin: string; string: string; comment: string; number: string }
): ReactNode[] {
  const parts: ReactNode[] = [];
  let remaining = line;
  let key = 0;

  // Check for line comment
  const commentIdx = remaining.indexOf("//");
  const hashComment = remaining.match(/^(\s*)#(?!!)/) ? remaining.indexOf("#") : -1;
  const effectiveComment = commentIdx >= 0 ? commentIdx : hashComment;

  if (effectiveComment >= 0) {
    // Process before comment
    if (effectiveComment > 0) {
      parts.push(...tokenizeLine(remaining.slice(0, effectiveComment), keywords, builtins, colors));
    }
    parts.push(
      <span key={`comment-${key++}`} style={{ color: colors.comment, fontStyle: "italic" }}>
        {remaining.slice(effectiveComment)}
      </span>
    );
    return parts;
  }

  return tokenizeLine(remaining, keywords, builtins, colors);
}

function tokenizeLine(
  line: string,
  keywords: string[],
  builtins: string[],
  colors: { keyword: string; builtin: string; string: string; comment: string; number: string }
): ReactNode[] {
  const parts: ReactNode[] = [];
  // Split by word boundaries, preserving delimiters
  const tokens = line.split(/(\b|\s+|[^\w\s])/g).filter(Boolean);
  let key = 0;

  let inString: string | null = null;
  let stringBuffer = "";

  for (const token of tokens) {
    // String handling
    if (inString) {
      stringBuffer += token;
      if (token === inString) {
        parts.push(
          <span key={key++} style={{ color: colors.string }}>
            {stringBuffer}
          </span>
        );
        inString = null;
        stringBuffer = "";
      }
      continue;
    }

    if (token === '"' || token === "'" || token === "`") {
      inString = token;
      stringBuffer = token;
      continue;
    }

    // Keywords
    if (keywords.includes(token)) {
      parts.push(
        <span key={key++} style={{ color: colors.keyword, fontWeight: 600 }}>
          {token}
        </span>
      );
      continue;
    }

    // Builtins
    if (builtins.includes(token)) {
      parts.push(
        <span key={key++} style={{ color: colors.builtin }}>
          {token}
        </span>
      );
      continue;
    }

    // Numbers
    if (/^\d+(\.\d+)?$/.test(token)) {
      parts.push(
        <span key={key++} style={{ color: colors.number }}>
          {token}
        </span>
      );
      continue;
    }

    // Default
    parts.push(token);
  }

  // Flush unclosed string
  if (stringBuffer) {
    parts.push(
      <span key={key++} style={{ color: colors.string }}>
        {stringBuffer}
      </span>
    );
  }

  return parts;
}
