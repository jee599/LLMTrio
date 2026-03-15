const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const WHICH_CMD = process.platform === 'win32' ? 'where' : 'which';

function checkCli(cmd) {
  try {
    const p = execSync(`${WHICH_CMD} ${cmd}`, { stdio: 'pipe' }).toString().trim().split('\n')[0];
    let version = '';
    try { version = execSync(`${cmd} --version`, { stdio: 'pipe' }).toString().trim().split('\n')[0]; } catch {}
    return { installed: true, path: p, version };
  } catch {
    return { installed: false };
  }
}

function checkAuth(provider) {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  switch (provider) {
    case 'claude':
      return fs.existsSync(path.join(home, '.claude', '.credentials.json')) || !!process.env.ANTHROPIC_API_KEY;
    case 'codex':
      return !!process.env.OPENAI_API_KEY || fs.existsSync(path.join(home, '.codex', 'auth.json'));
    case 'gemini':
      return !!process.env.GEMINI_API_KEY || !!process.env.GOOGLE_API_KEY;
    default:
      return false;
  }
}

function getAuthStatus() {
  const agents = ['claude', 'codex', 'gemini'];
  const status = {};
  for (const agent of agents) {
    const cli = checkCli(agent);
    const authed = cli.installed && checkAuth(agent);
    status[agent] = { ...cli, authenticated: authed };
  }
  status.ready = (status.claude.authenticated) || (status.codex.authenticated);
  return status;
}

module.exports = { checkCli, checkAuth, getAuthStatus };
