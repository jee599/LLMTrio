
I wanted Claude, Codex, and Gemini to work on the same task at the same time. Not sequentially. Not through copy-pasting between terminals. In parallel, with each model doing what it's best at, and the results merging automatically.

That's how LLMTrio started. One prompt in, three AIs working simultaneously, one combined result out.

The idea was simple. The implementation was not.


## Why three models?

Each LLM has a personality. After months of using all three for different projects, the pattern became obvious.

Claude thinks deeply. Give it an architecture problem and it'll map out components, dependencies, edge cases. It's the best code reviewer I've used — catches bugs that would take me hours to find.

Codex is fast. OpenAI's coding model churns out implementation code at a pace the others can't match. Scaffold a project, write boilerplate, crank out CRUD endpoints — Codex handles it.

Gemini researches broadly. It's good at surveying a topic, finding constraints, identifying risks. The kind of analysis you'd do before writing any code.

Using only one of them felt like leaving capability on the table. What if I could use all three on every task, each doing what it does best?


## Zero dependencies, file-based architecture

I made two decisions early that shaped everything.

**No npm dependencies.** LLMTrio uses only Node.js built-in modules — `http`, `fs`, `child_process`, `path`. The entire project is three files: `octopus-core.js` (workflow engine), `dashboard-server.js` (HTTP + SSE server), and `dashboard.html` (single-file frontend). No React, no Express, no Socket.io.

Why? Because LLMTrio orchestrates CLI tools (`claude`, `codex`, `gemini`). Adding a framework to glue together three shell commands felt like overkill. And zero-dep means `npx llmtrio` just works — no install step, no version conflicts.

**File-based message bus.** The three components communicate through `.trio/state.json` and `.trio/results/task-*.json` files. The dashboard server watches these files with `fs.watch` and broadcasts changes via Server-Sent Events. No WebSocket, no Redis, no message queue.

```
octopus-core writes → .trio/state.json
                    → .trio/results/task-abc.json
                         ↓ (fs.watch)
dashboard-server broadcasts → SSE events
                         ↓
dashboard.html receives → updates UI
```

This sounds fragile. It is, a little. But it's also dead simple to debug — every state transition is a JSON file you can `cat`. And for a tool that runs on localhost, the simplicity outweighs the downsides.


## The 2-phase workflow

A single prompt gets split into two phases, each running tasks in parallel.

**Plan phase** runs three tasks simultaneously: Gemini researches (analyzes requirements, identifies risks), Claude architects (designs components, file structure), and Codex scaffolds (generates project skeleton). All three start at the same time and run independently.

**Execute phase** also runs three in parallel: Codex implements (writes core code), Claude reviews (finds bugs, security issues), and Gemini documents (writes README). Execute only starts after Plan completes successfully.

```
User prompt: "Build a REST API with auth"
                    ↓
    ┌─── Plan (parallel) ──────┐
    │ Gemini:research           │
    │ Claude:architecture       │
    │ Codex:scaffold            │
    └───────────────────────────┘
                    ↓
    ┌── Execute (parallel) ─────┐
    │ Codex:implementation      │
    │ Claude:code-review        │
    │ Gemini:documentation      │
    └───────────────────────────┘
                    ↓
           Combined result
```

The engine passes Plan outputs as context to Execute prompts. So the implementation task knows about the architecture, and the code review knows about the scaffold.


## The bug safari

Building the orchestrator took a couple of sessions. Fixing the bugs took an entire day. Here's what broke and why.

### Bug 1: Everything shows "running" when nothing is running

The dashboard showed all three agents as "working" even when tasks were just pending. The elapsed time counter kept ticking for idle agents.

**Root cause:** In `octopus-core.js`, the workflow engine used `Promise.all` to run tasks in parallel. But inside the promise callback, it set `task.status = 'working'` *before* spawning the process. Since JavaScript runs all synchronous code in each async function before yielding, all three tasks got marked "working" instantly — before any agent process actually started.

```javascript
// Before: all tasks marked 'working' immediately
await Promise.all(tasks.map(async (task) => {
  task.status = 'working';  // runs for ALL tasks before any await
  saveState(state);
  const result = await spawnAgent(task.agent, prompt, task);
}));
```

**Fix:** Status stays `pending` until the child process actually spawns. I added a callback that fires after `spawn()` succeeds:

```javascript
task._onSpawned = () => {
  task.status = 'working';
  saveState(state);
};
```

The elapsed timer had a similar issue — it counted from `startedAt` even when agents were idle. Fixed by showing static "0.0s" for pending agents and stopping the counter when status changes to done/error.


### Bug 2: Flow diagram shows stale data from previous workflow

Running a second workflow showed results from the first. The flow diagram displayed old task outputs, and the results panel showed previous summaries.

**Root cause:** Three layers of caching, none invalidated on new workflow start.

The browser cached `/api/result/task-xxx` responses. The dashboard-server had an in-memory `lastGoodData` Map that cached parsed JSON forever. And `state.json` wasn't reset before the new octopus-core process started, so the dashboard read stale state during the race window.

**Fix:** Added `{ cache: 'no-store' }` to every `fetch()` call for dynamic data. Cleared `lastGoodData` on workflow start. Reset `state.json` before spawning octopus-core. And added workflow ID validation — each workflow gets a unique ID, and the dashboard ignores SSE updates from old workflow IDs.

```javascript
// Dashboard: skip stale state updates
if (data.workflowId && _currentWorkflowId &&
    data.workflowId !== _currentWorkflowId) {
  return; // from old workflow, ignore
}
```


