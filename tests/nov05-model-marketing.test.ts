import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {getRuntimeModelById} from '../frontend/config/model-runtime';
import {getFalEngineById} from '../frontend/src/config/falEngines';
import {getModelPageTemplateConfig} from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-template-registry';
import {parseModelDecisionContent} from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-decision-content';
import {parseModelPromptingContent} from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-prompting-content';
import {parseModelExamplesContent} from '../frontend/app/(localized)/[locale]/(marketing)/models/[slug]/_lib/model-page-examples-content';

for (const id of ['kling-v4-flash','gpt-image-2-6-flare','gpt-image-2-6-sunburst']) test(`${id} has three reviewed localized candidates with exact-model media and no premature discovery`,()=>{
  const model=getRuntimeModelById(id)!;
  assert.equal(model.publication.model.published,false);
  assert.equal(model.publication.sitemap.published,false);
  assert.equal(model.publication.examples.published,false);
  assert.equal(model.replacement ?? null,null);
  const entry=getFalEngineById(id)!;
  assert.equal(entry.media,undefined);
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
