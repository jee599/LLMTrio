#!/usr/bin/env node
// Multi-agent orchestration engine for LLMTrio
// Node.js built-in modules only. No npm dependencies.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const TRIO_DIR = path.join(PROJECT_ROOT, '.trio');

// Load API keys from .trio/.env
try {
  const envFile = path.join(TRIO_DIR, '.env');
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
      const m = line.match(/^([A-Z_]+)=(.+)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
} catch {}
const RESULTS_DIR = path.join(TRIO_DIR, 'results');
const PIDS_DIR = path.join(TRIO_DIR, 'pids');
const PID_FILE = path.join(PIDS_DIR, 'octopus-core.pid');

const AGENT_CMD = {
  claude: (c) => ['claude', ['-p', c]],
  codex: (c) => ['codex', ['exec', c]],
  gemini: (c) => ['gemini', ['-p', c]],
};

// 2-phase design: all 3 agents work simultaneously in each phase
const ALL_TASKS = {
  plan: [
    { name: 'research', type: 'research', agent: 'gemini' },
    { name: 'architecture', type: 'architecture', agent: 'claude' },
    { name: 'scaffold', type: 'implementation', agent: 'codex' },
  ],
  execute: [
    { name: 'implementation', type: 'implementation', agent: 'codex' },
    { name: 'code-review', type: 'code-review', agent: 'claude' },
    { name: 'documentation', type: 'documentation', agent: 'gemini' },
  ],
};
const PHASE_ORDER = ['plan', 'execute'];

// Filter tasks based on workflow settings in budget.json
function getPhases() {
  const b = readJson(path.join(TRIO_DIR, 'budget.json'));
  const wf = b?.workflow;
  if (!wf) return ALL_TASKS;
  const phases = {};
  for (const phase of PHASE_ORDER) {
    const phaseSettings = wf[phase];
    phases[phase] = ALL_TASKS[phase].filter((t) => {
      if (!phaseSettings) return true;
      const key = t.type === 'implementation' && phase === 'plan' ? 'scaffold' : t.name;
      return phaseSettings[key] !== false;
    });
  }
  return phases;
}

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

function estimateTokens(chars) {
  return Math.ceil(chars / 4);
}

function loadTimeout() {
  const b = readJson(path.join(TRIO_DIR, 'budget.json'));
  return (b && b.timeout_seconds) || 120; // default 2 minutes
}

// Intentionally returns {ok:true} — budget enforcement is unnecessary for
// subscription-based models (Claude Max, Codex, Gemini). If per-token billing
// is added later, implement actual limit checks here.
function checkBudget() {
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
  return readJson(path.join(TRIO_DIR, 'state.json')) || { phase: 'discover', phaseProgress: 0, sessionTokens: 0, tasks: [] };
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
    const MAX_OUTPUT = 512 * 1024; // 512KB limit
    const resultFile = path.join(RESULTS_DIR, `${taskInfo.id}.json`);

    const writeResult = (status, extra = {}) => {
      const elapsed = Math.round((Date.now() - t0) / 1000);
      const tokens = estimateTokens(output.length);
      const lastLines = output.trim().split('\n').slice(-5);
      writeJsonAtomic(resultFile, {
        agent: agentId, status, task: taskInfo.name, taskId: taskInfo.id,
        lastLines, elapsed, tokens, output: output.slice(-4000), ...extra,
      });
      return { tokens, elapsed };
    };

    let proc;
    try {
      const spawnEnv = { ...process.env };
      // Unset Claude Code env vars to prevent nested session detection
      delete spawnEnv.CLAUDECODE;
      delete spawnEnv.CLAUDE_CODE_ENTRYPOINT;
      delete spawnEnv.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS;
      // Remove API key so Claude CLI uses subscription auth instead
      delete spawnEnv.ANTHROPIC_API_KEY;
      proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], env: spawnEnv, cwd: PROJECT_ROOT });
    } catch (err) {
      log(`Failed to spawn ${agentId}: ${err.message}`);
      writeResult('error', { error: err.message });
      return resolve({ success: false, error: err.message });
    }

    activeProcs.set(taskInfo.id, proc);
    writeResult('running');
    log(`[${agentId}] started "${taskInfo.name}" (${taskInfo.id})`);
    // Notify caller that process actually spawned (for status tracking)
    if (taskInfo._onSpawned) taskInfo._onSpawned();

    // Timeout: kill process if it takes too long
    const timeoutSec = loadTimeout();
    let timedOut = false;
    let killTimer = null;
    const timer = setTimeout(() => {
      timedOut = true;
      log(`[${agentId}] TIMEOUT after ${timeoutSec}s — killing "${taskInfo.name}"`);
      try { proc.kill('SIGTERM'); } catch {}
      killTimer = setTimeout(() => { try { proc.kill('SIGKILL'); } catch {} }, 3000);
    }, timeoutSec * 1000);

    proc.stdout.on('data', (chunk) => {
      output += chunk.toString();
      if (output.length > MAX_OUTPUT) output = output.slice(-MAX_OUTPUT);
      writeResult('running');
    });
    proc.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > MAX_OUTPUT) stderr = stderr.slice(-MAX_OUTPUT);
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      log(`[${agentId}] error: ${err.message}`);
      const { tokens, elapsed } = writeResult('error', { error: err.message });
      activeProcs.delete(taskInfo.id);
      resolve({ success: false, error: err.message, tokens, elapsed });
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      activeProcs.delete(taskInfo.id);
      const ok = code === 0 && !timedOut;
      const extra = timedOut ? { error: `Timed out after ${timeoutSec}s` }
        : ok ? {} : { error: stderr.slice(-1000) || `Exit code ${code}` };
      const { tokens, elapsed } = writeResult(ok ? 'done' : 'error', extra);
      log(`[${agentId}] ${ok ? 'done' : 'error'} "${taskInfo.name}" (${elapsed}s, ~${tokens} tokens)`);
      resolve({ success: ok, tokens, elapsed, output });
    });
  });
}

