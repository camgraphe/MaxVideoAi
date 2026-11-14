import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';

test('adult consent requires authenticated ownership and a fresh 18+ attestation', async t => {
  const requireFrontend = createRequire(resolve('frontend/package.json'));
  const directory = mkdtempSync(join(tmpdir(), 'adult-consent-'));
  const state = {
    userId: 'account-a' as string | null,
    age: 'min_age:15',
    writes: [] as Array<{ userId: string; entries: Array<{ docKey: string; docVersion: string; accepted: boolean }> }>,
    queries: [] as Array<{ sql: string; params: unknown[] }>,
  };
  const globals = globalThis as typeof globalThis & { __adultConsent?: typeof state };
  globals.__adultConsent = state;
  t.after(() => { delete globals.__adultConsent; rmSync(directory, { recursive: true, force: true }); });
  const output = join(directory, 'routes.cjs');
  await build({ stdin: { resolveDir: process.cwd(), loader: 'ts', contents: `
    export * as signup from './frontend/app/api/legal/consents/route';
    export * as reconsent from './frontend/app/api/legal/reconsent/route';` },
    outfile: output, bundle: true, platform: 'node', format: 'cjs', packages: 'external', tsconfig: 'frontend/tsconfig.json',
    plugins: [{ name: 'legal-service-boundaries', setup(builder) {
      const mocks: Record<string, string> = {
        '@/lib/supabase-ssr': 'export const getRouteAuthContext=async()=>({userId:globalThis.__adultConsent.userId});',
        '@/lib/legal': `export const LEGAL_FALLBACK_VERSIONS={terms:'2026-11-11',privacy:'2026-11-11',cookies:'2025-10-26'};
          export const getLegalDocumentUncached=async key=>({key,version:LEGAL_FALLBACK_VERSIONS[key],publishedAt:new Date('2026-11-11T00:00:00Z')});`,
        '@/server/profile': `export const getProfileSnapshot=async()=>({tosVersion:'2026-11-11',privacyVersion:'2026-11-11',cookiesVersion:'2025-10-26',ageVerified:true});`,
        '@/lib/db': `export const query=async(sql,params)=>{const s=globalThis.__adultConsent;s.queries.push({sql,params});return [{doc_key:'age_attestation',doc_version:s.age}];};`,
        '@/server/legal-consents': `export const resolveCurrentLegalVersions=async()=>({terms:'2026-11-11',privacy:'2026-11-11',cookies:'2025-10-26'});
          export const recordUserConsents=async input=>{const s=globalThis.__adultConsent;s.writes.push(input);const age=input.entries.find(e=>e.docKey==='age_attestation');if(age?.accepted)s.age=age.docVersion;};`,
      };
      builder.onResolve({ filter: /.*/ }, a => a.path in mocks ? { path: a.path, namespace: 'fixture' }
        : a.path === 'next/server' ? { path: requireFrontend.resolve(a.path), external: true } : undefined);
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, a => ({ contents: mocks[a.path], loader: 'ts' }));
    } }],
  });
  type Route = { POST(req: Request): Promise<Response>; GET(req: Request): Promise<Response> };
  const routes = requireFrontend(output) as { signup: Route; reconsent: Route };
  const request = (body?: unknown) => new Request('http://localhost/api/legal/reconsent', body === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const status = await (await routes.reconsent.GET(request())).json();
  assert.equal(status.ageConfirmationRequired, true, 'old min_age:15 and ageVerified=true do not prove 18+');
  assert.equal(status.shouldBlock, true);
  assert.equal(status.minimumAge, 18);
  assert.deepEqual(status.documents, [], 'age-only reconsent works with current documents');
  assert.equal((await routes.reconsent.POST(request({ documents: [] }))).status, 422);
  assert.equal(state.writes.length, 0);
  assert.equal((await routes.reconsent.POST(request({ documents: [], ageConfirmed: 'true' }))).status, 422);
  assert.equal((await routes.reconsent.POST(request({ documents: [], ageConfirmed: true, userId: 'forged', marketingOptIn: true }))).status, 200);
  assert.equal(state.writes[0].userId, 'account-a');
  assert.deepEqual(state.writes[0].entries.map(e => [e.docKey, e.docVersion, e.accepted]), [['age_attestation', 'min_age:18', true], ['marketing', '2026-11-11', true]]);
  assert.equal((await (await routes.reconsent.GET(request())).json()).needsReconsent, false);
  assert.ok(state.queries.every(q => /accepted = true/.test(q.sql) && q.params[0] === 'account-a'));

  state.userId = null;
  assert.equal((await routes.signup.POST(request({ userId: 'account-a', ageConfirmed: true }))).status, 401);
  assert.equal((await routes.reconsent.POST(request({ ageConfirmed: true }))).status, 401);
  state.userId = 'account-b';
  assert.equal((await routes.signup.POST(request({ userId: 'account-a', ageConfirmed: true }))).status, 403);
  assert.equal((await routes.signup.POST(request({ userId: 'account-b', ageConfirmed: false }))).status, 422);
  assert.equal(state.writes.length, 1, 'forged owners and unchecked submissions never write consent');
  assert.equal((await routes.signup.POST(request({ userId: 'account-b', ageConfirmed: true, marketingOptIn: false }))).status, 200);
  assert.equal(state.writes[1].userId, 'account-b');
  assert.ok(state.writes[1].entries.some(e => e.docKey === 'age_attestation' && e.docVersion === 'min_age:18'));
  assert.ok(state.writes[1].entries.some(e => e.docKey === 'marketing' && !e.accepted));
});
