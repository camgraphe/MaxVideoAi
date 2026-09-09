import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const runnerPath = join(root, 'frontend/src/server/audio/generate-audio.ts');
const validationPath = join(root, 'frontend/src/server/audio/audio-generate-validation.ts');
const jobsPath = join(root, 'frontend/src/server/audio/audio-generate-jobs.ts');
const receiptsPath = join(root, 'frontend/src/server/audio/audio-generate-receipts.ts');
const snapshotsPath = join(root, 'frontend/src/server/audio/audio-generate-snapshots.ts');

const runnerSource = readFileSync(runnerPath, 'utf8');
const validationSource = readFileSync(validationPath, 'utf8');
const jobsSource = readFileSync(jobsPath, 'utf8');
const receiptsSource = readFileSync(receiptsPath, 'utf8');
const snapshotsSource = readFileSync(snapshotsPath, 'utf8');

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
  assert.ok(lineCount <= 460, `generate-audio.ts should stay below 460 lines after server helper extraction, got ${lineCount}`);
});

test('audio generation runner delegates job persistence, receipts, and snapshots', () => {
  for (const [path, label] of [
    [jobsPath, 'audio job helper'],
    [receiptsPath, 'audio receipt helper'],
    [snapshotsPath, 'audio snapshot helper'],
  ] as const) {
    assert.ok(existsSync(path), `${label} should live in a focused server module`);
  }

  assert.match(runnerSource, /from '@\/server\/audio\/audio-generate-jobs'/);
  assert.match(runnerSource, /from '@\/server\/audio\/audio-generate-receipts'/);
  assert.match(runnerSource, /from '@\/server\/audio\/audio-generate-snapshots'/);

  for (const implementationPattern of [
    /reserveWalletChargeInExecutor/,
    /withDbTransaction/,
    /async function loadSourceJob/,
    /async function updateAudioJob/,
    /async function refundAudioCharge/,
    /function buildPromptSummary/,
    /function buildProviderSnapshot/,
    /function parseProviderFailures/,
  ]) {
    assert.doesNotMatch(runnerSource, implementationPattern, 'generate-audio.ts should stay focused on run orchestration');
  }

  assert.match(jobsSource, /export const PLACEHOLDER_THUMB/, 'audio job helper should own placeholder metadata');
  assert.match(jobsSource, /export type SourceJobRow/, 'audio job helper should expose the source job row contract');
  assert.match(jobsSource, /export async function loadSourceJob/, 'audio job helper should own source job loading');
  assert.match(jobsSource, /export async function updateAudioJob/, 'audio job helper should own job patch persistence');
  assert.match(jobsSource, /export function completeAudioJob/, 'audio job helper should own conditional completion');
  assert.match(jobsSource, /export function failAudioJob/, 'audio job helper should own conditional failure');
  assert.match(jobsSource, /export async function createInitialAudioJob/, 'audio job helper should own initial job persistence');
  assert.match(jobsSource, /reserveWalletChargeInExecutor/, 'audio job helper should own wallet reservation');
  assert.match(jobsSource, /withDbTransaction/, 'audio job helper should own the initial job transaction boundary');
  assert.match(receiptsSource, /export async function refundAudioCharge/, 'audio receipt helper should own refund receipts');
  assert.match(snapshotsSource, /export function buildPromptSummary/, 'audio snapshot helper should own prompt summaries');
  assert.match(snapshotsSource, /export function buildProviderSnapshot/, 'audio snapshot helper should own provider snapshots');
  assert.match(snapshotsSource, /export function parseProviderFailures/, 'audio snapshot helper should own provider failure extraction');
  assert.match(snapshotsSource, /export function isVideoBackedPack/, 'audio snapshot helper should own pack media classification');
});

test('Audio reservations can compose with MCP quote claims without duplicating the provider runner', () => {
  const reservation = readFileSync(join(root, 'frontend/src/server/audio/audio-run-reservation.ts'), 'utf8');
  assert.match(jobsSource, /createInitialAudioJobInExecutor\(executor: TransactionQueryExecutor/);
  assert.match(runnerSource, /buildAudioRunReservation\(prepared, params.userId\)/);
  assert.match(runnerSource, /await createInitialAudioJob\(reservation.initialJob\)/);
  assert.match(runnerSource, /return executeReservedAudioRun\(reservation.execution\)/);
  const executorSource = runnerSource.slice(runnerSource.indexOf('export async function executeReservedAudioRun'));
  assert.doesNotMatch(executorSource, /createInitialAudioJob|reserveWalletCharge/);
  assert.match(reservation, /buildInitialAudioSettingsSnapshot/);
  assert.doesNotMatch(reservation, /generateSongTrack|generateMusicTrack|fetch\(/);
  assert.match(executorSource, /const completionWon = await completeAudioJob/);
  assert.ok(executorSource.indexOf('if (!completionWon)') < executorSource.indexOf('await upsertLegacyJobOutputs'));
  assert.match(executorSource, /const failureWon = await failAudioJob/);
  assert.ok(executorSource.indexOf('if (!failureWon)') < executorSource.indexOf('await refundAudioCharge'));
});
