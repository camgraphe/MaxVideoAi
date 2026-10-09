import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { getContentEntries } from '../frontend/lib/content/markdown';
import { blogStylesPath, compileBlogStyles, publicProseStylesPath } from './helpers/blog-styles';

const requireFrontend = createRequire(join(process.cwd(), 'frontend/package.json'));
const postcss = requireFrontend('postcss');
type Rule = { selector: string; parent: { type: string; name?: string; params?: string; parent?: Rule['parent'] }; nodes: { type: string; prop: string; value: string; important?: boolean }[] };
function rules(css: string) {
  const result: { selector: string; context: string[]; declarations: [string, string, boolean][] }[] = [];
  postcss.parse(css).walkRules((rule: Rule) => {
    const context: string[] = [];
    for (let parent = rule.parent; parent; parent = parent.parent!) {
      if (parent.type === 'atrule') context.unshift(`${parent.name} ${parent.params}`);
    }
    result.push({ selector: rule.selector, context, declarations: rule.nodes.filter(node => node.type === 'decl')
      .map(node => [node.prop, node.value, Boolean(node.important)]) });
  });
  return result;
}
const typography = (selector: string) => /^\.prose(?:\b|-)/.test(selector);
const globalStyles = Promise.all([
  compileBlogStyles('app/globals.css', { legacyTypography: true }),
  compileBlogStyles('app/globals.css'),
]);

test('default output removes typography while preserving every other ordered global rule', async () => {
  const [legacy, global] = await globalStyles;
  const before = rules(legacy), after = rules(global);
  assert.ok(before.some(rule => typography(rule.selector)), 'reference must contain the old typography owner');
  assert.ok(!after.some(rule => typography(rule.selector)), 'unrelated routes must not receive prose output');
  assert.deepEqual(after, before.filter(rule => !typography(rule.selector)));
});

test('native public prose equals the effective slate/width cascade and emits no reset or utilities', async () => {
  const [[legacy], scoped] = await Promise.all([globalStyles, compileBlogStyles(publicProseStylesPath)]);
  const effective = (css: string) => {
    const result = new Map<string, Record<string, string>>();
    for (const rule of rules(css)) {
      const values = Object.fromEntries(rule.declarations.map(([property, value, important]) => [property, value + (important ? ' !important' : '')]));
      for (const selector of postcss.list.comma(rule.selector)) result.set(selector, { ...result.get(selector), ...values });
    }
    return result;
  };
  const before = effective(legacy), after = effective(scoped);
  const root = { ...before.get('.prose'), ...before.get('.prose-slate'), ...before.get('.max-w-none') };
  assert.equal(root['--tw-prose-body'], '#334155', 'reference must include Slate rather than the gray default');
  assert.equal(root['max-width'], 'none');
  const expected = new Map([...before].filter(([selector]) => selector === '.prose' || /^\.prose[\s:]/.test(selector)));
  expected.set('.prose', root);
  const actual = new Map([...after].map(([selector, values]) => {
    assert.match(selector, /^\.public-prose(?=[\s:.\[]|$)/, 'reader must not leak reset or unrelated rules');
    return [selector.replace(/\.public-prose\b/g, '.prose'), values];
  }));
  assert.deepEqual(actual, expected);
  const proseVariables = (css: string, selectors: string[]) => rules(css)
    .filter(rule => selectors.includes(rule.selector))
    .flatMap(rule => rule.declarations.filter(([property]) => property.startsWith('--tw-prose-')));
  assert.deepEqual(proseVariables(scoped, ['.public-prose']),
    proseVariables(legacy, ['.prose', '.prose-slate']),
    'ordered gray then Slate variable declarations must keep the same override priority');
  // Comparing selector maps alone cannot detect reordered overlapping rules.
  // Keep the complete descendant sequence, including literal .prose references
  // that Tailwind's @apply preserves inside :where().
  assert.deepEqual(rules(scoped).filter(rule => rule.selector.startsWith('.public-prose '))
    .map(rule => ({ ...rule, selector: rule.selector.replace(/^\.public-prose/, '.prose') })),
  rules(legacy).filter(rule => rule.selector.startsWith('.prose ')));
  assert.ok(Buffer.byteLength(scoped) < 20 * 1024);
});

test('dedicated typography config preserves exact compiled blog output', async () => {
  assert.equal(await compileBlogStyles(blogStylesPath), await compileBlogStyles(blogStylesPath, { legacyTypography: true }));
});

test('both Markdown owners import their native sheet synchronously and English entries reuse them', () => {
  const marketing = 'frontend/app/(localized)/[locale]/(marketing)/';
  for (const owner of ['docs/[slug]/page.tsx', 'ai-video-engines/best-for/[usecase]/_components/BestForEditorialPanels.tsx']) {
    const source = readFileSync(marketing + owner, 'utf8');
    assert.match(source, /import ['"]@\/components\/marketing\/public-prose\.css['"]/);
    assert.match(source, /className="public-prose prose"/,
      'the prose marker must keep all seven literal internal selectors matching');
    assert.doesNotMatch(source, /className="prose prose-slate max-w-none"|\buseEffect\b|^['"]use client['"]/);
  }
  for (const owner of ['frontend/app/layout.tsx', marketing + 'layout.tsx']) {
    assert.doesNotMatch(readFileSync(owner, 'utf8'), /public-prose\.css/);
  }
  assert.match(readFileSync('frontend/app/docs/[slug]/page.tsx', 'utf8'), /\(localized\).*\/docs\/\[slug\]\/page/);
  assert.match(readFileSync('frontend/app/ai-video-engines/best-for/[usecase]/page.tsx', 'utf8'), /\(localized\).*\/best-for\/\[usecase\]\/page/);
});

test('all generated docs and BestFor Markdown has no utility-bearing descendants requiring another cascade policy', async () => {
  const roots = ['content/docs', 'content/fr/docs', 'content/es/docs', ...['en', 'fr', 'es'].map(locale => `content/${locale}/best-for`)];
  for (const root of roots) {
    const entries = await getContentEntries(root);
    assert.ok(entries.length > 0, `${root}: content guard must inspect real generated HTML`);
    for (const entry of entries) {
      const dom = new JSDOM(entry.content);
      try {
        for (const element of dom.window.document.querySelectorAll('[class]')) {
          for (const className of element.classList) assert.match(className, /^language-[\w-]+$/,
            `${entry.sourcePath}: ${element.tagName}.${className} requires intentional native-sheet/utility cascade review`);
        }
      } finally { dom.window.close(); }
    }
  }
});
