import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { workspaceLibraryAssetFromRecentOutput, workspaceLibraryAssetFromUploadedAsset, workspaceAssetRecordFromLibraryAsset, normalizeWorkspaceUserLibraryPage, buildWorkspaceUserLibraryUrl } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-library-assets';
import { buildWorkspaceTimelineItemsForAsset } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/timeline/timeline-builders';
import { hasProjectMediaUndo, mergeProjectMedia, projectMediaUndoEntry, undoProjectMedia } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-project-media-commands';
import { workspaceProjectAssetMetadataSource } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-project-media-metadata';
import { normalizePersistedWorkspaceState } from '../frontend/app/(core)/(workspace)/app/studio/workspace/_state/workspace-api-persistence';

const url = 'https://media.example/original.wav?X-Signature=a%2Fb&x=+1';
test('recent output keeps exact tuple, signed original, audio facts through bin and timeline', () => {
  const media = workspaceLibraryAssetFromRecentOutput({ id: 'output-exact', jobId: 'job-1', kind: 'audio', url, durationSec: 20, thumbUrl: 'https://media.example/thumb.jpg', mediaFacts: { source: 'probe', durationSec: 9.25 } }, 'audio')!;
  assert.deepEqual(media.ref, { type: 'job-output', jobId: 'job-1', outputId: 'output-exact', kind: 'audio' });
  const asset = workspaceAssetRecordFromLibraryAsset(media);
  assert.notEqual(asset.id, media.id, 'project identity is separate from exact remote ref/card identity');
  assert.equal(asset.url, url);
  assert.equal(asset.durationSec, 9.25);
  const [clip] = buildWorkspaceTimelineItemsForAsset({ assetNodeId: 'local-node', title: 'Audio', asset, startSec: 0 });
  assert.equal(clip.sourceDurationSec, 9.25);
  assert.equal(clip.mediaUrl, url);
  assert.deepEqual(JSON.parse(JSON.stringify(clip)).ref, media.ref);
});
test('unknown identity, kind and unmeasured metadata are never fabricated', () => {
  assert.equal(workspaceLibraryAssetFromUploadedAsset({ url, kind: 'audio' }, null), null);
  assert.equal(workspaceLibraryAssetFromUploadedAsset({ id: 'id', url: '/opaque' }, null), null);
  const asset = workspaceAssetRecordFromLibraryAsset(workspaceLibraryAssetFromUploadedAsset({ id: 'legacy', url, durationSec: 20 }, null)!);
  assert.equal(asset.ref, undefined);
  assert.equal(asset.durationSec, undefined);
  assert.equal(workspaceProjectAssetMetadataSource({ ...asset, kind: 'image', url: undefined, thumbUrl: '/preview.jpg' }, []), null);
  const oversized = workspaceLibraryAssetFromRecentOutput({ id: 'x'.repeat(257), jobId: 'job', kind: 'audio', url }, null)!;
  assert.equal(oversized.ref, undefined);
});
test('library and recent adapters are distinct and search applies before pagination', () => {
  const page = normalizeWorkspaceUserLibraryPage({ outputs: [{ id: 'out', jobId: 'job', kind: 'audio', url }] }, null);
  assert.equal(page.assets[0].origin, 'recent');
  assert.equal(page.assets[0].ref?.type, 'job-output');
  const request = buildWorkspaceUserLibraryUrl('audio', 'recent', { q: 'spoken', cursor: 'opaque==' });
  assert.match(request, /q=spoken/);
  assert.doesNotMatch(request, /includeOutputs/);
});
test('reimport and undo preserve renamed media, folders, facts and unrelated assets', () => {
  const old = { id: 'local', kind: 'audio' as const, filename: 'renamed', subtitle: 'Audio', folderId: 'folder', durationSec: 9.25, url };
  const updated = mergeProjectMedia([old], [{ ...old, filename: 'upload.wav', folderId: null, durationSec: undefined }]);
  assert.equal(updated[0].filename, 'renamed');
  assert.equal(updated[0].folderId, 'folder');
  assert.equal(updated[0].durationSec, 9.25);
  const entry = projectMediaUndoEntry([old], []);
  const unrelated = { ...old, id: 'other' };
  assert.deepEqual(undoProjectMedia([unrelated], entry), [old, unrelated]);
});

