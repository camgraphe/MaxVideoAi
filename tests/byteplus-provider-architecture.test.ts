import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const pollPath = 'frontend/server/byteplus-poll.ts';
const accountingPath = 'frontend/server/byteplus-accounting.ts';
const storageCopyPath = 'frontend/server/byteplus-storage-copy.ts';
const pollTypesPath = 'frontend/server/byteplus-poll-types.ts';
const providerPath = 'frontend/src/server/video-providers/byteplus-modelark.ts';
const providerConstantsPath = 'frontend/src/server/video-providers/byteplus-modelark-constants.ts';
const providerErrorPath = 'frontend/src/server/video-providers/byteplus-modelark-error.ts';
const providerPayloadPath = 'frontend/src/server/video-providers/byteplus-modelark-payload.ts';
const providerResponsePath = 'frontend/src/server/video-providers/byteplus-modelark-response.ts';

test('BytePlus poll delegates accounting, storage-copy retry, and shared types', () => {
  for (const path of [pollPath, accountingPath, storageCopyPath, pollTypesPath]) {
    assert.equal(existsSync(path), true, `${path} should exist`);
  }

  const pollSource = readFileSync(pollPath, 'utf8');
  const accountingSource = readFileSync(accountingPath, 'utf8');
  const storageCopySource = readFileSync(storageCopyPath, 'utf8');
  const pollTypesSource = readFileSync(pollTypesPath, 'utf8');

  assert.ok(pollSource.split('\n').length < 430, 'byteplus-poll.ts should stay under 430 lines');
  assert.match(pollSource, /from '\.\/byteplus-accounting'/);
  assert.match(pollSource, /from '\.\/byteplus-storage-copy'/);
  assert.match(pollSource, /from '\.\/byteplus-poll-types'/);
  assert.doesNotMatch(pollSource, /const BYTEPLUS_TOKEN_DIMENSIONS/);
  assert.doesNotMatch(pollSource, /const BYTEPLUS_STORAGE_COPY_RETRY_DELAYS_MS/);

  assert.match(accountingSource, /export function expectedBytePlusTokens/);
  assert.match(accountingSource, /export function getBytePlusAccounting/);
  assert.match(accountingSource, /export function getBytePlusUnitPriceUsdPer1kTokens/);
  assert.match(storageCopySource, /export function getBytePlusStorageCopyState/);
  assert.match(storageCopySource, /export function shouldRetryBytePlusStorageCopy/);
  assert.match(pollTypesSource, /export type BytePlusPendingJob/);
});

test('BytePlus ModelArk provider delegates payload and response normalization', () => {
  for (const path of [providerPath, providerConstantsPath, providerErrorPath, providerPayloadPath, providerResponsePath]) {
    assert.equal(existsSync(path), true, `${path} should exist`);
  }

  const providerSource = readFileSync(providerPath, 'utf8');
  const payloadSource = readFileSync(providerPayloadPath, 'utf8');
  const responseSource = readFileSync(providerResponsePath, 'utf8');

  assert.ok(providerSource.split('\n').length < 430, 'byteplus-modelark.ts should stay under 430 lines');
  assert.match(providerSource, /from '\.\/byteplus-modelark-constants'/);
  assert.match(providerSource, /from '\.\/byteplus-modelark-payload'/);
  assert.match(providerSource, /from '\.\/byteplus-modelark-response'/);
  assert.doesNotMatch(providerSource, /function extractVideoUrl/);
  assert.doesNotMatch(providerSource, /function uniqueNonEmptyUrls/);
  assert.doesNotMatch(providerSource, /export function buildBytePlusSeedancePayload/);

  assert.match(payloadSource, /export function buildBytePlusSeedancePayload/);
  assert.match(payloadSource, /export function buildBytePlusSeedanceFastPayload/);
  assert.match(responseSource, /export function normalizeBytePlusTask/);
  assert.match(responseSource, /export function scrubBytePlusError/);
  assert.match(responseSource, /export async function parseJsonResponse/);
});
