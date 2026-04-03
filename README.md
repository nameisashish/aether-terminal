# Aether Terminal

<p align="center">
  <strong>🌀 The AI-Native Terminal Built for Engineers Who Ship</strong>
</p>

<p align="center">
  <em>8 specialized AI agents. Real PTY. Human-in-the-loop. Cross-platform.</em>
  <br />
  Built with Tauri v2 · React 19 · xterm.js · LangChain.js
</p>

---

## Why Aether Terminal?

Aether Terminal is designed by engineers, for engineers. Whether you're a Staff+ engineer who needs a keyboard-first, zero-friction workflow with full terminal control — or a junior developer who wants AI guidance without leaving the terminal — Aether adapts to your level.

**For Senior/Staff+ Engineers:**
- Real PTY with full vim/tmux/ssh compatibility — not a pseudo-terminal
- Keyboard-first: `Enter` to approve, `Esc` to reject, `Shift+Enter` for multiline
- No hand-holding: concise, production-grade AI responses by default
- Fully configurable: swap providers, tweak temperature, disable streaming
- Human-in-the-loop: every destructive action requires explicit approval with risk levels

**For Junior Engineers:**
- Quick-start prompt buttons to get started immediately
- Clear help text and keyboard shortcut hints throughout the UI
- Agent explanations include "why" alongside "what"
- Guided API key setup with security context
- Approval dialogs explain what's about to happen in plain language

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Real PTY** | Full pseudoterminal — ANSI colors, vim, tmux, mouse events, native shell |
| **Multi-Provider AI** | Groq (default), OpenAI, Anthropic, Google Gemini, xAI Grok |
| **8-Agent Team** | Supervisor, Architect, Coder, Reviewer, Tester, QA, Documenter, Deployer |
| **Human-in-the-Loop** | Risk-graded approval dialogs for file writes and shell commands |
| **File Explorer** | Sidebar file tree with AI context selection |
| **Multi-Tab** | GPU-accelerated (WebGL) terminal tabs |
| **Cross-Platform** | macOS, Windows, Linux via Tauri v2 native builds |
| **Keyboard-First** | Enter/Esc approvals, ⌘T new tab, Escape to close panels |

## 🏗️ Architecture

```
aether-terminal/
├── src-tauri/                    # Rust backend (Tauri v2)
│   ├── src/
│   │   ├── lib.rs                # Plugin registration, IPC handlers
│   │   ├── main.rs               # App entry point
│   │   └── pty.rs                # PTY session manager (portable-pty)
│   ├── capabilities/default.json # Security permissions
│   ├── Cargo.toml                # Rust dependencies
│   └── tauri.conf.json           # App config, window, bundler
│
├── src/                          # React frontend
│   ├── components/
│   │   ├── terminal/             # xterm.js Terminal + TerminalTabs
│   │   ├── ai/                   # AiChatPanel (streaming chat)
│   │   ├── agents/               # AgentDashboard + ApprovalDialog
│   │   ├── explorer/             # FileExplorer + FileNode
│   │   ├── settings/             # SettingsPanel + ApiKeyManager
│   │   └── layout/               # MainLayout, TitleBar, StatusBar
│   ├── stores/                   # Zustand state (terminal, ai, agent, file)
│   ├── hooks/                    # usePty (PTY ↔ xterm bridge)
│   └── lib/
│       ├── llm/                  # Multi-provider client, types, streaming
│       └── agents/               # Agent graph, tools, type definitions
│
├── landing/                      # Static landing page
└── README.md
```

## 🚀 Quick Start

### Prerequisites

