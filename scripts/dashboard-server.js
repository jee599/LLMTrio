#!/usr/bin/env node

// Phase 1: Read-only dashboard server
// Node.js built-in modules only. No npm dependencies.

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync, spawn } = require('child_process');
const { checkCli: sharedCheckCli, getAuthStatus } = require('./lib/auth');

const SESSION_TOKEN = crypto.randomBytes(16).toString('hex');


const HOST = '127.0.0.1';
const PORT = parseInt(process.env.TRIO_PORT, 10) || 3333;
const DEBOUNCE_MS = 100;
const MAX_PARSE_RETRIES = 3;
const PARSE_RETRY_MS = 100;

const PROJECT_ROOT = path.resolve(__dirname, '..');
const TRIO_DIR = process.env.TRIO_DIR || path.join(PROJECT_ROOT, '.trio');
const PIDS_DIR = path.join(TRIO_DIR, 'pids');
const RESULTS_DIR = path.join(TRIO_DIR, 'results');
const DASHBOARD_HTML = path.join(__dirname, 'dashboard.html');

// --- State ---

const sseClients = [];
let watcher = null;
let server = null;
const lastGoodData = new Map(); // path -> parsed JSON cache

// --- Directory bootstrapping ---

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

ensureDir(TRIO_DIR);
ensureDir(PIDS_DIR);
ensureDir(RESULTS_DIR);

// --- PID file ---

function writePid() {
  const pidFile = path.join(PIDS_DIR, 'dashboard-server.pid');
  const tmpFile = pidFile + '.tmp';
  fs.writeFileSync(tmpFile, String(process.pid), 'utf8');
  fs.renameSync(tmpFile, pidFile);
}

function removePid() {
  const pidFile = path.join(PIDS_DIR, 'dashboard-server.pid');
  try {
    fs.unlinkSync(pidFile);
  } catch {
    // already gone
  }
}

// --- JSON parsing with retry ---

function parseJsonFileSync(filePath) {
  for (let attempt = 0; attempt < MAX_PARSE_RETRIES; attempt++) {
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      lastGoodData.set(filePath, parsed);
      return parsed;
    } catch {
      if (attempt < MAX_PARSE_RETRIES - 1) {
        const start = Date.now();
        while (Date.now() - start < PARSE_RETRY_MS) {
          // busy-wait (sync context, no event loop available)
        }
      }
    }
  }
  // All retries failed — return last good data or null
  return lastGoodData.get(filePath) || null;
}

// --- Atomic JSON write (utility for future use) ---

function writeJsonFileSync(filePath, data) {
  const tmpFile = filePath + '.tmp';
  fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmpFile, filePath);
}

// --- SSE ---

function addSseClient(res) {
  sseClients.push(res);
  res.on('close', () => {
    const idx = sseClients.indexOf(res);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
}

function broadcast(eventType, data) {
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  if (sseClients.length === 0) return;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      // client disconnected, cleanup happens via 'close' event
    }
  }
}

// --- fs.watch with debounce ---

let statePollingInterval = null;

function startWatcher() {
  const debounceTimers = new Map();

  try {
    watcher = fs.watch(RESULTS_DIR, { recursive: false }, (eventType, filename) => {
      if (!filename) return;

      // Per-file debounce so multiple files don't cancel each other
      if (debounceTimers.has(filename)) clearTimeout(debounceTimers.get(filename));
      debounceTimers.set(filename, setTimeout(() => {
        debounceTimers.delete(filename);
        handleResultsChange(filename);
      }, DEBOUNCE_MS));
    });

    watcher.on('error', (err) => {
      console.error(`[watcher] error: ${err.message}`);
    });
  } catch (err) {
    console.error(`[watcher] failed to start: ${err.message}`);
  }

  // Watch state.json via polling (fs.watch breaks on atomic rename)
  const stateFile = path.join(TRIO_DIR, 'state.json');
  let lastStateMtime = 0;
  let lastStateContent = '';
  statePollingInterval = setInterval(() => {
    try {
      const stat = fs.statSync(stateFile);
      const mtime = stat.mtimeMs;
      if (mtime <= lastStateMtime) return;
      lastStateMtime = mtime;
      const raw = fs.readFileSync(stateFile, 'utf8');
      if (raw === lastStateContent) return;
      lastStateContent = raw;
      try {
        const data = JSON.parse(raw);
        broadcast('state-update', data);
      } catch {}
    } catch {}
  }, 300);
}

