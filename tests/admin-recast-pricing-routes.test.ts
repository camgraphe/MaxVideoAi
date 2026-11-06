import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';

test('Recast uses authorized policy preview and server-owned confirmation actor', async t => {
  const requireFrontend = createRequire(resolve('frontend/package.json'));
  const directory = mkdtempSync(join(tmpdir(), 'recast-admin-routes-'));
  const state = { authorized: true, calls: [] as Array<{ proposal: Record<string, unknown>; fingerprint?: string; actor?: string }> };
  const globals = globalThis as typeof globalThis & { __recastAdminRoutes?: typeof state };
  globals.__recastAdminRoutes = state;
  t.after(() => { delete globals.__recastAdminRoutes; rmSync(directory, { recursive: true, force: true }); });
  const output = join(directory, 'routes.cjs');
  await build({ stdin: { resolveDir: process.cwd(), loader: 'ts', contents: `
    export { POST as preview } from './frontend/app/api/admin/pricing/preview/route';
    export { POST as confirm } from './frontend/app/api/admin/pricing/confirm/route';` },
    outfile: output, bundle: true, platform: 'node', format: 'cjs', packages: 'external', tsconfig: 'frontend/tsconfig.json',
    plugins: [{ name: 'admin-auth-and-service-boundaries', setup(builder) {
      const mocks: Record<string, string> = {
        '@/server/admin': `export async function requireAdmin(){if(!globalThis.__recastAdminRoutes.authorized) throw new Error('unauthorized');return 'authenticated-admin'}
          export function adminErrorToResponse(){return new Response('{}',{status:401})}`,
        '@/server/pricing-admin/policy-service': `export async function previewPricingPolicyChange(proposal){globalThis.__recastAdminRoutes.calls.push({proposal});return {previewFingerprint:'reviewed'}}
          export async function confirmPricingPolicyChange(proposal,fingerprint,actor){globalThis.__recastAdminRoutes.calls.push({proposal,fingerprint,actor});return {committed:true}}`,
      };
      builder.onResolve({ filter: /.*/ }, args => args.path in mocks ? { path: args.path, namespace: 'fixture' }
        : args.path === 'next/server' ? { path: requireFrontend.resolve(args.path), external: true } : undefined);
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks[args.path], loader: 'ts' }));
    } }],
  });
  const routes = requireFrontend(output) as { preview(req: Request): Promise<Response>; confirm(req: Request): Promise<Response> };
  const proposal = { operation: 'create', actorId: 'forged', rule: { id: 'recast-only', engineId: 'character-recast',
    mode: 'recast', resolution: 'video', marginPercent: 1, marginFlatCents: 0,
    surchargeAudioPercent: 0, surchargeUpscalePercent: 0, currency: 'USD' } };
  const request = (body: unknown) => new Request('http://localhost/api/admin/pricing', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await routes.preview(request(proposal))).status, 200);
  assert.equal(state.calls[0].proposal.actorId, undefined);
  assert.deepEqual(state.calls[0].proposal.rule, proposal.rule);
  assert.equal((await routes.confirm(request({ proposal, previewFingerprint: 'reviewed', actorId: 'forged' }))).status, 200);
  assert.equal(state.calls[1].actor, 'authenticated-admin');
  assert.equal(state.calls[1].fingerprint, 'reviewed');
  state.authorized = false;
  assert.equal((await routes.preview(request(proposal))).status, 401);
  assert.equal((await routes.confirm(request({ proposal, previewFingerprint: 'reviewed' }))).status, 401);
  assert.equal(state.calls.length, 2, 'unauthorized callers never reach commercial service');
});
