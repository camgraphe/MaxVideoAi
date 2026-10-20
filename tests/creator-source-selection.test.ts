import assert from 'node:assert/strict';
import test from 'node:test';
import { selectCreatorSource } from '../frontend/src/components/tools/creator/creator-source-selection';

test('source selection carries canonical identity and exact original, never a thumbnail or guessed ID', () => {
  const asset = { id: 'ma_11111111111111111111111111111111', url: 'https://private.example/original', thumbUrl: 'https://private.example/thumb', kind: 'image' as const };
  const selected = selectCreatorSource(asset, 'image');
  assert.deepEqual(selected.ref, { type: 'asset', assetId: asset.id, kind: 'image' });
  assert.equal(selected.url, asset.url);
  assert.equal(selected.thumbnailUrl, asset.thumbUrl);
  assert.throws(() => selectCreatorSource({ ...asset, id: 'gallery-card-0' }, 'image'));
  assert.throws(() => selectCreatorSource(asset, 'video'));
  assert.throws(() => selectCreatorSource({ ...asset, url: 'javascript:alert(1)' }, 'image'));
});

test('upload selection prefers the canonical ref over legacy IDs and keeps fractional measured duration', () => {
  const selected = selectCreatorSource({ id: 'legacy-42', assetId: 'ma_22222222222222222222222222222222', url: 'https://private.example/audio.wav', mime: 'audio/wav', durationSec: 7.412 }, 'audio');
  assert.equal(selected.ref.type === 'asset' && selected.ref.assetId, 'ma_22222222222222222222222222222222');
  assert.equal(selected.durationSec, 7.412);
});

test('library continuation uses an exact returned output identity and never derives an output index', () => {
  const asset = { id: 'card-17', jobId: 'job-original', sourceOutputId: 'output-exact', url: 'https://private.example/video.mp4', kind: 'video' };
  assert.deepEqual(selectCreatorSource(asset, 'video').ref, { type: 'job-output', jobId: 'job-original', outputId: 'output-exact', kind: 'video' });
  assert.throws(() => selectCreatorSource({ ...asset, sourceOutputId: undefined }, 'video'));
});

test('Lip Sync keeps exact full recording duration and validates explicit bounds without guessing missing metadata', async () => {
  const { getCreatorLipTiming } = await import('../frontend/src/components/tools/creator/creator-lip-timing');
  const audio = selectCreatorSource({assetId:'ma_22222222222222222222222222222222',url:'https://private.example/audio.mp3',durationSec:10.34449},'audio');
  const unchanged = getCreatorLipTiming('photo',{audio},{});
  assert.equal(unchanged.passages.audio?.durationSec,10.34449);
  assert.equal(unchanged.issue,undefined);assert.equal(unchanged.adaptation,undefined);
  for(const [start,end,code] of [['','2','invalid'],['0','','invalid'],['NaN','3','invalid'],['-1','2','invalid'],['3','3','invalid'],['0','11','outside'],['0','1.9','short']]) {
    const timing = getCreatorLipTiming('photo',{audio},{audio:{enabled:true,start,end}});
    assert.equal(timing.issue?.code,code);assert.equal(timing.adaptation,undefined);
  }
  const unknown = getCreatorLipTiming('photo',{audio:{...audio,durationSec:undefined}},{});
  assert.equal(unknown.passages.audio?.durationSec,null);assert.equal(unknown.issue,undefined);assert.equal(unknown.adaptation,undefined);
});

test('Lip Sync suggests a bounded common passage without mutating sources or resetting selected offsets', async () => {
  const { getCreatorLipTiming } = await import('../frontend/src/components/tools/creator/creator-lip-timing');
  const audio = selectCreatorSource({assetId:'ma_22222222222222222222222222222222',url:'https://private.example/audio.mp3',durationSec:40},'audio');
  const source = {...audio,ref:{...audio.ref,kind:'video' as const},durationSec:35};
  const drafts={audio:{enabled:true,start:'5.25',end:'35.25'},source:{enabled:true,start:'2.5',end:'32.5'}};
  const timing=getCreatorLipTiming('video',{audio,source},drafts);
  assert.deepEqual(timing.adaptation,{durationSec:15,segments:{audio:{enabled:true,start:'5.25',end:'20.25'},source:{enabled:true,start:'2.5',end:'17.5'}}});
  assert.equal(drafts.audio.end,'35.25');assert.equal(source.durationSec,35);assert.equal(audio.durationSec,40);
  assert.equal(getCreatorLipTiming('video',{audio:{...audio,durationSec:10.34449},source:{...source,durationSec:10.041667}},{}).issue?.code,'mismatch');
});

test('matching decimal passages are not blocked by floating-point subtraction',async()=>{
  const { getCreatorLipTiming } = await import('../frontend/src/components/tools/creator/creator-lip-timing');
  const audio=selectCreatorSource({assetId:'ma_22222222222222222222222222222222',url:'https://private.example/audio.wav',durationSec:15},'audio');
  const source={...audio,ref:{...audio.ref,kind:'video' as const}};
  const timing=getCreatorLipTiming('video',{audio,source},{audio:{enabled:true,start:'0.1',end:'7.5'},source:{enabled:true,start:'1.2',end:'8.6'}});
  assert.equal(timing.issue,undefined);assert.equal(timing.passages.audio?.durationSec,7.4);assert.equal(timing.passages.source?.durationSec,7.4);
});