function handleResultsChange(filename) {
  const filePath = path.join(RESULTS_DIR, filename);

  if (!fs.existsSync(filePath)) return;
  if (!filename.endsWith('.json')) return;

  const data = parseJsonFileSync(filePath);
  if (!data) return;

  // Determine event type from file content or name
  if (filename.includes('agent') || data.agent) {
    broadcast('agent-update', { file: filename, ...data });
  } else {
    // Default: broadcast as agent-update
    broadcast('agent-update', { file: filename, ...data });
  }
}

// --- HTTP handler ---

function handleRequest(req, res) {
  const url = new URL(req.url, `http://${HOST}:${PORT}`);
  const pathname = url.pathname;

  if (req.method === 'GET' && pathname === '/') {
    serveHtml(res);
  } else if (req.method === 'GET' && (pathname === '/dashboard.css' || pathname === '/dashboard.js')) {
    serveStaticFile(res, pathname.slice(1));
  } else if (req.method === 'GET' && pathname === '/events') {
    serveSse(res);
  } else if (req.method === 'GET' && pathname === '/api/state') {
    serveJson(res, path.join(TRIO_DIR, 'state.json'));
  } else if (req.method === 'GET' && pathname === '/api/models') {
    const modelsFile = path.join(TRIO_DIR, 'models.json');
    try {
      const data = JSON.parse(fs.readFileSync(modelsFile, 'utf8'));
      const stat = fs.statSync(modelsFile);
      const result = { models: Array.isArray(data) ? data : (data.models || []), lastUpdated: stat.mtime.toISOString() };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ models: [], lastUpdated: null }));
    }
  } else if (req.method === 'GET' && pathname === '/api/routing') {
    serveJson(res, path.join(TRIO_DIR, 'routing.json'));
  } else if (req.method === 'GET' && pathname === '/api/budget') {
    serveJson(res, path.join(TRIO_DIR, 'budget.json'));
  } else if (req.method === 'GET' && pathname.startsWith('/api/result/')) {
    const taskId = pathname.split('/api/result/')[1];
    if (!/^task-[a-z0-9]+$/.test(taskId)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid task ID' }));
      return;
    }
    serveJson(res, path.join(RESULTS_DIR, `${taskId}.json`));
  } else if (req.method === 'POST' && (pathname === '/api/command' || pathname === '/api/save-key' || pathname === '/api/install-cli' || pathname === '/api/cli-login' || pathname === '/api/run-agent')) {
    if (!validateToken(req)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid session token' }));
      return;
    }
    if (pathname === '/api/command') receiveCommand(req, res);
    else if (pathname === '/api/save-key') saveApiKey(req, res);
    else if (pathname === '/api/install-cli') installCli(req, res);
    else if (pathname === '/api/cli-login') cliLogin(req, res);
    else if (pathname === '/api/run-agent') runSingleAgent(req, res);
  } else if (req.method === 'POST' && pathname === '/api/save-result') {
    saveResultToFile(req, res);
  } else if (req.method === 'GET' && pathname === '/api/repo-info') {
    serveRepoInfo(res);
  } else if (req.method === 'GET' && pathname === '/api/auth-status') {
    serveAuthStatus(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
}

// --- POST /api/command ---

const VALID_TYPES = ['prompt','pause','cancel','approve','reject','reassign',
  'update-routing','update-budget','merge','retry-failed'];
const VALID_TARGETS = ['claude','codex','gemini'];

let workflowProc = null;
let _workflowPrompt = '';
let _workflowAutoMode = false;

function startExecutePhase() {
  const stateFile = path.join(TRIO_DIR, 'state.json');
  const st = parseJsonFileSync(stateFile);
  if (!st || st.phase !== 'awaiting-approval') {
    console.error('[dashboard-server] cannot start execute: not in awaiting-approval state');
    return;
  }
  const prompt = st.prompt || _workflowPrompt;
  if (!prompt) {
    console.error('[dashboard-server] cannot start execute: no prompt');
    return;
  }

  // Collect plan outputs for context passing
  const octopus = path.join(__dirname, 'octopus-core.js');
  const spawnEnv = { ...process.env };
  delete spawnEnv.CLAUDECODE;
  delete spawnEnv.CLAUDE_CODE_ENTRYPOINT;
  delete spawnEnv.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS;
  delete spawnEnv.ANTHROPIC_API_KEY;

  console.log(`[dashboard-server] starting execute phase for: ${prompt.slice(0, 60)}...`);

  workflowProc = spawn('node', [octopus, 'start', '--phase', 'execute', prompt], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: spawnEnv,
  });

  workflowProc.stdout.on('data', (chunk) => {
    chunk.toString().trim().split('\n').forEach(line => {
      console.log(`[octopus] ${line}`);
      broadcast('workflow-log', { message: line });
    });
  });
  workflowProc.stderr.on('data', (chunk) => {
    console.error(`[octopus-err] ${chunk.toString().trim()}`);
  });
  workflowProc.on('close', (code) => {
    console.log(`[dashboard-server] execute phase finished (exit ${code})`);
    // Sync stuck tasks
    try {
      const st2 = parseJsonFileSync(stateFile);
      if (st2 && st2.tasks) {
        for (const task of st2.tasks) {
          if (task.status === 'working' || task.status === 'pending') {
            const rf = path.join(RESULTS_DIR, `${task.id}.json`);
            const result = parseJsonFileSync(rf);
            if (result && (result.status === 'done' || result.status === 'error')) {
              task.status = result.status;
              task.elapsed = result.elapsed || task.elapsed;
              task.tokens = result.tokens || task.tokens;
              if (result.error) task.error = result.error;
            } else {
              task.status = 'error';
              task.error = code === 0 ? 'Process ended unexpectedly' : `Process crashed (exit ${code})`;
            }
          }
        }
        st2.phase = 'complete';
        const done = st2.tasks.filter(t => t.status === 'done').length;
        st2.phaseProgress = st2.tasks.length ? done / st2.tasks.length : 1;
        writeJsonFileSync(stateFile, st2);
      }
    } catch (e) {
      console.error(`[dashboard-server] state sync error: ${e.message}`);
    }
    workflowProc = null;
    broadcast('workflow-done', { code });
  });
  workflowProc.on('error', (err) => {
    console.error(`[dashboard-server] execute spawn error: ${err.message}`);
    broadcast('workflow-error', { error: err.message });
    workflowProc = null;
  });
}

