# Aether Terminal

<p align="center">
  <strong>🌀 The AI-Native Terminal Built for Engineers Who Ship</strong>
</p>

<p align="center">
  <em>8 specialized AI agents · Local AI via Ollama · Real PTY · Human-in-the-loop · Cross-platform</em>
  <br />
  Built with Tauri v2 · React 19 · xterm.js · LangChain.js
</p>

---

## Why Aether Terminal?

Aether Terminal is an **AI-native coding environment** that combines a real terminal, file explorer, and AI chat panel into a single desktop application. It's designed for engineers who want AI assistance without leaving their terminal workflow.

**What makes it different:**
- **Real PTY** — Not a pseudo-terminal. Full vim, tmux, ssh, nano, piping, ANSI color support
- **8 AI Agents** — A specialized team: Supervisor, Architect, Coder, Reviewer, Tester, QA, Documenter, Deployer
- **Tool-calling AI** — The AI can read your files, write code, search codebases, and run commands (with your approval)
- **Human-in-the-loop** — Every destructive action (file writes, shell commands) requires your explicit approval
- **Offline AI** — Run Gemma/Llama models locally via Ollama — zero data leaves your machine
- **Multi-provider** — Groq, OpenAI, Anthropic, Google Gemini, xAI, OpenRouter — switch freely

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Real PTY** | Full pseudoterminal with ANSI colors, vim, tmux, mouse events, native shell |
| **Local AI** | Run models offline with Ollama — free, private, no API key needed |
| **Multi-Provider** | Groq (fast), OpenAI, Anthropic, Google Gemini, xAI Grok, OpenRouter |
| **8-Agent Team** | Supervisor, Architect, Coder, Reviewer, Tester, QA, Documenter, Deployer |
| **Tool-Calling AI** | AI reads files, writes code, searches codebases, runs commands |
| **Human-in-the-Loop** | Every file write and shell command requires your approval |
| **File Explorer** | Sidebar file tree with AI context selection, create/delete files |
| **Code Viewer** | Built-in file viewer with syntax highlighting and line numbers |
| **Markdown Chat** | AI responses render with code blocks, copy buttons, and formatting |
| **Settings Persistence** | API keys and model config saved to localStorage — survives restarts |
| **Multi-Tab Terminal** | GPU-accelerated (WebGL) terminal tabs |
| **Cross-Platform** | macOS, Windows, Linux via Tauri v2 native builds |
| **Keyboard-First** | Enter/Esc approvals, ⌘T new tab, ⌘, settings, Escape to close |

---

## 🚀 Quick Start

### Prerequisites

