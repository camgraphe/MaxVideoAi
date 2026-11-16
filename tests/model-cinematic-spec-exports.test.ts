import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { buildCinematicSpecExports, buildCinematicSpecRows } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-cinematic-specs';

test('image specification additions follow the actual composer fields and omit absent capabilities', () => {
  const engine = getFalEngineById('seedream-5-5')!.engine;
  const rows = buildCinematicSpecRows([], engine, 'en', true);
  assert.equal(rows.find(row => row.id === 'imageReferenceCount')?.value, 'Up to 10');
  assert.equal(rows.find(row => row.id === 'imageOutputCount')?.value, '1');
  assert.ok(rows.find(row => row.id === 'imageBackground')?.value.includes('Transparent (PNG)'));
  const changed = structuredClone(engine);
  changed.inputSchema!.optional!.find(field => field.id === 'image_urls')!.maxCount = 3;
  changed.inputSchema!.optional = changed.inputSchema!.optional!.filter(field => field.id !== 'background');
  const next = buildCinematicSpecRows([], changed, 'fr', true);
  assert.equal(next.find(row => row.id === 'imageReferenceCount')?.value, 'Jusqu’à 3');
  assert.equal(next.some(row => row.id === 'imageBackground'), false);
  assert.deepEqual(buildCinematicSpecRows([], { ...engine, inputSchema: undefined }, 'en', true), []);
});

test('exports preserve full specification values and localized canonical attribution', () => {
  const rows = [{ id: 'ratios', label: 'Ratios', value: 'auto / 1:1 / 4:3 / 3:4 / 16:9 / 9:16 / 3:2 / 2:3 / 21:9' }];
  const source = 'https://maxvideoai.com/fr/modeles/seedream-5-5#specs';
  const result = buildCinematicSpecExports({ title: 'Seedream 5.5 — Caractéristiques', rows, source, locale: 'fr' });
  for (const format of [result.text, result.html, result.csv]) {
    assert.ok(format.includes(rows[0].value));
    assert.ok(format.includes(source));
  }
  const doc = new JSDOM(result.html).window.document;
  assert.equal(doc.querySelector('tbody th')?.getAttribute('scope'), 'row');
  assert.equal(doc.querySelector('tbody td')?.textContent, rows[0].value);
  assert.equal(doc.querySelector('a')?.getAttribute('href'), source);
  assert.ok(result.csv.startsWith('\uFEFF'), 'UTF-8 accents survive common spreadsheet readers');
});

test('reusable tables escape markup, delimiters and spreadsheet formulas', () => {
  const rows = [{ id: 'sample', label: '=1+1', value: '<script>alert(1)</script> | "quote",\nnext line' }];
  const result = buildCinematicSpecExports({ title: 'A < B & C', rows, source: 'https://maxvideoai.com/models/example#specs', locale: 'en' });
  const doc = new JSDOM(result.html).window.document;
  assert.equal(doc.querySelector('script'), null);
  assert.equal(doc.querySelector('td')?.textContent, rows[0].value);
  assert.ok(result.text.includes('\\|'));
  assert.ok(result.csv.includes('"\'=1+1"'));
  assert.ok(result.csv.includes('""quote""'));
});

test('canonical localized statuses are shared by displayed and exported rows, without stale prices', () => {
  const rows = buildCinematicSpecRows([
    { id: 'textToImage', key: 'textToImage', label: 'Création', value: 'Supported' },
    { id: 'pricePerImage', key: 'pricePerImage', label: 'Price', value: '$0.01' },
  ], getFalEngineById('seedream-5-5')!.engine, 'fr', false);
  assert.equal(rows.length, 1);
  assert.notEqual(rows[0].value, 'Supported');
  const result = buildCinematicSpecExports({ title: 'Seedream 5.5', rows, source: 'https://maxvideoai.com/fr/modeles/seedream-5-5#specs', locale: 'fr' });
  assert.ok(!result.text.includes('$0.01'));
  assert.ok(result.text.includes(rows[0].value));
});