function retryFailedTasks() {
  if (workflowProc) {
    console.log('[dashboard-server] workflow already running, cannot retry');
    return;
  }
  killOldOctopusProcesses();

  const octopus = path.join(__dirname, 'octopus-core.js');
  const spawnEnv = { ...process.env };
  delete spawnEnv.CLAUDECODE;
  delete spawnEnv.CLAUDE_CODE_ENTRYPOINT;
  delete spawnEnv.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS;
  delete spawnEnv.ANTHROPIC_API_KEY;

  console.log('[dashboard-server] retrying failed tasks');

  workflowProc = spawn('node', [octopus, 'retry'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: spawnEnv,
  });

  workflowProc.stdout.on('data', (chunk) => {
    chunk.toString().trim().split('\n').forEach(line => {
      console.log(`[octopus] ${line}`);
      broadcast('workflow-log', { message: line });
    });
  });
  workflowProc.stderr.on('data', (chunk) => {
    console.error(`[octopus-err] ${chunk.toString().trim()}`);
  });
  workflowProc.on('close', (code) => {
    console.log(`[dashboard-server] retry finished (exit ${code})`);
    const stateFile = path.join(TRIO_DIR, 'state.json');
    try {
      const st = parseJsonFileSync(stateFile);
      if (st && st.tasks) {
        for (const task of st.tasks) {
          if (task.status === 'working' || task.status === 'pending') {
            const rf = path.join(RESULTS_DIR, `${task.id}.json`);
            const result = parseJsonFileSync(rf);
            if (result && (result.status === 'done' || result.status === 'error')) {
              task.status = result.status;
              task.elapsed = result.elapsed || task.elapsed;
              task.tokens = result.tokens || task.tokens;
              if (result.error) task.error = result.error;
            } else {
              task.status = 'error';
              task.error = code === 0 ? 'Process ended unexpectedly' : `Process crashed (exit ${code})`;
            }
          }
        }
        st.phase = 'complete';
        const done = st.tasks.filter(t => t.status === 'done').length;
        st.phaseProgress = st.tasks.length ? done / st.tasks.length : 1;
        writeJsonFileSync(stateFile, st);
      }
    } catch (e) {
      console.error(`[dashboard-server] retry state sync error: ${e.message}`);
    }
    workflowProc = null;
    broadcast('workflow-done', { code });
  });
  workflowProc.on('error', (err) => {
    console.error(`[dashboard-server] retry spawn error: ${err.message}`);
    broadcast('workflow-error', { error: err.message });
    workflowProc = null;
  });
}