| Requirement | Version | Install |
|-------------|---------|---------|
| **Node.js** | ≥ 18 | [nodejs.org](https://nodejs.org) |
| **pnpm** | ≥ 8 | `npm i -g pnpm` |
| **Rust** | ≥ 1.70 | [rustup.rs](https://rustup.rs) |
| **Tauri v2 deps** | latest | [Prerequisites](https://v2.tauri.app/start/prerequisites/) |

### Install & Run

```bash
# Install dependencies
pnpm install

# Start dev server (frontend + Rust backend + native window)
pnpm tauri dev
```

### Frontend-Only Development

```bash
# No PTY/Tauri features, just the React UI
pnpm dev
```

## 🏭 Production Builds

| Platform | Command | Output |
|----------|---------|--------|
| **macOS** | `pnpm tauri build` | `src-tauri/target/release/bundle/dmg/` |
| **Windows** | `pnpm tauri build` | `src-tauri/target/release/bundle/nsis/` |
| **Linux** | `pnpm tauri build` | `src-tauri/target/release/bundle/appimage/` |

## 🔑 API Keys

Keys are stored locally on-device via `tauri-plugin-store`. They never leave your machine except to the respective LLM API.

Configure in **Settings (gear icon) → API Keys**.

| Provider | Default Model | Get Key |
|----------|---------------|---------|
| **Groq** (default) | `llama-3.1-70b-versatile` | [console.groq.com](https://console.groq.com) |
| OpenAI | `gpt-4o-mini` | [platform.openai.com](https://platform.openai.com) |
| Anthropic | `claude-3-5-haiku` | [console.anthropic.com](https://console.anthropic.com) |
| Google Gemini | `gemini-2.0-flash` | [aistudio.google.com](https://aistudio.google.com) |
| xAI | `grok-2-mini` | [x.ai](https://x.ai) |

## 🤖 Multi-Agent System

8 specialized agents orchestrated by a Supervisor. Each agent has a Staff/Principal-level system prompt that explains its rationale alongside its actions.

| Agent | Role | Prompt Level |
|-------|------|--------------|
| 🎯 **Supervisor** | Decomposes tasks, assigns agents, synthesizes results | Staff Engineering Lead |
| 🏗️ **Architect** | System design, architecture, technical planning | Principal Architect |
| 💻 **Coder** | Production-quality code, type-safe, convention-following | Senior Engineer |
| 🔍 **Reviewer** | Security, performance, readability (🔴/🟡/🟢 severity) | Staff Code Reviewer |
| 🧪 **Tester** | Behavior-driven tests, meaningful coverage | Senior QA Engineer |
| ✅ **QA Validator** | Edge cases, error handling, accessibility audit | QA Lead |
| 📝 **Documenter** | Quick Start + Advanced Usage, copy-pasteable examples | Technical Writer |
| 🚀 **Deployer** | Reproducible builds, multi-platform, health checks | Platform Engineer |

### Workflow

1. Describe a task in the Agent Dashboard
2. **Supervisor** creates a plan with agent assignments
3. Agents execute (parallel where possible)
4. Destructive actions trigger approval dialogs with risk levels
5. Supervisor synthesizes a structured summary

### Approval System

Every file write and shell command triggers a human-in-the-loop dialog:
- **Risk badges**: Low (file write), Medium (shell command), High (delete/destructive)
- **Keyboard shortcuts**: `Enter` = approve, `Esc` = reject
- **Full preview**: See the exact command or file content before approving

## 🔒 Security

- **Zero auto-execution**: All destructive actions require explicit approval
- **Local-only key storage**: Keys stored via OS-native secure store
- **CSP configured**: Content Security Policy in Tauri config
- **No telemetry**: Zero data collection, zero phone-home
- **Risk-graded approvals**: Visual risk indicators on every action

## 📝 Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop framework | Tauri v2 (Rust) |
| Frontend | React 19 + TypeScript 5.8 + Vite 7 |
| Terminal | xterm.js + WebGL + FitAddon |
| Styling | Tailwind CSS v4 + custom design tokens |
| State | Zustand |
| LLM | LangChain.js (5 providers) |
| Agents | Supervisor-orchestrated multi-agent pattern |
| PTY | portable-pty (Rust, cross-platform) |
| Storage | tauri-plugin-store |
| File System | tauri-plugin-fs |
| Shell | tauri-plugin-shell |

## 🌐 Landing Page

Static HTML at `landing/index.html`. Deploy anywhere:

```bash
# Vercel
cd landing && npx vercel --prod

# Netlify, Cloudflare Pages, GitHub Pages
# Just upload landing/index.html
```

## ⚠️ Known Limitations

- `portable-pty` may have quirks on some Linux window managers
- Tool-use quality depends on the LLM model (Groq Llama 3.1 70B works well)
- WebGL renderer falls back to canvas if GPU unavailable

## 🗺️ Roadmap

- [ ] Split pane terminals (horizontal/vertical)
- [ ] Git integration in status bar
- [ ] SSH session support
- [ ] Custom agent plugin system
- [ ] Conversation history persistence
- [ ] Code diff viewer in approval dialogs
- [ ] Tauri auto-updater
- [ ] Configurable keybindings

## 📄 License

MIT

---

<p align="center">
  <strong>Aether Terminal</strong> — Your entire dev team, inside a terminal. ⚡
</p>
