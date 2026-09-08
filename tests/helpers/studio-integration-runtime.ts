import assert from 'node:assert/strict';
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, symlink } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { startDisposablePostgres, type DisposablePostgres } from './disposable-postgres';
import { startStudioAuthFixture } from './studio-auth-fixture';
import { STUDIO_PRIVATE_STORAGE_ENV } from './studio-private-storage-fixture';

async function freeLoopbackPort(): Promise<number> {
  const probe = createServer();
  await new Promise<void>((resolve, reject) => { probe.once('error', reject); probe.listen(0, '127.0.0.1', resolve); });
  const port = (probe.address() as { port: number }).port;
  await new Promise<void>((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  assert.notEqual(port, 3026);
  return port;
}

async function archiveSnapshot(root: string, target: string, revision: string) {
  // Bulk Git export only: ignored files and all environment files stay outside the snapshot.
  const archive = spawn('git', ['archive', '--format=tar', revision, 'frontend', 'packages', 'content', 'package.json', 'pnpm-workspace.yaml'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  const extract = spawn('tar', ['-x', '-C', target], { stdio: ['pipe', 'ignore', 'pipe'] });
  archive.stdout!.pipe(extract.stdin!);
  const completed = (child: ChildProcess) => new Promise<void>((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`Snapshot process exited ${code}.`)));
  });
  await Promise.all([completed(archive), completed(extract)]);
  await symlink(join(root, 'node_modules'), join(target, 'node_modules'), 'dir');
  await symlink(join(root, 'frontend/node_modules'), join(target, 'frontend/node_modules'), 'dir');
}

/** Owns a committed Next snapshot, fresh local DB and test-only Auth, never an existing server. */
export async function startStudioIntegrationRuntime(options: {
  initializeDatabase(database: DisposablePostgres): Promise<void>;
  revision?: string;
  /** Test-only opt-in; host/resource always derive from this owned loopback child. */
  mcp?: { studioMontageCreation?: boolean };
  /** Local SDK signing only. The browser fixture must intercept the exact fake bucket. */
  privateStorage?: boolean;
}) {
  assert.equal(process.versions.node.split('.')[0], '22', 'Use the project Node 22 runtime.');
  const root = resolve('.');
  for (const directory of [root, join(root, 'frontend')]) {
    for (const name of ['.env', '.env.local', '.env.development', '.env.development.local', '.env.production', '.env.production.local']) {
      assert.equal(existsSync(join(directory, name)), false, 'Studio integration refuses environment files.');
    }
  }
  const revisionResult = spawnSync('git', ['rev-parse', '--verify', `${options.revision ?? 'HEAD'}^{commit}`], { cwd: root, encoding: 'utf8' });
  assert.equal(revisionResult.status, 0);
  const revision = revisionResult.stdout.trim();
  assert.match(revision, /^[a-f0-9]{40}$/);
  const temporaryRoot = await mkdtemp(join(tmpdir(), 'studio-route-'));
  let database: DisposablePostgres | undefined;
  let auth: Awaited<ReturnType<typeof startStudioAuthFixture>> | undefined;
  let child: ChildProcess | undefined;
  let childExit: Promise<void> | undefined;
  let closing: Promise<void> | undefined;
  let logs = '';

  async function close() {
    if (closing) return closing;
    closing = (async () => {
      if (child && child.exitCode === null && child.signalCode === null && child.pid) {
        // The detached process group was created by this helper, not discovered from a port.
        try { process.kill(-child.pid, 'SIGTERM'); } catch { /* already exited */ }
        const exited = await Promise.race([childExit!.then(() => true), delay(10_000, undefined, { ref: false }).then(() => false)]);
        if (!exited) {
          try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already exited */ }
          await childExit;
        }
      }
      await auth?.close();
      await database?.cleanup();
      // Exact unique directory created above; includes only an exported snapshot and its build output.
      await rm(temporaryRoot, { recursive: true, force: true });
    })();
    return closing;
  }

  try {
    database = await startDisposablePostgres('strt');
    const socket = new URL(database.databaseUrl).searchParams.get('host');
    assert.ok(socket?.includes('/strt-') && socket.endsWith('/socket'));
    const settings = await database.pool.query(`SELECT current_setting('server_version_num')::int AS version,
      current_setting('listen_addresses') AS listeners, current_setting('data_directory') AS directory,
      current_setting('unix_socket_directories') AS sockets`);
    assert.ok(settings.rows[0].version >= 170000 && settings.rows[0].version < 180000);
    assert.equal(settings.rows[0].listeners, '');
    assert.equal(settings.rows[0].sockets, socket);
    assert.equal(settings.rows[0].directory, socket!.replace(/\/socket$/, '/data'));
    await options.initializeDatabase(database);
    await archiveSnapshot(root, temporaryRoot, revision);
    const port = await freeLoopbackPort();
    const origin = `http://127.0.0.1:${port}`;
    // NextURL normalizes loopback rewrites to localhost. Keep that authority while tests
    // connect to our exact IPv4 child and explicitly send this Host (no DNS/IPv6 listener reuse).
    const mcpHost = `localhost:${port}`;
    const browserOrigin = options.mcp ? `http://${mcpHost}` : origin;
    auth = await startStudioAuthFixture({ appOrigin: browserOrigin });
    const requireFrontend = createRequire(join(root, 'frontend/package.json'));
    const next = requireFrontend.resolve('next/dist/bin/next');
    const environment = {
      PATH: `${dirname(process.execPath)}:${process.env.PATH ?? '/usr/bin:/bin'}`,
      ...(process.env.HOME ? { HOME: process.env.HOME } : {}),
      ...(process.env.TMPDIR ? { TMPDIR: process.env.TMPDIR } : {}),
      NODE_ENV: 'development', NEXT_TELEMETRY_DISABLED: '1',
      NEXT_PUBLIC_SUPABASE_URL: auth.origin, NEXT_PUBLIC_SUPABASE_ANON_KEY: auth.anonKey,
      NEXT_PUBLIC_SITE_URL: browserOrigin, SITE_URL: browserOrigin,
      NEXT_PUBLIC_VISITOR_WORKSPACE_ACCESS: 'false',
      NEXT_PUBLIC_ENV_LABEL: 'Disposable Studio integration',
      DATABASE_URL: database.databaseUrl,
      ...(options.privateStorage === true ? { ...STUDIO_PRIVATE_STORAGE_ENV, AWS_EC2_METADATA_DISABLED: 'true' } : {}),
      ...(options.mcp ? {
        MCP_LOCAL_ENABLED: 'true', MCP_API_HOST: mcpHost, MCP_RESOURCE_URL: `http://${mcpHost}/mcp`,
        STUDIO_MONTAGE_LOCAL_ENABLED: options.mcp.studioMontageCreation === true ? 'true' : 'false',
      } : {}),
    };
    child = spawn(process.execPath, [next, 'dev', '--hostname', '127.0.0.1', '--port', String(port)], {
      cwd: join(temporaryRoot, 'frontend'), env: environment, stdio: ['ignore', 'pipe', 'pipe'], detached: true,
    });
    childExit = new Promise<void>((resolve, reject) => { child!.once('exit', () => resolve()); child!.once('error', reject); });
    child.stdout!.on('data', (value) => { logs = (logs + value.toString()).slice(-100_000); });
    child.stderr!.on('data', (value) => { logs = (logs + value.toString()).slice(-100_000); });
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline) {
      if (child.exitCode !== null || child.signalCode !== null) throw new Error(`Isolated Next exited before readiness. ${logs.slice(-4000)}`);
      // A failed bind must never let an unrelated HTTP listener satisfy readiness.
      if (!/Ready in/u.test(logs)) { await delay(200); continue; }
      try {
        const response = await fetch(`${origin}/api/studio/projects`, { signal: AbortSignal.timeout(2000) });
        if (response.status === 401) return { origin, browserOrigin, mcpHost, revision, database, auth, close, readLogs: () => logs };
      } catch { /* No existing server is reused; wait for this exact child to become ready. */ }
      await delay(200);
    }
    throw new Error(`Isolated Studio route readiness timed out. ${logs.slice(-4000)}`);
  } catch (error) {
    await close();
    throw error;
  }
}
