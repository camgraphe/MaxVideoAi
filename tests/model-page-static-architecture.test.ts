import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const facadePath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-static.ts');
const staticMediaPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-static-media.ts');
const runtimeMediaPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-media.ts');
const focusVsPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-focus-vs.ts');

const facadeSource = readFileSync(facadePath, 'utf8');
const staticMediaSource = readFileSync(staticMediaPath, 'utf8');
const runtimeMediaSource = readFileSync(runtimeMediaPath, 'utf8');
const focusVsSource = readFileSync(focusVsPath, 'utf8');

test('model page static module stays a compatibility facade', () => {
  assert.ok(existsSync(staticMediaPath), 'model page static media constants should live in a focused module');
  assert.ok(existsSync(runtimeMediaPath), 'model page runtime media helpers should keep their existing focused module');
  assert.ok(existsSync(focusVsPath), 'model page focus-vs copy should live in a focused module');
  assert.match(facadeSource, /from '\.\/model-page-static-media'/);
  assert.match(facadeSource, /from '\.\/model-page-focus-vs'/);

  const lineCount = facadeSource.split('\n').length;
  assert.ok(lineCount <= 12, `model-page-static.ts should stay as a facade, got ${lineCount} lines`);

  for (const owner of ['const PREFERRED_MEDIA', 'const PREP_LINK_VISUALS', 'const FOCUS_VS_PAIRS']) {
    assert.doesNotMatch(facadeSource, new RegExp(owner), `${owner} should not live in the facade`);
  }
});

test('model page media and focus-vs modules expose the stable static contracts', () => {
  assert.match(staticMediaSource, /export const PREFERRED_MEDIA/);
  assert.match(staticMediaSource, /export const PREP_LINK_VISUALS/);
  assert.match(runtimeMediaSource, /export function pickHeroMedia/);
  assert.match(runtimeMediaSource, /export function toGalleryCard/);
  assert.match(focusVsSource, /export type FocusVsConfig/);
  assert.match(focusVsSource, /const FOCUS_VS_PAIRS/);
  assert.match(focusVsSource, /export function resolveFocusVsConfig/);
});
