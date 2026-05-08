import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const tablePath = join(root, 'frontend/components/admin/ModerationTable.tsx');
const utilsPath = join(root, 'frontend/components/admin/moderation/moderation-table-utils.tsx');
const playlistControlsPath = join(root, 'frontend/components/admin/moderation/ModerationPlaylistControls.tsx');
const playlistHookPath = join(root, 'frontend/components/admin/moderation/useModerationPlaylists.tsx');

const tableSource = readFileSync(tablePath, 'utf8');
const utilsSource = readFileSync(utilsPath, 'utf8');
const playlistControlsSource = readFileSync(playlistControlsPath, 'utf8');
const playlistHookSource = readFileSync(playlistHookPath, 'utf8');

test('moderation table delegates helper pills, playlist controls, and playlist state', () => {
  assert.ok(existsSync(tablePath), 'moderation table should exist');
  assert.ok(existsSync(utilsPath), 'moderation helper/pill module should exist');
  assert.ok(existsSync(playlistControlsPath), 'moderation playlist controls should exist');
  assert.ok(existsSync(playlistHookPath), 'moderation playlist state should live in a focused hook');
  assert.match(tableSource, /from '@\/components\/admin\/moderation\/moderation-table-utils'/);
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
    /const \[playlists, setPlaylists\]/,
    /const \[playlistAssignments, setPlaylistAssignments\]/,
    /handleAssignToPlaylist/,
    /handleRemoveFromPlaylist/,
    /<select[\s\S]*Select playlist/,
  ]) {
    assert.doesNotMatch(tableSource, pattern);
  }

  const lineCount = tableSource.split('\n').length;
  assert.ok(lineCount <= 790, `ModerationTable should stay below 790 lines after playlist hook extraction, got ${lineCount}`);
});

test('moderation helper modules expose the expected contract', () => {
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

  assert.match(playlistControlsSource, /export function ModerationPlaylistControls/);
  assert.match(playlistControlsSource, /Select playlist/);
  assert.match(playlistControlsSource, /onAssign/);
  assert.match(playlistControlsSource, /onRemove/);
  assert.match(playlistHookSource, /export function useModerationPlaylists/);
  assert.match(playlistHookSource, /appendPlaylistAssignments/);
  assert.match(playlistHookSource, /replacePlaylistAssignments/);
  assert.match(playlistHookSource, /renderPlaylistControls/);
});
