import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  BLOG_SLUGS_BY_CANONICAL,
  resolveBlogCanonicalSlug,
  resolveLocalizedBlogSlug,
  type BlogSlugLocale,
} from '../frontend/config/blog-slugs.ts';

const locales: BlogSlugLocale[] = ['en', 'fr', 'es'];

function readFrontMatterValue(source: string, key: string): string | null {
  const match = source.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
  return match?.[1]?.trim().replace(/^['"]|['"]$/g, '') ?? null;
}

test('blog language switch resolves localized article slugs across locales', () => {
  const canonical = resolveBlogCanonicalSlug(
    'fr',
    'comment-creer-des-personnages-ia-coherents-dans-les-images-et-la-video'
  );

  assert.equal(canonical, 'how-to-create-consistent-ai-characters');
  assert.equal(resolveLocalizedBlogSlug(canonical, 'en'), 'how-to-create-consistent-ai-characters');
  assert.equal(
    resolveLocalizedBlogSlug(canonical, 'es'),
    'como-crear-personajes-de-ia-coherentes-en-imagenes-y-video'
  );
});

test('blog slug switch map covers every localized blog frontmatter slug', () => {
  for (const locale of locales) {
    const dir = path.join(process.cwd(), 'content', locale, 'blog');
    const files = readdirSync(dir).filter((file) => file.endsWith('.mdx'));

    for (const file of files) {
      const source = readFileSync(path.join(dir, file), 'utf8');
      const slug = readFrontMatterValue(source, 'slug');
      const canonicalSlug = readFrontMatterValue(source, 'canonicalSlug') ?? slug;

      assert.ok(slug, `${file} should define a slug`);
      assert.ok(canonicalSlug, `${file} should define or derive a canonicalSlug`);
      assert.equal(
        BLOG_SLUGS_BY_CANONICAL[canonicalSlug]?.[locale],
        slug,
        `${locale}/${file} should be present in BLOG_SLUGS_BY_CANONICAL`
      );
    }
  }
});

test('marketing language toggle handles blog dynamic routes before generic locale replacement', () => {
  const source = readFileSync('frontend/components/marketing/LanguageToggle.tsx', 'utf8');

  assert.match(source, /resolveBlogCanonicalSlug/);
  assert.match(source, /resolveLocalizedBlogSlug/);
  assert.match(source, /pathname: '\/blog\/\[slug\]'/);
});

test('marketing language toggle preserves best-for usecase routes before generic compare pages', () => {
  const source = readFileSync('frontend/components/marketing/LanguageToggle.tsx', 'utf8');
  const bestForUsecaseIndex = source.indexOf("pathname: '/ai-video-engines/best-for/[usecase]'");
  const genericCompareIndex = source.indexOf("pathname: '/ai-video-engines/[slug]'");

  assert.notEqual(bestForUsecaseIndex, -1, 'best-for usecase routes should have an explicit language switch branch');
  assert.notEqual(genericCompareIndex, -1, 'generic compare routes should keep their language switch branch');
  assert.ok(
    bestForUsecaseIndex < genericCompareIndex,
    'best-for usecase routes should be handled before generic compare routes'
  );
  assert.match(source, /params\?\.usecase/);
});

test('client i18n provider keeps the document language in sync after locale switches', () => {
  const source = readFileSync('frontend/lib/i18n/I18nProvider.tsx', 'utf8');

  assert.match(source, /document\.documentElement\.lang = locale/);
});
