import assert from 'node:assert/strict';
import test from 'node:test';
import { supportsSeedanceDraftSetup } from '../frontend/lib/seedance-draft-setup';
import { getBaseEnginesByCategory } from '../frontend/src/lib/engines';

test('native Draft compatibility is shared by the preview and real workflow, without treating other models as Draft', ()=>{
 const base={engineId:'seedance-2-5',mode:'t2v',iterations:1,aspectRatio:'16:9'};
 for(const mode of ['t2v','i2v','ref2v','v2v','extend']) {
  for(const aspectRatio of ['auto','21:9','16:9','4:3','1:1','3:4','9:16']) {
   assert.equal(supportsSeedanceDraftSetup({...base,mode,aspectRatio}),true,`${mode}/${aspectRatio}`);
  }
  assert.equal(supportsSeedanceDraftSetup({...base,mode,iterations:2}),false);
 }
 assert.equal(supportsSeedanceDraftSetup({...base,mode:'reframe'}),false);
 assert.equal(supportsSeedanceDraftSetup({...base,aspectRatio:'7:5'}),false);
 for(const mode of ['i2v','v2v']) assert.equal(supportsSeedanceDraftSetup({...base,mode,aspectRatio:'7:5'}),true,'source-derived framing remains accepted');
 for(const engine of getBaseEnginesByCategory('video')) {
  assert.equal(supportsSeedanceDraftSetup({...base,engineId:engine.id}),engine.id==='seedance-2-5',engine.id);
 }
});
