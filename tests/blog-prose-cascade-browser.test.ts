import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';
import { chromium } from '@playwright/test';
import { blogStylesPath, compileBlogStyles } from './helpers/blog-styles';

// Native media and h1 are absent from the representative live Markdown article.
// This bounded fixture exercises their real compiled styles without content edits.
const markup = `<div class="marketing-site"><main>
  <h2 id="outside">Unrelated heading</h2><p id="outside-p">Unrelated copy</p>
  <article class="blog-prose px-6 py-10 sm:px-10">
    <h1>Article heading</h1><p>Copy with <a href="#link">a link</a>, <strong>strong text</strong> and <code>inline code</code>.</p>
    <h2>Section heading</h2><h3>Subheading</h3><h4>Detail heading</h4>
    <ul><li>Unordered item</li></ul><ol><li>Ordered item</li></ol>
    <blockquote><p>Quoted copy</p></blockquote><pre><code>code block</code></pre><hr>
    <table><thead><tr><th>Heading</th></tr></thead><tbody><tr><td>Cell</td></tr></tbody></table>
    <img width="160" height="90" alt="Fixture" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='90'/%3E">
    <iframe title="Fixture media" srcdoc="<p>Media</p>"></iframe><video controls preload="none"></video>
    <div class="not-prose"><h2>Opted out heading</h2><p>Opted out copy</p></div>
  </article></main></div>`;

test('article prose preserves its cascade across shared stylesheet orders and unrelated navigation', async () => {
  const [base, article, common] = await Promise.all([
    compileBlogStyles('app/globals.css'), compileBlogStyles(blogStylesPath),
    Promise.all(['marketing-redesign', 'marketing-cinema', 'marketing-navigation']
      .map(name => readFile(join(process.cwd(), `frontend/src/styles/${name}.css`), 'utf8')))
      .then(styles => styles.join('\n')),
  ]);
  const reference = process.env.BLOG_PROSE_REFERENCE_CSS
    ? await readFile(process.env.BLOG_PROSE_REFERENCE_CSS, 'utf8') : null;
  const browser = await chromium.launch({ headless: true });
  try {
    for (const width of [390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
      const render = (css: string) => page.setContent(`<html><head><style>${base}</style><style id="cascade">${css}</style></head><body>${markup}</body></html>`);
      const snapshot = () => page.evaluate(async () => {
        await document.fonts.ready;
        await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
        return [...document.querySelectorAll('main, main *')].map(element => {
          const css = getComputedStyle(element), box = element.getBoundingClientRect();
          return { tag: element.tagName, id: element.id, className: element.getAttribute('class'),
            geometry: [box.x, box.y, box.width, box.height],
            properties: Object.fromEntries(['font-size', 'font-weight', 'line-height', 'color', 'background-color',
              'margin-top', 'margin-bottom', 'padding', 'border-radius', 'border-top-width', 'border-left-width',
              'border-color', 'box-shadow', 'list-style-type', 'max-width', 'aspect-ratio']
              .map(property => [property, css.getPropertyValue(property)])) };
        });
      });
      const snapshots = [];
      for (const css of [article + '\n' + common, common + '\n' + article]) {
        await render(css);
        snapshots.push(await snapshot());
      }
      assert.deepEqual(snapshots[1], snapshots[0], `${width}px: retained route CSS changes the article/shared cascade`);
      if (reference) {
        await render(common + '\n' + reference);
        assert.deepEqual(snapshots[1], await snapshot(), `${width}px: candidate differs from compiled reference prose`);
      }
      // Returning to the index can retain route CSS. It must not alter outside content.
      await render(common);
      const sharedOnly = (await snapshot()).filter(entry => entry.id.startsWith('outside'));
      await page.evaluate(value => { document.getElementById('cascade')!.textContent = value; }, common + '\n' + article);
      assert.deepEqual((await snapshot()).filter(entry => entry.id.startsWith('outside')), sharedOnly);
      await page.close();
    }
  } finally { await browser.close(); }
});