function receiveCommand(req, res) {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    try {
      const cmd = JSON.parse(body);
      if (!cmd.type || !VALID_TYPES.includes(cmd.type)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid command type' }));
        return;
      }
      if (cmd.target && !VALID_TARGETS.includes(cmd.target)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid target agent' }));
        return;
      }
      cmd.timestamp = new Date().toISOString();

      // If workflow prompt, spawn octopus-core.js
      if (cmd.type === 'prompt' && cmd.workflow) {
        startWorkflow(cmd.content, { autoMode: cmd.autoMode, template: cmd.template });
      }
      // Handle plan approval — spawn execute phase
      if (cmd.type === 'approve' && cmd.workflowApproval) {
        console.log('[dashboard-server] plan approved — starting execute phase');
        startExecutePhase();
      }
      if (cmd.type === 'reject' && cmd.workflowApproval) {
        console.log('[dashboard-server] plan rejected');
        // Mark workflow as complete
        try {
          const stateFile = path.join(TRIO_DIR, 'state.json');
          const st = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
          st.phase = 'complete';
          writeJsonFileSync(stateFile, st);
        } catch {}
        broadcast('workflow-done', { code: 0, rejected: true });
      }
      // Handle update-budget directly (no need for command-watcher)
      if (cmd.type === 'update-budget' && cmd.content) {
        try {
          const budgetData = JSON.parse(cmd.content);
          writeJsonFileSync(path.join(TRIO_DIR, 'budget.json'), budgetData);
          console.log('[dashboard-server] updated budget.json');
        } catch (e) {
          console.error('[dashboard-server] failed to update budget.json:', e.message);
        }
      }
      // Handle cancel — kill workflow process
      if (cmd.type === 'cancel' && workflowProc) {
        console.log('[dashboard-server] cancelling workflow');
        try { workflowProc.kill('SIGTERM'); } catch {}
        workflowProc = null;
        broadcast('workflow-done', { code: -1, cancelled: true });
      }
      // Handle retry-failed — re-run only failed tasks
      if (cmd.type === 'retry-failed') {
        retryFailedTasks();
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, queued: cmd }));
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    }
  });
}

