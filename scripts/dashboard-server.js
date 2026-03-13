#!/usr/bin/env node

// Phase 1: Read-only dashboard server
// Node.js built-in modules only. No npm dependencies.

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const HOST = '127.0.0.1';
const PORT = 3333;
const DEBOUNCE_MS = 100;
const MAX_PARSE_RETRIES = 3;
const PARSE_RETRY_MS = 100;

const PROJECT_ROOT = path.resolve(__dirname, '..');
const TRIO_DIR = path.join(PROJECT_ROOT, '.trio');
const PIDS_DIR = path.join(TRIO_DIR, 'pids');
const RESULTS_DIR = path.join(os.homedir(), '.claude-octopus', 'results');
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
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      // client disconnected, cleanup happens via 'close' event
    }
  }
}

// --- fs.watch with debounce ---

function startWatcher() {
  let debounceTimer = null;

  try {
    watcher = fs.watch(RESULTS_DIR, { recursive: false }, (eventType, filename) => {
      if (!filename) return;

      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        handleResultsChange(filename);
      }, DEBOUNCE_MS);
    });

    watcher.on('error', (err) => {
      console.error(`[watcher] error: ${err.message}`);
    });
  } catch (err) {
    console.error(`[watcher] failed to start: ${err.message}`);
  }
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
  } else if (filename.includes('cost') || data.cost !== undefined) {
    broadcast('cost-update', { file: filename, ...data });
  } else if (filename.includes('debate') || data.debate !== undefined) {
    broadcast('debate-update', { file: filename, ...data });
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
  } else if (req.method === 'GET' && pathname === '/events') {
    serveSse(res);
  } else if (req.method === 'GET' && pathname === '/api/state') {
    serveJson(res, path.join(TRIO_DIR, 'state.json'));
  } else if (req.method === 'GET' && pathname === '/api/models') {
    serveJson(res, path.join(TRIO_DIR, 'models.json'));
  } else if (req.method === 'GET' && pathname === '/api/routing') {
    serveJson(res, path.join(TRIO_DIR, 'routing.json'));
  } else if (req.method === 'GET' && pathname === '/api/budget') {
    serveJson(res, path.join(TRIO_DIR, 'budget.json'));
  } else if (req.method === 'POST' && pathname === '/api/command') {
    receiveCommand(req, res);
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
}

// --- POST /api/command ---

const PENDING_FILE = path.join(TRIO_DIR, 'commands', 'pending.json');
const VALID_TYPES = ['prompt','pause','cancel','approve','reject','reassign',
  'update-routing','update-budget','debate-input','merge'];
const VALID_TARGETS = ['claude','codex','gemini'];

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
      appendToPending(cmd);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, queued: cmd }));
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    }
  });
}

function appendToPending(cmd) {
  ensureDir(path.join(TRIO_DIR, 'commands'));
  let pending = [];
  try {
    const raw = fs.readFileSync(PENDING_FILE, 'utf8');
    pending = JSON.parse(raw);
    if (!Array.isArray(pending)) pending = [];
  } catch {
    // file doesn't exist or is invalid
  }
  pending.push(cmd);
  const tmpFile = PENDING_FILE + '.tmp';
  fs.writeFileSync(tmpFile, JSON.stringify(pending, null, 2), 'utf8');
  fs.renameSync(tmpFile, PENDING_FILE);
}

function serveHtml(res) {
  try {
    const html = fs.readFileSync(DASHBOARD_HTML, 'utf8');
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
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'File not found or unreadable', path: path.basename(filePath) }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'application/json' });
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
    try {
      watcher.close();
    } catch {
      // ignore
    }
    watcher = null;
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
