import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import test from 'node:test';
import { DocsArticleJsonLdScripts } from '../frontend/app/(localized)/[locale]/(marketing)/docs/_components/DocsArticleJsonLdScripts';
import { BlogPostJsonLdScripts } from '../frontend/app/(localized)/[locale]/(marketing)/blog/[slug]/_components/blog-post-jsonld-scripts';

const breadcrumb = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [] };
const article = { '@context': 'https://schema.org', '@type': 'TechArticle', headline: 'Résumé & détails </script>', dateModified: '2026-09-21T00:00:00.000Z' };
const authored = { '@context': 'https://schema.org', '@type': 'FAQPage', name: 'A < B & C', mainEntity: [] };

function scripts(html: string) {
  return Array.from(html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g), (match) => ({
    id: match[1].match(/\bid="([^"]+)"/)?.[1],
    type: match[1].match(/\btype="([^"]+)"/)?.[1],
    json: JSON.parse(match[2]),
  }));
}

test('Docs TechArticle, breadcrumb and supplied authored schemas are present in server HTML in every locale', () => {
  for (const locale of ['en', 'fr', 'es'] as const) {
    const html = renderToStaticMarkup(React.createElement(DocsArticleJsonLdScripts, {
      locale, slug: 'brand-safety', breadcrumb, article, structuredData: [JSON.stringify(authored)], includeAuthoredData: true,
    }));
    const rendered = scripts(html);
    assert.equal(rendered.length, 3);
    assert.deepEqual(rendered.map((entry) => entry.id), [
      `docs-breadcrumb-${locale}-brand-safety-jsonld`, `docs-article-${locale}-brand-safety-jsonld`, 'docs-jsonld-brand-safety-0',
    ]);
    assert.ok(rendered.every((entry) => entry.type === 'application/ld+json'));
    assert.deepEqual(rendered.map((entry) => entry.json), [breadcrumb, article, authored]);
    assert.doesNotMatch(html, /&quot;|self\.__next|afterInteractive|<script(?![^>]*type="application\/ld\+json")/);
  }
});

test('Docs publication gating still withholds article and authored schemas when suppressed', () => {
  const rendered = scripts(renderToStaticMarkup(React.createElement(DocsArticleJsonLdScripts, {
    locale: 'en', slug: 'mcp', breadcrumb, article: null, structuredData: [JSON.stringify(authored)], includeAuthoredData: false,
  })));
  assert.deepEqual(rendered, [{ id: 'docs-breadcrumb-en-mcp-jsonld', type: 'application/ld+json', json: breadcrumb }]);
});

test('blog Article and breadcrumb are present before hydration even without any authored MDX schema', () => {
  const blogArticle = { ...article, '@type': 'Article' };
  for (const locale of ['en', 'fr', 'es'] as const) {
    const rendered = scripts(renderToStaticMarkup(React.createElement(BlogPostJsonLdScripts, {
      locale, slug: 'workflow', breadcrumb, article: blogArticle,
    })));
    assert.deepEqual(rendered.map((entry) => entry.id), [`breadcrumb-${locale}-workflow-jsonld`, `article-${locale}-workflow-jsonld`]);
    assert.deepEqual(rendered.map((entry) => entry.json), [breadcrumb, blogArticle]);
  }
  const withAuthored = scripts(renderToStaticMarkup(React.createElement(BlogPostJsonLdScripts, {
    locale: 'fr', slug: 'workflow', breadcrumb, article: blogArticle, structuredData: [JSON.stringify(authored)],
  })));
  assert.equal(withAuthored[2].id, 'faq-jsonld-workflow-0');
  assert.deepEqual(withAuthored[2].json, authored);
});

test('editorial routes wire server script owners and preserve the MCP publication gate', () => {
  const marketing = 'frontend/app/(localized)/[locale]/(marketing)';
  const docs = readFileSync(`${marketing}/docs/[slug]/page.tsx`, 'utf8');
  const blog = readFileSync(`${marketing}/blog/[slug]/_components/blog-post-view.tsx`, 'utf8');
  const index = readFileSync(`${marketing}/blog/page.tsx`, 'utf8');
  assert.match(docs, /<DocsArticleJsonLdScripts/);
  assert.match(docs, /article=\{docJsonLd\}/);
  assert.match(docs, /includeAuthoredData=\{doc\.slug !== 'mcp' \|\| publication\.indexable\}/);
  assert.match(blog, /<BlogPostJsonLdScripts/);
  assert.match(blog, /article=\{articleSchema\}/);
  assert.match(index, /<script\s+id="blog-list-jsonld"\s+type="application\/ld\+json"\s+dangerouslySetInnerHTML=\{\{ __html: serializeJsonLd\(articleListSchema\) \}\}/);
});

test('no public JSON-LD author depends on next/script hydration', () => {
  function visit(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (/\.tsx?$/.test(path)) {
        const source = readFileSync(path, 'utf8');
        if (/application\/ld\+json/.test(source)) assert.doesNotMatch(source, /from ['"]next\/script['"]/, path);
      }
    }
  }
  for (const root of ['frontend/app', 'frontend/components', 'frontend/src/components']) visit(root);
});
