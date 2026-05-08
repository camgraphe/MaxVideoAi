import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const runnerPath = join(root, 'frontend/src/server/audio/generate-audio.ts');
const validationPath = join(root, 'frontend/src/server/audio/audio-generate-validation.ts');

const runnerSource = readFileSync(runnerPath, 'utf8');
const validationSource = readFileSync(validationPath, 'utf8');

test('audio generation runner delegates request validation and duration rules', () => {
  assert.ok(existsSync(validationPath), 'audio validation should live in a focused server module');
  assert.match(runnerSource, /from '@\/server\/audio\/audio-generate-validation'/);
  assert.match(validationSource, /export class AudioGenerationError/);
  assert.match(validationSource, /export type ValidatedAudioGenerateRequest/);
  assert.match(validationSource, /export function validateAudioGenerateRequest/);
  assert.match(validationSource, /export function resolveAudioRenderDuration/);
});

test('audio generation runner does not regain validation ownership', () => {
  assert.doesNotMatch(runnerSource, /function normalizeString\(/, 'input string normalization belongs in audio-generate-validation.ts');
  assert.doesNotMatch(runnerSource, /function normalizeOptionalInteger\(/, 'numeric input normalization belongs in audio-generate-validation.ts');
  assert.doesNotMatch(runnerSource, /function normalizeOptionalBoolean\(/, 'boolean input normalization belongs in audio-generate-validation.ts');
  assert.doesNotMatch(runnerSource, /function validateTextLength\(/, 'text length validation belongs in audio-generate-validation.ts');
  assert.doesNotMatch(runnerSource, /function validateAudioDurationInRange\(/, 'duration validation belongs in audio-generate-validation.ts');
  assert.doesNotMatch(runnerSource, /export class AudioGenerationError/, 'audio error contract belongs in audio-generate-validation.ts');
  assert.doesNotMatch(runnerSource, /export function validateAudioGenerateRequest\(/, 'request validation belongs in audio-generate-validation.ts');
  assert.doesNotMatch(runnerSource, /export function resolveAudioRenderDuration\(/, 'duration resolution belongs in audio-generate-validation.ts');

  const lineCount = runnerSource.split('\n').length;
  assert.ok(lineCount <= 670, `generate-audio.ts should stay below 670 lines after validation extraction, got ${lineCount}`);
});