| Requirement | Version | Install |
|-------------|---------|---------|
| **Node.js** | ≥ 18 | [nodejs.org](https://nodejs.org) |
| **pnpm** | ≥ 8 | `npm i -g pnpm` |
| **Rust** | ≥ 1.70 | [rustup.rs](https://rustup.rs) |
| **Tauri v2 deps** | latest | [Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/) |

### Install & Run

```bash
# Clone the repo
git clone https://github.com/nameisashish/aether-terminal.git
cd aether-terminal

# Install dependencies
pnpm install

# Start the app (frontend + Rust backend + native window)
pnpm tauri dev
```

### Download Pre-Built Binaries

Go to the [Releases page](https://github.com/nameisashish/aether-terminal/releases) and download the latest `.dmg` (macOS), `.msi` (Windows), or `.AppImage` (Linux).

---

## 📖 How to Use

### 1. Terminal

The main area is a **real terminal** powered by xterm.js + a native PTY (pseudo-terminal). It behaves exactly like your default macOS Terminal / Windows Terminal / Linux terminal:

- Type any command: `ls`, `cd`, `git`, `npm`, `python`, `vim`, etc.
- Full color support, cursor movement, and interactive programs
- Press **⌘T** to open a new terminal tab
- Press **⌘W** to close the current tab

### 2. File Explorer (Left Panel)

Click the **folder icon** in the sidebar (or use `File → Open Folder` in the menu bar) to connect a directory:

- **Browse files**: Click folders to expand/collapse. Click files to view them in the code viewer.
- **Right-click**: Create new files, new folders, or connect a different directory.
- **Select files for AI**: Click the checkbox next to files to include them as context when chatting with the AI.
- **Refresh**: Hit the refresh button to reload the file tree after external changes.

### 3. AI Chat (Right Panel)

Click the **✨ sparkle icon** in the sidebar to open the AI chat:

- **Ask questions**: Type a question about your code and press Enter.
- **Quick prompts**: Click one of the 4 preset buttons to get started fast.
- **Code blocks**: AI responses render with syntax-highlighted code blocks and a **Copy** button.
- **Tool activity**: Watch real-time what the AI is doing (reading files, searching, running commands).
- **File context**: Files selected in the explorer are automatically included as context.

### 4. Agent Team Mode

Toggle **"Agent Team"** in the chat header to activate the multi-agent system:

- The **Supervisor** analyzes your request and creates a plan
- Tasks are delegated to specialized agents (Architect, Coder, Reviewer, etc.)
- Each agent has full access to your codebase via tools
- **Approval dialogs** pop up whenever an agent wants to write a file or run a command
- Press **Enter** to approve, **Escape** to reject

### 5. Settings (⌘ ,)

Press **⌘ ,** (Cmd + Comma) to open Settings:

- **API Keys**: Add keys for cloud providers (Groq, OpenAI, Anthropic, etc.)
- **Model**: Select which model to use and adjust temperature/tokens
- **General**: View keyboard shortcuts and links

---

## 🤖 AI Setup Guide

### Option A: Local AI (Free, Offline, Private)

Run AI entirely on your computer using **Ollama**:

```bash
# 1. Install Ollama
brew install ollama        # macOS (Homebrew)
# Or download from https://ollama.com

# 2. Start the Ollama server
ollama serve

# 3. Pull a model (pick one):
ollama pull gemma2:9b      # Google Gemma 2 — excellent quality (5.4GB)
ollama pull llama3.1:8b    # Meta Llama 3.1 — fast and capable (4.7GB)
ollama pull qwen2.5-coder  # Alibaba Qwen — specialized for coding

# 4. Open Aether Terminal
# It auto-detects Ollama and your models!
```

**Important**: Keep `ollama serve` running in a separate terminal window while using Aether.

### Option B: Groq (Free Tier, Ultra-Fast)

1. Go to [console.groq.com](https://console.groq.com) and create a free account
2. Generate an API key
3. In Aether Terminal, press **⌘ ,** → **API Keys** → click **Add Key** next to Groq
4. Paste your key and press **Enter** (or click the ✓ button)
5. The model automatically switches to Groq's `llama-3.3-70b-versatile`

### Option C: Other Providers

| Provider | Get Key | Models |
|----------|---------|--------|
| **OpenAI** | [platform.openai.com](https://platform.openai.com) | GPT-4o, GPT-4o-mini |
| **Anthropic** | [console.anthropic.com](https://console.anthropic.com) | Claude Sonnet 4, Claude 3 Opus |
| **Google Gemini** | [ai.google.dev](https://ai.google.dev) | Gemini 2.0 Flash, Gemini 1.5 Pro |
| **xAI** | [console.x.ai](https://console.x.ai) | Grok-2, Grok-2 Mini |
| **OpenRouter** | [openrouter.ai](https://openrouter.ai) | 100+ models via single key |

---

## 🎯 8-Agent System

When you toggle **Agent Team** mode, your request is handled by a team of 8 specialized AI agents:

| Agent | Role | When Used |
|-------|------|-----------|
| 🎯 **Supervisor** | Orchestrates tasks, creates plans, delegates work | Every request |
| 🏗️ **Architect** | Designs system architecture, analyzes dependencies | Ambiguous problems, structural changes |
| 💻 **Coder** | Writes and modifies production code | All code changes |
| 🔍 **Reviewer** | Reviews code quality, finds bugs, suggests improvements | After any code change |
| 🧪 **Tester** | Creates and runs tests, validates functionality | After code changes, bug fixes |
| ✅ **QA Validator** | Validates quality, checks edge cases | Critical or risky changes |
| 📝 **Documenter** | Writes documentation, READMEs, API docs | When APIs or setup changes |
| 🚀 **Deployer** | Handles build configs, CI/CD, deployment | Build/deploy flow changes |

**Example workflow:**
1. You ask: *"Add a dark mode toggle to the settings page"*
2. **Supervisor** creates plan: Architect → Coder → Reviewer → Tester
3. **Architect** analyzes existing code structure
4. **Coder** writes the toggle component and theme logic
5. **Reviewer** checks code quality and patterns
6. **Tester** writes a test for the new feature

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| **⌘ T** | New terminal tab |
| **⌘ W** | Close current tab |
| **⌘ ,** | Open Settings |
| **Enter** | Approve agent action / Send message |
| **Escape** | Reject agent action / Close panel |
| **Shift + Enter** | Newline in chat input |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│                  Aether Terminal                 │
├──────────┬──────────────────┬───────────────────┤
│  File    │    Terminal      │    AI Chat        │
│ Explorer │  (xterm.js +    │  (LangChain +     │
│ (React)  │   WebGL PTY)    │   Tool Calling)   │
├──────────┴──────────────────┴───────────────────┤
│            Zustand State Management             │
│  aiStore · fileStore · terminalStore · agents   │
├─────────────────────────────────────────────────┤
│          Tauri v2 (Rust Backend)                │
│   Native menus · PTY spawn · File system APIs   │
│        tauri-plugin-fs · tauri-plugin-shell      │
└─────────────────────────────────────────────────┘
```

**Key stores:**
- `aiStore.ts` — LLM config, API keys, chat messages, tool-calling loop
- `fileStore.ts` — File tree, selected files for AI context
- `workspaceStore.ts` — Active project root, open file viewer
- `agentStore.ts` — Multi-agent task execution, approval queue
- `terminalStore.ts` — Terminal tabs, active tab tracking

---

## 🔧 Troubleshooting

### "model 'gemma4:e4b' not found"
The default config references a model that may not exist on your machine. On startup, Aether auto-detects your Ollama models. If you still see this error:
1. Open Settings (⌘ ,) 
2. Scroll to the **Model** dropdown
3. Select the model you actually have installed (e.g., `gemma2:9b`)

### "Ollama is not running"
Make sure you ran `ollama serve` in a separate terminal window. Ollama must be running in the background for local AI to work.

### AI keeps saying "I'm just a chatbot"
This means the tool-calling loop isn't engaging. Try:
1. Make sure you have a directory connected via File Explorer
2. Ask a specific question about your code (e.g., "What files are in this project?")
3. The AI needs workspace context to activate its tools

### API key not saving
When you paste an API key in Settings, you must press **Enter** or click the **✓ button** to save it. Just clicking away discards the key.

### Build errors
```bash
# Clear Rust build cache
cargo clean

# Reinstall dependencies
rm -rf node_modules && pnpm install

# Rebuild
pnpm tauri dev
```

---

## 🛠️ Development

### Project Structure

```
src/
├── components/
│   ├── ai/         # AI chat panel + markdown renderer
│   ├── agents/     # Agent dashboard + approval dialog
│   ├── explorer/   # File explorer + file viewer
│   ├── layout/     # Main layout, title bar, status bar
│   ├── settings/   # Settings panel + API key manager
│   └── terminal/   # Terminal component + tabs
├── hooks/          # usePty hook for PTY management
├── lib/
│   ├── agents/     # LangGraph multi-agent system
│   ├── llm/        # Multi-provider LLM integration
│   └── syntax/     # Lightweight syntax highlighter
├── stores/         # Zustand state management
└── index.css       # Design system + CSS variables
src-tauri/
├── src/lib.rs      # Rust backend entry point
└── Cargo.toml      # Rust dependencies
```

### Building for Production

```bash
# Build optimized native binaries
pnpm tauri build
```

### Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Commit your changes: `git commit -m "feat: add my feature"`
4. Push to your fork: `git push origin feat/my-feature`
5. Open a Pull Request

---

## 📄 License

MIT © [Ashish Kishore](https://github.com/nameisashish)
