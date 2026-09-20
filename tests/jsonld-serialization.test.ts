import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { serializeJsonLd } from '../frontend/lib/seo/jsonld.ts';

test('JSON-LD cannot terminate its script element and preserves authored text', () => {
  const payload = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: '</ScRiPt><script>alert(1)</script> & café\u2028\u2029',
    description: 'An example of <video> markup, not executable HTML.',
  };
  const serialized = serializeJsonLd(payload);
  assert.doesNotMatch(serialized, /[<>&\u2028\u2029]/);
  assert.deepEqual(JSON.parse(serialized), payload);
  assert.deepEqual(JSON.parse(serializeJsonLd(JSON.parse(JSON.stringify(payload)))), payload);
  assert.throws(() => serializeJsonLd(undefined), /serializable/);
});

test('blog and docs generated and inline JSON-LD use the shared script-safe serializer', () => {
  const paths = [
    'frontend/components/SeoJsonLd.tsx',
    'frontend/app/(localized)/[locale]/(marketing)/blog/page.tsx',
    'frontend/app/(localized)/[locale]/(marketing)/blog/[slug]/_components/blog-post-jsonld-scripts.tsx',
    'frontend/app/(localized)/[locale]/(marketing)/docs/_components/DocsArticleJsonLdScripts.tsx',
    'frontend/app/(localized)/[locale]/(marketing)/docs/_components/DocsJsonLdScripts.tsx',
  ];
  for (const path of paths) {
    const source = readFileSync(path, 'utf8');
    assert.match(source, /import \{ serializeJsonLd \} from '@\/lib\/seo\/jsonld'/, path);
    assert.doesNotMatch(source, /__html: (?:JSON\.stringify\(|json\s*\})/, path);
  }
});

test('root metadata does not reintroduce an obsolete model list or blanket watermark claim', () => {
  for (const path of ['frontend/app/(core)/layout.tsx', 'frontend/app/(localized)/[locale]/layout.tsx']) {
    const source = readFileSync(path, 'utf8');
    assert.doesNotMatch(source, /Sora 2|Pika &|no watermarks/);
    assert.match(source, /web workspace or through MCP integrations/);
  }
});

test('site schemas never advertise the nonexistent site search action', () => {
  for (const path of ['frontend/app/(core)/layout.tsx', 'frontend/app/_components/LocaleRuntime.tsx']) {
    assert.doesNotMatch(readFileSync(path, 'utf8'), /SearchAction|search\?q=|ENABLE_SEARCH_SCHEMA/);
  }
});
