import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {startDisposablePostgres} from './helpers/disposable-postgres';
import {initializeStudioConnectedFixture, STUDIO_CONNECTED_ASSET_IDS, STUDIO_CONNECTED_MONTAGE_INPUT} from './helpers/studio-connected-fixture-data';
import {STUDIO_FIXTURE_OWNERS} from './helpers/studio-auth-fixture';
import {createStudioMontageProject} from '../frontend/src/server/studio/montage-command';
import {readStudioWorkspace} from '../frontend/src/server/studio/workspace-command';
import type {QueryExecutor} from '../frontend/src/lib/db';
import type {WorkspaceTimelineItem} from '../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-types';
import {buildWorkspaceTimelineRenderManifest} from '../frontend/app/(core)/(workspace)/app/studio/_shared/_lib/workspace-timeline-render';

test('one bounded assembly preserves source ranges, applies atomically and keeps a supplied long music track',async t=>{
  const {editStudioConversationTimeline}=await import('../frontend/src/server/studio/conversation-edit-command');
  const pg=await startDisposablePostgres('stchat-assembly');t.after(()=>pg.cleanup());await initializeStudioConnectedFixture(pg);
  await pg.pool.query("UPDATE media_assets SET url='https://cdn.maxvideoai.com/' || public_id || '.mp4'");
  const withTransaction=async<T>(callback:(executor:QueryExecutor)=>Promise<T>)=>{
    const client=await pg.pool.connect();try{await client.query('BEGIN');const result=await callback({query:async(sql,values)=>(await client.query(sql,values)).rows});await client.query('COMMIT');return result;}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  };
  const deps={withTransaction,featureEnabled:true},actor={userId:STUDIO_FIXTURE_OWNERS[0]};
  const project=await createStudioMontageProject(actor,STUDIO_CONNECTED_MONTAGE_INPUT,deps);
  const before=await readStudioWorkspace(actor,project.projectId,deps);
  const frames=150;
  const clips=Array.from({length:6},(_,i)=>({ref:{type:'asset' as const,assetId:i%2?STUDIO_CONNECTED_ASSET_IDS.b:STUDIO_CONNECTED_ASSET_IDS.a,kind:'video' as const},startFrame:150+i*frames,durationFrames:frames,sourceInFrame:30}));
  const input={projectId:project.projectId,sequenceId:project.sequenceId,expectedRevision:0,idempotencyKey:randomUUID(),edit:{kind:'assemble',clips}};
  const assembled=await editStudioConversationTimeline(actor,input,deps);
  assert.equal(assembled.revision,1);assert.equal(assembled.clipCount,8);assert.ok(assembled.totalFrames/30>30);
  const sequence=await readStudioWorkspace(actor,project.projectId,deps);
  const items=(sequence.sequences[0].timelineState as {timelineItems:WorkspaceTimelineItem[]}).timelineItems;
  assert.ok(items.slice(2).every(item=>item.sourceStartSec===1));assert.equal(new Set(items.map(item=>item.id)).size,8);
  assert.deepEqual(await editStudioConversationTimeline(actor,input,deps),assembled);
  const rejected={...input,expectedRevision:1,idempotencyKey:randomUUID(),edit:{kind:'assemble',clips:[clips[0],{...clips[1],ref:{...clips[1].ref,assetId:STUDIO_CONNECTED_ASSET_IDS.foreign}}]}};
  await assert.rejects(editStudioConversationTimeline(actor,rejected,deps),/MEDIA_NOT_AVAILABLE/);
  assert.deepEqual(await readStudioWorkspace(actor,project.projectId,deps),sequence,'An invalid second source leaves the whole montage untouched');
  const musicId='ma_'+'b'.repeat(32);
  await pg.pool.query(`INSERT INTO media_assets(id,public_id,user_id,kind,url,mime_type,status,metadata) VALUES($1,$2,$3,'audio','https://cdn.maxvideoai.com/music.mp3','audio/mpeg','ready',$4::jsonb)`,[randomUUID(),musicId,actor.userId,JSON.stringify({mediaFacts:{source:'probe',durationSec:120,hasAudio:true}})]);
  const musicInput={...input,expectedRevision:1,idempotencyKey:randomUUID(),edit:{kind:'insert',ref:{type:'asset',assetId:musicId,kind:'audio'},startFrame:0,durationFrames:1800,sourceInFrame:300}};
  const music=await editStudioConversationTimeline(actor,musicInput,deps);
  assert.equal(music.totalFrames,1800,'Requested music defines the new film duration without truncation to its shorter visuals');
  const withMusic=await readStudioWorkspace(actor,project.projectId,deps);
  const mixed=(withMusic.sequences[0].timelineState as {timelineItems:WorkspaceTimelineItem[]}).timelineItems;
  assert.deepEqual(mixed.filter(item=>item.mediaKind==='video'),items);
  assert.equal(mixed.find(item=>item.mediaKind==='audio')?.sourceStartSec,10);
  await assert.rejects(editStudioConversationTimeline(actor,{...musicInput,expectedRevision:2,idempotencyKey:randomUUID(),edit:{...musicInput.edit,sourceInFrame:2100}},deps),/source|duration/i);
  assert.equal((await readStudioWorkspace(actor,project.projectId,deps)).project.revision,2);
  assert.equal(before.project.revision,0);
});

