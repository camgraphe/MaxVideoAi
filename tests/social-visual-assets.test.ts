import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const publicRoot = path.join(root, 'frontend/public');
const version = '2026-09-25';

function pngSize(file: string): [number, number] {
  const bytes = readFileSync(path.join(publicRoot, file));
  assert.equal(bytes.subarray(1, 4).toString('ascii'), 'PNG');
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

function webpSize(file: string): [number, number] {
  const bytes = readFileSync(path.join(publicRoot, file));
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
  assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
  assert.equal(bytes.toString('ascii', 12, 16), 'VP8 ');
  return [bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff];
}

test('current social cards keep crawler dimensions and versioned route references', () => {
  const routes = [
    ['brand', 'frontend/lib/seo/metadata.ts'],
    ['home', 'frontend/app/(localized)/[locale]/(marketing)/(home)/page.tsx'],
    ['models', 'frontend/app/(localized)/[locale]/(marketing)/models/ModelsCatalogPage.tsx'],
    ['compare', 'frontend/app/(localized)/[locale]/(marketing)/ai-video-engines/page.tsx'],
    ['pricing', 'frontend/app/(localized)/[locale]/(marketing)/pricing/page.tsx'],
  ] as const;

  for (const [name, source] of routes) {
    const file = `/og/${name}-${version}.png`;
    assert.deepEqual(pngSize(file), [1200, 630], file);
    assert.match(readFileSync(path.join(root, source), 'utf8'), new RegExp(file.replaceAll('.', '\\.')));
  }
});

test('social cards retain the dated production captures used as their source', () => {
  for (const name of ['home-overview', 'home-player', 'models', 'compare', 'pricing']) {
    const file = path.join(root, 'frontend/scripts/social-card-sources', `${name}-${version}.jpg`);
    const bytes = readFileSync(file);
    assert.equal(bytes.readUInt16BE(0), 0xffd8, file);
    assert.ok(bytes.byteLength > 20_000, file);
  }
});

test('tool previews are real, bounded 1316 by 820 captures with fresh cache keys', () => {
  const source = readFileSync(path.join(root, 'frontend/src/components/tools/landing/tool-workspace-assets.ts'), 'utf8');
  for (const name of ['angle', 'background-removal', 'character-builder', 'upscale']) {
    const file = `/assets/tools/redesign/${name}-workspace-v2.webp`;
    assert.match(source, new RegExp(file.replaceAll('.', '\\.')));
    assert.deepEqual(webpSize(file), [1316, 820], file);
    assert.ok(readFileSync(path.join(publicRoot, file)).byteLength < 150_000, file);
  }
});
