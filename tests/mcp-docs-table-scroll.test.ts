import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { parseMarkdownFile } from '../frontend/lib/content/markdown';
import { wrapMcpDocsTables } from '../frontend/app/(localized)/[locale]/(marketing)/docs/_lib/docs-table-scroll';

const labels = {
  en: ['Integration comparison — scroll horizontally', 'MCP tools — scroll horizontally'],
  fr: ['Comparatif des intégrations — défilement horizontal', 'Outils MCP — défilement horizontal'],
  es: ['Comparación de integraciones — desplazamiento horizontal', 'Herramientas MCP — desplazamiento horizontal'],
};
for (const locale of ['en', 'fr', 'es'] as const) test(`${locale}: MCP regions preserve complete original tables, links and document bytes`, async () => {
  const doc = await parseMarkdownFile(`content/${locale === 'en' ? '' : locale + '/'}docs/mcp.mdx`);
  const html = wrapMcpDocsTables(doc.content, locale);
  const before = new JSDOM(doc.content), after = new JSDOM(html);
  try {
    const regions = [...after.window.document.querySelectorAll('.mcp-docs-table-scroll')];
    assert.equal(regions.length, 2);
    assert.deepEqual(regions.map(region => region.getAttribute('aria-label')), labels[locale]);
    const tables = [...before.window.document.querySelectorAll('table')];
    regions.forEach((region, index) => {
      assert.equal(region.getAttribute('role'), 'region');
      assert.equal(region.getAttribute('tabindex'), '0');
      assert.equal(region.children.length, 1);
      assert.equal(region.firstElementChild?.outerHTML, tables[index].outerHTML, 'same columns, row order, text, links and semantics');
      assert.equal(region.querySelectorAll('thead th').length, 3);
      assert.equal(region.querySelector('table')?.parentElement, region);
    });
    assert.equal(regions[1].querySelectorAll('tbody tr').length, 14);
    assert.equal(regions[1].querySelector('tbody tr:nth-child(10) td code')?.textContent, 'confirm_generation');
    assert.equal(wrapMcpDocsTables(html, locale), html, 'a repeated render never double-wraps');
    for (const region of regions) region.replaceWith(...region.childNodes);
    assert.equal(after.window.document.body.innerHTML, before.window.document.body.innerHTML);
    const bareTables = doc.content.match(/<table\b[\s\S]*?<\/table>/g)!;
    let restored = html;
    for (let index = 0; index < 2; index++) restored = restored.replace(
      `<div class="mcp-docs-table-scroll" role="region" aria-label="${labels[locale][index]}" tabindex="0">${bareTables[index]}</div>`, bareTables[index]);
    assert.equal(restored, doc.content, 'only the two wrappers are added, without HTML reserialization');
  } finally { before.window.close(); after.window.close(); }
});

test('partly prepared HTML retains existing wrapper and assigns the remaining tools region correctly', () => {
  const table = '<table><thead><tr><th>One</th></tr></thead><tbody><tr><td><a href="/kept">Kept</a></td></tr></tbody></table>';
  const first = wrapMcpDocsTables(table, 'fr');
  const html = wrapMcpDocsTables(first + '\n<p>Between tables</p>\n' + table, 'fr');
  const dom = new JSDOM(html);
  try {
    assert.equal(dom.window.document.querySelectorAll('.mcp-docs-table-scroll .mcp-docs-table-scroll').length, 0);
    assert.deepEqual([...dom.window.document.querySelectorAll('[role="region"]')].map(region => region.getAttribute('aria-label')), labels.fr);
  } finally { dom.window.close(); }
});

test('plain prose and escaped table examples remain unchanged', () => {
  const html = '<p>A &amp; B</p><pre><code>&lt;table&gt;example&lt;/table&gt;</code></pre>';
  assert.equal(wrapMcpDocsTables(html, 'en'), html);
});

test('only the MCP document route opts into the table presentation helper', () => {
  const source = readFileSync('frontend/app/(localized)/[locale]/(marketing)/docs/[slug]/page.tsx', 'utf8');
  assert.match(source, /doc\.slug === 'mcp'\s*\? wrapMcpDocsTables\(doc\.content, locale\)\s*: doc\.content/);
});
