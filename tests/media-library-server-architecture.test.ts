import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const facadePath = join(root, 'frontend/server/media-library.ts');
const modulesDir = join(root, 'frontend/server/media-library');
const modules = [
  'asset-media.ts',
  'asset-resolvers.ts',
  'assets.ts',
  'job-outputs.ts',
];

const facadeSource = readFileSync(facadePath, 'utf8');

function readModule(moduleName: string): string {
  return readFileSync(join(modulesDir, moduleName), 'utf8');
}

test('media library public module stays a thin facade', () => {
  assert.ok(existsSync(facadePath), 'media-library facade should exist');
  assert.match(facadeSource, /from '\.\/media-library-records'/);
  assert.match(facadeSource, /from '\.\/media-library\/job-outputs'/);
  assert.match(facadeSource, /from '\.\/media-library\/assets'/);
  assert.match(facadeSource, /export type \{/);

  const lineCount = facadeSource.split('\n').length;
  assert.ok(lineCount <= 80, `media-library.ts should stay below 80 lines, got ${lineCount}`);
});

test('media library server responsibilities live in focused modules', () => {
  for (const moduleName of modules) {
    const modulePath = join(modulesDir, moduleName);
    assert.ok(existsSync(modulePath), `${moduleName} should exist under server/media-library`);
    const lineCount = readModule(moduleName).split('\n').length;
    assert.ok(lineCount <= 420, `${moduleName} should stay below 420 lines, got ${lineCount}`);
  }
});

test('media library facade does not regain SQL, storage, or resolver ownership', () => {
  for (const pattern of [
    /function listLibraryAssets\(/,
    /function ensureReusableAsset\(/,
    /function copyRemoteMedia\(/,
    /function createRemoteVideoAssetThumbnail\(/,
    /function resolveReusableAssetThumbUrl\(/,
    /function resolveReusableAssetPreviewUrl\(/,
    /INSERT INTO job_outputs/,
    /recordUserAsset/,
    /createUploadVideoThumbnail/,
  ]) {
    assert.doesNotMatch(facadeSource, pattern);
  }
});

test('media library focused modules expose the expected contracts', () => {
  assert.match(readModule('job-outputs.ts'), /export async function upsertJobOutputs/);
  assert.match(readModule('job-outputs.ts'), /export function applyOutputsToJobPayload/);
  assert.match(readModule('job-outputs.ts'), /export async function listRecentOutputs/);
  assert.match(readModule('asset-media.ts'), /export async function copyRemoteMedia/);
  assert.match(readModule('asset-media.ts'), /export async function createRemoteVideoAssetThumbnail/);
  assert.match(readModule('asset-resolvers.ts'), /export async function resolveReusableAssetThumbUrl/);
  assert.match(readModule('asset-resolvers.ts'), /export async function resolveReusableAssetPreviewUrl/);
  assert.match(readModule('assets.ts'), /export async function listLibraryAssets/);
  assert.match(readModule('assets.ts'), /export async function ensureReusableAsset/);
  assert.match(readModule('assets.ts'), /export async function saveJobOutputToLibrary/);
  assert.match(readModule('assets.ts'), /export async function deleteLibraryAsset/);
});
