import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const middlewarePath = 'frontend/middleware.ts';
const routingHelpersPath = 'frontend/lib/middleware/routing-helpers.ts';
const routingLocalePath = 'frontend/lib/middleware/routing-locale.ts';
const routingMarketingPath = 'frontend/lib/middleware/routing-marketing.ts';
const routingQueryPath = 'frontend/lib/middleware/routing-query.ts';
const routingResponsePath = 'frontend/lib/middleware/routing-response.ts';

test('middleware stays focused on request orchestration', () => {
  assert.equal(existsSync(middlewarePath), true);
  assert.equal(existsSync(routingHelpersPath), true);
  assert.equal(existsSync(routingLocalePath), true);
  assert.equal(existsSync(routingMarketingPath), true);
  assert.equal(existsSync(routingQueryPath), true);
  assert.equal(existsSync(routingResponsePath), true);

  const middlewareSource = readFileSync(middlewarePath, 'utf8');
  const middlewareLines = middlewareSource.split('\n').length;
  const helperPaths = [routingHelpersPath, routingLocalePath, routingMarketingPath, routingQueryPath, routingResponsePath];

  assert.ok(middlewareLines < 320, `expected middleware.ts to stay under 320 lines, got ${middlewareLines}`);
  for (const helperPath of helperPaths) {
    const lineCount = readFileSync(helperPath, 'utf8').split('\n').length;
    assert.ok(lineCount < 500, `expected ${helperPath} to stay under 500 lines, got ${lineCount}`);
  }
  assert.match(middlewareSource, /export async function middleware/);
  assert.match(middlewareSource, /from '@\/lib\/middleware\/routing-helpers';/);
  assert.match(middlewareSource, /const isProtectedRoute = PROTECTED_PREFIXES\.some/);
  assert.match(middlewareSource, /if \(!isProtectedRoute\)/);
  assert.match(middlewareSource, /await updateSession\(req, response\)/);
  assert.doesNotMatch(middlewareSource, /const EXACT_LOCALE_REDIRECTS/);
  assert.doesNotMatch(middlewareSource, /function handleMarketingSlug/);
  assert.doesNotMatch(middlewareSource, /function normalizePublicQueryParams/);
});

test('middleware routing helpers own locale, query, redirect, and response utilities', () => {
  const helpersSource = readFileSync(routingHelpersPath, 'utf8');
  const localeSource = readFileSync(routingLocalePath, 'utf8');
  const marketingSource = readFileSync(routingMarketingPath, 'utf8');
  const querySource = readFileSync(routingQueryPath, 'utf8');
  const responseSource = readFileSync(routingResponsePath, 'utf8');

  assert.match(helpersSource, /export \* from '\.\/routing-locale';/);
  assert.match(helpersSource, /export \* from '\.\/routing-marketing';/);
  assert.match(helpersSource, /export \* from '\.\/routing-query';/);
  assert.match(helpersSource, /export \* from '\.\/routing-response';/);
  assert.match(responseSource, /export const LOGIN_PATH/);
  assert.match(responseSource, /export const PROTECTED_PREFIXES/);
  assert.match(responseSource, /export function finalizeResponse/);
  assert.match(localeSource, /export const handleI18nRouting/);
  assert.match(localeSource, /export function resolveLangParamRedirect/);
  assert.match(marketingSource, /export function handleMarketingSlug/);
  assert.match(marketingSource, /export function resolveNonPrefixedLocalizedMarketingRedirect/);
  assert.match(querySource, /export function normalizePublicQueryParams/);
  assert.match(querySource, /login:\s*new Set\(\[['"]next['"],\s*['"]mode['"],\s*['"]authError['"],\s*['"]code['"],\s*['"]state['"]\]\)/);
});

test('middleware preserves legacy French compare blog redirects', () => {
  const marketingSource = readFileSync(routingMarketingPath, 'utf8');

  assert.match(marketingSource, /comment-comparer-les-modèles-video-dia-sora-vs-veo-vs-pika/);
  assert.match(marketingSource, /comment-comparer-les-mod%c3%a8les-video-dia-sora-vs-veo-vs-pika/);
  assert.match(marketingSource, /comment-comparer-les-moteurs-video-dia-sora-vs-veo-vs-pika/);
  assert.match(
    marketingSource,
    /'\/fr\/blog\/comment-comparer-les-modèles-video-dia-sora-vs-veo-vs-pika':\s*'\/blog\/comment-comparer-les-moteurs-video-dia-sora-vs-veo-vs-pika'/
  );
});
