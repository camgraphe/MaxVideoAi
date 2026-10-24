import assert from 'node:assert/strict';
import test from 'node:test';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { buildGoogleVertexVeoPayload } from '../frontend/src/server/video-providers/google-vertex-veo/payload';
import { estimateGoogleVertexVeoCost } from '../frontend/src/server/video-providers/google-vertex-veo/cost';
import { applyGoogleVertexVeoRuntimeOptions } from '../frontend/src/server/video-providers/google-vertex-veo/model-map';
test('Standard I2V exposes all confirmed Vertex durations with unchanged actual model/resolution/audio projection',async()=>{
 const entry=getFalEngineById('veo-3-1')!;
 assert.deepEqual(entry.modes.find(m=>m.mode==='i2v')!.ui.duration?.options,['4s','6s','8s']);
 const engine=applyGoogleVertexVeoRuntimeOptions(entry.engine);assert.deepEqual(engine.resolutions,['720p','1080p','4k']);
 for(const durationSec of [4,6,8])for(const resolution of ['720p','1080p','4k'])for(const audioEnabled of [true,false]){
  const falPayload={engineId:'veo-3-1',mode:'i2v',prompt:'Motion',durationSec,resolution,audio:audioEnabled,imageUrl:'data:image/png;base64,eA=='};
  const result=await buildGoogleVertexVeoPayload({engineId:'veo-3-1',mode:'i2v',prompt:'Motion',durationSec,aspectRatio:'16:9',audioEnabled,falPayload});
  assert.equal(result.providerModel,'veo-3.1-generate-001');assert.equal(result.body.parameters.durationSeconds,durationSec);assert.equal(result.body.parameters.resolution,resolution);assert.equal(result.body.parameters.generateAudio,audioEnabled);
  assert.equal(estimateGoogleVertexVeoCost({engineId:'veo-3-1',mode:'i2v',durationSec,resolution,audioEnabled}).providerCostUsd,Number((durationSec*(resolution==='4k'?(audioEnabled?.6:.4):(audioEnabled?.4:.2))).toFixed(6)));
 }
});
