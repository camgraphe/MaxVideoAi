import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';

const requireFrontend = createRequire(resolve('frontend/package.json'));

test('tool pricing HTTP adapters preserve the selected coefficient in preview and confirmation', async (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'tool-price-routes-'));
  const fixture = { authorized: true, calls: [] as Array<{ proposal: Record<string, unknown>; fingerprint?: string; actor?: string }> };
  const globals = globalThis as typeof globalThis & { __toolPriceRouteFixture?: typeof fixture };
  globals.__toolPriceRouteFixture = fixture;
  t.after(() => { delete globals.__toolPriceRouteFixture; rmSync(directory, { recursive: true, force: true }); });
  const output = join(directory, 'routes.cjs');
  await build({
    stdin: { resolveDir: process.cwd(), loader: 'ts', contents: `
      export { POST as preview } from './frontend/app/api/admin/billing-products/preview/route';
      export { POST as confirm } from './frontend/app/api/admin/billing-products/confirm/route';` },
    outfile: output, bundle: true, platform: 'node', format: 'cjs', packages: 'external', tsconfig: 'frontend/tsconfig.json',
    plugins: [{ name: 'tool-price-http-boundaries', setup(builder) {
      const mocks: Record<string, string> = {
        '@/server/admin': `
          export async function requireAdmin() {
            if (!globalThis.__toolPriceRouteFixture.authorized) throw new Error('unauthorized');
            return 'fixture-admin';
          }
          export function adminErrorToResponse(){return new Response('{}',{status:401});}`,
        '@/server/pricing-admin/billing-product-service': `
          export async function previewBillingProductChange(proposal) {
            globalThis.__toolPriceRouteFixture.calls.push({proposal});
            return {previewFingerprint:'fixture-fingerprint'};
          }
          export async function confirmBillingProductChange(proposal,fingerprint,actor) {
            globalThis.__toolPriceRouteFixture.calls.push({proposal,fingerprint,actor});
            return {committed:true};
          }`,
      };
      builder.onResolve({ filter: /.*/ }, args => args.path in mocks ? { path: args.path, namespace: 'fixture' }
        : args.path === 'next/server' ? { path: requireFrontend.resolve(args.path), external: true } : undefined);
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks[args.path], loader: 'ts' }));
    } }],
  });
  const routes = requireFrontend(output) as { preview(req: Request): Promise<Response>; confirm(req: Request): Promise<Response> };
  const proposal = { operation: 'update', productKey: 'upscale-video-topaz', unitPriceCents: 60,
    dynamicPriceMultiplier: 3, metadata: { routing: 'untrusted' }, actorId: 'untrusted' };
  const request = (body: unknown) => new Request('http://localhost/api/admin/billing-products', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });

  await t.test('preview forwards both the minimum and coefficient without arbitrary metadata', async () => {
    assert.equal((await routes.preview(request(proposal))).status, 200);
    const call = fixture.calls.pop()!;
    assert.equal(call.proposal.unitPriceCents, 60);
    assert.equal(call.proposal.dynamicPriceMultiplier, 3);
    assert.equal(call.proposal.metadata, undefined);
    assert.equal(call.proposal.actorId, undefined);
  });
  await t.test('confirmation forwards the same coefficient, fingerprint and server actor', async () => {
    assert.equal((await routes.confirm(request({ proposal, previewFingerprint: 'fixture-fingerprint' }))).status, 200);
    const call = fixture.calls.pop()!;
    assert.equal(call.proposal.dynamicPriceMultiplier, 3);
    assert.equal(call.proposal.unitPriceCents, 60);
    assert.equal(call.proposal.metadata, undefined);
    assert.equal(call.fingerprint, 'fixture-fingerprint');
    assert.equal(call.actor, 'fixture-admin');
  });
  await t.test('unauthorized requests never reach either commercial service', async () => {
    fixture.authorized = false;
    assert.equal((await routes.preview(request(proposal))).status, 401);
    assert.equal((await routes.confirm(request({ proposal, previewFingerprint: 'fixture-fingerprint' }))).status, 401);
    assert.equal(fixture.calls.length, 0);
  });
});
