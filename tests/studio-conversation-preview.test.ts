import test from 'node:test';
import assert from 'node:assert/strict';
import type {WorkspaceTimelineItem} from '../frontend/app/(core)/(workspace)/app/studio/workspace/_lib/workspace-types';
const item = (id: string): WorkspaceTimelineItem => ({id,title: id,track: 'video',startSec: 0,durationSec: 3,mediaKind: 'video',assetNodeId: id,mediaUrl: 'https://media.maxvideoai.com/'+id,ref: {type: 'asset',assetId: 'ma_'+'1'.repeat(32),kind: 'video'},thumbnailUrl: 'https://media.maxvideoai.com/thumb',mediaAccessRequired: true,mediaAccessUrl: 'https://signed.test/old',mediaAccessExpiresAt: new Date(300000).toISOString()} as WorkspaceTimelineItem);
test('private video/audio sources survive ordinary refresh, while expiry, invalidation and changed references replace them',async () => {
  const module = await import('../frontend/lib/studio/conversation-preview-access').catch(() => null);assert.ok(module?.retainConversationMediaAccess);
  const before = [item('video'),{...item('audio'),mediaKind: 'audio' as const,track: 'audio-1' as const}];
  const fresh = before.map(value => ({...value,durationSec: 2,mediaAccessUrl: 'https://signed.test/new'}));
  const kept = module.retainConversationMediaAccess(before,fresh,10000);
  assert.deepEqual(kept.map(value => value.mediaAccessUrl),before.map(value => value.mediaAccessUrl));assert.equal(kept[0].durationSec,2);
  assert.equal(module.retainConversationMediaAccess(before,fresh,280000)[0].mediaAccessUrl,fresh[0].mediaAccessUrl);
  assert.equal(module.retainConversationMediaAccess(before,fresh,10000,'video')[0].mediaAccessUrl,fresh[0].mediaAccessUrl);
  assert.equal(module.retainConversationMediaAccess(before,[{...fresh[0],ref: {...fresh[0].ref!,assetId: 'ma_'+'2'.repeat(32)} as any}],10000)[0].mediaAccessUrl,fresh[0].mediaAccessUrl);
  assert.equal(module.retainConversationMediaAccess(before,[{...fresh[0],mediaAccessError: 'MEDIA_NOT_AVAILABLE',mediaAccessUrl: undefined}],10000)[0].mediaAccessUrl,undefined);
});
test('a missing clip remains editable with no inaccessible URL, while other owned originals still resolve',async () => {
  const module = await import('../frontend/src/server/studio/conversation-preview-media').catch(() => null);assert.ok(module?.buildConversationPreviewMedia);
  const clips = [item('missing'),{...item('ready'),ref: {type: 'asset' as const,assetId: 'ma_'+'2'.repeat(32),kind: 'video' as const}}];
  const result = await module.buildConversationPreviewMedia('owner',clips,{resolve: async (owner,ref) => {assert.equal(owner,'owner');if (ref.type === 'asset' && ref.assetId.endsWith('1')) throw new Error('MEDIA_NOT_AVAILABLE');return {url: 'https://media.maxvideoai.com/ready',originalAccess: {type: 'external'}} as any;}});
  assert.equal(result.length,2);assert.equal(result[0].id,'missing');assert.equal(result[0].mediaAccessError,'MEDIA_NOT_AVAILABLE');
  assert.equal(result[0].mediaUrl,undefined);assert.equal(result[0].thumbnailUrl,undefined);assert.equal(result[0].mediaAccessUrl,undefined);
  assert.equal(result[1].mediaAccessUrl,'https://media.maxvideoai.com/ready');
  await assert.rejects(() => module.buildConversationPreviewMedia('owner',clips,{resolve: async () => {throw new Error('DATABASE_UNAVAILABLE');}}),/DATABASE_UNAVAILABLE/,'infrastructure errors must not masquerade as missing assets');
});
test('a signed source gets one automatic renewal per monitor opening, and permanent/external failures reach stable error',async () => {
  const module = await import('../frontend/lib/studio/conversation-preview-access').catch(() => null);assert.ok(module?.consumeConversationMediaRenewal);
  const attempts = new Set<string>();assert.equal(module.consumeConversationMediaRenewal(item('video'),attempts),true);assert.equal(module.consumeConversationMediaRenewal(item('video'),attempts),false);
  assert.equal(module.consumeConversationMediaRenewal({...item('external'),mediaAccessExpiresAt: null},attempts),false);
  attempts.clear();assert.equal(module.consumeConversationMediaRenewal(item('video'),attempts),true);
});