test('conversation edits use canonical revisions and receipts, preserving manual changes and unrelated editor state', async t => {
  const module = await import('../frontend/src/server/studio/conversation-edit-command').catch(() => null);
  assert.ok(module?.editStudioConversationTimeline);
  const pg = await startDisposablePostgres('stchat-edit');
  t.after(() => pg.cleanup());
  await initializeStudioConnectedFixture(pg);
  // Mutation/revision proof uses external originals; private signing has its own byte-backed integration suite.
  await pg.pool.query("UPDATE media_assets SET url='https://cdn.maxvideoai.com/' || public_id || '.mp4'");
  const withTransaction = async <T>(callback: (executor: QueryExecutor) => Promise<T>) => {
    const client = await pg.pool.connect();
    try {await client.query('BEGIN'); const result = await callback({query: async (sql, values) => (await client.query(sql, values)).rows}); await client.query('COMMIT'); return result;}
    catch (error) {await client.query('ROLLBACK'); throw error;} finally {client.release();}
  };
  const deps = {withTransaction, featureEnabled: true};
  const actor = {userId: STUDIO_FIXTURE_OWNERS[0]};
  const project = await createStudioMontageProject(actor, STUDIO_CONNECTED_MONTAGE_INPUT, deps);
  await pg.pool.query("UPDATE studio_projects SET workspace_state=workspace_state || '{\"projectMediaFolders\":[{\"id\":\"keep-me\"}],\"customFutureState\":{\"kept\":true}}'::jsonb WHERE id=$1", [project.projectId]);
  const input = {projectId: project.projectId, sequenceId: project.sequenceId, expectedRevision: 0, idempotencyKey: randomUUID(), edit: {kind: 'trim' as const, clipId: 'montage-clip-01', edge: 'start' as const, durationFrames: 30}};
  const result = await module.editStudioConversationTimeline(actor, input, deps);
  assert.equal(result.revision, 1);
  assert.deepEqual(await module.editStudioConversationTimeline(actor, input, deps), result);
  const read = await readStudioWorkspace(actor, project.projectId, deps);
  const state = read.sequences[0].timelineState as any;
  assert.deepEqual(state.timelineItems.map((item: any) => [item.startSec, item.durationSec, item.sourceStartSec]), [[0,1,2],[1,2,.5]]);
  assert.deepEqual((read.project.workspaceState as any).customFutureState, {kept: true});
  assert.equal((state.timelineItems[0].montageSource).sourceInFrame, 30);
  await assert.rejects(module.editStudioConversationTimeline(actor, {...input, idempotencyKey: randomUUID(), edit: {kind: 'move', clipId: 'montage-clip-02', startFrame: 150}}, deps), {code: 'STUDIO_REVISION_CONFLICT'});
  await assert.rejects(module.editStudioConversationTimeline(actor, {...input, expectedRevision: 1}, deps), {code: 'STUDIO_IDEMPOTENCY_CONFLICT'});
  await assert.rejects(module.editStudioConversationTimeline({userId: STUDIO_FIXTURE_OWNERS[1]}, input, deps), /STUDIO_PROJECT_NOT_FOUND/);
  const insert = {...input, expectedRevision: 1, idempotencyKey: randomUUID(), edit: {kind: 'insert' as const, ref: {type: 'asset' as const, assetId: STUDIO_CONNECTED_ASSET_IDS.a, kind: 'video' as const}, startFrame: 90, durationFrames: 60}};
  const inserted = await module.editStudioConversationTimeline(actor, insert, deps);
  assert.equal(inserted.clipCount, 3);
  const insertedRead = await readStudioWorkspace(actor,project.projectId,deps);
  const insertedItem = (insertedRead.sequences[0].timelineState as any).timelineItems.find((item: any) => item.id === inserted.clip!.id);
  const originalFit = state.timelineItems.find((item: any) => item.ref.assetId === STUDIO_CONNECTED_ASSET_IDS.a).transform.scale;
  assert.equal(insertedItem.transform?.scale,originalFit,'Inserting the same measured source must fit the same program frame as the existing montage.');
  await assert.rejects(module.editStudioConversationTimeline(actor, {...insert, expectedRevision: 2, idempotencyKey: randomUUID(), edit: {...insert.edit, ref: {...insert.edit.ref, assetId: STUDIO_CONNECTED_ASSET_IDS.foreign}}}, deps), /MEDIA_NOT_AVAILABLE/);
  // An unavailable probe preserves the canonical timeline; this disposable DB
  // test must not invoke the default app connection or any remote source read.
  await assert.rejects(module.editStudioConversationTimeline(actor, {...insert, expectedRevision: 2, idempotencyKey: randomUUID(), edit: {...insert.edit, ref: {...insert.edit.ref, assetId: STUDIO_CONNECTED_ASSET_IDS.unmeasured}}}, {...deps, hydrateVideoFacts: async () => {throw new Error('MEDIA_METADATA_REQUIRED');}}), /MEDIA_METADATA_REQUIRED/);
  await assert.rejects(module.editStudioConversationTimeline(actor, {...insert, expectedRevision: 2, idempotencyKey: randomUUID()}, {...deps, afterMutation: () => {throw new Error('Lost receipt');}}), /Lost receipt/);
  assert.equal((await readStudioWorkspace(actor, project.projectId, deps)).project.revision, 2);
  const conflicting = await Promise.allSettled([3,4].map(startFrame => module.editStudioConversationTimeline(actor, {...input, expectedRevision: 2, idempotencyKey: randomUUID(), edit: {kind: 'move', clipId: 'montage-clip-01', startFrame: startFrame * 30}}, deps)));
  assert.equal(conflicting.filter(value => value.status === 'fulfilled').length, 1);
  assert.equal((await pg.pool.query("SELECT count(*)::int AS n FROM studio_project_commands WHERE command_kind='conversation_timeline_edit'")).rows[0].n, 3);
  assert.ok(module.createStudioConversationProject);
  const starter = {name: 'New film',idempotencyKey: randomUUID()};
  const blank = await module.createStudioConversationProject(actor,starter,deps);
  assert.deepEqual(await module.createStudioConversationProject(actor,starter,deps),blank);
  const empty = await readStudioWorkspace(actor,blank.projectId,deps);
  assert.equal(empty.sequences.length,1);
  assert.deepEqual((empty.sequences[0].timelineState as any).timelineItems,[]);
  assert.equal(empty.project.revision,0);
  assert.equal((await readStudioWorkspace(actor,project.projectId,deps)).project.revision,3);
});