test('Undo media is enabled only for real history in the current project scope', () => {
  const previous = { id: 'local', kind: 'audio' as const, filename: 'before', subtitle: 'Audio', url };
  const entry = projectMediaUndoEntry([previous], [{ ...previous, filename: 'after' }]);
  assert.equal(hasProjectMediaUndo('project-a', 'project-a', [entry]), true);
  assert.equal(hasProjectMediaUndo('project-a', 'project-b', [entry]), false);
  assert.equal(hasProjectMediaUndo('project-a', 'project-a', []), false);

  const workspaceRoot = join(process.cwd(), 'frontend/app/(core)/(workspace)/app/studio/workspace');
  const hookSource = readFileSync(join(workspaceRoot, '_hooks/useWorkspaceProjectMediaActions.ts'), 'utf8');
  const panelSource = readFileSync(join(workspaceRoot, '_components/WorkspaceProjectMediaPanel.tsx'), 'utf8');
  const sidebarSource = readFileSync(join(workspaceRoot, '_components/TimelineProjectSidebar.tsx'), 'utf8');
  assert.match(hookSource, /canUndoProjectMedia:\s*hasProjectMediaUndo\(mediaScope, historyScope\.current, mediaHistory\.current\)/u);
  assert.match(panelSource, /canUndoProjectMedia=\{projectMedia\.canUndoProjectMedia\}/u);
  assert.match(sidebarSource, /disabled=\{!canUndoProjectMedia\}[\s\S]*onClick=\{onUndoProjectMedia\}/u);
});

test('actual workspace normalizer roundtrips bin/canvas/timeline references and preserves legacy unknown identity', () => {
  const media = workspaceLibraryAssetFromRecentOutput({ id: 'output-exact', jobId: 'job-1', kind: 'audio', url, mediaFacts: { source: 'probe', durationSec: 9.25 } }, 'audio')!;
  const asset = workspaceAssetRecordFromLibraryAsset(media);
  const timelineItems = buildWorkspaceTimelineItemsForAsset({ assetNodeId: 'local-node', title: 'Audio', asset, startSec: 0 });
  const state = normalizePersistedWorkspaceState(JSON.parse(JSON.stringify({ activeTemplateId: 'minimal-start', nodes: [{ id: 'local-node', type: 'asset-audio', position: { x: 0, y: 0 }, data: { kind: 'asset-audio', asset, title: 'Audio', accent: '#fff', sourceHandles: ['audio'] } }], edges: [], timelineItems, projectAssets: [asset, { ...asset, id: 'legacy', ref: undefined, mediaFacts: undefined }] })))!;
  assert.ok(state);
  assert.deepEqual(state.projectAssets?.[0].ref, asset.ref);
  assert.deepEqual(state.nodes[0].data.asset?.ref, asset.ref);
  assert.deepEqual(state.timelineItems[0].ref, asset.ref);
  assert.equal(state.timelineItems[0].sourceDurationSec, 9.25);
  assert.equal(state.timelineItems[0].mediaUrl, url);
  assert.equal(state.projectAssets?.[1].ref, undefined);
  const corrupt = normalizePersistedWorkspaceState({ ...state, projectAssets: [{ ...asset, ref: { type: 'asset', assetId: 'x'.repeat(257), kind: 'video' }, mediaFacts: { source: 'requested', durationSec: 99 } }] })!;
  assert.equal(corrupt.projectAssets?.[0].ref, undefined);
  assert.equal(corrupt.projectAssets?.[0].mediaFacts, undefined);
});
