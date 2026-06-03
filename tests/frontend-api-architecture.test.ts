import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const apiPath = join(root, 'frontend/lib/api.ts');
const generationApiPath = join(root, 'frontend/lib/api-generation.ts');
const assetsApiPath = join(root, 'frontend/lib/api-assets.ts');
const enginesApiPath = join(root, 'frontend/lib/api-engines.ts');
const jobStatusApiPath = join(root, 'frontend/lib/api-job-status.ts');
const jobsApiPath = join(root, 'frontend/lib/api-jobs.ts');

const apiSource = readFileSync(apiPath, 'utf8');
const generationApiSource = readFileSync(generationApiPath, 'utf8');
const assetsApiSource = readFileSync(assetsApiPath, 'utf8');
const enginesApiSource = readFileSync(enginesApiPath, 'utf8');
const jobStatusApiSource = readFileSync(jobStatusApiPath, 'utf8');
const jobsApiSource = readFileSync(jobsApiPath, 'utf8');

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
  assert.ok(lineCount <= 40, `api.ts should stay a thin facade after helper extraction, got ${lineCount}`);
});

test('frontend api facade delegates engines, jobs, and media-library helpers', () => {
  for (const [path, label] of [
    [assetsApiPath, 'asset API helpers'],
    [enginesApiPath, 'engine API hooks'],
    [jobStatusApiPath, 'job status API helpers'],
    [jobsApiPath, 'job API hooks'],
  ] as const) {
    assert.ok(existsSync(path), `${label} should live in a focused frontend API module`);
  }

  assert.match(apiSource, /from '@\/lib\/api-assets'/);
  assert.match(apiSource, /from '@\/lib\/api-engines'/);
  assert.match(apiSource, /from '@\/lib\/api-job-status'/);
  assert.match(apiSource, /from '@\/lib\/api-jobs'/);

  for (const implementationPattern of [
    /useSWRInfinite/,
    /readBrowserSession/,
    /STATUS_RETRY_TIMERS/,
    /export function useEngines/,
    /export function useInfiniteJobs/,
    /export async function getJobStatus/,
    /export async function saveAssetToLibrary/,
    /export async function hideJob/,
  ]) {
    assert.doesNotMatch(apiSource, implementationPattern, 'frontend/lib/api.ts should stay a facade');
  }

  assert.match(assetsApiSource, /export async function saveAssetToLibrary/);
  assert.match(assetsApiSource, /export async function saveImageToLibrary/);
  assert.match(assetsApiSource, /kind\?:\s*'image'\s*\|\s*'video'\s*\|\s*'audio'/);
  assert.match(assetsApiSource, /thumbUrl:\s*payload\.thumbUrl/);
  assert.match(assetsApiSource, /previewUrl:\s*payload\.previewUrl/);
  assert.match(enginesApiSource, /export function useEngines/);
  assert.match(enginesApiSource, /loadFallbackEngines/);
  assert.match(jobsApiSource, /export function useInfiniteJobs/);
  assert.match(jobsApiSource, /options\?\.surface === 'storyboard'/);
  assert.match(jobsApiSource, /export async function hideJob/);
  assert.doesNotMatch(jobsApiSource, /STATUS_RETRY_TIMERS/, 'status retry timers belong in api-job-status.ts');
  assert.match(jobStatusApiSource, /export async function getJobStatus/);
  assert.match(jobStatusApiSource, /STATUS_RETRY_TIMERS/);
});
