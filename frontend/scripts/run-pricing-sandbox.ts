import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { parse } from 'dotenv';
import { Pool } from 'pg';

import { buildPricingSandboxEnvironment } from './_lib/pricing-sandbox';
import { seedPricingSandbox } from './_lib/seed-pricing-sandbox';

async function main() {
  const root = resolve('.');
  const frontend = join(root, 'frontend');
  const port = Number(process.env.PRICING_SANDBOX_PORT || '3106');
  const directory = await mkdtemp(join(tmpdir(), 'maxvideoai-pricing-sandbox-'));
  const data = join(directory, 'data');
  const socket = join(directory, 'socket');
  await mkdir(socket);
  const run = (command: string, args: string[]) => {
    const result = spawnSync(command, args, { encoding: 'utf8', stdio: 'pipe' });
    if (result.status !== 0) throw new Error(`${command} failed: ${result.stderr || result.error?.message || ''}`);
  };
  run('initdb', ['-A', 'trust', '-U', 'postgres', '-D', data, '--no-locale', '--encoding=UTF8']);
  run('pg_ctl', ['-D', data, '-l', join(directory, 'postgres.log'), '-o', `-F -k ${socket} -c listen_addresses='' -c max_locks_per_transaction=1024`, '-w', 'start']);
  const databaseUrl = `postgresql://postgres@localhost/postgres?host=${encodeURIComponent(socket)}`;
  const fileVariables: Record<string, string> = {};
  for (const name of ['.env', '.env.local', '.env.development', '.env.development.local']) {
    try { Object.assign(fileVariables, parse(await readFile(join(frontend, name)))); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  const environment = buildPricingSandboxEnvironment({ parent: process.env, fileVariables, databaseUrl, port });
  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const bootstrap = spawnSync(join(root, 'node_modules/.bin/tsx'), [
      '--tsconfig', 'frontend/tsconfig.json', 'scripts/bootstrap-application-schema.ts', '--allow-local-postgres-test',
    ], { cwd: root, env: { ...environment, NODE_ENV: 'test', APPLICATION_DATABASE_URL: databaseUrl }, encoding: 'utf8' });
    if (bootstrap.status !== 0) throw new Error(`Local schema bootstrap failed: ${bootstrap.stderr}`);
    for (const migration of ['12_app_settings.sql', '27_pricing_admin_cockpit.sql', '54_customer_tariff_cells.sql', '55_customer_tariff_versions.sql']) {
      await pool.query(await readFile(join(root, 'neon/migrations', migration), 'utf8'));
    }
    await pool.query(`CREATE TABLE IF NOT EXISTS user_roles (user_id TEXT NOT NULL, role TEXT NOT NULL);
      INSERT INTO user_roles VALUES ('11111111-1111-4111-8111-111111111111', 'admin');`);
    // A local fixture for comparison only. This does not import customer records or remote credentials.
    await pool.query(`INSERT INTO app_pricing_rules
      (id, margin_percent, margin_flat_cents, surcharge_audio_percent, surcharge_upscale_percent, currency)
      VALUES ('default', 0.3, 0, 0.2, 0.5, 'USD')
      ON CONFLICT (id) DO UPDATE SET margin_percent = 0.3, margin_flat_cents = 0,
      surcharge_audio_percent = 0.2, surcharge_upscale_percent = 0.5, currency = 'USD'`);
    if (process.env.PRICING_SANDBOX_BASELINE) {
      const count = await seedPricingSandbox(pool, resolve(process.env.PRICING_SANDBOX_BASELINE));
      console.info(`[pricing-sandbox] ${count} recorded customer prices staged. Activation remains off.`);
    }
    // Keep future direct `next dev` or builds in this worktree isolated too.
    // The original credentials are retained only in a private local backup.
    const originalEnvironment = await readFile(join(frontend, '.env.local')).catch(() => null);
    if (originalEnvironment) await writeFile(join(directory, 'original.env.local'), originalEnvironment, { mode: 0o600 });
    const persistedKeys = new Set([...Object.keys(fileVariables), 'DATABASE_URL', 'NEXT_PUBLIC_API_BASE',
      'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_ENABLE_CLARITY',
      'NEXT_PUBLIC_RESULT_PROVIDER', 'RESULT_PROVIDER', 'PAYMENT_MODE', 'LOCAL_ADMIN_BYPASS',
      'LOCAL_ADMIN_BYPASS_USER_ID', 'PRICING_SANDBOX']);
    const stagedEnvironment = join(frontend, '.env.pricing-sandbox.tmp');
    await writeFile(stagedEnvironment, '# Isolated local pricing sandbox; external credentials disabled.\n' +
      [...persistedKeys].map((key) => `${key}=${JSON.stringify(environment[key] ?? '')}`).join('\n') + '\n', { mode: 0o600 });
    await rename(stagedEnvironment, join(frontend, '.env.local'));
    await writeFile(join(directory, 'local.env'), `DATABASE_URL=${databaseUrl}\n`, { mode: 0o600 });
    console.info(`[pricing-sandbox] Local PostgreSQL ready. Runtime directory: ${directory}`);
    console.info(`[pricing-sandbox] Admin: http://localhost:${port}/admin/pricing. External credentials disabled.`);
    const child = spawn(join(frontend, 'node_modules/.bin/next'), ['dev', '-p', String(port), '-H', '127.0.0.1'], {
      cwd: frontend, env: environment, stdio: 'inherit',
    });
    const stop = () => child.kill('SIGTERM');
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
    const code = await new Promise<number | null>((done, reject) => { child.once('exit', done); child.once('error', reject); });
    process.exitCode = code ?? 0;
  } finally {
    await pool.end();
    spawnSync('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop'], { stdio: 'ignore' });
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Pricing sandbox failed');
  process.exitCode = 1;
});
