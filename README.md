# LLMTrio

Multi-LLM orchestration tool. Run Claude, Codex, and Gemini in parallel with a real-time dashboard.

Zero dependencies. Zero build step. Just Node.js.

## Quick Start

```bash
git clone https://github.com/jee599/LLMTrio.git
cd LLMTrio
./trio
```

That's it. The dashboard opens in your browser. Set up CLI tools and start workflows — all from the UI.

### Or use npx

```bash
npx llmtrio
```

## How It Works

1. **Run `./trio`** — Dashboard opens at `localhost:3333`
2. **Set up agents** — Install & authenticate Claude, Codex, Gemini from the dashboard (no terminal needed)
3. **Start a workflow** — Enter a prompt, LLMTrio breaks it into tasks and routes each to the best model
4. **Watch it run** — Real-time agent status, task kanban board, cost tracking

## Models

| Agent | Model | Routed Tasks |
|-------|-------|-------------|
| Claude | Opus 4.6 | Architecture, Code Review |
| Codex | GPT-5.4 | Implementation, Testing |
| Gemini | 3.1 Pro | Research, Documentation |

Routing is configurable in `.trio/routing.json`.

## Commands

```bash
./trio                        # Open dashboard (default)
./trio start "prompt"         # Start full 4-phase workflow
./trio task claude "prompt"   # Run single agent task
./trio login                  # Check CLI auth status
./trio status                 # Show current workflow state
./trio stop                   # Stop all processes
```

## Workflow Phases

1. **Discover** — Requirements analysis, tech research
2. **Define** — Architecture design, task breakdown
3. **Develop** — Implementation, testing
4. **Deliver** — Code review, documentation

## Dashboard

- Real-time agent status with live output
- Kanban task board (drag-and-drop, dependencies, priorities)
- Cost tracking with budget limits
- Model routing configuration
- CLI setup & login from browser

## Architecture

```
Browser (dashboard.html)
    ↕ SSE + HTTP
Dashboard Server (localhost:3333)
    ↕ fs.watch + JSON
File System (.trio/)  ←→  Command Watcher  →  CLI (Claude/Codex/Gemini)
```

No database. No framework. The dashboard and engine communicate through JSON files in `.trio/`. Dashboard can be opened/closed without affecting running tasks. All state is persistent and inspectable.

## Project Structure

```
LLMTrio/
├── trio                          # CLI entry point (bash)
├── package.json                  # npx support
├── scripts/
│   ├── octopus-core.js           # Multi-agent orchestration engine
│   ├── dashboard-server.js       # HTTP + SSE server
│   ├── dashboard.html            # Frontend (single file, no build)
│   ├── command-watcher.sh        # Command queue processor
│   └── model-checker.sh          # Model update checker
├── config/
│   ├── default-routing.json      # Default task-to-model routing
│   └── default-budget.json       # Default budget limits
└── .trio/                        # Runtime data (gitignored)
```

## Prerequisites

- **Node.js** v18+

That's all. CLI tools (Claude, Codex, Gemini) can be installed from the dashboard.

## License

MIT