// --- Workflow engine ---
async function runWorkflow(prompt, opts = {}) {
  const state = loadState();
  const onlyPhase = opts.onlyPhase || null; // 'plan' or 'execute' or null (both)

  // If resuming execute phase, keep existing state
  if (onlyPhase === 'execute') {
    state.phase = 'execute';
    saveState(state);
  } else {
    const workflowId = 'wf-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    Object.assign(state, { phase: 'plan', phaseProgress: 0, sessionTokens: 0, tasks: [], prompt, workflowId });
    saveState(state);
  }

  let prevPhaseOutputs = '';
  const phases = getPhases();

  for (const phase of PHASE_ORDER) {
    if (shuttingDown) break;
    // Skip phases not matching onlyPhase filter
    if (onlyPhase && phase !== onlyPhase) continue;
    if (!phases[phase] || phases[phase].length === 0) { log(`Skipping empty phase: ${phase}`); continue; }
    state.phase = phase;
    state.phaseProgress = 0;
    saveState(state);
    log(`--- Phase: ${phase} ---`);

    const phaseTasks = phases[phase].map((t) => {
      const agent = t.agent || resolveAgent(t.type);
      const model = resolveModelId(agent) || agent;
      return {
        id: genTaskId(), name: t.name, type: t.type, phase,
        agent, model, status: 'pending', elapsed: 0, tokens: 0,
        workflowId: state.workflowId, workflowPrompt: prompt,
      };
    });
    state.tasks.push(...phaseTasks);
    saveState(state);

    const phaseOutputs = [];

    await Promise.all(phaseTasks.map(async (task) => {
      if (shuttingDown) return;
      const budgetCheck = checkBudget(state.sessionCost);
      if (!budgetCheck.ok) {
        log(`Budget exceeded: ${budgetCheck.reason}`);
        task.status = 'error'; task.error = budgetCheck.reason;
        saveState(state); return;
      }
      if (budgetCheck.warn) log(budgetCheck.warn);

      // Status stays 'pending' until process actually spawns
      // Set callback to update status when spawn succeeds
      task._onSpawned = () => {
        task.status = 'working';
        saveState(state);
      };

      // Build role-specific prompt with context
      // Detect Korean input → respond in Korean
      const langNote = /[가-힣]/.test(prompt) ? '\n\n반드시 한국어로 응답하세요.'
        : /[\u4e00-\u9fff]/.test(prompt) ? '\n\nPlease respond entirely in Chinese (简体中文).'
        : /[\u3040-\u309f\u30a0-\u30ff]/.test(prompt) ? '\n\nすべて日本語で応答してください。'
        : '';
      const rolePrompts = {
        research: `You are a research analyst. DO NOT execute the task yourself. DO NOT touch files or run commands. Only ANALYZE the request and output a short brief (under 150 words):\n- What the user wants\n- What approach to take\n- Key risks or constraints\n\nUser request: "${prompt}"${langNote}`,
        architecture: `You are an architect. DO NOT write code. Output a short plan (under 200 words): components, file structure, interactions.\n\nUser request: "${prompt}"${langNote}`,
        scaffold: `Create the minimal project structure needed. Be concise.\n\nTask: ${prompt}${langNote}`,
        implementation: `Write the core code. Be concise and focused.\n\nTask: ${prompt}${langNote}`,
        'code-review': `Review the code. List max 5 issues (bugs, security, improvements). Be specific, no filler.\n\nTask: ${prompt}${langNote}`,
        documentation: `Write a short README with usage examples. Keep it under 200 words.\n\nTask: ${prompt}${langNote}`,
      };
      let fullPrompt = rolePrompts[task.type] || `[${phase}/${task.name}] ${prompt}`;
      if (prevPhaseOutputs) {
        fullPrompt += `\n\n--- Previous phase results ---\n${prevPhaseOutputs}`;
      }

      const result = await spawnAgent(task.agent, fullPrompt, task);
      task.status = result.success ? 'done' : 'error';
      task.elapsed = result.elapsed || 0;
      task.tokens = result.tokens || 0;
      if (result.error) task.error = result.error;
      if (result.output) phaseOutputs.push(`[${task.name}]: ${result.output.slice(-2000)}`);
      state.sessionTokens += task.tokens;
      saveState(state);
    }));

    // Save full plan results for execute phase context
    if (phase === 'plan') {
      const planSummary = {};
      for (const task of phaseTasks) {
        const resultFile = path.join(RESULTS_DIR, `${task.id}.json`);
        const result = readJson(resultFile);
        planSummary[task.name] = {
          agent: task.agent,
          model: task.model,
          output: result?.output || '',
          status: task.status,
        };
      }
      writeJsonAtomic(path.join(TRIO_DIR, 'plan-summary.json'), planSummary);
    }

    // In execute phase, load plan summary for richer context
    if (phase === 'execute') {
      const planSummary = readJson(path.join(TRIO_DIR, 'plan-summary.json'));
      if (planSummary) {
        prevPhaseOutputs = Object.entries(planSummary)
          .filter(([_, v]) => v.status === 'done' && v.output)
          .map(([name, v]) => `[${name}]: ${v.output.slice(-2000)}`)
          .join('\n\n');
      }
    }

    // Pass this phase's outputs to next phase (fallback if no plan-summary)
    if (!prevPhaseOutputs) {
      prevPhaseOutputs = phaseOutputs.join('\n\n');
    }

    const done = phaseTasks.filter((t) => t.status === 'done').length;
    const failed = phaseTasks.filter((t) => t.status === 'error').length;
    state.phaseProgress = done / phaseTasks.length;
    saveState(state);

    // Stop workflow if any task in this phase failed
    if (failed > 0) {
      log(`Phase "${phase}" had ${failed} failure(s) — stopping workflow`);
      state.phase = 'complete';
      state.phaseProgress = done / phaseTasks.length;
      saveState(state);
      break;
    }

  }

  if (state.phase !== 'complete') {
    state.phase = 'complete';
    state.phaseProgress = 1;
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
  state.sessionTokens += result.tokens || 0;
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
    // Parse flags
    const phaseIdx = rest.indexOf('--phase');
    let onlyPhase = null;
    const flags = ['--auto', '--phase'];
    if (phaseIdx !== -1) {
      onlyPhase = rest[phaseIdx + 1] || null;
    }
    const promptWords = rest.filter((w, i) => !flags.includes(w) && (i === 0 || !flags.includes(rest[i - 1])));
    const prompt = promptWords.join(' ');
    if (!prompt && !onlyPhase) { log('Missing prompt'); process.exit(1); }
    await runWorkflow(prompt || '', { onlyPhase });
  } else if (command === 'task') {
    const [agent, ...words] = rest;
    const prompt = words.join(' ');
    if (!agent || !prompt) { log('Usage: task <agent> "prompt"'); process.exit(1); }
    await runSingleTask(agent, prompt);
  } else { log(`Unknown command: ${command}`); process.exit(1); }
  removePid();
}

main().catch((err) => { console.error(err); removePid(); process.exit(1); });
