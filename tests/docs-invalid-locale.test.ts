import assert from 'node:assert/strict';
import test from 'node:test';
import DocsIndexPage, { generateMetadata } from '../frontend/app/(localized)/[locale]/(marketing)/docs/page';
import type { AppLocale } from '../frontend/i18n/locales';

test('an API-like invalid locale returns not found before resolving documentation content', async () => {
  for (const render of [DocsIndexPage, generateMetadata]) {
    await assert.rejects(render({ params: Promise.resolve({ locale: 'api' as AppLocale }) }),
      (error: unknown) => String(error).includes('NEXT_HTTP_ERROR_FALLBACK;404'));
  }
});
