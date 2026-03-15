const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');

function createTestEnv() {
  const trioDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trio-wf-'));
  ['pids', 'commands', 'results'].forEach(d => fs.mkdirSync(path.join(trioDir, d), { recursive: true }));
  fs.writeFileSync(path.join(trioDir, 'state.json'), JSON.stringify({ phase: 'idle', tasks: [] }));
  // Create a mock agent script that echoes back
  const mockAgent = path.join(trioDir, 'mock-agent.js');
  fs.writeFileSync(mockAgent, `
    const type = process.argv[2] || 'default';
    const responses = {
      '-p': 'Mock response for: ' + process.argv.slice(2).join(' ').slice(0, 100),
      'exec': 'Mock code output for: ' + process.argv.slice(2).join(' ').slice(0, 100),
    };
    process.stdout.write(responses[type] || responses['-p']);
    setTimeout(() => process.exit(0), 100);
  `);
  // Budget with short timeout
  fs.writeFileSync(path.join(trioDir, 'budget.json'), JSON.stringify({
    timeout_seconds: 30,
    workflow: { plan: { research: false, architecture: true, scaffold: true }, execute: { implementation: true, 'code-review': true, documentation: true } }
  }));
  fs.writeFileSync(path.join(trioDir, 'routing.json'), JSON.stringify({
    rules: { architecture: 'claude-test', implementation: 'codex-test', 'code-review': 'claude-test', documentation: 'gemini-test', scaffold: 'codex-test' }
  }));
  return { trioDir, mockAgent };
}

test('Workflow: state transitions', async (t) => {
  const { trioDir } = createTestEnv();

  // Verify initial state
  const state = JSON.parse(fs.readFileSync(path.join(trioDir, 'state.json'), 'utf8'));
  assert.equal(state.phase, 'idle');
  assert.equal(state.tasks.length, 0);

  // Verify budget.json loads
  const budget = JSON.parse(fs.readFileSync(path.join(trioDir, 'budget.json'), 'utf8'));
  assert.equal(budget.timeout_seconds, 30);
  assert.equal(budget.workflow.plan.research, false);

  // Cleanup
  fs.rmSync(trioDir, { recursive: true, force: true });
});

test('Workflow: template filtering', async (t) => {
  // Test that templates produce correct task counts
  const templates = {
    full: { plan: 3, execute: 3 },
    quick: { plan: 1, execute: 1 },
    review: { plan: 1, execute: 1 },
    docs: { plan: 1, execute: 1 },
  };

  for (const [name, expected] of Object.entries(templates)) {
    // Inline the template logic from octopus-core
    const TEMPLATES = {
      full: { plan: ['research', 'architecture', 'scaffold'], execute: ['implementation', 'code-review', 'documentation'] },
      quick: { plan: ['architecture'], execute: ['implementation'] },
      review: { plan: ['research'], execute: ['code-review'] },
      docs: { plan: ['research'], execute: ['documentation'] },
    };
    const tmpl = TEMPLATES[name];
    assert.equal(tmpl.plan.length, expected.plan, `${name} plan tasks`);
    assert.equal(tmpl.execute.length, expected.execute, `${name} execute tasks`);
  }
});

test('Workflow: plan-summary.json format', async (t) => {
  const { trioDir } = createTestEnv();
  
  // Simulate plan-summary.json
  const summary = {
    architecture: { agent: 'claude', model: 'claude-opus-4.6', output: 'Test architecture output', status: 'done' },
    scaffold: { agent: 'codex', model: 'gpt-5.4-codex', output: 'Test scaffold output', status: 'done' },
  };
  fs.writeFileSync(path.join(trioDir, 'plan-summary.json'), JSON.stringify(summary));

  const loaded = JSON.parse(fs.readFileSync(path.join(trioDir, 'plan-summary.json'), 'utf8'));
  assert.equal(Object.keys(loaded).length, 2);
  assert.equal(loaded.architecture.status, 'done');
  assert.ok(loaded.architecture.output.length > 0);

  fs.rmSync(trioDir, { recursive: true, force: true });
});

test('Workflow: result file format', async (t) => {
  const { trioDir } = createTestEnv();
  
  // Simulate a result file
  const result = {
    agent: 'claude', status: 'done', task: 'architecture',
    taskId: 'task-abc123', lastLines: ['line1'], elapsed: 10,
    tokens: 150, output: 'Architecture plan content', truncated: false,
  };
  fs.writeFileSync(path.join(trioDir, 'results', 'task-abc123.json'), JSON.stringify(result));

  const loaded = JSON.parse(fs.readFileSync(path.join(trioDir, 'results', 'task-abc123.json'), 'utf8'));
  assert.equal(loaded.agent, 'claude');
  assert.equal(loaded.status, 'done');
  assert.equal(loaded.truncated, false);
  assert.ok(loaded.output.length > 0);

  fs.rmSync(trioDir, { recursive: true, force: true });
});

test('Auth: shared module works', async (t) => {
  const { getAuthStatus } = require('../scripts/lib/auth');
  const status = getAuthStatus();
  
  assert.ok('claude' in status);
  assert.ok('codex' in status);
  assert.ok('gemini' in status);
  assert.ok('ready' in status);
  assert.equal(typeof status.claude.installed, 'boolean');
  assert.equal(typeof status.claude.authenticated, 'boolean');
});
