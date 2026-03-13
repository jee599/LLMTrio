#!/usr/bin/env node
// Multi-agent orchestration engine for LLMTrio
// Node.js built-in modules only. No npm dependencies.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const TRIO_DIR = path.join(PROJECT_ROOT, '.trio');
const RESULTS_DIR = path.join(TRIO_DIR, 'results');
const PIDS_DIR = path.join(TRIO_DIR, 'pids');
const PID_FILE = path.join(PIDS_DIR, 'octopus-core.pid');

const AGENT_CMD = {
  claude: (c) => ['claude', ['-p', c]],
  codex: (c) => ['codex', ['exec', c]],
  gemini: (c) => ['gemini', ['-p', c]],
};

const PHASES = {
  discover: [{ name: 'requirements-analysis', type: 'research' }, { name: 'tech-research', type: 'research' }],
  define: [{ name: 'architecture-design', type: 'architecture' }, { name: 'api-design', type: 'architecture' }],
  develop: [{ name: 'implementation', type: 'implementation' }, { name: 'testing', type: 'testing' }],
  deliver: [{ name: 'code-review', type: 'code-review' }, { name: 'documentation', type: 'documentation' }],
};
const PHASE_ORDER = ['discover', 'define', 'develop', 'deliver'];

let shuttingDown = false;
const activeProcs = new Map();

// --- Helpers ---
function ensureDir(d) { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); }
function writeJsonAtomic(fp, data) {
  const tmp = fp + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, fp);
}
function readJson(fp) {
  try { return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch { return null; }
}
function log(msg) { console.log(`[octopus ${new Date().toISOString().slice(11, 19)}] ${msg}`); }
function genTaskId() { return 'task-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// --- Models & cost ---
function loadModels() {
  const data = readJson(path.join(TRIO_DIR, 'models.json'));
  if (!data?.models) return {};
  return Object.fromEntries(data.models.map((m) => [m.id, m]));
}

function estimateCost(chars, modelId, models) {
  const model = models[modelId];
  if (!model) return 0;
  return (Math.ceil(chars / 4) / 1_000_000) * model.pricing.output;
}

function checkBudget(sessionCost) {
  const b = readJson(path.join(TRIO_DIR, 'budget.json'));
  if (!b) return { ok: true };
  if (sessionCost >= b.session_limit) return { ok: false, reason: `Session limit $${b.session_limit} reached` };
  if (sessionCost >= b.session_limit * b.warn_at)
    return { ok: true, warn: `At ${Math.round((sessionCost / b.session_limit) * 100)}% of session budget` };
  return { ok: true };
}

// --- Routing ---
function resolveAgent(taskType) {
  const r = readJson(path.join(TRIO_DIR, 'routing.json'));
  if (!r?.rules) return 'claude';
  const mid = r.rules[taskType];
  if (!mid) return 'claude';
  if (mid.includes('codex')) return 'codex';
  if (mid.includes('gemini')) return 'gemini';
  return 'claude';
}

function resolveModelId(agent) {
  const r = readJson(path.join(TRIO_DIR, 'routing.json'));
  if (!r?.rules) return null;
  for (const mid of Object.values(r.rules)) {
    if (agent === 'codex' && mid.includes('codex')) return mid;
    if (agent === 'gemini' && mid.includes('gemini')) return mid;
    if (agent === 'claude' && mid.includes('claude')) return mid;
  }
  return null;
}

// --- State ---
function loadState() {
  return readJson(path.join(TRIO_DIR, 'state.json')) || { phase: 'discover', phaseProgress: 0, sessionCost: 0, tasks: [] };
}
function saveState(s) { writeJsonAtomic(path.join(TRIO_DIR, 'state.json'), s); }

// --- spawn_agent ---
function spawnAgent(agentId, content, taskInfo) {
  return new Promise((resolve) => {
    if (shuttingDown) return resolve({ success: false, error: 'Shutting down' });
    const cmdFn = AGENT_CMD[agentId];
    if (!cmdFn) { log(`Unknown agent: ${agentId}`); return resolve({ success: false, error: 'Unknown agent' }); }

    const [cmd, args] = cmdFn(content);
    const t0 = Date.now();
    let output = '', stderr = '';
    const resultFile = path.join(RESULTS_DIR, `${taskInfo.id}.json`);
    const models = loadModels();
    const modelId = resolveModelId(agentId);

    const writeResult = (status, extra = {}) => {
      const elapsed = Math.round((Date.now() - t0) / 1000);
      const cost = estimateCost(output.length, modelId, models);
      const lastLines = output.trim().split('\n').slice(-5);
      writeJsonAtomic(resultFile, {
        agent: agentId, status, task: taskInfo.name, taskId: taskInfo.id,
        lastLines, elapsed, cost, output: output.slice(-4000), ...extra,
      });
      return { cost, elapsed };
    };

    let proc;
    try {
      proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env } });
    } catch (err) {
      log(`Failed to spawn ${agentId}: ${err.message}`);
      writeResult('error', { error: err.message });
      return resolve({ success: false, error: err.message });
    }

    activeProcs.set(taskInfo.id, proc);
    writeResult('running');
    log(`[${agentId}] started "${taskInfo.name}" (${taskInfo.id})`);

    proc.stdout.on('data', (chunk) => { output += chunk.toString(); writeResult('running'); });
    proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });

    proc.on('error', (err) => {
      log(`[${agentId}] error: ${err.message}`);
      const { cost, elapsed } = writeResult('error', { error: err.message });
      activeProcs.delete(taskInfo.id);
      resolve({ success: false, error: err.message, cost, elapsed });
    });

    proc.on('close', (code) => {
      activeProcs.delete(taskInfo.id);
      const ok = code === 0;
      const extra = ok ? {} : { error: stderr.slice(-1000) || `Exit code ${code}` };
      const { cost, elapsed } = writeResult(ok ? 'done' : 'error', extra);
      log(`[${agentId}] ${ok ? 'done' : 'error'} "${taskInfo.name}" (${elapsed}s, $${cost.toFixed(4)})`);
      resolve({ success: ok, cost, elapsed, output });
    });
  });
}

