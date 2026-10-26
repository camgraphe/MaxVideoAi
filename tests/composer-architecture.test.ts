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
const generationQuotePath = join(root, 'frontend/components/composer/ComposerGenerationQuote.client.tsx');
const noticesPath = join(root, 'frontend/components/composer/ComposerNotices.client.tsx');
const promptHeaderPath = join(root, 'frontend/components/composer/ComposerPromptHeader.client.tsx');
const modeSwitchPath = join(root, 'frontend/components/composer/ComposerModeSwitch.client.tsx');

const composerSource = readFileSync(composerPath, 'utf8');
const composerTypesSource = readFileSync(composerTypesPath, 'utf8');
const composerCopySource = readFileSync(composerCopyPath, 'utf8');
const multiPromptEditorSource = readFileSync(multiPromptEditorPath, 'utf8');
const promotedActionIconSource = readFileSync(promotedActionIconPath, 'utf8');
const noticesSource = readFileSync(noticesPath, 'utf8');

test('composer delegates copy, contracts, modes, multi-prompt, promoted action icon, quote, and notice presentation ownership', () => {
  for (const path of [composerPath, composerTypesPath, composerCopyPath, multiPromptEditorPath, promotedActionIconPath, generationQuotePath, noticesPath, modeSwitchPath]) {
    assert.ok(existsSync(path), `${path} should exist`);
  }

  assert.match(composerSource, /useComposerVideoSourceWorkflow\(/, 'shared source eligibility and excerpt presentation state have a focused owner');
  assert.match(composerSource, /<ComposerMultiPromptEditor/, 'Composer should compose the focused multi-prompt editor');
  assert.match(composerSource, /<ComposerPromotedActionIcon/, 'Composer should compose the focused promoted action icon');
  assert.match(composerSource, /<ComposerGenerationQuote workspace=\{workspaceDensity\}/, 'workspace quote presentation belongs in the focused owner');
  assert.match(composerSource, /<ComposerNotices /, 'Composer should delegate guidance and error presentation');
  assert.match(composerSource, /<ComposerModeSwitch modes=\{visibleModeToggles\}/, 'mode presentation has a focused owner');
  assert.doesNotMatch(composerSource, /app-mode-switch|data-composer-mode/, 'mode control markup belongs in ComposerModeSwitch');
  assert.doesNotMatch(composerSource, /role="alert"/, 'notice severity belongs in ComposerNotices');
  assert.match(composerSource, /<ComposerReferenceMentionNotice\b/, 'reference review presentation belongs in the notice owner');
  assert.match(noticesSource, /export function ComposerReferenceMentionNotice\b/, 'the notice owner presents changed reference associations');
  assert.match(noticesSource, /export function ComposerSoraImageNotice\b/, 'the notice owner presents provider reference warnings for both densities');
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

test('composer delegates prompt label, count, and clear presentation to the prompt header', () => {
  assert.match(composerSource, /<ComposerPromptHeader\b/);
  assert.doesNotMatch(composerSource, /<ComposerPromptClear\b|<label htmlFor=\{promptId\}/);
  const headerSource = readFileSync(promptHeaderPath, 'utf8');
  assert.match(headerSource, /<label htmlFor=\{promptId\}/, 'single prompt retains its textarea label association');
  assert.match(headerSource, /<h2 id=\{`\$\{promptId\}-heading`\}/, 'multi-prompt retains the heading consumed by its scene editor');
  assert.match(headerSource, /<ComposerPromptClear\b/, 'header owns clear action placement');
  assert.match(composerSource, /labelledBy=\{`\$\{promptId\}-heading`\}/);
});

test('composer workspace density is opt-in and keeps price inside Generate', () => {
  assert.match(composerTypesSource, /density\?: 'default' \| 'workspace'/);
  assert.match(composerSource, /density = 'default'/);
  assert.match(composerSource, /data-composer-density=\{density\}/);
  assert.match(composerSource, /workspaceDensity[\s\S]*'p-4 md:p-5'/);
  assert.match(composerSource, /rows=\{workspaceDensity \? 3 : compactPrompt \? 2 : 6\}/);
  assert.match(composerSource, /min-h-\[96px\]/);
  assert.match(composerSource, /lg:min-w-\[176px\]/);
  assert.match(composerSource, /workspaceDensity \? 'px-3' : 'px-3\.5'/);
  assert.equal(composerSource.match(/\{formattedPrice\}/g)?.length, 1);
});
