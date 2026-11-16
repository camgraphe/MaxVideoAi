import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { build } from 'esbuild';

async function route(path: string, extra: Record<string, string>) {
  const stubs: Record<string, string> = {
    '@/content/feature-flags': 'export const FEATURES={workflows:{toolsSection:true}};',
    '@/lib/supabase-ssr': "export const getRouteAuthContext=async()=>({userId:'owner'});",
    '@/server/fraud-cleanup': 'export const getActiveAccountRestriction=async()=>null;',
    '@/server/pricing/web-pricing-policy': 'export const requireCurrentWebPricingPolicy=()=>null;',
    '@/server/tools/finishing-status': 'export const refreshFinishingTool=async()=>null;',
    ...extra,
  };
  const bundle = await build({ entryPoints: [path], bundle: true, platform: 'node', format: 'cjs', write: false,
    tsconfig: 'frontend/tsconfig.json', packages: 'external', plugins: [{ name: 'route-adapters', setup(b) {
      b.onResolve({ filter: /.*/ }, a => a.path in stubs ? { path: a.path, namespace: 'fixture' } : undefined);
      b.onLoad({ filter: /.*/, namespace: 'fixture' }, a => ({ contents: stubs[a.path], loader: 'ts', resolveDir: resolve('frontend') }));
    } }] });
  const module = { exports: {} as { POST(request: Request): Promise<Response> } };
  new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(createRequire(resolve('frontend/package.json')), module, module.exports);
  return module.exports;
}
const request = () => new Request('https://app.example/api/tools/run', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });

test('tool routes expose actionable causes without leaking provider inputs or claiming an unsettled refund', async () => {
  for (const [failure, expected, refunded] of [
    ["import {FinishingExecutionError} from '@/server/tools/finishing-errors';export const runFinishingTool=async()=>{throw new FinishingExecutionError('TOOL_CONTENT_BLOCKED',true)};", 'TOOL_CONTENT_BLOCKED', true],
    ["import {FinishingExecutionError} from '@/server/tools/finishing-errors';export const runFinishingTool=async()=>{throw new FinishingExecutionError('TOOL_CONTENT_BLOCKED',false)};", 'TOOL_CONTENT_BLOCKED', false],
    ["export const runFinishingTool=async()=>{throw new Error('https://private.example?token=secret')};", 'TOOL_RUN_FAILED', false],
  ] as const) {
    const api = await route('frontend/app/api/tools/run/route.ts', { '@/server/tools/finishing-run': failure });
    const response = await api.POST(request());
    assert.equal(response.status, 422);
    const data = await response.json();
    assert.deepEqual(data, { ok: false, error: expected, refunded });
  }
  const quote = await route('frontend/app/api/tools/quote/route.ts', {
    '@/server/tools/toolbox-quote': "import {UpscaleToolError} from '@/server/tools/upscale-errors';export const quoteToolboxRequest=async()=>{throw new UpscaleToolError('private diagnostics',{status:422,code:'UPSCALE_TARGET_NOT_LARGER'})};",
  });
  const response = await quote.POST(request());
  assert.equal(response.status, 422);
  assert.deepEqual(await response.json(), { ok: false, error: 'UPSCALE_TARGET_NOT_LARGER' });
});
