# Aether Terminal

<p align="center">
  <strong>🌀 The AI-Native Terminal Built for Engineers Who Ship</strong>
</p>

<p align="center">
  <em>8 specialized AI agents · Gemma 4 local AI · Real PTY · Human-in-the-loop · Cross-platform</em>
  <br />
  Built with Tauri v2 · React 19 · xterm.js · LangChain.js · Ollama
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
- **Local AI: Run Gemma 4 offline via Ollama — zero data leaves your machine**

**For Junior Engineers:**
- Quick-start prompt buttons to get started immediately
- Clear help text and keyboard shortcut hints throughout the UI
- Agent explanations include "why" alongside "what"
- Guided API key setup with security context
- Approval dialogs explain what's about to happen in plain language
- **One-click setup: Ollama + Gemma 4 = free AI, no API key needed**

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Real PTY** | Full pseudoterminal — ANSI colors, vim, tmux, mouse events, native shell |
| **Local AI (Gemma 4)** | Run AI completely offline with Ollama — free, private, no API key |
| **Multi-Provider AI** | Groq (fast), OpenAI, Anthropic, Google Gemini, xAI Grok, OpenRouter |
| **8-Agent Team** | Supervisor, Architect, Coder, Reviewer, Tester, QA, Documenter, Deployer |
| **Human-in-the-Loop** | Risk-graded approval dialogs for file writes and shell commands |
| **File Explorer** | Sidebar file tree with AI context selection |
| **File Viewer** | Built-in code viewer tab showing file contents |
| **Multi-Tab** | GPU-accelerated (WebGL) terminal tabs |
| **Cross-Platform** | macOS, Windows, Linux via Tauri v2 native builds |
| **Keyboard-First** | Enter/Esc approvals, ⌘T new tab, Escape to close panels |

---

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

---

## 🤖 Running Gemma 4 Locally (Free AI, No API Key)

Aether Terminal uses **Gemma 4** (by Google) as the default local AI model, running through **Ollama**.

### Step 1: Install Ollama

**macOS:**
```bash
brew install ollama
```