test('adding music layers it under the voice without moving existing clips and receipt replay adds no extra track', async t => {
  const {editStudioConversationTimeline} = await import('../frontend/src/server/studio/conversation-edit-command');
  const pg = await startDisposablePostgres('stchat-audio-layer');
  t.after(() => pg.cleanup());
  await initializeStudioConnectedFixture(pg);
  await pg.pool.query("UPDATE media_assets SET url='https://cdn.maxvideoai.com/' || public_id || '.mp4'");
  const actor = {userId: STUDIO_FIXTURE_OWNERS[0]};
  const withTransaction = async <T>(callback: (executor: QueryExecutor) => Promise<T>) => {
    const client = await pg.pool.connect();
    try {await client.query('BEGIN'); const result = await callback({query: async (sql, values) => (await client.query(sql, values)).rows}); await client.query('COMMIT'); return result;}
    catch (error) {await client.query('ROLLBACK'); throw error;} finally {client.release();}
  };
  const deps = {withTransaction,featureEnabled: true};
  const voiceAssetId = `ma_${'5'.repeat(32)}`;
  const musicAssetId = `ma_${'6'.repeat(32)}`;
  for (const [assetId,name] of [[voiceAssetId,'Voice'],[musicAssetId,'Music']]) {
    await pg.pool.query(`INSERT INTO media_assets (id,public_id,user_id,kind,url,mime_type,status,original_name,metadata)
      VALUES ($1,$2,$3,'audio',$4,'audio/mpeg','ready',$5,$6::jsonb)`, [randomUUID(),assetId,actor.userId,`https://cdn.maxvideoai.com/${assetId}.mp3`,name,JSON.stringify({mediaFacts: {source: 'probe',durationSec: 12.408,hasAudio: true}})]);
  }
  const project = await createStudioMontageProject(actor,STUDIO_CONNECTED_MONTAGE_INPUT,deps);
  const before = await readStudioWorkspace(actor,project.projectId,deps);
  const videos = (before.sequences[0].timelineState as {timelineItems: WorkspaceTimelineItem[]}).timelineItems;
  const voiceInput = {projectId: project.projectId,sequenceId: project.sequenceId,expectedRevision: 0,idempotencyKey: randomUUID(),edit: {kind: 'insert' as const,ref: {type: 'asset' as const,assetId: voiceAssetId,kind: 'audio' as const},startFrame: 0,durationFrames: 60}};
  const voice = await editStudioConversationTimeline(actor,voiceInput,deps);
  const voiceRead = await readStudioWorkspace(actor,project.projectId,deps);
  const previous = (voiceRead.sequences[0].timelineState as {timelineItems: WorkspaceTimelineItem[]}).timelineItems;
  const musicInput = {...voiceInput,expectedRevision: 1,idempotencyKey: randomUUID(),edit: {...voiceInput.edit,ref: {...voiceInput.edit.ref,assetId: musicAssetId},durationFrames: 90}};
  const music = await editStudioConversationTimeline(actor,musicInput,deps);
  const loaded = await readStudioWorkspace(actor,project.projectId,deps);
  const state = loaded.sequences[0].timelineState as {timelineItems: WorkspaceTimelineItem[];audioTrackCount: number};
  const items = state.timelineItems;
  assert.deepEqual(items.filter(item => item.mediaKind === 'video'),videos,'Adding a music bed must preserve the existing visual edit.');
  assert.deepEqual(items.find(item => item.id === voice.clip!.id),previous.find(item => item.id === voice.clip!.id),'The voice remains at frame zero with its original source range and mix.');
  assert.deepEqual(items.filter(item => item.mediaKind === 'audio').map(item => [item.track,item.startSec,item.durationSec,item.sourceStartSec]),[['audio',0,2,0],['audio-2',0,3,0]]);
  assert.equal(state.audioTrackCount,2);
  assert.equal(items.find(item => item.id === music.clip!.id)?.sourceDurationSec,12.408);
  assert.deepEqual(await editStudioConversationTimeline(actor,musicInput,deps),music);
  assert.deepEqual(await editStudioConversationTimeline(actor,voiceInput,deps),voice);
  const replayed = await readStudioWorkspace(actor,project.projectId,deps);
  assert.deepEqual(replayed.sequences[0].timelineState,state,'Receipt replay neither allocates another track nor duplicates clips.');
  assert.equal(replayed.project.revision,2);
  await assert.rejects(editStudioConversationTimeline(actor,{...musicInput,idempotencyKey: randomUUID()},deps),{code: 'STUDIO_REVISION_CONFLICT'});
  const manifest = buildWorkspaceTimelineRenderManifest({items,nodes: [],projectName: project.title,sequenceId: project.sequenceId,sequenceName: 'Main sequence'});
  assert.equal(manifest.status,'ready');
  assert.deepEqual(manifest.tracks.filter(track => track.id.startsWith('audio')).map(track => [track.id,track.clips[0].startSec,track.clips[0].sourceStartSec,track.clips[0].durationSec]),[['audio',0,0,2],['audio-2',0,0,3]],'The render manifest carries simultaneous audio tracks.');
  const nextInput = {...musicInput,expectedRevision: 2,idempotencyKey: randomUUID()};
  await assert.rejects(editStudioConversationTimeline(actor,{...nextInput,edit: {...nextInput.edit,durationFrames: 373}},deps),/Invalid Studio timeline clip duration/,'Layering never extends beyond the measured 12.408-second original.');
  await pg.pool.query(`UPDATE studio_sequences SET timeline_state=timeline_state || $2::jsonb WHERE id=$1`,[project.sequenceId,JSON.stringify({lockedTimelineTracks: ['audio','audio-2'],mutedAudioTracks: ['audio-3']})]);
  const extra = await editStudioConversationTimeline(actor,nextInput,deps);
  const allocated = await readStudioWorkspace(actor,project.projectId,deps);
  const allocatedState = allocated.sequences[0].timelineState as typeof state;
  assert.equal(allocatedState.timelineItems.find(item => item.id === extra.clip!.id)?.track,'audio-4','New sound uses an audible, unlocked lane.');
  assert.equal(allocatedState.audioTrackCount,4,'Newly needed tracks survive canonical serialization.');
  assert.deepEqual(allocatedState.timelineItems.filter(item => item.id !== extra.clip!.id),items);
  const allAudioTracks = ['audio','audio-2','audio-3','audio-4','audio-5','audio-6','audio-7','audio-8'];
  await pg.pool.query(`UPDATE studio_sequences SET timeline_state=timeline_state || $2::jsonb WHERE id=$1`,[project.sequenceId,JSON.stringify({audioTrackCount: 8,lockedTimelineTracks: allAudioTracks})]);
  const fullBefore = await readStudioWorkspace(actor,project.projectId,deps);
  await assert.rejects(editStudioConversationTimeline(actor,{...nextInput,expectedRevision: 3,idempotencyKey: randomUUID()},deps),/Timeline track capacity/);
  assert.deepEqual(await readStudioWorkspace(actor,project.projectId,deps),fullBefore,'Capacity failure commits no revision, assets or timeline changes.');
  assert.equal((await pg.pool.query("SELECT count(*)::int AS n FROM studio_project_commands WHERE command_kind='conversation_timeline_edit'")).rows[0].n,3,'Rejected insertions have no command receipt.');
});
