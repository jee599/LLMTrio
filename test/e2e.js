const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');

// Helper: create isolated .trio dir
function createTempTrio() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'llmtrio-test-'));
  ['pids', 'commands', 'results'].forEach(d => fs.mkdirSync(path.join(dir, d), { recursive: true }));
  const defaultRouting = path.join(ROOT, 'config', 'default-routing.json');
  const defaultBudget = path.join(ROOT, 'config', 'default-budget.json');
  if (fs.existsSync(defaultRouting)) fs.copyFileSync(defaultRouting, path.join(dir, 'routing.json'));
  if (fs.existsSync(defaultBudget)) fs.copyFileSync(defaultBudget, path.join(dir, 'budget.json'));
  fs.writeFileSync(path.join(dir, 'state.json'), JSON.stringify({ phase: 'idle', tasks: [], phaseProgress: 0, sessionTokens: 0 }));
  return dir;
}

// Helper: HTTP request
function request(port, method, reqPath, body) {
  return new Promise((resolve, reject) => {
    const options = { hostname: '127.0.0.1', port, path: reqPath, method, headers: {} };
    if (body) {
      const data = JSON.stringify(body);
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(data);
    }
    const req = http.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Helper: get session token from HTML
function getToken(port) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: '/', method: 'GET' }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const match = data.match(/__TRIO_TOKEN='([^']+)'/);
        resolve(match ? match[1] : '');
      });
    });
    req.on('error', reject);
    req.end();
  });
}

// Helper: wait for server to be ready
function waitForServer(port, maxMs = 8000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function attempt() {
      if (Date.now() - start > maxMs) return reject(new Error('Server did not start in time'));
      const req = http.request({ hostname: '127.0.0.1', port, path: '/', method: 'GET', timeout: 500 }, res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => resolve());
      });
      req.on('error', () => setTimeout(attempt, 200));
      req.on('timeout', () => { req.destroy(); setTimeout(attempt, 200); });
      req.end();
    }
    attempt();
  });
}

// Helper: get a random available port
function getRandomPort() {
  return new Promise((resolve, reject) => {
    const srv = http.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

// Start the dashboard-server with env-based PORT and TRIO_DIR overrides
async function startServer() {
  const trioDir = createTempTrio();
  const port = await getRandomPort();

  const serverScript = path.join(ROOT, 'scripts', 'dashboard-server.js');

  const proc = spawn(process.execPath, [serverScript], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, TRIO_PORT: String(port), TRIO_DIR: trioDir },
  });

  let stderr = '';
  proc.stdout.on('data', () => {});
  proc.stderr.on('data', d => { stderr += d.toString(); });

  await waitForServer(port);

  return { proc, port, trioDir, cleanup: () => {
    try { proc.kill('SIGTERM'); } catch {}
    try { fs.rmSync(trioDir, { recursive: true, force: true }); } catch {}
  }};
}


// ─── Tests ───

let server;

test('E2E: dashboard-server infrastructure', async (suite) => {
  server = await startServer();

  await suite.test('1. Server starts and responds with HTML containing session token', async () => {
    const token = await getToken(server.port);
    assert.ok(token, 'Session token should be present in HTML');
    assert.ok(token.length >= 16, 'Token should be at least 16 characters');
  });

  await suite.test('2. GET /api/state returns phase:idle', async () => {
    const res = await request(server.port, 'GET', '/api/state');
    assert.equal(res.status, 200);
    assert.equal(res.body.phase, 'idle');
  });

  await suite.test('3. SSE /events returns event:connected', async () => {
    const data = await new Promise((resolve, reject) => {
      const req = http.request({ hostname: '127.0.0.1', port: server.port, path: '/events', method: 'GET' }, res => {
        let buf = '';
        res.on('data', chunk => {
          buf += chunk.toString();
          if (buf.includes('event:') || buf.includes('event: ')) {
            req.destroy();
            resolve(buf);
          }
        });
        setTimeout(() => { req.destroy(); reject(new Error('SSE timeout')); }, 3000);
      });
      req.on('error', (err) => {
        if (err.code === 'ECONNRESET') return;
        reject(err);
      });
      req.end();
    });
    assert.ok(data.includes('event: connected'), 'Should receive connected event');
  });

  await suite.test('4. POST /api/command without token returns 403', async () => {
    const res = await request(server.port, 'POST', '/api/command', { type: 'prompt', content: 'test' });
    assert.equal(res.status, 403);
    assert.ok(res.body.error, 'Should have error message');
  });

  await suite.test('5. POST /api/command with valid token returns ok:true', async () => {
    const token = await getToken(server.port);
    const res = await new Promise((resolve, reject) => {
      const body = JSON.stringify({ type: 'cancel' });
      const req = http.request({
        hostname: '127.0.0.1', port: server.port, path: '/api/command', method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'X-Trio-Token': token,
        },
      }, res => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
          catch { resolve({ status: res.statusCode, body: data }); }
        });
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.ok, true);
  });

  await suite.test('6. GET /api/auth-status returns agent status object', async () => {
    const res = await request(server.port, 'GET', '/api/auth-status');
    assert.equal(res.status, 200);
    assert.ok(typeof res.body === 'object', 'Should return an object');
    const keys = Object.keys(res.body);
    assert.ok(keys.length > 0, 'Should have at least one key in auth status');
  });

  await suite.test('7. Static files /dashboard.css and /dashboard.js return 200', async () => {
    const cssRes = await request(server.port, 'GET', '/dashboard.css');
    assert.equal(cssRes.status, 200);

    const jsRes = await request(server.port, 'GET', '/dashboard.js');
    assert.equal(jsRes.status, 200);
  });

  server.cleanup();
});
