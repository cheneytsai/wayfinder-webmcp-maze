/**
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtimeDir = resolve(process.env.MAZE_RUNTIME_DIR ?? resolve(root, '.runtime'));
const statePath = resolve(runtimeDir, 'state.json');
const port = Number(process.env.PORT ?? 8789);
const localOrigin = `http://127.0.0.1:${port}`;
const isAlive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
const readState = () => { try { return JSON.parse(readFileSync(statePath, 'utf8')); } catch { return undefined; } };
async function healthy() {
  try {
    const response = await fetch(`${localOrigin}/health`, { signal: AbortSignal.timeout(1500) });
    return response.ok && (await response.json()).name === 'webmcp-maze';
  } catch { return false; }
}
function record(state) { writeFileSync(statePath, JSON.stringify(state, null, 2), { mode: 0o600 }); }

async function supervise() {
  const binary = process.env.CLOUDFLARED_BIN ?? 'cloudflared';
  const tunnel = spawn(binary, ['tunnel', '--url', localOrigin, '--no-autoupdate'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  let server, origin, output = '', stopping = false;
  const children = [tunnel];
  const state = { status: 'starting', supervisorPid: process.pid, tunnelPid: tunnel.pid, port, startedAt: new Date().toISOString() };
  record(state);
  function shutdown(reason, code = 1) {
    if (stopping) return;
    stopping = true;
    record({ ...state, status: 'stopped', reason });
    children.forEach(child => { if (child.exitCode === null) child.kill('SIGTERM'); });
    setTimeout(() => process.exit(code), 2000).unref();
  }
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => shutdown(signal, 0));
  tunnel.on('error', error => shutdown(`Tunnel failed: ${error.message}`));
  tunnel.on('exit', code => shutdown(`Tunnel exited (${code}); run npm run local:start to get a new URL.`));
  const startupTimeout = setTimeout(() => shutdown('Tunnel startup timed out.'), 60000);
  async function consume(chunk) {
    process.stdout.write(chunk);
    output = (output + chunk.toString()).slice(-16000);
    if (origin) return;
    const match = output.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com\b/);
    if (!match) return;
    origin = match[0];
    state.publicOrigin = origin;
    state.mcpUrl = `${origin}/mcp`;
    server = spawn(process.execPath, ['--watch', '--import', 'tsx', 'server/index.ts'], { cwd: root, env: { ...process.env, PORT: String(port), PUBLIC_ORIGIN: origin }, stdio: ['ignore', 'inherit', 'inherit'] });
    children.push(server);
    state.serverPid = server.pid;
    server.on('error', error => shutdown(`Server failed: ${error.message}`));
    server.on('exit', code => shutdown(`Server exited (${code}).`));
    for (let i = 0; i < 100 && !stopping; i++) {
      if (await healthy()) {
        clearTimeout(startupTimeout);
        state.status = 'ready';
        record(state);
        console.log(`Ready: ${state.mcpUrl}`);
        return;
      }
      await delay(100);
    }
    shutdown('Server startup timed out.');
  }
  tunnel.stdout.on('data', chunk => { void consume(chunk).catch(error => shutdown(error.message)); });
  tunnel.stderr.on('data', chunk => { void consume(chunk).catch(error => shutdown(error.message)); });
}

async function main() {
  mkdirSync(runtimeDir, { recursive: true });
  const command = process.argv[2] ?? 'status';
  if (command === '--supervise') return supervise();
  const state = readState();
  const running = state?.status === 'ready' && isAlive(state.supervisorPid) && isAlive(state.serverPid) && isAlive(state.tunnelPid) && await healthy();
  if (command === 'status') {
    console.log(JSON.stringify({ ...state, running: Boolean(running) }, null, 2));
    if (!running) process.exitCode = 1;
    return;
  }
  if (command !== 'start') throw new Error('Use start or status.');
  if (running) { console.log(`Already running: ${state.mcpUrl}`); return; }
  if (state?.status === 'starting' && isAlive(state.supervisorPid)) throw new Error('Startup is already in progress. Check .runtime/runtime.log.');
  if (await healthy()) throw new Error(`A maze server already uses port ${port}. Stop that server or choose another PORT.`);
  if (!existsSync(resolve(root, 'dist-widget/widget.html'))) throw new Error('Run npm run build first.');
  const log = openSync(resolve(runtimeDir, 'runtime.log'), 'a', 0o600);
  const child = spawn(process.execPath, [fileURLToPath(import.meta.url), '--supervise'], { cwd: root, env: process.env, detached: true, stdio: ['ignore', log, log] });
  child.unref();
  for (let i = 0; i < 650; i++) {
    const next = readState();
    if (next?.supervisorPid === child.pid) {
      if (next.status === 'ready') { console.log(JSON.stringify(next, null, 2)); return; }
      if (next.status === 'stopped') throw new Error(next.reason);
    }
    if (!isAlive(child.pid)) throw new Error('Background startup failed. See .runtime/runtime.log.');
    await delay(100);
  }
  throw new Error('Background startup timed out. See .runtime/runtime.log.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
