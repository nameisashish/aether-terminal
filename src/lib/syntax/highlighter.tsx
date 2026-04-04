// ==========================================
// Syntax Highlighter Utility
// Shared lightweight syntax highlighting for
// both the Markdown code blocks and FileViewer.
// No external dependencies.
// ==========================================

import type { ReactNode } from "react";

// ── Language Keyword Configuration ──────────

interface LangConfig {
  keywords: string[];
  builtins: string[];
  colors: {
    keyword: string;
    builtin: string;
    string: string;
    comment: string;
    number: string;
    type: string;
  };
  commentPrefix?: string; // default "//"
}

const LANG_CONFIGS: Record<string, LangConfig> = {
  typescript: {
    keywords: [
      "const", "let", "var", "function", "return", "if", "else", "for", "while",
      "class", "interface", "type", "export", "import", "from", "async", "await",
      "new", "this", "try", "catch", "throw", "switch", "case", "default", "break",
      "continue", "extends", "implements", "enum", "readonly", "private", "public",
      "protected", "static", "abstract", "as", "typeof", "instanceof", "in", "of",
      "yield", "void", "null", "undefined", "true", "false", "do", "delete"
    ],
    builtins: [
      "console", "Promise", "Array", "Object", "String", "Number", "Boolean",
      "Map", "Set", "Error", "JSON", "Math", "Date", "RegExp", "setTimeout",
      "setInterval", "fetch", "Response", "Request", "URL", "Buffer",
      "Record", "Partial", "Required", "Readonly", "Pick", "Omit"
    ],
    colors: {
      keyword: "#c084fc",
      builtin: "#60a5fa",
      string: "#4ade80",
      comment: "#555570",
      number: "#fbbf24",
      type: "#22d3ee",
    },
  },
  python: {
    keywords: [
      "def", "class", "return", "if", "elif", "else", "for", "while", "import",
      "from", "as", "try", "except", "finally", "raise", "with", "yield", "lambda",
      "pass", "break", "continue", "and", "or", "not", "in", "is", "True", "False",
      "None", "async", "await", "global", "nonlocal", "del", "assert"
    ],
    builtins: [
      "print", "len", "range", "int", "str", "float", "list", "dict", "set",
      "tuple", "type", "isinstance", "enumerate", "zip", "map", "filter",
      "open", "super", "self", "input", "sorted", "reversed", "any", "all",
      "min", "max", "sum", "abs", "hasattr", "getattr", "setattr"
    ],
    colors: {
      keyword: "#c084fc",
      builtin: "#60a5fa",
      string: "#4ade80",
      comment: "#555570",
      number: "#fbbf24",
      type: "#22d3ee",
    },
    commentPrefix: "#",
  },
  rust: {
    keywords: [
      "fn", "let", "mut", "const", "if", "else", "match", "for", "while", "loop",
      "return", "struct", "enum", "impl", "trait", "pub", "mod", "use", "crate",
      "self", "super", "async", "await", "move", "ref", "where", "type", "unsafe",
      "extern", "true", "false", "as", "in", "dyn", "static", "macro_rules"
    ],
    builtins: [
      "println", "eprintln", "format", "vec", "String", "Vec", "Option", "Result",
      "Box", "Rc", "Arc", "HashMap", "Ok", "Err", "Some", "None", "Self",
      "Clone", "Debug", "Display", "Default", "Iterator", "From", "Into"
    ],
    colors: {
      keyword: "#c084fc",
      builtin: "#60a5fa",
      string: "#4ade80",
      comment: "#555570",
      number: "#fbbf24",
      type: "#22d3ee",
    },
  },
  go: {
    keywords: [
      "func", "return", "if", "else", "for", "range", "switch", "case", "default",
      "break", "continue", "var", "const", "type", "struct", "interface", "map",
      "chan", "go", "defer", "select", "package", "import", "true", "false", "nil"
    ],
    builtins: [
      "fmt", "Println", "Printf", "Sprintf", "error", "string", "int", "int64",
      "float64", "bool", "byte", "make", "append", "len", "cap", "new", "panic",
      "recover", "close", "delete", "copy"
    ],
    colors: {
      keyword: "#c084fc",
      builtin: "#60a5fa",
      string: "#4ade80",
      comment: "#555570",
      number: "#fbbf24",
      type: "#22d3ee",
    },
  },
  bash: {
    keywords: [
      "if", "then", "else", "elif", "fi", "for", "while", "do", "done", "case",
      "esac", "function", "return", "exit", "export", "source", "local", "readonly",
      "declare", "unset", "shift", "in", "select", "until"
    ],
    builtins: [
      "echo", "cd", "ls", "cat", "grep", "sed", "awk", "find", "mkdir", "rm",
      "mv", "cp", "chmod", "chown", "curl", "wget", "git", "npm", "pnpm", "yarn",
      "cargo", "pip", "brew", "sudo", "apt", "yum", "docker", "ssh", "tar", "gzip"
    ],
    colors: {
      keyword: "#c084fc",
      builtin: "#22d3ee",
      string: "#4ade80",
      comment: "#555570",
      number: "#fbbf24",
      type: "#60a5fa",
    },
    commentPrefix: "#",
  },
  json: {
    keywords: ["true", "false", "null"],
    builtins: [],
    colors: {
      keyword: "#c084fc",
      builtin: "#60a5fa",
      string: "#4ade80",
      comment: "#555570",
      number: "#fbbf24",
      type: "#22d3ee",
    },
  },
  html: {
    keywords: [
      "html", "head", "body", "div", "span", "p", "a", "img", "ul", "ol", "li",
      "h1", "h2", "h3", "h4", "h5", "h6", "table", "tr", "td", "th", "form",
      "input", "button", "script", "style", "link", "meta", "title", "section",
      "header", "footer", "nav", "main", "article", "aside"
    ],
    builtins: [
      "class", "id", "href", "src", "alt", "type", "value", "name", "placeholder",
      "style", "onclick", "onchange", "disabled", "readonly", "required"
    ],
    colors: {
      keyword: "#f87171",
      builtin: "#60a5fa",
      string: "#4ade80",
      comment: "#555570",
      number: "#fbbf24",
      type: "#22d3ee",
    },
  },
  css: {
    keywords: [
      "display", "position", "width", "height", "margin", "padding", "color",
      "background", "border", "font", "flex", "grid", "gap", "align", "justify",
      "overflow", "opacity", "transition", "transform", "animation", "z-index",
      "top", "left", "right", "bottom", "none", "auto", "inherit", "initial"
    ],
    builtins: [
      "px", "rem", "em", "vh", "vw", "calc", "var", "rgb", "rgba", "hsl",
      "hsla", "linear-gradient", "radial-gradient", "url", "important"
    ],
    colors: {
      keyword: "#c084fc",
      builtin: "#60a5fa",
      string: "#4ade80",
      comment: "#555570",
      number: "#fbbf24",
      type: "#22d3ee",
    },
  },
  yaml: {
    keywords: ["true", "false", "null", "yes", "no", "on", "off"],
    builtins: [],
    colors: {
      keyword: "#c084fc",
      builtin: "#60a5fa",
      string: "#4ade80",
      comment: "#555570",
      number: "#fbbf24",
      type: "#22d3ee",
    },
    commentPrefix: "#",
  },
  sql: {
    keywords: [
      "SELECT", "FROM", "WHERE", "INSERT", "UPDATE", "DELETE", "CREATE", "DROP",
      "ALTER", "TABLE", "INDEX", "JOIN", "LEFT", "RIGHT", "INNER", "OUTER",
      "ON", "AND", "OR", "NOT", "IN", "IS", "NULL", "AS", "ORDER", "BY",
      "GROUP", "HAVING", "LIMIT", "OFFSET", "UNION", "INTO", "VALUES", "SET",
      "DISTINCT", "COUNT", "SUM", "AVG", "MIN", "MAX", "LIKE", "BETWEEN",
      "EXISTS", "CASE", "WHEN", "THEN", "ELSE", "END", "PRIMARY", "KEY",
      "FOREIGN", "REFERENCES", "CONSTRAINT", "DEFAULT", "CASCADE", "ASC", "DESC"
    ],
    builtins: [],
    colors: {
      keyword: "#c084fc",
      builtin: "#60a5fa",
      string: "#4ade80",
      comment: "#555570",
      number: "#fbbf24",
      type: "#22d3ee",
    },
  },
};

