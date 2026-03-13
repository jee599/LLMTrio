<p align="center">
  <h1 align="center">🐙 LLMTrio</h1>
  <p align="center">
    <strong>Multi-LLM Orchestration Tool</strong><br>
    Run Claude, Codex, and Gemini in parallel — with a real-time dashboard.
  </p>
  <p align="center">
    <a href="https://www.npmjs.com/package/llmtrio"><img src="https://img.shields.io/npm/v/llmtrio?color=blue&label=npm" alt="npm"></a>
    <img src="https://img.shields.io/badge/dependencies-0-green" alt="zero deps">
    <img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen" alt="node 18+">
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT"></a>
  </p>
</p>

---

## Why LLMTrio?

Each LLM has strengths. Claude reasons deeply. Codex writes fast code. Gemini researches broadly. LLMTrio routes each task to the best model — automatically — and runs them in parallel.

One prompt in, production-ready output out.

## Quick Start

```bash
npx llmtrio
```

Or clone and run:

```bash
git clone https://github.com/jee599/LLMTrio.git
cd LLMTrio
./trio
```

The dashboard opens in your browser. Install CLIs, authenticate, and start workflows — all from the UI. No terminal needed after the first command.

## How It Works

```
You → "Build a REST API with auth"
          ↓
    ┌─────────────────────────────────────┐
    │           LLMTrio Engine            │
    │                                     │
    │  Discover → Define → Develop → Deliver
    └──┬──────────┬──────────┬────────────┘
       │          │          │
   Claude 🟠   Codex 🔵   Gemini 🟣
   Architecture  Code       Research
   Code Review   Testing    Documentation
```

1. **Enter a prompt** — LLMTrio breaks it into tasks
2. **Auto-routes** — Each task goes to the best model
3. **Parallel execution** — All agents work simultaneously
4. **Real-time dashboard** — Watch progress, costs, and outputs live

## Default Model Routing

| Task | Agent | Model |
|------|-------|-------|
| Architecture | Claude | Opus 4.6 |
| Code Review | Claude | Opus 4.6 |
| Implementation | Codex | GPT-5.4 |
| Testing | Codex | GPT-5.4 |
| Research | Gemini | 3.1 Pro |
| Documentation | Gemini | 3.1 Pro |

Fully configurable in `.trio/routing.json`.

## Dashboard Features

- **Agent Status** — Live output, current task, health indicators
- **Kanban Board** — Drag-and-drop tasks, priorities, dependencies, search & filter
- **Cost Tracking** — Per-agent and total spend with budget limits
- **Model Routing** — Change which model handles which task type
- **Zero-Terminal Setup** — Install & login CLI tools directly from browser

## CLI Commands

```bash
./trio                        # Open dashboard (default)
./trio start "prompt"         # Start full 4-phase workflow
./trio task claude "prompt"   # Run single agent task
./trio login                  # Check CLI auth status
./trio status                 # Show workflow state
./trio stop                   # Stop all processes
```

## 4-Phase Workflow

| Phase | What Happens |
|-------|-------------|
| **Discover** | Requirements analysis, tech research |
| **Define** | Architecture design, task breakdown |
| **Develop** | Implementation, testing |
| **Deliver** | Code review, documentation |

## Architecture

```
Browser (dashboard.html)
    ↕ SSE + HTTP
Dashboard Server (localhost:3333)
    ↕ fs.watch + JSON
File System (.trio/)  ←→  Command Watcher  →  CLI Agents
```

- **Zero dependencies** — Node.js built-in modules only
- **No build step** — Single HTML file frontend
- **No database** — JSON files in `.trio/` for all state
- **Resilient** — Dashboard can close/reopen without losing state

## Project Structure

```
LLMTrio/
├── trio                        # CLI entry point
├── package.json                # npx support
├── scripts/
│   ├── octopus-core.js         # Multi-agent orchestration engine
│   ├── dashboard-server.js     # HTTP + SSE server (Node.js only)
│   ├── dashboard.html          # Frontend (single file, no build)
│   ├── command-watcher.sh      # Command queue processor
│   └── model-checker.sh        # Model update checker
├── config/
│   ├── default-routing.json    # Default task → model routing
│   └── default-budget.json     # Default budget limits
└── .trio/                      # Runtime data (gitignored)
```

## Requirements

- **Node.js** v18+

That's it. CLI tools (Claude Code, Codex, Gemini CLI) can be installed from the dashboard.

## License

MIT
