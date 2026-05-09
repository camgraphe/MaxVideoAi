import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const facadePath = join(root, 'frontend/src/server/tools/character-builder.ts');
const builderDir = join(root, 'frontend/src/server/tools/character-builder');
const modules = [
  'error.ts',
  'prompt.ts',
  'runner.ts',
  'sanitize.ts',
  'snapshot.ts',
  'traits.ts',
  'types.ts',
  'utils.ts',
];

const facadeSource = readFileSync(facadePath, 'utf8');

function readModule(moduleName: string): string {
  return readFileSync(join(builderDir, moduleName), 'utf8');
}

test('character builder server public module stays a thin facade', () => {
  assert.ok(existsSync(facadePath), 'character-builder server facade should exist');
  assert.match(facadeSource, /from '\.\/character-builder\/error'/);
  assert.match(facadeSource, /from '\.\/character-builder\/runner'/);

  const lineCount = facadeSource.split('\n').length;
  assert.ok(lineCount <= 20, `character-builder.ts should stay a thin facade, got ${lineCount} lines`);
});

test('character builder server responsibilities live in focused modules', () => {
  for (const moduleName of modules) {
    const modulePath = join(builderDir, moduleName);
    assert.ok(existsSync(modulePath), `${moduleName} should exist under character-builder`);
    const lineCount = readModule(moduleName).split('\n').length;
    assert.ok(lineCount <= 320, `${moduleName} should stay below 320 lines, got ${lineCount}`);
  }
});

test('character builder facade does not regain prompt, sanitation, or execution ownership', () => {
  for (const pattern of [
    /function buildPrompt\(/,
    /function sanitizeRequest\(/,
    /function buildSettingsSnapshot\(/,
    /function buildTraitPrompt\(/,
    /function buildReferenceBlock\(/,
    /executeImageGeneration/,
    /randomUUID/,
    /getQualityEngineId/,
  ]) {
    assert.doesNotMatch(facadeSource, pattern);
  }
});

test('character builder focused modules expose the expected contracts', () => {
  assert.match(readModule('error.ts'), /export class CharacterBuilderError/);
  assert.match(readModule('prompt.ts'), /export function buildPrompt/);
  assert.match(readModule('sanitize.ts'), /export function sanitizeRequest/);
  assert.match(readModule('snapshot.ts'), /export function buildSettingsSnapshot/);
  assert.match(readModule('runner.ts'), /export async function runCharacterBuilder/);
  assert.match(readModule('utils.ts'), /export function buildImageUrls/);
  assert.match(readModule('traits.ts'), /export function buildAnchorParts/);
});
