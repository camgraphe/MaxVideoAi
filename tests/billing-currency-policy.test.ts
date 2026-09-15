import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test, { type TestContext } from 'node:test';
import { build } from 'esbuild';
import { NextRequest } from 'next/server';
import { normalizeCurrencyCode, resolveCurrency, resolveEnabledCurrencies } from '../frontend/src/lib/currency';

function useDefaultPolicy(t: TestContext) {
  for (const key of ['ENABLED_CURRENCIES', 'DEFAULT_CURRENCY']) {
    const previous = process.env[key];
    delete process.env[key];
    t.after(() => {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    });
  }
}

function request(country?: string) {
  return new NextRequest('https://maxvideoai.test/billing', {
    headers: country ? { 'x-vercel-ip-country': country } : {},
  });
}

test('new payments offer EUR/USD, with USD in the US and EUR elsewhere', (t) => {
  useDefaultPolicy(t);
  assert.deepEqual(resolveEnabledCurrencies(), ['eur', 'usd']);
  assert.equal(resolveCurrency(request('US')).currency, 'usd');
  for (const country of ['FR', 'ES', 'BE', 'GB', 'CH', 'CA', 'BR', 'AU', 'IN', undefined]) {
    assert.equal(resolveCurrency(request(country)).currency, 'eur', country ?? 'unknown country');
  }
});

test('supported customer choices override location and retired preferences fall back without changing history', (t) => {
  useDefaultPolicy(t);
  assert.deepEqual(resolveCurrency(request('US'), { preferred_currency: 'eur' }), { currency: 'eur', source: 'user_pref' });
  assert.deepEqual(resolveCurrency(request('FR'), { preferred_currency: 'usd' }), { currency: 'usd', source: 'user_pref' });
  for (const preferred_currency of ['gbp', 'chf'] as const) {
    assert.equal(normalizeCurrencyCode(preferred_currency), preferred_currency);
    assert.equal(resolveCurrency(request('GB'), { preferred_currency }).currency, 'eur');
    assert.equal(resolveCurrency(request('US'), { preferred_currency }).currency, 'usd');
  }
});

test('top-up quotes reject disabled currencies and honor explicit EUR/USD before location', async (t) => {
  useDefaultPolicy(t);
  const requireFrontend = createRequire(resolve('frontend/package.json'));
  const folder = mkdtempSync(join(tmpdir(), 'billing-currency-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const output = join(folder, 'quote.cjs');
  await build({
    stdin: { resolveDir: process.cwd(), loader: 'ts', contents: `
      export { POST } from './frontend/app/api/topup/quote/route';
      export { calls } from '@/lib/fxQuote';` },
    outfile: output, bundle: true, platform: 'node', format: 'cjs', packages: 'external', tsconfig: 'frontend/tsconfig.json',
    plugins: [{ name: 'quote-currency-fixture', setup(builder) {
      const mocks: Record<string, string> = {
        '@/lib/supabase-ssr': 'export async function getRouteAuthContext(){return {userId:"fixture"};}',
        '@/lib/db': 'export function isDatabaseConfigured(){return false;} export async function query(){throw Error("No database expected");}',
        '@/lib/fxQuote': `export const calls=[]; export async function convertUsdToCurrencyAmount(input){
          calls.push(input); return {currency:input.targetCurrency.toUpperCase(), amountMinor:input.usdAmountCents, source:'fixture'};}`,
      };
      builder.onResolve({ filter: /.*/ }, args => args.path in mocks ? { path: args.path, namespace: 'fixture' }
        : args.path === 'next/server' ? { path: requireFrontend.resolve(args.path), external: true } : undefined);
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: mocks[args.path], loader: 'ts' }));
    } }],
  });
  const route = requireFrontend(output) as { POST(req: NextRequest): Promise<Response>; calls: unknown[] };
  const quote = (currency: string | undefined, country = 'US') => route.POST(new NextRequest('https://maxvideoai.test/api/topup/quote', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-vercel-ip-country': country },
    body: JSON.stringify({ currency, amounts: [1000] }),
  }));
  for (const currency of ['GBP', 'CHF']) {
    const response = await quote(currency);
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, 'Unsupported currency');
  }
  assert.equal(route.calls.length, 0);
  for (const [currency, country, expected] of [
    ['EUR', 'US', 'EUR'], ['USD', 'FR', 'USD'], [undefined, 'US', 'USD'], [undefined, 'GB', 'EUR'],
  ] as const) {
    const response = await quote(currency, country);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.currency, expected);
    assert.equal(data.quotes[0].currency, expected);
  }
});
