#!/usr/bin/env node
const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { getAuthStatus } = require('../scripts/lib/auth');

const ROOT = path.resolve(__dirname, '..');
const TRIO_DIR = path.join(ROOT, '.trio');
const arg = process.argv[2] || 'dashboard';

// Ensure runtime dirs exist
['pids', 'commands', 'results'].forEach(d => {
  fs.mkdirSync(path.join(TRIO_DIR, d), { recursive: true });
});

switch (arg) {
  case 'dashboard': {
    const server = spawn('node', [path.join(ROOT, 'scripts', 'dashboard-server.js')], {
      env: { ...process.env, TRIO_DIR },
      stdio: 'inherit',
      detached: false,
    });
    setTimeout(() => {
      const url = 'http://localhost:3333';
      const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
      try { execSync(`${cmd} ${url}`, { stdio: 'ignore' }); } catch {}
      console.log(`Dashboard is running at ${url}`);
    }, 1000);
    process.on('SIGINT', () => { server.kill(); process.exit(); });
    process.on('SIGTERM', () => { server.kill(); process.exit(); });
    break;
  }
  case 'start': {
    const prompt = process.argv.slice(3).join(' ');
    if (!prompt) { console.error('Usage: llmtrio start "prompt"'); process.exit(1); }
    spawn('node', [path.join(ROOT, 'scripts', 'octopus-core.js'), 'start', ...process.argv.slice(3)], {
      env: { ...process.env, TRIO_DIR },
      stdio: 'inherit',
    });
    break;
  }
  case 'task': {
    const agent = process.argv[3] || 'claude';
    spawn('node', [path.join(ROOT, 'scripts', 'octopus-core.js'), 'task', agent, ...process.argv.slice(4)], {
      env: { ...process.env, TRIO_DIR },
      stdio: 'inherit',
    });
    break;
  }
  case 'status': {
    const stateFile = path.join(TRIO_DIR, 'state.json');
    if (fs.existsSync(stateFile)) {
      console.log(JSON.stringify(JSON.parse(fs.readFileSync(stateFile, 'utf8')), null, 2));
    } else {
      console.log('No workflow has been run yet.');
    }
    break;
  }
  case 'stop': {
    const pidDir = path.join(TRIO_DIR, 'pids');
    if (fs.existsSync(pidDir)) {
      fs.readdirSync(pidDir).filter(f => f.endsWith('.pid')).forEach(f => {
        const pid = parseInt(fs.readFileSync(path.join(pidDir, f), 'utf8'));
        try { process.kill(pid, 'SIGTERM'); console.log(`Stopped ${f.replace('.pid', '')} (PID ${pid})`); } catch {}
        fs.unlinkSync(path.join(pidDir, f));
      });
    }
    console.log('All processes stopped.');
    break;
  }
  case 'login': {
    const status = getAuthStatus();
    console.log('=== LLMTrio — CLI Authentication Status ===\n');
    for (const name of ['claude', 'codex', 'gemini']) {
      const info = status[name];
      const label = name.charAt(0).toUpperCase() + name.slice(1);
      if (!info.installed) {
        console.log(`${label} ... ✗ Not installed`);
      } else if (info.authenticated) {
        console.log(`${label} ... ✓ Authenticated`);
      } else {
        console.log(`${label} ... ⚠ Installed, needs auth`);
      }
    }
    console.log('\n=== Done ===');
    break;
  }
  default:
    console.log(`LLMTrio — Multi-LLM Orchestration

Usage:
  llmtrio                    Open dashboard
  llmtrio start "prompt"     Start full workflow
  llmtrio task agent "prompt" Run single agent task
  llmtrio login              Check CLI auth status
  llmtrio status             Show current state
  llmtrio stop               Stop all processes`);
}