### Bug 3: The "7 sync bugs" audit

After fixing the obvious issues, I ran a thorough audit across all three files. Found 7 distinct sync problems:

**Agent cards updated but task array empty.** The `agent-update` SSE (from result files) updated agent cards directly, but the `tasks` array only got populated from `state-update` SSE. Flow diagram and results panel used the `tasks` array, so they showed 0/0 while agent cards showed real data.

**Three duplicate sync functions.** Agent-to-task status mapping was implemented in three places: `state-update` handler, `handleTasksUpdate`, and `applyFullState`. Each had slightly different logic. Consolidated into a single `syncTasksToAgents()` function.

**Config API responses cached by browser.** The `/api/models`, `/api/routing`, `/api/budget`, and `/api/auth-status` endpoints didn't have cache-control headers. Budget changes wouldn't reflect until page reload.

**Server result cache never cleared.** `parseJsonFileSync()` cached results in a `lastGoodData` Map. When result files were deleted on new workflow start, the server kept serving cached old data.

The full list reads like a distributed systems textbook: race conditions, stale reads, missing invalidation, event ordering issues. All in a "simple" localhost tool.


### Bug 4: The approval button that did nothing

This was the most architectural bug. I'd added an "approval mode" where the workflow pauses after Plan phase for user review. The user sees Plan results, clicks "Approve", and Execute begins.

The first implementation: octopus-core enters Plan, completes it, then polls a file (`approval.json`) every 500ms waiting for the user to approve. Dashboard writes the file when user clicks the button.

```javascript
// First attempt: polling-based approval
function waitForApproval() {
  return new Promise((resolve) => {
    const check = () => {
      if (fs.existsSync(APPROVAL_FILE)) {
        resolve(JSON.parse(fs.readFileSync(APPROVAL_FILE)));
        return;
      }
      setTimeout(check, 500); // poll every 500ms
    };
    check();
  });
}
```

**The problem:** The octopus-core process kept dying. Node.js child processes spawned by the dashboard-server have no guaranteed uptime. Timeouts, memory pressure, or just bad luck could kill the process while it's polling. When that happens, there's nothing left to read the approval file. The button does nothing. The workflow is stuck forever.

I clicked "Approve" three times in testing. Nothing happened. Checked the process list — octopus-core was dead. The approval file existed, but nobody was reading it.

**The fix:** Move approval logic entirely to the dashboard-server. Instead of one long-running process, use two short-lived ones:

```
Approval mode:
1. Server spawns: octopus-core --phase plan
2. Plan completes → process exits cleanly
3. Server sets state to 'awaiting-approval'
4. User clicks Approve
5. Server spawns: octopus-core --phase execute
6. Execute completes → process exits

Auto mode:
1. Server spawns: octopus-core (no --phase flag)
2. Runs plan + execute sequentially → exits
```

The server manages the lifecycle. If either process crashes, the server's `on('close')` handler catches it and marks stuck tasks as errors. No more zombie processes polling for files that will never come.

This was the single biggest lesson of the project: **don't put blocking waits in child processes.** The parent should manage state transitions.


### Bug 5: Zombie processes

Every time I started a new workflow without the previous one finishing, the old octopus-core process stayed alive. After a few test runs, I had 4 zombie processes eating memory.

```bash
$ ps aux | grep octopus-core
jidong  2926  node octopus-core.js start 크롤링해줘
jidong  2244  node octopus-core.js start 결과 나왔어
jidong  1770  node octopus-core.js start 크롤링 시작해줘
jidong  3821  node octopus-core.js start --phase execute ...
```

**Fix:** On new workflow start, kill any lingering process referenced by the PID file, then kill the previous `workflowProc` reference. Belt and suspenders.


## What I'd do differently

**State management is the hard part.** I spent 80% of debug time on sync issues, not on the actual LLM orchestration. The file-based message bus works, but tracking which component has the latest truth requires discipline. A proper event-sourced design would have prevented half these bugs.

**Timeout everything.** The first version had no timeouts on agent processes. Gemini once hung for 3+ minutes on a documentation task. Now every spawn has a configurable timeout (default 120s) with SIGTERM → 3s → SIGKILL escalation.

**Don't poll for state changes.** The approval polling was the most obvious failure, but even the dashboard's periodic `fetchFullState()` calls are a smell. SSE should be the single source of updates. Polling is a fallback, not a strategy.


## The stack

The entire project is three files and zero npm dependencies:

```
scripts/
├── octopus-core.js      # Workflow engine (spawns CLI agents)
├── dashboard-server.js  # HTTP server + SSE + file watcher
└── dashboard.html       # Single-file frontend (5000+ lines)
```

It orchestrates three CLI tools: `claude` (Claude Code), `codex` (OpenAI Codex CLI), and `gemini` (Google Gemini CLI). Each gets spawned as a child process with a role-specific prompt, and results are collected via stdout.

The dashboard is a real-time monitor: flow diagram with completion animations, click-to-inspect detail panels, approval/auto mode toggle, live elapsed timers, and a briefing system that summarizes results when a workflow completes.

All served from `localhost:3333`. No cloud, no accounts, no telemetry.

---

- [LLMTrio on GitHub](https://github.com/jee599/LLMTrio)
- [LLMTrio on npm](https://www.npmjs.com/package/llmtrio)

> Three AIs working together sounds like the future. Getting them to sync correctly feels like the present — messy, full of race conditions, and entirely worth figuring out.
