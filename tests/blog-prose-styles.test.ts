import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import test from 'node:test';
import { blogStylesPath, compileBlogStyles } from './helpers/blog-styles';

const requireFrontend = createRequire(join(process.cwd(), 'frontend/package.json'));
const postcss = requireFrontend('postcss');
const compiled = compileBlogStyles(blogStylesPath);

test('compiled article CSS never emits a global reset or unrelated utilities', async () => {
  const css = await compiled;
  const unscoped: string[] = [];
  postcss.parse(css).walkRules((rule: { selector: string }) => {
    for (const selector of postcss.list.comma(rule.selector)) {
      if (!/^\.blog-prose(?=[\s:.\[]|$)/.test(selector)) unscoped.push(selector);
    }
  });
  assert.equal(unscoped.length, 0, `article CSS leaks ${unscoped.length} selectors: ${unscoped.slice(0, 8).join(', ')}`);
  assert.ok(Buffer.byteLength(css) < 24 * 1024, 'article CSS should remain a bounded prose sheet');
});

test('compiled prose retains typography, article surfaces and native media geometry', async () => {
  const css = await compiled;
  const declarations = new Map<string, Record<string, string>>();
  postcss.parse(css).walkRules((rule: { selector: string; walkDecls: (visit: (decl: { prop: string; value: string }) => void) => void }) => {
    const properties: Record<string, string> = {};
    rule.walkDecls(decl => { properties[decl.prop] = decl.value; });
    for (const selector of postcss.list.comma(rule.selector)) {
      declarations.set(selector, { ...declarations.get(selector), ...properties });
    }
  });
  const style = (selector: string) => declarations.get(selector) ?? {};
  assert.equal(style('.blog-prose')['max-width'], 'none');
  assert.equal(style('.blog-prose h2')['margin-top'], 'var(--space-7)');
  assert.equal(style('.blog-prose h3')['margin-top'], 'var(--space-6)');
  assert.equal(style('.blog-prose pre').padding, '1.25rem');
  assert.equal(style('.blog-prose code:not(pre code)')['font-size'], '0.75rem');
  assert.equal(style('.blog-prose blockquote')['border-left-width'], '4px');
  assert.equal(style('.blog-prose table')['border-radius'], '1rem');
  assert.equal(style('.blog-prose tbody tr td')['border-top-width'], '1px');
  assert.match(css, /\.blog-prose[^{}]*:where\(h1\)/);
  assert.match(css, /\.blog-prose[^{}]*:where\(ul\)/);
  assert.match(css, /\.blog-prose[^{}]*:where\(ol\)/);
  assert.match(css, /\.blog-prose[^{}]*:where\(img\)/);
  assert.match(css, /@supports\s*\(aspect-ratio: 16 \/ 9\)/);
  assert.equal(style('.blog-prose iframe')['aspect-ratio'], '16 / 9');
  assert.equal(style('.blog-prose video')['aspect-ratio'], '16 / 9');
});
