import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { getFalEngineById } from '../frontend/src/config/falEngines';
import { mergeEngineLocalizedContent } from '../frontend/lib/models/i18n-normalization';
import { resolveSpecRowLabel } from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-specs';
import { makeModelPagePricingHarness, findModelLayoutElements } from './helpers/model-page-pricing-harness';

const locales = ['en','fr','es'] as const;
const sizes = ['1024x768','1024x1024','1024x1536','1920x1080','2560x1440','3840x2160'];
const qualities = ['low','medium','high'];
async function fixture(modelId: string,locale:typeof locales[number]='en') {
  const engine=getFalEngineById(modelId)!;
  const english=JSON.parse(await readFile(`content/models/en/${engine.modelSlug}.json`,'utf8'));
  const localized=JSON.parse(await readFile(`content/models/${locale}/${engine.modelSlug}.json`,'utf8'));
  return {engine,locale,localizedContent:mergeEngineLocalizedContent(english,localized),
    detailCopy:{backLabel:'Back',pricingLinkLabel:'Pricing',breadcrumb:{home:'Home',models:'Models'}}};
}
function snapshot(context:any) {
  return {totalCents:({low:200,medium:300,high:1000}[context.quality as 'low']??10)+sizes.indexOf(context.resolution),
    currency:'USD',base:{seconds:context.durationSec}};
}
function visible(tree:any) {
  return JSON.parse(JSON.stringify(findModelLayoutElements(tree).flatMap(({name,props})=> {
    if(name==='script') return [{name,content:props.dangerouslySetInnerHTML.__html}];
    if(name==='ModelDecisionPricingCard') return [{name,pricing:props.pricing,offer:props.offer}];
    if(name==='ModelPublicOfferLine') return [{name,offer:props.offer}];
    return [];
  })));
}
function gate() {let release!:()=>void;const promise=new Promise<void>(resolve=>{release=resolve;});return {promise,release};}
const tick=()=>new Promise<void>(resolve=>setImmediate(resolve));

test('image routes share exactly one current-policy grid across the label and spec rows',async t=> {
  const {harness:h,dispose}=await makeModelPagePricingHarness();
  try {
    for(const locale of locales) for(const outcome of ['varied','same','partial','unavailable'] as const) await t.test(`${locale}/${outcome}`,async()=> {
      const input=await fixture('gpt-image-2',locale);
      const quote=(context:any)=> {
        if(outcome==='unavailable'||(outcome==='partial'&&context.quality==='high')) throw new Error('current policy unavailable');
        return outcome==='same'?{totalCents:200,currency:'USD',base:{seconds:1}}:snapshot(context);
      };
      h.configure(input);h.setQuote(quote);
      const expectedLabel=await h.imageLabel(input.engine.engine,locale);
      const expectedRows=await h.imageRows(input.engine.engine,locale,resolveSpecRowLabel(locale,'pricePerImage',true));
      assert.equal(h.calls.length,36,'independent public helpers retain their independent reads');
      h.configure(input);
      const result=await h.page({params:Promise.resolve({slug:input.engine.modelSlug,locale})});
      assert.equal(h.calls.length,18,'one six-size/three-quality grid serves both route projections');
      assert.deepEqual(h.calls.map((context:any)=>[context.resolution,context.quality]),sizes.flatMap(size=>qualities.map(quality=>[size,quality])));
      assert.ok(h.calls.every((context:any)=>context.mode==='t2i'&&context.membershipTier==='member'&&context.durationSec===1));
      assert.deepEqual(h.readers,Array(18).fill('current'),'current policy cannot become a versioned fallback');
      assert.equal(result.props.pricePerImageLabel,expectedLabel);
      const actualRows=result.props.keySpecRows.filter((row:any)=>row.key==='pricePerImage');
      if(expectedRows.length) assert.deepEqual(actualRows,expectedRows);
      else {assert.equal(result.props.keySpecValues.pricePerImage,'Data pending');assert.ok(actualRows.every((row:any)=>row.value==='Data pending'));}
      if(outcome!=='unavailable') assert.equal(expectedLabel,{en:'$2.00/image',fr:'2,00\u00a0$US/image',es:'USD\u00a02.00/image'}[locale]);
      if(outcome==='partial') assert.equal(actualRows[0].valueLines.length,12);
      if(outcome==='same') assert.equal(actualRows[0].valueLines,undefined);
      const metadata=await h.generateMetadata({params:Promise.resolve({slug:input.engine.modelSlug,locale})});
      assert.equal(metadata.alternates.canonical,result.props.canonicalUrl);
      assert.ok(Object.keys(metadata.alternates.languages).length>=3);
    });
  } finally {await dispose();}
});

