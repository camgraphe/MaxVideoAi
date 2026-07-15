import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import type { AppLocale } from '../frontend/i18n/locales.ts';
import {
  COPY_BY_MODEL_SLUG,
  getModelDecisionCopy,
} from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-copy.ts';

const LOCALES = ['en', 'fr', 'es'] as const satisfies readonly AppLocale[];
const CONTENT_ROOT = path.join(process.cwd(), 'content', 'models');

test('all 114 existing model decision projections are exact in localized JSON', () => {
  const slugs = Object.keys(COPY_BY_MODEL_SLUG).sort();
  assert.equal(slugs.length, 38);
  let projectionCount = 0;

  for (const slug of slugs) {
    for (const locale of LOCALES) {
      const oldProjection = getModelDecisionCopy(slug, locale);
      assert.ok(oldProjection, `${slug}/${locale} old projection`);
      const document = JSON.parse(
        readFileSync(path.join(CONTENT_ROOT, locale, `${slug}.json`), 'utf8'),
      ) as { decision?: unknown };

      assert.deepEqual(
        document.decision,
        { modelSlug: slug, ...oldProjection },
        `${slug}/${locale} exact decision projection`,
      );
      projectionCount += 1;
    }
  }

  assert.equal(projectionCount, 114);
});
