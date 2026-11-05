import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { parseMarkdownFile } from '../frontend/lib/content/markdown';
import { BLOG_SLUGS_BY_CANONICAL } from '../frontend/config/blog-slugs';
import { buildBlogPostJsonLd, buildBlogPostLocalization, buildBlogPostMetadata } from '../frontend/app/(localized)/[locale]/(marketing)/blog/[slug]/_lib/blog-post-seo';
import { getEditorialProfile } from '../frontend/lib/editorial/profile';

for (const canonicalSlug of ['ai-character-sheet-generator', 'how-to-create-consistent-ai-characters'] as const) {
  for (const locale of ['en', 'fr', 'es'] as const) test(`${canonicalSlug}/${locale} keeps indexed identity and provides the current Character Studio path`, async () => {
    const localizedSlugs = BLOG_SLUGS_BY_CANONICAL[canonicalSlug];
    const slug = localizedSlugs[locale]!;
    const post = await parseMarkdownFile(path.resolve('content', locale, 'blog', `${slug}.mdx`));
    const expectedUrl = `https://maxvideoai.com${locale === 'en' ? '' : `/${locale}`}/blog/${slug}`;
    assert.equal(post.slug, slug);
    assert.equal(post.canonicalSlug, canonicalSlug);
    assert.equal(post.canonical, expectedUrl);
    assert.equal(post.date, canonicalSlug === 'ai-character-sheet-generator' ? '2026-03-20' : '2026-03-22');
    assert.equal(post.updatedAt, '2026-11-05');
    assert.match(post.content, /Character Studio/);
    assert.match(post.content, /href="\/app\/tools\/character-builder"/);
    assert.match(post.content, /Recast/);
    assert.ok(post.walkthrough && post.walkthrough.steps.length >= 3);
    for (const step of post.walkthrough.steps) {
      assert.equal(step.video, undefined, 'public films must resolve through the guarded catalogue, not static authored job URLs');
      assert.ok(step.image.startsWith('/assets/'));
      assert.ok(existsSync(path.resolve('frontend/public', step.image.slice(1))), step.image);
      assert.ok(step.alt.trim());
    }
    const localization = buildBlogPostLocalization({ canonicalSlug, locale, localizedSlugs });
    assert.equal(localization.canonicalUrl, expectedUrl);
    assert.deepEqual(localization.availableLocales, ['en', 'fr', 'es']);
    const metadata = buildBlogPostMetadata({ post, locale, localization });
    assert.equal(metadata.alternates?.canonical, expectedUrl);
    for (const target of ['en', 'fr', 'es'] as const) {
      assert.equal(localization.slugMap[target], `blog/${localizedSlugs[target]}`);
    }
    const { articleSchema } = buildBlogPostJsonLd({ post, locale, localization, editorialProfile: getEditorialProfile(locale),
      publishedIso: new Date(post.date).toISOString(), modifiedIso: new Date(post.updatedAt!).toISOString() });
    assert.equal(articleSchema.mainEntityOfPage['@id'], expectedUrl);
    assert.equal(articleSchema.datePublished.slice(0, 10), post.date);
    assert.equal(articleSchema.dateModified.slice(0, 10), '2026-11-05');
    assert.equal(articleSchema.headline, post.title);
  });
}