**Windows:**
Download from [ollama.com/download](https://ollama.com/download)

**Linux:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

### Step 2: Start Ollama

```bash
ollama serve
```

> Ollama runs in the background on `localhost:11434`. Leave this terminal open.

### Step 3: Pull Gemma 4

```bash
# Recommended default — excellent balance of speed + quality
ollama pull gemma4:e4b

# Lightweight — best for laptops with 8-16GB RAM
ollama pull gemma4:e2b

# Higher quality — needs a dedicated GPU
ollama pull gemma4:26b

# Highest quality — needs 24GB+ VRAM (RTX 3090/4090 or Mac M-series 48GB+)
ollama pull gemma4:31b
```

### Step 4: Use in Aether Terminal

1. Open Aether Terminal
2. Go to **Settings → API Keys**
3. The **Local (Gemma 4)** section shows the Ollama connection status
4. If status shows "Running" — you're ready to chat!
5. The model selector auto-detects all models you've pulled in Ollama

### Fallback Behavior

**Automatic:** If Ollama is not running when you send a message, Aether automatically switches to **Groq** (if you have a Groq API key configured). You'll see a `[Ollama offline — using Groq as fallback]` notice.

**Manual:** You can also switch to any cloud provider anytime in Settings:
- **Groq** (recommended fallback — free tier, ultra-fast)
- OpenAI, Anthropic, Gemini, xAI, or OpenRouter

---

## 📥 Installation (Bypassing Security Warnings)

Since Aether Terminal is open-source and free, we don't pay for code signing certificates. Your OS may show a security warning on first launch. **This is normal for unsigned apps.** Here's how to bypass it:

### macOS: "Aether Terminal Not Opened" Fix

macOS Gatekeeper shows: *"Apple could not verify 'Aether Terminal' is free of malware..."*

**Method 1 — Right-Click Open (easiest):**
1. Find **Aether Terminal** in your Applications folder
2. **Right-click** (or Control-click) the app icon
3. Select **"Open"** from the context menu
4. Click **"Open"** in the dialog that appears
5. ✅ Done — the app will open normally from now on

**Method 2 — Terminal Command (if right-click doesn't work):**
```bash
# Remove the quarantine attribute
xattr -cr /Applications/Aether\ Terminal.app

# Then open normally
open /Applications/Aether\ Terminal.app
```

**Method 3 — System Settings:**
1. Try to open the app (it will be blocked)
2. Go to **System Settings → Privacy & Security**
3. Scroll down — you'll see *"Aether Terminal was blocked"*
4. Click **"Open Anyway"**

### Windows: SmartScreen "Windows Protected Your PC" Fix

**Method 1 — Run Anyway (easiest):**
1. Run the `.exe` installer
2. SmartScreen shows *"Windows protected your PC"*
3. Click **"More info"** (this reveals the Run button)
4. Click **"Run anyway"**
5. ✅ Done — follow the installer prompts

**Method 2 — Unblock via Properties:**
1. Right-click the downloaded `.exe` file
2. Select **Properties**
3. At the bottom, check **"Unblock"**
4. Click **Apply**, then run the installer

### Linux

No warnings. Linux doesn't have the same gatekeeper restrictions:

```bash
# AppImage
chmod +x Aether.Terminal_*.AppImage && ./Aether.Terminal_*.AppImage

# Debian/Ubuntu
sudo dpkg -i Aether.Terminal_*.deb
```

### Why These Warnings Happen

Code signing certificates cost **$99-299/year** (Apple) and **$200-500+/year** (Windows/EV certificate). As a free, open-source project, we don't pay for these. The app is 100% safe — you can [review the source code](https://github.com/nameisashish/aether-terminal) yourself.

---

## 🏭 Production Builds

| Platform | Command | Output |
|----------|---------|--------|
| **macOS** | `pnpm tauri build` | `src-tauri/target/release/bundle/dmg/` |
| **Windows** | `pnpm tauri build` | `src-tauri/target/release/bundle/nsis/` |
| **Linux** | `pnpm tauri build` | `src-tauri/target/release/bundle/appimage/` |

---

## 🔑 API Keys

Keys are stored locally on-device via `tauri-plugin-store`. They never leave your machine except to the respective LLM API.

Configure in **Settings (gear icon) → API Keys**.

| Provider | Type | Default Model | Get Key |
|----------|------|---------------|---------|
| **Local (Gemma 4)** | Free/Local | `gemma4:e4b` | [Install Ollama](https://ollama.com) — no key needed |
| **Groq** (recommended cloud) | Free tier | `llama-3.3-70b-versatile` | [console.groq.com](https://console.groq.com) |
| OpenAI | Paid | `gpt-4o-mini` | [platform.openai.com](https://platform.openai.com) |
| Anthropic | Paid | `claude-3-5-haiku` | [console.anthropic.com](https://console.anthropic.com) |
| Google Gemini | Free tier | `gemini-2.0-flash` | [aistudio.google.com](https://aistudio.google.com) |
| xAI | Paid | `grok-2-mini` | [x.ai](https://x.ai) |
| OpenRouter | Varies | `meta-llama/llama-3.1-70b` | [openrouter.ai](https://openrouter.ai) |

---

## 🤖 Multi-Agent System (Confirmed Working)

8 specialized agents orchestrated by a Supervisor. Each agent has a Staff/Principal-level system prompt, a full tool-calling loop (read files → write files → run commands → search → patch), and works with any provider including local Gemma 4.

### The Agent Team

| Agent | Role | Prompt Level |
|-------|------|--------------|
| 🎯 **Supervisor** | Decomposes tasks, assigns agents, synthesizes results | Staff+ Lead (Google/Stripe/SpaceX caliber) |
| 🏗️ **Architect** | System design, architecture, technical planning | Distinguished Architect (Netflix/AWS/Cloudflare caliber) |
| 💻 **Coder** | Production-quality code, type-safe, convention-following | Top 0.1% Staff Engineer (Stripe/Google Brain caliber) |
| 🔍 **Reviewer** | Security, performance, readability (🔴/🟡/🟢 severity) | Staff/Principal Engineer (nuclear-grade reviews) |
| 🧪 **Tester** | Behavior-driven tests, meaningful coverage | Top-tier SDET (launch-critical quality) |
| ✅ **QA Validator** | Edge cases, error handling, accessibility audit | Elite QA (Stripe/Apple/NASA caliber) |
| 📝 **Documenter** | Quick Start + Advanced Usage, copy-pasteable examples | World-class Technical Writer (Stripe API docs caliber) |
| 🚀 **Deployer** | Reproducible builds, multi-platform, health checks | SRE/Platform Engineer (Vercel/Fly.io caliber) |

### Agent Workflow

```
User describes task → Supervisor creates plan → Agents execute (parallel where possible)
     ↓                    ↓                         ↓
  Agent Dashboard    Plan with agent           Tool-calling loops:
  shows live         assignments +             read_file → write_file →
  status for         (parallel) flags          run_command → search_files
  all 8 agents                                       ↓
                                              Human-in-the-loop approvals
                                              (Enter/Esc, risk badges)
                                                     ↓
                                              Supervisor synthesizes
                                              final summary
```

### How to Use the Multi-Agent System

1. Click the **👥 Agents** button in the title bar (or press the Agent Team button)
2. Describe your task in the input: *"Build a REST API with Express and JWT auth"*
3. Watch the **Supervisor** create a plan and assign agents
4. Agents execute with live status updates in the dashboard
5. **Approve or reject** file writes and shell commands via approval dialogs
6. Supervisor provides a final summary of what was accomplished

### Agent Tools

All agents can use these tools (with human approval for writes/commands):

| Tool | Description | Approval Required |
|------|-------------|-------------------|
| `read_file` | Read any file from the filesystem | ❌ No |
| `write_file` | Create or overwrite a file | ✅ Yes |
| `patch_file` | Replace a section of a file (search → replace) | ✅ Yes |
| `run_command` | Execute shell commands (build, test, lint) | ✅ Yes |
| `list_directory` | List files and folders | ❌ No |
| `search_files` | Grep-like search across files | ❌ No |

### Using Gemma 4 with the Multi-Agent System

The agents work seamlessly with Gemma 4 via Ollama. For best results:

- **`gemma4:e4b`** (default): Excellent balance of speed and quality — recommended for most users
- **`gemma4:e2b`**: Lightweight variant, runs on laptops with 8-16GB RAM
- **`gemma4:26b`**: Higher quality for complex multi-file tasks (needs dedicated GPU)
- **`gemma4:31b`**: Highest quality, best for complex architecture tasks (needs 24GB+ VRAM)

If Ollama is not running, Aether auto-falls back to **Groq** (free, ultra-fast cloud). You can also manually switch providers in Settings anytime.

---

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
│       ├── llm/                  # Multi-provider client (7 providers)
│       └── agents/               # Agent graph, tools, type definitions
│
└── README.md
```

---

## 🔒 Security

- **Zero auto-execution**: All destructive actions require explicit approval
- **Local-first AI**: Gemma 4 via Ollama — your data never leaves your machine
- **Local-only key storage**: Keys stored via OS-native secure store
- **CSP configured**: Content Security Policy in Tauri config
- **No telemetry**: Zero data collection, zero phone-home
- **Risk-graded approvals**: Visual risk indicators on every action

---

## 📝 Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop framework | Tauri v2 (Rust) |
| Frontend | React 19 + TypeScript 5.8 + Vite 7 |
| Terminal | xterm.js + WebGL + FitAddon |
| Styling | Tailwind CSS v4 + custom design tokens |
| State | Zustand |
| Local AI | Ollama + Gemma 4 |
| Cloud LLM | LangChain.js (7 providers) |
| Agents | Supervisor-orchestrated 8-agent system |
| PTY | portable-pty (Rust, cross-platform) |
| Storage | tauri-plugin-store |
| File System | tauri-plugin-fs |
| Shell | tauri-plugin-shell |

---

## 🌐 Landing Page

The project landing page lives in the companion repository: [aether-landing](https://github.com/nameisashish/aether-landing).

Deploy anywhere:

```bash
# Vercel
cd aether-landing && npx vercel --prod

# Netlify, Cloudflare Pages, GitHub Pages
# Just upload index.html
```

The landing page includes:
- Installation instructions for macOS, Windows, and Linux
- macOS/Windows bypass guides for unsigned app warnings
- Feature showcase and agent team overview
- Auto-detect user OS and highlight correct download
- Auto-fetch latest release assets from GitHub

---

## ⚠️ Known Limitations

- `portable-pty` may have quirks on some Linux window managers
- Tool-use quality depends on the LLM model (Groq Llama 3.3 70B works best for agents)
- WebGL renderer falls back to canvas if GPU unavailable
- Gemma 4 local inference speed depends on your hardware (GPU recommended)
- The multi-agent system works best with models that support tool/function calling

---

## 🗺️ Roadmap

- [ ] Split pane terminals (horizontal/vertical)
- [ ] Git integration in status bar
- [ ] SSH session support
- [ ] Custom agent plugin system
- [ ] Conversation history persistence
- [ ] Code diff viewer in approval dialogs
- [ ] Tauri auto-updater
- [ ] Configurable keybindings
- [ ] Voice input for AI chat

---

## 📄 License

MIT

---

<p align="center">
  <strong>Aether Terminal</strong> — Your entire dev team, inside a terminal. ⚡
  <br />
  <em>Powered by Gemma 4 · Groq · OpenAI · Anthropic · Gemini · xAI · OpenRouter</em>
</p>
