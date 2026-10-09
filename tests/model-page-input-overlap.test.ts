import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { mergeEngineLocalizedContent } from '../frontend/lib/models/i18n-normalization';
import { makeModelPagePricingHarness } from './helpers/model-page-pricing-harness';

const locales = ['en', 'fr', 'es'] as const;
const tick = () => new Promise<void>(resolve => setImmediate(resolve));
function gate() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}
async function fixture(modelId: string, locale: typeof locales[number] = 'en') {
  const engine = getFalEngineById(modelId)!;
  const english = JSON.parse(await readFile(`content/models/en/${engine.modelSlug}.json`, 'utf8'));
  const local = JSON.parse(await readFile(`content/models/${locale}/${engine.modelSlug}.json`, 'utf8'));
  const media = { id: 'fixture-one', engineId: engine.id, prompt: 'A product on a tabletop',
    durationSec: 5, aspectRatio: '9:16', thumbUrl: 'https://media.maxvideoai.com/fixture/one.webp',
    videoUrl: engine.category === 'image' ? null : '/fixtures/one.mp4' };
  return { engine, locale, localizedContent: mergeEngineLocalizedContent(english, local),
    detailCopy: {backLabel:'Back',pricingLinkLabel:'Pricing',breadcrumb:{home:'Home',models:'Models'}},
    managed: true, examples: [media], publicVideos: [media], scoreSlugs: [engine.modelSlug],
    override: {currency:'USD',perSecondCents:{default:10},addons:{}} };
}

test('actual model pricing awaits only the request override and overlaps held gallery/spec/score reads', async t => {
  const {harness:h,dispose} = await makeModelPagePricingHarness({executeInputs:true,executeGallery:true});
  try {
    for (const modelId of ['veo-3-1','gpt-image-2']) for (const locale of locales) await t.test(`${modelId}/${locale}`, async () => {
      const input = await fixture(modelId, locale);
      const held = Object.fromEntries(['engine-settings','scores','key-specs','model-gallery','quote'].map(name => [name,gate()]));
      let active = 0, maxActive = 0;
      h.configure({...input,read:(name:string)=>held[name].promise});
      h.setQuote(async (context:any) => {
        active++; maxActive = Math.max(maxActive,active);
        await held.quote.promise; active--;
        return {totalCents:10*context.durationSec,currency:'USD',base:{seconds:context.durationSec}};
      });
      const pending = h.render(input);
      try {
        await tick();
        assert.deepEqual([...h.inputReads].sort(),['engine-settings','key-specs','model-gallery','scores']);
        assert.equal(h.calls.length,0,'pricing cannot use an override that has not resolved');
        held['engine-settings'].release();
        await tick();
        assert.equal(h.calls.length,modelId === 'gpt-image-2' ? 1 : 2,
          'existing quote workers start while every independent reader remains held');
        held.quote.release(); await tick();
        assert.equal(h.calls.length,modelId === 'gpt-image-2' ? 18 : 4);
        assert.equal(h.timingRecords.length,0,'completion waits for the still-held gallery/spec/score reads');
        for (const name of ['scores','key-specs','model-gallery']) held[name].release();
        const result = await pending; await tick();
        assert.equal(maxActive,modelId === 'gpt-image-2' ? 1 : 2,'quote worker counts stay unchanged');
        assert.equal(h.inputReads.length,4,'one read per independent input');
        assert.equal(h.playlistReads.length,1);
        assert.equal(h.exampleQuoteCalls.length,0);
        assert.deepEqual(h.timingRecords[0].phases.map((phase:any)=>[phase.phase,phase.status]),[
          ['scores','ok'],['engine-settings','ok'],['key-specs','ok'],['model-gallery','ok'],['model-pricing','ok'],
        ]);
        assert.ok(h.timingRecords[0].phases.every((phase:any)=>phase.durationMs !== null));
        assert.deepEqual(result.props.pricingEngine.pricingDetails,input.override);
        h.configure(input);h.setQuote((context:any)=>({totalCents:10*context.durationSec,currency:'USD',base:{seconds:context.durationSec}}));
        const control = await h.render(input); await tick();
        assert.deepEqual(result.props,control.props,'overlap preserves every localized route prop');
      } finally {
        Object.values(held).forEach(value=>value.release());
        await pending.catch(()=>undefined); await tick();
      }
    });
  } finally { await dispose(); }
});

test('model input failures reject promptly while diagnostic completion observes later sibling errors', async t => {
  const {harness:h,dispose} = await makeModelPagePricingHarness({executeInputs:true});
  try {
    for (const failAt of ['model-pricing','engine-settings','scores'] as const) await t.test(failAt, async () => {
      const input = await fixture('gpt-image-2','fr');
      const gallery = gate(), latePrice = gate();
      const original = new Error(`${failAt} original failure`), later = new Error('late gallery failure');
      let pricesStarted = 0;
      h.configure({...input,read:async (name:string)=>{if(name===failAt) throw original;}});
      const pending = h.inputs('fr', async()=>{await gallery.promise;throw later;}, async()=>{
        pricesStarted++;
        if(failAt==='model-pricing') throw original;
        await latePrice.promise;
        if(failAt==='scores') throw new Error('late price failure');
        return 'price';
      });
      const rejected = assert.rejects(pending,(error:unknown)=>error===original);
      try {
        await rejected;
        assert.equal(h.timingRecords.length,0,'a hung gallery cannot delay the original failure or emit incomplete timing');
        assert.equal(pricesStarted,failAt==='engine-settings'?0:1);
        gallery.release();latePrice.release();await tick();
        assert.equal(h.timingRecords.length,1,'emit exactly one eventual record');
        const record = h.timingRecords[0];
        assert.equal(record.status,'error');
        assert.ok(record.phases.every((phase:any)=>phase.status!=='pending'&&phase.durationMs!==null));
        const phases = new Map(record.phases.map((phase:any)=>[phase.phase,phase.status]));
        assert.equal(phases.get(failAt),'error');
        assert.equal(phases.get('model-gallery'),'error');
        assert.equal(phases.get('model-pricing'),failAt==='engine-settings'?undefined:'error');
        assert.ok(!JSON.stringify(record).includes(original.message));
        assert.ok(!JSON.stringify(record).includes(later.message));
      } finally { gallery.release();latePrice.release();await pending.catch(()=>undefined);await tick(); }
    });
    const input = await fixture('veo-3-1');h.configure(input);
    const legacy = await h.inputs('en',async()=>42);await tick();
    assert.equal(legacy.gallery,42);
    assert.equal(Object.hasOwn(legacy,'pricing'),false,'the original two-argument API remains compatible');
    assert.ok(h.timingRecords[0].phases.every((phase:any)=>phase.phase!=='model-pricing'));
  } finally {await dispose();}
});

test('disabled timing preserves synchronous gallery and pricing callback failures as original promise rejections', async () => {
  const {harness:h,dispose} = await makeModelPagePricingHarness({executeInputs:true,timingEnabled:false});
  try {
    const input = await fixture('veo-3-1');
    for (const callback of ['gallery','pricing']) {
      h.configure(input);
      const original = new Error(`synchronous ${callback} failure`);
      const pending = callback === 'gallery'
        ? h.inputs('en',()=>{throw original;})
        : h.inputs('en',async()=>42,()=>{throw original;});
      assert.equal(typeof pending?.then,'function','the loader always returns its public result promise');
      await assert.rejects(pending,(error:unknown)=>error===original);
      await tick();
      assert.equal(h.timingRecords.length,0);
      assert.deepEqual(h.inputReads,['scores','engine-settings','key-specs']);
    }
  } finally {await dispose();}
});
