import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const tablePath = join(root, 'frontend/components/admin/ModerationTable.tsx');
const utilsPath = join(root, 'frontend/components/admin/moderation/moderation-table-utils.tsx');
const typesPath = join(root, 'frontend/components/admin/moderation/moderation-types.ts');
const headerPath = join(root, 'frontend/components/admin/moderation/ModerationTableHeader.tsx');
const wallViewPath = join(root, 'frontend/components/admin/moderation/ModerationWallView.tsx');
const tableViewPath = join(root, 'frontend/components/admin/moderation/ModerationTableView.tsx');
const playlistControlsPath = join(root, 'frontend/components/admin/moderation/ModerationPlaylistControls.tsx');
const playlistHookPath = join(root, 'frontend/components/admin/moderation/useModerationPlaylists.tsx');

const tableSource = readFileSync(tablePath, 'utf8');
const utilsSource = readFileSync(utilsPath, 'utf8');
const typesSource = readFileSync(typesPath, 'utf8');
const headerSource = readFileSync(headerPath, 'utf8');
const wallViewSource = readFileSync(wallViewPath, 'utf8');
const tableViewSource = readFileSync(tableViewPath, 'utf8');
const playlistControlsSource = readFileSync(playlistControlsPath, 'utf8');
const playlistHookSource = readFileSync(playlistHookPath, 'utf8');

test('moderation table delegates helper pills, playlist controls, and playlist state', () => {
  assert.ok(existsSync(tablePath), 'moderation table should exist');
  assert.ok(existsSync(utilsPath), 'moderation helper/pill module should exist');
  assert.ok(existsSync(typesPath), 'moderation contracts should live in a type module');
  assert.ok(existsSync(headerPath), 'moderation header should live in a focused component');
  assert.ok(existsSync(wallViewPath), 'moderation wall view should live in a focused component');
  assert.ok(existsSync(tableViewPath), 'moderation table view should live in a focused component');
  assert.ok(existsSync(playlistControlsPath), 'moderation playlist controls should exist');
  assert.ok(existsSync(playlistHookPath), 'moderation playlist state should live in a focused hook');
  assert.match(tableSource, /from '@\/components\/admin\/moderation\/moderation-table-utils'/);
  assert.match(tableSource, /from '@\/components\/admin\/moderation\/moderation-types'/);
  assert.match(tableSource, /from '@\/components\/admin\/moderation\/ModerationTableHeader'/);
  assert.match(tableSource, /from '@\/components\/admin\/moderation\/ModerationWallView'/);
  assert.match(tableSource, /from '@\/components\/admin\/moderation\/ModerationTableView'/);
  assert.match(tableSource, /from '@\/components\/admin\/moderation\/useModerationPlaylists'/);
  assert.doesNotMatch(tableSource, /from '@\/components\/admin\/moderation\/ModerationPlaylistControls'/);
});

test('moderation table does not regain extracted ownership', () => {
  for (const pattern of [
    /const FAILURE_STATES =/,
    /const BUCKET_OPTIONS:/,
    /const SURFACE_OPTIONS:/,
    /function compareChronologically\(/,
    /function formatDate\(/,
    /function isFailedVideo\(/,
    /function resolvePublicationState\(/,
    /function getPublicationLabel\(/,
    /function matchesBucket\(/,
    /function PublicationPill\(/,
    /function StatePill\(/,
    /export type ModerationVideo =/,
    /const \[playlists, setPlaylists\]/,
    /const \[playlistAssignments, setPlaylistAssignments\]/,
    /handleAssignToPlaylist/,
    /handleRemoveFromPlaylist/,
    /VideoThumbnailEditor/,
    /<table className="min-w-full/,
    /<select[\s\S]*Select playlist/,
  ]) {
    assert.doesNotMatch(tableSource, pattern);
  }

  const lineCount = tableSource.split('\n').length;
  assert.ok(lineCount <= 320, `ModerationTable should stay below 320 lines after view extraction, got ${lineCount}`);
});

test('moderation helper modules expose the expected contract', () => {
  for (const typeName of ['PlaylistOption', 'PlaylistTag', 'PublicationState', 'ModerationBucket', 'ModerationSurface', 'ModerationViewMode', 'ModerationVideo']) {
    assert.match(typesSource, new RegExp(`export type ${typeName}\\b`), `${typeName} should be exported`);
  }

  for (const exportName of [
    'BUCKET_OPTIONS',
    'SURFACE_OPTIONS',
    'compareChronologically',
    'formatDate',
    'isFailedVideo',
    'resolvePublicationState',
    'getPublicationLabel',
    'matchesBucket',
    'PublicationPill',
    'StatePill',
  ]) {
    assert.match(utilsSource, new RegExp(`export (const |function )${exportName}`));
  }

  assert.match(headerSource, /export function ModerationTableHeader/);
  assert.match(headerSource, /SURFACE_OPTIONS/);
  assert.match(headerSource, /BUCKET_OPTIONS/);
  assert.match(wallViewSource, /export function ModerationWallView/);
  assert.match(wallViewSource, /VideoThumbnailEditor/);
  assert.match(wallViewSource, /SelectedModerationItem/);
  assert.match(tableViewSource, /export function ModerationTableView/);
  assert.match(tableViewSource, /<table className="min-w-full/);
  assert.match(playlistControlsSource, /export function ModerationPlaylistControls/);
  assert.match(playlistControlsSource, /Select playlist/);
  assert.match(playlistControlsSource, /onAssign/);
  assert.match(playlistControlsSource, /onRemove/);
  assert.match(playlistHookSource, /export function useModerationPlaylists/);
  assert.match(playlistHookSource, /appendPlaylistAssignments/);
  assert.match(playlistHookSource, /replacePlaylistAssignments/);
  assert.match(playlistHookSource, /renderPlaylistControls/);
});
