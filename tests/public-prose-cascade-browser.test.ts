import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { chromium } from '@playwright/test';
import { getContentEntries } from '../frontend/lib/content/markdown';
import { blogStylesPath, compileBlogStyles, publicProseStylesPath } from './helpers/blog-styles';

// Current readers render Markdown with no utility-bearing descendants. Cover
// Markdown's full typography surface, plus its explicit .not-prose exclusion.
const markup = (wrapper: string) => `<div class="marketing-site"><main>
  <h2 id="outside">Unrelated heading</h2><p id="outside-p">Unrelated copy</p>
  <article class="${wrapper}">
    <h1>Heading</h1><p>Copy with <a href="#link">link</a>, <strong>strong</strong>, <em>emphasis</em> and <code>inline code</code>.</p>
    <h2>Section</h2><h3>Subheading</h3><h4>Detail</h4><p>Another paragraph.</p>
    <ul><li>Unordered item<ul><li>Nested item</li></ul></li></ul><ol><li>Ordered item</li></ol>
    <blockquote><p>Quoted copy</p></blockquote><pre><code class="language-text">code block</code></pre><hr>
    <table><thead><tr><th>Heading</th><th>Second heading</th></tr></thead><tbody><tr><td>Cell</td><td>Second cell</td></tr></tbody></table>
    <figure><img width="160" height="90" alt="Fixture" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='90'/%3E"><figcaption>Caption</figcaption></figure>
    <iframe title="Fixture media"></iframe><video controls preload="none"></video>
    <div class="not-prose"><h2>Opted out heading</h2><p>Opted out copy <a href="#opt-out">link</a></p></div>
  </article>
  ${['h2', 'ol', 'p', 'pre'].map(tag => {
    const content = tag === 'ol' ? '<li><p>First list paragraph</p><p>Second list paragraph</p><ul><li><p>Nested list paragraph</p></li></ul></li>'
      : tag === 'pre' ? '<code class="language-text">Boundary code</code>' : '<a href="#boundary"><strong>Boundary <code>inline code</code></strong></a>';
    return `<article class="${wrapper}"><${tag}>${content}</${tag}><p>Middle paragraph</p><${tag}>${content}</${tag}></article>`;
  }).join('\n')}
  </main></div>`;
const properties = ['font-size', 'font-weight', 'font-style', 'line-height', 'color', 'background-color',
  'margin-top', 'margin-bottom', 'padding', 'border-radius', 'border-top-width', 'border-bottom-width', 'border-left-width',
  'border-color', 'box-shadow', 'list-style-type', 'max-width', 'aspect-ratio', 'text-decoration-line', 'content'];

test('public prose matches the effective legacy cascade in both themes, stylesheet orders and retained navigation', async () => {
  const [legacy, base, prose, blog, common] = await Promise.all([
    compileBlogStyles('app/globals.css', { legacyTypography: true }),
    compileBlogStyles('app/globals.css'), compileBlogStyles(publicProseStylesPath), compileBlogStyles(blogStylesPath),
    Promise.all(['marketing-redesign', 'marketing-cinema', 'marketing-navigation'].map(name =>
      readFile(join(process.cwd(), `frontend/src/styles/${name}.css`), 'utf8'))).then(styles => styles.join('\n')),
  ]);
  const browser = await chromium.launch({ headless: true });
  try {
    const entries = (await Promise.all(['content/docs', 'content/fr/docs', 'content/es/docs',
      ...['en', 'fr', 'es'].map(locale => `content/${locale}/best-for`)].map(root => getContentEntries(root)))).flat();
    assert.equal(entries.length, 45, 'actual-content coverage must be updated intentionally when the reader inventory changes');
    const actualMarkup = (wrapper: string) => `<div class="marketing-site"><main>${entries
      .map(entry => `<article class="${wrapper}">${entry.content}</article>`).join('\n')}</main></div>`;
    for (const width of [390, 1440]) for (const theme of ['light', 'dark']) {
      const page = await browser.newPage({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
      const render = (css: string, wrapper: string) => page.setContent(`<html data-theme="${theme}"><head><style id="cascade">${css}</style></head><body>${markup(wrapper)}</body></html>`);
      const snapshot = () => page.evaluate(async names => {
        await document.fonts.ready;
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        return [...document.querySelectorAll('main, main *')].map(element => {
          const style = getComputedStyle(element), box = element.getBoundingClientRect();
          return { tag: element.tagName, id: element.id, geometry: [box.x, box.y, box.width, box.height],
            properties: Object.fromEntries(names.map(name => [name, style.getPropertyValue(name)])),
            marker: Object.fromEntries(names.map(name => [name, getComputedStyle(element, '::marker').getPropertyValue(name)])),
            before: Object.fromEntries(names.map(name => [name, getComputedStyle(element, '::before').getPropertyValue(name)])),
            after: Object.fromEntries(names.map(name => [name, getComputedStyle(element, '::after').getPropertyValue(name)])) };
        });
      }, properties);
      await render(legacy + '\n' + common + '\n' + blog, 'prose prose-slate max-w-none');
      const reference = await snapshot();
      for (const css of [base + '\n' + prose + '\n' + common + '\n' + blog,
        base + '\n' + common + '\n' + blog + '\n' + prose, prose + '\n' + base + '\n' + common + '\n' + blog]) {
        await render(css, 'public-prose prose');
        assert.deepEqual(await snapshot(), reference, `${width}px/${theme}: candidate/order changes geometry or computed typography`);
        await page.evaluate(() => document.querySelectorAll('article').forEach(article => article.remove()));
        const retained = await snapshot();
        await page.evaluate(value => { document.getElementById('cascade')!.textContent = value; }, base + '\n' + common + '\n' + blog);
        assert.deepEqual(await snapshot(), retained, `${width}px/${theme}: retained prose changes unrelated DOM`);
        // Re-add the reader after an unrelated client view; the native sheet is
        // already retained and the shared CSS need not arrive again.
        await page.evaluate(({ styles, html }) => {
          document.getElementById('cascade')!.textContent = styles;
          document.body.innerHTML = html;
        }, { styles: css, html: markup('public-prose prose') });
        assert.deepEqual(await snapshot(), reference, `${width}px/${theme}: returning reader loses its retained cascade`);
      }
      await page.setContent(`<html data-theme="${theme}"><head><style>${legacy}\n${common}\n${blog}</style></head><body>${actualMarkup('prose prose-slate max-w-none')}</body></html>`);
      const actualReference = await snapshot();
      await page.setContent(`<html data-theme="${theme}"><head><style>${base}\n${common}\n${blog}\n${prose}</style></head><body>${actualMarkup('public-prose prose')}</body></html>`);
      assert.deepEqual(await snapshot(), actualReference, `${width}px/${theme}: actual Markdown typography or geometry changes`);
      await page.close();
    }
  } finally { await browser.close(); }
});