// --- Workflow engine ---
async function runWorkflow(prompt) {
  const state = loadState();
  Object.assign(state, { phase: 'discover', phaseProgress: 0, sessionCost: 0, tasks: [] });
  saveState(state);

  for (const phase of PHASE_ORDER) {
    if (shuttingDown) break;
    state.phase = phase;
    state.phaseProgress = 0;
    saveState(state);
    log(`--- Phase: ${phase} ---`);

    const phaseTasks = PHASES[phase].map((t) => ({
      id: genTaskId(), name: t.name, type: t.type,
      agent: resolveAgent(t.type), status: 'pending', elapsed: 0, cost: 0,
    }));
    state.tasks.push(...phaseTasks);
    saveState(state);

    await Promise.all(phaseTasks.map(async (task) => {
      if (shuttingDown) return;
      const budgetCheck = checkBudget(state.sessionCost);
      if (!budgetCheck.ok) {
        log(`Budget exceeded: ${budgetCheck.reason}`);
        task.status = 'error'; task.error = budgetCheck.reason;
        saveState(state); return;
      }
      if (budgetCheck.warn) log(budgetCheck.warn);

      task.status = 'working';
      saveState(state);
      const result = await spawnAgent(task.agent, `[${phase}/${task.name}] ${prompt}`, task);
      task.status = result.success ? 'done' : 'error';
      task.elapsed = result.elapsed || 0;
      task.cost = result.cost || 0;
      if (result.error) task.error = result.error;
      state.sessionCost += task.cost;
      saveState(state);
    }));

    const done = phaseTasks.filter((t) => t.status === 'done').length;
    state.phaseProgress = done / phaseTasks.length;
    saveState(state);
  }
  log('Workflow complete');
}

// --- Single task mode ---
async function runSingleTask(agentName, prompt) {
  const agent = agentName.toLowerCase();
  if (!AGENT_CMD[agent]) { log(`Unknown agent: ${agent}. Use: claude, codex, gemini`); process.exit(1); }

  const task = { id: genTaskId(), name: 'single-task', type: 'implementation' };
  const state = loadState();
  const result = await spawnAgent(agent, prompt, task);
  state.sessionCost += result.cost || 0;
  saveState(state);

  if (result.success) process.stdout.write(result.output || '');
  else { console.error(`Task failed: ${result.error}`); process.exit(1); }
}

// --- Lifecycle ---
function writePid() { ensureDir(PIDS_DIR); writeJsonAtomic(PID_FILE, String(process.pid)); }
function removePid() { try { fs.unlinkSync(PID_FILE); } catch { /* ok */ } }

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  log(`${signal} — shutting down, killing ${activeProcs.size} active processes`);
  for (const [id, proc] of activeProcs) {
    try { proc.kill('SIGTERM'); } catch { /* ok */ }
    log(`Killed ${id}`);
  }
  activeProcs.clear();
  removePid();
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// --- Entry point ---
async function main() {
  const [,, command, ...rest] = process.argv;
  if (!command || command === '--help') {
    console.log('Usage:\n  node octopus-core.js start "prompt"  — run full workflow\n  node octopus-core.js task <agent> "prompt" — run single task');
    process.exit(0);
  }
  ensureDir(RESULTS_DIR);
  writePid();

  if (command === 'start') {
    const prompt = rest.join(' ');
    if (!prompt) { log('Missing prompt'); process.exit(1); }
    await runWorkflow(prompt);
  } else if (command === 'task') {
    const [agent, ...words] = rest;
    const prompt = words.join(' ');
    if (!agent || !prompt) { log('Usage: task <agent> "prompt"'); process.exit(1); }
    await runSingleTask(agent, prompt);
  } else { log(`Unknown command: ${command}`); process.exit(1); }
  removePid();
}

main().catch((err) => { console.error(err); removePid(); process.exit(1); });