function killOldOctopusProcesses() {
  // Kill any lingering octopus-core processes from previous runs
  const pidDir = path.join(TRIO_DIR, 'pids');
  try {
    const pidFile = path.join(pidDir, 'octopus-core.pid');
    if (fs.existsSync(pidFile)) {
      const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim(), 10);
      if (pid) {
        try { process.kill(pid, 'SIGTERM'); console.log(`[dashboard-server] killed old octopus-core PID ${pid}`); } catch {}
      }
      try { fs.unlinkSync(pidFile); } catch {}
    }
  } catch {}
}

function startWorkflow(prompt, opts = {}) {
  if (workflowProc) {
    console.log('[dashboard-server] workflow already running, killing previous');
    try { workflowProc.kill('SIGTERM'); } catch {}
  }
  killOldOctopusProcesses();

  // Clear server-side result cache
  lastGoodData.clear();

  // Clear previous results AND state
  try {
    const files = fs.readdirSync(RESULTS_DIR);
    for (const f of files) {
      if (f.endsWith('.json')) {
        try { fs.unlinkSync(path.join(RESULTS_DIR, f)); } catch {}
      }
    }
    console.log(`[dashboard-server] cleared ${files.length} previous result files`);
  } catch {}
  // Reset state.json immediately so dashboard doesn't show stale data
  try {
    const stateFile = path.join(TRIO_DIR, 'state.json');
    writeJsonFileSync(stateFile, { phase: 'plan', phaseProgress: 0, sessionTokens: 0, tasks: [], prompt, workflowId: '' });
    console.log('[dashboard-server] reset state.json');
  } catch {}
  // Clear approval file if exists
  try { fs.unlinkSync(path.join(TRIO_DIR, 'commands', 'approval.json')); } catch {}

  const octopus = path.join(__dirname, 'octopus-core.js');
  console.log(`[dashboard-server] starting workflow: ${prompt.slice(0, 80)}...`);

  const spawnEnv = { ...process.env };
  delete spawnEnv.CLAUDECODE;
  delete spawnEnv.CLAUDE_CODE_ENTRYPOINT;
  delete spawnEnv.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS;
  delete spawnEnv.ANTHROPIC_API_KEY;
  // Store workflow config for resume
  _workflowPrompt = prompt;
  _workflowAutoMode = !!opts.autoMode;

  const args = [octopus, 'start'];
  // In approval mode: only run plan phase. In auto mode: run both.
  if (!opts.autoMode) args.push('--phase', 'plan');
  if (opts.template) args.push('--template', opts.template);
  args.push(prompt);
  workflowProc = spawn('node', args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: spawnEnv,
  });

  workflowProc.stdout.on('data', (chunk) => {
    const lines = chunk.toString().trim().split('\n');
    lines.forEach(line => {
      console.log(`[octopus] ${line}`);
      broadcast('workflow-log', { message: line });
    });
  });

  workflowProc.stderr.on('data', (chunk) => {
    console.error(`[octopus-err] ${chunk.toString().trim()}`);
  });

  workflowProc.on('close', (code) => {
    console.log(`[dashboard-server] workflow process finished (exit ${code})`);
    // Sync state.json with actual result files — fix any stuck 'working' tasks
    try {
      const stateFile = path.join(TRIO_DIR, 'state.json');
      const st = parseJsonFileSync(stateFile);
      if (!st) throw new Error('Failed to parse state.json after retries');
      let changed = false;
      if (st.tasks) {
        for (const task of st.tasks) {
          if (task.status === 'working' || task.status === 'pending') {
            const rf = path.join(RESULTS_DIR, `${task.id}.json`);
            const result = parseJsonFileSync(rf);
            if (result && (result.status === 'done' || result.status === 'error')) {
              task.status = result.status;
              task.elapsed = result.elapsed || task.elapsed;
              task.tokens = result.tokens || task.tokens;
              if (result.error) task.error = result.error;
              changed = true;
            } else {
              task.status = 'error';
              task.error = code === 0 ? 'Process ended unexpectedly' : `Process crashed (exit ${code})`;
              changed = true;
            }
          }
        }
        // Determine final phase: if plan-only mode succeeded, go to awaiting-approval
        const allPlanDone = st.tasks.length > 0 && st.tasks.every(t => t.phase !== 'execute') && st.tasks.every(t => t.status === 'done');
        const isPlanOnly = !_workflowAutoMode && allPlanDone && code === 0;

        if (isPlanOnly) {
          st.phase = 'awaiting-approval';
          const done = st.tasks.filter(t => t.status === 'done').length;
          st.phaseProgress = st.tasks.length ? done / st.tasks.length : 1;
          writeJsonFileSync(stateFile, st);
          console.log('[dashboard-server] plan complete — awaiting approval');
        } else if (changed || st.phase !== 'complete') {
          st.phase = 'complete';
          const done = st.tasks.filter(t => t.status === 'done').length;
          st.phaseProgress = st.tasks.length ? done / st.tasks.length : 1;
          writeJsonFileSync(stateFile, st);
          console.log(`[dashboard-server] synced state.json (${changed ? 'fixed stuck tasks' : 'marked complete'})`);
        }
      }
    } catch (e) {
      console.error(`[dashboard-server] state sync error: ${e.message}`);
    }
    workflowProc = null;
    // Don't broadcast workflow-done if plan is awaiting approval
    const finalState = parseJsonFileSync(path.join(TRIO_DIR, 'state.json'));
    if (finalState && finalState.phase === 'awaiting-approval') {
      broadcast('state-update', finalState);
    } else {
      broadcast('workflow-done', { code });
    }
  });

  workflowProc.on('error', (err) => {
    console.error(`[dashboard-server] workflow spawn error: ${err.message}`);
    broadcast('workflow-error', { error: err.message });
    workflowProc = null;
  });
}

