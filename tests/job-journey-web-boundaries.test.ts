import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { build } from 'esbuild';

const requireFrontend = createRequire(resolve('frontend/package.json'));

test('C10/C18: authenticated web contexts ignore client origins and consent; unauthenticated calls never execute', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'journey-web-'));
  const state = { authorized: true, calls: [] as Array<Record<string, unknown>> };
  const globals = globalThis as typeof globalThis & { __journeyWebFixture?: typeof state };
  globals.__journeyWebFixture = state;
  const previousSha = process.env.VERCEL_GIT_COMMIT_SHA;
  const previousFetch = globalThis.fetch;
  let networkCalls = 0;
  globalThis.fetch = async () => { networkCalls++; throw new Error('Unexpected network request in reservation boundary fixture'); };
  process.env.VERCEL_GIT_COMMIT_SHA = 'a'.repeat(40);
  t.after(() => {
    globalThis.fetch = previousFetch;
    delete globals.__journeyWebFixture;
    if (previousSha === undefined) delete process.env.VERCEL_GIT_COMMIT_SHA;
    else process.env.VERCEL_GIT_COMMIT_SHA = previousSha;
    rmSync(directory, { recursive: true, force: true });
  });
  const output = join(directory, 'routes.cjs');
  await build({
    stdin: { resolveDir: process.cwd(), loader: 'ts', contents: `
      export { POST as video } from './frontend/app/api/generate/route';
      export { POST as image } from './frontend/app/api/images/generate/route';` },
    outfile: output, bundle: true, platform: 'node', format: 'cjs', packages: 'external', tsconfig: 'frontend/tsconfig.json',
    plugins: [{ name: 'journey-authenticated-boundaries', setup(builder) {
      const mocks: Record<string, string> = {
        '@/server/pricing/web-pricing-policy': 'export function requireCurrentWebPricingPolicy(){return null}',
        './_lib/metric-logger': 'export function createGenerateMetricLogger(){return {state:{},log(){},logPreflightRejection(){}}}',
        './_lib/request-options': 'export function buildGenerateRequestOptions(){return {ok:true,options:{}}}',
        './_lib/auth-idempotency': `export async function resolveGenerateUserGate(){return globalThis.__journeyWebFixture.authorized
          ? {kind:'authorized',userId:'fixture-owner',localKey:null} : {kind:'response',body:{ok:false},status:401}}`,
        './_lib/route-context': `export async function resolveGenerateRouteContext(){return {ok:true,context:{engine:{id:'fixture',label:'Fixture'},jobId:'fixture-job',mode:'t2v'}}}`,
        './_lib/provider-resolution': 'export function normalizeProviderRoutedResolution(){return {}}',
        './_lib/video-generation-adapters': 'export const videoGenerationAdapters={}',
        '@/server/seedance-workflow-request': 'export class SeedanceWorkflowRequestError extends Error{}; export function seedanceWorkflowEnabled(){return false}; export async function resolveSeedanceWorkflowRequest(){return undefined}',
        '@/server/video-generation/execute-video-generation': `export async function executeVideoGeneration(input){globalThis.__journeyWebFixture.calls.push(input);return {body:{ok:true}}}`,
        '@/server/images/execute-image-generation': `export class ImageGenerationExecutionError extends Error{}; export async function executeImageGeneration(input){globalThis.__journeyWebFixture.calls.push(input);return {ok:true}}`,
        '@/lib/supabase-ssr': `export async function getRouteAuthContext(){return {userId:globalThis.__journeyWebFixture.authorized?'fixture-owner':null}}`,
        '@/server/fraud-cleanup': `export const RESTRICTED_ACCOUNT_MESSAGE='Restricted'; export async function getActiveAccountRestriction(){return null}`,
        '@/server/admin': 'export async function requireAdmin(){throw new Error("not admin")}',
      };
      builder.onResolve({ filter: /.*/ }, args => args.path in mocks ? { path: args.path, namespace: 'fixture' }
        : args.path === 'next/server' ? { path: requireFrontend.resolve(args.path), external: true } : undefined);
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks[args.path], loader: 'ts' }));
    } }],
  });
  const routes = requireFrontend(output) as Record<'video' | 'image', (req: Request) => Promise<Response>>;
  for (const media of ['video', 'image'] as const) {
    const forged = { engineId: 'fixture', mode: media === 'image' ? 't2i' : 't2v',
      entry_surface: 'mcp', entry_source: 'confirmed_actor', journey_version: 999, entry_release_sha: 'b'.repeat(40),
      journeyContext: { entrySurface: 'studio', entrySource: 'confirmed_actor', journeyVersion: 1, entryReleaseSha: 'b'.repeat(40) },
      metadata: { source: 'mcp' }, authOrigin: 'oauth' };
    const req = (analytics = false) => new Request(`https://fixture.invalid/api/${media === 'video' ? '' : 'images/'}generate`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-entry-surface': 'mcp', 'x-entry-release-sha': 'b'.repeat(40),
        cookie: `mv-consent=${encodeURIComponent(JSON.stringify({ version: '2026-07', timestamp: 1000, categories: { analytics, ads: false }, source: 'preferences' }))}` }, body: JSON.stringify(forged),
    });
    for (const analytics of [false, true]) {
      const response = await routes[media](req(analytics));
      assert.equal(response.status, 200);
      assert.deepEqual(state.calls.at(-1)?.journeyContext, { entrySurface: 'generator', entrySource: 'web_route', journeyVersion: 1, entryReleaseSha: 'a'.repeat(40) });
      assert.deepEqual(state.calls.at(-1)?.body, forged);
    }
    state.authorized = false;
    const count = state.calls.length;
    assert.equal((await routes[media](req())).status, 401);
    assert.equal(state.calls.length, count);
    state.authorized = true;
  }
  assert.equal(networkCalls, 0);
});
