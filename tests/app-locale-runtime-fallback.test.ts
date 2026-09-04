import assert from 'node:assert/strict';
import test from 'node:test';

import * as localeModule from '../frontend/i18n/locales';

test('runtime locale normalization preserves supported locales and falls back for unmatched route segments', () => {
  const normalizeAppLocale = (localeModule as unknown as {
    normalizeAppLocale?: (value: unknown) => localeModule.AppLocale;
  }).normalizeAppLocale;

  assert.equal(typeof normalizeAppLocale, 'function');
  assert.equal(normalizeAppLocale?.('en'), 'en');
  assert.equal(normalizeAppLocale?.('fr'), 'fr');
  assert.equal(normalizeAppLocale?.('es'), 'es');
  assert.equal(normalizeAppLocale?.('apple-touch-icon-precomposed.png'), 'en');
  assert.equal(normalizeAppLocale?.('.well-known'), 'en');
  assert.equal(normalizeAppLocale?.(undefined), 'en');
});