// --- POST /api/save-result ---

function saveResultToFile(req, res) {
  if (!validateToken(req)) {
    res.writeHead(403, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Invalid session token' }));
    return;
  }
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    try {
      const { taskId, filename } = JSON.parse(body);
      if (!taskId || !/^task-[a-z0-9]+$/.test(taskId)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid task ID' }));
        return;
      }
      const resultFile = path.join(RESULTS_DIR, `${taskId}.json`);
      const result = parseJsonFileSync(resultFile);
      if (!result || !result.output) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Result not found' }));
        return;
      }
      const adoptedDir = path.join(TRIO_DIR, 'adopted');
      if (!fs.existsSync(adoptedDir)) fs.mkdirSync(adoptedDir, { recursive: true });
      const safeName = (filename || result.task || taskId).replace(/[^a-zA-Z0-9가-힣_-]/g, '_');
      const outPath = path.join(adoptedDir, `${safeName}.md`);
      fs.writeFileSync(outPath, result.output, 'utf8');
      console.log(`[dashboard-server] saved result to ${outPath}`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, path: outPath }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
  });
}

// --- GET /api/repo-info ---

function serveRepoInfo(res) {
  const info = { available: false };
  try {
    info.branch = execSync('git branch --show-current', { cwd: PROJECT_ROOT, stdio: 'pipe' }).toString().trim();
    info.status = execSync('git status --porcelain', { cwd: PROJECT_ROOT, stdio: 'pipe' }).toString().trim();
    info.lastCommit = execSync('git log --oneline -1', { cwd: PROJECT_ROOT, stdio: 'pipe' }).toString().trim();
    info.modifiedFiles = info.status.split('\n').filter(l => l.trim()).length;
    info.clean = info.modifiedFiles === 0;
    info.available = true;
  } catch {}
  res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(info));
}

// --- GET /api/auth-status ---

