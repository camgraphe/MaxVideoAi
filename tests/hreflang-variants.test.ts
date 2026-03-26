import assert from 'node:assert/strict';
import test from 'node:test';

import { HREFLANG_VARIANTS } from '../frontend/lib/seo/alternateLocales';

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
