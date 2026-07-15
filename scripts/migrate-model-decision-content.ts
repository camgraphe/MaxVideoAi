import { promises as fs } from 'node:fs';
import path from 'node:path';

import type { AppLocale } from '../frontend/i18n/locales.ts';
import {
  COPY_BY_MODEL_SLUG,
  getModelDecisionCopy,
} from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-copy.ts';

const LOCALES = ['en', 'fr', 'es'] as const satisfies readonly AppLocale[];
const CONTENT_ROOT = path.join(process.cwd(), 'content', 'models');
const write = process.argv.includes('--write');

async function migrateExistingProjection(slug: string, locale: AppLocale): Promise<boolean> {
  const filePath = path.join(CONTENT_ROOT, locale, `${slug}.json`);
  const document = JSON.parse(await fs.readFile(filePath, 'utf8')) as Record<string, unknown>;
  const copy = getModelDecisionCopy(slug, locale);
  if (!copy) throw new Error(`Missing old decision projection for ${slug}/${locale}`);
  const expected = { modelSlug: slug, ...copy };

  if (document.decision !== undefined) {
    if (JSON.stringify(document.decision) !== JSON.stringify(expected)) {
      throw new Error(`Existing decision content differs for ${slug}/${locale}`);
    }
    return false;
  }

  if (write) {
    document.decision = expected;
    await fs.writeFile(filePath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  }
  return true;
}

async function main() {
  const slugs = Object.keys(COPY_BY_MODEL_SLUG).sort();
  if (slugs.length !== 38) throw new Error(`Expected 38 old copy slugs, received ${slugs.length}`);
  let pending = 0;

  for (const slug of slugs) {
    for (const locale of LOCALES) {
      if (await migrateExistingProjection(slug, locale)) pending += 1;
    }
  }

  console.log(`${write ? 'wrote' : 'would write'} ${pending} existing decision projections`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
