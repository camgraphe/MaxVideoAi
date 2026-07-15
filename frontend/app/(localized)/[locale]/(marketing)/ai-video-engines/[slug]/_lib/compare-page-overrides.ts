import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

import type { AppLocale } from '@/i18n/locales';
import { CONTENT_ROOT } from '@/lib/i18n/paths';
import type { ComparePageContentDocument, ComparePageOverride } from './compare-page-overrides-types';
export type { ComparePageOverride } from './compare-page-overrides-types';

const COMPARISON_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*-vs-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const COMPARISON_CONTENT_ROOT = path.join(CONTENT_ROOT, 'comparisons');
const nonEmptyString = z.string().min(1);
const neutralInternalHrefPattern = /^\/(?:(?:models|examples|ai-video-engines)\/[^\s]+|pricing(?:#[^\s]+)?)$/;
const internalHrefPatternsByLocale: Record<AppLocale, readonly RegExp[]> = {
  en: [neutralInternalHrefPattern],
  fr: [neutralInternalHrefPattern, /^\/fr\/(?:(?:modeles|exemples|comparatif)\/[^\s]+|tarifs(?:#[^\s]+)?)$/],
  es: [neutralInternalHrefPattern, /^\/es\/(?:(?:modelos|ejemplos|comparativa)\/[^\s]+|precios(?:#[^\s]+)?)$/],
};

const metaSchema = z.object({
  title: nonEmptyString.optional(),
  description: nonEmptyString.optional(),
  titleBranding: z.enum(['auto', 'none']).optional(),
}).strict();

const quickVerdictSchema = z.object({
  title: nonEmptyString,
  body: nonEmptyString,
}).strict();

const topCardSchema = z.object({
  title: nonEmptyString,
  body: nonEmptyString,
}).strict();

const primaryLinkSchema = z.object({
  href: nonEmptyString,
  label: nonEmptyString,
}).strict();

const faqItemSchema = z.object({
  question: nonEmptyString,
  answer: z.union([nonEmptyString, z.array(nonEmptyString).min(1)]),
}).strict();

const faqSchema = z.object({
  title: nonEmptyString.optional(),
  subtitle: nonEmptyString.optional(),
  items: z.array(faqItemSchema),
}).strict();

const comparePageOverrideSchema: z.ZodType<ComparePageOverride> = z.object({
  meta: metaSchema.optional(),
  heroIntro: nonEmptyString.optional(),
  quickVerdict: quickVerdictSchema.optional(),
  topCards: z.array(topCardSchema).optional(),
  primaryLinksTitle: nonEmptyString.optional(),
  primaryLinks: z.array(primaryLinkSchema).optional(),
  faq: faqSchema.optional(),
}).strict();

const comparePageContentSchema: z.ZodType<ComparePageContentDocument> = z.object({
  slug: nonEmptyString.regex(COMPARISON_SLUG_PATTERN),
  en: comparePageOverrideSchema,
  fr: comparePageOverrideSchema,
  es: comparePageOverrideSchema,
}).strict();

function assertPathSafeComparisonSlug(slug: string): void {
  if (!COMPARISON_SLUG_PATTERN.test(slug)) {
    throw new Error(`[comparison-content] Expected a path-safe comparison slug, received ${JSON.stringify(slug)}`);
  }
}

function collectStructuralFieldPaths(value: unknown, prefix = ''): string[] {
  if (Array.isArray(value)) {
    return [...new Set(value.flatMap((item) => collectStructuralFieldPaths(item, `${prefix}[]`)))].sort();
  }
  if (!value || typeof value !== 'object') {
    return [];
  }
  return Object.entries(value as Record<string, unknown>)
    .flatMap(([key, nested]) => {
      const fieldPath = prefix ? `${prefix}.${key}` : key;
      return [fieldPath, ...collectStructuralFieldPaths(nested, fieldPath)];
    })
    .sort();
}

function assertStructuralParity(document: ComparePageContentDocument, source: string): void {
  const englishPaths = collectStructuralFieldPaths(document.en);
  for (const locale of ['fr', 'es'] as const) {
    const localizedPaths = collectStructuralFieldPaths(document[locale]);
    if (JSON.stringify(localizedPaths) !== JSON.stringify(englishPaths)) {
      throw new Error(
        `[comparison-content] Failed structural parity for ${locale} in ${source}: ` +
          `expected ${JSON.stringify(englishPaths)}, received ${JSON.stringify(localizedPaths)}`,
      );
    }
  }
}

function assertSupportedPrimaryLinkHrefs(document: ComparePageContentDocument, source: string): void {
  for (const locale of ['en', 'fr', 'es'] as const) {
    for (const [index, link] of (document[locale].primaryLinks ?? []).entries()) {
      if (!internalHrefPatternsByLocale[locale].some((pattern) => pattern.test(link.href))) {
        throw new Error(
          `[comparison-content] Invalid href in ${source} at ${locale}.primaryLinks.${index}.href: ` +
            `expected a supported ${locale} public route, received ${JSON.stringify(link.href)}`,
        );
      }
    }
  }
}

export function parseComparePageContentDocument(
  raw: string,
  expectedSlug: string,
  source = `${expectedSlug}.json`,
): ComparePageContentDocument {
  assertPathSafeComparisonSlug(expectedSlug);

  let input: unknown;
  try {
    input = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`[comparison-content] Invalid JSON in ${source}: ${message}`, { cause: error });
  }

  const result = comparePageContentSchema.safeParse(input);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
      .join('; ');
    throw new Error(`[comparison-content] Invalid document ${source}: ${issues}`);
  }
  if (result.data.slug !== expectedSlug) {
    throw new Error(
      `[comparison-content] Comparison identity mismatch in ${source}: expected ${expectedSlug}, received ${result.data.slug}`,
    );
  }

  assertSupportedPrimaryLinkHrefs(result.data, source);
  assertStructuralParity(result.data, source);
  return result.data;
}

export function getComparePageOverride(locale: AppLocale, slug: string): ComparePageOverride | undefined {
  assertPathSafeComparisonSlug(slug);
  const filePath = path.join(COMPARISON_CONTENT_ROOT, `${slug}.json`);
  if (!existsSync(filePath)) {
    return undefined;
  }
  return parseComparePageContentDocument(readFileSync(filePath, 'utf8'), slug, filePath)[locale];
}
