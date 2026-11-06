import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {getRuntimeModelById} from '../frontend/config/model-runtime';
import {getFalEngineById} from '../frontend/src/config/falEngines';
import {getModelPageTemplateConfig} from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-registry';
import {parseModelDecisionContent} from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-content';
import {parseModelPromptingContent} from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-content';
import {parseModelExamplesContent} from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-content';
import {listGpt26EditorialImages} from '../frontend/lib/gpt26-editorial-images';
import {buildLlmsModelDiscoveryProjection} from '../frontend/lib/seo/llms-text';
import {listRuntimeModels} from '../frontend/config/model-runtime';
import {getImagePricePresetInput} from '../frontend/app/(localized)/[locale]/(marketing)/pricing/_lib/pricingHubData';

for (const id of ['kling-v4-flash','gpt-image-2-6-flare','gpt-image-2-6-sunburst']) test(`${id} publishes three localized model pages with exact-model media and supported discovery`,()=>{
  const model=getRuntimeModelById(id)!;
  assert.equal(model.publication.model.published,true);
  assert.equal(model.publication.model.indexable,true);
  assert.equal(model.publication.sitemap.published,true);
  assert.equal(model.publication.pricing.published,true);
  assert.equal(model.publication.examples.published,id==='kling-v4-flash');
  assert.equal(model.publication.compare.published,id==='kling-v4-flash');
  assert.equal(model.replacement ?? null,null);
  const entry=getFalEngineById(id)!;
  if(id.startsWith('gpt')){
    const hero=listGpt26EditorialImages(id).find(image=>image.role==='hero')!;
    assert.equal(entry.media?.imagePath,hero.display.url);
    assert.equal(entry.media?.videoUrl,hero.original.url);
    for(const high of [false,true]){
      const preset=getImagePricePresetInput(entry,high);
      assert.ok(entry.engine.resolutions.includes(preset.resolution));
      assert.equal(preset.quality,high?'high':'medium');
    }
  }else assert.equal(entry.media,undefined);
  assert.equal(entry.demoUrl,undefined);
  const template=getModelPageTemplateConfig(id)!;
  assert.ok(template);
  assert.equal(template.hero.primaryCtaHref,`/app${id.startsWith('gpt')?'/image':''}?engine=${id}`);
  for(const locale of ['en','fr','es'] as const){
    const content=JSON.parse(readFileSync(`content/models/${locale}/${id}.json`,'utf8'));
    const decision=parseModelDecisionContent(content.decision,id,locale);
    const prompts=parseModelPromptingContent(content.prompting,id,locale);
    const examples=parseModelExamplesContent(content.examples,id,locale);
    assert.equal(decision.hero.primaryCta.href,template.hero.primaryCtaHref);
    assert.equal(examples.showWhenEmpty,false);assert.equal(examples.fallbackItems,null);
    assert.ok(prompts.section.guide?.href.startsWith('https://'));
    assert.doesNotMatch(JSON.stringify(content),/media\.maxvideoai\.com|job_external_|\.mp4|\$\d/);
    if(id.startsWith('gpt'))assert.equal(prompts.imageExamples?.items.length,2);
    else {assert.equal(prompts.tabs.length,3);assert.ok(prompts.tabs.every(tab=>tab.matchPublicExample===true));}
  }
});

test('machine discovery publishes the three model identities and Flash comparison, and respects rollback',()=>{
  const ids=['kling-v4-flash','gpt-image-2-6-flare','gpt-image-2-6-sunburst'];
  const projection=buildLlmsModelDiscoveryProjection();
  for(const id of ids)assert.equal(projection.currentModels.filter(model=>model.id===id).length,1);
  assert.ok(projection.primaryComparisons.some(pair=>pair.slug==='kling-v4-vs-kling-v4-flash'));
  const models=listRuntimeModels().map(model=>structuredClone(model));
  for(const model of models.filter(model=>ids.includes(model.id))){
    model.publication.model={published:false,indexable:false};
    model.publication.compare.published=false;
  }
  const closed=buildLlmsModelDiscoveryProjection({models});
  assert.ok(closed.currentModels.every(model=>!ids.includes(model.id)));
  assert.ok(closed.primaryComparisons.every(pair=>pair.slug!=='kling-v4-vs-kling-v4-flash'));
});
