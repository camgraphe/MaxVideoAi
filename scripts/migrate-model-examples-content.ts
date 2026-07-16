import { isDeepStrictEqual } from 'node:util';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import type { AppLocale } from '../frontend/i18n/locales.ts';
import {
  mergeEngineLocalizedContent,
  type EngineOverlay,
} from '../frontend/lib/models/i18n-normalization.ts';
import { buildSoraCopy } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-copy.ts';
import { parseModelExamplesContent } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-content.ts';
import {
  buildLegacyModelExamplesContent,
  LEGACY_ACTIVE_IMAGE_FALLBACK_SLUGS,
} from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-legacy.ts';
import { listModelPageTemplateSlugs } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-registry.ts';

type Mode = 'dry-run' | 'write';

const CONTENT_ROOT = path.join(process.cwd(), 'content', 'models');
const LOCALES = ['en', 'fr', 'es'] as const satisfies readonly AppLocale[];

function parseMode(args: readonly string[]): Mode {
  if (args.length !== 1 || (args[0] !== '--dry-run' && args[0] !== '--write')) {
    throw new Error('Usage: migrate-model-examples-content.ts --dry-run | --write');
  }
  return args[0] === '--write' ? 'write' : 'dry-run';
}

function documentPath(locale: AppLocale, slug: string): string {
  return path.join(CONTENT_ROOT, locale, `${slug}.json`);
}

function readDocument(locale: AppLocale, slug: string): EngineOverlay {
  return JSON.parse(readFileSync(documentPath(locale, slug), 'utf8')) as EngineOverlay;
}

function writeDocument(locale: AppLocale, slug: string, document: EngineOverlay): void {
  writeFileSync(documentPath(locale, slug), `${JSON.stringify(document, null, 2)}\n`, 'utf8');
}

const mode = parseMode(process.argv.slice(2));
let projections = 0;
let pending = 0;
let differences = 0;

for (const locale of LOCALES) {
  for (const slug of listModelPageTemplateSlugs().sort()) {
    const base = readDocument('en', slug);
    const overlay = readDocument(locale, slug);
    const localized = mergeEngineLocalizedContent(base, overlay);
    const copy = buildSoraCopy(localized, slug, locale);
    const projected = buildLegacyModelExamplesContent({
      modelSlug: slug,
      locale,
      copy,
      imageFallbackActive: LEGACY_ACTIVE_IMAGE_FALLBACK_SLUGS.has(slug),
    });
    parseModelExamplesContent(projected, slug, locale);

    if (overlay.examples !== undefined && !isDeepStrictEqual(overlay.examples, projected)) {
      differences += 1;
      throw new Error(`Examples parity difference: ${slug}/${locale}`);
    }
    if (overlay.examples === undefined) pending += 1;
    if (mode === 'write') writeDocument(locale, slug, { ...overlay, examples: projected });
    projections += 1;
  }
}

console.log(`projections=${projections} pending=${pending} differences=${differences}`);