// ── Aliases ──
const ALIASES: Record<string, string> = {
  ts: "typescript", tsx: "typescript", js: "typescript", jsx: "typescript",
  py: "python", rs: "rust", sh: "bash", shell: "bash", zsh: "bash",
  yml: "yaml", toml: "yaml", md: "yaml", markdown: "yaml", dockerfile: "bash",
  sql: "sql", mysql: "sql", postgresql: "sql", sqlite: "sql",
};

/** Get the language config, resolving aliases */
function getConfig(language: string | null | undefined): LangConfig | null {
  if (!language) return null;
  const lang = language.toLowerCase();
  return LANG_CONFIGS[lang] || LANG_CONFIGS[ALIASES[lang]] || null;
}

/** Highlight a single line of code — returns ReactNode[] */
export function highlightLine(
  line: string,
  language: string | null | undefined
): ReactNode[] {
  const config = getConfig(language);
  if (!config) return [line];

  const { keywords, builtins, colors, commentPrefix } = config;
  const parts: ReactNode[] = [];
  let remaining = line;
  let key = 0;

  // 1. Check for line comment
  const cPrefix = commentPrefix || "//";
  const commentIdx = remaining.indexOf(cPrefix);
  if (commentIdx >= 0) {
    // Everything before the comment
    if (commentIdx > 0) {
      parts.push(...tokenize(remaining.slice(0, commentIdx), keywords, builtins, colors));
    }
    parts.push(
      <span key={`cmt-${key}`} style={{ color: colors.comment, fontStyle: "italic" }}>
        {remaining.slice(commentIdx)}
      </span>
    );
    return parts;
  }

  return tokenize(remaining, keywords, builtins, colors);
}