test('one image grid is sequential, retries on a fresh render and does no extra work for hidden price rows',async()=> {
  const {harness:h,dispose}=await makeModelPagePricingHarness();
  const held=gate();let active=0,maxActive=0;
  try {
    const input=await fixture('gpt-image-2');h.configure(input);
    h.setQuote(async(context:any)=>{active++;maxActive=Math.max(maxActive,active);await held.promise;active--;return snapshot(context);});
    const pending=h.render(input);await tick();
    assert.equal(h.calls.length,1,'points stay sequential rather than spawning the grid together');
    held.release();await pending;
    assert.equal(maxActive,1);assert.equal(h.calls.length,18);
    let unavailable=true;
    h.setQuote((context:any)=>{if(unavailable) throw new Error('temporary policy outage');return snapshot(context);});
    h.configure(input);const failed=await h.render(input);
    assert.equal(h.calls.length,18);assert.equal(failed.props.pricePerImageLabel,null);
    assert.equal(failed.props.keySpecValues.pricePerImage,'Data pending');
    assert.ok(failed.props.keySpecRows.filter((row:any)=>row.key==='pricePerImage').every((row:any)=>row.value==='Data pending'));
    unavailable=false;h.configure(input);const recovered=await h.render(input);
    assert.equal(h.calls.length,18);assert.equal(recovered.props.pricePerImageLabel,'$2.00/image');
    assert.equal(recovered.props.keySpecRows.find((row:any)=>row.key==='pricePerImage').valueLines.length,18);
    const hidden={...input,engine:{...input.engine,surfaces:{...input.engine.surfaces,pricing:{...input.engine.surfaces.pricing,includeInEstimator:false}}}};
    h.configure(hidden);const noRows=await h.render(hidden);
    assert.equal(h.calls.length,18);assert.equal(noRows.props.pricePerImageLabel,'$2.00/image');
    assert.ok(noRows.props.keySpecRows.every((row:any)=>row.key!=='pricePerImage'));
    for(const caps of [
      {...input.engine.engine,modes:['i2i']},
      {...input.engine.engine,modes:['t2i'],inputSchema:{required:[{id:'reference',type:'image',modes:['t2i']}]}},
    ]) {
      const required={...input,engine:{...input.engine,engine:caps}};h.configure(required);
      const result=await h.render(required);assert.equal(h.calls.length,0);
      assert.equal(result.props.pricePerImageLabel,null);assert.equal(result.props.keySpecValues.pricePerImage,'Data pending');
    }
  } finally {held.release();await dispose();}
});

test('video label and rows start independently before either quote is released',async()=> {
  const {harness:h,dispose}=await makeModelPagePricingHarness();const held=gate();let pending:Promise<any>|undefined;
  try {
    const input=await fixture('veo-3-1');h.configure(input);
    h.setQuote(async(context:any)=>{await held.promise;return {totalCents:10*context.durationSec,currency:'USD',base:{seconds:context.durationSec}};});
    pending=h.render(input);await tick();
    assert.equal(h.calls.length,2,'visible label and the first row quote must both start');
    held.release();const result=await pending;
    assert.equal(result.props.pricePerSecondLabel,'$0.10/s');assert.equal(h.calls.length,7);
    h.configure(input);h.setQuote((context:any)=>{if(h.calls.length>1) throw new Error('row unavailable');return {totalCents:10*context.durationSec,currency:'USD',base:{seconds:context.durationSec}};});
    const fallback=await h.render(input);
    const price=fallback.props.keySpecRows.find((row:any)=>row.key==='pricePerSecond');
    assert.equal(price.value,'$0.10/s');assert.equal(price.valueLines,undefined);
  } finally {held.release();await pending?.catch(()=>undefined);await dispose();}
});

test('decision scenarios and visible schema offer start together and preserve rejection behavior',async t=> {
  const {harness:h,dispose}=await makeModelPagePricingHarness();
  try {
    for(const failure of ['none','decision','offer'] as const) await t.test(failure,async()=> {
      const input=await fixture('gpt-image-2');h.configure(input);h.setQuote(snapshot);
      const result=await h.render(input);const held=gate();const calls:any[]=[];const expected=new Error(`${failure} quote failed`);
      h.setPublicQuote(async(value:any)=>{calls.push(value);const index=calls.length;await held.promise;
        if((failure==='decision'&&index===1)||(failure==='offer'&&index===3)) throw expected;
        return {status:'exact',amountCents:246,currency:'USD'};});
      const settled=h.layout(result.props).then((value:any)=>({value}), (error:unknown)=>({error}));
      try {await tick();assert.equal(calls.length,3,'both supported decision quotes and the public offer start before release');}
      finally {held.release();}
      const outcome=await settled;
      if(failure!=='none') assert.equal(outcome.error,expected,'quote failures still reject the real layout');
      else {
        const projection=visible(outcome.value);
        const decision=projection.find((row:any)=>row.name==='ModelDecisionPricingCard');
        assert.equal(decision.offer.amountCents,246);
        assert.deepEqual(decision.pricing.scenarios.slice(0,2).map((scenario:any)=>scenario.value),['$2.46','$2.46']);
        const product=projection.filter((row:any)=>row.name==='script').map((row:any)=>JSON.parse(row.content)).find((row:any)=>row['@type']==='Product');
        assert.equal(product.offers.price,'2.46');
      }
    });
  } finally {await dispose();}
});
