import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const apiPath = join(root, 'frontend/lib/api.ts');
const generationApiPath = join(root, 'frontend/lib/api-generation.ts');

const apiSource = readFileSync(apiPath, 'utf8');
const generationApiSource = readFileSync(generationApiPath, 'utf8');

test('frontend api delegates generation and tool submissions to a focused module', () => {
  assert.ok(existsSync(generationApiPath), 'generation API helpers should live in frontend/lib/api-generation.ts');
  assert.match(apiSource, /from '@\/lib\/api-generation'/);
  assert.match(generationApiSource, /export async function runPreflight/);
  assert.match(generationApiSource, /export async function runGenerate/);
  assert.match(generationApiSource, /export async function runImageGeneration/);
  assert.match(generationApiSource, /export async function runAudioGenerate/);
  assert.match(generationApiSource, /export async function runCharacterBuilderTool/);
  assert.match(generationApiSource, /export async function runAngleTool/);
  assert.match(generationApiSource, /export async function runUpscaleTool/);
});

test('frontend api file does not regain generation helper ownership', () => {
  assert.doesNotMatch(apiSource, /type GeneratePayload =/, 'generation payload shape belongs in api-generation.ts');
  assert.doesNotMatch(apiSource, /function toPrimitive\(/, 'generation error primitive mapping belongs in api-generation.ts');
  assert.doesNotMatch(apiSource, /function toPrimitiveArray\(/, 'generation error allowed-value mapping belongs in api-generation.ts');
  assert.doesNotMatch(apiSource, /export async function runPreflight\(/, 'preflight submission belongs in api-generation.ts');
  assert.doesNotMatch(apiSource, /export async function runGenerate\(/, 'video generation submission belongs in api-generation.ts');
  assert.doesNotMatch(apiSource, /export async function runImageGeneration\(/, 'image generation submission belongs in api-generation.ts');
  assert.doesNotMatch(apiSource, /export async function runAudioGenerate\(/, 'audio generation submission belongs in api-generation.ts');
  assert.doesNotMatch(apiSource, /export async function runCharacterBuilderTool\(/, 'character builder submission belongs in api-generation.ts');
  assert.doesNotMatch(apiSource, /export async function runAngleTool\(/, 'angle tool submission belongs in api-generation.ts');
  assert.doesNotMatch(apiSource, /export async function runUpscaleTool\(/, 'upscale tool submission belongs in api-generation.ts');

  const lineCount = apiSource.split('\n').length;
  assert.ok(lineCount <= 720, `api.ts should stay below 720 lines after generation helper extraction, got ${lineCount}`);
});
