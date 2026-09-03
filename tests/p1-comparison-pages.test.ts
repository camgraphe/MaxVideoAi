import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import { parseComparePageContentDocument } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides.ts';
import { buildCanonicalCompareSlug } from '../frontend/lib/compare-hub/data.ts';

const PAIRS = [
  ['minimax-h3-max', 'minimax-h3'],
  ['kling-3-turbo-pro', 'kling-3-turbo-standard'],
  ['kling-3-turbo-pro', 'kling-3-pro'],
  ['gemini-omni-flash', 'kling-3-turbo-pro'],
] as const;

test('the four P1 comparison documents are localized and scoreboard-only', () => {
  const config = JSON.parse(readFileSync('frontend/config/compare-config.json', 'utf8')) as {
    scoreboardOnlyComparisons: string[];
    showdowns: Record<string, unknown>;
  };

  for (const [left, right] of PAIRS) {
    const slug = buildCanonicalCompareSlug(left, right);
    const file = `content/comparisons/${slug}.json`;
    assert.equal(existsSync(file), true, file);
    const document = parseComparePageContentDocument(readFileSync(file, 'utf8'), slug, file);
    for (const locale of ['en', 'fr', 'es'] as const) {
      const copy = document[locale];
      assert.ok(copy.meta?.title, `${slug}.${locale}.title`);
      assert.ok(copy.meta?.description, `${slug}.${locale}.description`);
      assert.ok(copy.quickVerdict?.body, `${slug}.${locale}.verdict`);
      assert.equal(copy.primaryLinks?.length, 2, `${slug}.${locale}.links`);
      const serialized = JSON.stringify(copy);
      assert.doesNotMatch(serialized, /side[- ]by[- ]side|showdown|future video|videos? (?:will|sera|seront|se) /i);
    }
    assert.ok(config.scoreboardOnlyComparisons.includes(slug), slug);
    assert.equal(config.showdowns[slug], undefined, `${slug} must not attach face-to-face media`);
  }
});

test('P1 comparison model links preserve one owner per model intent', () => {
  for (const [left, right] of PAIRS) {
    const slug = buildCanonicalCompareSlug(left, right);
    const file = `content/comparisons/${slug}.json`;
    const raw = readFileSync(file, 'utf8');
    const document = parseComparePageContentDocument(raw, slug, file);
    for (const locale of ['en', 'fr', 'es'] as const) {
      const hrefs = document[locale].primaryLinks?.map(({ href }) => href) ?? [];
      assert.ok(hrefs.some((href) => href.endsWith(`/models/${left}`) || href.endsWith(`/modeles/${left}`) || href.endsWith(`/modelos/${left}`)), `${slug}.${locale}.${left}`);
      assert.ok(hrefs.some((href) => href.endsWith(`/models/${right}`) || href.endsWith(`/modeles/${right}`) || href.endsWith(`/modelos/${right}`)), `${slug}.${locale}.${right}`);
    }
  }
});
