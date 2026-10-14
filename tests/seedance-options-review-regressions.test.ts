import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { readPreflightRequest } from '../frontend/app/api/preflight/_lib/preflight-request';
import { estimateBytePlusOutputTokens } from '../frontend/server/byteplus-accounting';
import { resolveSeedanceSourcePricingAspectRatio } from '../frontend/src/lib/seedance-option-pricing';
import { mapGenerationStatusRecordToWeb } from '../frontend/src/server/generations/generation-status';
import { mapRecentGenerationRecordToWeb } from '../frontend/src/server/generations/recent-generations';
import { normalizeJobStatus } from '../frontend/lib/job-status';
import { projectGenerationPollStatus, applyGenerationPollToRender } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-generation-polling';
import { convertJobToLocalRender, getRendersNeedingStatusRefresh, applyPolledJobStatusToRender } from '../frontend/app/(core)/(workspace)/app/_lib/workspace-render-status';
import { serializePendingRenders, deserializePendingRenders } from '../frontend/app/(core)/(workspace)/app/_lib/render-persistence';

test('normal and Draft preflight admit the full bounded 50-reference request with long owned URLs', async () => {
  for (const draft of [false, true]) {
    const inputs = Array.from({length: 50}, (_, index) => ({ assetId: `asset-${index}-` + 'a'.repeat(240),
      slotId: index < 30 ? 'image_urls' : index < 40 ? 'video_urls' : 'audio_urls',
      kind: index < 30 ? 'image' : index < 40 ? 'video' : 'audio', url: `https://media.maxvideoai.com/owned/${index}/` + 'x'.repeat(1950) }));
    const body = { engine: 'seedance-2-5', mode: 'ref2v', durationSec: 5, fps: 24, inputs, ...(draft ? {seedanceWorkflow:{step:'draft'}} : {}) };
    const result = await readPreflightRequest(new NextRequest('https://maxvideoai.com/api/preflight', { method: 'POST', body: JSON.stringify(body) }));
    assert.equal(result.ok, true, JSON.stringify(result));
    if (result.ok) assert.equal(result.request.inputs?.length, 50);
    const rejected = await readPreflightRequest(new NextRequest('https://maxvideoai.com/api/preflight', {method:'POST',body:JSON.stringify({...body,inputs:[...inputs,inputs[0]]})}));
    assert.equal(rejected.ok, false);
  }
});

test('every documented current supplier raster maps to its reviewed source class without admitting arbitrary framing', () => {
  for (const engineId of ['seedance-2-5','seedance-2-0','seedance-2-0-fast','seedance-2-0-mini']) {
    for (const resolution of ['480p','720p','1080p','4k']) for (const aspectRatio of ['21:9','16:9','4:3','1:1','3:4','9:16']) {
      const source = estimateBytePlusOutputTokens({engineId,resolution,aspectRatio,durationSec:4});
      if (!source) continue;
      assert.equal(resolveSeedanceSourcePricingAspectRatio(source), aspectRatio, `${engineId}/${resolution}/${source.width}x${source.height}`);
      assert.equal(source.tokenCount, source.width * source.height * 4 * 24 / 1024, 'Source admission uses the supplier raster owner, not the historical retail raster.');
    }
  }
  assert.equal(resolveSeedanceSourcePricingAspectRatio({width:1918,height:1080}), '16:9');
  assert.throws(() => resolveSeedanceSourcePricingAspectRatio({width:2000,height:1000}));
  assert.throws(() => resolveSeedanceSourcePricingAspectRatio({width:991,height:432}));
});

test('checkpoint history and status keep the original accessible and poll until artifact projection completes', () => {
  const original = 'https://media.maxvideoai.com/renders/original.mov';
  const base = { job_id:'owned', provider_job_id:'cgt-owned', engine_id:'seedance-2-5', status:'processing', video_url:original,
    settings_snapshot: {byteplusDurableOutput:{providerJobId:'cgt-owned',videoUrl:original}}, message:'Preparing output.' };
  for (const map of [mapGenerationStatusRecordToWeb, mapRecentGenerationRecordToWeb]) {
    const job = map(base as never) as ReturnType<typeof mapGenerationStatusRecordToWeb> & {outputPreparationState?:'active'|'manual_review'};
    assert.equal(job.outputPreparationState, 'active');
    assert.equal(normalizeJobStatus(job.status,true,job.outputPreparationState), 'pending');
    const render = convertJobToLocalRender(job as never);
    assert.equal(render.status,'pending'); assert.equal(render.videoUrl,original);
    assert.equal(getRendersNeedingStatusRefresh([render]).length,1);
    const restored = deserializePendingRenders(serializePendingRenders([render]))[0]!;
    assert.equal(restored.status,'pending'); assert.equal(getRendersNeedingStatusRefresh([restored]).length,1);
    const done = applyPolledJobStatusToRender(restored, {status:'completed',videoUrl:original,playbackVideoUrl:'https://media.maxvideoai.com/playback.mp4',lastFrameUrl:'https://media.maxvideoai.com/last.jpg'});
    assert.equal(done.playbackVideoUrl,'https://media.maxvideoai.com/playback.mp4'); assert.equal(done.lastFrameUrl,'https://media.maxvideoai.com/last.jpg');
    assert.equal(getRendersNeedingStatusRefresh([done]).length,0);
    const stalled = convertJobToLocalRender(map({...base,status:'provider_polling_stalled',message:'Manual review required.'} as never) as never);
    assert.equal(stalled.status,'pending'); assert.equal(stalled.videoUrl,original); assert.match(stalled.message ?? '',/Manual review/);
    assert.equal(getRendersNeedingStatusRefresh([stalled]).length,0,'Exhaustion requires manual recovery, not more automatic polls.');
    const stopped = projectGenerationPollStatus({ status: {status:'pending',videoUrl:original,outputPreparationState:'manual_review'},jobId:'owned',localKey:'owned',now:Date.now() });
    assert.equal(stopped.shouldKeepPolling,false);
    assert.equal(applyGenerationPollToRender(render,stopped).outputPreparationState,'manual_review');
  }
  assert.equal(normalizeJobStatus('processing',true), 'completed','Ordinary legacy media behavior remains unchanged.');
});
