#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  copyFileSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:net';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixtureConfigPath = join(sourceRoot, 'tests/fixtures/mcp-launch-publication-states.json');
const publicationPath = join(sourceRoot, 'frontend/config/mcp-publication.json');
const artifactDir = join(sourceRoot, 'output/playwright/mcp-acquisition');
const fixtureStates = JSON.parse(readFileSync(fixtureConfigPath, 'utf8'));
const expectedKeys = [
  'publicMarketing',
  'publicIndexing',
  'transport',
  'oauth',
  'discovery',
  'paidGeneration',
  'trial',
  'referenceUploads',
];

for (const [state, publication] of Object.entries(fixtureStates)) {
  const keys = Object.keys(publication);
  if (
    JSON.stringify(keys) !== JSON.stringify(expectedKeys) ||
    Object.values(publication).some((value) => typeof value !== 'boolean')
  ) {
    throw new Error(
      `Invalid ${state} publication fixture: expected exactly ${expectedKeys.join(', ')} boolean flags`,
    );
  }
}

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}

function parseMode() {
  const mode = argumentValue('--mode');
  if (!mode || !(mode in fixtureStates)) {
    throw new Error(`Use --mode with one of: ${Object.keys(fixtureStates).join(', ')}`);
  }
  return mode;
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function assertCommittedPublicationIsGated(stage) {
  const publication = JSON.parse(readFileSync(publicationPath, 'utf8'));
  if (JSON.stringify(publication) !== JSON.stringify(fixtureStates.gated)) {
    throw new Error(`${stage}: checked-in publication flags are not the tracked all-false state`);
  }
  const diff = spawnSync('git', ['diff', '--exit-code', '--', 'frontend/config/mcp-publication.json'], {
    cwd: sourceRoot,
    encoding: 'utf8',
  });
  if (diff.status !== 0) {
    throw new Error(`${stage}: frontend/config/mcp-publication.json has an uncommitted change`);
  }
}

function listWorkspaceFiles() {
  const result = spawnSync('git', ['ls-files', '-co', '--exclude-standard', '-z'], {
    cwd: sourceRoot,
    encoding: 'buffer',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`git ls-files failed: ${result.stderr?.toString() ?? 'unknown error'}`);
  }
  return result.stdout.toString().split('\0').filter(Boolean);
}

function copyWorkspaceFile(path, fixtureRoot) {
  const source = resolve(sourceRoot, path);
  const destination = resolve(fixtureRoot, path);
  const destinationRelative = relative(fixtureRoot, destination);
  if (destinationRelative.startsWith(`..${sep}`) || destinationRelative === '..') {
    throw new Error(`Refusing to copy path outside fixture: ${path}`);
  }
  mkdirSync(dirname(destination), { recursive: true });
  const stat = lstatSync(source);
  if (stat.isSymbolicLink()) {
    symlinkSync(readlinkSync(source), destination);
    return;
  }
  copyFileSync(source, destination);
  chmodSync(destination, stat.mode);
}

function createFixture(mode) {
  const fixtureRoot = mkdtempSync(join(tmpdir(), `maxvideoai-mcp-launch-${mode}-`));
  for (const path of listWorkspaceFiles()) copyWorkspaceFile(path, fixtureRoot);
  symlinkSync(join(sourceRoot, 'node_modules'), join(fixtureRoot, 'node_modules'), 'dir');
  symlinkSync(
    join(sourceRoot, 'frontend/node_modules'),
    join(fixtureRoot, 'frontend/node_modules'),
    'dir',
  );
  writeFileSync(
    join(fixtureRoot, 'frontend/config/mcp-publication.json'),
    `${JSON.stringify(fixtureStates[mode], null, 2)}\n`,
  );
  return fixtureRoot;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? sourceRoot,
    env: options.env ?? process.env,
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${basename(command)} ${args.join(' ')} exited ${result.status ?? 'without a status'}`);
  }
}

function canListen(port) {
  return new Promise((resolvePromise) => {
    const probe = createServer();
    probe.unref();
    probe.once('error', () => resolvePromise(false));
    probe.listen({ host: '127.0.0.1', port }, () => {
      probe.close(() => resolvePromise(true));
    });
  });
}

async function findAvailablePort(requestedPort) {
  if (requestedPort !== null) {
    const port = Number.parseInt(requestedPort, 10);
    if (!Number.isInteger(port) || port < 1024 || port > 65535 || !(await canListen(port))) {
      throw new Error(`Requested fixture port is invalid or already in use: ${requestedPort}`);
    }
    return port;
  }
  return await new Promise((resolvePromise, reject) => {
    const probe = createServer();
    probe.unref();
    probe.once('error', reject);
    probe.listen({ host: '127.0.0.1', port: 0 }, () => {
      const address = probe.address();
      if (!address || typeof address === 'string') {
        probe.close();
        reject(new Error('Unable to allocate a fixture port'));
        return;
      }
      const { port } = address;
      probe.close(() => resolvePromise(port));
    });
  });
}

function startFixtureServer(fixtureRoot, port, mode) {
  const server = spawn('npm', ['--prefix', 'frontend', 'run', 'start', '--', '-p', String(port)], {
    cwd: fixtureRoot,
    env: process.env,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const prefix = `[mcp-launch:${mode}] `;
  server.stdout.on('data', (chunk) => process.stdout.write(`${prefix}${chunk}`));
  server.stderr.on('data', (chunk) => process.stderr.write(`${prefix}${chunk}`));
  return server;
}

async function waitForReady(server, baseURL) {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Fixture server exited ${server.exitCode} before readiness`);
    try {
      const response = await fetch(`${baseURL}/robots.txt`);
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 250));
  }
  throw new Error(`Fixture server did not become ready at ${baseURL}`);
}

