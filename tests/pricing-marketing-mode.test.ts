import assert from 'node:assert/strict';
import test from 'node:test';
import { getFalEngineById, listFalEngines } from '../frontend/src/config/falEngines';
import { makeModelPagePricingHarness } from './helpers/model-page-pricing-harness';

// Break caught: omitting the image mode cannot match a current supported t2i
// quote. Keep the real point loop, resolution selection and family expansions.
test('marketing image points request supported text image modes across image families and both quote readers', async () => {
  const {harness:h,dispose}=await makeModelPagePricingHarness();
  try {
    for (const [modelId,count] of [
      ['gpt-image-2',18],['gpt-image-2-5-flare',30],['gpt-image-2-5-sunburst',30],
      ['nano-banana',3],['nano-banana-2',4],['luma-uni-1',1],['seedream-5-0-pro',1],
    ] as const) {
      const engine=getFalEngineById(modelId)!.engine;
      for (const requireCurrentPolicy of [false,true]) {
        h.configure({reject:(context:any)=>context.mode!=='t2i'});
        const points=await h.points(engine,{requireCurrentPolicy,limit:null});
        assert.equal(points.length,count,`${modelId} current=${requireCurrentPolicy}`);
        assert.ok(points.every((point:any)=>point.cents>0));
        assert.ok(h.calls.every((context:any)=>context.mode==='t2i' && context.durationSec===1 && context.membershipTier==='member'));
        assert.deepEqual(h.readers,Array(count).fill(requireCurrentPolicy?'current':'canonical'));
      }
    }
    // This inventory assertion catches a new pure-image family being skipped
    // without any model-name heuristic in the production selector.
    for (const entry of listFalEngines().filter(row=>row.category==='image')) {
      h.configure({reject:(context:any)=>context.mode!=='t2i'});
      assert.ok((await h.points(entry.engine,{requireCurrentPolicy:true,limit:null})).length>0,entry.id);
    }
  } finally {await dispose();}
});

test('marketing video, mixed modes and explicit duration/tier keep their existing context', async () => {
  const {harness:h,dispose}=await makeModelPagePricingHarness();
  try {
    const base=getFalEngineById('veo-3-1')!.engine;
    for (const engine of [base,getFalEngineById('kling-2-5-turbo')!.engine,
      {...base,modes:['t2v','t2i'],pricing:{unit:'image',currency:'USD'}},
      {...base,modes:['t2v','t2i']}, {...base,modes:[]}]) {
      h.configure({reject:(context:any)=>context.mode!==undefined});
      const points=await h.points(engine,{durationSec:9,memberTier:'pro',requireCurrentPolicy:true});
      assert.ok(points.length>0);
      assert.ok(h.calls.every((context:any)=>context.mode===undefined && context.membershipTier==='pro'));
      assert.ok(h.calls.every((context:any)=>context.durationSec===(engine.pricing?.unit==='image'||engine.modes.length===0?1:9)));
    }
  } finally {await dispose();}
});

test('marketing cannot synthesize image quotes requiring absent sources', async () => {
  const {harness:h,dispose}=await makeModelPagePricingHarness();
  try {
    const base=getFalEngineById('nano-banana')!.engine;
    h.configure({});
    assert.deepEqual(await h.points({...base,modes:['i2i']},{requireCurrentPolicy:true}),[]);
    assert.equal(h.calls.length,0,'an edit-only engine does not support an unreferenced text image scenario');
    for (const modes of [['i2i'],['t2i','i2i']]) {
      const sourceRequired={...base,modes,inputSchema:{...base.inputSchema,
        required:[{id:'image_url',type:'image',modes}]}};
      h.configure({});
      assert.deepEqual(await h.points(sourceRequired,{requireCurrentPolicy:true}),[]);
      assert.equal(await h.range(sourceRequired,{requireCurrentPolicy:true}),null);
      assert.equal(h.calls.length,0,'no reference-free or fabricated-source quote attempt');
    }
    h.configure({});
    const sourceRequiredInAllModes={...base,inputSchema:{...base.inputSchema,
      required:[{id:'image_url',type:'image'}]}};
    assert.deepEqual(await h.points(sourceRequiredInAllModes,{requireCurrentPolicy:true}),[]);
    assert.equal(h.calls.length,0,'an unscoped required source applies to text image mode too');
    // A required field scoped to edit mode does not block the unreferenced t2i scenario.
    h.configure({});
    const editSource={...base,inputSchema:{...base.inputSchema,required:[{id:'image_url',type:'image',modes:['i2i']}]}};
    assert.equal((await h.points(editSource,{requireCurrentPolicy:true})).length,3);
  } finally {await dispose();}
});
