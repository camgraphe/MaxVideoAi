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
const sidebarPath = join(playlistsDir, 'PlaylistsSidebar.tsx');
const createFormPath = join(playlistsDir, 'PlaylistCreateForm.tsx');
const detailsPanelPath = join(playlistsDir, 'PlaylistDetailsPanel.tsx');
const feedbackBannersPath = join(playlistsDir, 'PlaylistFeedbackBanners.tsx');
const itemsSectionPath = join(playlistsDir, 'PlaylistItemsSection.tsx');
const toolbarPath = join(playlistsDir, 'PlaylistsManagerToolbar.tsx');
const selectionPanelPath = join(playlistsDir, 'PlaylistsManagerSelectionPanel.tsx');
const dragHookPath = join(playlistsDir, 'usePlaylistDragReorder.ts');

const managerSource = readFileSync(managerPath, 'utf8');
const helpersSource = readFileSync(helpersPath, 'utf8');
const typesSource = readFileSync(typesPath, 'utf8');

test('admin playlists manager delegates contracts, helper logic, and card UI', () => {
  for (const file of [
    typesPath,
    helpersPath,
    statusPillPath,
    railCardPath,
    missingFamilyCardPath,
    sidebarPath,
    createFormPath,
    detailsPanelPath,
    feedbackBannersPath,
    itemsSectionPath,
    toolbarPath,
    selectionPanelPath,
    dragHookPath,
  ]) {
    assert.ok(existsSync(file), `${file} should exist`);
  }

  assert.match(managerSource, /from '@\/components\/admin\/playlists\/playlist-types'/);
  assert.match(managerSource, /from '@\/components\/admin\/playlists\/playlist-helpers'/);
  assert.match(managerSource, /from '@\/components\/admin\/playlists\/PlaylistsSidebar'/);
  assert.match(managerSource, /from '@\/components\/admin\/playlists\/PlaylistFeedbackBanners'/);
  assert.match(managerSource, /from '@\/components\/admin\/playlists\/PlaylistItemsSection'/);
  assert.match(managerSource, /from '@\/components\/admin\/playlists\/PlaylistsManagerToolbar'/);
  assert.match(managerSource, /from '@\/components\/admin\/playlists\/PlaylistsManagerSelectionPanel'/);
  assert.match(managerSource, /from '@\/components\/admin\/playlists\/usePlaylistDragReorder'/);
});

test('admin playlists manager does not regain extracted ownership', () => {
  assert.doesNotMatch(managerSource, /type PlaylistSummary =/, 'playlist contracts belong in playlist-types.ts');
  assert.doesNotMatch(managerSource, /function buildFamilyHelpers\(/, 'family helper derivation belongs in playlist-helpers.ts');
  assert.doesNotMatch(managerSource, /getExampleFamilyIds/, 'model family catalog access belongs in playlist-helpers.ts');
  assert.doesNotMatch(managerSource, /function PlaylistRailCard\(/, 'rail card UI belongs in PlaylistRailCard.tsx');
  assert.doesNotMatch(managerSource, /function MissingFamilyCard\(/, 'missing family helper UI belongs in MissingFamilyCard.tsx');
  assert.doesNotMatch(managerSource, /GROUP_LABELS\.runtime/, 'playlist rail grouping belongs in PlaylistsSidebar.tsx');
  assert.doesNotMatch(managerSource, /showModelCollections \? \(/, 'model rail disclosure belongs in PlaylistsSidebar.tsx');
  assert.doesNotMatch(managerSource, /placeholder="Homepage holiday edits"/, 'new collection form UI belongs in PlaylistCreateForm.tsx');
  assert.doesNotMatch(managerSource, /Fallback model playlists/, 'collection details UI belongs in PlaylistDetailsPanel.tsx');
  assert.doesNotMatch(managerSource, /getSurfaceRoleLabel/, 'surface labels belong in PlaylistDetailsPanel.tsx');
  assert.doesNotMatch(managerSource, /dragGhostRef/, 'drag/drop DOM state belongs in usePlaylistDragReorder.ts');
  assert.doesNotMatch(managerSource, /getPlaceholderThumb/, 'playlist item cards belong in PlaylistItemsSection.tsx');

  const lineCount = managerSource.split('\n').length;
  assert.ok(lineCount <= 500, `PlaylistsManager should stay below 500 lines after surface extraction, got ${lineCount}`);
});

test('admin playlist helper modules expose the expected contract', () => {
  const sidebarSource = readFileSync(sidebarPath, 'utf8');
  const createFormSource = readFileSync(createFormPath, 'utf8');
  const detailsPanelSource = readFileSync(detailsPanelPath, 'utf8');
  const feedbackBannersSource = readFileSync(feedbackBannersPath, 'utf8');
  const itemsSectionSource = readFileSync(itemsSectionPath, 'utf8');
  const toolbarSource = readFileSync(toolbarPath, 'utf8');
  const selectionPanelSource = readFileSync(selectionPanelPath, 'utf8');
  const dragHookSource = readFileSync(dragHookPath, 'utf8');

  for (const typeName of ['PlaylistSummary', 'PlaylistItemRecord', 'PlaylistsManagerProps', 'EditablePlaylist', 'FamilyPlaylistHelperCard']) {
    assert.match(typesSource, new RegExp(`export type ${typeName}\\b`), `${typeName} should be exported`);
  }

  assert.match(sidebarSource, /export function PlaylistsSidebar/, 'PlaylistsSidebar should be exported');
  assert.match(sidebarSource, /GROUP_LABELS\.runtime/, 'PlaylistsSidebar should own rail grouping labels');
  assert.match(sidebarSource, /MissingFamilyCard/, 'PlaylistsSidebar should compose missing family cards');
  assert.match(createFormSource, /export function PlaylistCreateForm/, 'PlaylistCreateForm should be exported');
  assert.match(createFormSource, /placeholder="Homepage holiday edits"/, 'PlaylistCreateForm should own new collection form fields');
  assert.match(detailsPanelSource, /export function PlaylistDetailsPanel/, 'PlaylistDetailsPanel should be exported');
  assert.match(detailsPanelSource, /Fallback model playlists/, 'PlaylistDetailsPanel should own collection metadata details');
  assert.match(detailsPanelSource, /getSurfaceRoleLabel/, 'PlaylistDetailsPanel should own surface labels');
  assert.match(feedbackBannersSource, /export function PlaylistFeedbackBanners/, 'PlaylistFeedbackBanners should be exported');
  assert.match(itemsSectionSource, /export function PlaylistItemsSection/, 'PlaylistItemsSection should be exported');
  assert.match(itemsSectionSource, /getPlaceholderThumb/, 'PlaylistItemsSection should own item card thumbnails');
  assert.match(toolbarSource, /export function PlaylistsManagerToolbar/, 'PlaylistsManagerToolbar should be exported');
  assert.match(toolbarSource, /PlaylistCreateForm/, 'PlaylistsManagerToolbar should compose the create form');
  assert.match(selectionPanelSource, /export function PlaylistsManagerSelectionPanel/, 'PlaylistsManagerSelectionPanel should be exported');
  assert.match(selectionPanelSource, /PlaylistDetailsPanel/, 'PlaylistsManagerSelectionPanel should compose details');
  assert.match(dragHookSource, /export function usePlaylistDragReorder/, 'drag/drop behavior should live in a dedicated hook');
  assert.match(dragHookSource, /dragGhostRef/, 'drag/drop DOM state should stay out of PlaylistsManager');

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
