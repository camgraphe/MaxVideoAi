import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';
import { startDisposablePostgres } from './disposable-postgres';

export async function createTurnstileMigrationFixture() {
  const pg = await startDisposablePostgres('ts-migrate');
  const folder = mkdtempSync(join(tmpdir(), 'ts-migrate-js-'));
  const shared = globalThis as typeof globalThis & { __turnstileMigrationPool?: typeof pg.pool };
  shared.__turnstileMigrationPool = pg.pool;
  const keys = ['CHECKOUT_CAPTCHA_MODE', 'TURNSTILE_SECRET_KEY', 'NEXT_PUBLIC_TURNSTILE_SITE_KEY',
    'TURNSTILE_LEGACY_SITE_KEY', 'TURNSTILE_SECONDARY_SITE_KEY', 'TURNSTILE_SECONDARY_SECRET_KEY', 'TURNSTILE_DIAGNOSTICS_ENABLED'] as const;
  const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const savedFetch = globalThis.fetch;
  const providerCalls: Array<{ secret: string; token: string }> = [];
  Object.assign(process.env, { CHECKOUT_CAPTCHA_MODE: 'progressive', TURNSTILE_SECRET_KEY: 'secret-A',
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'public-A', TURNSTILE_LEGACY_SITE_KEY: 'public-A',
    TURNSTILE_SECONDARY_SITE_KEY: 'public-B', TURNSTILE_SECONDARY_SECRET_KEY: 'secret-B', TURNSTILE_DIAGNOSTICS_ENABLED: '1' });
  globalThis.fetch = async (url, init) => {
    if (url !== 'https://challenges.cloudflare.com/turnstile/v0/siteverify') throw new Error('External request forbidden');
    const form = init?.body as FormData;
    const secret = String(form.get('secret'));
    const token = String(form.get('response'));
    providerCalls.push({ secret, token });
    if (token.includes('network-error')) throw new TypeError('offline');
    const success = token.startsWith(secret === 'secret-A' ? 'A:' : secret === 'secret-B' ? 'B:' : 'NEVER:') && !token.includes('expired');
    // Deliberately accepts repeated tokens: the database must enforce one use independently.
    return new Response(JSON.stringify({ success, hostname: 'localhost', 'error-codes': success ? [] : ['invalid-input-response'] }), { status: 200 });
  };
  await pg.pool.query(readFileSync('neon/migrations/18_checkout_abuse_guard.sql', 'utf8'));
  await pg.pool.query("CREATE TABLE checkout_interaction_events (user_id text, event_name text, metadata jsonb DEFAULT '{}', created_at timestamptz DEFAULT now())");
  await pg.pool.query(readFileSync('neon/migrations/68_checkout_captcha_token_once.sql', 'utf8'));
  const requireFrontend = createRequire(resolve('frontend/package.json'));
  async function load(entry: string) {
    const outfile = join(folder, `${entry.includes('/api/') ? 'route' : 'guard'}.cjs`);
    await build({ entryPoints: [entry], outfile, bundle: true, platform: 'node', format: 'cjs', packages: 'external',
      tsconfig: 'frontend/tsconfig.json', plugins: [{ name: 'isolated-boundaries', setup(b) {
        b.onResolve({ filter: /^next\/server$/ }, () => ({ path: requireFrontend.resolve('next/server'), external: true }));
        b.onResolve({ filter: /^(@\/lib\/db|@\/server\/admin)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
        b.onResolve({ filter: /stripe|wallet\/route|wallet-ledger/ }, args => { throw new Error(`Payment dependency forbidden: ${args.path}`); });
        b.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ loader: 'ts', contents: args.path === '@/lib/db'
          ? 'export async function query(sql,params){return (await globalThis.__turnstileMigrationPool.query(sql,params)).rows}'
          : `export class AdminAuthError extends Error { constructor(message,status){super(message);this.status=status} }
             export async function requireAdmin(request){const role=request.headers.get('x-test-role');if(role!=='admin')throw new AdminAuthError('denied',role?403:401);return 'diagnostic-admin'}
             export function adminErrorToResponse(){throw new Error('Use non-caching diagnostic response')}` }));
      }}] });
    return requireFrontend(outfile);
  }
  return { pg, folder, providerCalls, load, async cleanup() {
    globalThis.fetch = savedFetch;
    for (const key of keys) { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; }
    delete shared.__turnstileMigrationPool;
    rmSync(folder, { recursive: true, force: true });
    await pg.cleanup();
  }};
}
