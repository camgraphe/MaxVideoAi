import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium, webkit, expect } from '@playwright/test';
import { parseMarkdownFile } from '../frontend/lib/content/markdown';
import { wrapMcpDocsTables } from '../frontend/app/(localized)/[locale]/(marketing)/docs/_lib/docs-table-scroll';
import { compileBlogStyles, publicProseStylesPath } from './helpers/blog-styles';

const toolsLabels = {
  en: 'MCP tools — scroll horizontally',
  fr: 'Outils MCP — défilement horizontal',
  es: 'Herramientas MCP — desplazamiento horizontal',
};

test('only MCP tables scroll, preserving localized desktop columns and keyboard access', { timeout: 120000 }, async () => {
  const evidence = process.env.MCP_TABLE_EVIDENCE_DIR;
  if (evidence) await mkdir(evidence, { recursive: true });
  const docs = Object.fromEntries(await Promise.all(['en', 'fr', 'es'].map(async locale => [locale,
    await parseMarkdownFile(`content/${locale === 'en' ? '' : locale + '/'}docs/mcp.mdx`)])));
  const witness = await parseMarkdownFile('content/fr/docs/get-started.mdx');
  const [global, prose, marketing] = await Promise.all([
    compileBlogStyles('app/globals.css'), compileBlogStyles(publicProseStylesPath),
    readFile('frontend/src/styles/marketing-redesign.css', 'utf8'),
  ]);
  const requireFrontend = createRequire(join(process.cwd(), 'frontend/package.json'));
  const beforeProse = requireFrontend('postcss').parse(prose);
  beforeProse.walkRules((rule: { selector: string; remove: () => void }) => {
    if (rule.selector.includes('.mcp-docs-table-scroll')) rule.remove();
  });
  const server = createServer((request, response) => {
    const params = new URL(request.url ?? '/', 'http://fixture').searchParams;
    const locale = (params.get('locale') ?? 'en') as keyof typeof toolsLabels;
    const before = params.has('before'), other = params.has('witness');
    const doc = other ? witness : docs[locale];
    const content = before || other ? doc.content : wrapMcpDocsTables(doc.content, locale);
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(`<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${global}\n${marketing}\n${before ? beforeProse.toString() : prose}</style></head><body><div class="marketing-site"><main class="container-page max-w-3xl section"><article class="stack-gap-lg"><a href="#exit">Keyboard entry</a><header><h1>${doc.title}</h1><p>${doc.description}</p></header><div class="public-prose prose">${content}</div><a id="exit" href="#top">Keyboard exit</a></article></main></div></body></html>`);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const origin = `http://127.0.0.1:${address.port}`;
  const report: unknown[] = [];
  try {
    for (const name of ['chromium', 'webkit'] as const) {
      const browser = name === 'webkit' ? await webkit.launch({ headless: true }) : await chromium.launch({ headless: true });
      try {
        for (const width of [320, 390, 1440]) for (const locale of ['en', 'fr', 'es'] as const) {
          const page = await browser.newPage({ viewport: { width, height: 844 }, reducedMotion: 'reduce' });
          const scripts: string[] = [], errors: string[] = [];
          page.on('request', request => { if (request.resourceType() === 'script') scripts.push(request.url()); });
          page.on('pageerror', error => errors.push(error.message));
          const geometry = () => page.evaluate(() => ({
            client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth,
            spacing: [...document.querySelectorAll('table')].map(table => ({
              tableFont: getComputedStyle(table).fontSize, tableMargin: getComputedStyle(table).margin,
              parentFont: getComputedStyle(table.parentElement!).fontSize, parentMargin: getComputedStyle(table.parentElement!).margin,
            })),
            tables: [...document.querySelectorAll('table')].map(table => ({
              top: table.getBoundingClientRect().top, width: table.getBoundingClientRect().width, height: table.getBoundingClientRect().height,
              columns: [...table.querySelectorAll('thead th')].map(cell => ({ width: cell.getBoundingClientRect().width, text: cell.textContent })),
            })),
          }));
          await page.goto(`${origin}/?locale=${locale}&before`);
          const before = await geometry();
          if (width < 700) assert.ok(before.scroll > before.client + 1, 'reproduce original document overflow');
          if (evidence && width !== 320) {
            await page.locator('table').nth(1).evaluate(element => element.previousElementSibling!.scrollIntoView({ block: 'start' }));
            await page.screenshot({ path: `${evidence}/${name}-${locale}-${width}-before.png` });
          }
          await page.goto(`${origin}/?locale=${locale}`);
          const after = await geometry();
          report.push({ browser: name, locale, width, before, after });
          if (evidence) await writeFile(`${evidence}/geometry.json`, JSON.stringify(report, null, 2));
          assert.ok(after.scroll <= after.client + 1, 'document stays inside viewport');
          const regions = page.getByRole('region');
          await expect(regions).toHaveCount(2);
          const tools = page.getByRole('region', { name: toolsLabels[locale], exact: true });
          if (width < 700) {
            await tools.scrollIntoViewIfNeeded();
            assert.equal(await tools.evaluate(element => getComputedStyle(element).overflowX), 'auto');
            assert.ok(await tools.evaluate(element => element.scrollWidth > element.clientWidth));
            await tools.evaluate(element => {
              const focusable = [...document.querySelectorAll<HTMLElement>('a[href],[tabindex="0"]')];
              focusable[focusable.indexOf(element as HTMLElement) - 1].focus();
            });
            // Chromium also puts scrollable pre blocks in the native tab order.
            for (let step = 0; step < 16 && !await tools.evaluate(element => element === document.activeElement); step++) {
              await page.keyboard.press('Tab');
            }
            if (evidence) await writeFile(`${evidence}/focus.json`, JSON.stringify(await page.evaluate(() => ({
              active: document.activeElement?.outerHTML.slice(0, 1200),
            })), null, 2));
            await expect(tools).toBeFocused();
            assert.equal(await tools.evaluate(element => getComputedStyle(element).outlineStyle), 'solid');
            assert.equal(await tools.evaluate(element => getComputedStyle(element).outlineWidth), '2px');
            // WebKit's native scroll needs a non-zero key-down interval.
            await page.keyboard.press('ArrowRight', { delay: 150 });
            await expect.poll(() => tools.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
            // Native smooth scrolling may finish after a key-up; repeat the
            // input while polling the reachable edge, not each animation step.
            await expect.poll(async () => {
              await page.keyboard.press('ArrowRight', { delay: 150 });
              return tools.evaluate(element => element.scrollWidth - element.clientWidth - element.scrollLeft);
            }).toBeLessThan(2);
            assert.equal(await tools.evaluate(element => element.querySelector('tr:last-child td:last-child')!.getBoundingClientRect().right <= element.getBoundingClientRect().right + 1), true);
            assert.equal(await page.evaluate(() => scrollX), 0);
            await page.keyboard.press('Tab');
            assert.equal(await tools.evaluate(element => element.contains(document.activeElement)), false, 'Tab leaves the region without a focus trap');
          } else {
            assert.deepEqual(after.tables, before.tables, 'desktop column order, widths and table height are unchanged');
          }
          if (evidence && width !== 320) {
            if (width < 700) await page.screenshot({ path: `${evidence}/${name}-${locale}-${width}-after-scrolled.png` });
            await tools.evaluate(element => {
              element.scrollLeft = 0;
              element.previousElementSibling!.scrollIntoView({ block: 'start' });
            });
            await page.screenshot({ path: `${evidence}/${name}-${locale}-${width}-after.png` });
          }
          assert.deepEqual(scripts, [], 'server presentation adds no client script');
          assert.deepEqual(errors, []);
          if (locale === 'fr') {
            const snapshot = () => page.locator('.public-prose').evaluate(element => [...element.querySelectorAll('*')].map(node => {
              const box = node.getBoundingClientRect(), css = getComputedStyle(node);
              return [node.tagName, node.textContent, box.width, box.height, css.fontSize, css.lineHeight, css.marginTop, css.marginBottom];
            }));
            await page.goto(`${origin}/?witness&before`);
            const reference = await snapshot();
            await page.goto(`${origin}/?witness`);
            assert.deepEqual(await snapshot(), reference, 'non-MCP document retains all content and measured styles');
            await expect(page.getByRole('region')).toHaveCount(0);
          }
          await page.close();
        }
      } finally { await browser.close(); }
    }
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
