import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const pagePath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/blog/[slug]/page.tsx');
const viewPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/blog/[slug]/_components/blog-post-view.tsx');
const dataPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/blog/[slug]/_lib/blog-post-data.ts');
const seoPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/blog/[slug]/_lib/blog-post-seo.ts');

const pageSource = readFileSync(pagePath, 'utf8');
const viewSource = readFileSync(viewPath, 'utf8');
const dataSource = readFileSync(dataPath, 'utf8');
const seoSource = readFileSync(seoPath, 'utf8');

test('localized blog article page stays a route orchestrator', () => {
  assert.ok(existsSync(pagePath), 'blog article page should exist');
  assert.ok(existsSync(viewPath), 'blog article view should exist');
  assert.ok(existsSync(dataPath), 'blog article data helper should exist');
  assert.ok(existsSync(seoPath), 'blog article SEO helper should exist');

  assert.match(pageSource, /from '\.\/_components\/blog-post-view'/, 'route should import the view component');
  assert.match(pageSource, /from '\.\/_lib\/blog-post-data'/, 'route should import data helpers');
  assert.match(pageSource, /from '\.\/_lib\/blog-post-seo'/, 'route should import SEO helpers');
  assert.match(pageSource, /export async function generateStaticParams/, 'route should keep static param orchestration');
  assert.match(pageSource, /export async function generateMetadata/, 'route should keep metadata orchestration');
  assert.match(pageSource, /export default async function BlogPostPage/, 'route should keep page orchestration');

  assert.doesNotMatch(pageSource, /BLOG_NEXT_STEPS/, 'next-step copy belongs in data helpers');
  assert.doesNotMatch(pageSource, /BLOG_TITLE_OVERRIDES/, 'title overrides belong in data helpers');
  assert.doesNotMatch(pageSource, /getContentEntries\(/, 'content loading belongs in data helpers');
  assert.doesNotMatch(pageSource, /getEntryBySlug\(/, 'post lookup belongs in data helpers');
  assert.doesNotMatch(pageSource, /BreadcrumbList/, 'breadcrumb schema belongs in SEO helpers');
  assert.doesNotMatch(pageSource, /'@type': 'Article'/, 'article schema belongs in SEO helpers');
  assert.doesNotMatch(pageSource, /dangerouslySetInnerHTML/, 'rendering HTML and scripts belongs in the view');
  assert.doesNotMatch(pageSource, /<Image/, 'article hero rendering belongs in the view');
  assert.doesNotMatch(pageSource, /relatedPosts\.map/, 'related card rendering belongs in the view');

  const lineCount = pageSource.split('\n').length;
  assert.ok(lineCount <= 180, `blog article page should stay below 180 lines, got ${lineCount}`);
});

test('blog article helper modules expose focused contracts', () => {
  for (const exportName of [
    'BLOG_SLUG_MAP',
    'BLOG_TITLE_OVERRIDES',
    'localeDateMap',
  ]) {
    assert.match(dataSource, new RegExp(`export const ${exportName}`), `${exportName} should be exported`);
  }

  for (const exportName of [
    'getCanonicalBlogSlug',
    'getBlogPosts',
    'getBlogLinkProps',
    'getNextStepCopy',
    'toIsoDate',
    'getPost',
    'findLocalizedSlugs',
    'formatBlogPostDate',
    'demoteArticleHeadingContent',
    'buildLocalizedBlogPostPath',
  ]) {
    assert.match(dataSource, new RegExp(`export (?:async )?function ${exportName}\\(`), `${exportName} should be exported`);
  }

  for (const exportName of [
    'buildBlogPostLocalization',
    'buildBlogPostMetadata',
    'buildBlogPostJsonLd',
  ]) {
    assert.match(seoSource, new RegExp(`export function ${exportName}\\(`), `${exportName} should be exported`);
  }

  assert.match(dataSource, /BLOG_NEXT_STEPS/, 'data helper should own blog next-step copy');
  assert.match(seoSource, /BreadcrumbList/, 'SEO helper should own breadcrumb schema');
  assert.match(seoSource, /'@type': 'Article'/, 'SEO helper should own article schema');
  assert.match(seoSource, /buildSeoMetadata/, 'SEO helper should own metadata builder invocation');
});

test('blog article view owns article rendering surfaces', () => {
  assert.match(viewSource, /export function BlogPostView/, 'view should be exported');
  assert.match(viewSource, /<Image/, 'view should render the article image');
  assert.match(viewSource, /dangerouslySetInnerHTML/, 'view should render markdown HTML and JSON-LD scripts');
  assert.match(viewSource, /function ArticleNextStepSection/, 'view should own next-step rendering');
  assert.match(viewSource, /function RelatedPostsSection/, 'view should own related post cards');
  assert.match(viewSource, /getBlogLinkProps/, 'view should preserve localized related links');
});
