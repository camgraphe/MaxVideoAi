import assert from 'node:assert/strict';
import test from 'node:test';
import {workspaceLibraryAssetFromRecentOutput,workspaceLibraryAssetFromUploadedAsset,workspaceAssetRecordFromLibraryAsset,normalizeWorkspaceUserLibraryPage,buildWorkspaceUserLibraryUrl} from '../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-library-assets';
import {buildWorkspaceTimelineItemsForAsset} from '../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/timeline/timeline-builders';
import {normalizeWorkspaceGraphNodes,normalizeTimelineMediaUrls} from '../frontend/app/(core)/(workspace)/app/studio/_shared/_state/workspace-normalizers';
import {workspaceMediaContractFields} from '../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-media-contract';
import type {WorkspaceGraphNode} from '../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-types';
const url='https://media.example/original.wav?X-Signature=a%2Fb&x=+1';

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

test('canonical graph and timeline normalizers roundtrip exact owned references and reject fabricated media facts',()=>{
  const media=workspaceLibraryAssetFromRecentOutput({id:'output-exact',jobId:'job-1',kind:'audio',url,mediaFacts:{source:'probe',durationSec:9.25}},'audio')!;
  const asset=workspaceAssetRecordFromLibraryAsset(media);
  const timeline=buildWorkspaceTimelineItemsForAsset({assetNodeId:'local-node',title:'Audio',asset,startSec:0});
  const rawNodes: WorkspaceGraphNode[]=[{id:'local-node',position:{x:0,y:0},data:{kind:'asset-audio',asset,title:'Audio',sourceHandles:['audio']}}];
  const nodes=normalizeWorkspaceGraphNodes(JSON.parse(JSON.stringify(rawNodes)));
  const items=normalizeTimelineMediaUrls(nodes,JSON.parse(JSON.stringify(timeline)));
  assert.deepEqual(nodes[0].data.asset?.ref,asset.ref);
  assert.deepEqual(items[0].ref,asset.ref);
  assert.equal(items[0].sourceDurationSec,9.25);
  assert.equal(items[0].mediaUrl,url);
  assert.deepEqual(workspaceMediaContractFields({ref:{type:'asset',assetId:'x'.repeat(257),kind:'video'},mediaFacts:{source:'requested',durationSec:99}},'audio'),{ref:undefined,mediaFacts:undefined});
  assert.equal(workspaceMediaContractFields({ref:asset.ref},'video').ref,undefined);
});
