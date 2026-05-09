import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const facadePath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-static.ts');
const staticMediaPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-static-media.ts');
const runtimeMediaPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-media.ts');
const focusVsPath = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-focus-vs.ts');
const focusVsDir = join(root, 'frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-focus-vs');
const focusVsModules = [
  'creative-pairs.ts',
  'foundation-pairs.ts',
  'kling-pairs.ts',
  'pairs.ts',
  'resolve.ts',
  'seedance-pairs.ts',
  'specialized-pairs.ts',
  'types.ts',
];

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
  assert.match(focusVsSource, /export type \{ FocusVsConfig \}/);
  assert.match(focusVsSource, /from '\.\/model-page-focus-vs\/resolve'/);
  assert.match(readFileSync(join(focusVsDir, 'pairs.ts'), 'utf8'), /export const FOCUS_VS_PAIRS/);
  assert.match(readFileSync(join(focusVsDir, 'resolve.ts'), 'utf8'), /export function resolveFocusVsConfig/);
});

test('model page focus-vs copy stays split by model family', () => {
  for (const moduleName of focusVsModules) {
    const modulePath = join(focusVsDir, moduleName);
    assert.ok(existsSync(modulePath), `${moduleName} should exist under model-page-focus-vs`);
    const lineCount = readFileSync(modulePath, 'utf8').split('\n').length;
    assert.ok(lineCount <= 220, `${moduleName} should stay below 220 lines, got ${lineCount}`);
  }

  const lineCount = focusVsSource.split('\n').length;
  assert.ok(lineCount <= 12, `model-page-focus-vs.ts should stay a thin facade, got ${lineCount}`);
  assert.doesNotMatch(focusVsSource, /slugA:/);
  assert.doesNotMatch(focusVsSource, /copyA:/);
});