function serveAuthStatus(res) {
  // Load saved API keys from .trio/.env and inject into process.env for auth check
  const envFile = path.join(TRIO_DIR, '.env');
  try {
    const raw = fs.readFileSync(envFile, 'utf8');
    for (const line of raw.split('\n')) {
      const m = line.match(/^([A-Z_]+)=(.+)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {}

  const status = getAuthStatus();

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(status));
}

// --- POST /api/save-key ---

function saveApiKey(req, res) {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    try {
      const { provider, key } = JSON.parse(body);
      const validProviders = {
        anthropic: 'ANTHROPIC_API_KEY',
        openai: 'OPENAI_API_KEY',
        google: 'GEMINI_API_KEY',
      };
      const envVar = validProviders[provider];
      if (!envVar || !key) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid provider or key' }));
        return;
      }

      // Save to .trio/.env
      const envFile = path.join(TRIO_DIR, '.env');
      let lines = [];
      try { lines = fs.readFileSync(envFile, 'utf8').split('\n').filter(l => l.trim()); } catch {}
      lines = lines.filter(l => !l.startsWith(envVar + '='));
      lines.push(`${envVar}=${key}`);
      const tmpEnv = envFile + '.tmp';
      fs.writeFileSync(tmpEnv, lines.join('\n') + '\n', 'utf8');
      fs.renameSync(tmpEnv, envFile);

      // Also set in current process
      process.env[envVar] = key;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, saved: envVar }));
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    }
  });
}

// --- POST /api/install-cli ---

const INSTALL_PACKAGES = {
  claude: '@anthropic-ai/claude-code',
  codex: '@openai/codex',
  gemini: '@google/gemini-cli',
};

function installCli(req, res) {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    try {
      if (!body) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ ok: false, error: 'Empty request body' })); return; }
      const { provider } = JSON.parse(body);
      const packageName = INSTALL_PACKAGES[provider];
      if (!packageName) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid provider' }));
        return;
      }
      broadcast('setup-update', { provider, status: 'installing' });
      const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
      const proc = spawn(npmCmd, ['install', '-g', packageName], { stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '', stderr = '';
      proc.stdout.on('data', d => { stdout += d.toString(); });
      proc.stderr.on('data', d => { stderr += d.toString(); });
      proc.on('close', code => {
        const ok = code === 0;
        broadcast('setup-update', { provider, status: ok ? 'installed' : 'install-failed', output: (stdout + stderr).slice(-2000) });
        res.writeHead(ok ? 200 : 500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok, output: (stdout + stderr).slice(-2000) }));
      });
      proc.on('error', err => {
        broadcast('setup-update', { provider, status: 'install-failed', error: err.message });
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      });
    } catch (e) {
      console.error('[install-cli] error:', e.message, 'body:', body);
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: e.message }));
    }
  });
}

// --- POST /api/cli-login ---

const LOGIN_CLI = {
  claude: 'claude',
  codex: 'codex',
};

function cliLogin(req, res) {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    try {
      const { provider } = JSON.parse(body);
      const cliCmd = LOGIN_CLI[provider];
      if (!cliCmd) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid provider.' }));
        return;
      }
      broadcast('setup-update', { provider, status: 'logging-in' });
      // Spawn login process — it opens browser for OAuth
      const proc = spawn(cliCmd, ['login'], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, BROWSER: process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open' },
      });
      let output = '';
      proc.stdout.on('data', d => { output += d.toString(); });
      proc.stderr.on('data', d => { output += d.toString(); });
      // Return immediately — login is async (user completes OAuth in browser)
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, message: 'Login started. Complete authentication in the browser window.' }));
      proc.on('close', code => {
        const ok = code === 0;
        broadcast('setup-update', { provider, status: ok ? 'logged-in' : 'login-failed', output: output.slice(-1000) });
      });
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    }
  });
}

