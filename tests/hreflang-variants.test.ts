import assert from 'node:assert/strict';
import test from 'node:test';

import { HREFLANG_VARIANTS } from '../frontend/lib/seo/alternateLocales';
import { buildMetadataUrls } from '../frontend/lib/metadataUrls.ts';
import { buildDetailSlugMap } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-links.ts';

// Match Google Search's supported hreflang structure for our use case:
// ISO 639-1 language, optional ISO 15924 script, optional ISO 3166-1 alpha-2 region.
const SUPPORTED_HREFLANG_PATTERN = /^[a-z]{2}(?:-[A-Za-z]{4})?(?:-[A-Za-z]{2})?$/;

test('hreflang variants use Google-supported language and region codes', () => {
  for (const variant of HREFLANG_VARIANTS) {
    assert.match(
      variant.hreflang,
      SUPPORTED_HREFLANG_PATTERN,
      `Unsupported hreflang variant: ${variant.hreflang}`
    );
  }
});

test('Spanish hreflang uses a supported generic language code', () => {
  const spanishVariant = HREFLANG_VARIANTS.find((variant) => variant.locale === 'es');
  assert.ok(spanishVariant, 'Missing Spanish hreflang variant');
  assert.equal(spanishVariant.hreflang, 'es');
});

test('Seedance 2.5 and 2.0 expose reciprocal EN, FR, ES, and x-default model routes', () => {
  for (const slug of ['seedance-2-5', 'seedance-2-0'] as const) {
    const expectedUrls = {
      en: `https://maxvideoai.com/models/${slug}`,
      fr: `https://maxvideoai.com/fr/modeles/${slug}`,
      es: `https://maxvideoai.com/es/modelos/${slug}`,
    };
    const expectedLanguages = { ...expectedUrls, 'x-default': expectedUrls.en };

    for (const locale of ['en', 'fr', 'es'] as const) {
      const metadataUrls = buildMetadataUrls(locale, buildDetailSlugMap(slug), {
        englishPath: `/models/${slug}`,
        availableLocales: ['en', 'fr', 'es'],
      });

      assert.equal(metadataUrls.canonical, expectedUrls[locale]);
      assert.deepEqual(metadataUrls.languages, expectedLanguages);
    }
  }
});
