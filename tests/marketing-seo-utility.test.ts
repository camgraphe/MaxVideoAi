import assert from 'node:assert/strict';
import test from 'node:test';
import { getComparePageOverride, parseComparePageContentDocument } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-overrides';
import { getExampleModelLanding } from '../frontend/lib/examples/modelLanding';

for (const locale of ['en', 'fr', 'es'] as const) {
  test(`${locale} decision summaries identify the exact model tiers without reopening the disclosure`, () => {
    for (const slug of ['veo-3-1-fast-vs-veo-3-1-lite', 'gemini-omni-flash-vs-veo-3-1', 'ltx-2-3-fast-vs-ltx-2-5-fast',
      'ltx-2-3-pro-vs-ltx-2-5-pro', 'ltx-2-3-fast-vs-seedance-2-0', 'ltx-2-3-fast-vs-wan-2-5']) {
      const content = getComparePageOverride(locale, slug)!;
      assert.ok(content.decisionSummary?.trim(), slug);
      assert.ok(content.decisionSummary!.length <= 240, 'the opening remains a short answer');
    }
    assert.ok(getComparePageOverride(locale, 'ltx-2-3-fast-vs-wan-2-5')?.decisionLinks?.some(link => link.href.endsWith('/ltx-2-3-fast-vs-ltx-2-5-fast')));
    assert.ok(getComparePageOverride(locale, 'ltx-2-3-fast-vs-wan-2-5')?.decisionLinks?.some(link => link.href.endsWith('/ltx-2-3-pro-vs-ltx-2-5-pro')));
    const veo = getComparePageOverride(locale, 'veo-3-1-fast-vs-veo-3-1-lite')!;
    assert.doesNotMatch(JSON.stringify(veo), /audio always on|audio toujours actif|audio siempre activo/i);
  });
  test(`${locale} LTX introduction names both searchable generations`, () => {
    const landing = getExampleModelLanding(locale, 'ltx')!;
    assert.ok(landing.heroSubtitle.includes('2.3'));
    assert.ok(landing.heroSubtitle.includes('2.5'));
  });
}

test('opening decision links obey the same public route and locale contracts as primary links', () => {
  const slug = 'ltx-2-3-fast-vs-wan-2-5';
  const document = { slug, ...Object.fromEntries(['en', 'fr', 'es'].map(locale => [locale, getComparePageOverride(locale as 'en' | 'fr' | 'es', slug)])) };
  const invalid = JSON.parse(JSON.stringify(document));
  invalid.fr.decisionLinks[0].href = 'https://example.com/';
  assert.throws(() => parseComparePageContentDocument(JSON.stringify(invalid), slug), /fr\.decisionLinks\.0\.href/);
  delete invalid.fr.decisionLinks;
  assert.throws(() => parseComparePageContentDocument(JSON.stringify(invalid), slug), /structural parity/);
});
