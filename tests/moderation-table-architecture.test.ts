import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const tablePath = join(root, 'frontend/components/admin/ModerationTable.tsx');
const utilsPath = join(root, 'frontend/components/admin/moderation/moderation-table-utils.tsx');
const playlistControlsPath = join(root, 'frontend/components/admin/moderation/ModerationPlaylistControls.tsx');

const tableSource = readFileSync(tablePath, 'utf8');
const utilsSource = readFileSync(utilsPath, 'utf8');
const playlistControlsSource = readFileSync(playlistControlsPath, 'utf8');

test('moderation table delegates helper pills and playlist controls', () => {
  assert.ok(existsSync(tablePath), 'moderation table should exist');
  assert.ok(existsSync(utilsPath), 'moderation helper/pill module should exist');
  assert.ok(existsSync(playlistControlsPath), 'moderation playlist controls should exist');
  assert.match(tableSource, /from '@\/components\/admin\/moderation\/moderation-table-utils'/);
  assert.match(tableSource, /from '@\/components\/admin\/moderation\/ModerationPlaylistControls'/);
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
    /<select[\s\S]*Select playlist/,
  ]) {
    assert.doesNotMatch(tableSource, pattern);
  }

  const lineCount = tableSource.split('\n').length;
  assert.ok(lineCount <= 985, `ModerationTable should stay below 985 lines after helper extraction, got ${lineCount}`);
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
});
