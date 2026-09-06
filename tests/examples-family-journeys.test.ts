import assert from 'node:assert/strict';
import test from 'node:test';
import { buildExamplesNextStepLinks, getExamplesMainVideoCopy } from '../frontend/app/(localized)/[locale]/(marketing)/examples/_lib/examples-page-copy';
import { getCanonicalCompareSlug, resolveEngines } from '../frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/[slug]/_lib/compare-page-helpers';

for (const locale of ['en', 'fr', 'es'] as const) {
  test(`${locale} Veo and Hailuo journeys point to existing family comparisons`, () => {
    const pricingPath = locale === 'fr' ? '/fr/tarifs' : locale === 'es' ? '/es/precios' : '/pricing';
    for (const family of ['veo', 'hailuo']) {
      const links = buildExamplesNextStepLinks({
        appLocale: locale, locale, pricingPath, familySlug: family,
        isKlingLanding: false, isLtxLanding: false, isSeedanceLanding: false, isVeoLanding: family === 'veo',
      });
      assert.equal(new Set(links.map((link) => link.href)).size, links.length);
      assert.ok(links[0].href.endsWith(family === 'veo' ? '/gemini-omni-flash-vs-veo-3-1' : '/minimax-h3-vs-minimax-h3-max'));
      for (const link of links) {
        assert.ok(link.href.startsWith(locale === 'en' ? '/ai-video-engines/' : `/${locale}/`));
        const slug = link.href.split('/').pop()!;
        const canonical = getCanonicalCompareSlug(slug);
        assert.ok(canonical, `${link.href} must resolve through the comparison route`);
        assert.ok(resolveEngines(canonical.canonicalSlug), `${link.href} must resolve both published models`);
      }
      assert.ok(getExamplesMainVideoCopy(locale, family).recreationHint);
    }
    assert.equal(getExamplesMainVideoCopy(locale).recreationHint, undefined, 'the generic gallery keeps its existing copy');
    assert.equal(getExamplesMainVideoCopy(locale, 'kling').recreationHint, undefined, 'other families are outside this copy change');
  });
}
