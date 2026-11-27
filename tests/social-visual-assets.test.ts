import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import test from 'node:test';

import cards from '../frontend/config/social-preview-images.json';
import { locales } from '../frontend/i18n/locales';
import { BRAND_SOCIAL_IMAGE, modelSocialImage, pageSocialImage, socialPreviewPages } from '../frontend/lib/seo/social-preview-images';
import { readImageDimensions, validateImageDecode } from '../scripts/register-github-asset.mjs';

const root = process.cwd();
const publicRoot = path.join(root, 'frontend/public');
function webpSize(file: string): [number, number] {
  const bytes = readFileSync(path.join(publicRoot, file));
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
  assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
  assert.equal(bytes.toString('ascii', 12, 16), 'VP8 ');
  return [bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff];
}

test('every reviewed page, model and archive card decodes at the declared social size', async () => {
  const paths = new Set([BRAND_SOCIAL_IMAGE]);
  for (const locale of locales) {
    for (const page of socialPreviewPages) paths.add(pageSocialImage(page, locale));
    for (const slug of [...cards.modelCards, ...cards.archiveCards]) {
      const image = modelSocialImage(slug, locale);
      assert.ok(image, slug);
      paths.add(image);
    }
  }
  const files = readdirSync(path.join(publicRoot, cards.directory), { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => '/' + path.relative(publicRoot, path.join(entry.parentPath, entry.name)).split(path.sep).join('/'));
  assert.deepEqual([...paths].sort(), files.sort());
  for (const image of paths) {
    const bytes = readFileSync(path.join(publicRoot, image));
    assert.deepEqual(readImageDimensions(bytes), { width: 1200, height: 630, format: 'jpeg' }, image);
    await validateImageDecode(bytes);
  }
});

test('model social images distinguish current examples, localized archives and unreviewed models', () => {
  const first = modelSocialImage('kling-v4', 'fr');
  assert.ok(first);
  assert.equal(first, modelSocialImage('kling-v4', 'en'));
  assert.notEqual(first, modelSocialImage('wan-3-prime', 'fr'));
  assert.notEqual(modelSocialImage('sora-2', 'fr'), modelSocialImage('sora-2', 'es'));
  assert.equal(modelSocialImage('seedance-2-5', 'en'), undefined);
  assert.equal(modelSocialImage('unknown', 'en'), undefined);
});

test('previously shared screenshot URLs redirect to their reviewed replacements', async () => {
  const require = createRequire(import.meta.url);
  const rules: { source: string; destination: string; permanent?: boolean }[] =
    await require('../frontend/next.config.js').redirects();
  const expected = new Map<string, string>();
  for (const page of ['home', 'models', 'compare', 'pricing'] as const) {
    expected.set(`/og/${page}-2026-09-25.png`, pageSocialImage(page, 'en'));
    expected.set(`/og/${page}-hub.png`, pageSocialImage(page, 'en'));
  }
  for (const url of ['/og-default.jpg', '/og/brand-2026-09-25.png', '/og/price-before.png', '/assets/branding/og-image.png']) {
    expected.set(url, BRAND_SOCIAL_IMAGE);
  }
  for (const [source, destination] of expected) {
    const rule = rules.find(rule => rule.source === source);
    assert.equal(rule?.destination, destination, source);
    assert.equal(rule?.permanent, false, source);
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
