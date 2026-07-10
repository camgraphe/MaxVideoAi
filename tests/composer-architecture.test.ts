import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const composerPath = join(root, 'frontend/components/Composer.tsx');
const composerTypesPath = join(root, 'frontend/components/composer/composer-types.ts');
const composerCopyPath = join(root, 'frontend/components/composer/composer-copy.ts');
const multiPromptEditorPath = join(root, 'frontend/components/composer/ComposerMultiPromptEditor.tsx');
const promotedActionIconPath = join(root, 'frontend/components/composer/ComposerPromotedActionIcon.tsx');

const composerSource = readFileSync(composerPath, 'utf8');
const composerTypesSource = readFileSync(composerTypesPath, 'utf8');
const composerCopySource = readFileSync(composerCopyPath, 'utf8');
const multiPromptEditorSource = readFileSync(multiPromptEditorPath, 'utf8');
const promotedActionIconSource = readFileSync(promotedActionIconPath, 'utf8');

test('composer delegates copy, contracts, multi-prompt, and promoted action icon ownership', () => {
  for (const path of [composerPath, composerTypesPath, composerCopyPath, multiPromptEditorPath, promotedActionIconPath]) {
    assert.ok(existsSync(path), `${path} should exist`);
  }

  assert.match(composerSource, /<ComposerMultiPromptEditor/, 'Composer should compose the focused multi-prompt editor');
  assert.match(composerSource, /<ComposerPromotedActionIcon/, 'Composer should compose the focused promoted action icon');
  assert.doesNotMatch(composerSource, /export const DEFAULT_COMPOSER_COPY|function renderPromotedActionIcon/, 'copy and icon drawing belong in focused modules');
  assert.doesNotMatch(composerSource, /type MultiPromptScene|interface ComposerProps/, 'composer contracts belong in composer-types.ts');
  assert.match(composerTypesSource, /export interface ComposerProps/, 'composer types should own the public props contract');
  assert.match(composerTypesSource, /export type MultiPromptScene/, 'composer types should own multi-prompt scene contracts');
  assert.match(composerCopySource, /export const DEFAULT_COMPOSER_COPY/, 'composer copy should own default copy');
  assert.match(multiPromptEditorSource, /export function ComposerMultiPromptEditor/, 'multi-prompt editor should own scene rendering');
  assert.match(promotedActionIconSource, /export function ComposerPromotedActionIcon/, 'promoted action icon should own icon drawing');

  const lineCount = composerSource.split('\n').length;
  assert.ok(lineCount <= 500, `Composer.tsx should stay below 500 lines after composer surface extraction, got ${lineCount}`);
});

test('composer prompt textarea uses the configured prompt label as its accessible name', () => {
  const textareaStart = composerSource.indexOf('<textarea');
  const textareaEnd = composerSource.indexOf('suppressHydrationWarning', textareaStart);
  const textareaBlock = composerSource.slice(textareaStart, textareaEnd);

  assert.match(textareaBlock, /aria-label=\{promptLabel\}/);
});

test('composer workspace density is opt-in and keeps price inside Generate', () => {
  assert.match(composerTypesSource, /density\?: 'default' \| 'workspace'/);
  assert.match(composerSource, /density = 'default'/);
  assert.match(composerSource, /data-composer-density=\{density\}/);
  assert.match(composerSource, /workspaceDensity[\s\S]*'p-4 md:p-5'/);
  assert.match(composerSource, /rows=\{workspaceDensity \? 7 : compactPrompt \? 2 : 6\}/);
  assert.match(composerSource, /min-h-\[164px\]/);
  assert.match(composerSource, /lg:min-w-\[176px\]/);
  assert.match(composerSource, /workspaceDensity \? 'px-3' : 'px-3\.5'/);
  assert.equal(composerSource.match(/\{formattedPrice\}/g)?.length, 1);
});
