import test from 'node:test';
import assert from 'node:assert/strict';
import {studioAnalysisPolicy,quoteStudioAnalysis,priceStudioAnalysis} from '../frontend/src/server/studio/media-analysis/policy';
import {analysisSampleTimes,readBoundedAnalysisBody,analysisSourceFingerprint,extractStudioAnalysisSource} from '../frontend/src/server/studio/media-analysis/source';
import {parseStudioAnalysisObservations,buildStudioAnalysisVisualInput,readStudioAnalysisProviderCost} from '../frontend/src/server/studio/media-analysis/provider';

export const policyFixture={version:'test-policy-v1',processingNanoUsdPerSecond:100_000,marginPercent:1,video:{maxInputTokens:20_000,maxOutputTokens:2200},audio:null};
test('settlement requires the exact provider model, metered token bounds and supported tier',()=>{
  const snapshot={id:'response',model:'gpt-6.1-sol',serviceTier:'default',usage:{input_tokens:100,input_tokens_details:{cached_tokens:0},output_tokens:20},outputText:'',inputTokens:100,outputTokenBound:2200,providerNanoUsd:450_000};
  assert.equal(readStudioAnalysisProviderCost(snapshot,'video',policyFixture),450_000);
  assert.equal(readStudioAnalysisProviderCost({...snapshot,model:'gpt-6-luna'},'video',policyFixture),null);
  assert.equal(readStudioAnalysisProviderCost({...snapshot,inputTokens:99},'video',policyFixture),null);
  assert.equal(readStudioAnalysisProviderCost({...snapshot,serviceTier:'flex'},'video',policyFixture),null);
});
test('analysis fails closed without an explicitly qualified versioned policy',()=>{
  assert.equal(studioAnalysisPolicy({}),null);
  assert.equal(studioAnalysisPolicy({STUDIO_MEDIA_ANALYSIS_ENABLED:'true',STUDIO_MEDIA_ANALYSIS_POLICY_JSON:JSON.stringify(policyFixture)}),null);
  assert.ok(studioAnalysisPolicy({STUDIO_MEDIA_ANALYSIS_ENABLED:'true',STUDIO_MEDIA_ANALYSIS_APPROVED_POLICY:'test-policy-v1',STUDIO_MEDIA_ANALYSIS_POLICY_JSON:JSON.stringify(policyFixture)}));
});
test('the real decoder produces timestamped JPEGs and a bounded mono music window',async()=>{
  const {mkdtemp,readFile,rm}=await import('node:fs/promises');
  const {tmpdir}=await import('node:os');const path=await import('node:path');
  const {execFile}=await import('node:child_process');const {promisify}=await import('node:util');
  const {createRequire}=await import('node:module');
  const installer=createRequire(path.resolve('frontend/package.json'))('@ffmpeg-installer/ffmpeg');
  const directory=await mkdtemp(path.join(tmpdir(),'analysis-test-'));
  try {
    const video=path.join(directory,'fixture.mp4');
    await promisify(execFile)(installer.path,['-nostdin','-loglevel','error','-f','lavfi','-i','color=c=blue:s=128x96:r=24','-f','lavfi','-i','sine=frequency=440:sample_rate=16000','-t','2','-c:v','libx264','-c:a','aac',video]);
    const bytes=await readFile(video);
    const ref={type:'asset' as const,assetId:'ma_'+'a'.repeat(32),kind:'video' as const};
    const media={id:'owned',ref,kind:'video' as const,url:'https://cdn.maxvideoai.com/local-fixture.mp4',durationSec:2,sizeBytes:bytes.length,mime:'video/mp4',thumbUrl:null,previewUrl:null,mediaFacts:null,originalAccess:{type:'external' as const}};
    const request={ref,goal:'Describe color',reason:'requested' as const,startSec:.5,endSec:1.5};
    const dependencies={fetchSource:async()=>new Response(bytes)};
    const extracted=await extractStudioAnalysisSource(media,request,AbortSignal.timeout(20_000),dependencies);
    assert.equal(extracted.frames.length,12);assert.equal(extracted.frames[0].atSec,.5);
    assert.ok(extracted.frames.every(frame=>frame.imageUrl.startsWith('data:image/jpeg;base64,')));
    const audioRef={...ref,kind:'audio' as const};
    const audio=await extractStudioAnalysisSource({...media,ref:audioRef,kind:'audio',mime:'audio/mp4'},{...request,ref:audioRef},AbortSignal.timeout(20_000),dependencies);
    assert.equal(Buffer.from(audio.audioBase64!,'base64').subarray(0,4).toString(),'RIFF');
    assert.equal(audio.sourceHash,extracted.sourceHash);assert.equal(audio.frames.length,0);
  } finally {await rm(directory,{recursive:true,force:true});}
});
test('credit ceiling covers processing and bounded model usage, exact settlement never exceeds it',()=>{
  const quote=quoteStudioAnalysis(policyFixture,'video',30);
  const price=priceStudioAnalysis(policyFixture,30,10_000_000);
  assert.ok(quote.maxCredits>=price.credits);
  assert.throws(()=>quoteStudioAnalysis(policyFixture,'audio',30));
});
test('sampling covers an interval with exact source times and explicitly remains sparse',()=>{
  const times=analysisSampleTimes(15,45);
  assert.equal(times.length,12);assert.equal(times[0],15);assert.ok(times.at(-1)!<45);
  assert.throws(()=>analysisSampleTimes(30,15));
});
test('download bounds streamed bytes even without a Content-Length',async()=>{
  const stream=new ReadableStream({start(c){c.enqueue(new Uint8Array(8));c.enqueue(new Uint8Array(8));c.close();}});
  await assert.rejects(readBoundedAnalysisBody(new Response(stream),10),/SOURCE_TOO_LARGE/);
});
test('a changed source invalidates its frozen analysis identity',()=>{
  const source={ref:{type:'asset',assetId:'ma_'+'a'.repeat(32),kind:'video'},url:'https://cdn.maxvideoai.com/a.mp4',durationSec:30,sizeBytes:800};
  assert.notEqual(analysisSourceFingerprint(source),analysisSourceFingerprint({...source,url:'https://cdn.maxvideoai.com/b.mp4'}));
});
test('native visual input preserves timestamped frames and validates observations against coverage',()=>{
  const request={ref:{type:'asset' as const,assetId:'ma_'+'a'.repeat(32),kind:'video' as const},goal:'Find the turn',reason:'requested' as const,startSec:10,endSec:20};
  const input=buildStudioAnalysisVisualInput(request,[{atSec:10,imageUrl:'data:image/jpeg;base64,AAAA'}]);
  assert.equal(input.model,'gpt-6.1-sol');assert.match(JSON.stringify(input.input),/AAAA/);
  const payload={summary:'A turn is visible.',observations:[{startSec:12,endSec:14,text:'Character turns.',kind:'observed'}]};
  assert.equal(parseStudioAnalysisObservations(JSON.stringify(payload),request,[10]).coverage.complete,false);
  assert.throws(()=>parseStudioAnalysisObservations(JSON.stringify({...payload,observations:[{...payload.observations[0],endSec:21}]}),request,[10]),/OBSERVATION/);
});
