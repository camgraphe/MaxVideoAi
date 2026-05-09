import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const facadePath = join(root, 'frontend/server/playlists.ts');
const modulesDir = join(root, 'frontend/server/playlists');
const modules = [
  'candidates.ts',
  'mappers.ts',
  'mutations.ts',
  'queries.ts',
  'runtime-meta.ts',
  'slugs.ts',
  'types.ts',
];

const facadeSource = readFileSync(facadePath, 'utf8');

function readModule(moduleName: string): string {
  return readFileSync(join(modulesDir, moduleName), 'utf8');
}

test('server playlists public module stays a thin facade', () => {
  assert.ok(existsSync(facadePath), 'playlists server facade should exist');
  assert.match(facadeSource, /from '\.\/playlists\/slugs'/);
  assert.match(facadeSource, /from '\.\/playlists\/queries'/);
  assert.match(facadeSource, /from '\.\/playlists\/mutations'/);
  assert.match(facadeSource, /from '\.\/playlists\/candidates'/);
  assert.match(facadeSource, /from '\.\/playlists\/types'/);

  const lineCount = facadeSource.split('\n').length;
  assert.ok(lineCount <= 60, `playlists.ts should stay a thin facade, got ${lineCount} lines`);
});

test('server playlist responsibilities live in focused modules', () => {
  for (const moduleName of modules) {
    const modulePath = join(modulesDir, moduleName);
    assert.ok(existsSync(modulePath), `${moduleName} should exist under server/playlists`);
    const lineCount = readModule(moduleName).split('\n').length;
    assert.ok(lineCount <= 230, `${moduleName} should stay below 230 lines, got ${lineCount}`);
  }
});

test('server playlists facade does not regain query, runtime, or mapper ownership', () => {
  for (const pattern of [
    /type PlaylistSummaryRow/,
    /class LockedPlaylistError/,
    /function derivePlaylistRuntimeMeta\(/,
    /function getPlaylistUsageTargets\(/,
    /function mapPlaylistRow\(/,
    /function appendPlaylistItemWithExecutor\(/,
    /SELECT\s+job_id/,
    /normalizeMediaUrl/,
    /getIndexablePlaylistSlugs/,
  ]) {
    assert.doesNotMatch(facadeSource, pattern);
  }
});

test('server playlist focused modules expose the expected contracts', () => {
  assert.match(readModule('types.ts'), /export type PlaylistRecord/);
  assert.match(readModule('slugs.ts'), /export function getStarterPlaylistSlug/);
  assert.match(readModule('slugs.ts'), /export function getFamilyFeedSourceSlugs/);
  assert.match(readModule('runtime-meta.ts'), /export function derivePlaylistRuntimeMeta/);
  assert.match(readModule('runtime-meta.ts'), /export function isLockedPlaylistSlug/);
  assert.match(readModule('runtime-meta.ts'), /export function comparePlaylists/);
  assert.match(readModule('mappers.ts'), /export function mapPlaylistRow/);
  assert.match(readModule('mappers.ts'), /export function mapPlaylistItemRow/);
  assert.match(readModule('mappers.ts'), /export function mapPlaylistCandidateRow/);
  assert.match(readModule('queries.ts'), /export async function listPlaylists/);
  assert.match(readModule('queries.ts'), /export async function getPlaylistItems/);
  assert.match(readModule('mutations.ts'), /export class LockedPlaylistError/);
  assert.match(readModule('mutations.ts'), /export async function createPlaylist/);
  assert.match(readModule('mutations.ts'), /export async function reorderPlaylistItems/);
  assert.match(readModule('mutations.ts'), /export function isPlaylistLockedError/);
  assert.match(readModule('candidates.ts'), /export async function searchPlaylistCandidates/);
});
