# LLMTrio

Multi-LLM orchestration tool. Run Claude, Codex, and Gemini in parallel with a real-time dashboard.

## Quick Start

```bash
git clone https://github.com/jee599/LLMTrio.git
cd LLMTrio

# Check CLI auth status
./trio login

# Open real-time dashboard
./trio dashboard

# Run a full workflow
./trio start "Build a REST API for user authentication"

# Run a single agent task
./trio task claude "Design the database schema"
```

## Prerequisites

- **Node.js** (v18+) — required
- **Claude Code** — `npm install -g @anthropic-ai/claude-code && claude login`
- **Codex CLI** — `npm install -g @openai/codex && export OPENAI_API_KEY="sk-..."`
- **Gemini CLI** (optional) — `npm install -g @google/gemini-cli && gemini auth login`

LLMTrio works with any combination of the above. At minimum, one CLI tool is needed.

## Commands

| Command | Description |
|---------|-------------|
| `./trio login` | Check CLI authentication status |
| `./trio start "prompt"` | Start full 4-phase workflow |
| `./trio task <agent> "prompt"` | Run single task on specified agent |
| `./trio dashboard` | Open real-time dashboard (localhost:3333) |
| `./trio dashboard stop` | Stop dashboard |
| `./trio status` | Show current workflow state |
| `./trio stop` | Stop all running processes |

## Architecture

```
Browser (dashboard.html)
    ↕ SSE + HTTP
Dashboard Server (localhost:3333)
    ↕ fs.watch + JSON
File System (.trio/)  ←→  Command Watcher  →  CLI (Claude/Codex/Gemini)
```

The dashboard and core engine communicate through JSON files in `.trio/`. This means:
- Dashboard can be opened/closed without affecting running tasks
- Commands are queued even if agents are busy
- All state is persistent and inspectable

## Workflow Phases

1. **Discover** — Requirements analysis, tech research
2. **Define** — Architecture design, task breakdown
3. **Develop** — Implementation, testing
4. **Deliver** — Code review, documentation

Tasks are automatically assigned to agents based on routing rules in `.trio/routing.json`.

## Dashboard Features

- Real-time agent status cards with live output
- Cost tracking with budget limits
- Task board with drag-and-drop reassignment
- Debate view for multi-agent discussions
- Model management and routing configuration

## Project Structure

```
LLMTrio/
├── trio                          # CLI entry point
├── scripts/
│   ├── octopus-core.js           # Multi-agent orchestration engine
│   ├── dashboard-server.js       # HTTP + SSE server
│   ├── dashboard.html            # Frontend (single file, no build)
│   ├── command-watcher.sh        # Command queue processor
│   └── model-checker.sh          # Model update checker
├── commands/
│   └── dashboard.md              # Slash command definition
├── config/
│   ├── default-routing.json      # Default task-to-model routing
│   └── default-budget.json       # Default budget limits
└── .trio/                        # Runtime data (gitignored)
```

## License

MIT