function tokenize(
  text: string,
  keywords: string[],
  builtins: string[],
  colors: LangConfig["colors"]
): ReactNode[] {
  const parts: ReactNode[] = [];
  const tokens = text.split(/(\b)/g);
  let key = 0;
  let inString: string | null = null;
  let stringBuffer = "";

  for (const token of tokens) {
    if (inString) {
      stringBuffer += token;
      if (token.endsWith(inString) && !token.endsWith("\\" + inString)) {
        parts.push(
          <span key={key++} style={{ color: colors.string }}>{stringBuffer}</span>
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

    if (keywords.includes(token)) {
      parts.push(
        <span key={key++} style={{ color: colors.keyword, fontWeight: 600 }}>{token}</span>
      );
      continue;
    }

    if (builtins.includes(token)) {
      parts.push(
        <span key={key++} style={{ color: colors.builtin }}>{token}</span>
      );
      continue;
    }

    if (/^\d+(\.\d+)?$/.test(token)) {
      parts.push(
        <span key={key++} style={{ color: colors.number }}>{token}</span>
      );
      continue;
    }

    // Type-like tokens (PascalCase)
    if (/^[A-Z][a-zA-Z0-9]+$/.test(token) && !keywords.includes(token)) {
      parts.push(
        <span key={key++} style={{ color: colors.type }}>{token}</span>
      );
      continue;
    }

    parts.push(token);
  }

  if (stringBuffer) {
    parts.push(
      <span key={key++} style={{ color: colors.string }}>{stringBuffer}</span>
    );
  }

  return parts;
}

/** Check if a language has syntax highlighting support */
export function hasHighlighting(language: string | null | undefined): boolean {
  return getConfig(language) !== null;
}
