import assert from 'node:assert/strict';
import test from 'node:test';
import {listAudioCapabilities} from '../frontend/src/server/agent-api/audio-capabilities';
import {studioAudioCapabilityDetails} from '../frontend/src/server/studio/conversation-capabilities';
import {getAudioPackConfig} from '../frontend/src/lib/audio-generation';

const env={FAL_KEY:'test-only',GOOGLE_VERTEX_PROJECT_ID:'test-only',GOOGLE_VERTEX_SERVICE_ACCOUNT_JSON:'test-only'};
test('Studio audio details preserve canonical source roles and parameters for all available packs',()=>{
  const catalog=listAudioCapabilities(env);
  for(const entry of catalog.modes){
    const details=studioAudioCapabilityDetails(catalog,entry.engineId);
    assert.ok(details?.surface==='audio');
    assert.deepEqual(details.modes[0].references,entry.references);
    assert.deepEqual(details.modes[0].duration,entry.duration);
    for(const variant of details.modes[0].variants){
      const parameters=variant.parameters;
      const config=getAudioPackConfig(entry.mode);
      assert.equal(parameters.some(p=>p.key==='script'),config.includesVoice);
      assert.equal(parameters.some(p=>p.key==='lyrics'),entry.mode==='song');
      assert.equal(parameters.some(p=>p.key==='exportAudioFile'),config.supportsAudioExport);
      if(config.requiresMood)assert.ok(details.options.moods.length>0);
      if(config.supportsMusicToggle)assert.deepEqual(parameters.find(p=>p.key==='musicEnabled')?.values,[variant.settings.musicEnabled]);
      if(entry.mode==='song')assert.equal(parameters.find(p=>p.key==='lyrics')?.maxChars,3500);
      if(entry.mode==='music_only'&&variant.settings.musicModel==='pro'){
        const duration=parameters.find(p=>p.key==='durationSec');assert.equal(duration?.min,3);assert.equal(duration?.max,184);assert.equal(duration?.values,null);
      }
    }
  }
  assert.equal(studioAudioCapabilityDetails(listAudioCapabilities({}),'audio-song'),null);
});
