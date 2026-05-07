import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const managerPath = join(root, 'frontend/components/admin/PlaylistsManager.tsx');
const playlistsDir = join(root, 'frontend/components/admin/playlists');
const typesPath = join(playlistsDir, 'playlist-types.ts');
const helpersPath = join(playlistsDir, 'playlist-helpers.ts');
const statusPillPath = join(playlistsDir, 'PlaylistStatusPill.tsx');
const railCardPath = join(playlistsDir, 'PlaylistRailCard.tsx');
const missingFamilyCardPath = join(playlistsDir, 'MissingFamilyCard.tsx');

const managerSource = readFileSync(managerPath, 'utf8');
const helpersSource = readFileSync(helpersPath, 'utf8');
const typesSource = readFileSync(typesPath, 'utf8');

test('admin playlists manager delegates contracts, helper logic, and card UI', () => {
  for (const file of [typesPath, helpersPath, statusPillPath, railCardPath, missingFamilyCardPath]) {
    assert.ok(existsSync(file), `${file} should exist`);
  }

  assert.match(managerSource, /from '@\/components\/admin\/playlists\/playlist-types'/);
  assert.match(managerSource, /from '@\/components\/admin\/playlists\/playlist-helpers'/);
  assert.match(managerSource, /from '@\/components\/admin\/playlists\/PlaylistStatusPill'/);
  assert.match(managerSource, /from '@\/components\/admin\/playlists\/PlaylistRailCard'/);
  assert.match(managerSource, /from '@\/components\/admin\/playlists\/MissingFamilyCard'/);
});

test('admin playlists manager does not regain extracted ownership', () => {
  assert.doesNotMatch(managerSource, /type PlaylistSummary =/, 'playlist contracts belong in playlist-types.ts');
  assert.doesNotMatch(managerSource, /function buildFamilyHelpers\(/, 'family helper derivation belongs in playlist-helpers.ts');
  assert.doesNotMatch(managerSource, /getExampleFamilyIds/, 'model family catalog access belongs in playlist-helpers.ts');
  assert.doesNotMatch(managerSource, /function PlaylistRailCard\(/, 'rail card UI belongs in PlaylistRailCard.tsx');
  assert.doesNotMatch(managerSource, /function MissingFamilyCard\(/, 'missing family helper UI belongs in MissingFamilyCard.tsx');

  const lineCount = managerSource.split('\n').length;
  assert.ok(lineCount <= 1100, `PlaylistsManager should stay below 1100 lines after playlist module extraction, got ${lineCount}`);
});

test('admin playlist helper modules expose the expected contract', () => {
  for (const typeName of ['PlaylistSummary', 'PlaylistItemRecord', 'PlaylistsManagerProps', 'EditablePlaylist', 'FamilyPlaylistHelperCard']) {
    assert.match(typesSource, new RegExp(`export type ${typeName}\\b`), `${typeName} should be exported`);
  }

  for (const exportName of [
    'GROUP_LABELS',
    'getPlaceholderThumb',
    'formatDate',
    'slugify',
    'sortPlaylists',
    'getUsageLabel',
    'buildPlaylistUpdateFromItems',
    'getPlaylistGroup',
    'buildFamilyHelpers',
    'sortItemsForDisplay',
    'getSurfaceRoleLabel',
    'getSurfaceRoleTone',
    'getSurfaceStatusLabel',
    'getSurfaceStatusTone',
    'buildHelperFallbackLabel',
  ]) {
    assert.match(helpersSource, new RegExp(`export (const|function) ${exportName}\\b`), `${exportName} should be exported`);
  }
});