function serveStaticFile(res, filename) {
  const MIME = { '.css': 'text/css', '.js': 'application/javascript' };
  const ext = path.extname(filename);
  const filePath = path.join(__dirname, filename);
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    res.writeHead(200, { 'Content-Type': (MIME[ext] || 'text/plain') + '; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(content);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
}

function validateToken(req) {
  const token = req.headers['x-trio-token'];
  return token === SESSION_TOKEN;
}

function serveHtml(res) {
  try {
    const html = fs.readFileSync(DASHBOARD_HTML, 'utf8')
      .replace('</head>', `<script>window.__TRIO_TOKEN='${SESSION_TOKEN}';</script></head>`);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Failed to read dashboard.html', detail: err.message }));
  }
}

function serveSse(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  // Send initial heartbeat so the client knows it's connected
  res.write(`event: connected\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`);

  addSseClient(res);
}

function serveJson(res, filePath) {
  const data = parseJsonFileSync(filePath);
  if (data === null) {
    res.writeHead(404, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ error: 'File not found or unreadable', path: path.basename(filePath) }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

// --- Graceful shutdown ---

function shutdown(signal) {
  console.log(`\n[dashboard-server] ${signal} received, shutting down...`);

  // Close all SSE connections
  for (const client of sseClients) {
    try {
      client.end();
    } catch {
      // ignore
    }
  }
  sseClients.length = 0;

  // Stop fs.watch
  if (watcher) {
    try { watcher.close(); } catch {}
    watcher = null;
  }
  if (statePollingInterval) {
    clearInterval(statePollingInterval);
    statePollingInterval = null;
  }

  // Kill workflow process if running
  if (workflowProc) {
    try { workflowProc.kill('SIGTERM'); } catch {}
    workflowProc = null;
  }

  // Close HTTP server
  if (server) {
    server.close(() => {
      removePid();
      process.exit(0);
    });
    // Force exit after 3s if server.close hangs
    setTimeout(() => {
      removePid();
      process.exit(1);
    }, 3000);
  } else {
    removePid();
    process.exit(0);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// --- POST /api/run-agent: run a single agent and return output ---

const AGENT_CMDS = {
  claude: (p) => ['claude', ['-p', p]],
  codex: (p) => ['codex', ['exec', p]],
  gemini: (p) => ['gemini', ['-p', p]],
};

function runSingleAgent(req, res) {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    try {
      const { agent, prompt, timeout } = JSON.parse(body);
      const cmdFn = AGENT_CMDS[agent];
      if (!cmdFn || !prompt) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid agent or prompt' }));
        return;
      }

      const [cmd, args] = cmdFn(prompt);
      const spawnEnv = { ...process.env };
      delete spawnEnv.CLAUDECODE;
      delete spawnEnv.CLAUDE_CODE_ENTRYPOINT;
      delete spawnEnv.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS;
      delete spawnEnv.ANTHROPIC_API_KEY;

      let output = '', stderr = '';
      const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], env: spawnEnv });

      const timeoutMs = (timeout || 60) * 1000;
      const timer = setTimeout(() => {
        try { proc.kill('SIGTERM'); } catch {}
      }, timeoutMs);

      proc.stdout.on('data', d => { output += d.toString(); });
      proc.stderr.on('data', d => { stderr += d.toString(); });

      proc.on('close', (code) => {
        clearTimeout(timer);
        res.writeHead(code === 0 ? 200 : 500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: code === 0, output: output.slice(-4000), error: stderr.slice(-1000) || (code !== 0 ? `Exit code ${code}` : '') }));
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      });
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    }
  });
}

// --- Start ---

function start() {
  writePid();

  server = http.createServer(handleRequest);

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[dashboard-server] Port ${PORT} already in use. Is another instance running?`);
      removePid();
      process.exit(1);
    }
    console.error(`[dashboard-server] Server error: ${err.message}`);
  });

  server.listen(PORT, HOST, () => {
    console.log(`[dashboard-server] listening on http://${HOST}:${PORT}`);
    console.log(`[dashboard-server] PID: ${process.pid}`);
    console.log(`[dashboard-server] watching: ${RESULTS_DIR}`);
  });

  startWatcher();
}

start();