async function stopFixtureServer(server, port) {
  if (server?.pid) {
    try {
      process.kill(-server.pid, 'SIGTERM');
    } catch (error) {
      if (error?.code !== 'ESRCH') throw error;
    }
  }
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (await canListen(port)) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  if (server?.pid) {
    try {
      process.kill(-server.pid, 'SIGKILL');
    } catch (error) {
      if (error?.code !== 'ESRCH') throw error;
    }
  }
  if (!(await canListen(port))) throw new Error(`Fixture server still owns port ${port} after cleanup`);
}

const mode = parseMode();
const runLighthouse = process.argv.includes('--lighthouse');
if (runLighthouse && mode !== 'enabled') {
  throw new Error('--lighthouse requires --mode enabled');
}
const sourcePublicationHash = sha256(publicationPath);
assertCommittedPublicationIsGated('before fixture');

let fixtureRoot = null;
let server = null;
let port = null;
let interrupted = false;

function emergencyCleanup(signal) {
  if (interrupted) return;
  interrupted = true;
  if (server?.pid) {
    try {
      process.kill(-server.pid, 'SIGTERM');
    } catch {
      // The process group already exited.
    }
  }
  if (fixtureRoot) rmSync(fixtureRoot, { recursive: true, force: true });
  process.exit(signal === 'SIGINT' ? 130 : 143);
}

process.once('SIGINT', () => emergencyCleanup('SIGINT'));
process.once('SIGTERM', () => emergencyCleanup('SIGTERM'));

try {
  fixtureRoot = createFixture(mode);
  port = await findAvailablePort(argumentValue('--port'));
  const baseURL = `http://127.0.0.1:${port}`;
  process.stdout.write(`[mcp-launch:${mode}] fixture=${fixtureRoot} port=${port}\n`);
  run('npm', ['--prefix', 'frontend', 'run', 'build'], { cwd: fixtureRoot });
  server = startFixtureServer(fixtureRoot, port, mode);
  await waitForReady(server, baseURL);
  mkdirSync(artifactDir, { recursive: true });
  run(
    join(fixtureRoot, 'node_modules/.bin/playwright'),
    ['test', 'tests/e2e/mcp-acquisition.spec.ts', '--reporter=list'],
    {
      cwd: fixtureRoot,
      env: {
        ...process.env,
        MCP_E2E_MODE: mode,
        MCP_E2E_BASE_URL: baseURL,
        MCP_E2E_ARTIFACT_DIR: artifactDir,
      },
    },
  );
  if (runLighthouse) {
    run(
      join(fixtureRoot, 'frontend/node_modules/.bin/lhci'),
      [
        'collect',
        `--url=${baseURL}/mcp`,
        `--url=${baseURL}/integrations/claude`,
        `--url=${baseURL}/integrations/codex`,
        '--numberOfRuns=1',
        '--settings.chromeFlags=--headless --no-sandbox',
      ],
      { cwd: join(sourceRoot, 'frontend') },
    );
  }
} finally {
  if (server && port !== null) await stopFixtureServer(server, port);
  if (fixtureRoot) rmSync(fixtureRoot, { recursive: true, force: true });
  assertCommittedPublicationIsGated('after fixture');
  if (sha256(publicationPath) !== sourcePublicationHash) {
    throw new Error('Checked-in publication config changed while the isolated fixture ran');
  }
}
