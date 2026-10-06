import test from 'node:test';
import assert from 'node:assert/strict';
import {studioAnalysisCapabilities,studioAnalysisPrepareSchema,studioAnalysisConfirmSchema,studioAnalysisResultSchema} from '../frontend/lib/studio/media-analysis-contract';

const request={ref:{type:'asset',assetId:'ma_'+'a'.repeat(32),kind:'video'},goal:'Identify the turn towards the camera',reason:'requested',startSec:0,endSec:30};
test('Luna keeps image vision and simple edits while effective analysis is reserved to Sol',()=>{
  const available={video:true,audio:false};
  assert.deepEqual(studioAnalysisCapabilities('gpt-6-luna',available),{imageVision:true,simpleEditing:true,videoAnalysis:false,audioAnalysis:false});
  assert.equal(studioAnalysisCapabilities('gpt-6.1-sol',available).videoAnalysis,true);
  assert.equal(studioAnalysisCapabilities('gpt-6.1-sol',available).audioAnalysis,false);
});
test('analysis requires an objective and explicit reason; completion cannot trigger it',()=>{
  assert.equal(studioAnalysisPrepareSchema.safeParse(request).success,true);
  for(const change of [{reason:'generation_completed'},{goal:''},{url:'https://example.com/video.mp4'},{model:'gpt-6.1-sol'},{confirmed:true},{endSec:61},{startSec:30,endSec:20}])
    assert.equal(studioAnalysisPrepareSchema.safeParse({...request,...change}).success,false);
  assert.equal(studioAnalysisPrepareSchema.safeParse({...request,ref:{...request.ref,kind:'audio'},endSec:31}).success,false);
});
test('only the client confirms an exact quote and maximum credit amount',()=>{
  const input={analysisId:'f2929a29-91b4-4c81-a731-820d6d3d7102',maxCredits:80,policyVersion:'policy-v1',confirmed:true};
  assert.equal(studioAnalysisConfirmSchema.safeParse(input).success,true);
  assert.equal(studioAnalysisConfirmSchema.safeParse({...input,confirmed:false}).success,false);
  assert.equal(studioAnalysisConfirmSchema.safeParse({...input,selectLuna:true}).success,false);
});
test('safe results contain timestamped observations rather than private provider payloads',()=>{
  const result={summary:'A turn occurs near the end.',observations:[{startSec:20,endSec:30,text:'Character turns towards camera.',kind:'observed'}],coverage:{startSec:0,endSec:30,sampledAtSec:[0,10,20],complete:false}};
  assert.equal(studioAnalysisResultSchema.safeParse(result).success,true);
  assert.equal(studioAnalysisResultSchema.safeParse({...result,sourceUrl:'https://example.com/private?token=secret'}).success,false);
});
