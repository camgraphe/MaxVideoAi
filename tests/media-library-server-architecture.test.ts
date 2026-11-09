import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const facadePath = join(root, 'frontend/server/media-library.ts');
const modulesDir = join(root, 'frontend/server/media-library');
const modules = [
  'asset-listing.ts',
  'asset-deletion.ts',
  'asset-media.ts',
  'asset-resolvers.ts',
  'assets.ts',
  'job-outputs.ts',
  'organization.ts',
  'organization-sources.ts',
  'organization-source-sql.ts',
  'organization-identity.ts',
  'organization-resolver.ts',
  'organization-promotion.ts',
  'organization-validation.ts',
  'collections.ts',
  'browse.ts',
  'browse-sql.ts',
  'browse-identity-sql.ts',
  'browse-validation.ts',
  'browse-projection.ts',
  'selection.ts',
  'visibility-sql.ts',
  'generated-video-candidates.ts',
  'generated-video-candidate-sql.ts',
  'asset-response.ts',
  'output-handoff.ts',
];

const facadeSource = readFileSync(facadePath, 'utf8');

function readModule(moduleName: string): string {
  return readFileSync(join(modulesDir, moduleName), 'utf8');
}

test('media library public module stays a thin facade', () => {
  assert.ok(existsSync(facadePath), 'media-library facade should exist');
  assert.match(facadeSource, /from '\.\/media-library-records'/);
  assert.match(facadeSource, /from '\.\/media-library\/job-outputs'/);
  assert.match(facadeSource, /from '\.\/media-library\/asset-deletion'/);
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
  assert.match(readModule('asset-listing.ts'), /export async function listLibraryAssetPage/);
  assert.match(readModule('asset-deletion.ts'), /export async function deleteLibraryAsset/);
  assert.match(readModule('assets.ts'), /export async function listLibraryAssets/);
  assert.match(readModule('assets.ts'), /export async function ensureReusableAsset/);
  assert.match(readModule('assets.ts'), /export async function saveJobOutputToLibrary/);
  assert.doesNotMatch(readModule('assets.ts'), /export async function deleteLibraryAsset/);
});


test('organization keeps client contracts browser-safe and reads separate from mutation initialization', () => {
  const contracts = readFileSync(join(root, 'frontend/lib/media-library-organization.ts'), 'utf8');
  assert.doesNotMatch(contracts, /from ['"].*(?:server|db|schema)/);
  for (const owner of ['organization-resolver.ts','organization-sources.ts','organization-identity.ts']) {
    assert.doesNotMatch(readModule(owner), /ensure.*Schema/);
  }
  assert.doesNotMatch(readModule('organization.ts'), /deleteLibraryAsset|DELETE FROM (?:media_assets|user_assets|job_outputs)|UPDATE (?:media_assets|job_outputs|app_jobs)/);
  assert.match(readModule('organization-promotion.ts'), /withDbTransaction/);
});


test('common browse keeps read-only SQL, bounded projection and snapshot mutation owners separate',()=>{
  for(const owner of ['browse.ts','browse-sql.ts','browse-identity-sql.ts','browse-projection.ts','visibility-sql.ts','asset-response.ts']){
    assert.doesNotMatch(readModule(owner),/ensure\w*Schema\s*\(|ensureSchema:\s*true|CREATE TABLE|INSERT INTO|UPDATE |fetch\(/);
  }
  assert.doesNotMatch(readModule('asset-response.ts'),/\bquery\(|from ['"].*(?:db|schema)/);
  assert.match(readModule('selection.ts'),/resolveOrganizationBatch/);
  const hook=readFileSync(join(root,'frontend/hooks/useLibraryBrowse.ts'),'utf8');
  assert.match(hook,/useSWRInfinite/);assert.match(hook,/buildLibraryBrowseKey/);
  assert.doesNotMatch(hook,/from ['"].*(?:server|schema)/);
});

test('exact read renewal is source-owned and never runs organization proof, schema writes or client URL signing', () => {
  const exact = readModule('exact-read-access.ts');
  assert.match(exact, /assetProjection/);
  assert.match(exact, /unavailableOrganizationSourceUrls/);
  assert.match(exact, /libraryReadRevision/);
  assert.doesNotMatch(exact, /ensure\w*Schema|resolveOrganization|readOrganizationStates|readOrganizationSourceBatch|library_organization/);
  const route = readFileSync(join(root, 'frontend/app/api/media-library/read-access/route.ts'), 'utf8');
  assert.match(route, /onlyFields\(body, \['reference', 'revision'\]\)/);
  assert.match(route, /getRouteAuthContext/);
  assert.doesNotMatch(route, /createSignedDownloadUrl|fetch\(|ensure\w*Schema/);
});
